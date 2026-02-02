import { describe, it, expect } from "vitest";
import {
  InviteJoinErrorType,
  encodeInviteJoinError,
  decodeInviteJoinError,
  createConversationExpiredError,
  createGenericFailureError,
  getErrorMessage,
  type InviteJoinError,
} from "../../src/content-types/invite-join-error.js";

describe("InviteJoinError", () => {
  describe("encode/decode", () => {
    it("should round-trip encode/decode", () => {
      const error: InviteJoinError = {
        errorType: InviteJoinErrorType.ConversationExpired,
        inviteTag: "abc123test",
        timestamp: new Date("2024-01-15T12:00:00Z"),
      };

      const encoded = encodeInviteJoinError(error);
      const decoded = decodeInviteJoinError(encoded);

      expect(decoded.errorType).toBe(error.errorType);
      expect(decoded.inviteTag).toBe(error.inviteTag);
      expect(decoded.timestamp.getTime()).toBe(error.timestamp.getTime());
    });

    it("should handle all error types", () => {
      const types = [
        InviteJoinErrorType.ConversationExpired,
        InviteJoinErrorType.GenericFailure,
        InviteJoinErrorType.Unknown,
      ];

      for (const errorType of types) {
        const error: InviteJoinError = {
          errorType,
          inviteTag: "test",
          timestamp: new Date(),
        };

        const encoded = encodeInviteJoinError(error);
        const decoded = decodeInviteJoinError(encoded);
        expect(decoded.errorType).toBe(errorType);
      }
    });

    it("should decode unknown error types as Unknown", () => {
      const json = JSON.stringify({
        errorType: "someFutureErrorType",
        inviteTag: "test",
        timestamp: new Date().toISOString(),
      });
      const data = new TextEncoder().encode(json);
      const decoded = decodeInviteJoinError(data);
      expect(decoded.errorType).toBe(InviteJoinErrorType.Unknown);
    });
  });

  describe("factory functions", () => {
    it("should create conversation expired error", () => {
      const error = createConversationExpiredError("tag123");
      expect(error.errorType).toBe(InviteJoinErrorType.ConversationExpired);
      expect(error.inviteTag).toBe("tag123");
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it("should create generic failure error", () => {
      const error = createGenericFailureError("tag456");
      expect(error.errorType).toBe(InviteJoinErrorType.GenericFailure);
      expect(error.inviteTag).toBe("tag456");
      expect(error.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("getErrorMessage", () => {
    it("should return appropriate message for ConversationExpired", () => {
      const error = createConversationExpiredError("test");
      expect(getErrorMessage(error)).toBe("This conversation is no longer available");
    });

    it("should return appropriate message for GenericFailure", () => {
      const error = createGenericFailureError("test");
      expect(getErrorMessage(error)).toBe("Failed to join conversation");
    });

    it("should return generic message for Unknown", () => {
      const error: InviteJoinError = {
        errorType: InviteJoinErrorType.Unknown,
        inviteTag: "test",
        timestamp: new Date(),
      };
      expect(getErrorMessage(error)).toBe("Failed to join conversation");
    });
  });
});
