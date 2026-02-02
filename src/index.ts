// Main middleware exports
export {
  ConvosMiddleware,
  type ConvosMiddlewareOptions,
  type CreateInviteOptions,
  type CreateGroupOptions,
  type InviteResult,
  type InviteContext,
  type XMTPAgent,
  type XMTPConversation,
  type XMTPMessageContext,
  type AgentMiddleware,
} from "./middleware/convos-middleware.js";

// ConvosGroup - wraps XMTP groups with Convos functionality
export {
  type ConvosGroup,
  type ConvosGroupInviteOptions,
  type SetConversationProfileOptions,
  type XMTPGroupWithAppData,
  createConvosGroup,
} from "./middleware/convos-group.js";

// Legacy exports (use ConvosMiddleware instead)
export {
  ConvosConversationManager,
  type ConvosConversationManagerOptions,
} from "./middleware/conversation-manager.js";

export {
  JoinRequestHandler,
  JoinRequestResult,
  type JoinRequestHandlerOptions,
  type JoinRequestOutcome,
} from "./middleware/join-request-handler.js";

// Content types
export {
  InviteJoinErrorType,
  type InviteJoinError,
  INVITE_JOIN_ERROR_CONTENT_TYPE,
  encodeInviteJoinError,
  decodeInviteJoinError,
  createConversationExpiredError,
  createGenericFailureError,
  getErrorMessage,
} from "./content-types/index.js";

// Invite system (for advanced usage)
export {
  type CreateInviteOptions as InternalCreateInviteOptions,
  type ParsedInvite,
  createInviteSlug,
  parseInviteSlug,
  verifyInvite,
  verifyInviteWithPrivateKey,
  decryptInviteConversationId,
  encryptConversationToken,
  decryptConversationToken,
  encodeToSlug,
  decodeFromSlug,
  generateInviteURL,
  parseInviteCode,
} from "./invite/index.js";

// Protobuf types (for advanced usage)
export {
  type InvitePayload,
  type SignedInvite,
  type ConversationProfile,
  type ConversationCustomMetadata,
} from "./proto/index.js";

// Crypto utilities (for advanced usage)
export {
  deriveInviteKey,
  encrypt,
  decrypt,
  signWithRecovery,
  recoverPublicKey,
  getPublicKey,
  hashSha256,
  constantTimeEqual,
  normalizePublicKey,
} from "./crypto/index.js";

// Utility functions
export {
  generateSecureRandomString,
  generateInviteTag,
  hexToBytes,
  bytesToHex,
  base64UrlEncode,
  base64UrlDecode,
} from "./utils/index.js";

// Agent runtime
export {
  startAgent,
  type AgentRuntime,
  type AgentRuntimeOptions,
  type AgentState,
  type MessageContext,
} from "./agent/index.js";
