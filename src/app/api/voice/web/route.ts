import { isLocale, type Locale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { getSession } from "@/lib/auth";
import { normalizePhone, withDialCode } from "@/lib/validation";
import { WEB_VOICE_HEADER } from "@/lib/voice/web-audio";
import { isWav, MAX_AUDIO_BYTES, sttConfigured, transcribe } from "@/lib/voice/stt";
import { azureConfig, synthesize, WEB_AUDIO_FORMAT } from "@/lib/voice/tts";
import { continueWebSession, startWebSession, unavailableReason, type WebTurn } from "@/lib/voice/web-flow";

export const dynamic = "force-dynamic";

// Browser voice agent (components/dashboard/web-voice-agent.tsx). One POST per
// turn, multipart form:
//   action=start  phone, phoneCountry           -> greeting
//   action=turn   state, locale, and one of: audio (16 kHz WAV), text, choice
// Answers JSON: the agent's text, options, the next state token, what was
// heard, and the reply as base64 MP3 when Azure Speech is configured.
//
// Auth is the dashboard session; the salon comes from it, never from the
// request. The custom header forces a CORS preflight (which this route never
// answers), so other sites can't post here with the user's cookies.


function json(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function sameOrigin(request: Request): boolean {
  if (request.headers.get(WEB_VOICE_HEADER) !== "1") return false;
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin || origin === process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
  const session = await getSession();
  if (!session) return json({ error: "unauthorized" }, 401);
  const reason = unavailableReason(session.salon);
  if (reason) return json({ error: reason }, 409);

  try {
    const form = await request.formData();
    const action = form.get("action");
    let turn: WebTurn | null;
    let heard: string | undefined;

    if (action === "start") {
      const phone = normalizePhone(withDialCode(form, "phone") ?? "");
      if (!phone) return json({ error: "phone" }, 400);
      turn = await startWebSession(session.salon, phone, (await getI18n()).locale);
    } else if (action === "turn") {
      const token = form.get("state");
      if (typeof token !== "string" || token.length > 4_000) return json({ error: "expired" }, 410);
      const rawLocale = form.get("locale");
      const locale: Locale = isLocale(rawLocale) ? rawLocale : "ka";
      const raw = form.get("choice");
      const choice = typeof raw === "string" && /^[1-9]$/.test(raw) ? Number(raw) : null;
      let text = typeof form.get("text") === "string" ? String(form.get("text")) : "";

      const audio = form.get("audio");
      if (audio instanceof Blob && audio.size > 0) {
        if (audio.size > MAX_AUDIO_BYTES) return json({ error: "too_large" }, 413);
        const bytes = await audio.arrayBuffer();
        if (!isWav(new Uint8Array(bytes))) return json({ error: "bad_audio" }, 400);
        if (sttConfigured()) {
          try {
            text = await transcribe(bytes, locale);
          } catch (err) {
            // Counts as "didn't hear anything"; the agent asks again.
            console.error("web voice stt failed", { salonId: session.salon.id, err: err instanceof Error ? err.message : err });
            text = "";
          }
        }
        heard = text;
      }
      turn = await continueWebSession(session.salon, token, { text, choice });
      if (!turn) return json({ error: "expired" }, 410);
    } else {
      return json({ error: "bad_request" }, 400);
    }

    return json({
      text: turn.text,
      options: turn.options,
      state: turn.state,
      locale: turn.locale,
      booking: turn.booking,
      heard,
      audio: form.get("voice") === "0" ? null : await speech(turn),
    });
  } catch (err) {
    console.error("web voice turn failed", { salonId: session.salon.id, err: err instanceof Error ? err.message : err });
    return json({ error: "failed" }, 500);
  }
}

/** The reply as base64 MP3, or null without Azure (the page then shows text only). */
async function speech(turn: WebTurn): Promise<string | null> {
  const azure = azureConfig();
  if (!azure || !turn.speech) return null;
  try {
    return Buffer.from(await synthesize(turn.speech, azure.voices[turn.locale], WEB_AUDIO_FORMAT)).toString("base64");
  } catch (err) {
    console.error("web voice tts failed", { chars: turn.speech.length, err: err instanceof Error ? err.message : err });
    return null;
  }
}
