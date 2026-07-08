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
| `V1.2.0_STATUS.md` | **Volatile** dated snapshot: implemented / in progress / pending / needs-verification / documentation debt |
| `AI_WORKFLOWS.md` | Playbooks per task type + universal session rules |

### Existing project docs (shipped in the VSIX via `docs/**`)

| Document | Language | One-line purpose |
|---|---|---|
| `README.md` | EN | User-facing overview, features, install (partly one release behind — see status doc) |
| `CHANGELOG.md` | EN | Version history; `[1.2.0] – Unreleased` is the active section |
| `docs/ROADMAP_V1.2.0.md` | ES | v1.2.0 goals, per-area status table, delivery sequence, exit criteria |
| `docs/DEPENDENCY_GRAPH_XR.md` | EN | Dependency-graph XR mode: architecture, 23 languages, layouts, limits |
| `docs/HISTORICAL_COMPARISON_XR.md` | ES | Historical comparator: dual table, safe Git access, caching, limits |
| `docs/PROJECT_EVOLUTION_XR.md` | EN | Project Evolution "movie" mode (in progress; file currently untracked) |
| `docs/CLOUDFLARE_REMOTE_ACCESS.md` | ES | Quick Tunnel remote access: flow, limits, authorization layer |
| `docs/XR_DEBUG_COMMANDS.md` | EN | Browser-console debug APIs for generated XR scenes |
| `THIRD_PARTY_NOTICES.md` | EN | Third-party licenses; what is and isn't bundled |
| `templates/components/COMPONENTS.md` | EN | Inventory + load order of browser-side component runtimes |
| `test/README.md` | EN | Test suite layout and commands |
| `manual_test/README.md` | EN | Per-language fixtures for `npm run test:analysis` |

## Task → reading list

| Task | Read (in order) | Likely folders |
|---|---|---|
| **Any session (always)** | `CLAUDE.md` → this index | — |
| **New feature** | `ARCHITECTURE.md` → `V1.2.0_STATUS.md` → area doc(s) → `AI_WORKFLOWS.md` §feature | per module convention |
| **Bug fix** | `ARCHITECTURE.md` (module map) → `AI_WORKFLOWS.md` §bug fix; area doc if a contract seam is involved | the one module |
| **Refactor** | `ARCHITECTURE.md` (contracts!) → `AI_WORKFLOWS.md` §refactor | crossing modules |
| **XR visuals / scene / runtimes** | `XR_COMPONENTS.md` → `templates/components/COMPONENTS.md`; `docs/XR_DEBUG_COMMANDS.md` when debugging | `templates/`, `src/babia_templates/`, `engine/components/` |
| **Analysis / metrics / languages** | `PYTHON_ANALYSIS.md` → `ARCHITECTURE.md` §contracts | `src/code_analysis/python/`, `engine/`, `src/utils/languageMetadata.ts` |
| **Dependency graph** | `XR_COMPONENTS.md` → `docs/DEPENDENCY_GRAPH_XR.md` | `code_analysis/dependencies/`, graph runtime |
| **Historical / Project Evolution** | `V1.2.0_STATUS.md` → `docs/HISTORICAL_COMPARISON_XR.md` / `docs/PROJECT_EVOLUTION_XR.md` | `code_analysis/historical/` |
| **Servers / SSE / collaboration / remote** | `ARCHITECTURE.md` → `docs/CLOUDFLARE_REMOTE_ACCESS.md` for tunnels | `src/servers/`, `active_servers/`, `collaboration/`, `remote_access/` |
| **Build / test / tooling** | `DEVELOPMENT.md` | `scripts/`, configs |
| **Docs update** | `AI_WORKFLOWS.md` §docs → `V1.2.0_STATUS.md` §documentation debt | `docs/`, `.claude/docs/` |
| **Release preparation** | `V1.2.0_STATUS.md` (all) → `docs/ROADMAP_V1.2.0.md` → `AI_WORKFLOWS.md` §release → `DEVELOPMENT.md` §packaging | everything user-visible |

## Folders to avoid (context cost / generated)

| Path | Why |
|---|---|
| `node_modules/`, `dist/`, `out/`, `output/`, `artifacts/`, `.vscode-test/` | Generated / dependencies; never read or edit |
| `tsconfig.tsbuildinfo`, `package-lock.json` | Build cache / lockfile; huge, no signal |
| `resources/` (media), `examples/` | Binary/media assets; only relevant when explicitly working on them |
| `src/code_analysis/` *as a whole* | 246 files — enter via `ARCHITECTURE.md` module map, never scan |
| `package.json` *as a whole* | ~70 commands; grep the section you need |

## Keeping this index current

Adding a document? Add its row here and, if task-relevant, to the task table. Repurposing or superseding one? Update its one-liner. This index only works if it stays complete — treat an unlisted doc as a bug.
