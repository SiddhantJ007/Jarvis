# Permissions

Jarvis is a local macOS assistant, so some of its most useful features depend on permissions that only the user can grant. That is intentional. The project is designed to work inside the security boundaries macOS provides for microphone input, screen context, and desktop automation.

## Why Permissions Are Required

Jarvis is not just a chat box. It tries to understand what the user is doing on their Mac and, where supported, help with that work directly. That requires access to local desktop context:

- listening to spoken commands
- reading visible text for summarization or rewriting
- clicking, typing, scrolling, and using keyboard shortcuts
- opening, closing, and interacting with local applications

Without the right permission, Jarvis should still support non-permission features such as conversation, agenda management, and text-based requests, but the desktop-aware features will be limited.

## Accessibility Permission

Accessibility permission is used for:

- app interaction
- UI automation
- clicking visible controls where supported
- typing or pasting into the focused app
- keyboard shortcuts such as copy, paste, select all, and close tab
- command execution through desktop controls

This is the permission that allows Jarvis to act through macOS System Events and related automation paths. It does not mean Jarvis has unlimited control; it can only perform the actions implemented in the local tool layer.

## Screen Recording / Screen Context Permission

Screen Recording permission is used for:

- screen-aware summarization
- OCR-based reading of visible text
- finding visible labels or buttons
- understanding what the user is working on
- giving writing help based on selected or visible content

This is required because macOS protects screen contents. If this permission is missing, Jarvis may still answer normal questions, but it will not be able to reliably summarize or reason over visible screen content.

## Microphone Permission

Microphone permission is used for:

- voice input
- hotkey-triggered listening
- continuous listening sessions
- dictation mode

The speech-to-text pipeline only works if macOS allows the app or launching terminal to access the microphone.

## Automation Permission

Automation permission may be requested when Jarvis controls another app through AppleScript or System Events. This is commonly involved in workflows such as opening an app, activating a window, closing a tab, or sending a shortcut to a target application.

## Required By Feature

| Feature | Permission |
| --- | --- |
| Voice input | Microphone |
| Spoken responses | Audio output, no special permission usually required |
| Screen summarization | Screen Recording |
| OCR click / visible text search | Screen Recording and Accessibility |
| Clicking, typing, keyboard shortcuts | Accessibility |
| App automation through AppleScript/System Events | Automation and Accessibility |
| Opening apps/URLs | Usually no special permission, depending on app behavior |

## How To Enable

Open macOS System Settings and review:

- Privacy & Security -> Microphone
- Privacy & Security -> Screen Recording
- Privacy & Security -> Accessibility
- Privacy & Security -> Automation

The exact app or terminal entry depends on how Jarvis is launched. During development, permissions may apply to Terminal, iTerm, Xcode, or the built Jarvis app.

## Permission Failure Behavior

If a permission is missing, Jarvis should:

- explain which permission appears to be missing
- avoid silently failing
- continue supporting features that do not need that permission
- guide the user to enable permission manually
- log technical details locally for debugging

In practice, OS-level workflows can still fail because of focus issues, app-specific UI changes, or unavailable screen text. Those failures should be treated as recoverable prototype limitations, not as reasons to bypass user consent.

## Security Boundary

Jarvis should not bypass macOS permissions. User consent is part of the design.

The right model is permission-gated capability, not hidden control. Jarvis can perform local actions within the boundaries of user-granted permissions and implemented tool integrations.

## Troubleshooting Checklist

If a feature does not work, check:

- Is the backend running?
- Is the Swift app running?
- Did macOS ask for permission?
- Was permission granted to the correct app, terminal, or built binary?
- Is the target text visible on screen?
- Is the correct app focused?
- Is the local action supported by Jarvis's tool layer?
