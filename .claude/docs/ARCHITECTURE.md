# Code-XR Architecture

> **Purpose**: High-level system architecture for AI agents and developers. Read this before touching anything under `src/`.
> **Stability**: Stable — update only when the architecture itself changes (new module, changed data flow), not for feature-level changes.
> Facts here were verified against the code on 2026-07-08. Items marked *[inferred]* are conclusions from structure/naming, not verified line-by-line.

## The one-paragraph summary

CodeXR is a VS Code extension (~337 TS files) that analyzes source code with a **Python backend** (Lizard metrics, run in a managed virtual environment) and renders the results as **BabiaXR/A-Frame XR scenes** served by **local HTTP/HTTPS servers** with **SSE live-reload**. The extension side is TypeScript; the in-scene runtime is plain JavaScript living in `templates/components/` and injected into generated HTML.

## Main data flow (the pipeline)

```
User command (context menu / tree / palette)
  └─> src/code_analysis/commands/...            (per-mode command handlers)
      └─> engine/launchers/launcherXRAnalysis.ts | launcherLivePanel.ts | launcherVisualizeDOM.ts
          └─> engine/launchers/launchPipeline.ts  → creates a UnifiedAnalysisSession
              ├─> engine/utils/executePython.ts   → spawns managed venv, runs python/main.py → JSON metrics
              ├─> src/babia_templates/            → validates dimension mapping, fills HTML template
              │     (chart registry + placeholder processing over templates/xr/...)
              ├─> engine/components/customComponents/*ComponentAsset.ts
              │     → inlines browser runtimes from templates/components/**/*.js into the HTML
              └─> engine/servers/serverLaunchOrchestrator.ts (+ sessionServerManager)
                    └─> src/servers/runtime (HTTP/HTTPS) serves the scene
                        └─> registered in src/active_servers → shown in sidebar tree
Live updates: engine/watchers/* detect file changes → re-run Python →
  engine/servers/sseNotificationManager.ts → src/servers/runtime/sse/SSEManager.ts → browser reloads data
```

Three analysis modes share this pipeline: **XR** (A-Frame scene in browser/headset), **LivePanel** (2D webview panel), **DOM visualization** (HTML DOM structure in XR). Each mode has its own launcher, parser (`engine/parsers/`), and requirement rules (`engine/processors/requirementRules/`) that decide which artifacts must be generated.

## Activation flow (`src/extension.ts`)

1. `initializeExtensionContext` + `CodeXRLogger.initialize` (`src/core/`).
2. Singletons initialized: `AnalysisConfigurationStorage`, `CollaborationProfileManager`, `RemoteAccessManager`, `ServerSettingsManager`, `getActiveServerRegistry()`, `ServerControl`.
3. `ModularTreeDataProvider` (`src/views/ModularTreeDataProvider.ts`) registered as the single tree view `codexrTree` (one activity-bar container hosts all sections: servers, active servers, examples, visualize data, analyses, python env, visualization settings, learn more). **Collaboration is not a root section**: `CollaborationSectionProvider` is mounted by `ActiveServersSectionProvider` as the nested `COLLABORATION` group (item type `collaboration-group`), so its items — including `Join Remote Session` — render inside `ACTIVE SERVERS`.
4. `registerAllCommands` (`src/commands/index.ts`) merges command arrays from every feature module and registers them via `CommandBuilder.registerAll`. **`assertUniqueCommandIds` throws on duplicate command IDs** — keep this in mind when adding commands.
5. `StartupCoordinator` (`src/core/startup/startupCoordinator.ts`, max 3 concurrent) defers heavy work: restore server settings + ensure HTTPS cert pair, init `ServerWatcherIntegration`, init Python env + prefetch XR field schema, clean stale analysis artifacts.

`deactivate()` tears down remote access, the active-server registry, the SSE manager + `fileToServerMap`, and the tree provider.

`activationEvents` in package.json is empty — activation is driven by contributed commands/views.

## Module map (`src/`)

