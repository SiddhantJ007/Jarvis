# Roadmap

Jarvis is a working local prototype, but the long-term direction is a safer, more capable, and more polished desktop assistant.

## Short-Term

- improve demo video
- add screenshots or short GIFs
- keep improving README clarity
- add more tests for command routing
- add agenda persistence tests
- add better permission error messages
- add a first-run setup guide for macOS permissions
- improve browser interaction through structured page state where possible

## Product Improvements

- packaged Mac app
- menu bar assistant
- voice wake command
- richer task manager
- memory management UI
- permission status dashboard
- confirmation layer for sensitive actions
- smoother onboarding for API keys and permissions
- more reliable HUD states for listening, thinking, and speaking

## AI Improvements

- stronger planner/executor loop
- clearer tool registry
- local model support
- better RAG memory retrieval
- agent self-evaluation
- workflow reflection after task completion
- stronger distinction between conversation, command, dictation, and writing modes
- better filtering for accidental/noisy transcriptions

## Engineering Improvements

- mock automation layer for tests
- better logs
- structured config
- crash/error reporting
- packaging/release pipeline
- optional Swift compile check if stable
- static documentation/link checks
- local E2E scripts for repeatable demo workflows

## Safety Improvements

- action allowlist
- dangerous-action confirmation
- audit logs
- encrypted local memory
- memory edit/delete/export UI
- clearer sensitive-data handling
- stronger separation between safe local actions and risky automation

## Long-Term Direction

The long-term goal is an agentic desktop assistant that can plan, execute, observe, ask clarifying questions, and recover across real workflows while staying inside explicit user permission boundaries.
