# LivePanel v1.2.0 Enhancements — Technical Plan

## 1. Current Understanding

**LivePanel today (confirmed):** Not a VS Code webview.

```
LauncherLivePanel 
  → shared executeLaunchPipeline (same pipeline XR/DOM use)
  → AnalysisBootstrap.bootstrapLivePanelFile/bootstrapLivePanelDirectory
    generates static HTML/CSS/JS + data.json
  → SaveFiles writes to disk
  → per-session HttpServer (or its HTTPS wrapper) serves it
  → extension opens it in external browser via vscode.env.openExternal
```

**Templates:** Live in `templates/analysis_livePanel/{file,directory}/*.html|.js|.css`

- Processed by single `LivePanelParser` → collapses to exactly one JS file and one CSS file per folder
- Data loads via `fetch('./data.json')`
- Live-reload: one-way SSE (`EventSource('/events')`)
- UI: Single flat scrollable page per mode — plain DOM + Chart.js from CDN
- No tabs, no D3/Babia/A-Frame
- **Zero references to Git/dependency concepts** exist in templates today

### How It Differs from XR

- **XR:** Renders A-Frame/BabiaXR scenes with in-scene UI driven by WebSocket collaboration room (multi-user authority/presence)
- **LivePanel:** Single-user with no WebSocket client today — HTTP fetch/SSE only

### Reusable Parts (Confirmed)

The following are rendering-agnostic — plain JSON in/out, no XR imports:

- `HistoricalComparisonService`
- `GitRepositoryService`
- `DependencyGraphService`
- Python `dependency_analysis_engine.py`

**Key insight:** `HttpServer` (and its HTTPS wrappers, which delegate `handleRequest` to the same instance) already instantiates both services unconditionally for any session, including LivePanel ones — they're just gated off.

The existing `/api/*` routing switch in `handleApiRequest` (`httpServer.ts:451-509`) is a ready-made extension point that already inherits HTTP/HTTPS protocol-agnosticism and the existing remote-access auth gate.

---

## 2. Feasibility Assessment

### Dependency Graph Summary: ✅ Feasible

- `DependencyGraphService.getAvailability()` has one shallow gate (`analysisMode !== 'XR'`), no requirement-rules or command-registration gate
- The `dependency-graph.json` schema already contains everything a 2D dashboard needs:
  - fanIn/fanOut/degree/cycleSize per node
  - confidence/kind/occurrences per edge
  - capabilities map, external flag, warnings
- Rankings, cycle grouping, and breakdowns are cheap client-side derivations
- Generation is already cheap and incremental
- Real Python tests already exist

### Historical Comparison: 🟡 Partially Feasible — More Design Work

- Same shallow-gate pattern
- **Problem:** No existing trigger command/UI path at all (100% in-scene WebSocket today)
- Result shape is aggregate-only (counts + metric deltas, no per-item diff exposed anywhere, even to XR)
- A "useful 2D interface" implies showing what changed → **requires new additive service logic**
- Dual ref-picker implies full two-sided flexibility
- `HistoricalComparisonService` has **zero direct unit tests** today

---

## 3. Recommended Implementation Order

