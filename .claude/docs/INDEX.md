# Context Index — What to Read for Which Task

> **Purpose**: The navigation hub. Every session starts here (pointed from `CLAUDE.md`) and reads *only* the documents mapped to its task.
> **Stability**: Update whenever a document is added, removed, or repurposed.

## Document inventory

### Internal AI/dev context (`.claude/docs/` — never shipped in the VSIX)

| Document | One-line purpose |
|---|---|
| `INDEX.md` | This file — task → reading-list navigation |
| `ARCHITECTURE.md` | System pipeline, activation flow, module map, cross-module contracts |
| `DEVELOPMENT.md` | npm scripts, launch configs, test layers, packaging, tooling quirks |
| `PYTHON_ANALYSIS.md` | The Python metrics backend, venv, field-schema contract |
| `XR_COMPONENTS.md` | Scene generation, browser runtimes, table modes, chart system |
| `V1.2.1_STATUS.md` | **Volatile — the active status doc.** Cleanup backlog (ranked), baseline measurements, session log |
| `V1.2.0_STATUS.md` | Historical record of the closed 1.2.0 cycle (released 2026-07-30); source of carried-over debt. Do not rewrite |
| `AI_WORKFLOWS.md` | Playbooks per task type + universal session rules |

### Project skills (`.claude/skills/` — never shipped; invoked via the Skill tool or `/<name>`)

| Skill | One-line purpose |
|---|---|
| `verify` | Validation routing: narrowest test script per touched area → `npm test` gate → F5 flow |
| `session-close` | End-of-session checklist: status doc, CHANGELOG, doc sync, commit hygiene |
| `runtime-component` | Rules for `templates/components/` runtimes: injection paths, load order, tests |
| `add-language` | Language-support changes: Python contract ↔ TS metadata, fixtures, test matrix |
| `capture-media` | README/website screenshots driven from a real running analysis (`media/SHOTLIST.md`) |
| `cleanup` | **v1.2.1 default**: dead-code removal, file splits, lint tightening, size optimization — proof-before-delete + measurement ritual |

### Existing project docs (shipped in the VSIX via `docs/**`)

| Document | Language | One-line purpose |
|---|---|---|
| `README.md` | EN | User-facing overview, features, install (partly one release behind — see status doc) |
| `CHANGELOG.md` | EN | Version history; `[1.2.1] – Unreleased` is the active section (1.2.0 released 2026-07-30) |
| `docs/project/ROADMAP_V1.2.0.md` | ES | v1.2.0 goals, per-area status table, delivery sequence, exit criteria |
| `docs/features/DEPENDENCY_GRAPH_XR.md` | EN | Dependency-graph XR mode: architecture, 23 languages, layouts, limits |
| `docs/features/HISTORICAL_COMPARISON_XR.md` | ES | Historical comparator: dual table, safe Git access, caching, limits |
| `docs/features/PROJECT_EVOLUTION_XR.md` | EN | Project Evolution "movie" mode (in progress; file currently untracked) |
| `docs/features/CLOUDFLARE_REMOTE_ACCESS.md` | ES | Quick Tunnel remote access: flow, limits, authorization layer |
| `docs/xr-testing/XR_DEBUG_COMMANDS.md` | EN | Browser-console debug APIs for generated XR scenes |
| `THIRD_PARTY_NOTICES.md` | EN | Third-party licenses; what is and isn't bundled |
| `templates/components/COMPONENTS.md` | EN | Inventory + load order of browser-side component runtimes |
| `test/README.md` | EN | Test suite layout and commands |
| `manual_test/README.md` | EN | Per-language fixtures for `npm run test:analysis` |

## Task → reading list

| Task | Read (in order) | Likely folders |
|---|---|---|
| **Any session (always)** | `CLAUDE.md` → this index | — |
| **Cleanup / optimization (v1.2.1 default)** | `V1.2.1_STATUS.md` (backlog + baseline) → `cleanup` skill → `AI_WORKFLOWS.md` §cleanup | whatever the backlog item names |
| **New feature** | `ARCHITECTURE.md` → `V1.2.1_STATUS.md` → area doc(s) → `AI_WORKFLOWS.md` §feature. **Note: features are out of scope for 1.2.1** | per module convention |
| **Bug fix** | `ARCHITECTURE.md` (module map) → `AI_WORKFLOWS.md` §bug fix; area doc if a contract seam is involved | the one module |
| **Refactor** | `ARCHITECTURE.md` (contracts!) → `AI_WORKFLOWS.md` §refactor | crossing modules |
| **XR visuals / scene / runtimes** | `XR_COMPONENTS.md` → `templates/components/COMPONENTS.md`; `docs/xr-testing/XR_DEBUG_COMMANDS.md` when debugging | `templates/`, `src/babia_templates/`, `engine/components/` |
| **Analysis / metrics / languages** | `PYTHON_ANALYSIS.md` → `ARCHITECTURE.md` §contracts | `src/code_analysis/python/`, `engine/`, `src/utils/languageMetadata.ts` |
| **Dependency graph** | `XR_COMPONENTS.md` → `docs/features/DEPENDENCY_GRAPH_XR.md` | `code_analysis/dependencies/`, graph runtime |
| **Historical / Project Evolution** | `V1.2.0_STATUS.md` → `docs/features/HISTORICAL_COMPARISON_XR.md` / `docs/features/PROJECT_EVOLUTION_XR.md` | `code_analysis/historical/` |
| **Servers / SSE / collaboration / remote** | `ARCHITECTURE.md` → `docs/features/CLOUDFLARE_REMOTE_ACCESS.md` for tunnels | `src/servers/`, `active_servers/`, `collaboration/`, `remote_access/` |
| **Build / test / tooling** | `DEVELOPMENT.md` | `scripts/`, configs |
| **Docs update** | `AI_WORKFLOWS.md` §docs → `V1.2.1_STATUS.md` §carried-over debt → `V1.2.0_STATUS.md` §documentation debt | `docs/`, `.claude/docs/` |
| **Release preparation** | `V1.2.1_STATUS.md` (all) → `AI_WORKFLOWS.md` §release → `DEVELOPMENT.md` §packaging; `docs/project/ROADMAP_V1.2.0.md` only for historical exit criteria | everything user-visible |

## Folders to avoid (context cost / generated)

| Path | Why |
|---|---|
| `node_modules/`, `dist/`, `out/`, `output/`, `artifacts/`, `.vscode-test/` | Generated / dependencies; never read or edit |
| `tsconfig.tsbuildinfo`, `package-lock.json` | Build cache / lockfile; huge, no signal |
| `resources/` (media), `examples/` | Binary/media assets; only relevant when explicitly working on them |
| `src/code_analysis/` *as a whole* | 246 files — enter via `ARCHITECTURE.md` module map, never scan |
| `package.json` *as a whole* | ~70 commands; grep the section you need |

## Keeping this index current

Adding a document? Add its row here and, if task-relevant, to the task table. Repurposing or superseding one? Update its one-liner. This index only works if it stays complete — treat an unlisted doc as a bug. The same applies to skills: adding or repurposing a skill under `.claude/skills/` means updating the skills table above and the skills table in `CLAUDE.md`.
