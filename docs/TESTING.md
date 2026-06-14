# Testing Strategy

Jarvis has two different testing needs:

1. Headless backend checks that can run in CI.
2. Manual macOS checks that require real permissions, windows, microphone input, and screen state.

The public repo focuses automated testing on the first category and documents the second honestly.

## Testing Goals

- verify Node/npm project health
- validate the local backend starts correctly
- catch TypeScript regressions
- test deterministic helper behavior where possible
- validate command/response routes that do not require permissions
- prevent basic regressions before a recruiter or engineer runs the repo
- keep OS-level workflows manual instead of pretending they are stable in cloud CI

## Automated Tests

Run:

```bash
npm test
```

This runs:

```bash
npm run build
npm run smoke
```

The build step checks the TypeScript backend. The smoke test checks basic backend routes and deterministic command handling without requiring OpenAI keys, microphone access, Screen Recording permission, Accessibility permission, or AppleScript UI automation.

Current automated coverage is intentionally small. It is meant to prove the repository is healthy and the backend path has not broken, not to simulate a real macOS desktop session.

## What CI Does Not Test

The automated test suite intentionally does not test:

- microphone capture
- OpenAI transcription
- OpenAI TTS playback
- screen recording permissions
- OCR accuracy
- Accessibility permissions
- AppleScript/System Events automation
- real app focus/window state
- clicking real UI elements
- browser-specific page interaction

Those workflows are central to Jarvis, but they require a real local machine with user-granted permissions. Testing them in generic cloud CI would be brittle and misleading.

## Manual QA Checklist

Conversation:

- ask a basic question
- ask a deeper follow-up question
- verify short-term context still works
- verify response tone is useful and concise

Productivity:

- add an agenda item
- read the agenda
- update or delete an agenda item
- summarize visible text
- rewrite selected or visible text
- copy the latest response to clipboard

Desktop:

- open an application
- close an application or tab
- click a visible UI element where supported
- paste clipboard text into Notes or Word
- start and stop dictation
- test screen summarization with a visible document

Security:

- confirm `.env` is not committed
- confirm runtime data and SQLite files are ignored
- verify missing permissions fail safely
- verify sensitive demo data is not exposed
- confirm the app does not claim to bypass macOS permission prompts

## Why Some Tests Are Manual

OS-level automation and permission-gated desktop workflows are difficult to fully test in cloud CI because they depend on local macOS permissions and user-granted access.

For this project, manual testing is not a weakness. It is the realistic testing boundary for a local-first assistant that interacts with the user's actual desktop.

## Future Testing Improvements

- mock automation adapters
- mock screen context
- mock OCR output
- agenda persistence tests
- memory retrieval tests
- command router unit tests
- integration test harness for the local backend
- permission-state simulation
- local E2E scripts for repeatable desktop demos

GitHub Actions still adds value because it verifies the Node/TypeScript side of the project can install, build, and pass smoke checks consistently.
