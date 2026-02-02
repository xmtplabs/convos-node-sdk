import { describe, it, expect } from "vitest";
import {
  encodeInvitePayload,
  decodeInvitePayload,
  encodeSignedInvite,
  decodeSignedInvite,
  type InvitePayload,
  type SignedInvite,
} from "../../src/proto/invite.js";

describe("InvitePayload protobuf", () => {
  it("should round-trip encode/decode with all fields", () => {
    const payload: InvitePayload = {
      conversationToken: new Uint8Array([1, 2, 3, 4, 5]),
      creatorInboxId: new Uint8Array([10, 20, 30, 40]),
      tag: "abc123test",
      name: "Test Conversation",
      description: "A test conversation",
      imageURL: "https://example.com/image.png",
      conversationExpiresAtUnix: BigInt(1700000000),
      expiresAtUnix: BigInt(1700001000),
      expiresAfterUse: true,
    };

    const encoded = encodeInvitePayload(payload);
    const decoded = decodeInvitePayload(encoded);

    expect(decoded.conversationToken).toEqual(payload.conversationToken);
    expect(decoded.creatorInboxId).toEqual(payload.creatorInboxId);
    expect(decoded.tag).toBe(payload.tag);
    expect(decoded.name).toBe(payload.name);
    expect(decoded.description).toBe(payload.description);
    expect(decoded.imageURL).toBe(payload.imageURL);
    expect(decoded.conversationExpiresAtUnix).toBe(payload.conversationExpiresAtUnix);
    expect(decoded.expiresAtUnix).toBe(payload.expiresAtUnix);
    expect(decoded.expiresAfterUse).toBe(payload.expiresAfterUse);
  });

  it("should handle minimal payload (required fields only)", () => {
    const payload: InvitePayload = {
      conversationToken: new Uint8Array([1, 2, 3]),
      creatorInboxId: new Uint8Array([4, 5, 6]),
      tag: "minimal",
      expiresAfterUse: false,
    };

    const encoded = encodeInvitePayload(payload);
    const decoded = decodeInvitePayload(encoded);

    expect(decoded.conversationToken).toEqual(payload.conversationToken);
    expect(decoded.creatorInboxId).toEqual(payload.creatorInboxId);
    expect(decoded.tag).toBe(payload.tag);
    expect(decoded.name).toBeUndefined();
    expect(decoded.description).toBeUndefined();
    expect(decoded.imageURL).toBeUndefined();
    expect(decoded.conversationExpiresAtUnix).toBeUndefined();
    expect(decoded.expiresAtUnix).toBeUndefined();
    expect(decoded.expiresAfterUse).toBe(false);
  });
});

describe("SignedInvite protobuf", () => {
  it("should round-trip encode/decode", () => {
    const invite: SignedInvite = {
      payload: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
      signature: new Uint8Array(65).fill(0xab),
    };

    const encoded = encodeSignedInvite(invite);
    const decoded = decodeSignedInvite(encoded);

    expect(decoded.payload).toEqual(invite.payload);
    expect(decoded.signature).toEqual(invite.signature);
  });
});
