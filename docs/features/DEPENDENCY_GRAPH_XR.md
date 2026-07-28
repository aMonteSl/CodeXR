# CodeXR Dependency Graph XR

## Purpose

The dependency graph is a CodeXR-owned XR visualization for understanding the
architecture of a directory or project. It does not modify BabiaXR and it does
not depend on GitHub, GitLab, or any other Git hosting provider. Analysis uses
the source files present in the local working directory.

The graph is the third `codexr-analysis-table` mode:

- `single`: the normal metric chart.
- `historical-compare`: two historical metric charts.
- `dependency-graph`: one full-table dependency graph.

The mode selector remains inside the compact Field Mapping panel. Activating
the dependency mode parks the normal chart completely, changes the table
colors, starts the analysis on demand, and restores the original chart without
recreating it when the user returns to normal mode.

## Architecture

The implementation is divided into four independent layers:

| Layer | Responsibility |
| --- | --- |
| Python adapters | Scan supported files and extract static relations |
| `DependencyGraphService` | Own the session job, revision and immutable JSON artifact |
| Collaboration server | Authorize requests and publish authoritative shared state |
| `codexr-dependency-graph` | Render and interact with the graph in A-Frame |

Results are written to `dependency-graph.json` and versioned artifacts under
`dependencies/`. A hash-based extraction cache remains in private extension
storage, never in the served analysis. The normal metric payload continues to
use `data.json`; the contracts are deliberately separate.

Only XR directory/project analyses expose the capability. File and DOM
analyses receive a disabled action with an explanatory reason.

## Python Environment

Lizard remains responsible for complexity metrics. It is not used to infer
imports or calls.

`tree-sitter-language-pack` is pinned in the central Python package manifest
and installed once in the virtual environment managed by CodeXR. Existing
environments are migrated by verifying and installing missing manifest
packages during startup.

Every language adapter declares the quality of each relation:

- `exact`: syntax provides an explicit dependency.
- `best-effort`: static syntax is available but name resolution may be partial.
- `unsupported`: the adapter cannot provide that relation.

When a Tree-sitter grammar cannot be loaded, CodeXR uses the language's
lexical fallback and includes a warning in the dataset. A fallback is never
reported as exact semantic resolution.

## Supported Languages

The graph uses the same canonical contract as metric analysis:

Python, Ruby, Java, C, C++, C#, Erlang, Fortran, GDScript, Go, JavaScript,
Kotlin, Lua, Objective-C, PHP, Perl, Scala, Solidity, Swift, TypeScript,
TTCN-3, Vue and Zig.

The test fixture contains real source files for all 23 languages. This keeps
the dependency feature aligned with Files by Language and prevents a language
from disappearing silently during parser changes.

## Relations and Resolution

The first dataset supports:

- Imports and module references.
- C-family includes.
- `require`, `use`, `using` and equivalent forms.
- Inheritance and interface implementation where statically visible.
- Function or method calls detectable from source text.

Edges are directional from the referencing file to the referenced node.
Internal references are resolved against normalized relative paths, module
paths and file stems. Unresolved references become external package nodes.
External nodes are hidden by default and can be enabled from the XR controls.

Calls that cannot be resolved to a unique local definition are marked
`ambiguous`. They are disabled in the initial view to prevent a dense call
graph from obscuring architectural dependencies.

## Graph Metrics

After extraction CodeXR calculates:

- `fanIn` and `fanOut`.
- Total degree.
- Number of direct dependants.
- Number of attached relations.
- Total source lines.
- Cycle size using strongly connected components.

Cycles are calculated only between internal files. External packages do not
create false project cycles.

The group view aggregates nodes by their first directory/package segment. It
sums metrics, merges equivalent edges and removes self-edges introduced by
aggregation. Selecting a group opens its file-level view.

## XR Rendering

`codexr-dependency-graph` is independent from Babia chart components. It owns
its nodes, edges, selection state and layout worker.

Three layouts are available:

1. `force-3d`: a bounded spiral/force-style spatial distribution.
2. `hierarchical`: directed levels based on incoming dependencies.
3. `metric-space`: X and Z positions derived from graph metrics.

Layout calculations run in a Web Worker so large graphs do not block the
A-Frame render loop. The runtime limits a rendered view to 600 nodes and 2,000
edges. Larger datasets open in group mode and support drilling into a smaller
area rather than placing thousands of labels in the scene.

Nodes use language colors by default. The compact controls can remap:

- Node size.
- Node height.
- Node color.
- X/Z metrics in metric-space mode.