1. **Chat 2** — Dependency Graph Summary (lower risk, establishes the REST/UI pattern)
2. **Chat 3** — Historical Comparison (reuses Chat 2's pattern, carries harder new-capability work)
3. **File and directory LivePanel** implemented together within each feature's chat
   - Already share one parser and nearly identical bootstrap paths
   - Splitting buys nothing
   - Dependency Graph: directory/project-only (matches existing XR restriction)
   - Historical Comparison: covers both file and directory (XR already supports both)
4. The four-chat structure itself doesn't need restructuring beyond this order swap

---

## 4. Proposed Architecture

```
LivePanel page (HTTP or HTTPS, same-origin only)
  ├─ fetch('/api/dependency-graph/summary')
  ├─ fetch('/api/historical-comparison/references')
  └─ fetch('/api/historical-comparison/compare', {method:'POST', body:{...}})
        ↓
HttpServer.handleApiRequest() — existing switch, existing isRequestAuthorized() gate reused as-is
  ├─ new case → DependencyGraphService (already instantiated per session)
  ├─ new case → GitRepositoryService
  └─ new case → HistoricalComparisonService
        ↓
Services (gate relaxed to allow analysisMode === 'LivePanel') → JSON
        ↓
Rendered into existing flat-page sections by extended main.js
```

### Key Points

- **Protocol-agnostic:** `HttpsCustomServer`/`HttpsDefaultServer` both delegate to same `HttpServer.handleRequest` (confirmed by code reading)
- **Session-scoped:** Each `HttpServer` instance scoped to one session/target — new endpoints never need a path/session-id parameter
- **Pattern reuse:** Same as existing WS handlers use

### TypeScript Files Involved

- `dependencyGraphService.ts` (gate)
- `historicalComparisonService.ts` (gate + new additive diff methods)
- `historicalComparisonModels.ts` (new types)
- `httpServer.ts` (new routes only — thin delegation, no new cross-cutting logic)

### Templates Involved

- `directoryAnalysis.{html,main.js,style.css}` (Chat 2)
- All four `{file,directory}` template files (Chat 3)

### NOT Touched

- `templates/xr/`
- `src/babia_templates/`
- `templates/components/codexr/{historical-comparison,dependency-graph,code-xr-boats,project-evolution}/`

---

## 5. File Impact Estimate

### Chat 2 Modifies

- `dependencyGraphService.ts`
- `httpServer.ts`
- `directoryAnalysis.{html,main.js,style.css}`
- New tests

### Chat 3 Modifies

- `historicalComparisonService.ts`
- `historicalComparisonModels.ts`
- `httpServer.ts`
- All four LivePanel template files
- Includes first-ever direct tests for `HistoricalComparisonService`

### Do NOT Touch

- Any XR template/runtime file
- Project Evolution files
- `remote_access/` internals (reuse `isRequestAuthorized` as-is, don't modify it)
- `dist/`, `out/`, `.vscode-test/`, `node_modules/`

---

## 6. MVP Definition

### Dependency Graph Summary

**Scope:**
- Directory/project only
- On-demand generation (explicit button, not automatic)
- Dashboard showing:
  - Stat tiles (external/cycles)
  - Top-N fan-in/fan-out tables
  - Cycles table (grouped client-side from `cycleSize > 0`)
  - Confidence/capability breakdowns
  - Warnings

**Non-goals:**
- Any graph rendering
- Drill-down, layouts
- Editable filters beyond basic sort

### Historical Comparison

**Scope:**
- File + directory
- Full two-sided source picker
- Manual Compare/Refresh (no live-reactive auto-diff in v1)
- Reuse existing `ComparisonDeltaSummary` aggregate as-is
- **New:** Additive per-item changed-list capability (the one genuinely new piece of service logic)

**Non-goals:**
- Overlay view
- Spatial highlighting
- Rename detection
- Automatic live reactivity

---

## 7. UI Proposal

### Dependency Graph Summary

```
Stat tiles (external/cycles)
    ↓
Top Fan-In / Top Fan-Out tables
    ↓
Cycles table
    ↓
Confidence/Capability breakdown
    ↓
Warnings
    ↓
"Generate/Refresh" button
```

Styled like existing "Most Complex Files"/"File Details" sections.

### Historical Comparison

```
Dual source pickers
  (grouped LIVE/BRANCH/TAG/COMMIT like XR, same-source-collision guard)
    ↓
Compare/Refresh buttons
    ↓
Stat tiles (Added/Removed/Modified/Unchanged)
    ↓
Metric-delta table
    ↓
Per-item changed-list table (sortable, existing file-table idiom)
```

**Styling:** Reuse existing card/table/section CSS idiom from `directoryAnalysis.style.css` rather than inventing new design language or tab framework.

---

## 8. Testing Strategy

### Unit Tests

- **New direct tests** for `HistoricalComparisonService` (closes existing gap)
- **New tests** for `DependencyGraphService` gate and new `httpServer.ts` handlers
- **New `.test.cjs`** for extracted render-logic pure functions
- Run `npm test` after every change
- Run `npm run test:analysis` to confirm `data.json` equivalence unaffected

### Manual Testing

- F5 to reload
- Verify both HTTP and HTTPS local servers
- Confirm SSE still works

### Regression Testing

- Re-run existing XR manual acceptance flows documented in:
  - `HISTORICAL_COMPARISON_XR.md`
  - `DEPENDENCY_GRAPH_XR.md`
- After each gate relaxation

---

## 9. Documentation Strategy

### Chat 2 & 3

- Add light one-line breadcrumb to `V1.2.0_STATUS.md` "In progress"
- Follow repo's universal session rule
- No full reconciliation

### Chat 4

- Full updates to `CHANGELOG.md` and README.md "What's New"
- **Fixes pre-existing debt:** "still says v1.1.0"
- Extend `HISTORICAL_COMPARISON_XR.md` / `DEPENDENCY_GRAPH_XR.md` with short "## LivePanel" section

**No new fragmented docs.**

### Roadmap Check

`docs/ROADMAP_V1.2.0.md` already correctly marks:
- Workspace multi-station
- AI assistance
- TURN

Out of active 1.2.0 scope — **no removal needed.**

---

## 10. Risks and Unknowns

### Risk 1: Central File Modifications

**Issue:** `httpServer.ts` is large and central

**Mitigation:** New routes must stay thin and isolated to avoid regressing XR's WebSocket path

### Risk 2: Template File Growth

**Issue:** `LivePanelParser`'s single-file collapsing means all new UI code gets appended into already-large files (directory)

**Mitigation:** Needs clear internal namespacing; extending parser to support multiple files is future improvement, explicitly out of scope here

### Risk 3: Incomplete Gate Audit

**Issue:** Gate relaxation verified for two known checks, but not via exhaustive audit of every 'XR' string

**Mitigation:** Chat 2/3 should `grep` fully before relying on this

### Risk 4: Protocol-Agnosticism (LOW RISK)

**Status:** Confirmed (not just inferred) that HTTPS wrappers delegate to same request handler ✅

### Risk 5: Scope Creep

**Dependency Graph:** Could balloon into "graph-lite"

**Historical Comparison:** New diff logic could creep into rename-detection

**Mitigation:** Hold the line at §6 (MVP Definition)

---

## 11. Prompts for Next Chats

Full copy-pasteable prompts for:
- **Chat 2:** Dependency Graph Summary
- **Chat 3:** Historical Comparison  
- **Chat 4:** Documentation & Finalization

Each is self-contained, referencing exact files/methods to change and test/doc obligations.

See inline prompts below for direct use:

---

## Chat 2 Prompt Template

```
Implement Dependency Graph Summary for LivePanel v1.2.0

Reference: .claude/plans/we-are-working-on-merry-milner.md §2–7

Tasks:
1. Relax gate in dependencyGraphService.ts: Allow analysisMode === 'LivePanel' alongside 'XR'
2. Add new route /api/dependency-graph/summary to httpServer.ts
3. Update directoryAnalysis.html to render summary section
4. Extend directoryAnalysis/main.js with fetch & render logic
5. Style summary cards/tables in directoryAnalysis/style.css
6. Add unit tests for new gate & endpoint
7. Add breadcrumb to V1.2.0_STATUS.md

Test: npm test, F5 verify HTTP/HTTPS, check SSE still works
```

---

## Chat 3 Prompt Template

```
Implement Historical Comparison for LivePanel v1.2.0 (File + Directory)

Reference: .claude/plans/we-are-working-on-merry-milner.md §2–7

Tasks:
1. Add new per-item diff method to historicalComparisonService.ts
2. Relax gate: Allow analysisMode === 'LivePanel' alongside 'XR'
3. Add /api/historical-comparison/references and /api/historical-comparison/compare routes to httpServer.ts
4. Update all four LivePanel templates (file/directory analysis) with dual picker & tables
5. Extend render logic with per-item changed-list support
6. Style dual picker & tables per existing idiom
7. Add direct unit tests for HistoricalComparisonService (closes gap)
8. Add breadcrumb to V1.2.0_STATUS.md

Test: npm test, manual F5, regression on existing XR flows
```

---

## Chat 4 Prompt Template

```
Finalize LivePanel v1.2.0 Documentation & Release

Reference: .claude/plans/we-are-working-on-merry-milner.md §9

Tasks:
1. Update CHANGELOG.md with v1.2.0 summary
2. Update README.md "What's New" section (fix pre-existing v1.1.0 debt)
3. Extend HISTORICAL_COMPARISON_XR.md with "## LivePanel" subsection
4. Extend DEPENDENCY_GRAPH_XR.md with "## LivePanel" subsection
5. Update package.json version to 1.2.0 (if not already)
6. Final V1.2.0_STATUS.md reconciliation mark as complete

Test: npm run build, verify no errors
```

---

**End of Plan**
