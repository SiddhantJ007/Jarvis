# Architecture

Jarvis is a local-first macOS assistant made of two main parts:

- a Swift/SwiftUI macOS app for the user-facing HUD, hotkeys, audio capture, and audio playback
- a Node.js/TypeScript backend for routing, tools, LLM calls, OCR workflows, and local state

The core design principle is hybrid control: use deterministic code for actions that need predictable behavior, and use the LLM for language-heavy work such as summarization, rewriting, conversation, and flexible intent interpretation.

## End-To-End Flow

```text
Voice / text / screen request
  -> SwiftUI app and HUD
  -> local Express API
  -> STT, OCR, or text normalization
  -> command router and context lookup
  -> deterministic tool call and/or LLM reasoning
  -> local action, generated answer, or transformed text
  -> SQLite logging and memory updates
  -> app response, optional TTS, HUD state update
```

## Input Layer

Jarvis accepts input from three places:

- **Voice:** the macOS app records audio and sends it to `/v0/stt`
- **Text:** typed commands are sent directly to `/v0/query`
- **Screen/OCR:** selected screen workflows capture visible text and pass it through OCR before summarization or rewriting

The HUD shows the assistant state: idle, listening, or speaking. Global hotkeys control listening so the app can feel ambient rather than requiring a full chat window.

## Speech-To-Text

Voice recordings are sent from the Swift app to the local backend. The backend uses OpenAI speech-to-text to convert audio into text. Once transcribed, the text follows the same routing path as typed commands.

This keeps the voice layer separate from the command layer: Jarvis does not need separate logic for “spoken” versus “typed” intent after transcription.

## Command Router

The TypeScript backend owns the main assistant pipeline. It combines:

- fuzzy phrase matching for common commands
- deterministic routing for known tools
- short-term session context
- local preferences and memory
- LLM calls when the input is ambiguous or language-heavy

Examples of deterministic routes include app opening, agenda operations, clipboard actions, time, and basic key commands. Examples of LLM-heavy routes include rewriting text, summarizing OCR output, and conversational responses.

## LLM Reasoning

OpenAI is used for:

- conversational answers
- intent normalization when rules are not enough
- summarizing screen or selected text
- rewriting, polishing, and formalizing text
- embeddings for lightweight memory/RAG hooks
- speech-to-text and text-to-speech

The LLM does not directly operate macOS. It can help interpret or generate language, but the backend decides which local tool is safe and appropriate to run.

## Local Tools And Actions

Tools live under `src/tools/`. They cover workflows such as:

- opening or closing applications
- opening URLs and tabs
- agenda CRUD operations
- copying, cutting, pasting, selecting, typing, and pressing keys
- OCR screen reading
- best-effort UI clicking and scrolling
- news, weather, time, files, notes, and music helpers

Desktop automation uses a combination of AppleScript, System Events, shell commands, OCR, accessibility APIs, and browser helpers. This is useful for a prototype, but not guaranteed across every app or website.

## OCR And Screen Context

For screen-reading workflows, Jarvis captures the screen and uses macOS Vision OCR to extract text. The extracted text can then be:

- summarized
- rewritten
- used to locate visible UI text for a click attempt
- passed into the LLM for higher-level interpretation

OCR quality depends on screen visibility, contrast, layout, app permissions, and whether the relevant content is actually visible.

## SQLite Memory And State

Jarvis stores local data in SQLite through `better-sqlite3`.

The database tracks:

- messages
- action logs
- preferences
- agenda items
- message embeddings
- note embeddings

This gives Jarvis continuity across commands, but it also means the local database may contain private information. Database files are ignored by git and should not be committed.

## Output Layer

Jarvis can return output through:

- visible chat text in the app
- HUD state changes
- spoken TTS audio
- clipboard content
- terminal logs for debugging
- direct desktop actions

The intended user experience is quiet by default: successful actions should not require long spoken confirmations, while detailed errors should remain in logs.

## Testing Boundary

The public repo only tests headless backend behavior. It does not attempt to test:

- microphone capture
- OpenAI network calls
- screen recording permissions
- OCR accuracy
- Accessibility permissions
- AppleScript UI automation
- real app/window state

Those workflows require manual testing on macOS and are documented as prototype-level behavior.

## Known Limits

The most reliable workflows are direct commands, agenda operations, text rewriting, screen summarization, and simple app opening. Browser and desktop interaction are best-effort because real interfaces differ widely and can change without notice. Multistep workflows are intentionally limited and should be treated as an area for future hardening.
