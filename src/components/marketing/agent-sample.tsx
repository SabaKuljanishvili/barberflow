import { getI18n } from "@/i18n/server";
import { AGENT_SAMPLE_AUDIO_SRC, AGENT_SAMPLE_CUES } from "@/lib/site";
import { CallSample } from "./call-sample";

/**
 * "Hear it" section: a phone mockup that plays the sample call (when a
 * recording exists) next to its transcript. Styles: landing.css `.cs`.
 * The hero's "Listen" button links here (#sample).
 */
export async function AgentSample() {
  const { t } = await getI18n();
  const s = t.sample;
  return (
    <section id="sample" aria-labelledby="sample-title" className="wrap bf-cb sec cs">
      <CallSample
        head={
          <>
            <span className="eyebrow">{s.eyebrow}</span>
            <h2 id="sample-title" className="cs-title">
              {s.titleBefore}
              <em>{s.titleEm}</em>
            </h2>
          </>
        }
        lines={s.lines}
        labels={{
          transcript: s.transcript,
          agent: s.agent,
          caller: s.caller,
          phoneLabel: s.phoneLabel,
          answering: s.answering,
          booking: s.booking,
          play: s.play,
          pause: s.pause,
          soon: s.soon,
        }}
        src={AGENT_SAMPLE_AUDIO_SRC}
        cues={AGENT_SAMPLE_CUES}
      />
    </section>
  );
}
