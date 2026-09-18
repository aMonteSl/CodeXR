# v1.2.1 Design — critic review (38 corrections)

> **Purpose**: the adversarial review of the three designs: ordering violations, steps that are not behaviour-neutral, source-text tests that would turn red or go vacuous, conflicts between the designs with their resolution, refuted findings still acted on, gates that cannot run, and the cut line. Its rulings are summarized in the ROADMAP override table; this file keeps the evidence (file:line).
> **Stability**: frozen design input (2026-09-18). It was written read-only, before `node_modules` existed, so it contains estimates; `ROADMAP.md` carries the measured numbers and the rulings that override it. Where this file and `ROADMAP.md` disagree, `ROADMAP.md` wins.

---

Paths are relative to `C:\Users\Admin\Desktop\Desarrollo\Code-XR\`. Nothing was built or run, because `node_modules` is absent; every `file:line` below was read in the working tree.

Two facts that post-date all three designs:
- The runtime-js skeptic pass is no longer pending. Its result is the last record in `journal.jsonl` (label `challenge:runtime-js`). It refutes DUP-07 and weakens DEAD-02, LOG-01, LOG-03, DUP-02, DUP-05, DUP-06 and CPX-02.
- It also reports four MISSED items. One of them is wrong: `resources/languages_icons/color/default.svg` and `ttcn3.svg` start with bytes `89 50 4E 47`, so they are PNGs, not UTF-16 text. The sequencing record-only item #2 is correct. Do not "re-encode to UTF-8".

## A. Ordering violations

1. **Guardrails §6 lands CI (W1a) before W1c, so CI is red from its first run.**
   - Evidence: `test/analysis/analysisNamespace.test.cjs:29` asserts `dist/extension.js` exists, and a clean checkout has no `dist/`.
   - The same CI `package` job calls `scripts/dist-fingerprint.mjs`, which is only created in W1h.
   - Fix: order as runner fixes → W1b → dist decision (item 22) → CI. Add the fingerprint job in the W1h commit.

2. **W1-07 (command-surface test) is listed with "Needs: -", but it needs W1-05 (fakeVscode).**
   - Evidence: `src/commands/analysis/AnalysisCommands.ts:44` builds ids from a template literal, and `:65` uses `registration.commandId`. All registration funnels through `src/utils/commandBuilder.ts:24`. Static extraction cannot produce 70/123/18.
   - Fix: make W1-07 depend on W1-05. Seed the counts from the executed `registerAllCommands`. Keep the TS-AST extractor as a time-boxed fallback.

3. **ModularTree: sequencing puts both test edits in the second commit (W5-14), but the `:191` pin is inside `convertToSectionItem`, which the first commit (W5-13) rewrites.**
   - Evidence: `test/servers/remoteAccessImplementation.test.cjs:191` matches `(element as any).activeServer,\s*\n\s*(element as any).participant,`, which is `src/views/ModularTreeDataProvider.ts:485-486`.
   - `:190` matches `:428`, which is in `createModularChild`.
   - Fix: edit `:191` in W5-13 and `:190` in W5-14, as the structural design's C3/C4 already do.
   - W5-18 (TYPE-01) must also list `test/analysis/analysisTreeBridge.test.cjs:12` (`originalAnalysisItem?: any;`). Sequencing omits it.

4. **executePython: T01 runs before T03, which builds a helper only to gut it.**
   - Evidence: the recovery branch at `src/code_analysis/engine/utils/executePython.ts:233-264` can never recover. `parsePythonOutput` (`:618-627`) has already failed `JSON.parse(trimmed)`, so `JSON.parse(rawOutput)` at `:238` must fail too.
   - So `progress.report` at `:257` is unreachable. CPLX-06' ("preserve four reports") and the MISSED collapse contradict each other.
   - Fix: order as T03 → T01 (three reachable reports: `:208`, `:218`, `:291`) → T02 → T04 → T06.

5. **Five commits delete "unreachable branches", and W0-05 defines no proof standard for them.**
   - The commits are hist DEAD-02 (W5-04), T03, T26, W5-07 and CX-11.
   - Evidence: the cleanup skill's §2 says "a test that fails when you remove it, or don't remove it". No test can satisfy that for a branch that really is unreachable.
   - Fix: W0-05 adds the standard: a dataflow argument plus a characterization test that pins the precondition. For DEAD-02 that means a test showing `analyzeSource` throws and never returns `missingTarget:true`.
   - This also settles a conflict: sequencing has DEAD-02 in scope, structural defers it to 1.3.0.

6. **W0-05 must amend the cleanup skill before session 2, because the plan breaks the skill as written.**
   - Evidence: skill §1 says "One item per session"; the plan runs 5-11 commits per session.
   - Skill §4 says "Deleting or rewriting existing docs" is off-limits. W2-03, W2-07, W2-53, W2-55, W2-56, W3-17 and W5-59 all edit existing docs.
   - Fix: get an explicit maintainer ruling. The wording "line-level drift fixes land with the commit that causes them; never delete docs or history sections" would cover these commits.

7. **W2-69 removes `@types/mocha` but leaves a doc line that then becomes false.**
   - Evidence: `.claude/docs/DEVELOPMENT.md:36` says "despite `@types/mocha` being present". W2-68 lists only `:33` and `:75`. ZOMBIE-20' maps `:36` to this change.
   - Fix: add `:36` to W2-69.

## B. Steps that are not behaviour-neutral and not among the three authorized changes

8. **W5-53 (widening `refreshRuntimeCopies`) changes what a re-export overwrites.**
   - The runtime-js skeptic, under DUP-02 weakened, says to defer both the widening and the move to `common/` to 1.3.0.
   - Fix: cut W5-53, W5-54 and W5-55. Land only a test that the three `collectConfiguredIds` and `uniqueElements` bodies are identical. The structural design's T8d already says this.

9. **T54 (ERR-05, reuse and dispose the details channel) is a user-visible leak fix.**
   - It is the same class of change as the MultiServerLauncher leak, which the maintainer made record-only.
   - Fix: make it record-only, or get maintainer sign-off and add a CHANGELOG "Fixed" line.

10. **Logging is a fourth user-visible change.**
    - `console.*` output moves from DevTools to the output channel, and pre-init lines that were dropped now appear.
    - Decision (3) covers it, but it should be added explicitly to the authorized list and the CHANGELOG.
    - Evidence on levels: `src/core/logging/logPolicy.ts:17-23` gates `info` exactly like `debug`. The guardrails "named `info` exceptions" therefore give no extra visibility in production. State that, or drop the distinction.
    - Branch hygiene: relabel the `feat!` and `feat(logging)!` commits as `refactor!` or `chore!`, since the branch rule is "never add features".

11. **Mechanical use of the guardrails ERR-03 rule would promote ordinary Python stderr chatter to always-on `warn`.**
    - Evidence: the text-branch logs at `executePython.ts:529-545` sit inside `catch {}` (`:523`). The rule says a `console.log` in a catch maps to at least `warn`.
    - Fix: keep L04 (classifier extraction) before L05, as sequencing does. Name this site in the rule's expected-probe exceptions.

12. **The 18th command id is a genuine conflict with the maintainer's decision.**
    - Evidence: `codexr.servers.refreshServers` was registered in the published 1.1.0 (`git grep v1.1.0 -- src/commands/common/generalCommands.ts:28`). It was never contributed in `package.json`, and it has zero callers today.
    - Fencing it is the conservative reading of the Legacy rule. It needs the maintainer's yes or no.
    - Guardrails assertion 4 ("every non-pending id is referenced") must exempt `kind:'legacy-alias'`, or it fails on this id.

## C. Source-text tests that turn red, or go vacuous, without the design saying so

13. **W5-03 (GitBackedAnalysisService base class) breaks pins in both service files.**
    - `test/analysis/analysisServerCapabilities.test.cjs:138-139` pins `const session = this.getSession()…new GitRepositoryService(session.targetPath` in both files.
    - `test/analysis/gitRefPickerRuntime.test.cjs:285-286` pins `return this.gitService.getAvailability(` in both files.
    - Fix: list the pin edits and make them depend on W5-01. Alternatively adopt structural's composition design, which already retires each pin in the commit that moves its text. See item 27 for the choice.

14. **W5-35 (the remote and participants module) moves a pinned line.**
    - Evidence: `src/active_servers/views/interactions/handleServerActions.ts:223` is pinned by `test/servers/remoteAccessImplementation.test.cjs:123` (`clipboard.writeText(state.invitationUrl)`).
    - Fix: adopt structural T6d (the format module plus `withServer` only) and record the action catalogue for 1.3.0. Structural verified that `appendRemoteActions` emits two `remoteStatus` entries.

15. **W5-27 and W5-28 (screenBroadcast split) hit a large cluster of pins.**
    - Evidence: `test/analysis/virtualScreenRuntime.test.cjs:505-520` pins the frame constants and `:520` pins `temporalLayer`. `:618-620` pins the `private shouldThinFrame(...)` signature and the `RELAY_THIN_*` constants. `:672-696` pins `parkViewer` and its neighbours.
    - The negatives at `:614-615`, `:674` and `:695` go vacuous once the code moves.
    - Fix: rewrite the parity test first, as structural T6b says. Add W1-04 as a dependency. Treat this as a cut-line candidate.

16. **W5-24 (room types and helpers) moves types that tests pin.**
    - Evidence: `src/servers/runtime/collaboration/collaborationRoomServer.ts:98-115` holds `CollaborationRoomServerOptions` and `CollaborationApplicationMessageContext`. They are pinned by `test/analysis/historicalComparison.test.cjs:385` (`handleApplicationMessage?:`) and `remoteAccessImplementation.test.cjs:70` (`authorizeUpgrade`).
    - Fix: keep those two types in the class file, as structural already says.

17. **W5-21 (HTTPS base class) leaves negative assertions vacuous for the new files.**
    - Evidence: `test/servers/httpsCertificates.test.cjs:84-87` checks that `babia_cert.pem` and `babia_key.pem` are absent from the two server files only. It says nothing about `httpsServerBase.ts` or `httpsTlsOptions.ts`.
    - `:88-89` needs "generated local certificates" in both files. In `httpsDefaultServer.ts` it appears only in the console lines at `:52` and `:264`.
    - Fix: add W1-04, extend the negatives to the new files, and keep the literal verbatim during logging migration L07.

18. **W5-37 (CPLX-09, `buildBabiaUiPlaceholders`) is scheduled with no characterization and the wrong gate.**
    - Evidence: five pinned literals live inside the function in `src/babia_templates/processing/templateProcessor.ts` (`:258`, `:288-289`, `:309`, `:411`, `:463`). They are pinned by `test/analysis/xrFieldSchemaIntegration.test.cjs:90-96`.
    - `:463` (`hideOnEnterAr: false`) is also asserted by `test/runners/run-xr-immersive-harness.cjs:138`, which is not in `npm test`.
    - The negative at `test/analysis/uiPolicy.test.cjs:102` goes vacuous if the function moves.
    - Fix: extract in-file only, or else add a characterization commit, W1-04 and the `+H:test:xr-immersive-harness` gate. No design covers CPLX-09 properly today.

19. **T38 (launcher closures, DUP-06') deadlocks against the W2-22 and W2-23 guardrails.**
    - Evidence: `src/code_analysis/engine/launchers/launcherXRAnalysis.ts:14` imports `SessionWatcherManager`, and it is used only inside the closures being extracted (`:149`, `:183`).
    - A shared module orphans that import, and `no-unused-vars` at error then forces its deletion. That turns `test/analysis/reanalysisArchitecture.test.cjs:17` red.
    - The same trap exists for `test/analysis/livePanelDomIntegration.test.cjs:146-147`.
    - Fix: use per-file local helpers.
    - General rule to write down: before any extraction, grep `test/` for the import lines of the source file.

20. **T06 (TYPE-02) omits an S-pin and its prerequisite test.**
    - Evidence: `test/analysis/livePanelDomIntegration.test.cjs:200` pins `private parsePythonOutput(stdoutData: string): any {`.
    - Guardrails and structural both note it. Sequencing lists neither the pin nor the behavioural `parsePythonOutput` test that must come first.
    - Keep these tokens in `executePython.ts`: `options: { silent?: boolean } = {}` and `if (options.silent) {` (`test/analysis/reanalysisArchitecture.test.cjs:56-57`), and `return JSON.parse(trimmedOutput);` (`test/analysis/livePanelDomIntegration.test.cjs:201`).

21. **W5-58 (Python formatter pass) is guaranteed red.**
    - Evidence: `test/analysis/xrFieldSchemaIntegration.test.cjs:15` pins single quotes, for `src/code_analysis/python/main.py:29`. `:22-26` pins double quotes, for `src/code_analysis/python/utils/xr_field_schema.py`. `test/analysis/livePanelDomIntegration.test.cjs:194-195` pins `print('=== JSON_START ===')`.
    - No single formatter setting satisfies both quote styles. Guardrails item 11 already forbids `ruff format`.
    - Fix: delete W5-58.

## D. Conflicts between the designs, with resolution and order

22. **dist prerequisite: sequencing W1-03 removes the dist check from the unit suite; guardrails (c) keeps it and adds `compile` to `test:basic`.**
    - Take W1-03. Webpack has ts-loader with no `transpileOnly` (`webpack.config.js:30-33`), so adding `compile` to `npm test` type-checks twice and copies `templates` and `examples` on every one of about 285 commits.
    - The dist guard is already covered by `scripts/prepare-dev-extension.mjs:57-62` and `scripts/package-vsix.mjs`.

23. **Unused-symbol flags: sequencing enables `noUnusedParameters` (W3-05); guardrails keeps it off because ts-loader shares the tsconfig and the F5 build would break.**
    - That same argument applies to `noUnusedLocals`, which sequencing uses as the hinge in W2-23.
    - Resolution: add `tsconfig.check.json` that extends the base and turns on the four flags, and use it only for `typecheck`. `compile`, `compile-tests` and ts-loader stay on the base config. The gate gets all four flags, F5 builds never break on a transient unused symbol, and the hinge still works.

24. **Ratchet timing: sequencing W3-07 (after W2); guardrails W1g (before W2).**
    - Take before W2. 74 deletion commits need a machine-checked before and after.
    - Drop `X` (dead exports) from the ratchet. A parse-only census is unreliable across `export *`, default exports and namespace imports, and the audit itself had this blind spot. The guardrails baseline shape already leaves it out.
    - `U` and `C` stay. The exit-criteria claim of "X=0 pinned" becomes a manual measurement.

25. **Negative-assertion helper: sequencing W1-04 converts 7 test files at once; guardrails says no mass rewrite, retarget only when a file is touched.**
    - Take guardrails: land the helper alone, and retarget in the commit that splits a file.
    - Names to unify across the three designs:
      - `readConcatenated` and `readSources` are the same helper.
      - Three names exist for the ModularTree characterization: W5-12, `modularTreeRoundTrip` and `modularTreeItemBridge`.
      - Two names exist for the command-surface test.
    - fakeVscode: the precedent hooks `Module.prototype.require` (`test/analysis/livePanelDomIntegration.test.cjs:54-60`), not `Module._load` as the task brief says. Pick `Module._load` as the single hook.
    - `withFakeVscode` must accept an async callback, because `convertToSectionItem` does its lazy `require()` at call time (`src/views/ModularTreeDataProvider.ts:462-558`).
    - It must always purge `out/core/logging/*`. Otherwise a sink attached by `logger.test` leaks into later test files, since `test/runners/run-node-tests.cjs:39` runs everything in one process.

26. **Logging versus splits: sequencing says migrate first, then split; structural says split first with strings byte-identical, then migrate.**
    - Take logging first. The only exception is the executePython classifier, L03 then L04 then L05, which sequencing already has.
    - Reason: the structural characterizations record a "console transcript" (T1 item 9 and the SPLIT-03 transcript). A later logging migration would rewrite those tests.
    - Fix: restate those transcripts as log-sink transcripts.
    - Drop L02 (the 65-site ERR-03 pre-pass) and ERR-04a. Guardrails' 1:1 per-module rule with catch mapping to at least `warn` replaces both.
    - `src/utils/errorHandler.ts` imports `vscode`, so it cannot serve the 25 vscode-free files anyway.

27. **History services: sequencing uses a base class (W5-03); structural uses composition (`GitAnalysisSessionContext` and `SingleJobGate`).**
    - Take composition. See the pins in item 13.
    - `toPortableRelativePath` and the bridge replies are pure helpers with no pins (grep finds none). They belong in W4 as one commit each, as structural has them, not behind W5-01.
    - Write this exception into W0-05: a helper-plus-consumers change may be a single commit when the pre-existing copies are module-private. A helper-only commit would otherwise trip the unreachable-modules ratchet.

28. **HTTPS: sequencing W5-21 is one commit including a "validate hook" (DUP-03'a), and W5-22 says `stop` stays. Structural has slices S3 to S6 and defers validation to 1.3.0.**
    - Evidence: `stop`, `forceStop` and `getIsRunning` are byte-identical in the pair. A diff of `httpsCustomServer.ts:162-199` against `httpsDefaultServer.ts:149-186` shows about 38 identical lines.
    - The exit criterion "≤30 identical lines" cannot be reached without S6.
    - Fix: adopt S3 to S6, with S6 as the cut line. The criterion becomes "≤15 lines, or ≤60 if S6 is cut". Defer the validate hook.
    - `getFullConfig` (`httpsCustomServer.ts:209`) has zero callers. Delete it with DEAD-01. Do not write a characterization for it.

29. **Typing order: guardrails wants TYPE-01 before W5; sequencing puts it after W5-14.**
    - Take sequencing. The table refactor removes about 15 casts for free.
    - The carried-property count is 15 (`ModularTreeDataProvider.ts:420-452`), not 17. Derive the list from source in the test.

30. **Python coordinators (DUP-06): sequencing P19 is in scope; structural cuts it.**
    - Evidence: `src/code_analysis/python/XR/xr_directory_analysis_coordinator.py:39,46` prints errors to stderr with different message text. The two livePanel coordinators print to stdout at `:41` and `:46`.
    - Fix: P19 shares only the progress emitter and the run body. Each `main()` stays per file. Otherwise cut it.

31. **Lint thresholds disagree: `max-lines` is 600 in sequencing, 500 in guardrails, and 700 or p90 in LINT-06'.**
    - Fix: pick one value from the W0 distribution and use it in the exit criteria.
    - W2-22's "14 imports in 14 files" is wrong on both counts. The LINT-04 scan finds only named imports that occur exactly once. Two of those are in files W2a has already deleted (`serverItems.ts` and `configurationManagerExample.ts`). The real `no-unused-vars` fallout is unmeasured.
    - Fix: apply the guardrails ">40 sites, enable by glob" fallback to W2-22 as well.

32. **T6c `launch/serverFactory.ts` contradicts structural's own depth rule.**
    - Evidence: `src/servers/runtime/multiServerLauncher.ts:431`, which is `path.join(__dirname,'../../../templates')`, sits inside `launchServerByType` (`:410-526`).
    - Fix: keep the factory in `src/servers/runtime/`. The same constraint applies to W5-30.
    - T6c also has no characterization in W4, and the file has zero tests. Move it behind W5-29.

## E. REFUTED or weakened findings still acted on, and findings nobody covers

33. **Runtime-js items the designs still treat at first-pass value.**
    - runtime DUP-07 is REFUTED. Sequencing still carries it as "conditional". Fix: drop it and add a note to `templates/components/COMPONENTS.md`.
    - runtime CPX-02 is weakened: keep the 7 positional parameters. Structural T8c still proposes an options object.
    - runtime CPX-03: the `isRequestCurrent` helper must leave the `ok` check at each call site.
    - runtime CPX-01: the appliers need `(flags, state, refs)`, not the flags alone.
    - R02 (runtime DUP-04): the ar-fill-light attach path is already tested at `test/analysis/immersiveRigRuntime.test.cjs:507-527`. Only `remove()` is unpinned. Fix: narrow R02 to that.
    - runtime LOG-01': there are three more diagnostic sites. Add `followAndTransform.js:565-567` and `:573-581` and `pointerAndDrag.js:104` to W2-57, or justify leaving them.
    - AVATAR-01': T53 must also fold `AUTO_AVATAR_ID` (`collaborationRoomServer.ts:117`) and the shadowing `VALID_AVATAR_IDS` (`:127`).
    - W1-14 should cover the three-way map relation. The literal is already touched by `test/analysis/xrChartMappingUiRuntime.test.cjs:395`.

34. **Findings that no design covers and none defers.**
    - From the runtime-js skeptic: MISSED "29 ungated `console.log` in the two SSE live-reload clients".
    - From the runtime-js skeptic: MISSED "`livePanelParser.ts:93` reads an unsorted `readdir`".
    - python CONTRACT-01, the do-not-touch list. Add it to W0-05.
    - hotspots CPLX-09. Only the defective W5-37 touches it.
    - New from this review: the tree click dispatch root is dead.
      - `ModularTreeDataProvider.handleItemClick` and `handleContextMenu` (`src/views/ModularTreeDataProvider.ts:218-234`) have zero callers. A grep for `.handleItemClick(` and `.handleContextMenu(` finds no call on the tree provider.
      - That makes every section provider's `handleClick` and `handleContextMenu` unreachable. Examples are `src/views/active_servers/ActiveServersSectionProvider.ts:177-186` and `src/views/babia_examples/BabiaExamplesSectionProvider.ts:72-77`.
      - W2-20 and W2-21 delete two leaves but leave the root and four sibling layers.
      - Fix: delete the root first as the proof, then the six layers one per commit. Otherwise record it.

35. **`scripts/prepare-dev-extension.mjs:68` removes the staging directory before copying.**
    - The "stale residue" risk note on DUP-09' and P20 is therefore moot. No action is needed beyond correcting the note.

## F. Gates that cannot run as written

36. **The four browser harnesses need Playwright Chromium and live CDNs.**
    - Evidence: `test/manual/*.html` load scripts from `aframe.io`, `unpkg.com` and `jsdelivr`. `npm ci` does not install Chromium.
    - Fix: add `npx playwright install chromium` to step 0. Keep the harnesses out of required CI.
    - `+H:project-evolution` on W5-08 proves nothing about the code being changed. `test/runners/run-project-evolution-harness.cjs` loads only templates and never `out/**/projectEvolutionService.js`. Gate W5-08 on W5-01 instead.
    - `+F5` is human-only. Batch the F5 checks per session and bisect if one fails.

37. **`dA` and H1 name two different builds.**
    - Sequencing uses the dev `compile`. Guardrails uses `CODEXR_NO_SOURCEMAPS=1 npm run package`.
    - Fix: use the production build. The hash stays constant across W2a, so build once per commit and compare with the previous hash.
    - The "CI required" step needs a branch-protection change on master, which only the maintainer can make.

## G. Scope realism and cut line

38. **Most likely to slip. Mark these as cut-line candidates now, and make the exit criteria conditional on them.**
    - W5-57, the venvManager split. Keep only structural's `pythonCommandRunner` slice.
    - W5-25 and W5-26, the room identity and registry extractions.
    - W5-27 and W5-28, the screenBroadcast split.
    - W5-30 to W5-32, the launcher split. The file has zero tests.
    - W5-35 and W5-36, the later handleServerActions steps.
    - The W5 part of hist T2: W5-08, W5-09 (CX-10) and W5-11 (`exportFolder`).
    - W5-47 to W5-49, the Python dependency-engine phases.
    - W5-50 to W5-52, the runtime decompositions.
    - T56 to T59, together with W3-10. The 278 floating promises are measured; the `no-misused-promises` fallout is not.
    - W5-19, W5-37, W5-38 and W5-42 to W5-43.
    - HTTPS slice S6.
    - Exit-criteria rows that depend on these: "worst Python CCN ≤15", "files over 600 lines ≤4", "largest file ≤700" and "floating promises 0".

## Approved as-is

- W0-01 and W0-02, the NUL fix. Verified: one NUL byte at `templates/components/codexr/xr-chart-mapping-ui/xrChartMappingUiRuntime/chartDataSlice.js:125`.
- W1-01, W1-08 to W1-18, W1-20 and W1-21.
- W2a whole-file deletions.
  - Grepping `test/` and `scripts/` for the basenames of W2-06 and W2-09 to W2-21 finds no text pins.
  - The only `serverItems.ts` hit, at `test/servers/remoteAccessImplementation.test.cjs:15`, reads the live `src/views/servers/items/serverItems.ts`, not the W2-13 target.
  - W2-08's four assertions are correctly identified.
  - The engine barrel chain has zero importers.
- W2-31 keeps the `src/servers/runtime/index.ts:13-16` re-exports pinned by `test/analysis/virtualScreenRuntime.test.cjs:157-158`. The REFUTED EXPORT-02 is honoured.
- W2-45. The pins at `test/analysis/reanalysisArchitecture.test.cjs:136-137` survive through `autoAnalysisEnabledCommands.ts:48-49` and `autoAnalysisDelayCommands.ts:130`.
- W2-55. The negatives at `test/analysis/xrDataSource.test.cjs:236-280` stay valid. Maintainer decision 4 overrides the skeptic's "do not delete".
- W2-62. `'project'` is never passed; `TargetType` is `'file' | 'directory'`.
- The other REFUTED findings are handled correctly: CPLX-03 by T07 to T09, CPLX-10 by W2-37 and T11, DEAD-06 by W5-46, HYG-03 by W1-16, HYG-02 by W2-42, and servers TYPE-01 as record-only.
- hist DUP-07 as a module-private classifier, with `classifyIndexedRevision` untouched.
- Structural T3 quirks are verified: JSON `42` produces no log, and JSON `null` falls into the text branch.
- Structural T4 table facts are verified: neither method uses `this`, the `analysis` row has the `['analysisItemType','type']` asymmetry, and `carriedProps` differs from `ctorCarried`.
- Structural T5 and T7, the golden-first `analyze_classes` work.
- The guardrails sink design, including the bounded buffer and the five L-pins of F8. Clarify that "lazy factory not invoked" applies only after a sink is attached.
- The guardrails F9 enum fix. Verified at `test/analysis/livePanelDomIntegration.test.cjs:32`.
- The ruff configuration with no formatter.
- T55, the favicon change.
- P20, the `sumaryFiles` rename.
- PKG-03. No code reads `dist/templates`. The `dist` lookups at `executePython.ts:394-419` and `gitRevisionExporter.ts:84` resolve only `dist/code_analysis/python`, which the python copy still provides.

### Critical Files for Implementation
- `C:\Users\Admin\Desktop\Desarrollo\Code-XR\test\runners\run-node-tests.cjs`
- `C:\Users\Admin\Desktop\Desarrollo\Code-XR\src\views\ModularTreeDataProvider.ts`
- `C:\Users\Admin\Desktop\Desarrollo\Code-XR\src\code_analysis\engine\utils\executePython.ts`
- `C:\Users\Admin\Desktop\Desarrollo\Code-XR\test\servers\remoteAccessImplementation.test.cjs`
- `C:\Users\Admin\Desktop\Desarrollo\Code-XR\test\analysis\virtualScreenRuntime.test.cjs`