| Module | Responsibility | Key files |
|---|---|---|
| `code_analysis/` | **The core (246 files).** Analysis engine, sessions, watchers, Python backend, dependency + historical analysis | `engine/launchers/launcherXRAnalysis.ts`, `engine/core/analysisSession.ts`, `engine/orchestrator` → `analysisOrchestrator.ts` |
| `code_analysis/engine/` | Pipeline: launchers, parsers, processors/requirement rules, session servers, watchers, component-asset injection | `launchPipeline.ts`, `servers/sessionServerManager.ts`, `watchers/sessionWatcherManager.ts`, `utils/executePython.ts` |
| `code_analysis/python/` | Python analysis backend (see `PYTHON_ANALYSIS.md`) | `main.py`, `tools/lizard_analyzer.py`, `utils/xr_field_schema.py` |
| `code_analysis/dependencies/` | Dependency-graph analysis service (see `docs/DEPENDENCY_GRAPH_XR.md`) | `DependencyGraphService` *[inferred name from docs]* |
| `code_analysis/historical/` | Git history: comparator + Project Evolution | `gitRepositoryService.ts`, `historicalComparisonService.ts`, `projectEvolutionService.ts` |
| `code_analysis/services/` | Cross-cutting services | `xrFieldSchemaService.ts`, `workspaceSnapshotService.ts`, `serverWatcherIntegration.ts` |
| `babia_templates/` | Chart template system: registry, models, dimension validation, HTML placeholder processing | `registry/chartRegistry.ts`, `processing/dimensionValidator.ts`, `processing/templateHTMLProcessor.ts` |
| `babia_examples/` | Bundled BabiaXR demo examples (tree section + launcher) | `runtime/exampleLauncher.ts` |
| `servers/` | Server **infrastructure**: HTTP/HTTPS, ports, self-signed certs, SSE, collaboration/broadcast signaling | `runtime/httpServer.ts`, `runtime/sse/SSEManager.ts`, `runtime/collaboration/collaborationRoomServer.ts` |
| `active_servers/` | Registry + lifecycle of **running** server instances (tree section, stop/open/copy-URL actions) | `registry/activeServerRegistry.ts`, `runtime/serverControl.ts` |
| `views/` | The unified sidebar tree: one provider delegating to per-section providers | `ModularTreeDataProvider.ts`, `*/items/`, `*/interactions/` |
| `commands/` | Central command registration aggregator | `index.ts` (`registerAllCommands`, `assertUniqueCommandIds`) |
| `collaboration/` | Identity/profiles for collaborative sessions (names, avatars) | `CollaborationProfileManager` |
| `remote_access/` | Cross-network sharing via pinned `cloudflared` Quick Tunnel | `cloudflaredBinaryManager`, `remoteAccessManager`, `remoteSessionAuthority` |
| `python_env/` | Managed Python virtual environment (create/verify/reinstall + UI state) | `runtime/venvManager.ts` |
| `visualize_data/` | User-driven "visualize your own JSON" flow | commands + launcher |
| `visualization_settings/` | Visualization settings (colors, chart config) + color picker | storage + model |
| `core/` | Extension context, logging, startup coordination | `extensionContext.ts`, `logging/logger.ts`, `startup/startupCoordinator.ts` |
| `learn_more/` | "Learn more" help section in the tree | commands + views |
| `utils/` | Shared helpers | `languageMetadata.ts`, `fileToServerMap.ts`, `commandBuilder.ts`, `errorHandler.ts`, `nonceGenerator.ts` |

**Per-feature layout convention** (followed by most modules): `commands/` + `model(s)/` + `runtime/` or `services/` + `views/{items,interactions}` + `registry|storage|state/`. When adding a feature, mirror this pattern.

Note: there is some historical duplication — e.g. `active_servers/views/` **and** `views/active_servers/`. The `src/views/` tree and `src/commands/index.ts` are the current *aggregation points*; per-module `views/`/`commands/` folders are the feature implementations they pull from. *[inferred from import wiring]*

## Cross-module contracts (the seams that matter)

1. **XR field schema**: Python defines analyzable fields in `code_analysis/python/utils/xr_field_schema.py`; TypeScript consumes it via `code_analysis/services/xrFieldSchemaService.ts` (backed by `main.py --mode schema`). Dimension-mapping validation in `babia_templates/processing/dimensionValidator.ts` checks user mappings against this schema. **Changing metrics on the Python side requires keeping this schema in sync.**
2. **Chart registry**: `babia_templates/registry/chartRegistry.ts` (`BabiaChartRegistry` singleton) is the source of truth for available chart types and their dimension requirements.
3. **File ↔ server mapping**: `src/utils/fileToServerMap.ts` links analyzed files to the server instance serving their visualization; SSE clients are keyed by file URI in `SSEManager`.
4. **Component-asset injection**: TS files in `code_analysis/engine/components/customComponents/*ComponentAsset.ts` read runtime JS from `templates/components/` and inline it into generated HTML. The browser runtimes never import TS code; the contract is the injected globals and entity schemas (see `templates/components/COMPONENTS.md`).
5. **Command registration**: every module exports a command-registration array consumed by `src/commands/index.ts`. Command IDs use prefixes `codeXR.*` / `codexr.*` (both exist — check before adding).

## Repo-root layers (outside `src/`)

| Path | What it is |
|---|---|
| `templates/` | Raw HTML templates + **browser-side JS runtimes**. `xr/` (scene templates + SSE client scripts), `analysis_livePanel/` (webview panels), `components/` (A-Frame component runtimes — see `templates/components/COMPONENTS.md`; `components/livepanel/` holds shared 2D LivePanel components such as `dataTable.{js,css}` that `LivePanelParser` bundles ahead of each panel's own `main.js`/`style.css`), `utils/color-picker.html`. Copied into `dist/templates` at build. |
| `test/` | All tests. `.test.cjs` unit suites (Node native runner), Python suites, language fixtures, manual HTML harnesses. See `DEVELOPMENT.md`. |
| `resources/` | Icons and media (per-language icons, collaboration/comparison/screen assets). |
| `examples/` | Bundled sample charts + data for the Babia Examples tree section. |
| `scripts/` | Build utilities: `package-vsix.mjs`, `prepare-dev-extension.mjs`, `report-manual-metrics.py`. |
| `docs/` | Human-facing feature docs (**shipped in the VSIX** via package.json `files`). |
| `manual_test/` | Per-language fixtures for `npm run test:analysis` (see its README). |
| `pages/` | GitHub Pages redirect page (deployed by the only CI workflow). |

## How future agents should use this document

- Use the module map to jump straight to the right folder instead of scanning `src/` (`code_analysis/` alone is 246 files).
- Use the "cross-module contracts" section to know what else must change when you touch a seam (especially Python metrics ↔ field schema ↔ dimension validation).
- For feature-specific depth (dependency graph, historical comparison, project evolution, remote access), read the existing docs in `docs/` — this file deliberately does not duplicate them. See `INDEX.md` for the task → docs mapping.