Available fields include degree, fan-in, fan-out, source lines, relation count
and cycle size. Selecting a node dims unrelated nodes and highlights its local
dependency neighborhood.

The graph renders metric axes inside the safe table bounds:

- `metric-space` shows X, Z and Y axes using the selected X, Z and height
  metrics.
- `force-3d` and `hierarchical` show the Y/height scale without claiming that
  their layout coordinates are metric values.
- Axis ranges are calculated from the current filtered dataset. Tick steps use
  readable `1`, `2` or `5 × 10^n` increments; for example, a maximum of 1,000
  source lines produces ticks from 0 to 1,000 in increments of 100.
- Node placement and tick labels share the same calculated maximum, so the
  visual coordinate corresponds to the displayed scale.

Nodes and edges expose local detail cards:

- Hovering a node shows its path, language, fan-in, fan-out, degree, relation
  count, cycle size and source lines.
- Hovering an edge shows its source, target, relation kind, confidence and
  occurrence count.
- Detail cards use separate title, path/type and metric rows. Their lower edge
  is positioned above the highest node and the Y-axis, preventing the card
  from covering graph geometry.
- While visible, a detail card continuously faces the active A-Frame camera.
  This billboard behavior works when the user turns or moves in desktop,
  mobile and immersive XR modes.
- Clicking a node or edge pins its card and highlight until the same item is
  clicked again. Clicking another item moves the pinned selection.
- Directory and file cards expose explicit `Open folder`, `Open file` and
  `Go to parent` actions, preserving hierarchical navigation without
  overloading the selection click.
- Every control with multiple values exposes left and right arrows. Hovering a
  layout, view, mapping or relation filter explains what changing it affects.

Hover, pinned selection and camera focus are intentionally local. They do not
overwrite what another participant is inspecting.

## Edge Encoding And Direction

The dependency panel includes one compact `Edges` selector with four presets:

- `Relation type` keeps the original categorical colors for imports, includes,
  requires, inheritance, implementations and calls.
- `Intensity color` uses a fixed cyan-to-orange scale.
- `Intensity width` uses fixed cylinder thicknesses.
- `Color + width` applies both intensity channels.

Intensity always comes from the authoritative edge `occurrences` value. CodeXR
uses the fixed buckets `1`, `2-3`, `4-7`, `8-15` and `16+`; the scale is not
user-editable in 1.2.0. Confidence remains independent from the preset:
`exact`, `probable` and `ambiguous` relations use progressively lower opacity.

Visible edges are low-poly cylinders rendered in `THREE.InstancedMesh` batches
grouped by confidence. Arrow cones point at the target node. Large views keep
arrows only for the currently inspected neighborhood to avoid visual noise.
Non-rendered per-edge cylinders remain responsible for mouse and XR raycaster
interaction, so batching does not reduce selection precision. Their materials
disable visibility and color writes: Three.js can still raycast their geometry
without submitting more than a thousand invisible draw calls.

Flow particles use one custom `THREE.ShaderMaterial` points layer. The fragment
shader produces small soft directional marks instead of the square point
sprites produced by the default Three.js material. Motion follows the
authoritative `source -> target` direction. Selecting a node colors outgoing
pulses cyan and incoming pulses gold, while a selected edge keeps its own
style color.

## Adaptive Visual Density

FPS alone is not sufficient to decide whether a graph is readable. A device
can render thousands of overlapping edges at 60 FPS while the result remains
visually saturated. `CodeXRDependencyVisualBudgetRuntime` therefore measures
visual pressure independently from `CodeXRRenderBudgetRuntime`.

The density profile uses visible node count, edge count, edge-to-node ratio
and maximum degree:

- `sparse`: widths from `0.006` to `0.024`.
- `balanced`: widths from `0.004` to `0.018`.
- `dense`: widths from `0.0025` to `0.010`.

All edges remain present. Increasing density lowers their common opacity while
preserving the relative confidence ordering. Hovered and pinned relations are
drawn again in a separate focus layer with stronger opacity and width, so
selection never has to mutate or rebuild the base instanced batches.

Arrows remain visible for every sparse relation. Balanced and dense views keep
arrows for the active neighborhood. Flow is capped at 300 relations for sparse
views, the 80 strongest for balanced views, and the 40 active relations for
dense views. Static render quality disables flow regardless of density.

The local `Detail` selector offers:

- `Auto`: combines density and measured render quality.
- `Full`: increases contrast by one density level, while respecting
  performance safeguards.
- `Focus`: keeps the overview subdued and gives full detail to interaction.

This preference is intentionally local and is not sent through collaboration.
The effective profile always uses the most conservative requirement from
density, explicit preference and current render quality.

