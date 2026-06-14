# Capabilities

Jarvis can perform local actions within the boundaries of user-granted permissions and implemented tool integrations.

This file describes what Jarvis can do today, what is experimental, and where the boundaries are. The goal is to be clear without exaggerating the project.

## Conversation

Jarvis can:

- answer general questions
- discuss topics in a short back-and-forth style
- give opinions with reasoning instead of only neutral summaries
- tell jokes and facts
- answer weather, time, and news-style assistant queries
- use recent conversation context where available

Conversation is powered by an LLM API. The assistant prompt was tuned to feel more direct and human than a generic chatbot, while still staying practical.

## Productivity

Jarvis supports:

- daily agenda tracking
- adding agenda items
- reading the agenda list
- updating agenda items
- deleting agenda items
- moving or marking items
- copying the latest Jarvis response to the clipboard
- creating simple notes/workflows where supported

Agenda data is stored locally in SQLite.

## Writing Assistance

Jarvis can help with writing workflows such as:

- rewriting selected text
- making text more formal
- polishing rough writing
- improving clarity
- summarizing text
- pasting improved output back where supported
- dictation mode for entering spoken text into apps

The rewrite flow is one of the clearest examples of the hybrid design: local tools handle selection, clipboard, and paste behavior; the LLM handles language quality.

## Screen-Aware Assistance

With Screen Recording permission, Jarvis can:

- capture visible screen context
- extract visible text through OCR
- summarize visible text
- explain content on screen
- use screen text as context for writing or summarization tasks

This is screen-aware assistance, not unrestricted screen control. OCR depends on what is visible, readable, and permission-accessible.

## Desktop Automation

With Accessibility and Automation permissions, Jarvis can attempt to:

- open applications
- close applications
- close browser tabs
- open URLs
- click visible UI text
- scroll
- type
- select text
- cut, copy, and paste
- send common keyboard shortcuts

Desktop automation is best-effort. It works through implemented tools using AppleScript, System Events, OCR, and browser helpers. It is not guaranteed across every application or website.

## Memory and Personalization

Jarvis stores local state for:

- messages
- action logs
- preferences
- agenda items
- message embeddings
- note embeddings

The memory/RAG layer is lightweight but important. It gives the assistant a way to recall context instead of treating every request as isolated.

## Experimental Agentic Behavior

Jarvis includes early agentic behavior:

- interpreting user goals
- mapping fuzzy commands to tools
- executing local actions
- attempting limited step-based workflows
- using screen context as input
- reporting or logging failures

This is still experimental. The current version proves the loop, but it is not yet a fully reliable autonomous planner.

## Limitations

- Jarvis is a local macOS prototype.
- It is not production security software.
- It is not a cloud-hosted assistant.
- It requires explicit macOS permissions for sensitive capabilities.
- Browser and desktop automation are best-effort.
- OCR can miss text or misread text depending on the screen.
- Multistep task execution is limited and still being hardened.
- Memory is local and useful, but it needs future UI controls for editing/removing stored context.

The safest way to describe Jarvis is: a local assistant prototype that combines voice, OCR, memory, LLM reasoning, and deterministic desktop tools to explore what a more action-oriented AI assistant could become.
