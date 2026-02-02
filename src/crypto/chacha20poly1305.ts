import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { randomBytes } from "@noble/ciphers/webcrypto";

const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Encrypts plaintext using ChaCha20-Poly1305 with AAD.
 * Returns: nonce (12 bytes) + ciphertext + auth tag (16 bytes)
 */
export function encrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  aad: Uint8Array
): Uint8Array {
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = chacha20poly1305(key, nonce, aad);
  const ciphertext = cipher.encrypt(plaintext);

  // Combine: nonce + ciphertext (includes auth tag)
  const result = new Uint8Array(NONCE_LENGTH + ciphertext.length);
  result.set(nonce, 0);
  result.set(ciphertext, NONCE_LENGTH);
  return result;
}

/**
 * Decrypts ciphertext using ChaCha20-Poly1305 with AAD.
 * Input format: nonce (12 bytes) + ciphertext + auth tag (16 bytes)
 * Throws if authentication fails.
 */
export function decrypt(
  combined: Uint8Array,
  key: Uint8Array,
  aad: Uint8Array
): Uint8Array {
  if (combined.length < NONCE_LENGTH + TAG_LENGTH) {
    throw new Error("Ciphertext too short");
  }

  const nonce = combined.slice(0, NONCE_LENGTH);
  const ciphertext = combined.slice(NONCE_LENGTH);

  const cipher = chacha20poly1305(key, nonce, aad);
  return cipher.decrypt(ciphertext);
}
