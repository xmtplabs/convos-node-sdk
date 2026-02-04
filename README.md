# convos-node-sdk

Middleware for the XMTP Node SDK that enables the use of the Convos identity system.

## Installation

```bash
npm install github:xmtplabs/convos-node-sdk
```

## SDK Usage

```typescript
import { Agent, createUser, createSigner } from "@xmtp/agent-sdk";
import { ConvosMiddleware } from "convos-node-sdk";

const user = createUser();
const signer = createSigner(user);
const agent = await Agent.create(signer, { env: "production" });

const convos = ConvosMiddleware.create(agent, {
  privateKey: user.key,
});

agent.use(convos.middleware());

// Handle join requests
convos.on("invite", async (ctx) => {
  console.log(`${ctx.joinerInboxId} wants to join`);
  await ctx.accept();
});

// Create a group with invite
const group = await agent.client.conversations.createGroup([]);
const wrapped = convos.group(group);
const invite = await wrapped.createInvite({ name: "My Group" });
console.log(invite.url);

// Join a conversation
const result = await convos.join("https://popup.convos.org/v2?i=...");

await agent.start();
```

## CLI Usage

```bash
# Create a conversation and print invite URL
convos-node-sdk --prod start-convo --name "My Session"

# List conversations
convos-node-sdk --prod list

# Send a message
convos-node-sdk --prod send -c <conversation-id> "Hello"

# Broadcast to all conversations
convos-node-sdk --prod send "Hello everyone"

# Listen for messages
convos-node-sdk --prod listen --auto-accept

# Wait for a specific message
convos-node-sdk --prod wait -c <conversation-id> -r "pattern"

# Join via invite URL
convos-node-sdk --prod join "<invite-url>"
```

### CLI Options

```
--prod              Production environment (recommended)
--dev               Development environment
--local <ip>        Local environment at specified IP
-d, --data-dir      Data directory (default: .convos-agent)
```
