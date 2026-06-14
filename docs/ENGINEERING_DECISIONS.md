# Engineering Decisions

This project was not built as a normal chatbot wrapper. I treated Jarvis as an assistant system: voice input, local state, memory, OCR, LLM reasoning, deterministic tools, desktop permissions, and a user experience that had to feel useful instead of noisy.

These decisions explain how I thought through the project and what tradeoffs I accepted while building it.

## Decision 1: Build Jarvis As A Local-First Assistant

Problem:

The assistant needed access to screen context, local apps, microphone input, and personal workflows.

Decision:

I built Jarvis as a local macOS assistant instead of a hosted web app.

Reason:

A hosted web app cannot safely or meaningfully access local desktop context. It cannot see the user's active document, interact with local applications, respond to macOS permissions, or behave like an operating-system-level assistant.

Tradeoff:

The project is harder to demo publicly. It depends on a real Mac, local setup, API keys, and user-granted permissions.

Outcome:

The project demonstrates the thing I actually wanted to prove: desktop AI automation and personalized assistant design, not just another chat UI.

## Decision 2: Use User-Granted macOS Permissions Instead Of Bypassing OS Controls

Problem:

Jarvis needed capabilities such as microphone input, screen reading, and UI automation, all of which are sensitive.

Decision:

I kept those features behind normal macOS permission boundaries: Microphone, Screen Recording, Accessibility, and Automation.

Reason:

For a project like this, permission boundaries are part of the design. If an assistant can read the screen or click around the desktop, the user should explicitly grant that access.

Tradeoff:

Some workflows are harder to set up and can fail if permissions are missing or granted to the wrong app/terminal.

Outcome:

Jarvis is safer and more honest as a prototype. It demonstrates desktop capability while respecting the operating system's consent model.

## Decision 3: Combine LLM Reasoning With Deterministic Tools

Problem:

Natural language is messy, but desktop actions need precision. An LLM can understand intent, but it should not directly control the computer.

Decision:

I used the LLM for reasoning, summarization, rewriting, and conversation, while keeping actions inside explicit local tool paths.

Reason:

This separates interpretation from execution. The assistant can understand a user command like "open Chrome" or "make this more formal," but the actual operation is handled by deterministic code.

Tradeoff:

The system requires more orchestration than a simple prompt-based app.

Outcome:

Jarvis became closer to an assistant architecture: model + router + memory + tools + safety boundaries.

## Decision 4: Support Memory/RAG For Personalization

Problem:

Most assistants feel stateless. They answer the current question but forget the user's preferences, tasks, and working context.

Decision:

I added local storage and embedding-backed recall hooks so Jarvis could begin supporting memory and contextual retrieval.

Reason:

Personalization is central to the idea of Jarvis. If the assistant cannot remember anything useful, it stays generic.

Tradeoff:

Memory creates privacy and correctness risks. Stored context can become outdated, irrelevant, or sensitive.

Outcome:

The project shows applied AI architecture beyond one-shot prompting, while still documenting memory as an area that needs stronger controls before production use.

## Decision 5: Use A Demo Video Instead Of Live Deployment

Problem:

Recruiters and reviewers need to see the project working, but Jarvis cannot be meaningfully deployed like a web app.

Decision:

I use an unlisted demo video as the main proof of functionality.

Reason:

Jarvis depends on local screen state, microphone input, and macOS permissions. A hosted demo would remove the core behavior and misrepresent the project.

Tradeoff:

The evaluator cannot simply click a public URL and use the assistant.

Outcome:

The repo stays honest: GitHub for code and architecture, video for the local assistant experience.

## Decision 6: Add Minimal CI Despite Local Automation Limits

Problem:

The most interesting parts of Jarvis are local and permission-gated, which makes full cloud CI unrealistic.

Decision:

I added lightweight Node/TypeScript CI for install, build, and smoke testing.

Reason:

Even if CI cannot validate microphone input or Accessibility automation, it can still catch basic backend regressions and prove the repo is maintainable.

Tradeoff:

The CI is intentionally limited and does not pretend to test the entire product.

Outcome:

Jarvis gets a stable quality layer without fragile fake desktop automation.

## Decision 7: Treat Risky Automation As Future Work Requiring Confirmation Layers

Problem:

An assistant that can act on a desktop could eventually do risky things: delete files, send messages, modify settings, or run commands.

Decision:

I kept the current automation scope limited and documented stronger confirmation layers as future work.

Reason:

Assistant autonomy should grow with safety. Useful automation is good; silent risky automation is not.

Tradeoff:

Some ambitious workflows remain prototype-level.

Outcome:

The project shows the direction clearly while avoiding overclaiming production-grade agent behavior.

## Decision 8: Keep Jarvis As A Prototype Rather Than Overclaiming Production Readiness

Problem:

Jarvis demonstrates many capabilities, but desktop assistants are hard to make reliable across every app, website, and permission state.

Decision:

I describe Jarvis as a working local prototype, not a production consumer app.

Reason:

That is the honest engineering position. The system proves architecture, workflow thinking, and implementation ability, but it is not security-audited or packaged for public installation.

Tradeoff:

The wording is less flashy than claiming it is a finished personal assistant.

Outcome:

The project becomes more credible. It shows ambition with engineering maturity.

## Decision 9: Keep Successful Actions Quiet

Problem:

Early versions of Jarvis responded too much after every action. That made it feel more like a chatbot narrating itself than an assistant helping in the background.

Decision:

I moved toward quieter success behavior and simpler error responses.

Reason:

A real assistant should not interrupt the user after every successful click, paste, or app launch. It should speak when the user needs information or when something goes wrong.

Tradeoff:

Some actions are less visibly confirmed in the chat history.

Outcome:

The experience became closer to an ambient assistant rather than a noisy command logger.

## Decision 10: Use A HUD Instead Of Treating The Chat Window As The Product

Problem:

The project started with visible text input/output, but the long-term goal was a desktop assistant, not a chat application.

Decision:

I added a small macOS HUD overlay that shows states such as idle, listening, and speaking.

Reason:

The HUD makes Jarvis feel more present on the desktop while keeping the user's main workflow in focus.

Tradeoff:

The HUD adds another UI layer to maintain and tune.

Outcome:

Jarvis moved closer to the product experience I wanted: an assistant sitting beside the user, not a website or chat window.

## Decision 11: Document Limitations Instead Of Hiding Them

Problem:

AI assistant projects can look stronger than they are if the hard parts are hidden.

Decision:

I documented permissions, security boundaries, testing limits, automation fragility, and future work clearly.

Reason:

Good engineering includes knowing what the system does not do yet.

Tradeoff:

The documentation exposes prototype limits.

Outcome:

The repo becomes more trustworthy and interview-ready. It shows I can build, evaluate, and communicate tradeoffs.
