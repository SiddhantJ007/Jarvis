# CI/CD

Jarvis is not deployed to a cloud host. There is no Vercel, Render, AWS, or production web deployment because the project is a local macOS assistant.

The CI pipeline exists to provide basic quality checks for the repository while respecting that the main product experience depends on a real Mac.

## Purpose

The current CI setup is intentionally lightweight. It is meant to answer a simple recruiter/engineering question: does the backend install, build, and pass its basic smoke checks from a clean environment?

## Current CI Scope

The workflow in `.github/workflows/node.yml` runs Node-only checks:

- install dependencies with `npm ci`
- compile the TypeScript backend
- run the backend smoke test
- verify Node/npm project health

This catches basic repository breakage without pretending CI can validate microphone, OCR, screen capture, or Accessibility behavior.

## What CI Proves

- the project installs correctly
- the TypeScript backend compiles
- the local API shape is still alive
- smoke-tested routes behave as expected
- basic regressions are caught before public review
- the repo is maintainable enough to run in a clean CI environment

## Why CI Is Limited

Jarvis depends on:

- local macOS permissions
- local app/window state
- microphone access
- screen recording access
- AppleScript/System Events
- active browser/application UI
- local SQLite state

Those are not generic cloud conditions. A cloud runner cannot honestly validate whether Jarvis can click a real button in a user's app, hear a real command from a microphone, or summarize a real screen with user-granted permission.

## Why There Is No Deployment Step

A cloud deployment would remove the main point of the project. Jarvis is meant to show AI connected to local desktop context, not a website pretending to be a desktop assistant.

The correct public format is:

- GitHub repo for code and documentation
- unlisted YouTube demo video for proof of the local workflow

## Why Swift/macOS UI CI Is Not Included

Swift compilation could potentially be attempted on a macOS GitHub Actions runner, but the highest-risk parts of Jarvis are not compile-only problems. They involve permissions, active applications, real screen state, and microphone input.

For now, Node-only CI gives a stable signal without adding fragile automation.

## Future CI Improvements

- pure-function tests for command routing
- agenda persistence tests
- memory retrieval tests
- text transformation tests
- mocked tool registry tests
- mock desktop automation adapters
- test coverage reporting
- static checks for documentation links and ignored files
- optional Swift compile check if it remains stable
- packaging checks if Jarvis becomes distributable
