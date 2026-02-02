import { describe, it, expect } from "vitest";
import { deriveInviteKey } from "../../src/crypto/hkdf.js";

describe("deriveInviteKey", () => {
  const testPrivateKey = new Uint8Array(32).fill(1);
  const testInboxId = "abc123def456";

  it("should produce a 32-byte key", () => {
    const key = deriveInviteKey(testPrivateKey, testInboxId);
    expect(key.length).toBe(32);
  });

  it("should produce consistent output for same inputs", () => {
    const key1 = deriveInviteKey(testPrivateKey, testInboxId);
    const key2 = deriveInviteKey(testPrivateKey, testInboxId);
    expect(key1).toEqual(key2);
  });

  it("should produce different keys for different inbox IDs", () => {
    const key1 = deriveInviteKey(testPrivateKey, "inbox1");
    const key2 = deriveInviteKey(testPrivateKey, "inbox2");
    expect(key1).not.toEqual(key2);
  });

  it("should produce different keys for different private keys", () => {
    const privateKey1 = new Uint8Array(32).fill(1);
    const privateKey2 = new Uint8Array(32).fill(2);
    const key1 = deriveInviteKey(privateKey1, testInboxId);
    const key2 = deriveInviteKey(privateKey2, testInboxId);
    expect(key1).not.toEqual(key2);
  });
});
