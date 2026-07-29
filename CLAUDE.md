# CLAUDE.md — Code-XR Operating Guide

## What this project is

**CodeXR** (`code-xr`, published by `aMonteSl`, GPL-3.0) is a VS Code extension that analyzes source code and visualizes the metrics in extended reality. The pipeline: a **Python backend** (Lizard metrics, ~23 languages, run in a venv the extension manages) produces JSON → **BabiaXR/A-Frame templates** turn it into an XR scene → **local HTTP/HTTPS servers with SSE live-reload** serve it to a browser or headset. Three analysis modes share the pipeline: XR scene, LivePanel (2D webview), and DOM visualization. It also offers collaborative XR sessions and opt-in cross-network sharing via Cloudflare tunnels.

Current work: **v1.2.0** (branch `v1.2.0`, with larger features on `feature/*` branches off it; `master` is the PR target). The volatile state of the version lives in `.claude/docs/V1.2.0_STATUS.md` — read it, don't re-derive it from git.

## Context system — read this first

**Start every session at `.claude/docs/INDEX.md`** and read only the documents mapped to your task type. The knowledge base:

| Doc | Content |
|---|---|
| `.claude/docs/INDEX.md` | Task → reading-list navigation; folders to avoid |
| `.claude/docs/ARCHITECTURE.md` | Pipeline, activation flow, module map, cross-module contracts |
| `.claude/docs/DEVELOPMENT.md` | Scripts, launch configs, test layers, packaging |
| `.claude/docs/PYTHON_ANALYSIS.md` | Python backend + field-schema contract |
| `.claude/docs/XR_COMPONENTS.md` | Scene generation, browser runtimes, chart system |
| `.claude/docs/V1.2.0_STATUS.md` | Dated snapshot: done / in progress / pending / needs verification |
| `.claude/docs/AI_WORKFLOWS.md` | Playbooks: feature, bug fix, refactor, docs, release prep |

## Development commands

| Command | Purpose |
|---|---|
| `npm run compile` / `npm run watch` | webpack build → `dist/` (also copies Python backend, `templates/`, `examples/`) |
| `npm run typecheck` / `npm run lint` | tsc --noEmit / ESLint over `src/` |
| `npm test` | **Default gate**: typecheck + lint + compile-tests + unit tests |
| `npm run test:unit` | Node native runner over `test/**/*.test.cjs` (not Mocha) |
| `npm run test:python` / `test:analysis` / `test:all` | Python suites / per-language end-to-end metrics / everything |
| `npm run package:vsix` | Build the installable `.vsix` |
| F5 "Run CodeXR Extension" | Isolated Extension Development Host (staged under `.vscode-test/dev-extension`) |

Full matrix and manual-validation flow: `.claude/docs/DEVELOPMENT.md`.

## Project skills (`.claude/skills/`)

| Skill | Use when |
|---|---|
| `verify` | Before declaring any change done — routes to the narrowest test script, then the `npm test` gate, then the F5 flow |
| `session-close` | Ending a session — status doc + CHANGELOG + doc sync + commit hygiene checklist |
| `runtime-component` | Touching JS/CSS under `templates/components/` — injection paths, load order, required tests |
| `add-language` | Language-support changes — Python contract ↔ TS metadata sync, fixtures, test matrix |
| `capture-media` | Producing README/website screenshots — drives a real running analysis with Playwright and reviews every shot (list in `media/SHOTLIST.md`) |

## AI workflow rules

1. **One feature, bug, or refactor per session.** Finish and validate before starting the next.
2. Run `npm test` (plus the narrowest specialized script for the touched area) before declaring anything done. Never claim behavior works without a test run or the F5 flow.
3. Work on `v1.2.0` or a `feature/*` branch off it; never commit directly to `master`.
4. Label claims: confirmed / self-assessed (docs claim it) / inferred / open question. Docs' status labels ("Implementado") are self-assessments, not verified facts.
5. When you change the version state (feature lands, verification resolved), **update `.claude/docs/V1.2.0_STATUS.md` and the CHANGELOG "[1.2.0] – Unreleased" section in the same session**. Architecture changed → `ARCHITECTURE.md`; tooling changed → `DEVELOPMENT.md`; doc added → `INDEX.md`.

## Safety rules

- **Never edit**: `dist/`, `out/`, `output/`, `artifacts/`, `.vscode-test/`, `node_modules/`, `tsconfig.tsbuildinfo`. (`dist/` contains copies of the Python backend and templates — the sources are `src/code_analysis/python/` and `templates/`.)
- **`docs/**`, `templates/**`, `examples/**` ship inside the VSIX** (package.json `files` allowlist; there is no `.vscodeignore`). `.claude/**` does not ship. Think before adding files to shipped folders.
- Command IDs must be unique — `assertUniqueCommandIds` in `src/commands/index.ts` throws on duplicates.
- JS under `templates/components/` is injected into user-facing generated scenes; treat changes there like shipping frontend code (and respect the load order in `templates/components/COMPONENTS.md`).
- Project principles (roadmap exit criteria): no telemetry, no network calls or downloads without explicit user consent, server-validated admin operations.
- Don't delete or rewrite existing docs; record inconsistencies in `.claude/docs/V1.2.0_STATUS.md` → "Documentation debt" instead.

## Context management

- Never scan `node_modules/`, `dist/`, `out/`, `output/`, `artifacts/`, `.vscode-test/`, `package-lock.json`.
- `src/code_analysis/` is 246 files and `package.json` is ~1,000 lines — navigate via the module map in `ARCHITECTURE.md` and targeted Grep, never wholesale reads.
- Long-form knowledge lives in `.claude/docs/`, decisions live in the repo (status doc, CHANGELOG) — not in chat history. If you learn something durable, write it into the right doc before the session ends.
