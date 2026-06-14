# Automation Workflows

Jarvis is built around small local workflows rather than one giant "do everything" action. The assistant tries to understand the user's request, route it to the right local tool, and then return a useful result or a safe failure.

These workflows are prototype-level and best-effort. They depend on visible screen state, app behavior, and user-granted macOS permissions.

## Workflow 1: Open An Application

Goal: the user asks Jarvis to open a local app.

Flow:

1. Parse the intended application name.
2. Normalize common names, such as Chrome to Google Chrome.
3. Launch the app through the local action layer.
4. Update context so follow-up commands can refer to the active app.
5. Return only useful feedback, avoiding unnecessary success chatter.

Failure cases:

- app is not installed
- app name is ambiguous
- macOS refuses the action
- the app launches slowly or changes focus unexpectedly

## Workflow 2: Summarize Screen Text

Goal: the user asks Jarvis to summarize visible content.

Flow:

1. Capture or extract screen context with user-granted permission.
2. Run OCR or text extraction where available.
3. Clean noisy UI text where possible.
4. Send the relevant text to the summarization layer.
5. Return a concise summary that helps the user act on the content.

Failure cases:

- Screen Recording permission is missing
- the screen has no readable text
- OCR returns too much interface noise
- sensitive content is visible and should not be used casually

## Workflow 3: Writing Assistance

Goal: the user asks Jarvis to improve, rewrite, formalize, or summarize text.

Flow:

1. Understand the requested writing change.
2. Use selected text, visible screen text, clipboard text, or pasted text when available.
3. Send only the relevant content to the LLM.
4. Return a polished version or paste it back where supported.
5. Keep application-facing output clean, especially when the user wants copy-ready text.

Failure cases:

- no selected or visible text is available
- clipboard is empty
- the target app does not accept paste/typing automation
- the request is ambiguous about tone or output format

## Workflow 4: Task Tracking

Goal: the user asks Jarvis to remember, read, update, delete, or complete an agenda item.

Flow:

1. Parse the task intent.
2. Normalize task wording enough to prevent obvious duplicates.
3. Store or update the item in local SQLite state.
4. Retrieve agenda items later from the same local source.
5. Report the current list in a concise format.

Failure cases:

- duplicate wording is hard to detect
- the user gives multiple agenda changes in one sentence
- date/context is unclear
- local database state is unavailable

## Workflow 5: Agentic Multi-Step Task

Goal: the user gives a broader workflow that contains more than one action.

Flow:

1. Interpret the overall request.
2. Split it into smaller steps.
3. Execute each step independently.
4. Add a slight delay where UI state needs time to change.
5. Skip steps that cannot be completed instead of blocking the entire workflow.
6. Ask for confirmation when the next action is risky or ambiguous.
7. Report progress or failure in a short, useful way.

Example:

```text
Open Word, click blank document, paste the clipboard text, then summarize it.
```

Jarvis should treat this as separate actions:

1. Open Word.
2. Click Blank Document.
3. Paste clipboard text.
4. Summarize available text if the context exists.

This area is still experimental. The goal is to move toward a stronger planner/executor loop while keeping each tool safe, testable, and understandable.

## Design Principle

The important idea is not that Jarvis can automate every application perfectly. The important idea is that natural language gets translated into local, explicit, inspectable actions. That keeps the assistant useful while making the limits clear.
