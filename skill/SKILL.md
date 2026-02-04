---
name: convos-node-sdk
description: Send and receive messages over XMTP using the Convos invite system. Use for real-time user communication, providing status updates during long-running tasks, notifying users of progress, or setting up XMTP messaging channels.
allowed-tools: Bash
user-invocable: true
---

# Convos Agent - XMTP Messaging Skill

Use `convos-node-sdk` to communicate with users over XMTP. This enables real-time messaging during long-running tasks, providing status updates, and maintaining connection with users.

## Important: Always Use Production Environment

Always use `--prod` flag unless the user explicitly requests a different environment:

```bash
convos-node-sdk --prod <command>
```

## Quick Reference

```bash
# Choose a profile name
convos-node-sdk --prod profile --name "Fiddler's Green"

# Create a new conversation and get invite URL
convos-node-sdk --prod start-convo --name "Session Name" --no-auto-accept

# Send a message to a specific conversation
convos-node-sdk --prod send -c <conversation-id> "Your message here"

# Broadcast to all conversations
convos-node-sdk --prod send "Message to everyone"

# List all conversation IDs
convos-node-sdk --prod list

# Listen for messages (foreground)
convos-node-sdk --prod listen --auto-accept

# Wait for a specific message
convos-node-sdk --prod wait -c <conversation-id> -r "pattern"

# Join a conversation via invite URL
convos-node-sdk --prod join "<invite-url>"
```

## Session Flow

### 0. Choose a name for yourself

Pick a name for yourself that feels right for this codebase, have a little fun with it. First Last name.

```bash
# Create a new conversation for this session
convos-node-sdk --prod profile --name "First Last"
```

### 1. Start a New Conversation Session

At the beginning of a task where you want to communicate with the user over XMTP:

```bash
# Create a new conversation for this session with a title you like, make it a bit fun 
INVITE_ID=$(convos-node-sdk --prod start-convo --name "Task: Brief Description" --no-auto-accept)
echo "\e]8;;$INVITE_ID\e\\>>>>>>> CMD + Click here <<<<<<<\e]8;;\e\\\n"
```

### 2. Wait for User to Join

Wait for the user to join and capture the conversation ID:
It is critical that the stdout that prints the URL has no spaces or formatting inserted so that the link is clickable in the terminal.

```bash
# Start a new convo and wait for first join (returns conversation ID)
CONVO_ID=$(convos-node-sdk --prod accept 2>/dev/null)
```

### 3. Confirm Connection

Once you have the conversation ID, send a confirmation message:

```bash
convos-node-sdk --prod send -c "$CONVO_ID" "Connected! I'll send you updates as I work on your task."
```

### 4. Send Progress Updates

Throughout your work, send brief status updates:

```bash
# When starting a subtask
convos-node-sdk --prod send -c "$CONVO_ID" "Starting: Setting up the database schema..."

# When completing a milestone
convos-node-sdk --prod send -c "$CONVO_ID" "Done: Database schema created with 5 tables."

# When encountering something noteworthy
convos-node-sdk --prod send -c "$CONVO_ID" "Note: Found 3 deprecated dependencies, updating them now."

# When pausing or waiting
convos-node-sdk --prod send -c "$CONVO_ID" "Waiting for tests to complete (~2 min)..."
```

### 5. Listen for User Input (Background)

If you need to monitor for user messages while working:

```bash
# Listen in background, will print messages as they arrive
convos-node-sdk --prod listen --auto-accept > /tmp/xmtp-messages.log 2>&1 &
LISTEN_PID=$!

# Later, check for new messages
tail -f /tmp/xmtp-messages.log

# When done, stop listening
kill $LISTEN_PID
```

### 6. Wait for Specific Response

When you need user input before proceeding:

```bash
convos-node-sdk --prod send -c "$CONVO_ID" "Should I proceed with the deployment? Reply 'yes' to continue."

# Wait for affirmative response
RESPONSE=$(convos-node-sdk --prod wait -c "$CONVO_ID" -r "yes|Yeah|ok|proceed|continue")
```

## Best Practices

### Message Frequency

- Send updates at natural breakpoints in your work
- Don't flood the user with messages - batch minor updates
- Always send a message when:
  - Starting a significant task
  - Completing a milestone
  - Encountering an error or unexpected situation
  - Pausing for any reason (waiting for builds, tests, etc.)
  - Finishing the overall task

### Message Style

Keep messages brief and informative:

```bash
# Good - concise and actionable
convos-node-sdk --prod send -c "$CONVO_ID" "Build complete. 3 warnings, 0 errors. Starting tests..."

# Avoid - too verbose
convos-node-sdk --prod send -c "$CONVO_ID" "I have now finished running the build process and I am pleased to report that it completed successfully with only three minor warnings and no errors at all. I will now proceed to run the test suite."
```

### Error Handling

Always notify the user of errors:

```bash
if ! npm run build; then
  convos-node-sdk --prod send -c "$CONVO_ID" "Build failed. Checking error logs..."
fi
```

### Session Cleanup

At the end of a task:

```bash
convos-node-sdk --prod send -c "$CONVO_ID" "Task complete! Summary: Created 5 files, updated 3, ran 47 tests (all passing)."
```

## Environment Options

**Always use `--prod` unless the user explicitly requests otherwise.**

```bash
# Use production environment (ALWAYS USE THIS BY DEFAULT)
convos-node-sdk --prod <command>

# Use dev environment (only if user requests)
convos-node-sdk --dev <command>

# Use local XMTP node (only if user requests)
convos-node-sdk --local 192.168.1.100 <command>
```

## Data Directory

By default, agent state is stored in `.convos-agent/`. Use `-d` to specify a different location:

```bash
convos-node-sdk --prod -d ./my-session start-convo --name "Custom Session"
```

## Example: Complete Task Flow

```bash
#!/bin/bash

# 1. Create conversation with a title you like, make it a bit fun, and capture invite URL
echo "Creating XMTP conversation..."
INVITE_URL=$(convos-node-sdk --prod start-convo --name "Code Review" --no-auto-accept)

echo "\e]8;;$INVITE_ID\e\\>>>>>>> CMD + Click here <<<<<<<\e]8;;\e\\\n"

# 2. Wait for user to join and get conversation ID
echo "Waiting for you to join..."
CONVO_ID=$(convos-node-sdk --prod accept)

if [ -z "$CONVO_ID" ]; then
  echo "No conversation found. Please join the invite link."
  exit 1
fi

# 3. Confirm connection
convos-node-sdk --prod send -c "$CONVO_ID" "Connected! Starting code review..."

# 4. Do work with updates
convos-node-sdk --prod send -c "$CONVO_ID" "Analyzing repository structure..."
# ... do analysis ...

convos-node-sdk --prod send -c "$CONVO_ID" "Found 12 files to review. Beginning detailed analysis..."
# ... do review ...

convos-node-sdk --prod send -c "$CONVO_ID" "Review complete! Found 3 issues: 2 minor, 1 suggestion. Sending detailed report..."

# 5. Final summary
convos-node-sdk --prod send -c "$CONVO_ID" "Code review finished. Check the PR comments for details."
```

## Troubleshooting

### No conversations found
```bash
# Ensure the agent has been initialized
convos-node-sdk --prod list

# Check data directory exists
ls -la .convos-agent/
```

### Message not sending
```bash
# Verify conversation ID is valid
convos-node-sdk --prod list | grep "$CONVO_ID"

# Try broadcasting instead
convos-node-sdk --prod send "Test message"
```

### Connection issues
```bash
# Verify using production environment
convos-node-sdk --prod list
```
