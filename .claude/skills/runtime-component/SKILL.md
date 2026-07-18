---
name: runtime-component
description: Add or modify a browser-side runtime under templates/components/ (XR scene runtimes, LivePanel shared components) — injection path, load order, bundling, and the required tests. Use when touching any JS/CSS under templates/components/ or wiring a new component asset.
---

# Working on browser runtimes (`templates/components/`)

These files are injected into user-facing generated pages — treat them like shipping frontend code. TypeScript (extension host) and runtime JS (browser) **never share code**; the contract is injected globals, entity attributes, and JSON data files.

## Before writing code

1. Read `templates/components/COMPONENTS.md` — the authoritative inventory and **recommended load order**. Adding or reordering a runtime without updating it is a bug.
2. Read `.claude/docs/XR_COMPONENTS.md` for the generation pipeline (template → placeholder processing → runtime injection → per-session server).

## Two injection paths — know which one you're on

**XR scenes**: each runtime is inlined into generated HTML by a matching
`src/code_analysis/engine/components/customComponents/*ComponentAsset.ts`.
A new XR runtime needs: the JS under `templates/components/codexr/<component>/`, a component asset TS file that reads it, wiring where assets are injected, and a row in `COMPONENTS.md` at the right load position.

**LivePanel shared components**: files under `templates/components/livepanel/` are bundled by `LivePanelParser.processTemplateFiles` — shared JS is concatenated **ahead of** the template's own script into `main.js`, shared CSS ahead of the template stylesheet into `style.css`. No component-asset file involved. Anything you put there reaches every LivePanel template (file and directory) automatically.

## Constraints

- Generated pages are fully self-contained per analysis session — no new CDN/network dependencies without explicit user consent (project principle).
- Live reload arrives over SSE; LivePanel is single-user (no WebSocket client), XR collaboration uses the WebSocket room. Don't blur the two.
- Optional chaining, ternaries and regexes have been corrupted before by tooling stripping `?` characters (see V1.2.0_STATUS.md) — after bulk edits, sanity-check with `node --check <file>`.

## Tests (required, not optional)

- Every runtime has (or gets) a Node-runner test in `test/analysis/*.test.cjs` that executes the browser JS directly (`vm`-based DOM harness for LivePanel, direct execution for XR runtimes) — follow the pattern in `directoryLivePanelUi.test.cjs` or `codexrCommonRuntime.test.cjs`.
- Table/containment behavior: `npm run test:xr-harness` (Playwright). Project evolution: `npm run test:project-evolution-harness`.
- Finish with the `verify` skill flow (`npm test` + `npm run compile` + F5 when feasible).

## Never

- Edit anything under `dist/` (build-time copies of `templates/`).
- Ship debugging leftovers — this JS lands in every user's generated scene.
