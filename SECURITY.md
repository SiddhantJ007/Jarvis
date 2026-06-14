# Security and Privacy

Jarvis is a local-first macOS assistant prototype. That matters because Jarvis interacts with user-specific desktop context: microphone input, visible screen text, local app state, local memory, and desktop automation.

This document explains the intended security and privacy boundaries of the project.

## Local-First Principle

Jarvis is designed to run locally because the most important parts of the project depend on the user's own Mac:

- what applications are open
- what text is visible on screen
- what the user says into the microphone
- which local files or notes are available to the user
- which macOS permissions the user has granted

The repo is public, but runtime data is not meant to be public. API keys, local databases, recordings, screenshots, logs, and generated media should stay out of git.

## User-Granted Permissions

Jarvis only accesses sensitive macOS capabilities when the user grants the required permissions.

Depending on the workflow, Jarvis may require:

- **Microphone** for voice input
- **Screen Recording** for OCR and screen summarization
- **Accessibility** for clicking, typing, keyboard shortcuts, and UI interaction
- **Automation** for AppleScript/System Events control of applications

These permissions are controlled by macOS System Settings. If permission is not granted, the related feature should fail instead of bypassing the OS boundary.

## Sensitive Capabilities

Jarvis has prototype integrations for sensitive capabilities:

- screen context and screen capture
- OCR extraction of visible text
- accessibility-based UI interaction
- app launching and closing
- clipboard read/write behavior through implemented tools
- local memory and preferences
- local action logs

These capabilities are powerful, so they should be treated with the same caution as any desktop automation tool.

## Data Handling

Jarvis stores local state in SQLite. Depending on usage, this can include:

- messages
- action logs
- agenda items
- preferences
- embeddings for message/note recall

Some commands may send content to external APIs. For example:

- voice audio may be sent for speech-to-text
- response text may be sent for text-to-speech
- selected or OCR-extracted text may be sent for summarization or rewriting
- news/weather requests may use external APIs
- embeddings may be generated through an external API

Jarvis should not be used with sensitive personal, financial, legal, medical, or confidential work data unless the user understands and accepts the code path involved.

## What Should Not Be Committed

The public repo should not include:

- `.env`
- API keys
- tokens
- local SQLite databases
- `.jarvis-data/`
- private logs
- recordings
- screenshots
- generated media
- private documents
- private conversations

The `.gitignore` is configured to block these common local artifacts.

## Memory Safety

Jarvis stores memory intentionally so the assistant can improve continuity. That memory should remain local.

Current state:

- agenda items are stored locally
- messages and action logs are stored locally
- preferences can be stored locally
- embeddings can be stored locally

Future improvements should include:

- memory management UI
- delete/export controls
- explicit memory consent controls
- encrypted memory storage
- clearer separation between short-term session context and long-term memory

## Action Safety

Jarvis can trigger local actions, so risky operations should require confirmation in future versions.

Examples of actions that should require confirmation:

- deleting files
- sending messages or emails
- making purchases
- modifying system settings
- running shell commands
- submitting forms
- moving or overwriting important documents

The current public version should be treated as a prototype and used carefully.

## Demo Safety

The public demo and repo should not expose:

- private files
- real credentials
- personal conversations
- private emails
- private documents
- API keys
- local database contents

The current demo is intended to show capability without exposing sensitive information.

## Known Limitations

- Jarvis has not been security-audited.
- It is a local prototype, not production software.
- OS-level automation can be fragile.
- Permission handling needs production hardening.
- The memory layer needs better user-facing controls.
- External API usage depends on the user's configured providers and keys.

## Future Improvements

- explicit allowlist of local actions
- confirmation layer for risky commands
- audit logs visible to the user
- local-only mode for privacy-sensitive workflows
- encrypted memory store
- permission status dashboard
- safer shell/action execution boundaries
- better handling of private screen or clipboard content
