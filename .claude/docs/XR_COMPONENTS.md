# Code-XR XR / BabiaXR Layer

> **Purpose**: How XR scenes are generated, which browser-side runtimes exist, and where the feature-level docs live. Read before touching `templates/`, `src/babia_templates/`, or `engine/components/`.
> **Stability**: Stable — update when the scene-generation mechanism or the set of table modes changes.
> This file deliberately does **not** duplicate the deep feature docs in `docs/` — it summarizes and links.

## How a scene is generated

1. **Template HTML**: raw A-Frame scene templates live in `templates/xr/` (main: `templates/xr/file/xr-visualization.html`; DOM mode: `templates/xr/html/dom-visualization-template.html`). LivePanel webviews use `templates/analysis_livePanel/{file,directory}/`.
2. **Placeholder processing**: `src/babia_templates/processing/` (`templateProcessor.ts`, `templateHTMLProcessor.ts`, `placeholders/createChart.ts`, `placeholders/createStructure.ts`) fills templates with chart entities, data paths and dimension mappings.
3. **Runtime injection**: `src/code_analysis/engine/components/customComponents/*ComponentAsset.ts` read browser-side JS from `templates/components/**` and inline it into the generated HTML. The generated page is fully self-contained per analysis session. Large runtimes are **multi-part** (focused module files under `codexr/<component>/<runtimeBase>/`, order declared in that directory's `manifest.json`, concatenated by `runtimeAssembly.ts` back into the flat output name — see "Multi-part runtimes" in `templates/components/COMPONENTS.md`; tests read them via `test/helpers/runtimeAssembly.cjs`).
4. **Serving + live reload**: the scene is served by a per-session local server; SSE client scripts (`templates/xr/sse/live_sse_fileXR.js`, `live_sse_fileDOM.js`, `templates/xr/html/htmlLiveReload.js`) reconnect to `SSEManager` so re-analysis refreshes data in place.

**Two worlds, one contract**: TypeScript (extension host) and the runtimes (browser JS, A-Frame components) never share code. The contract is the injected globals, entity attributes and JSON data files. `templates/components/COMPONENTS.md` is the authoritative inventory of runtimes and their **recommended load order** — read it before adding/reordering runtimes.

## Browser runtimes (`templates/components/`)

- `common/codexrCommonRuntime.js` — shared A-Frame helpers (entity creation, tooltips, text, model normalization). Added in v1.2.0; tested by `test/analysis/codexrCommonRuntime.test.cjs`.
- `common/codexrVisualStyleRuntime.js` — shared visual styling (v1.2.0 work in progress).
- `codexr/<component>/` — per-feature runtimes: pointer-policy (single-active-pointer arbitration: mouse / gaze / laser, following the last-used controller), immersive-rig (turns `movement-controls` fly on for any immersive session, recenters the rig next to the pedestal in AR only, and on a REAL WebXR session — `sceneEl.xrSession` set, unlike the simulate commands — drops the rig to y=0 so the device's `local-floor` pose supplies the height instead of stacking on the rig's desktop offset; eye height otherwise lives on the rig position in the scene template), analysis-table, chart containment, mapping UI, dependency-graph, historical-comparison, project-evolution, virtual-screen, collaboration, avatar, xr-room, render budget, debug. VR/AR locomotion is deliberately NOT a CodeXR component: it is native aframe-extras `movement-controls`/`gamepad-controls` (left stick moves, right stick turns), which requires `gamepad` to stay in the default `controls` list.
- Runtime `.cjs` tests in `test/analysis/` exercise these browser runtimes directly with Node's test runner.

## The `codexr-analysis-table` modes

The analysis table is the central XR surface; the old "pedestal" was split into `codexr-analysis-table` + `codexr-chart-containment`. Modes:

| Mode | What it shows | Deep doc |
|---|---|---|
| `single` | One analysis (file/directory/project) as a BabiaXR chart on the table | — (default mode) |
| `historical-compare` | Side-by-side working copy vs branch/tag/commit, read-only Git access, `codexr-left:`/`codexr-right:` babia-boats ID isolation | `docs/features/HISTORICAL_COMPARISON_XR.md` (Spanish) |
| `dependency-graph` | CodeXR-owned 3D dependency graph: 23 languages, fanIn/fanOut/cycles, 3 layouts in a Web Worker, render budget (600 nodes / 2,000 edges) | `docs/features/DEPENDENCY_GRAPH_XR.md` (English) |
| `project-evolution` | Chronological "movie" of git history on one full-table chart with player controls (**in progress for v1.2.0**) | `docs/features/PROJECT_EVOLUTION_XR.md` (English) |

## Chart system

- **Registry**: `src/babia_templates/registry/chartRegistry.ts` (`BabiaChartRegistry` singleton) — chart types + dimension requirements (`models/chartModels.ts`: `ChartMetadata`, `DimensionMapping`).
- **Presentation contract**: `src/babia_templates/charts/chartPresentation.ts` (`CHART_PRESENTATION_PROFILES`) is the single source for how every chart presents on the table — entity rotation (pie/donut stand at `90 0 0`, Babia's own convention), containment fit strategy (`uniform` / `planar-uniform` / per-axis), base component attributes beyond the mapped fields (bubbles' `heightMax`/`radiusMax`, cyls' `radiusMax`, boats' full base), row budget + ranking dimension for the top-N data slice, the Babia element-key dimensions (duplicate keys collapse elements, so slices de-duplicate), and `surfaceLift` (clearance above the anchor plane — it sits at the tabletop slab, ~1.7 cm under the visible glass, which slices round-bottomed geometry; note the anchor's ~1.5 cm anti-jitter deadband swallows smaller lifts). Templates are BUILT from it (`buildChartEntityHtml` in `templateCharts.ts`), the scene injects it as JSON (`#codexr-chart-base-config`, `createStructure.ts`), and the mapping runtime keeps a fallback mirror — same pattern that already protected babia-boats.
- **Rotation has exactly one owner: the presentation profile.** Anywhere a babia chart component is attached to an entity, the entity's `rotation` must be (re)derived from `getChartPresentation(chartId).rotation` — never inherited, never left over. Three builders learned this the hard way and now follow it: the live switch (`applyChartTypeToEntity`), the evolution movie (`buildEvolutionChart`) and the comparison clones (`createChartFromTemplate`). The same applies to the `data-codexr-active-chart-id` marker, which the containment reads to pick the fit strategy and the surface lift — a stale marker mis-fits the chart. Note that the containment's own transform snapshots (`cloneTransform`/`restoreTransform`) deliberately carry position, scale and visibility only, so they can never be the source of a rotation problem.
- **Row-budgeted datasource**: every chart except boats reads from a CodeXR-maintained sliced `babia-queryjson` entity (`codexrChartDataSlice__<source>`, `chartDataSlice.js` part of the mapping runtime). The slice ranks rows by the mapped magnitude, honours `numeric-positive` value rules by VALUE (a zero radius makes babia-cylsmap compute `-Infinity` axis lengths), and keeps one row per Babia element key. It subscribes to the real producer's NotiBuffer, so re-analysis pushes and evolution frame swaps flow through.
- **Validation**: `processing/dimensionValidator.ts` validates mappings against the Python-derived field schema (see `PYTHON_ANALYSIS.md` → field-schema contract) before launch. The in-scene Mapping UI performs transactional mapping changes with safe recovery.
- **Default hierarchical chart is Babia Boats.** The custom `code-xr-boats` ("Code City") prototype was **deleted on `fix/gitcontroller` (2026-07-25)** — nothing injected it, generated scenes use `babia-boats`, and old configs migrate (see V1.2.0_STATUS.md).

## Scene decoration

- **Brand logo** (`templates/components/codexr/logo/`, component `codexr-logo`): the CodeXR mark extruded in 3D over the analysis table while the table is empty — mode `selection`, which is both the between-analyses state and the transit hop while a heavy analysis is prepared. Its contours are generated **offline** from `resources/icon.svg` into `logoContours.js` (`AFRAME.THREE` has no `SVGLoader`, so the conversion cannot happen in the browser); regenerate that part rather than editing it.
- The contract it relies on: `CodeXRAnalysisTableRuntime.setMode` writes the mode onto `#codexrAnalysisTable` **only on a real change**, so A-Frame's `componentchanged` is a precise, poll-free trigger. It must NOT register a `selection` lifecycle with `CodeXRAnalysisModeRuntime` (registration overwrites by key and would clobber the built-in `clearVisualizationsForSelection`), and it must NOT live inside `#codexrAnalysisSurface` (whose selection sweep would own it).
- Rules any future decoration should copy: no raycaster class (decoration must never swallow a click), subscribe to `CodeXRRenderBudgetRuntime` and go still on `static` (which is also how `prefers-reduced-motion` arrives), one-shot `animation__codexr_*` removed on teardown, idle motion in `tick` with a clamped frame delta.

## Debugging XR scenes

Browser-console APIs (`CodeXR.help()`, `CodeXRDebug`, `CodeXRChartDebug`, `CodeXRDependencyGraphRuntime`) are fully documented in `docs/xr-testing/XR_DEBUG_COMMANDS.md`. Manual browser harnesses live in `test/manual/` (`npm run test:xr-harness`, `npm run test:project-evolution-harness`).

## Collaboration & remote layer (summary only)

- Collaborative rooms: WebSocket signaling in `src/servers/runtime/collaboration/collaborationRoomServer.ts` + broadcast signaling for virtual screens; server-authoritative admin operations (host/guest roles, host transfer) — v1.2.0's "Collaboration 2.0".
- Cross-network access: opt-in Cloudflare Quick Tunnel per server (pinned `cloudflared`, token invites, pairing codes, revocation) — see `docs/features/CLOUDFLARE_REMOTE_ACCESS.md` (Spanish) for limits and the authorization flow.

## How future agents should use this document

- Changing a runtime under `templates/components/`? Update/re-run its `.test.cjs` in `test/analysis/`, respect the load order in `COMPONENTS.md`, and remember the change ships inside generated user-facing scenes.
- Adding a chart type? Start at `chartRegistry.ts`, then the dimension validator, then the placeholder processors — in that order.
- For feature-level behavior (graph layouts, comparator limits, evolution player), always defer to the linked `docs/*.md` file instead of re-deriving from code.
