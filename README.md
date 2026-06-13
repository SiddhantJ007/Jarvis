# Jarvis

**Local-first macOS AI assistant prototype with voice I/O, OCR screen context, LLM reasoning, SQLite memory, and desktop automation.**

> Demo video: **https://youtu.be/uISCi_UVRec**

Jarvis is a desktop assistant experiment built to go beyond a normal chat interface. It can listen to voice commands, speak back, read text from the screen, summarize or rewrite content, manage a local agenda, and trigger practical macOS actions through a local backend.

This is intentionally a local prototype, not a deployed web app. Some workflows are reliable, while deeper browser/app automation is best-effort because it depends on macOS permissions, focused windows, app UI structure, and screen state.

## Demo

A short walkthrough video is available here:

[![Project Jarvis Demo Video](https://img.youtube.com/vi/uISCi_UVRec/0.jpg)](https://youtu.be/uISCi_UVRec)

This demo shows Jarvis running locally and demonstrates the assistant workflow, including voice interaction, OCR/document input, summarization, rewriting, and task-style AI responses.

## Why I Built It

I built Jarvis to explore what an assistant-style AI system needs beyond a prompt box:

- messy voice and text input from a real user
- deterministic logic for local actions that should be predictable
- LLM reasoning for summarization, rewriting, conversation, and flexible intent
- local memory/state for agenda items, preferences, messages, and action logs
- a lightweight macOS HUD instead of a traditional full-screen chat UI

The project became an exercise in deciding when to use AI and when not to. Opening an app, pressing a key, or updating an agenda item should be handled deterministically. Summarizing a screen, rewriting selected text, or carrying a discussion benefits from an LLM.

## Key Features

- Voice input with OpenAI speech-to-text
- Spoken responses with OpenAI text-to-speech
- Siri-like macOS HUD with listening/speaking/idle states
- Open and quit local macOS applications
- Open URLs and basic browser workflows
- Best-effort clicking, scrolling, typing, copy, paste, cut, and selection
- OCR-based screen reading and screen summarization
- Rewrite, polish, formalize, or improve selected/screen text
- Daily agenda: add, read, update, delete, move, and mark items
- Dictation mode for writing into apps like Notes or Word
- Copy the latest Jarvis response to the clipboard
- Current time, news, and weather workflows
- Jokes, facts, and short conversational answers
- Local SQLite-backed messages, actions, preferences, agenda, and memory hooks

## Architecture Overview

Jarvis is split into a Swift macOS app and a local TypeScript backend.

```text
User voice/text/screen request
  -> SwiftUI macOS app + HUD
  -> local Express backend
  -> STT / OCR / text normalization
  -> deterministic command router and/or LLM reasoning
  -> local tools: apps, agenda, clipboard, OCR, browser, files, weather/news
  -> SQLite logging and memory/state
  -> text response, optional TTS audio, HUD status update
```

The model does not directly control the computer. The backend decides whether a request should call a local tool, ask the LLM for language work, or combine both.

More detail is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tech Stack

- **macOS app:** Swift, SwiftUI, AppKit, AVFoundation
- **Local backend:** Node.js, TypeScript, Express
- **Database:** SQLite with `better-sqlite3`
- **AI:** OpenAI chat completions, embeddings, Whisper STT, TTS
- **Screen/OCR:** macOS screenshot capture and Apple Vision OCR
- **Automation:** AppleScript, System Events, shell commands, Chrome remote debugging helpers
- **Testing:** TypeScript build plus headless backend smoke test

## Local Setup

Prerequisites:

- macOS
- Node.js and npm
- Xcode Command Line Tools / Swift toolchain
- OpenAI API key
- macOS permissions listed below

Install and build the backend:

```bash
npm install
npm run build
```

Create a local `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Fill in the required local values. Do not commit `.env`.

Start the backend:

```bash
npm start
```

Run the macOS app from another terminal:

```bash
cd macos/JarvisApp
swift run
```

If the app logs a connection error for `http://127.0.0.1:3001`, the backend is not running or the port does not match.

## Environment Variables

```env
OPENAI_API_KEY=your_openai_api_key_here
NEWS_API_KEY=your_news_api_key_here
OPENWEATHER_API_KEY=your_openweather_api_key_here
WEATHER_DEFAULT_CITY=New York City
PORT=3001
JARVIS_BASE_DIR=/path/to/local/jarvis-data
TTS_VOICE=onyx
TTS_DISABLED=0
TTS_STUB=0
```

- `OPENAI_API_KEY`: required for LLM, embeddings, STT, and TTS
- `NEWS_API_KEY`: optional, used for headline/news workflows
- `OPENWEATHER_API_KEY`: optional, used when available for weather
- `WEATHER_DEFAULT_CITY`: default city for weather requests
- `PORT`: local backend port, defaults to `3001`
- `JARVIS_BASE_DIR`: local runtime data directory
- `TTS_VOICE`: OpenAI TTS voice; development default is `onyx`
- `TTS_DISABLED`: disables spoken output when enabled
- `TTS_STUB`: returns stubbed TTS output for tests/dev checks

## Required macOS Permissions

Jarvis may need these permissions depending on the command:

- **Microphone:** voice input
- **Accessibility:** clicking, typing, keyboard shortcuts, app control
- **Screen Recording:** OCR and screen summarization
- **Automation:** AppleScript/System Events control of apps

These permissions are configured in macOS System Settings. Without them, voice, OCR, and UI automation may fail even if the backend is running.

## Example Commands

- "Open Microsoft Word."
- "Click on Blank Document."
- "Start dictation."
- "Read my agenda list."
- "Add going to the gym to my agenda."
- "Summarize what is on my screen."
- "Make the selected text more formal."
- "Copy your last response to the clipboard."
- "What is the weather?"
- "Tell me a joke."
- "What do you think about cricket versus baseball?"
- "Sign off."

## Testing

The repository includes a lightweight backend smoke test that avoids microphone, OCR, Accessibility, and AppleScript UI automation.

```bash
npm run build
npm run smoke
```

The smoke test is intended for CI-safe backend verification only. Full assistant behavior still requires manual macOS testing because the core experience depends on local permissions, active windows, microphone input, and screen state.

## Privacy And Local-First Notes

Jarvis runs as a local desktop prototype. API keys are loaded from local environment variables and should never be committed.

Do not commit:

- `.env`
- local SQLite databases
- `.jarvis-data/`
- logs
- recordings
- screenshots
- generated media
- build artifacts

Some commands may send text, voice audio, OCR output, selected text, or screen text to external APIs such as OpenAI, NewsAPI, OpenWeather, or Open-Meteo depending on the workflow. Review the code path before using private or sensitive information.

## Limitations

- Local prototype, not production software
- Not a cloud-hosted app and not designed for web deployment
- Desktop/browser automation is best-effort
- Behavior is not guaranteed across all apps, websites, layouts, or permission states
- Not production security, privacy, or compliance software
- Multistep workflows exist but are intentionally limited and still being hardened
- Voice reliability depends on microphone quality, background noise, and TTS/listening coordination

## Future Improvements

- Stronger multistep task planner with per-step confirmation and recovery
- More reliable browser automation through structured page state where available
- Better voice activity detection and speaker isolation
- First-run onboarding for macOS permissions
- More pure-function tests around routing, agenda logic, and text transformations
- Packaged macOS app distribution instead of running through `swift run`
- Clearer separation between prototype tools, runtime data, and production-safe modules
