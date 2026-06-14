# Memory and RAG

Jarvis uses memory so the assistant can become more personal over time instead of treating every command as a disconnected one-off request.

## Purpose

The goal of memory in Jarvis is practical continuity. A useful desktop assistant should remember the user's preferences, recurring tasks, working style, and relevant prior context when that information helps the current request.

This is not meant to replace user control. Memory should make Jarvis more helpful, but it should also be transparent, editable, and safe.

## Types Of Memory

Jarvis stores and works with several kinds of local context:

- user preferences
- daily agenda items
- prior message history
- action logs
- note/document embeddings
- message embeddings
- useful facts about user workflows

The current implementation uses local SQLite storage and embedding-backed recall hooks. This keeps the project local-first while still demonstrating the structure of a personalized assistant.

## Retrieval Flow

1. The user asks a question or gives a command.
2. Jarvis checks whether stored memory or recent context is relevant.
3. Relevant context can be included in the prompt or command-handling path.
4. Jarvis responds with more continuity instead of treating the request as isolated.
5. New useful context can be logged for future use.

## Why RAG

RAG lets Jarvis use stored context without relying only on the model's general knowledge or the current prompt. This matters because the assistant is supposed to understand the user's working world: their agenda, writing style, previous requests, and recurring workflows.

For a recruiter or engineer reviewing the project, this is one of the main applied AI ideas: the LLM is not the whole product. The product needs retrieval, state, tool routing, and guardrails around the model.

## Example Use Cases

- remembering a preferred writing style
- recalling ongoing agenda items
- continuing a previous discussion
- personalizing recommendations
- using prior context when rewriting text
- keeping track of repeated workflow feedback

## Memory Risks

Memory makes assistants more useful, but it also creates responsibility. The main risks are:

- storing sensitive information
- outdated preferences affecting new responses
- irrelevant retrieved context
- privacy concerns
- accidental over-personalization

This is why Jarvis is documented as a local-first prototype rather than a production assistant. Future versions should make memory visible and controllable.

## Future Improvements

- memory edit/delete UI
- memory confidence scores
- automatic memory expiration
- encrypted local memory
- clearer memory categories
- stronger retrieval ranking
- optional local-only model path
- dedicated vector database if the project grows beyond SQLite-backed embeddings
