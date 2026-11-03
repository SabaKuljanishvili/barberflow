"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { CalendarCheck2, Mic, MicOff, PhoneOff, RotateCcw, Send } from "lucide-react";
import { AiMark } from "@/components/marketing/ai-mark";
import { PhoneField } from "@/components/ui/phone-field";
import { INTL_LOCALE, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { base64ToBytes, concat, downsample, encodeWav, Endpointer, rms, WEB_VOICE_HEADER } from "@/lib/voice/web-audio";

// Browser voice agent. One conversation = one microphone stream and one
// AudioContext, both opened by the Start click (so autoplay rules allow the
// replies). Turns alternate: the agent speaks, then the page listens until
// the speaker pauses (Endpointer), uploads 16 kHz WAV to /api/voice/web and
// plays the MP3 it gets back. The server owns the conversation state; the
// page only carries its signed token.
//
// Speech in: Azure via the server when configured, else the browser's own
// recognizer (Chrome/Edge), else typing. Options can always be clicked and
// replies typed.

type Labels = Dictionary["dashboard"]["voiceAgent"];
type Phase = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "paused" | "ended";
type Message = { id: number; who: "agent" | "you"; text: string };
type Booking = { id: string; service: string; barber: string; when: string; start: string };
type Reply = { text: string; options: string[] | null; state: string | null; locale: Locale; booking?: Booking; heard?: string; audio: string | null };
type ErrorKey = keyof Labels["errors"];
type SpeechMode = "azure" | "browser" | "text";

// The Web Speech API is not in TypeScript's DOM types.
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noop = () => () => {};

export function WebVoiceAgent({ labels: L, azure, appointmentsHref }: { labels: Labels; azure: boolean; appointmentsHref: string }) {
  const browserStt = useSyncExternalStore(noop, () => recognitionCtor() !== null, () => false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [level, setLevel] = useState(0);
  const [mode, setModeState] = useState<SpeechMode>("text");
  // Read by the audio callback, which is created once per conversation.
  const modeRef = useRef<SpeechMode>("text");
  const setMode = (m: SpeechMode) => {
    modeRef.current = m;
    setModeState(m);
  };
  const [draft, setDraft] = useState("");

  const token = useRef<string | null>(null);
  const locale = useRef<Locale>("ka");
  const audio = useRef<{ ctx: AudioContext; stream: MediaStream | null; node: ScriptProcessorNode | null } | null>(null);
  const listening = useRef<{ endpointer: Endpointer; chunks: Float32Array[] } | null>(null);
  const playing = useRef<{ stop(): void } | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const nextId = useRef(0);
  const log = useRef<HTMLOListElement>(null);

  const active = phase !== "idle" && phase !== "ended";
  const speechMode: SpeechMode = azure ? "azure" : browserStt ? "browser" : "text";

  useEffect(() => () => teardown(), []);
  useEffect(() => {
    log.current?.lastElementChild?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages]);

  function say(who: Message["who"], text: string) {
    if (!text) return;
    setMessages((m) => [...m, { id: nextId.current++, who, text }]);
  }

  function teardown() {
    playing.current?.stop();
    playing.current = null;
    listening.current = null;
    recognition.current?.abort();
    recognition.current = null;
    const a = audio.current;
    audio.current = null;
    a?.node?.disconnect();
    a?.stream?.getTracks().forEach((t) => t.stop());
    void a?.ctx.close().catch(() => {});
  }

  async function post(form: FormData): Promise<Reply | { error: ErrorKey }> {
    try {
      const res = await fetch("/api/voice/web", { method: "POST", body: form, headers: { [WEB_VOICE_HEADER]: "1" } });
      const body = (await res.json().catch(() => ({}))) as Partial<Reply> & { error?: string };
      if (res.ok && typeof body.text === "string") return body as Reply;
      const known: ErrorKey[] = ["disabled", "cancelled", "phone", "expired"];
      return { error: known.includes(body.error as ErrorKey) ? (body.error as ErrorKey) : "failed" };
    } catch {
      return { error: "failed" };
    }
  }

  async function start(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    teardown();
    setError(null);
    setMessages([]);
    setOptions([]);
    setBookings([]);
    token.current = null;
    setPhase("connecting");

    // Created inside the click, so the browser lets it play audio later.
    const ctx = new AudioContext();
    void ctx.resume();
    audio.current = { ctx, stream: null, node: null };
    let chosen = speechMode;
    if (speechMode === "azure") {
      try {
        await openMicrophone(ctx);
      } catch {
        setError("mic");
        chosen = browserStt ? "browser" : "text";
      }
    }
    setMode(chosen);

    const form = new FormData();
    form.set("action", "start");
    form.set("phone", String(fields.get("phone") ?? ""));
    form.set("phoneCountry", String(fields.get("phoneCountry") ?? ""));
    if (!azure) form.set("voice", "0");
    await handle(await post(form));
  }

  async function openMicrophone(ctx: AudioContext) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    // ScriptProcessorNode is deprecated, but AudioWorklet modules are blocked
    // by our CSP ('strict-dynamic' ignores 'self'), and this runs everywhere.
    const node = ctx.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = (event) => {
      const turn = listening.current;
      if (!turn) return;
      const frame = event.inputBuffer.getChannelData(0);
      turn.chunks.push(new Float32Array(frame));
      const lvl = rms(frame);
      setLevel(lvl);
      const state = turn.endpointer.push(lvl, (frame.length / ctx.sampleRate) * 1000);
      if (state === "done" || state === "no-speech") {
        listening.current = null;
        setLevel(0);
        if (state === "no-speech") setPhase("paused");
        else void send({ audio: encodeWav(downsample(concat(turn.chunks), ctx.sampleRate)) });
      }
    };
    ctx.createMediaStreamSource(stream).connect(node);
    node.connect(ctx.destination); // outputs silence; needed for the node to run
    if (audio.current) Object.assign(audio.current, { stream, node });
  }

  async function handle(reply: Reply | { error: ErrorKey }) {
    if ("error" in reply) {
      setError(reply.error);
      if (reply.error === "failed" && token.current) setPhase("paused");
      else if (reply.error === "phone") {
        setPhase("idle");
        teardown();
      } else {
        token.current = null;
        setPhase("ended");
        teardown();
      }
      return;
    }
    if (reply.heard) say("you", reply.heard);
    say("agent", reply.text);
    if (reply.options) setOptions(reply.options);
    if (reply.booking) setBookings((b) => [reply.booking as Booking, ...b]);
    token.current = reply.state;
    locale.current = reply.locale;

    setPhase("speaking");
    await speak(reply);
    if (!token.current) {
      setOptions([]);
      setPhase("ended");
      teardown();
      return;
    }
    listen();
  }

  /** Plays the reply: Azure MP3, else the browser's own voice when it has one for this language. */
  async function speak(reply: Reply) {
    const ctx = audio.current?.ctx;
    if (reply.audio && ctx) {
      try {
        const bytes = base64ToBytes(reply.audio);
        const buffer = await ctx.decodeAudioData(bytes.buffer as ArrayBuffer);
        await new Promise<void>((resolve) => {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.onended = () => resolve();
          playing.current = { stop: () => { source.onended = null; try { source.stop(); } catch {} resolve(); } };
          source.start();
        });
      } catch {
        // Undecodable audio: the text is on screen anyway.
      }
      playing.current = null;
      return;
    }
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    const lang = INTL_LOCALE[reply.locale];
    const voice = synth?.getVoices().find((v) => v.lang.replace("_", "-").startsWith(lang.slice(0, 2)));
    if (!synth || !voice) return;
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(reply.text);
      u.voice = voice;
      u.lang = lang;
      u.onend = u.onerror = () => resolve();
      playing.current = { stop: () => { synth.cancel(); resolve(); } };
      synth.speak(u);
    });
    playing.current = null;
  }

  function listen() {
    if (!token.current) return;
    const current = modeRef.current;
    if (current === "azure" && audio.current?.node) {
      listening.current = { endpointer: new Endpointer(), chunks: [] };
      setPhase("listening");
      return;
    }
    const Ctor = current === "browser" ? recognitionCtor() : null;
    if (!Ctor) {
      setPhase("paused");
      return;
    }
    const rec = new Ctor();
    rec.lang = INTL_LOCALE[locale.current];
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let heard = "";
    rec.onresult = (e) => {
      heard = Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" ").trim();
    };
    rec.onerror = () => {};
    rec.onend = () => {
      if (recognition.current !== rec) return;
      recognition.current = null;
      if (heard) void send({ text: heard });
      else setPhase("paused");
    };
    recognition.current = rec;
    setPhase("listening");
    rec.start();
  }

  function interrupt() {
    playing.current?.stop();
    listening.current = null;
    setLevel(0);
    const rec = recognition.current;
    recognition.current = null;
    rec?.abort();
  }

  async function send(input: { audio?: ArrayBuffer; text?: string; choice?: number }) {
    if (!token.current) return;
    interrupt();
    const form = new FormData();
    form.set("action", "turn");
    form.set("state", token.current);
    form.set("locale", locale.current);
    if (!azure) form.set("voice", "0");
    if (input.audio) form.set("audio", new Blob([input.audio], { type: "audio/wav" }), "turn.wav");
    if (input.text) {
      form.set("text", input.text);
      say("you", input.text);
    }
    if (input.choice) {
      form.set("choice", String(input.choice));
      say("you", options[input.choice - 1] ?? String(input.choice));
    }
    setPhase("thinking");
    await handle(await post(form));
  }

  function submitText(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void send({ text });
  }

  function end() {
    teardown();
    token.current = null;
    setOptions([]);
    setLevel(0);
    setPhase("ended");
  }

  const statusText = phase === "paused" ? (mode === "text" ? L.typeLabel : L.speakNow) : L.status[phase];
  const canListen = mode !== "text" && (phase === "paused" || phase === "speaking");

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <section aria-labelledby="conversation" className="card flex min-h-[28rem] flex-col xl:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <AiMark size="lg" />
          <div className="min-w-0">
            <h2 id="conversation" className="text-lg font-semibold">
              {L.conversation}
            </h2>
            <p className="text-sm text-muted" role="status" aria-live="polite">
              {statusText}
            </p>
          </div>
          {phase === "listening" && mode === "azure" && (
            <div className="ml-auto flex h-6 items-end gap-0.5" role="meter" aria-label={L.micLevel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, level * 8) * 100)}>
              {[0.2, 0.45, 0.7, 1, 0.7, 0.45, 0.2].map((w, i) => (
                <span key={i} className="w-1.5 rounded-full bg-brand transition-[height] duration-75" style={{ height: `${Math.max(12, Math.min(1, level * 8 * w) * 100)}%` }} />
              ))}
            </div>
          )}
          {active && (
            <div className={`flex gap-2 ${phase === "listening" && mode === "azure" ? "" : "ml-auto"}`}>
              {canListen && (
                <button type="button" className="btn-secondary py-1.5" onClick={() => { interrupt(); listen(); }}>
                  <Mic aria-hidden className="size-4" />
                  {L.speakNow}
                </button>
              )}
              <button type="button" className="btn-danger py-1.5" onClick={end}>
                <PhoneOff aria-hidden className="size-4" />
                {L.end}
              </button>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {L.errors[error]}{" "}
            {error === "disabled" && (
              <Link href="/dashboard/settings" className="font-medium underline underline-offset-2">
                {L.errors.openSettings}
              </Link>
            )}
          </p>
        )}

        {messages.length ? (
          <ol ref={log} className="mt-4 flex max-h-[32rem] flex-1 flex-col gap-3 overflow-y-auto pr-1" aria-label={L.conversation}>
            {messages.map((m) => (
              <li key={m.id} className={`max-w-[85%] rounded-3xl px-4 py-2.5 text-sm leading-6 ${m.who === "agent" ? "self-start bg-canvas text-ink" : "self-end bg-brand text-on-brand"}`}>
                <span className="sr-only">{m.who === "agent" ? L.agent : L.you}: </span>
                {m.text}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-6 flex-1 text-sm text-muted">{L.empty}</p>
        )}

        {active && options.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-muted">{L.options}</p>
            <div className="flex flex-wrap gap-2">
              {options.map((label, i) => (
                <button key={`${i}-${label}`} type="button" className="btn-secondary py-1.5 text-left text-xs" disabled={phase === "thinking"} onClick={() => void send({ choice: i + 1 })}>
                  <span className="font-semibold text-accent">{i + 1}</span> {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {active && (
          <form onSubmit={submitText} className="mt-4 flex gap-2">
            <label htmlFor="voice-reply" className="sr-only">
              {L.typeLabel}
            </label>
            <input id="voice-reply" className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={L.typePlaceholder} maxLength={300} autoComplete="off" disabled={phase === "thinking"} />
            <button type="submit" className="btn-primary shrink-0" disabled={phase === "thinking" || !draft.trim()}>
              <Send aria-hidden className="size-4" />
              <span className="sr-only sm:not-sr-only">{L.send}</span>
            </button>
          </form>
        )}
      </section>

      <div className="flex flex-col gap-6">
        {bookings.map((b) => (
          <section key={b.id} aria-label={L.bookedTitle} className="card border-brand bg-brand-soft">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarCheck2 aria-hidden className="size-5 text-accent" />
              {L.bookedTitle}
            </h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">{L.service}</dt>
              <dd className="font-medium">{b.service}</dd>
              <dt className="text-muted">{L.barber}</dt>
              <dd className="font-medium">{b.barber}</dd>
              <dt className="text-muted">{L.when}</dt>
              <dd className="font-medium">{b.when}</dd>
            </dl>
            <Link href={appointmentsHref} className="mt-4 inline-block text-sm font-medium text-accent underline underline-offset-2">
              {L.viewAppointments}
            </Link>
          </section>
        ))}

        <section aria-labelledby="caller" className="card">
          <h2 id="caller" className="text-lg font-semibold">
            {L.callerTitle}
          </h2>
          <form onSubmit={start} className="mt-4 space-y-4">
            <PhoneField label={L.phone} name="phone" hint={L.phoneHint} autoComplete="off" required disabled={active} />
            <button type="submit" className="btn-primary w-full" disabled={active}>
              {phase === "ended" ? <RotateCcw aria-hidden className="size-4" /> : <Mic aria-hidden className="size-4" />}
              {phase === "ended" ? L.restart : L.start}
            </button>
          </form>
        </section>

        <section aria-labelledby="setup" className="card">
          <h2 id="setup" className="text-lg font-semibold">
            {L.setupTitle}
          </h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">{L.stt}</dt>
            <dd className="flex items-center gap-1.5 font-medium">
              {speechMode === "text" ? <MicOff aria-hidden className="size-4 text-muted" /> : <Mic aria-hidden className="size-4 text-accent" />}
              {speechMode === "azure" ? L.azure : speechMode === "browser" ? L.browser : L.typingOnly}
            </dd>
            <dt className="text-muted">{L.tts}</dt>
            <dd className="font-medium">{azure ? L.azure : L.textOnly}</dd>
          </dl>
          {!azure && <p className="mt-3 text-xs text-muted">{L.azureHint}</p>}
        </section>
      </div>
    </div>
  );
}
