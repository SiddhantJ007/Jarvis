# Demo Walkthrough

## Demo Video

[Watch the Jarvis demo video](https://youtu.be/uISCi_UVRec)

Jarvis is a local-first macOS assistant, so the demo video is the main way to evaluate the user experience. A public hosted deployment would not show the core value because the assistant depends on local permissions, screen context, microphone input, and desktop automation.

The README includes a custom demo preview image and a compact screenshot grid showing representative local workflows: dictation, browser/app interaction, app launching, and HUD state changes.

## What The Demo Shows

- conversational interaction
- voice-driven assistant behavior
- app opening
- local workflow automation
- screen/text summarization
- writing support
- dictation into a local document
- HUD listening/speaking states
- daily agenda/task tracking
- memory and personalization direction
- assistant-like responses through a macOS desktop experience

## Suggested Viewing Order

1. Start with basic assistant commands.
2. Watch how Jarvis handles local app or workflow actions.
3. Watch the screen/text summarization flow.
4. Watch the writing assistance flow.
5. Watch the task/agenda examples.
6. Review [ARCHITECTURE.md](ARCHITECTURE.md) for implementation details.

## What To Notice

- Jarvis is local-first.
- It uses user-granted permissions.
- It combines conversation, memory, and action.
- It uses deterministic tools where actions need reliability.
- It uses LLMs where language understanding, summarization, and rewriting are useful.
- It is closer to an agentic desktop assistant prototype than a standard chatbot.

## Demo Limitations

- video-based demo instead of public hosted app
- local Mac permissions required
- not packaged for public installation yet
- automation is best-effort and can vary by app, website, focus state, and permissions
- the demo shows representative workflows, not a guarantee that every app or website can be controlled perfectly

## How To Read The Demo With The Repo

The demo shows the experience. The repo explains how it is built:

- [VISION.md](VISION.md) explains why I built it.
- [ARCHITECTURE.md](ARCHITECTURE.md) explains the system flow.
- [CAPABILITIES.md](CAPABILITIES.md) lists what Jarvis can do.
- [PERMISSIONS.md](PERMISSIONS.md) explains the macOS permission model.
- [ENGINEERING_DECISIONS.md](ENGINEERING_DECISIONS.md) explains the main tradeoffs.
