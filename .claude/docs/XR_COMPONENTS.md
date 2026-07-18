# Code-XR XR / BabiaXR Layer

> **Purpose**: How XR scenes are generated, which browser-side runtimes exist, and where the feature-level docs live. Read before touching `templates/`, `src/babia_templates/`, or `engine/components/`.
> **Stability**: Stable — update when the scene-generation mechanism or the set of table modes changes.
> This file deliberately does **not** duplicate the deep feature docs in `docs/` — it summarizes and links.

## How a scene is generated

1. **Template HTML**: raw A-Frame scene templates live in `templates/xr/` (main: `templates/xr/file/xr-visualization.html`; DOM mode: `templates/xr/html/dom-visualization-template.html`). LivePanel webviews use `templates/analysis_livePanel/{file,directory}/`.
2. **Placeholder processing**: `src/babia_templates/processing/` (`templateProcessor.ts`, `templateHTMLProcessor.ts`, `placeholders/createChart.ts`, `placeholders/createStructure.ts`) fills templates with chart entities, data paths and dimension mappings.
3. **Runtime injection**: `src/code_analysis/engine/components/customComponents/*ComponentAsset.ts` read browser-side JS from `templates/components/**` and inline it into the generated HTML. The generated page is fully self-contained per analysis session. Large runtimes are **multi-part** (ordered part files under `codexr/<component>/<runtimeBase>/NN-<section>.js`, concatenated by `runtimeAssembly.ts` back into the flat output name — see "Multi-part runtimes" in `templates/components/COMPONENTS.md`; tests read them via `test/helpers/runtimeAssembly.cjs`).
4. **Serving + live reload**: the scene is served by a per-session local server; SSE client scripts (`templates/xr/sse/live_sse_fileXR.js`, `live_sse_fileDOM.js`, `templates/xr/html/htmlLiveReload.js`) reconnect to `SSEManager` so re-analysis refreshes data in place.

**Two worlds, one contract**: TypeScript (extension host) and the runtimes (browser JS, A-Frame components) never share code. The contract is the injected globals, entity attributes and JSON data files. `templates/components/COMPONENTS.md` is the authoritative inventory of runtimes and their **recommended load order** — read it before adding/reordering runtimes.

## Browser runtimes (`templates/components/`)

- `common/codexrCommonRuntime.js` — shared A-Frame helpers (entity creation, tooltips, text, model normalization). Added in v1.2.0; tested by `test/analysis/codexrCommonRuntime.test.cjs`.
- `common/codexrVisualStyleRuntime.js` — shared visual styling (v1.2.0 work in progress).
- `codexr/<component>/` — per-feature runtimes: analysis-table, chart containment, mapping UI, dependency-graph, historical-comparison, project-evolution, virtual-screen, collaboration, avatar, xr-room, render budget, debug, code-xr-boats.
- Runtime `.cjs` tests in `test/analysis/` exercise these browser runtimes directly with Node's test runner.

## The `codexr-analysis-table` modes

The analysis table is the central XR surface; the old "pedestal" was split into `codexr-analysis-table` + `codexr-chart-containment`. Modes:

| Mode | What it shows | Deep doc |
|---|---|---|
| `single` | One analysis (file/directory/project) as a BabiaXR chart on the table | — (default mode) |
| `historical-compare` | Side-by-side working copy vs branch/tag/commit, read-only Git access, `codexr-left:`/`codexr-right:` babia-boats ID isolation | `docs/HISTORICAL_COMPARISON_XR.md` (Spanish) |
| `dependency-graph` | CodeXR-owned 3D dependency graph: 23 languages, fanIn/fanOut/cycles, 3 layouts in a Web Worker, render budget (600 nodes / 2,000 edges) | `docs/DEPENDENCY_GRAPH_XR.md` (English) |
| `project-evolution` | Chronological "movie" of git history on one full-table chart with player controls (**in progress for v1.2.0**) | `docs/PROJECT_EVOLUTION_XR.md` (English) |

## Chart system

- **Registry**: `src/babia_templates/registry/chartRegistry.ts` (`BabiaChartRegistry` singleton) — chart types + dimension requirements (`models/chartModels.ts`: `ChartMetadata`, `DimensionMapping`).
- **Validation**: `processing/dimensionValidator.ts` validates mappings against the Python-derived field schema (see `PYTHON_ANALYSIS.md` → field-schema contract) before launch. The in-scene Mapping UI performs transactional mapping changes with safe recovery.
- **Default hierarchical chart is Babia Boats.** The custom `code-xr-boats` ("Code City") runtime is a **paused prototype, out of scope for v1.2.0** — preserved in `templates/components/codexr/code-xr-boats/` but not in the public chart selector (per roadmap and COMPONENTS.md; git history shows the Code City commit series was reverted).

## Debugging XR scenes

Browser-console APIs (`CodeXR.help()`, `CodeXRDebug`, `CodeXRChartDebug`, `CodeXRDependencyGraphRuntime`) are fully documented in `docs/XR_DEBUG_COMMANDS.md`. Manual browser harnesses live in `test/manual/` (`npm run test:xr-harness`, `npm run test:project-evolution-harness`).

## Collaboration & remote layer (summary only)

- Collaborative rooms: WebSocket signaling in `src/servers/runtime/collaboration/collaborationRoomServer.ts` + broadcast signaling for virtual screens; server-authoritative admin operations (host/guest roles, host transfer) — v1.2.0's "Collaboration 2.0".
- Cross-network access: opt-in Cloudflare Quick Tunnel per server (pinned `cloudflared`, token invites, pairing codes, revocation) — see `docs/CLOUDFLARE_REMOTE_ACCESS.md` (Spanish) for limits and the authorization flow.

## How future agents should use this document

- Changing a runtime under `templates/components/`? Update/re-run its `.test.cjs` in `test/analysis/`, respect the load order in `COMPONENTS.md`, and remember the change ships inside generated user-facing scenes.
- Adding a chart type? Start at `chartRegistry.ts`, then the dimension validator, then the placeholder processors — in that order.
- For feature-level behavior (graph layouts, comparator limits, evolution player), always defer to the linked `docs/*.md` file instead of re-deriving from code.
