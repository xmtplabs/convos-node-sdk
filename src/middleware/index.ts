export {
  ConvosMiddleware,
  type ConvosMiddlewareOptions,
  type CreateInviteOptions,
  type InviteResult,
  type InviteContext,
  type JoinResult,
  type XMTPAgent,
  type XMTPConversation,
  type XMTPMessageContext,
  type AgentMiddleware,
} from "./convos-middleware.js";

// Legacy exports (deprecated - use ConvosMiddleware instead)
export {
  ConvosConversationManager,
  type ConvosConversationManagerOptions,
} from "./conversation-manager.js";

export {
  JoinRequestHandler,
  JoinRequestResult,
  type JoinRequestHandlerOptions,
  type JoinRequestOutcome,
} from "./join-request-handler.js";
