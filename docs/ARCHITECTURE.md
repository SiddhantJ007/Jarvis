# Jarvis Architecture

Jarvis is organized as a local macOS client plus a TypeScript backend. The design goal is to keep low-level computer actions deterministic while using an LLM for the parts that benefit from language understanding.

## Main Flow

```text
User input
  -> Swift macOS app / HUD
  -> local Express backend
  -> input normalization and context lookup
  -> deterministic tool call or LLM response
  -> action execution / answer generation
  -> logging, optional TTS, UI response
```

## Input Layer

The macOS app accepts text input and voice input. Voice recordings are sent to the backend endpoint for speech-to-text transcription. The HUD is a lightweight ambient interface that displays whether Jarvis is idle, listening, or speaking.

The app also uses hotkeys for voice control. Because this is a prototype, microphone behavior and permissions can affect reliability.

## Processing Layer

The backend receives requests through Express routes. The main pipeline decides whether a request is:

- a direct action, such as opening an app
- an information request, such as time, weather, or news
- a local workflow, such as agenda management or dictation
- an LLM task, such as rewriting, summarization, or conversation
- a mixed request that may require tools and an LLM response

The system uses a mix of fuzzy command matching, deterministic routing, session context, and LLM planning. This hybrid approach is deliberate: local actions should be predictable, while natural-language tasks should remain flexible.

## Tool Layer

Tools are registered in `src/tools/index.ts`. They include:

- app and URL opening
- tab/app closing
- agenda CRUD workflows
- screen reading and OCR-based UI helpers
- clicking, scrolling, typing, selecting, copying, cutting, and pasting
- notes and file helpers
- time, news, weather, and music helpers

macOS UI control relies on AppleScript, System Events, OCR, and accessibility permissions. It is useful but still prototype-level because real app interfaces vary heavily.

## Model Layer

OpenAI is used for:

- chat-style answers
- intent normalization where rule matching is not enough
- summarizing OCR or selected text
- rewriting and polishing text
- embeddings for lightweight memory/RAG
- speech-to-text
- text-to-speech

The model does not directly operate the computer. It produces language or structured intent; the backend decides which tools, if any, are executed.

## Memory And Data

Jarvis stores local data in SQLite through `better-sqlite3`. The database tracks:

- messages
- action logs
- preferences
- agenda items
- message and note embeddings

This is useful for continuity, but it also means local database files can contain private data. They should not be committed to a public repository.

## Output Handling

Responses can return as:

- visible text in the app
- spoken audio through TTS
- a local action result
- clipboard output
- terminal logs for debugging

Successful action acknowledgements are intentionally kept short or suppressed in parts of the app. Errors are meant to be abstracted for the user while detailed logs remain in the terminal.

## Prototype Limits

The most reliable parts are direct commands, agenda workflows, summarization/rewriting, and simple app opening. Browser and app interaction are more fragile because they depend on the active window, permissions, UI text visibility, and timing. Multi-step workflows exist as a prototype and should be treated as an area for future hardening.
