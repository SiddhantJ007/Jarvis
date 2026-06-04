# Jarvis

Jarvis is a macOS AI assistant prototype that combines voice input/output, OCR, local task tools, lightweight memory, and LLM reasoning. It is not just a chat window: it is an experiment in making an assistant that can listen, read what is on screen, summarize or rewrite text, and trigger practical actions on the computer.

The project is intentionally built as a prototype. Some workflows are reliable, while deeper UI automation and multi-step task execution are best-effort and depend on macOS permissions, the active application, and screen state.

## Demo

A short walkthrough video is available here:

[![Project Jarvis Demo Video](https://img.youtube.com/vi/uISCi_UVRec/0.jpg)](https://youtu.be/uISCi_UVRec)

This demo shows Jarvis running locally and demonstrates the assistant workflow, including voice interaction, OCR/document input, summarization, rewriting, and task-style AI responses.

## Why I Built It

I built Jarvis to explore what an assistant-style AI system needs beyond a prompt box. The main goal was to combine:

- messy human input, especially voice commands
- deterministic local actions for things that should not be left to an LLM
- LLM reasoning for summarization, rewriting, conversation, and intent interpretation
- local state for agenda items, preferences, and short-term context
- a minimal macOS interface that feels closer to an ambient assistant than a normal app

The project helped me test where LLMs are useful, where rule-based execution is safer, and where operating-system automation becomes fragile.

## Key Features

- Voice input and spoken responses using OpenAI STT/TTS
- macOS HUD overlay with listening/speaking/idle state
- Open and quit local applications
- Open URLs and basic browser workflows
- Best-effort clicking, scrolling, typing, copy, paste, and selection through macOS UI automation/OCR
- Daily agenda with add, list, update, delete, move, and status workflows
- Dictation mode for writing into apps like Notes or Word
- Screen/text OCR and summarization
- Rewrite, rephrase, polish, or formalize selected/screen text
- Copy the latest Jarvis response to the clipboard
- Current time, news, and weather workflows
- Short conversational mode for questions, opinions, jokes, and facts
- Local SQLite-backed message/action logging and lightweight memory/RAG hooks

## Tech Stack

- **macOS client:** Swift, SwiftUI, AppKit, AVFoundation
- **Backend:** Node.js, TypeScript, Express
- **Database:** SQLite via `better-sqlite3`
- **AI APIs:** OpenAI chat completions, embeddings, speech-to-text, and text-to-speech
- **Automation:** AppleScript, macOS System Events, shell commands, OCR/UI helpers
- **Runtime:** npm scripts for backend, Swift Package Manager for the macOS app

## Architecture / Workflow Overview

Jarvis is split into a local backend and a macOS client.

1. The Swift app captures text or voice input and shows status through the HUD.
2. Voice recordings are sent to the local backend for transcription.
3. The backend normalizes the request and decides whether it is a direct action, an LLM answer, or a mixed workflow.
4. Deterministic tools handle local actions such as opening apps, managing agenda items, typing, pasting, reading screen text, or fetching weather/news.
5. The LLM is used for flexible language understanding, summarization, rewriting, conversational answers, and context-aware responses.
6. Results are logged locally, optionally converted to speech, and returned to the macOS app.

More detail is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## How To Run Locally

Prerequisites:

- macOS
- Node.js and npm
- Xcode Command Line Tools / Swift toolchain
- An OpenAI API key
- macOS permissions for Microphone, Accessibility, Screen Recording, and Automation where needed

Install backend dependencies from the repo root:

```bash
npm install
npm run build
```

Create a local `.env` file in the repo root. You can start from `.env.example`. Do not commit the real `.env`.

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

Start the backend:

```bash
npm start
```

In another terminal, run the macOS app:

```bash
cd macos/JarvisApp
swift run
```

If voice transcription fails with a connection error to `127.0.0.1:3001`, the backend is not running or is using a different port.

## Environment Variables

- `OPENAI_API_KEY`: required for LLM, embeddings, STT, and TTS features
- `NEWS_API_KEY`: required for the NewsAPI headline workflow
- `OPENWEATHER_API_KEY`: optional weather provider key; weather also has a no-key Open-Meteo fallback
- `WEATHER_DEFAULT_CITY`: default city for weather requests
- `PORT`: local backend port, defaults to `3001`
- `JARVIS_BASE_DIR`: local directory for runtime data and SQLite database
- `TTS_VOICE`: OpenAI TTS voice, default used in development was `onyx`
- `TTS_DISABLED`: disables spoken output when set
- `TTS_STUB`: returns stubbed TTS behavior for local testing

## Example Use Cases

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

## What I Learned

- LLMs are strongest when used for interpretation, rewriting, summarization, and conversational reasoning.
- Local actions need deterministic execution paths, clear logging, and defensive fallbacks.
- Voice assistants need strong gating so they do not respond to their own TTS or background noise.
- macOS automation works, but it is sensitive to permissions, focused windows, app-specific UI trees, and timing.
- Memory is useful, but it needs careful boundaries so the assistant does not confuse stored tasks, prior chat, and current commands.
- A polished assistant experience depends as much on silence, timing, and error handling as it does on model quality.

## Future Improvements

- More reliable multi-step task execution with explicit step planning and per-step results
- Stronger UI automation using accessibility trees before OCR fallback
- Better voice activity detection and speaker isolation
- A cleaner onboarding flow for macOS permissions
- More robust tests around agenda persistence, tool routing, and failure handling
- Optional packaged app distribution instead of running through `swift run`
- Clearer separation between prototype scripts, app code, and local runtime data

## API Keys And Privacy

This project uses local `.env` variables for API keys. Do not commit `.env` files, local databases, logs, recordings, screenshots, or generated build artifacts.

Some workflows may send text, voice audio, OCR output, or selected/screen content to external APIs such as OpenAI, NewsAPI, OpenWeather, or Open-Meteo depending on the command. Treat this as a prototype and avoid using private or sensitive data unless you have reviewed the code path and API behavior.

Local memory, messages, agenda items, and action logs are stored in a SQLite database under the configured Jarvis data directory.
