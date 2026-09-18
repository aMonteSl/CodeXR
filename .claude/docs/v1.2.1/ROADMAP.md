# v1.2.1 Roadmap — the cleanup programme, commit by commit

> **Purpose**: the executable plan for v1.2.1. `../V1.2.1_STATUS.md` says where we are; this file says what comes next and in which order.
> **Stability**: living document. When a commit lands, mark its row done in the session log of the status doc; when a ruling changes a row, change the **override table** below rather than leaving two truths.
> **How to use**: read sections A-D once, then jump to the wave you are working on. Finding ids (`dead-modules/ZOMBIE-04`) resolve in `AUDIT.md`; design detail lives in `DESIGN_GUARDRAILS.md` and `DESIGN_STRUCTURAL.md`; the evidence behind every override is in `CRITIC_REVIEW.md`.

## A. What this release is

A maintenance release: no features, behaviour-neutral unless the CHANGELOG says otherwise. The goal is a codebase that can grow in 1.3.0+: no zombie code, no duplicated subsystems, low cyclomatic complexity, single-responsibility modules, and guardrails that stop the rot from coming back. About 270 bisectable commits in six waves of increasing risk:

| Wave | What | Commits |
|---|---|---|
| W0 | Setup: measure what could not be measured read-only, make grep trustworthy, persist the audit | 5 |
| W1 | Safety net: test helpers, contract and sync tests, the ratchet, the H1/H2 tooling, CI | ~22 |
| W2 | Proven deletions: unreachable files, dead declarations, the authorized command removals | ~78 |
| W3 | Guardrails on: ESLint and tsc strictness staged so the gate is never red, ruff, docs | ~19 |
| W4 | Logging programme, then low-risk de-duplication and complexity work | ~100 |
| W5 | Structural refactors, each only after its characterization test | ~50 |

## B. Maintainer decisions (2026-09-18, final)

