import { describe, expect, it } from "vitest";
import { decodeState, encodeState, type WebState } from "./web-state";

const secret = "test-secret";
const state: WebState = {
  salon: "salon-1",
  sid: "web-1",
  client: "client-1",
  l: "ka",
  step: "slot",
  s: "service-1",
  o: [["barber-1", 29_000_000]],
  a: 0,
  q: 0,
  exp: 2_000,
};

describe("web voice state token", () => {
  it("round-trips", () => {
    expect(decodeState(encodeState(state, secret), secret, 1_000)).toEqual(state);
  });

  it("rejects a changed payload, a wrong secret and junk", () => {
    const token = encodeState(state, secret);
    const [, sig] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ ...state, salon: "other" })).toString("base64url")}.${sig}`;
    expect(decodeState(forged, secret, 1_000)).toBeNull();
    expect(decodeState(token, "other-secret", 1_000)).toBeNull();
    expect(decodeState("abc", secret, 1_000)).toBeNull();
    expect(decodeState(`${token}.x`, secret, 1_000)).toBeNull();
  });

  it("expires", () => {
    expect(decodeState(encodeState(state, secret), secret, 3_000)).toBeNull();
  });

  it("rejects an unknown step or locale even when signed", () => {
    expect(decodeState(encodeState({ ...state, step: "pay" as never }, secret), secret, 1_000)).toBeNull();
    expect(decodeState(encodeState({ ...state, l: "fr" as never }, secret), secret, 1_000)).toBeNull();
  });
});
