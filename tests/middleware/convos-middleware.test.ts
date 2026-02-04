import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ConvosMiddleware,
  type XMTPAgent,
  type XMTPConversation,
  type XMTPMessageContext,
  type InviteContext,
} from "../../src/middleware/convos-middleware.js";
import type { XMTPGroupWithAppData } from "../../src/middleware/convos-group.js";

describe("ConvosMiddleware", () => {
  const testPrivateKeyHex = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
  const testInboxId = "abc123def456789012345678901234567890abcdef12345678901234567890ab";
  const joinerInboxId = "joiner123456789012345678901234567890abcdef12345678901234567890cd";

  let originalEnv: string | undefined;
  let mockConversation: XMTPConversation;
  let mockBlockFn: ReturnType<typeof vi.fn>;
  let mockRefreshConsentFn: ReturnType<typeof vi.fn>;

  function createMockConversation(id: string): XMTPConversation {
    return {
      id,
      send: vi.fn().mockResolvedValue(undefined),
      addMembers: vi.fn().mockResolvedValue(undefined),
    };
  }

  function createMockAgent(conversationId?: string): XMTPAgent {
    mockConversation = createMockConversation(conversationId ?? "test-conversation-id");
    mockBlockFn = vi.fn().mockResolvedValue(undefined);
    mockRefreshConsentFn = vi.fn().mockResolvedValue(undefined);

    return {
      client: {
        inboxId: testInboxId,
        conversations: {
          getConversationById: vi.fn().mockImplementation(async (id: string) => {
            if (id === mockConversation.id) {
              return mockConversation;
            }
            return null;
          }),
        },
        contacts: {
          refreshConsentList: mockRefreshConsentFn,
          block: mockBlockFn,
        },
      },
    };
  }

  function createMockDmContext(text: string, senderInboxId: string): XMTPMessageContext {
    return {
      message: {
        content: text,
        senderInboxId,
      },
      conversation: createMockConversation("dm-conversation"),
    };
  }

  beforeEach(() => {
    originalEnv = process.env.XMTP_WALLET_KEY;
    process.env.XMTP_WALLET_KEY = testPrivateKeyHex;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.XMTP_WALLET_KEY;
    } else {
      process.env.XMTP_WALLET_KEY = originalEnv;
    }
  });

  describe("create", () => {
    it("should create middleware instance", () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);

      expect(convos).toBeInstanceOf(ConvosMiddleware);
    });

    it("should get inboxId from agent", () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);

      expect(convos.getInboxId()).toBe(testInboxId);
    });

    it("should return middleware function", () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);
      const middleware = convos.middleware();

      expect(typeof middleware).toBe("function");
    });
  });

  describe("createInvite", () => {
    it("should create invite with slug and URL from conversation object", () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);

      const { metadata } = convos.createInitialMetadata();
      const invite = convos.createInvite(
        { id: "test-conversation-id" },
        {
          inviteTag: metadata.tag,
          name: "Test Group",
        }
      );

      expect(invite.slug).toBeDefined();
      expect(invite.url).toContain("dev.convos.org/v2");
      expect(invite.qrData).toBe(invite.url);
    });

    it("should create invite from conversation ID string", () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);

      const { metadata } = convos.createInitialMetadata();
      const invite = convos.createInvite("test-conversation-id", {
        inviteTag: metadata.tag,
      });

      expect(invite.slug).toBeDefined();
      expect(invite.url).toContain("dev.convos.org/v2");
    });
  });

  describe("invite event handling", () => {
    it("should emit invite event for valid join request", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);
      const middleware = convos.middleware();

      // Create invite
      const { metadata } = convos.createInitialMetadata();
      const invite = convos.createInvite(mockConversation, {
        inviteTag: metadata.tag,
      });

      // Register invite handler
      const inviteHandler = vi.fn();
      convos.on("invite", inviteHandler);

      // Simulate DM with invite slug through middleware
      const dmCtx = createMockDmContext(invite.slug, joinerInboxId);
      const next = vi.fn();
      await middleware(dmCtx, next);

      // Verify invite handler was called
      expect(inviteHandler).toHaveBeenCalledTimes(1);
      const ctx: InviteContext = inviteHandler.mock.calls[0][0];
      expect(ctx.joinerInboxId).toBe(joinerInboxId);
      expect(ctx.conversationId).toBe("test-conversation-id");
      expect(ctx.inviteTag).toBe(metadata.tag);

      // next() should NOT have been called (message was handled)
      expect(next).not.toHaveBeenCalled();
    });

    it("should allow accepting invite", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);
      const middleware = convos.middleware();

      const { metadata } = convos.createInitialMetadata();
      const invite = convos.createInvite(mockConversation, {
        inviteTag: metadata.tag,
      });

      convos.on("invite", async (ctx) => {
        await ctx.accept();
      });

      const dmCtx = createMockDmContext(invite.slug, joinerInboxId);
      await middleware(dmCtx, vi.fn());

      expect(mockConversation.addMembers).toHaveBeenCalledWith([joinerInboxId]);
    });

    it("should allow rejecting invite", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);
      const middleware = convos.middleware();

      const { metadata } = convos.createInitialMetadata();
      const invite = convos.createInvite(mockConversation, {
        inviteTag: metadata.tag,
      });

      convos.on("invite", async (ctx) => {
        await ctx.reject();
      });

      const dmCtx = createMockDmContext(invite.slug, joinerInboxId);
      await middleware(dmCtx, vi.fn());

      // Error should be sent back
      expect(dmCtx.conversation.send).toHaveBeenCalled();
    });

    it("should pass through non-invite messages", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);
      const middleware = convos.middleware();

      const inviteHandler = vi.fn();
      convos.on("invite", inviteHandler);

      // Regular message
      const dmCtx = createMockDmContext("Hello, how are you?", joinerInboxId);
      const next = vi.fn();
      await middleware(dmCtx, next);

      expect(inviteHandler).not.toHaveBeenCalled();
      // next() should have been called (pass through)
      expect(next).toHaveBeenCalled();
    });

    it("should pass through messages from self", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);
      const middleware = convos.middleware();

      const { metadata } = convos.createInitialMetadata();
      const invite = convos.createInvite(mockConversation, {
        inviteTag: metadata.tag,
      });

      const inviteHandler = vi.fn();
      convos.on("invite", inviteHandler);

      // Message from self
      const dmCtx = createMockDmContext(invite.slug, testInboxId);
      const next = vi.fn();
      await middleware(dmCtx, next);

      expect(inviteHandler).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it("should block sender for forged invites", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);
      const middleware = convos.middleware();

      // Create forged invite with different private key (attacker uses wrong key)
      const forgedKey = new Uint8Array(32).fill(0x99);
      const forgedAgent: XMTPAgent = {
        client: {
          inboxId: testInboxId,
          conversations: { getConversationById: vi.fn() },
          contacts: { refreshConsentList: vi.fn(), block: vi.fn() },
        },
      };
      const forgedConvos = ConvosMiddleware.create(forgedAgent, { privateKey: forgedKey });

      const { metadata } = forgedConvos.createInitialMetadata();
      const forgedInvite = forgedConvos.createInvite("test-id", {
        inviteTag: metadata.tag,
      });

      const inviteHandler = vi.fn();
      convos.on("invite", inviteHandler);

      const dmCtx = createMockDmContext(forgedInvite.slug, joinerInboxId);
      const next = vi.fn();
      await middleware(dmCtx, next);

      expect(inviteHandler).not.toHaveBeenCalled();
      expect(mockBlockFn).toHaveBeenCalledWith([joinerInboxId]);
      expect(next).not.toHaveBeenCalled();
    });

    it("should send error for expired invites", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);
      const middleware = convos.middleware();

      const { metadata } = convos.createInitialMetadata();
      const invite = convos.createInvite(mockConversation, {
        inviteTag: metadata.tag,
        expiresAt: new Date(Date.now() - 1000), // Already expired
      });

      const inviteHandler = vi.fn();
      convos.on("invite", inviteHandler);

      const dmCtx = createMockDmContext(invite.slug, joinerInboxId);
      const next = vi.fn();
      await middleware(dmCtx, next);

      expect(inviteHandler).not.toHaveBeenCalled();
      expect(dmCtx.conversation.send).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it("should send error when conversation not found", async () => {
      const agent = createMockAgent("different-conversation-id");
      const convos = ConvosMiddleware.create(agent);
      const middleware = convos.middleware();

      const { metadata } = convos.createInitialMetadata();
      // Create invite for a conversation that doesn't exist
      const invite = convos.createInvite("non-existent-conversation", {
        inviteTag: metadata.tag,
      });

      const inviteHandler = vi.fn();
      convos.on("invite", inviteHandler);

      const dmCtx = createMockDmContext(invite.slug, joinerInboxId);
      const next = vi.fn();
      await middleware(dmCtx, next);

      expect(inviteHandler).not.toHaveBeenCalled();
      expect(dmCtx.conversation.send).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it("should support multiple invite handlers", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);
      const middleware = convos.middleware();

      const { metadata } = convos.createInitialMetadata();
      const invite = convos.createInvite(mockConversation, {
        inviteTag: metadata.tag,
      });

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      convos.on("invite", handler1);
      convos.on("invite", handler2);

      const dmCtx = createMockDmContext(invite.slug, joinerInboxId);
      await middleware(dmCtx, vi.fn());

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it("should allow removing handlers with off()", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);
      const middleware = convos.middleware();

      const { metadata } = convos.createInitialMetadata();
      const invite = convos.createInvite(mockConversation, {
        inviteTag: metadata.tag,
      });

      const handler = vi.fn();
      convos.on("invite", handler);
      convos.off("invite", handler);

      const dmCtx = createMockDmContext(invite.slug, joinerInboxId);
      await middleware(dmCtx, vi.fn());

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("metadata handling", () => {
    it("should create and decode metadata", () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);

      const { metadata, encodedMetadata } = convos.createInitialMetadata();
      const decoded = convos.decodeMetadata(encodedMetadata);

      expect(decoded.tag).toBe(metadata.tag);
    });

    it("should rotate invite tag", () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);

      const { metadata: original } = convos.createInitialMetadata();
      const { metadata: rotated, newTag } = convos.rotateInviteTag(original);

      expect(newTag).not.toBe(original.tag);
      expect(rotated.tag).toBe(newTag);
    });

    it("should extract invite tag from encoded metadata", () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);

      const { metadata, encodedMetadata } = convos.createInitialMetadata();
      const tag = convos.getInviteTag(encodedMetadata);

      expect(tag).toBe(metadata.tag);
    });
  });

  describe("group() and ConvosGroup", () => {
    function createMockGroupWithAppData(
      id: string,
      appData = ""
    ): XMTPGroupWithAppData {
      return {
        id,
        appData,
        updateAppData: vi.fn().mockResolvedValue(undefined),
        send: vi.fn().mockResolvedValue(undefined),
        addMembers: vi.fn().mockResolvedValue(undefined),
      };
    }

    it("should wrap a group with convos.group()", () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);

      const xmtpGroup = createMockGroupWithAppData("test-group-id");
      const group = convos.group(xmtpGroup);

      expect(group.id).toBe("test-group-id");
      expect(typeof group.createInvite).toBe("function");
    });

    it("should expose inner group and id", () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);

      const xmtpGroup = createMockGroupWithAppData("test-group-id", "existing-data");
      const group = convos.group(xmtpGroup);

      expect(group.id).toBe(xmtpGroup.id);
      expect(group.inner).toBe(xmtpGroup);
      expect(group.inner.appData).toBe(xmtpGroup.appData);
    });

    it("should allow accessing inner group methods", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);

      const xmtpGroup = createMockGroupWithAppData("test-group-id");
      const group = convos.group(xmtpGroup);

      await group.inner.send("hello");
      expect(xmtpGroup.send).toHaveBeenCalledWith("hello");

      await group.inner.addMembers(["inbox1"]);
      expect(xmtpGroup.addMembers).toHaveBeenCalledWith(["inbox1"]);
    });

    it("should create invite and auto-create metadata when none exists", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);

      const xmtpGroup = createMockGroupWithAppData("test-group-id", "");
      const group = convos.group(xmtpGroup);

      const invite = await group.createInvite({ name: "My Chat" });

      expect(invite.slug).toBeDefined();
      expect(invite.url).toContain("dev.convos.org/v2");
      expect(xmtpGroup.updateAppData).toHaveBeenCalled();
    });

    it("should create invite using existing metadata", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);

      // Create metadata first
      const { encodedMetadata } = convos.createInitialMetadata();

      // Create group with existing metadata
      const xmtpGroup = createMockGroupWithAppData("test-group-id", encodedMetadata);
      const group = convos.group(xmtpGroup);

      const invite = await group.createInvite({ name: "My Chat" });

      expect(invite.slug).toBeDefined();
      expect(invite.url).toContain("dev.convos.org/v2");
      // Should NOT have called updateAppData since metadata already exists
      expect(xmtpGroup.updateAppData).not.toHaveBeenCalled();
    });

    it("should create new metadata if existing metadata is corrupt", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);

      // Group with corrupt/invalid metadata
      const xmtpGroup = createMockGroupWithAppData("test-group-id", "invalid-garbage-data");
      const group = convos.group(xmtpGroup);

      const invite = await group.createInvite({ name: "My Chat" });

      expect(invite.slug).toBeDefined();
      expect(xmtpGroup.updateAppData).toHaveBeenCalled();
    });

    it("should pass options to createInvite", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);

      const xmtpGroup = createMockGroupWithAppData("test-group-id");
      const group = convos.group(xmtpGroup);

      const invite = await group.createInvite({
        name: "Test Group",
        description: "A test group",
        imageURL: "https://example.com/image.png",
      });

      expect(invite.slug).toBeDefined();
      expect(invite.url).toBeDefined();
    });

    it("should work without options", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);

      const xmtpGroup = createMockGroupWithAppData("test-group-id");
      const group = convos.group(xmtpGroup);

      const invite = await group.createInvite();

      expect(invite.slug).toBeDefined();
    });

    describe("setConversationProfile", () => {
      it("should set profile on group with no existing metadata", async () => {
        const agent = createMockAgent();
        const convos = ConvosMiddleware.create(agent);

        const xmtpGroup = createMockGroupWithAppData("test-group-id", "");
        const group = convos.group(xmtpGroup);

        await group.setConversationProfile({
          name: "Test Bot",
          image: "https://example.com/avatar.png",
        });

        expect(xmtpGroup.updateAppData).toHaveBeenCalled();

        // Verify the profile was stored correctly
        const savedAppData = (xmtpGroup.updateAppData as ReturnType<typeof vi.fn>).mock.calls[0][0];
        const metadata = convos.decodeMetadata(savedAppData);
        expect(metadata.profiles).toHaveLength(1);
        expect(metadata.profiles[0].name).toBe("Test Bot");
        expect(metadata.profiles[0].image).toBe("https://example.com/avatar.png");
      });

      it("should set profile on group with existing metadata", async () => {
        const agent = createMockAgent();
        const convos = ConvosMiddleware.create(agent);

        // Create metadata first
        const { encodedMetadata } = convos.createInitialMetadata();

        const xmtpGroup = createMockGroupWithAppData("test-group-id", encodedMetadata);
        const group = convos.group(xmtpGroup);

        await group.setConversationProfile({
          name: "Test Bot",
        });

        expect(xmtpGroup.updateAppData).toHaveBeenCalled();

        const savedAppData = (xmtpGroup.updateAppData as ReturnType<typeof vi.fn>).mock.calls[0][0];
        const metadata = convos.decodeMetadata(savedAppData);
        expect(metadata.profiles).toHaveLength(1);
        expect(metadata.profiles[0].name).toBe("Test Bot");
      });

      it("should update existing profile (upsert behavior)", async () => {
        const agent = createMockAgent();
        const convos = ConvosMiddleware.create(agent);

        const xmtpGroup = createMockGroupWithAppData("test-group-id", "");
        const group = convos.group(xmtpGroup);

        // Set initial profile
        await group.setConversationProfile({
          name: "Original Name",
          image: "https://example.com/old.png",
        });

        // Update the mock's appData to reflect the saved state
        const firstSavedAppData = (xmtpGroup.updateAppData as ReturnType<typeof vi.fn>).mock.calls[0][0];
        xmtpGroup.appData = firstSavedAppData;

        // Update profile
        await group.setConversationProfile({
          name: "New Name",
          image: "https://example.com/new.png",
        });

        const savedAppData = (xmtpGroup.updateAppData as ReturnType<typeof vi.fn>).mock.calls[1][0];
        const metadata = convos.decodeMetadata(savedAppData);

        // Should still have only 1 profile (updated, not added)
        expect(metadata.profiles).toHaveLength(1);
        expect(metadata.profiles[0].name).toBe("New Name");
        expect(metadata.profiles[0].image).toBe("https://example.com/new.png");
      });

      it("should work with name only", async () => {
        const agent = createMockAgent();
        const convos = ConvosMiddleware.create(agent);

        const xmtpGroup = createMockGroupWithAppData("test-group-id", "");
        const group = convos.group(xmtpGroup);

        await group.setConversationProfile({
          name: "Bot Name",
        });

        const savedAppData = (xmtpGroup.updateAppData as ReturnType<typeof vi.fn>).mock.calls[0][0];
        const metadata = convos.decodeMetadata(savedAppData);
        expect(metadata.profiles[0].name).toBe("Bot Name");
        // Protobuf returns empty string for unset optional strings
        expect(metadata.profiles[0].image).toBeFalsy();
      });

      it("should work with image only", async () => {
        const agent = createMockAgent();
        const convos = ConvosMiddleware.create(agent);

        const xmtpGroup = createMockGroupWithAppData("test-group-id", "");
        const group = convos.group(xmtpGroup);

        await group.setConversationProfile({
          image: "https://example.com/avatar.png",
        });

        const savedAppData = (xmtpGroup.updateAppData as ReturnType<typeof vi.fn>).mock.calls[0][0];
        const metadata = convos.decodeMetadata(savedAppData);
        // Protobuf returns empty string for unset optional strings
        expect(metadata.profiles[0].name).toBeFalsy();
        expect(metadata.profiles[0].image).toBe("https://example.com/avatar.png");
      });

      it("should reinitialize corrupt metadata when setting profile", async () => {
        const agent = createMockAgent();
        const convos = ConvosMiddleware.create(agent);

        const xmtpGroup = createMockGroupWithAppData("test-group-id", "invalid-garbage-data");
        const group = convos.group(xmtpGroup);

        await group.setConversationProfile({
          name: "Test Bot",
        });

        expect(xmtpGroup.updateAppData).toHaveBeenCalled();

        const savedAppData = (xmtpGroup.updateAppData as ReturnType<typeof vi.fn>).mock.calls[0][0];
        const metadata = convos.decodeMetadata(savedAppData);
        expect(metadata.tag).toBeDefined(); // Should have a valid tag
        expect(metadata.profiles).toHaveLength(1);
        expect(metadata.profiles[0].name).toBe("Test Bot");
      });
    });

  });
});
