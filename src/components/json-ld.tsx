import { headers } from "next/headers";

/** Structured data. `<` is escaped so content can never close the script tag. */
export async function JsonLd({ data }: { data: Record<string, unknown> }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      // eslint-disable-next-line react/no-danger -- JSON is serialized and "<" escaped above
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