1. **Scope: everything, in waves.**
2. **Authorized user-visible changes**, each with a CHANGELOG line: remove the `CodeXR.helloWorld` scaffold command; hide `codeXR.pythonEnv.debugFailInstallation` from the palette (it deletes the user's venv with no gate); delete the registered commands nothing can invoke, including `debugThemeProblem.ts`. That is **17** ids, not 18: `codexr.servers.refreshServers` is a Legacy alias published in 1.1.0 and stays, fenced in the command contract test.
3. **Logging: the full migration, done properly.** A vscode-free sink first, a tight ratchet from the start so every intermediate state is shippable, one commit per module worst-first, `no-console` with an allowlist as the close. It is the fourth user-visible change (diagnostics move from the DevTools console to the "CodeXR" output channel) and gets a CHANGELOG line.
4. **Delete** the abandoned visual-style feature (TS asset, 236-line runtime, its test) and the empty integration-test lane.
5. The `cleanup` skill is amended: one item = one bisectable commit (sessions batch commits), and line-level doc-drift fixes travel with the commit that causes them; docs and history sections are never deleted.

Anything else that changes behaviour is **record-only for 1.3.0** (section 4 of the sequencing body below).

## C. Tool-measured baseline (2026-09-18, branch point `2d301577`, Windows, CRLF working tree)

| Gate / artefact | Value |
|---|---|
| `npm test` | **554 / 554** pass, ~29 s (0 ESLint messages today) |
| `npm run test:python` | 29 / 29 |
| `npm run test:analysis` | green: 24 root fixtures + 3 deep |
| Production build (`CODEXR_NO_SOURCEMAPS=1 npm run package`) | `dist/extension.js` 1,257,031 bytes, sha256 `d6e5cb0da40865fb…`, **deterministic** (two builds, same hash) - so the H1 standard is usable |
| VSIX | 6,450,820 bytes, 360 entries |
| tsc flag fallout | `noUnusedLocals` 55 (28 TS6138 + 27 TS6133, 48 files) · `noUnusedParameters` 17 · `noImplicitReturns` **0** · `noFallthroughCasesInSwitch` **0** |
| ESLint candidate fallout | `no-console` 1,646 · `no-explicit-any` 219 · `no-unused-vars` 32 · `no-require-imports` 26 · promoting the 5 existing rules to error: 0 |
| ESLint size distributions | `complexity` p90 6 / p95 9 / p99 17 / max 70, over 15: 38 · `max-lines` (skip blank+comments) over 500: 9 · `max-lines-per-function` over 80: 40 · `max-depth` over 4: 5 · `max-params` over 5: 30 |

Source metrics come from `test/tooling/measureGuardrails.cjs` (one counting unit per metric, spelled out in the baseline's `definitions`): 369 files · 52,974 lines · 2,864 functions · CCN >10/15/20/30 = 81/31/10/6 (worst `buildExportManifest` 61) · 54 unreachable modules (2,317 lines) · `console.*` 1,646 · console-only catch blocks 65 · `any` 219 · suppressions 0 · 19 files over 500 lines · `templates/` `console.log` 117. The older table in the status doc used grep-based commands (52,605 lines, 193 `any`); the script's numbers supersede it.

Threshold decision from these distributions (W3): `complexity` 15, `max-depth` 4, `max-params` 5, `max-lines-per-function` 80, `max-lines` 500 - all as `warn`, with `--max-warnings` set to the measured count.

## D. Per-commit protocol

1. One item = one commit, conventional-commit subject. Commits that remove visible surface are `refactor!` / `chore!`, never `feat`.
2. **Before touching file F**: `grep -rn "<basename>" test/ scripts/`, paste the hits into the commit message, classify each pin. **G** permanent guard: keep it; if F is split, retarget the haystack (`readConcatenated` + a canary) in the same commit. **S** shape pin (exact signature, cast, import line, adjacency): a behavioural characterization must land in a prior commit, green against the unchanged source. **L** log-literal pin (five sites): the text survives verbatim. Also grep the **import lines** of F: an orphaned import plus `no-unused-vars` can turn a text-pinned import red.
3. **Deadness proof, four checks**: zero importers (static, `import()`, `require`) · no name or path-string reference in `src/ templates/ test/ scripts/ webpack.config.js package.json` · registers no command · no test reads it as text. For an **unreachable branch**: a dataflow argument plus a test that pins the precondition.
4. **Characterization standard**. **H1** (deleting an unreachable file, or a types-only change): `dist/extension.js` sha256 identical between parent and HEAD, production build, same machine. **H2** (dead declaration inside a live file): reviewed dist shrink, no unexplained inserted lines.
5. **Gate**: `npm test` on every commit; plus `test:python` (Python), `test:analysis` (parsers, `executePython`, export, Python), `package:vsix` + zip listing (assets, `files`), the matching browser harness (runtimes; needs `npx playwright install chromium`, never part of required CI). A red gate ends the session at the last green commit. Never run a blanket `eslint --fix`.
6. **Measurement**: the ratchet is tight - it fails when a metric gets worse and also when it gets better without regenerating the baseline, so the `guardrail-baseline.json` diff is each item's recorded before/after.
7. `+F5` checks are human-only: batch them per session as a checklist for the maintainer.
8. **Never touch**: git history, `Legacy*` aliases, the 1.1.0 -> 1.2.0 settings migrations, the `xr_field_schema.py` <-> `xrFieldSchemaService.ts` contract, the eight lazy `require()` calls in `ModularTreeDataProvider`, the dispose-before-close order in `HttpServer.stop()` (a shipped deadlock fix).

## E. Override table - these rulings win over the rows in the sequencing body

The body below was written before the critic's review and before anything could be measured. Check this table first.

| Row(s) | Ruling |
|---|---|
| W1 order | runner fixes (W1-15, W1-16) -> W1-01/02 -> W1-03 -> helpers (W1-04, W1-05) -> W1-06 -> W1-07 -> contract and sync tests -> **ratchet** (moved up from W3-07) -> dist fingerprint scripts -> **CI last** (a clean checkout has no `dist/`, and the package job needs the fingerprint script) |
| W1-03 | Take it as written: the unit suite stops requiring `dist/extension.js`. Do **not** add `compile` to `test:basic` (ts-loader type-checks again and copies templates on every commit) |
| W1-04 | Helper only, no mass conversion. Retarget a test's haystack in the commit that splits the file it reads. Fix the already-vacuous negative in `reanalysisArchitecture.test.cjs:143` (literal `\r\n`) |
| W1-05 | One hook, `Module._load`; accepts an async callback; always purges `out/**` modules it loaded, including `out/core/logging/*`; real enum values (`ExtensionMode` Production=1, Development=2) |
| W1-07 | Depends on W1-05: static extraction cannot see the 28 dynamically built ids, so the test executes the real `registerAllCommands` under the fake vscode. `kind: 'legacy-alias'` entries are exempt from "must be referenced" |
| W2-20 / W2-21 | First delete the dead dispatch **root**: `ModularTreeDataProvider.handleItemClick` and `handleContextMenu` have zero callers (verified 2026-09-18). Then the six section-provider layers, one per commit |
| W2-22 / W2-23 | Strict flags live in a new `tsconfig.check.json` used only by `typecheck`; `compile`, `compile-tests` and ts-loader stay on the base config, so a transient unused symbol never breaks the F5 build. Measured fallout is 32 + 55, under the "enable by glob" threshold |
| W2-57 | Also decide the three diagnostic sites `followAndTransform.js:565-567`, `:573-581`, `pointerAndDrag.js:104` |
| W2-69 | Also fix `DEVELOPMENT.md:36` ("despite `@types/mocha` being present") |
| W3-05 | `noUnusedParameters` measured at 17 (<= 20): turn it on inside `tsconfig.check.json` with the `_` convention |
| W3-07 | Moved to W1. Dead exports (`X`) are **not** ratcheted - a parse-only census is unreliable across `export *` |
| W3-09 | Thresholds from section C |
| L01 | Label `refactor(logging)!`. `logPolicy.ts` gates `info` exactly like `debug`, so "named info exceptions" buy no production visibility |
| L02 | Dropped, with ERR-04a. The 1:1 per-module rule (a `console.log` inside a catch maps to at least `warn`) replaces it; named exception: the Python stderr chatter at `executePython.ts:529-545` |
| T01-T06 | Order: T03 (collapse the recovery branch that cannot recover; `progress.report` at `:257` is unreachable) -> T01 (three reachable reports) -> T02 -> T04 -> T06. T06 needs a behavioural `parsePythonOutput` test first and keeps the pinned tokens `options: { silent?: boolean } = {}`, `if (options.silent) {`, `return JSON.parse(trimmedOutput);` |
| T38 | Per-file local helpers, four throwing sites only. A shared module orphans `SessionWatcherManager`'s import, which a test pins |
| T53 | Also fold `AUTO_AVATAR_ID` (`collaborationRoomServer.ts:117`) and the shadowing `VALID_AVATAR_IDS` (`:127`) |
| T54 | Record-only for 1.3.0 (a user-visible leak fix) |
| P19 | Share only the progress emitter and the run body; each `main()` stays per file. Otherwise cut |
| R02 | Narrow to `remove()`; the attach path is already tested |
| W5-01..06 | **Composition, not a base class** (`GitAnalysisSessionContext` + `SingleJobGate`, per DESIGN_STRUCTURAL T2): text pins force the constructor wiring, `getAvailability`, `getSession` and `filterSources` to stay in each service file. `toPortableRelativePath` and the bridge replies are pure helpers with no pins: they move to W4 as single helper-plus-consumers commits |
| W5-04 | The unreachable guard needs the dataflow argument plus a precondition test; otherwise 1.3.0 |
| W5-08 | Gate on W5-01; the project-evolution harness never loads the service |
| W5-13 / W5-14 | Test edit `remoteAccessImplementation.test.cjs:191` lands in W5-13, `:190` in W5-14. W5-18 also lists `analysisTreeBridge.test.cjs:12`. Carried properties are 15, not 17: derive the list from source |
| W5-21 / W5-22 | Use the slices S3-S6 of DESIGN_STRUCTURAL T1. S6 (`stop`/`forceStop`) is the cut line. The validate hook is deferred. `getFullConfig` has zero callers: delete it with `dup-servers/DEAD-01` |
| W5-24 | `CollaborationRoomServerOptions` and `CollaborationApplicationMessageContext` stay in the class file (text-pinned) |
| W5-27 / W5-28 | Rewrite the frame-parity test to load `out/.../mediaFrame.js` first. Cut-line candidate |
| W5-30..32 | The factory stays in `src/servers/runtime/` (the `staticRoot` default is `__dirname`-relative). Behind W5-29 |
| W5-35 / W5-36 | Adopt DESIGN_STRUCTURAL T6d: format module + `withServer` only. The action catalogue is 1.3.0 (`appendRemoteActions` emits two `remoteStatus` entries) |
| W5-37 | In-file extraction only; otherwise a characterization commit, W1-04 retargeting and the immersive harness gate |
| W5-53..55 | **Cut to 1.3.0.** Nothing moves into `templates/components/common` in 1.2.1 (the DOM scene never loads it; exports refresh only `codexr/`). Land only the identical-bodies sync test |
| W5-57 | Only the `pythonCommandRunner.ts` slice. The venvManager split is 1.3.0 |
| W5-58 | **Deleted.** No formatter setting satisfies the quote styles the tests pin |
| runtime DUP-07 | Refuted: docs note only |
| runtime CPX-02 | Keep the seven positional parameters; extract only the guard and the band-state helper |
| `dA` gate | Means H1: the production build, not `npm run compile` |
| "CI required" | Needs a branch-protection change on `master` - maintainer only |
| New items | Gate the 29 ungated `console.log` in the two SSE live-reload clients behind the existing `DEBUG_MODE` convention · `.sort()` at `livePanelParser.ts:93` · the Python contract do-not-touch list goes into the W0-05 docs |

---

## F. Sequencing body (dependency graph, ordered commits, batching, 1.3.0 register, exit criteria)

> Written read-only on 2026-09-18, before the critic review. Section E above overrides it.

This roadmap orders about 270 commits across waves W0-W5. Everything in it rests on reading source and audit material: no build, lint, or test was run, because `node_modules` is absent. Any number that depends on `tsc` or eslint fallout (sections 1D and W3) is still open and must be measured when the commit is written.

### 0. Facts verified in source (the design rests on these)

**Branch state**
- The local checkout is `master` and is clean.
- `origin/v1.2.1` is at 2d301577, which is master plus 7 doc files: `.claude/skills/cleanup/SKILL.md`, `.claude/docs/V1.2.1_STATUS.md`, CHANGELOG and others.
- No local `v1.2.1` branch exists yet.

**Test runner and gate**
- `package.json:756`: `compile-tests` never cleans `out/`.
- `package.json:758`: lint is `eslint src` with no `--max-warnings`.
- `package.json:760`: `test:basic` is typecheck, lint, compile-tests, test:unit. `test:python` is not inside `npm test` (`:763`).
- `test/runners/run-node-tests.cjs:39` runs every suite in one process (`--test-isolation=none`), and `:15-17` skips `test/runners/`. Consequently, any `require` interception or `require.cache` entry leaks between suites unless it is restored.
- `test/analysis/analysisNamespace.test.cjs:29` requires `dist/extension.js` to exist, so `npm test` has an undeclared build prerequisite.

**Logging**
- `src/core/logging/logger.ts:1` imports vscode, and `:88-90` drops every line while no channel exists.
- `src/core/logging/logPolicy.ts` has zero imports. A vscode-free sink can be built on top of it.

**Fake-vscode precedent**
- The precedent patches `Module.prototype.require`, not `Module._load`. It lives at `test/analysis/livePanelDomIntegration.test.cjs:54-60`, with the restore at `:83-90`.

**Text and barrels**
- `chartDataSlice.js:125` holds the only NUL byte in any tracked text file under src, templates, test or scripts (full scan done).
- `src/code_analysis/engine/index.ts` has zero importers.
- The `core`, `processors`, `parsers` and `utils` barrels are imported only by it (`:7,:10,:13,:23`).

**Commands**
- `src/commands/index.ts:15,:53` registers `DebugThemeProblem`.
- `:54-61` registers helloWorld.
- `:63` calls `assertUniqueCommandIds`.
- The 18 unreachable registered ids break down as 14 (CMD-01) + 2 (CMD-04) + 1 (CMD-06) + `codexr.servers.refreshServers` (`src/commands/common/generalCommands.ts:28-30`, described as "Legacy server tree refresh alias").
- The 18th id is off-limits under the branch rule on Legacy aliases. The plan therefore deletes 17 and fences 1. This conflicts with decision (2) and needs the maintainer's confirmation.

**Python test harness**
- `test/python/xr_schema/test_xr_schema.py:46` assigns `sys.modules['lizard']` at import time and never restores it.
- `test/runners/run-analysis-tests.cjs:75` installs unpinned lizard. The extension pins `1.17.31` at `src/python_env/runtime/pythonPackageManifest.ts:13`.
- `test/runners/run-python-tests.cjs:76-82` exits 0 when no interpreter is found.

**Export and active-analyses**
- `src/code_analysis/export/exportManifest.ts:502`: `refreshRuntimeCopies` walks only `templates/components/codexr`. Widening it changes what a re-export overwrites, so it needs a CHANGELOG line.
- The `active_analyses` trio (provider 156, items 211, model 236 lines) plus `index.ts` (11 lines) have no importers outside themselves.

**Logging volume**
- `console.*` total is 1,652.
  - By directory: `code_analysis/engine/utils` 175, `servers/runtime` 168, `code_analysis/views/subsections` 110, `code_analysis/configuration` 105.
  - Of those 105, 90 disappear when `configurationManagerExample.ts` and `debugThemeProblem.ts` are deleted.
- No test asserts on `console.*` call shapes.
- 44 test files read source as text.

**Webpack config**
- Three tests read `webpack.config.js` as text: `analysisPaths.test.cjs:17-20`, `reanalysisArchitecture.test.cjs:65`, `httpsCertificates.test.cjs:92-95`.
- They pin only the python copy and the certs exclusion. PKG-03 does not break them.

**Baseline drift to record in W0**
- STATUS says 52,605 lines and 193 any-escapes; the audit says 52,974 and 203. The counting commands differ.
- Pin one command per metric.

**Gate codes**

| Code | Meaning |
|---|---|
| `G` | `npm test`, run on every commit |
| `+P` | `npm run test:python` |
| `+A` | `npm run test:analysis` |
| `+V` | `npm run package:vsix` plus inspection of the zip list and size |
| `+H:x` | the named harness script |
| `+F5` | dev-host smoke via the verify skill |
| `dA` | `dist/extension.js` sha256 identical before and after `npm run compile`. Applies to deletions of unreachable files. |
| `dB` | reviewed dist shrink. Applies to declarations removed from reachable files. |

Universal rule, not repeated below: paste `grep -rn "<basename>" test/ scripts/` into the commit message as the test-impact list.

**Measurement codes**

| Code | Metric |
|---|---|
| `L` | src files and lines |
| `U` | modules unreachable from `extension.ts` |
| `X` | dead exports |
| `C` | commands declared / registered / unreachable |
| `K` | `console.*` total and per module |
| `A` | any occurrences |
| `Q` | CCN of the named function, plus the counts over 15, 20, 30 |
| `F` | files over 600 lines |
| `D` | duplicated lines for the named pair |
| `Vz` | VSIX bytes and entry count |
| `Wn` | the `eslint --max-warnings N` value |
| `Py` | Python lines, CCN, duplication % |

### 1. Dependency graph (X -> Y means X lands before Y)

**A. Proof and tooling integrity**
1. NUL fix (W0-02) -> every repo-wide grep proof in W2, the uncalled-function rescan (runtime DEAD-03), and linting `templates/` (W3-12).
2. Measurement script (W0-03) -> every commit's before/after number, and the ratchet test (W3-07).
3. Proof-standard docs (W0-05) -> all of W2. They add the fourth check, "no test reads the file by path", and the two-tier dist standard.
4. `compile-tests` cleaning `out/` (W1-01) -> every deletion. Otherwise suites requiring `out/**` stay green against deleted modules.
5. Removing the dist prerequisite (W1-03) -> CI (W1-22).
6. CI non-required (W1-22) -> CI required on two operating systems (W3-19), after one watched Linux run.
7. The single-process runner (`run-node-tests.cjs:39`) -> the fake-vscode helper must restore `Module.prototype.require` and purge `require.cache`. This applies to everything in item 9 below.

**B. Test-shape prerequisites**
8. `readConcatenated` negative-assertion helper (W1-04) -> every commit that moves code out of a file:
   - hist DUP-05, DUP-06A, analysisViewModes, CX-10, hist DUP-01/02/03/04;
   - BOIL-01A/B, CPLX-08;
   - servers DUP-01, the WebSocket scaffold, SPLIT-01..04.
9. `fakeVscode.cjs` (W1-05) -> the logger contract test (W1-06) -> the sink (W4-L01).
   - The helper also gates the delta parity test (W1-12), the smoke tests (W1-19), hist TEST-01, the ModularTree characterization, and CPLX-15.
   - It gates the SPLIT-03/04 harnesses, the HTTPS lifecycle characterization, and the MENU-01 contextValue test.
10. `commandSurface` test plus the legacy-alias fence (W1-07) -> CMD-01A/B/C, CMD-02, CMD-03, CMD-04, CMD-06.
    - Each of those commits shrinks the seeded `UNREACHABLE_TODAY` list.
    - The test must compare ids with `===`, because `codexr.servers.refresh` is a prefix of `...refreshServers`.
11. Guard-list versus copy-list pin in fileXRParser (W1-08) -> CPLX-03a/b/c.
12. Language-table snapshot (W1-10) -> the deletion of `views/common/supportedLanguages.ts`. The unification itself is 1.3.0.
13. `runtimeAssembly.cjs` <-> `runtimeAssembly.ts` parity (W1-11) -> BOIL-01B, any assembly change, and the `refreshRuntimeCopies` widening.
14. Avatar-id sync test (W1-13) -> AVATAR-01 TS consolidation.
15. Controller-view map sync test (W1-14) -> the physical move in runtime DUP-03.
16. `test_xr_schema` leak fix (W1-15) -> all new Python characterization tests (DUP-05 fallback, DUP-02 and CPLX golden, DUP-01 golden).
17. Pinned lizard in the runner (W1-16) -> extension-coverage test (W1-17) -> the DUP-01 rewrite.
    - The pin also gates every Python golden and TYPE-02, whose types are derived from passing Python tests.
18. Resources consumer test using path segments, with `resources/avatars/**` fenced (W1-20) -> PKG-01, PKG-02', PKG-04'.
19. DOM-template-has-no-`common/` assertion (W1-21) -> any helper move into `common/`.

**C. Deletion cascades**
20. Zero-byte files (W2-01) -> the barrel sweep skips them.
21. tsconfig excludes (W2-02) -> lane (b) (W2-72, same file) and the LINT-08 flags.
22. Engine barrel chain (W2-04) -> ZOMBIE-11/05/06, ZOMBIE-07, EXPORT-03, all as pure file deletes.
23. Remaining barrels (W2-05) -> serverItems.ts, handlePythonEnvActions, browseVisualizationsTreeView, learn_more/views.ts, the servers/views stale provider, the active_analyses trio, and CodeAnalysisItemFactory.
24. fileRequirements.ts -> requirementRules x4 (with `ARCHITECTURE.md:30` and `:49`) -> LivePanelDirectoryRequirements plus 4 test assertions -> the negative guards (W2-73).
25. directoryFilter.ts -> the dead cluster in fileHashCalculator. The stale JSDoc at `:123` sits inside that cluster.
26. Whole-file deletions -> the unused-symbol hinge (LINT-04, then `noUnusedLocals`) -> in-file deletions. Orphaned imports then fail the gate mechanically.
27. LINT-04 removes the sole `DimensionMappingCleaner` import at `chartTypeFile.ts:11` -> `dimensionMappingCleaner.ts` becomes a zero-importer file (dup-assets DEAD-02) -> the DUP-03 chart-type core.
28. Python `examples/` -> the progress and warning API in progress_logger. Python DEAD-01 twin -> the DUP-09 rename.
29. runtime/index.ts wrappers -> the PortManager statics. The re-export block at `:13-16` stays. It is pinned by `virtualScreenRuntime.test.cjs:157-158`.
30. servers DEAD-01 -> the DUP-01 HTTPS base, which folds in DUP-03a -> DUP-02 (optional).
31. DEAD-05 -> SPLIT-03.
32. Click-layer deletion (W2-21) removes the ServerActionHandlers callers at `handleActiveServerClicks.ts:71,:89` -> the SPLIT-04 facade shrinks. servers DEAD-02 -> the getServerConfig dedupe -> STRUCT-01 docs.
33. `getStatusIcon` deletion -> CPLX-10b/c.
    - DimensionValidator statics -> CPLX-12.
    - Hist references field becoming a local, plus hist DEAD-02 -> hist DUP-02 and DUP-04.
    - Visual-style deletion -> BOIL-02 -> BOIL-01, and the COMPONENTS.md docs.
34. CMD-04 plus ZOMBIE-04 -> logging of `code_analysis/configuration` (105 drops to about 15) and ERR-03 (4 fewer sites).
35. Lane (a) -> lane (b), which refreshes the lockfile -> the lint root list in W3-11.
36. W2 complete -> the ratchet pins `U=0`, `X=0`, `C.unreachable=1` (W3-07).

**D. Guardrails**
37. LINT-02 -> LINT-01 (the 5 existing rules become error, with `--max-warnings 0`).
    - Backlog rules then land as warn, with `--max-warnings N` set to the measured count in the same commit: LINT-07, LINT-06/CPLX-22, LINT-05.
    - LINT-03a follows. The assembled-runtime measurement from W0-03 gates LINT-03b, because part files are syntactic fragments.
38. LINT-08: one flag per commit. `noFallthrough` -> `noImplicitReturns` (characterize any forced edit) -> [`noUnusedLocals` at the hinge] -> `noUnusedParameters` (after W2-44 removes 3 hits).
39. Ratchet (W3-07) -> every logging module commit.
40. ruff (W3-15) -> Python refactors. The formatter pass and the PYTHON_ANALYSIS.md update come last.
41. Warn thresholds (W3-09) -> closing tighten (W5-57).

**E. Logging**
42. fakeVscode -> the logger contract test -> the sink (vscode-free, with a pre-init buffer and a console fallback) -> ERR-03 -> module commits worst-first -> the no-console closing.
43. CPLX-02 (stderr classifier) -> executePython migration (CPLX-04) -> CPLX-06 -> CPLX-05 -> recovery-branch collapse -> finishAnalysis -> TYPE-02.
44. CPLX-14 debug-block deletion -> parsers migration.
45. servers DEAD-01, DEAD-05, DEAD-06, the click layers, and the fileHashCalculator cluster -> their module logging commits, which then have fewer sites.
46. Full migration -> the W5 file splits. Splits then move logger calls, and the per-module ratchet cannot trip.
47. runtime DUP-01 (LivePanel SSE) -> runtime LOG-02.

**F. Refactor chains**
48. History and export:
    - TEST-01 -> DUP-01 -> references becomes a local -> DUP-02 (the base owns the parameter properties; getReferences folded in) -> DEAD-02 -> DUP-04 -> DUP-03 -> redundant-validate removal -> CX-05 -> CX-10.
    - DUP-08/CPLX-11 -> CX-03.
    - DUP-07' (module-private classifier) -> CX-02.
    - Gap tests -> CX-01, CX-02, CX-07.
49. ModularTreeDataProvider:
    - Characterization (registry transcription plus the 17-property snapshot) -> CPLX-01/BOIL-03, with the table inside the file and the literals kept.
    - -> CPLX-07, which carries the test edits at `remoteAccessImplementation.test.cjs:189-191` and `analysisTreeBridge.test.cjs:19-20` in the second commit.
    - -> CPLX-08 in 3 commits -> TYPE-01, using `import type` only, with the 8 `require()` calls staying.
    - Typing order: TYPE-03 -> TYPE-02 -> TYPE-01.
50. Component assets: BOIL-02 -> BOIL-01A -> BOIL-01B -> the room and guideScreen follow-ups.
51. Chart type:
    - Alias commit, DEAD-02, and the vacuous `filterByMode` deletion -> DUP-03.
    - DUP-04A is independent.
    - DUP-04B is blocked by the text pins in `dimensionMappingShared.test.cjs`.
52. Servers:
    - WebSocket scaffold plus `DEFAULT_ROOM_ID` -> SPLIT-01 and SPLIT-02.
    - DUP-05, DUP-06, DUP-04' -> SPLIT-04 commit 2.
    - SPLIT-04 commit 1 must carry `getServerLabel`, `formatRemoteStatus` and `formatPendingRequests`.
    - The table in commit 3 must be keyed on (action, label), not on action alone.
53. Python:
    - DUP-03 -> DUP-02 (golden first) -> the `_ensure_external_node` extraction in CPLX-02 (a hard prerequisite).
    - DUP-02 and DUP-03 -> CPLX-01.
    - CPLX-02 golden -> the CPLX-03 brace fixture.
    - Class-counter golden -> DUP-01 -> DEAD-06b CLI removal, with the HYG-05.1 imports.
    - Lazy getsize -> DUP-07 -> DUP-08 -> HYG-02'. Only `line_metric_utils.py:15` is left to narrow, because DUP-07 deletes the other site.
54. Runtime JS:
    - `refreshRuntimeCopies` widening (test plus CHANGELOG) -> DUP-02 helper move, using hard calls -> DUP-03 physical -> DUP-07 accessors.
    - A characterization test comes before each of CPX-01, CPX-02 and CPX-03.
    - The ar-fill-light test -> DUP-04.
55. Packaging: verify the vsce README-link rewrite -> PKG-04'. PKG-03 lands last, with `+V` and `+F5`.
56. contextValue test -> MENU-01 regex trim (optional).

### 2. Ordered commit list

#### W0 — setup (5 commits)

Step 0 is not a commit:
- `git switch v1.2.1`, then `npm ci`.
- Run `G`, `+P`, `+A`, `+V` once.
- Record the VSIX bytes and the sha256 of `dist/extension.js`.

| # | Subject | Findings | Files | Needs | Gate | Measure |
|---|---|---|---|---|---|---|
| W0-01 | test(runtime): pin chart-row de-dup by composite key | runtime TOOLING-01 (characterization) | test/analysis/xrChartMappingUiRuntime.test.cjs | - | G | suite count +1 |
| W0-02 | fix(templates): escape the row-key separator instead of a raw NUL | runtime TOOLING-01 | templates/.../xrChartMappingUiRuntime/chartDataSlice.js:125 | W0-01 | G; NUL scan returns 0 files | NUL-bearing text files 1 -> 0 |
| W0-03 | test(tooling): commit measure-guardrails.cjs and its generated baseline, with no assertions | LINT-09 (part), runtime TOOLING-02 | test/tooling/*, test/manual/buildAssembledRuntimes.cjs (read only) | - | G | full baseline table |
| W0-04 | docs(1.2.1): re-baseline STATUS to the 2026-09-17 audit; add waves and the record-only register | all record items | .claude/docs/V1.2.1_STATUS.md | W0-03 | - | - |
| W0-05 | docs(architecture): deadness proof (4 checks), dist tiers A/B, barrel policy, export convention, "one item per commit" batching | BARREL-03, NARROW-01(3), barrels MISSED x2 | ARCHITECTURE.md, DEVELOPMENT.md, skills/cleanup/SKILL.md | - | - | - |

#### W1 — safety net (22 commits)

| # | Subject | Findings | Files | Needs | Gate | Measure |
|---|---|---|---|---|---|---|
| W1-01 | build(test): compile-tests removes out/ first | tooling MISSED | package.json:756 | - | G | `out/**/*.js` count equals src `.ts` count |
| W1-02 | build(test): test:unit refuses a stale out/ | tooling MISSED | run-node-tests.cjs or package.json:761 | W1-01 | G | - |
| W1-03 | test(packaging): unit suite stops requiring dist/ (guard moves to package-vsix.mjs) | manifest MISSED | analysisNamespace.test.cjs:29, scripts/package-vsix.mjs | - | G on clean checkout; +V | - |
| W1-04 | test(helpers): readConcatenated file-sets for negative source assertions | hotspots MISSED | test/helpers/sourceText.cjs; xrDataSource, uiPolicy, reanalysisArchitecture, analysisTreeBridge, directoryAnalysisStartup, dimensionMappingShared, historicalComparison | - | G | single-source negatives over src converted |
| W1-05 | test(helpers): shared fakeVscode with scoped restore and cache purge; adopt in the two ad-hoc loaders | LOG-01 (b), hist TEST-01 precedent | test/helpers/fakeVscode.cjs, livePanelDomIntegration.test.cjs:54-90, historicalComparison.test.cjs:16-74 | - | G | - |
| W1-06 | test(logging): pin the CodeXRLogger contract, including the pre-init drop | tooling MISSED, TEST-04(2) | test/logging/logger.test.cjs | W1-05 | G | - |
| W1-07 | test(commands): registered-versus-contributed contract; fence the four legacy aliases | CMD-05, tooling MISSED, dup-servers MISSED | test/commands/commandSurface.test.cjs, generalCommands.ts (comment) | - | G | C = 70 / 123 / 18 seeded |
| W1-08 | test(analysis): pin fileXRParser guard list as a subset of the copy list, plus comment | hotspots MISSED | test/analysis/xrRuntimeManifestAsymmetry.test.cjs, fileXRParser.ts:174 | - | G | - |
| W1-09 | test(analysis): pin the 16 watcher extensions outside the metric contract | python MISSED x2 | new `.cjs` next to analysisPaths.test.cjs | - | G | - |
| W1-10 | test(utils): snapshot both language tables, including today's divergences | dup-assets DUP-02' | new test | - | G | - |
| W1-11 | test(analysis): helper assembly equals production assembly | dup-assets MISSED | new test over out/.../runtimeAssembly.js | - | G | - |
| W1-12 | test(analysis): buildDelta and buildOfflineDelta parity | hist MISSED | test/analysis/offlineHistoricalDelta.test.cjs | W1-05 | G | - |
| W1-13 | test(collaboration): avatar ids agree across TS and both runtimes | AVATAR-01(2) | new test; collaborationRoomServer.test.cjs:324 | - | G | - |
| W1-14 | test(analysis): controller-view maps deep-equal across the two runtimes | runtime DUP-03(1) | analysisModeMegatest.test.cjs | - | G | - |
| W1-15 | test(python): stop leaking the fake lizard into sys.modules | python MISSED | test_xr_schema.py:36-59 | - | +P in both discovery orders | - |
| W1-16 | build(test): analysis runner installs the pinned lizard; test the pin equals the manifest | HYG-03'(1) | run-analysis-tests.cjs:75, new `.cjs` | - | G +A | - |
| W1-17 | test(python): extension coverage, not only language coverage | python MISSED | test/analysis/manual_metrics_suite.py, fixtures | W1-15, W1-16 | +A | - |
| W1-18 | test(python): golden snapshot of analyze_dependencies in directory and file mode | DUP-02, DUP-04, CPLX-01/02 (characterization) | test/python/dependencies/ | W1-15 | +P | - |
| W1-19 | test(smoke): visualizeDataModel and settingsStorage | TEST-04(1) | two new tests | W1-05 | G | - |
| W1-20 | test(packaging): every allowlisted resource has a consumer (path segments; avatars fenced) | PKG-01 guard, manifest MISSED | test/packaging/ | - | G | - |
| W1-21 | test(analysis): DOM scene template must not load common/ | runtime DUP-06 | virtualScreenRuntime.test.cjs | - | G | - |
| W1-22 | ci: npm test and test:python on windows-latest; ubuntu allowed to fail | TEST-01, tooling MISSED | .github/workflows/ci.yml | W1-03 | one watched run | - |

#### W2 — proven deletions (74 commits)

**W2a: whole unreachable files** (tier `dA` unless noted)

| # | Subject | Findings (merged) | Files | Needs | Gate | Measure |
|---|---|---|---|---|---|---|
| W2-01 | chore(src): delete five zero-byte modules | ZOMBIE-08', barrels MISSED | python_env/index.ts, views/analysis/index.ts, code_analysis/{config,model,runtime}/* | W1-01 | G dA | L; 4 directories gone |
| W2-02 | chore(tsconfig): drop four phantom excludes | ZOMBIE-18, TOOLING-02, TOOL-03, TEST-03, servers MISSED | tsconfig.json:30-33 | - | G; `tsc --listFiles` diff empty | - |
| W2-03 | chore(build): delete orphan esbuild.config.mjs | ZOMBIE-15, TOOL-02, HYG-01 | esbuild.config.mjs, DEVELOPMENT.md:74 | - | G | - |
| W2-04 | chore(engine): delete the unimported engine barrel chain (8) | dead-modules MISSED, BARREL-01/02 (part) | engine/{index,core,processors,parsers,utils,components,launchers,watchers}/index.ts | W2-01 | G dA | U, L |
| W2-05 | chore(src): delete the remaining 22 unimported barrels | BARREL-01/02 (rest) | the BARREL-01 list minus W2-01 and W2-04, plus code_analysis/commands/index.ts | W2-04 | G dA | U 54 -> about 22 |
| W2-06 | chore(engine): delete duplicate interfaces file | ZOMBIE-11, EXPORT-12a, barrels MISSED | engine/interfaces/fileRequirements.ts | W2-04 | G dA | L -52 |
| W2-07 | chore(engine): delete four pass-through requirement rules | ZOMBIE-05', EXPORT-11(1) | requirementRules/{VisualizeDOM,XRDirectory,XRFile,LivePanelFile}Requirements.ts, ARCHITECTURE.md:30,:49 | W2-06 | G +A dA | L -91 |
| W2-08 | chore(engine): delete the last requirement rule and the 4 assertions pinning dead code | ZOMBIE-06, EXPORT-11(2) | LivePanelDirectoryRequirements.ts, directoryAnalysisStartup.test.cjs:31,38, reanalysisArchitecture.test.cjs:132,145 | W2-07 | G dA | directory gone |
| W2-09 | chore(engine): delete directoryFilter.ts | ZOMBIE-07', EXPORT-04 | directoryFilter.ts, fileHashCalculator.ts:123 (JSDoc) | W2-04 | G dA | L -78 |
| W2-10 | chore(utils): delete fileDisplayUtils.ts | ZOMBIE-03, EXPORT-05 | src/utils/fileDisplayUtils.ts | - | G dA | L -277 |
| W2-11 | chore(config): delete ConfigurationManager and its example | ZOMBIE-04, EXPORT-07', assets MISSED, manifest MISSED x2 | configuration/configurationManager{,Example}.ts | - | G dA | L -357, K -44 |
| W2-12 | chore(servers): delete src/servers/config/ | ZOMBIE-12, EXPORT-06, servers DEAD-04 | defaultServerConfig.ts | W2-05 | G dA | L -45 |
| W2-13 | chore(active-servers): delete the duplicate tree-item file | ZOMBIE-01, servers DEAD-03, EXPORT-10b | active_servers/views/items/serverItems.ts | W2-05 | G dA | L -261 |
| W2-14 | chore(servers): delete the stale unregistered SERVERS provider | servers DEAD-02 | servers/views/unifiedServersTreeView.ts, serverNodeIcons.ts (keep handleConfigurationClicks and configurationItems helpers) | W2-05 | G dA | L about -255 |
| W2-15 | chore(analysis): delete the active_analyses provider, items, model | ZOMBIE-02', EXPORT-08, manifest MISSED x2 | 3 files, subsections/index.ts:7 comment | W2-05 | G dA | L -603 |
| W2-16 | chore(python-env): delete handlePythonEnvActions.ts | ZOMBIE-10, EXPORT-12b (part) | one file | W2-05 | G dA | L -43 |
| W2-17 | chore(learn-more): delete views.ts bridge | ZOMBIE-13, barrels MISSED | learn_more/views.ts | W2-05 | G dA | L -8 |
| W2-18 | chore(visualize-data): delete browse tree view and its orphaned factory method | ZOMBIE-09', barrels MISSED | browseVisualizationsTreeView.ts, visualizationItem.ts:38-53 | W2-05 | G dB | L -123 |
| W2-19 | chore(views): delete the stale language-table fork | assets DUP-01, tooling MISSED | views/common/supportedLanguages.ts, views/index.ts:11 | W1-10 | G dB | L -169 |
| W2-20 | chore(views): delete the unreachable servers click layer | servers MISSED(1) | views/servers/interactions/handleServerClicks.ts, index.ts:13, ServersSectionProvider.ts:100-141 | - | G dB | L -105 |
| W2-21 | chore(views): delete the unreachable active-servers click layer | servers MISSED(2) | handleActiveServerClicks.ts, ActiveServersSectionProvider.ts:177-186 | - | G dB | L -138, K -16 |

**Hinge: deletions become self-checking**

Fallback rule:
- If the measured fallout exceeds about 40 sites, move W2-23 to W3.
- In that case, gate W2b with `tsc --noEmit --noUnusedLocals`, requiring that the error count does not rise.

| # | Subject | Findings | Files | Needs | Gate | Measure |
|---|---|---|---|---|---|---|
| W2-22 | lint: no-unused-vars as error; drop the 14 unused imports | LINT-04', TOOLING-01 (part) | eslint.config.mjs, 14 files | W2-21 | G; byte-diff of out/.../chartTypeFile.js | unused imports 14 -> 0 |
| W2-23 | build(tsc): enable noUnusedLocals with fallout | LINT-08c, servers MISSED | tsconfig.json | W2-22 | G | fallout count |

**W2b: dead declarations in reachable files** (tier `dB`)

| # | Subject | Findings | Files | Needs | Measure |
|---|---|---|---|---|---|
| W2-24 | chore(settings): delete dimensionMappingCleaner.ts and 3 uncalled methods | assets DEAD-02 | chart_type_file/* | W2-22 | L -115 |
| W2-25 | chore(utils): delete 8 dead helpers | EXPORT-01', ERR-01 | nonceGenerator, uriPathConverter, languageMetadata, errorHandler, getVisualizationConfiguration | W2-23 | X -8, L -138 |
| W2-26 | chore(engine): delete the uncalled hashing cluster; keep FileHash | EXPORT-03 | fileHashCalculator.ts | W2-09 | L -145, K -24 |
| W2-27 | chore(commands): delete dead aggregator accessors | EXPORT-09', servers DEAD-08 (getter only), BOIL-05 (part) | 4 files | - | X -5 |
| W2-28 | chore(views): delete TreeViewUtils and two *Icons classes | EXPORT-10a | baseInterfaces.ts and 2 items files | - | L -71 |
| W2-29 | chore(types): delete three dead exported types | EXPORT-12a', hist MISSED | activeServerModel.ts:71-78, dependencyGraphModels.ts:77-91, historicalComparisonModels.ts:1-6 | - | X -3 (dA) |
| W2-30 | chore(engine): delete AnalysisSessionFactory and two dead predicates | EXPORT-12b' | analysisSession.ts:77-167, analysisFilePolicy.ts:90,:116 | W1-09 | L about -110 |
| W2-31 | chore(servers): delete 4 uncalled wrappers; keep the pinned re-exports | EXPORT-02', DEAD-07(1), dead-modules MISSED | servers/runtime/index.ts:29-38,54-80 | - | X -4 |
| W2-32 | chore(servers): delete PortManager statics orphaned by W2-31 | DEAD-07(2) | portManager.ts | W2-31 | re-grep |
| W2-33 | chore(https): delete the certificate-inspection API | servers DEAD-01 | httpsCustomServer.ts, httpsDefaultServer.ts | - | L -225 |
| W2-34 | chore(https): drop the discarded generateServerUrls call | servers MISSED | httpsCustomServer.ts:108 | W2-33 | note the removed log line |
| W2-35 | chore(servers): delete MultiServerLauncher's unreachable lifecycle half | DEAD-05' | multiServerLauncher.ts:233-318 | - | L -90 |
| W2-36 | chore(active-servers): delete six unreachable ServerControl statics | DEAD-06, MISSED import | serverControl.ts | W2-23 | L -150 |
| W2-37 | chore(analysis): delete uncalled getStatusIcon | hotspots MISSED, CPLX-10(a') | activeAnalysesDataService.ts:267-291 | - | Q -9 |
| W2-38 | chore(templates): delete 3 dead DimensionValidator statics | hotspots MISSED | dimensionValidator.ts:88-149 | - | L -60 |
| W2-39 | chore(historical): delete clearActiveComparison | hist DEAD-01 | historicalComparisonService.ts:127 | - | - |
| W2-40 | chore(watchers): delete fileHashTracker.isAnalyzableExtension | python MISSED | fileHashTracker.ts:42-44 | - | - |
| W2-41 | chore(commands): delete no-op getMainCommandRegistrations | manifest MISSED | analysisCommands.ts:79,84-89 | - | - |
| W2-42 | chore(analysis): delete CodeAnalysisItemFactory and its re-exports | tooling HYG-02'(1) | analysisItems.ts:39-67, views/index.ts:6, items/index.ts:6 | W2-05 | TODO markers -7 |
| W2-43 | chore(utils): delete CommonCommands.refreshServers shim | ZOMBIE-17 | commonCommands.ts | - | - |
| W2-44 | chore(settings): delete the duplicate CommandRegistration interface | assets DUP-07' | analysisDirectoryMode.ts:186-190, index.ts:6 | - | - |

**W2c: authorized user-visible removals.** Each carries a CHANGELOG `Removed` line, and each shrinks `UNREACHABLE_TODAY` in W1-07's test.

| # | Subject | Findings | Files | Needs | Gate | Measure |
|---|---|---|---|---|---|---|
| W2-45 | feat!(commands): remove 11 superseded setter commands | CMD-01A | viewTheme, analysisFileMode, autoAnalysisDelay (keep `setAutoAnalysisDelay`), autoAnalysisEnabled commands | W1-07 | G dB | C registered -11 |
| W2-46 | feat!(commands): remove two never-wired files-by-language commands | CMD-01B | filesByLanguageCommands.ts:26-42 | W1-07 | G | C -2 |
| W2-47 | feat!(commands): remove cleanAnalysis; keep the startup cleanup helpers | CMD-01C | cleanAnalysisCommands.ts:25-34,53-81,118-131, comment at :42 naming extension.ts:99 | W1-07 | G +F5 (startup cleanup) | C -1 |
| W2-48 | feat!(commands): remove visualizeData.debugState and handleDebugState | CMD-06 | visualizeDataCommands.ts:74-80, visualizationLauncher.ts:462 | W1-07 | G | C -1 |
| W2-49 | feat!(commands): remove the two debug theme commands and debugThemeProblem.ts | CMD-04, LOG-03', STATUS backlog #3 | debugThemeProblem.ts, commands/index.ts:15,:53 | W1-07 | G | C -2, K -46 |
| W2-50 | feat!(commands): remove the Hello World scaffold command | CMD-02, dead-modules MISSED, tooling MISSED | package.json:66-69, commands/index.ts:54-61, doc debt entries | W1-07 | G +V | C declared 70 -> 69 |
| W2-51 | fix(manifest): hide debugFailInstallation from the palette | CMD-03 | package.json commandPalette | W1-07 | G | palette debug entries -> 0 |
| W2-52 | chore(manifest): drop the redundant `"when": "true"` on the view | MENU-03 | package.json:489 | - | G +F5 (view renders) | - |

**W2d: templates, Python, assets, tooling**

| # | Subject | Findings | Files | Needs | Gate | Measure |
|---|---|---|---|---|---|---|
| W2-53 | chore(templates): delete unreferenced htmlLiveReload.js | runtime DEAD-01 | templates/xr/html/htmlLiveReload.js, XR_COMPONENTS.md:12 | W0-02 | G +V | Vz |
| W2-54 | chore(templates): delete uncalled baseName() | runtime DEAD-03 | datasetProjection.js:260-264 | W0-02 | G | - |
| W2-55 | chore(visual-style): delete the abandoned feature (asset, runtime, test) | ZOMBIE-14, assets DEAD-01, barrels MISSED, hotspots MISSED, runtime DEAD-02 | visualStyleComponentAsset.ts, codexrVisualStyleRuntime.js, codexrVisualStyleRuntime.test.cjs, xrDataSource.test.cjs:261-280 (becomes existsSync-false), XR_COMPONENTS.md:19 | W1-04 | G +A +V | L -380, Vz -7.4 KB |
| W2-56 | docs(components): project-evolution entry, DOM-without-common rule, picker stays standalone, CPX-05 exception | runtime DOCS-01, DUP-05, DUP-06, CPX-05 | templates/components/COMPONENTS.md | W2-55 | G (emoji policy) | - |
| W2-57 | chore(virtual-screen): delete two per-frame logs and pin them out | runtime LOG-01 | followAndTransform.js:589-607, pointerAndDrag.js:172-177, virtualScreenRuntime.test.cjs | - | G | - |
| W2-58 | chore(python): delete the dead livePanels reanalysis twin | py DEAD-01 | livePanels/file_reanalysis_coordinator.py | - | +P +A | Py -81 |
| W2-59 | chore(python): delete examples/ | ZOMBIE-16, py DEAD-02, manifest MISSED | python/examples/ | - | +P +V | Py -150, Vz |
| W2-60 | chore(python): delete the dead progress and warning logger API | py DEAD-03' | utils/progress_logger.py | W2-59 | +P | Py -45 (note that executePython.ts:518-519 becomes a no-op) |
| W2-61 | chore(python): delete seven never-called helpers | py DEAD-04' | xr_field_schema.py, metric_language_contract.py, directory_analysis_engine.py:9,60-65, directory_scan_utils.py:29-30 | - | +P +A | Py -30 |
| W2-62 | chore(python): drop the unread --output flag and the 'project' type | py DEAD-05 | main.py | - | G +P | - |
| W2-63 | chore(python): stop adding html/ to sys.path | py MISSED | main.py:21,:23 | - | +P, `test:htmlanalysis` | - |
| W2-64 | chore(python): delete the unreachable .st analyzer and dead aliases (keep .r) | py DEAD-07', MISSED .hh | python_comment_analyzer.py:40,42,52-53,240-260 | W1-09 | +P +A | Py -25 |
| W2-65 | chore(python): delete resume_only and the argparse CLI | py DEAD-08' | livePanel_file_analysis_coordinator.py | - | +P +A | the Output-channel debug text changes; state this in the commit body |
| W2-66 | chore(python): drop four redundant per-file stderr emissions | py HYG-01' | python_comment_analyzer.py:18,23,33,57 | - | +P +A | stderr lines per file -4 |
| W2-67 | chore(assets): delete resources/languages_icons/no_color/ | PKG-01, dead-modules MISSED, STATUS backlog #5 | 25 PNGs | W1-20 | G +V (file list identical) | working tree -34 MB |
| W2-68 | chore(test): delete the empty integration lane (config and script) | ZOMBIE-19(a), TOOL-01, TEST-02 | .vscode-test.mjs, package.json:764, DEVELOPMENT.md:33,:75, test/README.md:17 | - | G | scripts 23 -> 22 |
| W2-69 | chore(deps): drop @vscode/test-cli, @vscode/test-electron, @types/mocha and the "mocha" types entry | ZOMBIE-19(b), dead-modules MISSED x2 | package.json:775,781,782, tsconfig.json:11, package-lock.json | W2-02, W2-68 | `npm ci`; G +P +V | devDependencies -3 |
| W2-70 | docs(architecture): server-layer layering rule | STRUCT-01' | ARCHITECTURE.md | W2-13, 14, 20, 21 | - | - |
| W2-71 | docs(architecture): five VenvManager instantiation sites | hotspots MISSED | ARCHITECTURE.md | - | - | - |
| W2-72 | docs(architecture): module map gains code_analysis/export/ | hist DOCS-01 | ARCHITECTURE.md | - | - | - |
| W2-73 | test(cleanup): negative guards for the three most re-inventable deletions | dead-modules MISSED | analysisPaths.test.cjs style | W2-08, W2-19, W2-55 | G | - |
| W2-74 | docs(status): W2 re-measurement | - | V1.2.1_STATUS.md | all of W2 | - | U -> 0, X -> 0, C.unreachable -> 1, L at least 3,500 lines removed |

#### W3 — guardrails on (19 commits)

| # | Subject | Findings | Needs | Gate | Measure |
|---|---|---|---|---|---|
| W3-01 | lint: scope the parser block and add ignores (including manual_test/**) | LINT-02' | - | G | - |
| W3-02 | lint: the five existing rules become errors; `--max-warnings 0`; fallout in the same commit | LINT-01 | W3-01 | G | Wn = 0 |
| W3-03 | build(tsc): noFallthroughCasesInSwitch | LINT-08a | W2-02 | G | - |
| W3-04 | build(tsc): noImplicitReturns (characterize any forced edit first) | LINT-08b | - | G | edits listed |
| W3-05 | build(tsc): noUnusedParameters with the underscore convention | LINT-08d | W2-42 | G | - |
| W3-06 | build(tsc): drop "DOM" from lib, only if typecheck passes unchanged | tooling MISSED | - | G | else record |
| W3-07 | test(tooling): ratchet on console per module, any, files over N, U, X, C | LINT-09' | W0-03, W2-74 | G | pinned table |
| W3-08 | lint: no-explicit-any as warn; N raised to the measured count | LINT-07' | W3-02 | G | Wn |
| W3-09 | lint: complexity 15, max-depth 4, max-params 5, max-lines-per-function 80, max-lines 600, all as warn; N raised | LINT-06', CPLX-22 | W3-02 | G | Wn, distribution |
| W3-10 | lint: type-aware no-floating-promises and no-misused-promises as warn | LINT-05' | W3-02 | G (record lint time) | Wn up by about 278 |
| W3-11 | lint: add test, scripts, webpack.config.js, eslint.config.mjs as roots | LINT-03'a | W2-69 | G | JS lines linted |
| W3-12 | lint: standalone templates runtimes in a relaxed block; part directories ignored | LINT-03'b | W0-02, W0-03 | G | - |
| W3-13 | build(tsc): tsconfig.tooling.json checkJs for config and scripts | tooling MISSED | - | G | - |
| W3-14 | test(packaging): icon only if the command is in a rendering menu group (53 seeded); full menu-surface table | MENU-02', manifest MISSED | - | G | - |
| W3-15 | build(python): ruff config, lint:python, run-python-tests hard-fails under CI | HYG-04' | - | +P | ruff count |
| W3-16 | test(packaging): every npm script's target exists | manifest MISSED | - | G | - |
| W3-17 | docs(test): regenerate test/README.md and DEVELOPMENT.md:47-63; guard that every test:* script is documented | TEST-05', tests MISSED | - | G | 13 directories, 55 suites |
| W3-18 | docs(architecture): "what may be logged" rule | LOG-04 | - | - | - |
| W3-19 | ci: required on windows and ubuntu; add lint:python, test:analysis, vsix listing | TEST-01, tooling MISSED | W1-22, W3-15 | CI green twice | - |

#### W4 — logging programme, then low-risk de-duplication and complexity (about 95 commits)

**W4-L: logging**

Every commit from L05 onward does three things:
- it migrates the module to the logger;
- it adds the module's glob to the `no-console` error block;
- it lowers the ratchet.

The level-preserving mapping is:
- `console.error` and `console.warn` become `logger.error` and `logger.warn`.
- Path-bearing logs become lazy `logger.debug`.

| # | Subject | Findings | Needs | Gate | K |
|---|---|---|---|---|---|
| L01 | feat(logging)!: vscode-free sink with pre-init buffer and console fallback; logger.ts attaches the channel (CHANGELOG line) | LOG-01', tooling MISSED x2 | W1-06, W3-07 | G; logger test updated deliberately | - |
| L02 | refactor(errors): 65 console-only catch blocks go through the logger | ERR-03', ERR-04a | L01 | G | catch-only 65 -> 0 |
| L03 | test(python-runner): characterize stderr classification (4-line progress case, null cases) | CPLX-02 (characterization) | W1-05 | G | - |
| L04 | refactor(executePython): extract classifyStderrLine | CPLX-02' | L03 | G +A | Q 34 -> about 5 |
| L05 | refactor(logging): executePython.ts (126; keep the phrase at :166 verbatim) | CPLX-04', STATUS #4 | L04 | G +A +F5 | -126 |
| L06 | engine/utils rest (saveFiles and others) | LOG-01 | L01 | G | about -25 |
| L07 | servers/runtime core (launcher, http(s) servers) | LOG-01 | W2-33, W2-35 | G | about -110 |
| L08 | servers/runtime/{sse,http,analysis} | LOG-01 | L01 | G | -86 |
| L09 | code_analysis/views/subsections | LOG-01 | - | G | -110 |
| L10 | code_analysis/commands/subsections | LOG-01 | W2-45..47 | G | about -85 |
| L11 | chore(dom-parser): delete the effect-free debug loop | CPLX-14(1) | - | G | -12 |
| L12 | engine/{parsers,launchers,processors} | CPLX-14(2) | L11 | G +A | about -70 |
| L13 | engine/{watchers,servers,core} and engine root | LOG-01 | - | G | -88 |
| L14 | active_servers | LOG-01 | W2-36 | G | about -90 |
| L15 | visualize_data | LOG-01 | W1-19 | G | -108 |
| L16 | visualization_settings | LOG-01 | W1-19 | G | -83 |
| L17 | babia_templates | LOG-01 | - | G | -72 |
| L18 | views | LOG-01 | W2-20, W2-21 | G | about -100 |
| L19 | servers/{commands,utils,views} | LOG-01 | - | G | -62 |
| L20 | utils and babia_examples | LOG-01 | - | G | -99 |
| L21 | python_env, commands, core, remote_access, code_analysis/{services,configuration,historical,export,dependencies} | LOG-01 | W2-49 | G | remainder |
| L22 | lint: no-console as error for `src/**` with an explicit allowlist (sink.ts only) | LOG-02 | L05-L21 | G | 1,652 -> at most 5 |

**W4-T: TypeScript, in-file or pure-helper changes with an existing behavioural net**

| # | Subject | Findings | Needs |
|---|---|---|---|
| T01 | refactor(executePython): recoverXRResult, four progress.report strings preserved | CPLX-06' | L05 |
| T02 | refactor(executePython): spawnAndCollect discriminated union | CPLX-05' | T01 |
| T03 | refactor(executePython): collapse the recovery branch that cannot recover | hotspots MISSED | T02 |
| T04 | refactor(executePython): finishAnalysis helper | hotspots MISSED | T03 |
| T05 | types(watchers): directoryReanalysisData | TYPE-03 | - |
| T06 | types(python): typed analysis result (executePython only) | TYPE-02' | T04, W1-16; gate `npm run test:all` |
| T07 | refactor(fileXRParser): copy steps become a loop | CPLX-03'a | W1-08 |
| T08 | refactor(directoryXRParser): asset loop | CPLX-03'b | W1-08 |
| T09 | refactor(fileXRParser): guard list becomes a local array with `.some`, identical membership | new, from the CPLX-03 remainder | W1-08 |
| T10 | refactor(active-analyses): session-resolution prelude helper | hist DUP-08 = hotspots CPLX-11 | closeOutcome test first |
| T11 | refactor(active-analyses): icon tables and safeResourceUri | CPLX-10b/c | W2-37 |
| T12 | refactor(validator): five named rule functions | CPLX-12' | W2-38 |
| T13 | test and refactor(visualize-data): invalid-path resets | CPLX-13 | W1-19 (characterization commit first) |
| T14 | refactor(uri): resolver chain with a `!== null` gate | CPLX-15' | W1-05 (characterization includes `{fsPath:''}`) |
| T15 | refactor(reanalyzer): applyIncrementalChanges (keep the `options.notifyClients !== false` token) | CPLX-16' | - |
| T16 | refactor(refresh): runIfNeeded guard | CPLX-17 | - |
| T17 | refactor(deps): analyzeFileScope | CPLX-20 | - |
| T18 | refactor(visualize-data): one "field already used" predicate | CPLX-21 | - |
| T19 | test(export): manifest gap cases | CX-01 (characterization) | - |
| T20 | refactor(export): buildExportManifest phases | CX-01 | T19 |
| T21 | refactor(export): pure analysisViewModes table; exportManifest consumes it | hist MISSED | W1-04 |
| T22 | refactor(export): module-private classifyExportRevisionFailure with a table test | hist DUP-07' | - |
| T23 | test(export): content-hash de-dup and the under-2-sources cleanup | CX-02 (characterization) | - |
| T24 | refactor(export): runGitRevisionExport phases | CX-02 | T22, T23 |
| T25 | refactor(git): listReferences parsers | CX-04 | - |
| T26 | refactor(git): materializeDirectory plan entries; drop the unreachable guard | CX-11, hist MISSED | - |
| T27 | refactor(export): relativizeExportArtifacts | CX-06 | - |
| T28 | test and refactor(export): validateExportPackage (assertIsFile plus 2 gap tests) | CX-07' | - |
| T29 | refactor(bridge): hoist six Sets and sanitizeDependencyScope, with a hostile-scope table | CX-08' | - |
| T30 | refactor(bridge): dependency start defaults table with a deepEqual snapshot | CX-09' | - |
| T31 | refactor(bridge): shared broadcastFilteredGitReferences | hist DUP-05' | W1-04 |
| T32 | refactor(bridge): describeBridgeError and the references-request helper, at two sites only | hist DUP-06'A | T31 |
| T33 | refactor(historical): references field becomes a local | hist MISSED | - |
| T34 | perf(export): drop unread repositoryRoot from the preflight | hist MISSED | - |
| T35 | refactor(export): import GIT_REVISIONS_FOLDER; un-export readGitExportSystemResources | hist DEAD-03', MISSED | - |
| T36 | chore(types): de-export 14 type-only symbols | NARROW-01'(2) | - |
| T37 | refactor(profile): byte-identical 40-line block | assets DUP-05 | - |
| T38 | refactor(launchers): four throwing closures (not the DOM launcher) | assets DUP-06' | - |
| T39 | refactor(settings): accessors reuse settingsStorage path and key | assets DUP-08 | - |
| T40 | refactor(settings): one accessor pattern, single read (log lines drop; note it) | assets DUP-09 | L16 |
| T41 | refactor(types): rename the colliding VisualizationSettings | assets MISSED(1) | - |
| T42 | refactor(types): import canonical ChartType and AnalysisMode | assets MISSED | - |
| T43 | refactor(commands): rename the shim class ActiveAnalysesCommands | assets MISSED | - |
| T44 | refactor(active-servers): registration table | BOIL-06 | - |
| T45 | refactor(chart-type): command factory, both dialects verbatim | assets DUP-04'A | - |
| T46 | chore(assets): un-export the 20 resolve and assert helpers (keep the pinned identifiers in text) | BOIL-02 | W2-55 |
| T47 | refactor(assets): shared assertSourceExists | BOIL-01'A, assets MISSED | T46, W1-04 |
| T48 | refactor(network): LAN URL at the three unguarded sites | servers DUP-04' | - |
| T49 | refactor(active-servers): registry and remote guards | servers DUP-05 | - |
| T50 | refactor(active-servers): drop pass-through format statics | servers DUP-06 | - |
| T51 | refactor(servers): requireExtensionContext helper | servers MISSED | - |
| T52 | refactor(servers): single getServerConfig | servers MISSED | W2-14 |
| T53 | refactor(collaboration): derive CODEXR_AVATAR_IDS from COLLABORATION_AVATARS (excluding 'auto') | AVATAR-01(1) | W1-13 |
| T54 | fix(python-env): reuse and dispose the details output channel | ERR-05 | - |
| T55 | refactor(favicon): copy from icon.png, keep the destination name; delete favicon.ico and its allowlist line | PKG-02' | W1-20; gate G +A +V |
| T56-T59 | refactor(promises): explicit `void` by module, 4 commits | LINT-05 backlog | W3-10; Wn about -278 |

Gate for every T row: `G`, plus `+A` when it touches parsers, executePython or export.
Measure for every T row: `Q` of the named function, `D` or `L`, and `Wn`.

**W4-P: Python** (gate `+P +A`, ruff clean)

| # | Subject | Findings | Needs |
|---|---|---|---|
| P01 | reuse `_empty_metrics` | DUP-03 | W1-18 |
| P02 | call `_add_graph_metrics` | DUP-02 | P01 |
| P03 | `_iter_raw_targets` generator | DUP-04' | W1-18 |
| P04 | fallback-path characterization (saves and restores sys.modules) | DUP-05 (characterization) | W1-15 |
| P05 | `_find_block_end` and `_lexical_function_entry` | DUP-05' | P04 |
| P06 | lazy fileSizeBytes default | py MISSED | - |
| P07 | single lizard-free get_file_size | DUP-07' | P06 |
| P08 | single read in build_line_metrics; delete count_* | DUP-08' | - |
| P09 | narrow to `(OSError, ValueError)` | HYG-02' | P07, P08 |
| P10 | CAPABILITIES read from the contract | py MISSED | - |
| P11 | relationCount single pre-pass (self-edge semantics proven) | py MISSED | W1-18 |
| P12 | `Dict[str, float]` annotation | py MISSED | - |
| P13 | comment recording that `--files` is deliberately unused | py MISSED | - |
| P14 | dead locals (`parsed`, `class_count = 0`) | HYG-05'(2) | - |
| P15 | `_count_top_level_arguments` | CPLX-04 | - |
| P16 | analyze_file envelopes (5-key `_unsupported_result`) | CPLX-05' | - |
| P17 | scan bodies | CPLX-06 | - |
| P18 | main() dispatcher, within the source-text pins | CPLX-07 | - |
| P19 | one shared directory coordinator helper | DUP-06 | - |
| P20 | rename `sumaryFiles/` to `summaryFiles/` (plus executePython.ts:346) | DUP-09' | W2-58; gate +F5 |

**W4-R: runtime JS.** The skeptic pass is pending, so re-verify each item at pick-up.

| # | Subject | Findings | Needs |
|---|---|---|---|
| R01 | data-table column factories | CPX-04 | - |
| R02 | ar-fill-light attach and detach test | DUP-04 (characterization) | - |
| R03 | bindImmersiveSessionLifecycle | DUP-04 | R02; gate `+H:test:xr-immersive-harness` |
| R04 | createLivePanelSse in panelShell.js | DUP-01 | livePanelBundle tests |
| R05 | route directory-panel diagnostics through debugLog | LOG-02 | R04 |

#### W5 — structural refactors after characterization (about 57 commits)

| # | Subject | Findings | Needs | Gate |
|---|---|---|---|---|
| W5-01 | test(historical): behavioural characterization of both services and bridges | hist TEST-01' | W1-05 | G |
| W5-02 | refactor: one toPortableRelativePath (pin table first) | hist DUP-01' | W5-01 | G |
| W5-03 | refactor: generic GitBackedAnalysisService (the base owns the parameter properties; getReferences folded in) | hist DUP-02', MISSED | W5-02, T33 | G +F5 |
| W5-04 | chore: delete the unreachable missing-target guard | hist DEAD-02 | W5-01 | G |
| W5-05 | refactor: shared analyzeSource with an explicit missing-target policy | hist DUP-04 | W5-03, W5-04 | G +F5 |
| W5-06 | refactor: decoratePayload (the file branch stays per-mode) | hist DUP-03 | W5-05 | G |
| W5-07 | chore: drop the redundant re-validation in the evolution worker loop | hist MISSED | W5-01 | G |
| W5-08 | refactor: executeEvolution, phases 2 and 4 only | CX-05' | W5-01 | G +H:project-evolution |
| W5-09 | refactor: router mode descriptor table | CX-10' | W5-01, T21 | G |
| W5-10 | test: positional `Continue Export` assertion | CX-03 (characterization) | - | G |
| W5-11 | refactor: exportFolder wizard, discriminated result, placement constraint | CX-03' | T10, W5-10 | G +F5 |
| W5-12 | test: ModularTree registry transcription and 17-property snapshot | CPLX-01, TYPE-01 (characterization) | W1-05 | G |
| W5-13 | refactor: convertToSectionItem registry, in-file, using `itemTypeKeys[]` | CPLX-01' = BOIL-03' | W5-12 | G +F5 |
| W5-14 | refactor: createModularChild from the same table, plus the two test edits | CPLX-07' | W5-13 | G |
| W5-15..17 | refactor: section header function, then definitions moved, then options object | CPLX-08' | W5-14, W1-04 | G |
| W5-18 | types: SectionChild union (`import type` only) | TYPE-01' | W5-14, T06 | G; review for no new value imports |
| W5-19 | refactor: CodeXRTreeItemBase for six classes (optional) | BOIL-04' | - | G +F5 |
| W5-20 | test: HTTPS and HTTP lifecycle characterization, committed | servers DUP-01 (characterization) | W1-05 | G |
| W5-21 | refactor: HTTPS base (TLS options, getServerUrl, validate hook; getConfig stays per-class) | servers DUP-01', DUP-03'a | W2-33, W5-20 | G +F5 https |
| W5-22 | docs: single deadlock rationale comment | servers DUP-02' (reduced) | W5-21 | G |
| W5-23 | refactor: attachWebSocketEndpoint and DEFAULT_ROOM_ID | servers MISSED x2 | - | G (both ws suites) |
| W5-24..26 | refactor: collaborationRoomServer in three steps: types and 11 pure helpers, participantIdentity, room registry with a narrow context | SPLIT-01' | W5-23, W1-04 | G after each |
| W5-27..28 | refactor: screenBroadcast in two steps: mediaFrame.ts, then relayPolicy with a context | SPLIT-02' | W5-23 | G |
| W5-29 | test: launcher characterization harness | SPLIT-03 (characterization) | W1-05 | G |
| W5-30..32 | refactor: multiServerLauncher in three steps: factory, notifications (outside runtime/), conflict dialog | SPLIT-03' | W2-35, W5-29 | transcript identical |
| W5-33 | test: handleServerActions harness (unknown-id transcripts, clipboard strings; pins stopAll as it behaves today) | SPLIT-04, DUP-04, DUP-05 (characterization) | W1-05 | G |
| W5-34..36 | refactor: handleServerActions in three steps: format module, remote and participants module, catalogue keyed on (action, label) | SPLIT-04' | T48-T50, W2-21, W5-33 | G +F5 |
| W5-37 | refactor: buildBabiaUiPlaceholders model | CPLX-09 | - | G +A |
| W5-38 | refactor: createSession helpers | CPLX-18 | W1-05 | G +F5 |
| W5-39 | test and refactor: asset descriptor table (8 assets) | BOIL-01'B | T47, W1-11 | G +A |
| W5-40..41 | refactor: room and guideScreen descriptors | assets MISSED x2 | W5-39 | G +A |
| W5-42..43 | refactor: shared ChartType types, then the chart-type setting core | assets DUP-03' | W2-24, T42 | G |
| W5-44 | test: analyze_classes extension-driven golden (21 arms, aliases, unlisted extension) | py DUP-01 (characterization) | W1-17 | +P |
| W5-45 | refactor(python): table-driven analyze_classes | py DUP-01' | W5-44, W3-15 | +P +A, golden identical |
| W5-46 | chore(python): class_counter CLI and its imports | DEAD-06'b, HYG-05'(1) | W5-45 | +P |
| W5-47 | refactor(python): analyze_dependencies into six helpers | py CPLX-01 | P02, P01 | +P golden |
| W5-48 | refactor(python): analyze_file_dependencies and `_ensure_external_node` | py CPLX-02' | P02 (hard) | +P |
| W5-49 | test and refactor(python): `_infer_class_owner` | py CPLX-03 | W5-48, brace fixture | +P |
| W5-50..52 | test and refactor(runtime): refreshUi, computePlanarAxisTargetScale, applySharedState | CPX-01/02/03 | characterization each | G +H:xr-harness |
| W5-53 | fix(export): refreshRuntimeCopies also refreshes common/ (CHANGELOG line; maintainer confirmation needed) | runtime DUP-02(1) | W1-11 | G |
| W5-54..55 | refactor(runtime): collectConfiguredIds and the controller-view map move into common/ | runtime DUP-02(2), DUP-03(2) | W5-53, W1-14, W1-21 | G +H |
| W5-56 | chore(package): stop shipping docs/**, then stop copying templates/examples into dist/ (2 commits) | PKG-04', PKG-03 | vsce rewrite check | G +V +F5 |
| W5-57 | refactor(python-env): venvManager split (last; pure parts first, plus a clean-profile manual checklist) | CPLX-19 | W1-05, W2-71 | G and a manual clean install |
| W5-58 | build(python): formatter pass | HYG-05(3) | all Python | +P +A |
| W5-59 | docs: PYTHON_ANALYSIS.md; final STATUS and CHANGELOG | py DOCS-01 | all | - |
| W5-60 | lint: closing tighten (complexity as error at the final maximum; re-baseline the ratchet) | CPLX-22 closing | all | G, CI |

Three items are conditional and excluded from the commit counts:
- MENU-01 regex trim, only after a contextValue test.
- runtime DUP-07 accessors, only after W5-53 plus an offline boot test.
- hist DUP-04B.

### 3. Session batching

| Session | Commits | Content |
|---|---|---|
| S1 | 5 | W0 |
| S2 | 6 | W1-01..06 (infrastructure) |
| S3 | 8 | W1-07..14 (contract and sync tests) |
| S4 | 8 | W1-15..22 (Python net, CI) |
| S5 | 11 | W2-01..11 |
| S6 | 10 | W2-12..21 |
| S7 | 2 | the hinge, W2-22 and W2-23; fallout size unknown, so it gets its own session |
| S8 | 11 | W2-24..34 |
| S9 | 10 | W2-35..44 |
| S10 | 8 | W2c commands, with a CHANGELOG line each |
| S11 | 9 | W2-53..57 and W2-58..61 |
| S12 | 9 | W2-62..69; the lockfile commit goes last, alone |
| S13 | 5 | W2-70..74, plus re-measurement |
| S14 | 6 | W3-01..06 |
| S15 | 7 | W3-07..13 |
| S16 | 6 | W3-14..19 |
| S17 | 5 | L01-L05 |
| S18-S20 | 17 | L06-L22, about 6 per session |
| S21 | 9 | T01-T09 |
| S22-S26 | about 50 | T10-T59, about 10 per session, grouped by area |
| S27-S28 | 20 | P01-P20 |
| S29 | 5 | R01-R05 |
| S30-S40 | about 60 | W5, one cluster per session: history x2, ModularTree, HTTPS, WebSocket and collaboration, broadcast, launcher, server actions, assets and chart type, Python x2, runtime and packaging, venv, closing |

Approximate commit counts per wave:
- W0: 5
- W1: 22
- W2: 74
- W3: 19
- W4: about 106
- W5: about 60
- Total: about 285 commits in about 40 sessions.

Rules:
- The gate runs once per commit.
- A red gate ends the session at the last green commit.
- Characterization commits always land separately and before the reshaping commit.

### 4. Record-only register for 1.3.0 (write into V1.2.1_STATUS.md)

1. Language-table unification, which widens C++ to 8 extensions and fixes the `cplusplus/cpp` and `objectivec/objective-c` keys (assets DUP-02b).
2. Re-encode `ttcn3.svg` and `default.svg`. They are PNGs with C2PA data, misnamed `.svg`. Also re-encode the 1024px `icon.png` (PKG-05', MISSED).
3. Narrow `DIRECTORY_ANALYSIS_EXTENSIONS` to the metric contract. This covers the `.rs` and `.jsx` class-counter arms and `.r` (py DEAD-06a, DEAD-07).
4. `ServerActionHandlers.stopAllServers`:
   - Delete the second contradictory toast at `:533-539`.
   - Reconcile the all-versus-running population mismatch (servers TYPE-01').
5. The `MultiServerLauncher.servers` map never shrinks (DEAD-05 open question).
6. `configureServer` persists nothing and still reports success (`serverCommands.ts:31-65`).
7. Error-message normalization:
   - the `${error}` dialect in the chart-type commands;
   - the two DimensionValidator wordings.
8. The Python `warnings` entry when the project scan degrades (`dependency_analysis_engine.py:474-475`).
9. tree-sitter-language-pack in the test harness, which changes the graph output (HYG-03').
10. `bufferutil` and `utf-8-validate` runtime dependencies. The verification recipe is attached to DEP-01'.
11. The MENU-01 regexes if not landed, the MENU-02 icon strip, and the palette `category` and title decision.
12. HTTPS double port search, and the two protocol derivations (`url.startsWith` versus `certMode`).
13. The default `staticRoot` of `path.join(__dirname,'../../../templates')`, which is wrong under dist/ (`httpServer.ts:76` and three siblings).
14. `deactivatePythonEnvCommands` is never called from `deactivate()`.
15. VenvManager is instantiated in five places; evaluate a singleton.
16. Divergence between the live and the export file-target evolution key.
17. Class-counter double counts (`enum class`, Go struct, `typedef struct`), Vue line numbers, `.h` routed to C++.
18. Extensions with no analyzer arm:
    - `.pyw`, `.pyi`, `.rbw`, `.mjs`, `.cjs`, `.hxx`, Zig, and TTCN-3 in the class counter;
    - six contract extensions in the comment analyzer.
19. Five collaboration commands and `pythonEnv.status` lack `enablement`.
20. The `directoryXRParser.ts:105` fallback to `/tmp`.
21. The git-ref-picker runtime is copied but never verified in fileXRParser.
22. `sessionServerManager.ts:146` hardcodes `isWatcherActive`.
23. ERR-04b: 21 log-and-default sites.
    - ERR-02 needs no action. The house convention is `catch { /* reason */ }`.
24. servers DUP-02, the full lifecycle extraction.
25. assets DUP-04B, BOIL-04 tooltip dialects, and the BOIL-05 pass-through wrapper seam.
26. Adopting knip or ts-prune. The ratchet's import-graph walk replaces it for now.
27. The runtime LOG-03 boot banner, which is a product call.
28. The policy for the modules' `__main__` CLIs.
29. The 1.03 GiB `.git` pack: propose only.
30. The 1.2.0 carry-overs:
    - pending F5 validations;
    - `XR_DEBUG_COMMANDS.md:382`;
    - the ROADMAP screenshots;
    - the stale README inside the released `.vsix`.
31. `codexr.servers.refreshServers` stays, as a fenced legacy alias with zero callers.

### 5. Release exit criteria

| Metric | Baseline | Target |
|---|---|---|
| Modules unreachable from `extension.ts` | 54 | 0, ratchet-pinned |
| Dead exports | 34 | 0 |
| Commands declared / registered / unreachable | 70 / 123 / 18 | 69 / 106 / 1 (the fenced alias) |
| Palette-visible debug or scaffold commands | 2 | 0 |
| src lines | 52,974 | at most 49,000 |
| TS functions with CCN over 30 / 20 / 15 | 6 / 10 / 31 | 0 / at most 3 / at most 12 |
| Worst TS CCN | 61 | at most 25 |
| Python functions over CCN 15 | not counted; worst today 90 / 45 / 42 | at most 4 |
| Python worst CCN | 90 / 45 / 42 | at most 15 |
| `analyze_classes` | 536 lines | at most 160 |
| Files over 600 lines | 11 | at most 4, each named and justified |
| Largest file | 1,175 | at most 700 |
| HTTPS pair identical lines | 162 | at most 30 |
| historical <-> evolution duplicated lines | about 95 | at most 25 |
| `toPortableRelativePath` copies | 3 | 1 |
| Python lines inside duplicated windows | 14.7% | at most 6% |
| `console.*` in src | 1,652 | at most 5 (allowlist) |
| Console-only catch blocks | 65 | 0 |
| any occurrences | 203 | at most 125 |
| `@ts-ignore` | 0 | 0 |
| Floating promises | about 278 | 0 |
| ESLint rules as error | none (all 5 are warn) | the 5 originals, `no-unused-vars`, `no-console`, `complexity` at the final ceiling |
| ESLint `--max-warnings N` | none | recorded and monotonically non-increasing since W3 |
| tsc flags on | none of the four | `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch` |
| Lint scope | src only | src, test, scripts, configs, standalone template runtimes |
| Python lint | none | ruff clean |
| CI | none | green and required on windows-latest and ubuntu-latest |
| Working tree | - | 34 MB smaller |

The CI jobs are:
- `npm test`;
- `test:python`, independent of discovery order;
- `test:analysis` with the pinned lizard;
- `lint:python`;
- the VSIX listing check.

The VSIX target cannot be given as a number yet:
- The baseline is recorded at W0.
- The expected cut is about 3.2 MB:

| Source of the cut | Size |
|---|---|
| favicon | 1.15 MB |
| dist/ duplicates | about 1.9 MB |
| docs | 108 KB |
| Python examples and the visual-style runtime | small |

#### Critical Files for Implementation
- C:\Users\Admin\Desktop\Desarrollo\Code-XR\package.json
- C:\Users\Admin\Desktop\Desarrollo\Code-XR\eslint.config.mjs
- C:\Users\Admin\Desktop\Desarrollo\Code-XR\tsconfig.json
- C:\Users\Admin\Desktop\Desarrollo\Code-XR\src\core\logging\logger.ts
- C:\Users\Admin\Desktop\Desarrollo\Code-XR\test\runners\run-node-tests.cjs
- C:\Users\Admin\Desktop\Desarrollo\Code-XR\src\commands\index.ts
- C:\Users\Admin\Desktop\Desarrollo\Code-XR\test\analysis\livePanelDomIntegration.test.cjs
- `.claude/docs/V1.2.1_STATUS.md` (on `origin/v1.2.1`; absent from the local master checkout)
