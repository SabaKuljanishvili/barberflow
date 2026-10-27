import { recordCallStatus } from "@/lib/voice/flow";
import { verifyTwilioRequest } from "@/lib/voice/twilio";

export const dynamic = "force-dynamic";

// Set as the number's "Call status changes" webhook in the Twilio console.
export async function POST(request: Request) {
  try {
    const verified = await verifyTwilioRequest(request);
    if (!verified) return new Response("Forbidden", { status: 403 });
    await recordCallStatus(verified.params);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("call status webhook failed", { err: err instanceof Error ? err.message : err });
    // 500 lets Twilio's debugger show the failure; nothing is spoken here.
    return new Response("Error", { status: 500 });
  }
}
