#!/usr/bin/env node
import { Command } from "commander";
import { startAgent } from "./agent/index.js";
const program = new Command();
program
    .name("convos-node-sdk")
    .description("Convos invite system middleware for XMTP agents")
    .version("1.0.0")
    .option("--dev", "Use XMTP dev environment (default)")
    .option("--prod", "Use XMTP production environment")
    .option("--local <ip>", "Use XMTP local environment at specified IP");
/**
 * Gets the XMTP environment from global options.
 * Priority: --local > --prod > --dev (default)
 */
function getEnv() {
    const opts = program.opts();
    if (opts.local) {
        return "local";
    }
    if (opts.prod) {
        return "production";
    }
    return "dev";
}
/**
 * Gets the API URL for local environment, if --local was specified.
 */
function getApiUrl() {
    const opts = program.opts();
    if (opts.local) {
        return `http://${opts.local}:5556`;
    }
    return undefined;
}
program
    .command("listen")
    .description("Listen for messages and invites")
    .option("-d, --data-dir <path>", "Data directory for persistent storage", ".convos-agent")
    .option("--auto-accept", "Automatically accept invite requests")
    .action(async (options) => {
    const runtime = await startAgent({
        dataDir: options.dataDir,
        env: getEnv(),
        apiUrl: getApiUrl(),
        onInvite: options.autoAccept
            ? async (ctx) => {
                await ctx.accept();
            }
            : undefined,
        onMessage: async (ctx) => {
            const text = typeof ctx.content === "string"
                ? ctx.content
                : ctx.content?.text ?? JSON.stringify(ctx.content);
            process.stdout.write(`${ctx.conversationId} ::: ${ctx.senderName} :: ${text}\n`);
        }
    });
    const shutdown = async () => {
        await runtime.stop();
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
});
program
    .command("start-convo")
    .description("Create a new group conversation and print the invite URL")
    .option("-d, --data-dir <path>", "Data directory for persistent storage", ".convos-agent")
    .option("-n, --name <name>", "Group name")
    .option("--description <description>", "Group description")
    .option("--no-auto-accept", "Return immediately instead of waiting for invites")
    .option("--auto-accept-all", "Wait forever and auto-accept all invites")
    .action(async (options) => {
    const runtime = await startAgent({
        dataDir: options.dataDir,
        env: getEnv(),
        apiUrl: getApiUrl(),
        onInvite: async (ctx) => {
            await ctx.accept();
            if (!options.autoAcceptAll) {
                await runtime.stop();
                process.exit(0);
            }
        },
    });
    const { inviteUrl } = await runtime.createGroup({
        name: options.name,
        description: options.description,
    });
    process.stdout.write(inviteUrl + "\n");
    if (!options.autoAccept) {
        await runtime.stop();
        return;
    }
    const shutdown = async () => {
        await runtime.stop();
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
});
program
    .command("send")
    .description("Send a message to a conversation, or broadcast to all")
    .argument("<message>", "Message to send")
    .option("-d, --data-dir <path>", "Data directory for persistent storage", ".convos-agent")
    .option("-c, --conversation <id>", "Conversation ID (broadcasts to all if not specified)")
    .action(async (message, options) => {
    const runtime = await startAgent({
        dataDir: options.dataDir,
        env: getEnv(),
        apiUrl: getApiUrl(),
    });
    if (options.conversation) {
        await runtime.sendToConversation(options.conversation, message);
    }
    else {
        await runtime.broadcast(message);
    }
    await runtime.stop();
});
program
    .command("join")
    .description("Join a conversation using an invite URL")
    .argument("<url>", "Invite URL to join")
    .option("-d, --data-dir <path>", "Data directory for persistent storage", ".convos-agent")
    .option("--no-wait", "Don't wait for the join to be accepted")
    .action(async (url, options) => {
    // Get existing conversations before joining (for wait mode)
    const existingConversations = new Set();
    const runtime = await startAgent({
        dataDir: options.dataDir,
        env: getEnv(),
        apiUrl: getApiUrl(),
    });
    if (options.wait) {
        // Track existing conversations so we can detect the new one
        const conversations = await runtime.listConversations();
        for (const id of conversations) {
            existingConversations.add(id);
        }
    }
    // Send the join request
    const result = await runtime.join(url);
    if (!options.wait) {
        // Just print info and exit
        process.stdout.write(`Join request sent to ${result.creatorInboxId}\n`);
        if (result.name) {
            process.stdout.write(`Conversation: ${result.name}\n`);
        }
        await runtime.stop();
        return;
    }
    // Wait for the join to be accepted by polling for new conversations
    process.stderr.write(`Waiting to be added to conversation...\n`);
    const pollInterval = 1000; // 1 second
    const maxWaitTime = 60000; // 60 seconds
    const startTime = Date.now();
    const checkForNewConversation = async () => {
        const conversations = await runtime.listConversations();
        for (const id of conversations) {
            if (!existingConversations.has(id)) {
                return id;
            }
        }
        return null;
    };
    const poll = async () => {
        while (Date.now() - startTime < maxWaitTime) {
            const newConversationId = await checkForNewConversation();
            if (newConversationId) {
                process.stdout.write(`${newConversationId}\n`);
                await runtime.stop();
                process.exit(0);
            }
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }
        process.stderr.write(`Timeout waiting for join acceptance\n`);
        await runtime.stop();
        process.exit(1);
    };
    const shutdown = async () => {
        await runtime.stop();
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    await poll();
});
program
    .command("list")
    .description("List all conversation IDs")
    .option("-d, --data-dir <path>", "Data directory for persistent storage", ".convos-agent")
    .action(async (options) => {
    const runtime = await startAgent({
        dataDir: options.dataDir,
        env: getEnv(),
        apiUrl: getApiUrl(),
    });
    const conversationIds = await runtime.listConversations();
    for (const id of conversationIds) {
        process.stdout.write(id + "\n");
    }
    await runtime.stop();
});
program
    .command("wait")
    .description("Wait for a message to be received")
    .option("-d, --data-dir <path>", "Data directory for persistent storage", ".convos-agent")
    .option("-c, --conversation <id>", "Conversation ID (any conversation if not specified)")
    .option("-r, --regex <pattern>", "Regex pattern to match message content")
    .action(async (options) => {
    const regex = options.regex ? new RegExp(options.regex) : null;
    const runtime = await startAgent({
        dataDir: options.dataDir,
        env: getEnv(),
        apiUrl: getApiUrl(),
        onMessage: async (ctx) => {
            const text = typeof ctx.content === "string"
                ? ctx.content
                : ctx.content?.text || "";
            // Filter by conversation if specified
            if (options.conversation && ctx.conversationId !== options.conversation) {
                return;
            }
            // Filter by regex if specified
            if (regex && !regex.test(text)) {
                return;
            }
            process.stdout.write(text + "\n");
            await runtime.stop();
            process.exit(0);
        },
        onInvite: async (ctx) => {
            await ctx.accept();
        },
    });
    const shutdown = async () => {
        await runtime.stop();
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
});
program
    .command("accept")
    .description("Wait for a pending invite and accept it")
    .option("-d, --data-dir <path>", "Data directory for persistent storage", ".convos-agent")
    .action(async (options) => {
    const runtime = await startAgent({
        dataDir: options.dataDir,
        env: getEnv(),
        apiUrl: getApiUrl(),
        onInvite: async (ctx) => {
            await ctx.accept();
            process.stdout.write(`${ctx.conversationId}\n`);
            await runtime.stop();
            process.exit(0);
        },
    });
    const shutdown = async () => {
        await runtime.stop();
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
});
program
    .command("profile")
    .description("Set the profile (name and/or image) for all conversations")
    .option("-d, --data-dir <path>", "Data directory for persistent storage", ".convos-agent")
    .option("-n, --name <name>", "Profile display name")
    .option("-i, --image <url>", "Profile image URL")
    .action(async (options) => {
    if (!options.name && !options.image) {
        // Show current profile if no options provided
        const runtime = await startAgent({
            dataDir: options.dataDir,
            env: getEnv(),
            apiUrl: getApiUrl(),
        });
        const profile = runtime.getProfile();
        if (profile && (profile.name || profile.image)) {
            if (profile.name) {
                process.stdout.write(`Name: ${profile.name}\n`);
            }
            if (profile.image) {
                process.stdout.write(`Image: ${profile.image}\n`);
            }
        }
        else {
            process.stdout.write("No profile set\n");
        }
        await runtime.stop();
        return;
    }
    const runtime = await startAgent({
        dataDir: options.dataDir,
        env: getEnv(),
        apiUrl: getApiUrl(),
    });
    // Get current profile and merge with new values
    const currentProfile = runtime.getProfile() || {};
    const newProfile = {
        name: options.name !== undefined ? options.name : currentProfile.name,
        image: options.image !== undefined ? options.image : currentProfile.image,
    };
    await runtime.saveProfile(newProfile);
    process.stdout.write("Profile updated and applied to all conversations\n");
    if (newProfile.name) {
        process.stdout.write(`Name: ${newProfile.name}\n`);
    }
    if (newProfile.image) {
        process.stdout.write(`Image: ${newProfile.image}\n`);
    }
    await runtime.stop();
});
program.parse();
//# sourceMappingURL=cli.js.map