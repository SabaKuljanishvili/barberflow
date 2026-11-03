import { describe, expect, it } from "vitest";
import { buildContactEmail, contactSchema } from "./contact";

const ok = { name: "Nino", email: "nino@example.com", salon: "", message: "Hello, how much does it cost?", website: "" };

describe("contactSchema", () => {
  it("accepts a normal message, salon optional", () => {
    const r = contactSchema.safeParse(ok);
    expect(r.success).toBe(true);
    expect(r.data?.salon).toBeUndefined();
  });
  it("flags the honeypot", () => {
    expect(contactSchema.safeParse({ ...ok, website: "http://spam" }).data?.bot).toBe(true);
    expect(contactSchema.safeParse(ok).data?.bot).toBe(false);
  });
  it("requires email and a message of at least 10 characters", () => {
    expect(contactSchema.safeParse({ ...ok, email: "nope" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...ok, message: "hi" }).success).toBe(false);
  });
});

describe("buildContactEmail", () => {
  it("puts the sender in reply_to and keeps newlines out of the subject", () => {
    const mail = buildContactEmail({ name: "Eve\r\nBcc: x@y.z", email: "eve@example.com", salon: "Cut\nShop", message: "Line 1\nLine 2", bot: false });
    expect(mail.reply_to).toBe("eve@example.com");
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.text).toContain("Line 1\nLine 2");
  });
});
