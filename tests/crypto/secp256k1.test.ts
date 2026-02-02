import { describe, it, expect } from "vitest";
import {
  signWithRecovery,
  recoverPublicKey,
  getPublicKey,
  hashSha256,
  constantTimeEqual,
  normalizePublicKey,
} from "../../src/crypto/secp256k1.js";

describe("secp256k1", () => {
  // Valid secp256k1 private key (32 bytes, non-zero, less than curve order)
  const testPrivateKey = new Uint8Array([
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c,
    0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
    0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20,
  ]);

  describe("signWithRecovery", () => {
    it("should produce a 65-byte signature", () => {
      const messageHash = hashSha256(new TextEncoder().encode("test message"));
      const signature = signWithRecovery(messageHash, testPrivateKey);
      expect(signature.length).toBe(65);
    });

    it("should have recovery ID in range 0-3", () => {
      const messageHash = hashSha256(new TextEncoder().encode("test message"));
      const signature = signWithRecovery(messageHash, testPrivateKey);
      const recoveryId = signature[64];
      expect(recoveryId).toBeGreaterThanOrEqual(0);
      expect(recoveryId).toBeLessThanOrEqual(3);
    });
  });

  describe("recoverPublicKey", () => {
    it("should recover the correct public key from signature", () => {
      const messageHash = hashSha256(new TextEncoder().encode("test message"));
      const expectedPublicKey = getPublicKey(testPrivateKey);
      const signature = signWithRecovery(messageHash, testPrivateKey);
      const recoveredPublicKey = recoverPublicKey(messageHash, signature);
      expect(recoveredPublicKey).toEqual(expectedPublicKey);
    });

    it("should throw on invalid signature length", () => {
      const messageHash = hashSha256(new TextEncoder().encode("test"));
      const badSignature = new Uint8Array(64);
      expect(() => recoverPublicKey(messageHash, badSignature)).toThrow(
        "Invalid signature length"
      );
    });

    it("should throw on invalid recovery ID", () => {
      const messageHash = hashSha256(new TextEncoder().encode("test"));
      const signature = signWithRecovery(messageHash, testPrivateKey);
      signature[64] = 5; // Invalid recovery ID
      expect(() => recoverPublicKey(messageHash, signature)).toThrow(
        "Invalid recovery ID"
      );
    });
  });

  describe("getPublicKey", () => {
    it("should return 65-byte uncompressed public key", () => {
      const publicKey = getPublicKey(testPrivateKey);
      expect(publicKey.length).toBe(65);
      expect(publicKey[0]).toBe(0x04); // Uncompressed prefix
    });
  });

  describe("constantTimeEqual", () => {
    it("should return true for equal arrays", () => {
      const a = new Uint8Array([1, 2, 3, 4]);
      const b = new Uint8Array([1, 2, 3, 4]);
      expect(constantTimeEqual(a, b)).toBe(true);
    });

    it("should return false for different arrays", () => {
      const a = new Uint8Array([1, 2, 3, 4]);
      const b = new Uint8Array([1, 2, 3, 5]);
      expect(constantTimeEqual(a, b)).toBe(false);
    });

    it("should return false for different length arrays", () => {
      const a = new Uint8Array([1, 2, 3, 4]);
      const b = new Uint8Array([1, 2, 3]);
      expect(constantTimeEqual(a, b)).toBe(false);
    });
  });

  describe("normalizePublicKey", () => {
    it("should pass through 65-byte uncompressed keys unchanged", () => {
      const uncompressed = getPublicKey(testPrivateKey);
      const normalized = normalizePublicKey(uncompressed);
      expect(normalized).toEqual(uncompressed);
    });

    it("should throw on invalid public key length", () => {
      const invalid = new Uint8Array(40);
      expect(() => normalizePublicKey(invalid)).toThrow("Invalid public key length");
    });
  });
});
