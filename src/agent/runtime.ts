import * as fs from "node:fs";
import * as path from "node:path";
import {
  Agent,
  createUser,
  createSigner,
  getTestUrl,
  type XmtpEnv,
} from "@xmtp/agent-sdk";
import { ConvosMiddleware, type InviteContext, type JoinResult } from "../middleware/index.js";
import { bytesToHex } from "../utils/hex.js";

const DEFAULT_DATA_DIR = ".convos-agent";
const STATE_FILE = "agent.json";

export interface AgentProfile {
  name?: string;
  image?: string;
}

export interface AgentState {
  privateKey: string;
  address: string;
  createdAt: string;
  profile?: AgentProfile;
}

export interface MessageContext {
  senderInboxId: string;
  senderName: string;
  content: unknown;
  conversationId: string;
  send: (text: string) => Promise<void>;
}

export interface AgentRuntimeOptions {
  dataDir?: string;
  env?: XmtpEnv;
  /** API URL for local XMTP environment */
  apiUrl?: string;
  onMessage?: (ctx: MessageContext) => void | Promise<void>;
  onInvite?: (ctx: InviteContext) => void | Promise<void>;
  onStart?: (info: { inboxId: string; address: string; testUrl: string }) => void;
  onError?: (error: Error) => void;
}

export interface AgentRuntime {
  agent: Agent;
  convos: ConvosMiddleware;
  inboxId: string;
  address: string;
  testUrl: string;
  stop: () => Promise<void>;
  sendToConversation: (conversationId: string, text: string) => Promise<void>;
  broadcast: (text: string) => Promise<void>;
  listConversations: () => Promise<string[]>;
  join: (inviteUrl: string) => Promise<JoinResult>;
  createGroup: (options?: { name?: string; description?: string }) => Promise<{
    conversationId: string;
    inviteUrl: string;
  }>;
  /** Sets profile on all conversations in the list */
  setProfileOnAllConversations: (profile: AgentProfile) => Promise<void>;
  /** Saves profile to data JSON and applies to all conversations */
  saveProfile: (profile: AgentProfile) => Promise<void>;
  /** Gets the current stored profile */
  getProfile: () => AgentProfile | undefined;
}

function ensureDataDir(dataDir: string): void {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function loadState(dataDir: string): AgentState | null {
  const statePath = path.join(dataDir, STATE_FILE);
  if (!fs.existsSync(statePath)) {
    return null;
  }
  const content = fs.readFileSync(statePath, "utf-8");
  return JSON.parse(content) as AgentState;
}

function saveState(dataDir: string, state: AgentState): void {
  const statePath = path.join(dataDir, STATE_FILE);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

export async function startAgent(
  options: AgentRuntimeOptions = {}
): Promise<AgentRuntime> {
  const {
    dataDir = DEFAULT_DATA_DIR,
    env = "dev",
    apiUrl,
    onMessage,
    onInvite,
    onStart,
    onError,
  } = options;

  ensureDataDir(dataDir);

  let state = loadState(dataDir);
  let user;

  if (state) {
    // Restore from existing state
    user = createUser(state.privateKey as `0x${string}`);
  } else {
    // Create new user and persist
    user = createUser();
    state = {
      privateKey: user.key,
      address: user.account.address,
      createdAt: new Date().toISOString(),
    };
    saveState(dataDir, state);
  }

  const signer = createSigner(user);
  const dbPath = path.join(dataDir, `xmtp-${env}.db`);

  const agent = await Agent.create(signer, { env, dbPath, apiUrl });

  // Initialize Convos middleware
  // user.key is a hex string, cast to the expected type
  const convos = ConvosMiddleware.create(agent as any, {
    privateKey: user.key as unknown as `0x${string}`,
    env,
  });

  agent.use(convos.middleware() as any);

  // Handle invite join requests
  convos.on("invite", async (ctx) => {
    if (onInvite) {
      await onInvite(ctx);
    } else {
      // Default: auto-accept
      await ctx.accept();
    }
  });

  // Handle messages
  agent.on("message", async (ctx) => {
    if (ctx.message.senderInboxId === agent.client.inboxId) return;

    if (onMessage) {
      // Get sender name from conversation metadata profiles
      let senderName = "unknown";
      try {
        const appData = (ctx.conversation as any).appData;
        if (appData) {
          const metadata = convos.decodeMetadata(appData);
          const profile = metadata.profiles.find(
            (p) => bytesToHex(p.inboxId) === ctx.message.senderInboxId
          );
          if (profile?.name) {
            senderName = profile.name;
          }
        }
      } catch {
        // Ignore errors decoding metadata
      }

      await onMessage({
        senderInboxId: ctx.message.senderInboxId,
        senderName,
        content: ctx.message.content,
        conversationId: ctx.conversation.id,
        send: async (text: string) => {
          await ctx.conversation.sendText(text);
        },
      });
    }
  });

  let testUrl = "";

  agent.on("start", (ctx) => {
    testUrl = getTestUrl(ctx.client);
    if (onStart) {
      onStart({
        inboxId: ctx.client.inboxId,
        address: agent.address!,
        testUrl,
      });
    }
  });

  agent.on("unhandledError", (error) => {
    if (onError) {
      onError(error as Error);
    }
  });

  await agent.start();

  // Helper to set profile on all conversations
  const setProfileOnAllConversations = async (profile: AgentProfile): Promise<void> => {
    const conversations = await agent.client.conversations.list();
    await Promise.all(
      conversations.map(async (conversation) => {
        try {
          const group = convos.group(conversation as any);
          await group.setConversationProfile({
            name: profile.name,
            image: profile.image,
          });
        } catch {
          // Ignore errors for individual conversations (e.g., DMs)
        }
      })
    );
  };

  // Apply stored profile on start if available
  if (state.profile && (state.profile.name || state.profile.image)) {
    await setProfileOnAllConversations(state.profile);
  }

  return {
    agent,
    convos,
    inboxId: agent.client.inboxId,
    address: agent.address!,
    testUrl,
    stop: () => agent.stop(),
    sendToConversation: async (conversationId: string, text: string) => {
      const conversation =
        await agent.client.conversations.getConversationById(conversationId);
      if (conversation) {
        await conversation.sendText(text);
      } else {
        throw new Error(`Conversation not found: ${conversationId}`);
      }
    },
    broadcast: async (text: string) => {
      const conversations = await agent.client.conversations.list();
      await Promise.all(
        conversations.map((conversation) => conversation.sendText(text))
      );
    },
    listConversations: async () => {
      const conversations = await agent.client.conversations.list();
      return conversations.map((conversation) => conversation.id);
    },
    join: async (inviteUrl: string) => {
      return convos.join(inviteUrl);
    },
    createGroup: async (groupOptions = {}) => {
      const xmtpGroup = await agent.client.conversations.createGroup([], {
        groupName: groupOptions.name,
        groupDescription: groupOptions.description,
      });
      const group = convos.group(xmtpGroup as any);
      const invite = await group.createInvite({
        name: groupOptions.name,
        description: groupOptions.description,
      });
      return {
        conversationId: group.id,
        inviteUrl: invite.url,
      };
    },
    setProfileOnAllConversations,
    saveProfile: async (profile: AgentProfile) => {
      // Update state with new profile
      state.profile = profile;
      saveState(dataDir, state);
      // Apply to all conversations
      await setProfileOnAllConversations(profile);
    },
    getProfile: () => state.profile,
  };
}