## Adaptive Render Budget

`CodeXRRenderBudgetRuntime` is a reusable client-side service packaged before
the dependency runtime. It samples `requestAnimationFrame`, reports average
FPS and the 95th percentile frame time, and exposes:

```ts
type RenderQuality = 'full' | 'interactive' | 'static';

interface RenderBudgetSnapshot {
    quality: RenderQuality;
    averageFps: number;
    frameTimeP95: number;
    targetFps: number;
    xrSession: boolean;
}
```

The render quality is combined with the visual-density budget before deciding
widths, opacity, arrows and flow limits. `static` preserves colors, widths,
selection halos and the focus layer without moving particles. Several
unhealthy sample windows are required before degrading, and a longer healthy
period is required before upgrading, preventing quality from oscillating near
a threshold.

The monitor pauses while the page is hidden and adapts its target to the
active XR session frame rate when available. `prefers-reduced-motion` always
selects static quality. Measurements and quality are local, are not persisted,
and are never transmitted as telemetry or collaboration state.

## Hidden External Dependencies

Hiding external dependencies no longer removes their architectural meaning.
The runtime creates a synthetic `external-summary` view node and redirects
external relations to it while preserving direction, relation kind,
confidence and summed occurrences.

The summary is a sphere in `force-3d` and a portal-shaped box in hierarchical
and metric-space layouts. It occupies a reserved position inside the table,
but is excluded from the layout worker and metric scales. Its detail card
shows the hidden package count, total relations, leading packages and relation
distribution. `Show external details` switches the shared view back to the
individual external nodes.

The summary node and its aggregated edges are never written to
`dependency-graph.json`. They are a reversible presentation transformation,
so analyzer artifacts remain provider-neutral and reusable.

## Collaboration

Dependency generation is server-authoritative:

1. A participant requests `dependency-graph-start`.
2. The server allows only one job for the analysis session.
3. Progress is broadcast through the collaboration WebSocket.
4. The completed immutable artifact is published as the
   `dependency-graph/main` shared entity.

Layout, directory/file scope, relation filters, external visibility, mapping
and edge encoding are shared. Render quality, animated
frames, node selection and camera focus remain local.

The same WebSocket is available through Cloudflare Quick Tunnel, so dependency
mode does not rely on SSE for remote collaboration.

## Analysis Mode Lifecycle

`CodeXRAnalysisModeRuntime` serializes transitions between normal analysis,
historical comparison and dependency mode. The active runtime is fully
deactivated before the next one mounts its geometry.

The intermediate `selection` state deliberately leaves the table without a
chart while the requested analysis is refreshed. Each activation carries a
generation identifier. If a newer selection arrives while a dataset or worker
is still loading, the superseded activation is immediately deactivated and its
late result is ignored.

Leaving dependency mode invalidates pending dataset loads, layout worker
generations and render retries. It then releases graph geometry, edges, axes,
particles, tooltips and picking meshes before restoring the original chart.
The analyzed datasets and file-scope cache remain in memory, so returning to
dependencies does not require another scan unless source changes are pending.

Normal XR refreshes are announced by the authoritative collaboration entity.
Its per-mode revision forces the existing datasource to reload before the
original chart becomes visible again. SSE remains available for LivePanel and
DOM analyses but is not duplicated for XR mode changes.

The previous `group/file` granularity switch was removed. Hierarchical
`DependencyGraphScope` navigation is now the only projection mechanism. The
panel offers contextual parent navigation, direct return to the project root
and a local `Reset view` action.

## Git Provider Compatibility

The graph reads ordinary files from the analyzed directory. A project may be:

- A local non-Git directory.
- A Git repository with no remote.
- Cloned from GitHub.
- Cloned from GitLab.
- Cloned from another Git server.

No provider API, credentials, remote URL or active branch is required. CodeXR
does not run `checkout`, `fetch`, or write to `.git` for dependency analysis.

## Testing

Automated coverage verifies:

- The 23-language contract and fixture.
- Explicit capabilities and confidence levels.
- Valid node/edge references and graph metrics.
- Runtime packaging in directory XR analyses.
- The table mode, three layouts and Web Worker.
- Separation from Babia chart components.
- Central pinned Python dependencies.
- Historical comparison and table containment regressions.
- Fixed edge intensity buckets, relation colors and confidence treatment.
- Instanced edge and arrow rendering plus the single particle layer.
- Direction-preserving external summary aggregation.
- Render-budget packaging and reduced-motion handling.

Incremental refresh reuses extracted relations for unchanged file hashes and
reprocesses only changed files. Resolution, cycle detection and aggregate
metrics are then recomputed from the coherent cached set.

