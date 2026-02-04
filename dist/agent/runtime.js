import * as fs from "node:fs";
import * as path from "node:path";
import { Agent, createUser, createSigner, getTestUrl, } from "@xmtp/agent-sdk";
import { ConvosMiddleware } from "../middleware/index.js";
import { bytesToHex } from "../utils/hex.js";
const DEFAULT_DATA_DIR = ".convos-agent";
const STATE_FILE = "agent.json";
function ensureDataDir(dataDir) {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}
function loadState(dataDir) {
    const statePath = path.join(dataDir, STATE_FILE);
    if (!fs.existsSync(statePath)) {
        return null;
    }
    const content = fs.readFileSync(statePath, "utf-8");
    return JSON.parse(content);
}
function saveState(dataDir, state) {
    const statePath = path.join(dataDir, STATE_FILE);
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}
export async function startAgent(options = {}) {
    const { dataDir = DEFAULT_DATA_DIR, env = "dev", apiUrl, onMessage, onInvite, onStart, onError, } = options;
    ensureDataDir(dataDir);
    let state = loadState(dataDir);
    let user;
    if (state) {
        // Restore from existing state
        user = createUser(state.privateKey);
    }
    else {
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
    const convos = ConvosMiddleware.create(agent, {
        privateKey: user.key,
        env,
    });
    agent.use(convos.middleware());
    // Handle invite join requests
    convos.on("invite", async (ctx) => {
        if (onInvite) {
            await onInvite(ctx);
        }
        else {
            // Default: auto-accept
            await ctx.accept();
        }
    });
    // Handle messages
    agent.on("message", async (ctx) => {
        if (ctx.message.senderInboxId === agent.client.inboxId)
            return;
        if (onMessage) {
            // Get sender name from conversation metadata profiles
            let senderName = "unknown";
            try {
                const appData = ctx.conversation.appData;
                if (appData) {
                    const metadata = convos.decodeMetadata(appData);
                    const profile = metadata.profiles.find((p) => bytesToHex(p.inboxId) === ctx.message.senderInboxId);
                    if (profile?.name) {
                        senderName = profile.name;
                    }
                }
            }
            catch {
                // Ignore errors decoding metadata
            }
            await onMessage({
                senderInboxId: ctx.message.senderInboxId,
                senderName,
                content: ctx.message.content,
                conversationId: ctx.conversation.id,
                send: async (text) => {
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
                address: agent.address,
                testUrl,
            });
        }
    });
    agent.on("unhandledError", (error) => {
        if (onError) {
            onError(error);
        }
    });
    await agent.start();
    // Helper to set profile on all conversations
    const setProfileOnAllConversations = async (profile) => {
        const conversations = await agent.client.conversations.list();
        await Promise.all(conversations.map(async (conversation) => {
            try {
                const group = convos.group(conversation);
                await group.setConversationProfile({
                    name: profile.name,
                    image: profile.image,
                });
            }
            catch {
                // Ignore errors for individual conversations (e.g., DMs)
            }
        }));
    };
    // Apply stored profile on start if available
    if (state.profile && (state.profile.name || state.profile.image)) {
        await setProfileOnAllConversations(state.profile);
    }
    return {
        agent,
        convos,
        inboxId: agent.client.inboxId,
        address: agent.address,
        testUrl,
        stop: () => agent.stop(),
        sendToConversation: async (conversationId, text) => {
            const conversation = await agent.client.conversations.getConversationById(conversationId);
            if (conversation) {
                await conversation.sendText(text);
            }
            else {
                throw new Error(`Conversation not found: ${conversationId}`);
            }
        },
        broadcast: async (text) => {
            const conversations = await agent.client.conversations.list();
            await Promise.all(conversations.map((conversation) => conversation.sendText(text)));
        },
        listConversations: async () => {
            const conversations = await agent.client.conversations.list();
            return conversations.map((conversation) => conversation.id);
        },
        join: async (inviteUrl) => {
            return convos.join(inviteUrl);
        },
        createGroup: async (groupOptions = {}) => {
            const xmtpGroup = await agent.client.conversations.createGroup([], {
                groupName: groupOptions.name,
                groupDescription: groupOptions.description,
            });
            const group = convos.group(xmtpGroup);
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
        saveProfile: async (profile) => {
            // Update state with new profile
            state.profile = profile;
            saveState(dataDir, state);
            // Apply to all conversations
            await setProfileOnAllConversations(profile);
        },
        getProfile: () => state.profile,
    };
}
//# sourceMappingURL=runtime.js.map