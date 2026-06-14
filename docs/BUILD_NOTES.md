# Build Notes

## Motivation

Jarvis started as an exploration of what a deeply personalized AI assistant could look like on a Mac.

The idea was not just to build a chatbot with a nice name. I wanted to see what happens when an assistant can listen, remember, read local context, help with writing, and trigger real desktop actions with permission.

## Starting Point

The project began with a simple belief: a useful assistant should not only answer questions. It should understand context, remember preferences, and help execute tasks.

That pushed the project toward a local-first architecture. If Jarvis was going to help with documents, visible screen text, app launching, dictation, agenda tracking, and desktop actions, it had to live close to the operating system.

## What I Built

- conversational assistant
- voice input and spoken output
- local memory and personalization layer
- RAG-style contextual recall hooks
- daily agenda/task tracking
- screen-aware summarization
- selected/visible text rewriting
- dictation mode
- app launching and closing
- local automation workflows
- clipboard operations
- weather, time, news, jokes, and facts
- macOS HUD interface
- minimal backend tests and GitHub Actions CI

## AI Assistance Disclosure

AI tools were used throughout the process to accelerate development, debugging, testing, documentation, and iteration.

The important part is that AI was not used as a replacement for ownership. I used it as a build partner while I made the product decisions: what Jarvis should do, how it should behave, when it should stay quiet, what should be local-first, what should be documented as a limitation, and what should be deferred for safety.

## Engineering Ownership

My role was to drive the project from concept to working prototype:

- defined the assistant behavior and product direction
- broke the system into voice, backend, memory, OCR, tools, and UI layers
- integrated local macOS capabilities
- tested workflows manually across real apps
- reviewed and refined generated code
- tuned prompts, responses, and assistant tone
- added deterministic fallbacks where rules were safer than LLM interpretation
- added CI checks for the backend path
- documented architecture, security, permissions, limitations, and roadmap

The project changed constantly through testing. When something felt wrong, such as noisy acknowledgements, weak app control, broken agenda memory, or unsafe-looking error messages, I treated that as product feedback and adjusted the system.

## Challenges

- local permission handling
- screen/context access
- OCR noise and UI text extraction
- desktop automation reliability
- browser/app interaction differences
- memory design and duplicate agenda handling
- voice self-listening and accidental noise inputs
- testing OS-level behavior honestly
- balancing ambition with a showcase-ready scope
- keeping documentation honest without underselling the project

## What I Learned

- local assistants are fundamentally different from web apps
- permission boundaries are not just technical setup; they are part of the product design
- useful AI systems need orchestration, not only prompts
- deterministic tools still matter when actions need reliability
- memory makes an assistant more personal, but also creates privacy responsibilities
- desktop automation is powerful but fragile
- manual QA matters when the product depends on real screen and app state
- documentation can show engineering maturity as much as code can

## Build Philosophy

My goal was to make Jarvis feel like a serious assistant prototype: ambitious, but not fake.

That meant saying no to a public cloud deployment, keeping local permissions explicit, adding a demo video instead of pretending the project can run in the browser, and documenting what still needs to improve.
