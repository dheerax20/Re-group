import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/slack/crypto";

/**
 * `SlackConnection.botAccessToken` is the first third-party bearer
 * credential this app stores in its own database. These tests exist to
 * catch exactly the failure that would make that a bad idea: a token that
 * decrypts to the wrong thing, or a tampered ciphertext that decrypts to
 * something instead of failing loudly.
 */

const ORIGINAL_KEY = process.env.SLACK_TOKEN_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.SLACK_TOKEN_ENCRYPTION_KEY = "test-encryption-key-do-not-use-in-prod";
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.SLACK_TOKEN_ENCRYPTION_KEY;
  else process.env.SLACK_TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
});

describe("encryptToken / decryptToken", () => {
  it("round-trips a token exactly", () => {
    const token = "FAKE-TOKEN-1234567890-abcdefghijklmnop";
    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it("never stores the plaintext token in the encrypted output", () => {
    const token = "FAKE-TOKEN-super-secret-value";
    expect(encryptToken(token)).not.toContain(token);
  });

  it("produces a different ciphertext for the same token every time", () => {
    // A fresh random IV per call — otherwise identical tokens would produce
    // identical ciphertexts, leaking that two rows share a token.
    const token = "FAKE-TOKEN-same-token";
    expect(encryptToken(token)).not.toBe(encryptToken(token));
  });

  it("rejects a tampered ciphertext instead of returning garbage", () => {
    const encrypted = encryptToken("FAKE-TOKEN-real-token");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const tampered = [iv, authTag, ciphertext.slice(0, -2) + "ff"].join(":");
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("rejects a malformed stored value", () => {
    expect(() => decryptToken("not-the-right-shape")).toThrow();
  });

  it("refuses to encrypt or decrypt with no key configured", () => {
    delete process.env.SLACK_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken("FAKE-TOKEN-token")).toThrow();
  });
});
