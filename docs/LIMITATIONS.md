# Limitations

Jarvis is an ambitious local assistant prototype, not a finished consumer product. This file documents the boundaries clearly so the project is evaluated honestly.

## Local-Only

Jarvis is designed for local Mac usage and is not deployed as a public web app.

That is intentional. The core value depends on local screen context, microphone input, app/window state, SQLite memory, and macOS automation permissions.

## Permission Dependency

Some features require user-granted permissions such as:

- Microphone
- Screen Recording
- Accessibility
- Automation

If permissions are missing or granted to the wrong app/terminal, voice, OCR, and desktop automation features may fail.

## Automation Fragility

Desktop automation can be affected by:

- UI changes
- app updates
- website changes
- screen layout
- active window focus
- permission state
- OCR quality
- timing delays

Jarvis can perform local actions within the boundaries of user-granted permissions and implemented tool integrations. It should not be described as having complete control over the computer.

## Browser And App Interaction

Browser and app interaction is best-effort. Some websites expose accessible labels or readable screen text; others do not. Some apps respond well to AppleScript/System Events; others are harder to automate reliably.

## Testing Limitations

Cloud CI cannot fully validate local OS-level interactions. The current CI checks the Node/TypeScript backend path, while microphone, OCR, Accessibility, and real app automation are tested manually on macOS.

## Prototype Scope

Jarvis demonstrates the architecture and potential of a personalized AI desktop assistant, but it is not packaged as a consumer-ready product.

Current prototype boundaries include:

- no polished installer yet
- limited memory management UI
- best-effort multi-step workflows
- limited automated coverage for OS-level behavior
- local setup required

## Safety Limitations

Risky actions should require confirmation in future versions, including:

- deleting files
- sending messages
- making purchases
- modifying system settings
- running shell commands
- taking irreversible actions in third-party apps

## Privacy Limitations

Jarvis uses local state, but AI-backed features may send relevant text or audio-derived transcripts to external APIs depending on the workflow. Future versions should make data flow more visible and give the user stronger controls over memory, logs, and API usage.

## What This Project Proves

Even with these limits, Jarvis demonstrates:

- local-first assistant architecture
- LLM + deterministic tool orchestration
- OCR/screen context workflows
- memory and retrieval direction
- macOS automation integration
- practical AI product judgment

The limitations are part of the engineering story, not something hidden from it.
