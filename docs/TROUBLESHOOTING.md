# Troubleshooting

Jarvis has two moving parts: the local Node/TypeScript backend and the Swift macOS app. Many issues come from one side running without the other, missing environment variables, or missing macOS permissions.

## npm install fails

Check:

- Node.js version
- npm version
- `package-lock.json` is present
- no partial `node_modules` install from an older environment

Try:

```bash
npm install
```

## Backend does not start

Check:

- `.env` exists locally
- `PORT` is available, usually `3001`
- `OPENAI_API_KEY` is set for AI-backed features
- no other process is using the same port

Run:

```bash
npm start
```

## Swift app cannot connect to backend

If the app logs a connection error for `http://127.0.0.1:3001`, the backend is not running or the port does not match.

Start the backend first:

```bash
npm start
```

Then run the app:

```bash
cd macos/JarvisApp
swift run
```

## Tests fail in CI but work locally

Check:

- Node version in GitHub Actions
- lockfile consistency
- whether a test assumes local-only permissions
- whether a test requires real API keys

The current CI should stay headless. It should not depend on microphone access, OCR permissions, Accessibility permissions, or AppleScript UI automation.

## App automation does not work

Check:

- macOS Accessibility permission
- Automation permission if prompted
- the correct app or terminal has permission
- the target app is installed
- the target app is focused or visible

Desktop automation is best-effort. UI changes, app updates, or focus state can affect results.

## Screen summarization does not work

Check:

- Screen Recording permission
- the correct app or terminal has permission
- visible text is actually on screen
- OCR can read the content
- the backend is running

Some apps, PDFs, images, or dark UI layouts may reduce OCR quality.

## Assistant cannot open an app

Check:

- app is installed
- app name is correct
- app has a standard macOS application name
- automation command can resolve the app

For example, "Chrome" may need to resolve to "Google Chrome."

## Memory does not return expected context

Check:

- local SQLite data exists
- `JARVIS_BASE_DIR` points to the expected runtime directory
- the item was actually stored
- retrieval query is close enough to the stored context
- duplicate or stale records are not confusing the result

Memory and retrieval are prototype-level and should become more transparent in future versions.

## LLM/API call fails

Check:

- `OPENAI_API_KEY`
- network connection
- API key permissions
- rate limits
- model/API availability
- `.env` formatting

Optional integrations such as weather or news may need their own keys if those workflows are enabled.

## Voice input does not work

Check:

- Microphone permission
- correct input device
- backend is running
- Swift app is running
- hotkey/listening state is active
- no TTS/self-listening loop is blocking input

## TTS does not work

Check:

- `OPENAI_API_KEY`
- `TTS_DISABLED` is not enabled
- `TTS_STUB` is not enabled unless testing
- system audio output is working
- backend logs for API errors

## OCR click or UI click fails

Check:

- Screen Recording permission
- Accessibility permission
- target text is visible
- target element is not hidden behind another window
- app/browser zoom level is reasonable

This is one of the more experimental parts of Jarvis and can vary by app or website.
