import { describe, it, expect } from "vitest";
import {
  encodeToSlug,
  decodeFromSlug,
  generateInviteURL,
  parseInviteCode,
} from "../../src/invite/encoding.js";

describe("encoding", () => {
  describe("encodeToSlug / decodeFromSlug", () => {
    it("should round-trip small data", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const slug = encodeToSlug(data);
      const decoded = decodeFromSlug(slug);
      expect(decoded).toEqual(data);
    });

    it("should round-trip large data (triggers compression)", () => {
      const data = new Uint8Array(500).fill(0x42);
      const slug = encodeToSlug(data);
      const decoded = decodeFromSlug(slug);
      expect(decoded).toEqual(data);
    });

    it("should handle iMessage separators", () => {
      // Create random data that encodes to > 300 chars (won't compress well)
      const data = new Uint8Array(300);
      for (let i = 0; i < data.length; i++) {
        data[i] = (i * 17 + 13) % 256; // Pseudo-random pattern
      }
      const slug = encodeToSlug(data);

      // Should contain separators for slugs > 300 chars
      expect(slug.length).toBeGreaterThan(300);
      expect(slug).toContain("*");

      // Should still decode correctly
      const decoded = decodeFromSlug(slug);
      expect(decoded).toEqual(data);
    });
  });

  describe("generateInviteURL", () => {
    it("should generate URL with default base (v2 format)", () => {
      const slug = "abc123";
      const url = generateInviteURL(slug);
      expect(url).toBe("https://popup.convos.org/v2?i=abc123");
    });

    it("should generate URL with custom base", () => {
      const slug = "xyz789";
      const url = generateInviteURL(slug, "https://custom.com/join");
      expect(url).toBe("https://custom.com/join?i=xyz789");
    });

    it("should handle slugs with separators in URL", () => {
      const slug = "abc*123*xyz";
      const url = generateInviteURL(slug);
      // Note: * is a valid URL character and doesn't need encoding
      expect(url).toContain("i=abc");
      expect(url).toContain("xyz");
    });
  });

  describe("parseInviteCode", () => {
    it("should return raw slug as-is", () => {
      const slug = "abc123xyz";
      expect(parseInviteCode(slug)).toBe(slug);
    });

    it("should extract code from v2 URL format (?i=)", () => {
      const url = "https://popup.convos.org/v2?i=abc123";
      expect(parseInviteCode(url)).toBe("abc123");
    });

    it("should extract code from legacy URL format (?code=)", () => {
      const url = "https://popup.convos.org/invite?code=abc123";
      expect(parseInviteCode(url)).toBe("abc123");
    });

    it("should extract code from convos:// app scheme", () => {
      const url = "convos://join/abc123";
      expect(parseInviteCode(url)).toBe("abc123");
    });

    it("should extract code from path segment", () => {
      const url = "https://popup.convos.org/v2/abc123";
      expect(parseInviteCode(url)).toBe("abc123");
    });

    it("should trim whitespace", () => {
      expect(parseInviteCode("  abc123  ")).toBe("abc123");
    });

    it("should handle URL-encoded i parameter", () => {
      const url = "https://popup.convos.org/v2?i=abc%2A123";
      expect(parseInviteCode(url)).toBe("abc*123");
    });
  });
});
