import { randomBytes } from "@noble/ciphers/webcrypto";
const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
/**
 * Generates a cryptographically secure random alphanumeric string.
 */
export function generateSecureRandomString(length) {
    const bytes = randomBytes(length);
    let result = "";
    for (let i = 0; i < length; i++) {
        result += ALPHANUMERIC[bytes[i] % ALPHANUMERIC.length];
    }
    return result;
}
/**
 * Generates a random invite tag (10 alphanumeric characters).
 */
export function generateInviteTag() {
    return generateSecureRandomString(10);
}
//# sourceMappingURL=random.js.map