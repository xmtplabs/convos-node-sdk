import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../../src/crypto/chacha20poly1305.js";

describe("ChaCha20-Poly1305", () => {
  const testKey = new Uint8Array(32).fill(0x42);
  const testPlaintext = new TextEncoder().encode("Hello, World!");
  const testAad = new TextEncoder().encode("additional data");

  it("should round-trip encrypt and decrypt", () => {
    const ciphertext = encrypt(testPlaintext, testKey, testAad);
    const decrypted = decrypt(ciphertext, testKey, testAad);
    expect(decrypted).toEqual(testPlaintext);
  });

  it("should produce different ciphertext each time (random nonce)", () => {
    const ciphertext1 = encrypt(testPlaintext, testKey, testAad);
    const ciphertext2 = encrypt(testPlaintext, testKey, testAad);
    expect(ciphertext1).not.toEqual(ciphertext2);
  });

  it("should fail decryption with wrong key", () => {
    const ciphertext = encrypt(testPlaintext, testKey, testAad);
    const wrongKey = new Uint8Array(32).fill(0x43);
    expect(() => decrypt(ciphertext, wrongKey, testAad)).toThrow();
  });

  it("should fail decryption with wrong AAD", () => {
    const ciphertext = encrypt(testPlaintext, testKey, testAad);
    const wrongAad = new TextEncoder().encode("wrong data");
    expect(() => decrypt(ciphertext, testKey, wrongAad)).toThrow();
  });

  it("should fail decryption with tampered ciphertext", () => {
    const ciphertext = encrypt(testPlaintext, testKey, testAad);
    ciphertext[20] ^= 0xff; // Tamper with a byte
    expect(() => decrypt(ciphertext, testKey, testAad)).toThrow();
  });

  it("should throw on ciphertext that is too short", () => {
    const shortCiphertext = new Uint8Array(20);
    expect(() => decrypt(shortCiphertext, testKey, testAad)).toThrow(
      "Ciphertext too short"
    );
  });
});
