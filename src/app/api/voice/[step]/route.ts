import { STEPS, handleVoiceStep, type Step } from "@/lib/voice/flow";
import { twiml, twimlError, verifyTwilioRequest } from "@/lib/voice/twilio";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (!STEPS.includes(step as Step)) return new Response("Not found", { status: 404 });

  try {
    const verified = await verifyTwilioRequest(request);
    if (!verified) return new Response("Forbidden", { status: 403 });
    return twiml(await handleVoiceStep(step as Step, verified.params, verified.url.searchParams));
  } catch (err) {
    // Twilio plays its own "application error" message on a 500, so always
    // answer with TwiML the caller can understand.
    console.error("voice webhook failed", { step, err: err instanceof Error ? err.message : err });
    return twimlError();
  }
}