Manual acceptance uses generated XR directory and file analyses in a browser and
checks mouse/raycaster interaction, all layouts, filters, mappings, grouped
navigation, restoration of the normal chart and collaboration between two
clients.

The dense-graph acceptance fixture is a shallow temporary clone of Fastify,
pinned to commit `9d2914857906a98b6366266417d6527ab8e5e06f`. At the time of
validation it contains 391 files, of which 297 are analyzable by CodeXR. The
dependency analyzer produces 1,506 nodes and 5,501 relations before view
limits, including 4,585 external relations and a maximum degree of 459. The
MIT-licensed repository is never modified, packaged or committed to CodeXR.

## Browser Diagnostics

`window.CodeXRDebug` provides a general diagnostics facade without replacing
the chart-specific `CodeXRChartDebug` API:

```js
CodeXRDebug.status();
CodeXRDebug.watch(1000);
CodeXRDebug.stopWatch();
CodeXRDebug.hud(true);
CodeXRDebug.toggleHud();
CodeXRDebug.help();
```

The snapshot includes FPS, P95 frame time, target FPS, XR mode, density
profile, effective widths, graph layout, mappings, visible and source counts,
active flow, arrows, focus edges, selection, transitions, worker generation,
draw calls, triangles, geometries and textures.

The optional HUD is attached to the desktop camera and refreshes locally. Its
`codexr-desktop-only` component hides it automatically in VR and AR and
restores it after leaving immersive mode only when the user left diagnostics
enabled. No diagnostic value is persisted or transmitted.

## Selective Reanalysis

CodeXR keeps independent applied revisions for normal analysis, historical
comparison and dependency mode. The filesystem watcher detects a project
change once and the refresh coordinator delivers it only to the visible mode:

- Normal mode recalculates affected metrics and updates `data.json`.
- Dependency mode does not run Lizard or modify `data.json`.
- Historical mode updates only `working-copy`; Git revisions stay immutable.

Hidden modes retain a coalesced change set. Returning to a stale mode triggers
one catch-up refresh while its last valid visualization remains visible.

Dependency refreshes pass a private, validated manifest of added, changed and
removed files to Python. Only those files are parsed again. Cached extraction
records for unchanged files are reused before global relations, cycles and
aggregate metrics are recalculated. Missing, damaged or incompatible caches
fall back to a full safe scan.

## Animated Reconciliation

The graph runtime reconciles nodes and edges by stable identifiers instead of
destroying the current scene before the next result is ready. Over 600 ms:

- Existing nodes interpolate position, size, height, color and opacity.
- New nodes enter from a connected neighbor or the graph center.
- Removed nodes and edges fade and shrink before their resources are disposed.
- Edges follow their endpoints on every animation frame.
- Layout and mapping changes use the same transition.

Worker responses carry a generation identifier and datasets carry their source
revision, allowing stale results to be discarded. A pinned detail card follows
its moving element and closes if that element disappears. Browsers requesting
reduced motion apply the final state immediately.

## Hierarchical Exploration

Directory mode projects the immutable file graph into the current shared
scope. It shows direct files, immediate child directories, the parent
directory and the external dependency portal. Files deeper in a child
directory are aggregated into that directory node. Files outside the current
scope are aggregated into the parent node, preserving direction, relation
kind, confidence and occurrence counts.

The current project-relative path is shown both above the table and in the
dependency panel. Clicking a node pins its detail card; navigation happens
through the explicit `Open folder`, `Open file`, or `Go to parent` action to
avoid accidental movement with XR controllers.

Navigation nodes are presentation-only. They are not persisted in
`dependency-graph.json`, and aggregation removes self-edges created when
multiple files collapse into the same directory.

## File Dependency Scope

XR file analyses can enter dependency mode directly. Opening a file from a
directory analysis requests the same scope on demand and caches it by path,
content hash and analyzer schema.

The file graph can contain modules, functions, methods, classes, interfaces,
traits, structs, records and enums. `contains` edges describe ownership;
calls, inheritance and implementation retain their confidence level. Imports
to other project files collapse into an internal-files portal, while package
imports use the external portal.

Symbol geometry remains consistent across layouts:

- Sphere: function.
- Cylinder: method.
- Pyramid: class.
- Diamond: interface or trait.
- Box: struct, record or directory.
- Low cylinder: enum.
- Polyhedron: module-level code.

Nodes use flat, vivid materials so their identity does not depend on scene
lighting. Hover brightens the existing color and selection adds the normal
halo instead of being the only colored state.
