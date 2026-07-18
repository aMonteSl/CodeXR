# CodeXR Components Inventory

This folder contains the browser-side runtimes copied into generated CodeXR analysis scenes.

## Multi-part runtimes

Large runtimes are split into focused module files under
`codexr/<component>/<runtimeBase>/` (for example
`codexr/analysis-table/analysisTableRuntime/geometryUtils.js`), with the
concatenation order declared in that directory's **`manifest.json`**
(`{ "output": "<runtimeBase>.js", "parts": [...] }`). The first listed part
opens the runtime's IIFE/UMD wrapper, the last one closes it, and the parts in
between are plain declarations at wrapper scope. At injection time
`src/.../customComponents/runtimeAssembly.ts` (tests:
`test/helpers/runtimeAssembly.cjs`) joins them back into the single flat file
listed below, so generated scenes are unchanged. The assembler refuses orphan
`.js` files that are not listed in the manifest — when adding a part, add it to
`manifest.json` at the right position. Never re-create the flat file next to
its parts directory. Manual harnesses load assembled copies from
`test/manual/assembled/` (regenerate with
`node test/manual/buildAssembledRuntimes.cjs`).

## Shared Runtime

- `common/codexrCommonRuntime.js`
  - Global: `window.CodeXRCommonRuntime`.
  - Owns reusable UI helpers for CodeXR components: tooltip panels, camera-facing billboards, hitboxes, text compaction and entity creation.
  - Use this folder for logic that is useful to more than one component or future CodeXR graph.
  - Keep graph-specific semantics, data models and protocol handling in the owning component.

## CodeXR Runtimes

- `codexr/analysis-table/analysisTableRuntime.js`
  - Owns the XR table, visual surface, table modes and chart containment.
- `codexr/xr-chart-mapping-ui/xrChartMappingUiRuntime.js`
  - Owns Field Mapping, live chart switching, contextual panel views and transactional metric mapping.
- `codexr/code-xr-boats/codeXrBoatsRuntime.js`
  - Experimental CodeXR hierarchical boats chart. Paused for 1.2.0, kept only as a preserved prototype, and not part of the public chart selector or generated scene runtime by default.
- `codexr/analysis-mode/analysisModeRuntime.js`
  - Owns mode switching between normal analysis, historical comparison and dependency graph.
- `codexr/dependency-graph/dependencyGraphRuntime.js`
  - Owns the dependency graph visualization, layouts, filters, navigation and dependency-specific interaction.
  - Uses `CodeXRCommonRuntime` for tooltip presentation and billboard behavior.
- `codexr/historical-comparison/historicalComparisonRuntime.js`
  - Owns historical Git source selection and two-zone comparison rendering.
- `codexr/virtual-screen/virtualScreenRuntime.js`
  - Owns a shared virtual screen and screen broadcast interaction.
- `codexr/virtual-screen/codexrMultiScreenManagerRuntime.js`
  - Owns screen creation, placement and multi-screen controls.
- `codexr/collaboration/codexrCollaborationRuntime.js`
  - Owns shared presence, identity, avatars, pointers and collaboration entities.
- `codexr/avatar/codexrAvatarRuntime.js`
  - Owns avatar rendering and optional downloaded avatar model assets.
- `codexr/xr-room/codexrRoomRuntime.js`
  - Owns the CodeXR room shell and local room texture assets.
- `codexr/render-budget/renderBudgetRuntime.js`
  - Owns local FPS/render quality monitoring.
- `codexr/dependency-visual-budget/dependencyVisualBudgetRuntime.js`
  - Owns dependency graph visual density budgeting.
- `codexr/debug/codexrDebugRuntime.js`
  - Owns `CodeXRDebug` diagnostics, status, watch and HUD.
- `codexr/xr-chart-debug/xrChartDebugRuntime.js`
  - Owns legacy chart debug helpers for positioned XR charts.
- `codexr/dom-scene/codexrDomSceneCollaborationRuntime.js`
  - Owns DOM-scene collaboration glue.

## Recommended Load Order

1. Room, collaboration, avatars and virtual screens.
2. `common/codexrCommonRuntime.js`.
3. CodeXR charts, mapping UI, chart debug and analysis table.
4. Analysis mode and mode-specific runtimes.
5. Render budgets before visualizations that consume them.
6. Dependency graph and other CodeXR graphs.
7. Debug runtimes last.

Generated scene filenames are intentionally flat (`codexrCommonRuntime.js`, `dependencyGraphRuntime.js`, etc.) so existing analysis output remains simple and self-contained — multi-part runtimes are assembled back into these flat names at injection time.

## Shared LivePanel components (`livepanel/`)

Files under `livepanel/` are bundled by `LivePanelParser` (alphabetical order)
ahead of each LivePanel template's own script/stylesheet: `charts.js|css`,
`dataTable.js|css`, `dependencySummaryPanel.js`, `historicalPanel.js|css`, and
`panelShell.js|css` (theme toggle, SSE status indicator, notifications, the
DataTable registry and shared formatters).
