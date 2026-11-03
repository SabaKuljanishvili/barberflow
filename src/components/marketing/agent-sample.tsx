import { getI18n } from "@/i18n/server";
import { AGENT_SAMPLE_AUDIO_SRC } from "@/lib/site";

/** Trust content: what the agent sounds like, with a readable transcript. */
export async function AgentSample() {
  const { t } = await getI18n();
  const s = t.sample;
  return (
    <section aria-labelledby="sample" className="wrap bf-cb sec">
      <div className="sec-head sr">
        <span className="eyebrow">{s.eyebrow}</span>
        <h2 id="sample" className="serif h2">
          {s.title}
        </h2>
        <p className="p">{s.intro}</p>
      </div>
      <div className="bf-card sample">
        {AGENT_SAMPLE_AUDIO_SRC && (
          <audio controls preload="none" src={AGENT_SAMPLE_AUDIO_SRC} aria-describedby="sample-transcript" />
        )}
        <h3 className="sr-only" id="sample-transcript">
          {s.transcript}
        </h3>
        <dl className="sample-lines" aria-labelledby="sample-transcript">
          {s.lines.map((line, i) => (
            <div key={i}>
              <dt>{line.who === "agent" ? s.agent : s.caller}</dt>
              <dd>{line.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
