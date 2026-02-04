import { Agent, type XmtpEnv } from "@xmtp/agent-sdk";
import { ConvosMiddleware, type InviteContext, type JoinResult } from "../middleware/index.js";
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
    onStart?: (info: {
        inboxId: string;
        address: string;
        testUrl: string;
    }) => void;
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
    createGroup: (options?: {
        name?: string;
        description?: string;
    }) => Promise<{
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
export declare function startAgent(options?: AgentRuntimeOptions): Promise<AgentRuntime>;
//# sourceMappingURL=runtime.d.ts.map