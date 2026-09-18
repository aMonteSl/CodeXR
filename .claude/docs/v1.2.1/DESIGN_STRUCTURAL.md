# v1.2.1 Design — structural refactors (W4/W5)

> **Purpose**: target architecture and commit slicing for every structural refactor: HTTPS base class, Git-history services, the big-function decompositions, ModularTreeDataProvider registry, component-asset family, oversized server modules, the Python rewrites, browser runtimes and the small twins - each with the characterization test that must land first, and a cut order.
> **Stability**: frozen design input (2026-09-18). It was written read-only, before `node_modules` existed, so it contains estimates; `ROADMAP.md` carries the measured numbers and the rulings that override it. Where this file and `ROADMAP.md` disagree, `ROADMAP.md` wins.

---

This is a plan only; no build, lint or test was run (node_modules is absent). Every file:line below was read in the working tree; items I did not read myself are marked "per audit". I have no Write tool in this session, so the plan is returned inline and not written to the plan file path.

## 0. Cross-cutting facts that shape every target (all verified)

| Fact | Evidence | Consequence |
|---|---|---|
| The unit suite runs in one process with one require cache. | `test/runners/run-node-tests.cjs:38-40` uses `--test-isolation=none --test-concurrency=1`. | A fake-vscode helper must be scoped. After each use it must purge every `out/` module it loaded, or singletons such as `UnifiedSessionRegistry` leak into other test files. Any socket or server test that leaks a handle hangs the whole gate. |
| Webpack cannot resolve `require(variable)`. | `webpack.config.js:10-12`; the lazy `require()` calls in the tree provider are literal strings. | Any lazy-require table must store thunks that contain a literal `require('…')`. |
| The HTTPS `staticRoot` default is `__dirname`-relative. | `httpsCustomServer.ts:40`, `httpsDefaultServer.ts:35`. | New server modules must stay in `src/servers/runtime/` at the same depth, or the `out/` behaviour changes. |
| The repo targets ES2022 with define semantics for class fields. | `tsconfig.json` target ES2022; TypeScript ^5.8.3 (`package.json:789`). | A subclass that redeclares a base field silently resets it to `undefined`. Review rule: no field redeclaration in subclasses. |
| Two audit slices labelled "zero-risk" are not. | Found while verifying; see T6b (`mediaFrame.ts`) and T8a (LivePanel SSE hoist). | Both break existing source-text tests as the audit wrote them. |

**Shared prerequisites.** W1 owns these; this plan consumes them.
- `test/helpers/fakeVscode.cjs` exposes `withFakeVscode(stub, load => …)`.
  - It uses a scoped `Module._load` hook with `finally` restore.
  - It purges `require.cache` for everything loaded under `out/`.
  - It ships a scripted `window` (a queue of dialog answers) and minimal `TreeItem`, `ThemeIcon`, `ThemeColor`, `EventEmitter` and `TreeItemCollapsibleState` classes.
- `test/helpers/sourceText.cjs` exposes `readSources([...])`. When a file is split, its pins are re-pointed to "file plus its extracted siblings". Negative assertions then do not go vacuous.
- `compile-tests` cleans `out/` first.
- Every file-split commit regenerates the guardrail baseline in the same commit. Per-file console and any counts move with the code; the total must not rise.
- Each commit message pastes `grep -rn "<basename>" test/` for every touched file.

**Sequencing against the logging migration.** Land the structural extraction first, with strings byte-identical. Then migrate logging in the smaller units. `classifyStderrLine` returning `logLines[]` is what makes that second step cheap for `executePython.ts`.

---

## T1. HTTPS servers

**Decision.** Use a thin abstract base class that holds only state and delegation, plus a free function for the TLS options literal. Do not use a template-method `start()`.
- `start()` diverges in five places, so a template method would need five hooks:
  - certificate resolution before listening;
  - an ENOENT arm in the error handler, custom only (`httpsCustomServer.ts:99`);
  - the listening bodies (`httpsCustomServer.ts:106-131` vs `httpsDefaultServer.ts:99-117`);
  - an extra `certificate` arm in `tlsClientError`, custom only (`httpsCustomServer.ts:147`);
  - a listen callback, default only (`httpsDefaultServer.ts:139`).
- Pure composition cannot remove the 7 delegations and 4 lifecycle members, about 65 lines in each class.
- The `ServerInstance` union (`multiServerLauncher.ts:22`) keeps working structurally.

**Layout.**
- `src/servers/runtime/httpsTlsOptions.ts` is vscode-free. It exports `HTTPS_CIPHER_SUITES` and `buildTlsServerOptions(cert, key): https.ServerOptions`.
- `src/servers/runtime/httpsServerBase.ts` exports `abstract class HttpsServerBase<TConfig>`.
  - Protected fields: `server`, `isRunning`, `config`, `httpHandler`, `certificateManager`.
  - A protected constructor that merges defaults and constructs the `HttpServer`. It holds no guards and no log.
  - Protected helpers: `resolveListeningPort()` and `createTlsServer(sslOptions)`, which does `createServer`, `attachToNodeServer` and the `'close'` handler.
  - Abstract members: `validateCertificates()`, `start()`, `getConfig()`.
  - Public members: `stop`, `forceStop`, `getIsRunning`, `getServerUrl`, and the 7 delegations.
- The subclasses keep:
  - the constructor guards, placed before `super()`. They touch only the parameter, which is legal in TS ≥ 4.6. Their order differs today (`httpsCustomServer.ts:29-35` vs `httpsDefaultServer.ts:28-30`) and must stay so.
  - the constructor log and the `start()` orchestration with its three differing handlers.
  - `getConfig` (custom redacts at `httpsCustomServer.ts:201-207`; default returns a plain copy at `httpsDefaultServer.ts:188-190`) and `getFullConfig`.
  - a `loadSslOptions` wrapper with its own log and its own throw prefix (`httpsCustomServer.ts:386` vs `httpsDefaultServer.ts:310`).
- The literal `generated local certificates` must remain in both files (`test/servers/httpsCertificates.test.cjs:88-89`).

**Characterization first: `test/servers/httpsServerLifecycle.test.cjs`.** It runs under fakeVscode and loads from `out/`.
- Certificates are minted at test time by `GeneratedHttpsCertificateManager` into a temp dir, following the pattern at `httpsCertificates.test.cjs:19-52`. They are RSA via `selfsigned`, so they match the RSA-only cipher list. No PEM files are committed.
- The JSON transcript snapshots these observables:
  1. The guard matrix, including which message wins when both preconditions fail. This proves guard order.
  2. `start()` resolves `https://localhost:<port>`. `getServerUrl()` returns `https://0.0.0.0:<port>`. A second `start()` rejects.
  3. With the base port occupied, the server takes the next port and `config.port` is mutated.
  4. Real TLS requests:
     - A GET with `rejectUnauthorized:false` records the status and content-type. This proves delegation to `handleRequest`.
     - With the client at `maxVersion:'TLSv1.2'`, the negotiated cipher is one of `HTTPS_CIPHER_SUITES`.
     - A client that offers only a cipher outside the list fails the handshake. This pins the TLS options literal by behaviour.
  5. A wss upgrade over TLS reaches the collaboration path, which proves `attachToNodeServer`.
  6. Custom server:
     - A valid pair produces no toast. `getConfig()` redacts and `getFullConfig()` does not.
     - A missing or invalid pair triggers the fallback: exactly one `showWarningMessage` with the exact text plus `Configure Certificates`, and the config paths switch to temp storage.
  7. Default server: the `HTTPS server ready…` toast with its three buttons.
  8. The deadlock-fix proof:
     - The test opens one keep-alive request, one open `/events` SSE response and one wss socket.
     - `stop()` must resolve in under 2 s.
     - Call-order spies show `disposeRuntimeFeatures` ran before `server.close`.
  9. A normalized console transcript that must stay byte-identical.
- Every test stops its server in `finally`, because the process is shared.

**Slices.**
- S1, in W2: DEAD-01. Delete `httpsCustomServer.ts:250-285` and `:390-532`, `httpsDefaultServer.ts:229-248` and `:314-375`, the dead statement at `httpsCustomServer.ts:108`, and the `X509Certificate` imports.
- S2: the harness.
- S3: `httpsTlsOptions.ts` plus a unit snapshot of the pure function.
- S4: the base class with fields, delegations, `getIsRunning`/`getServerUrl` and constructor wiring.
- S5: `resolveListeningPort` and `createTlsServer` move into the base.
- S6: `stop`/`forceStop` move into the base. This slice is last and is its own revertable commit, because it carries the shipped deadlock fix.

**Delta.**
- The two files go from 949 lines to about 700 after S1, then to about 440 plus a 130-line base and a 35-line TLS module.
- Identical lines go from 162 to under 15. CCN is unchanged.
- Risk: medium.

**Left for 1.3.0.** Sharing `HttpServer.stop()` with the HTTPS pair (DUP-02). Unifying certificate validation across its three failure UXs. A template-method `start()`.

---

## T2. Git-history services

**Decision.** Use composition and free functions in vscode-free modules. Do not introduce a base class.
- Source-text pins force the following to stay in each service file:
  - the constructor wiring (`analysisServerCapabilities.test.cjs:137-142`);
  - `return this.gitService.getAvailability(` (`gitRefPickerRuntime.test.cjs:285-286`);
  - `getSession`, which admits XR or LivePanel in historical (`livePanelHistorical.test.cjs:33`) and XR only in evolution;
  - `filterSources`, `excludeSource` and `recordDeterministicExclusion` (`livePanelHistorical.test.cjs:79-86`);
  - the directory branch of `decoratePayload` (`historicalComparison.test.cjs:342` and `:423`).
- Inheritance therefore buys almost nothing without rewriting about 12 pins.
- The skeptic's constructor-ordering hazard disappears when each service resolves its own session and passes it in.

**W4 slices: no test edits, no new harness.**
1. `src/code_analysis/historical/gitAnalysisShared.ts` imports only `path` and `crypto`. It exports `toPortableRelativePath` and `buildAnalyzerCacheKey(cacheVersion, commitSha, session)`.
   - It replaces three byte-identical copies: `historicalComparisonService.ts:480-498`, `projectEvolutionService.ts:641-659`, `gitRevisionExportCore.ts:111-129`.
   - The core stays vscode-free.
   - The cache namespaces stay distinct because each service passes its own `ANALYZER_CACHE_VERSION` literal (`historicalComparisonService.ts:28`, `projectEvolutionService.ts:27`).
   - The test `test/analysis/gitAnalysisShared.test.cjs` lands in the same commit and pins:
     - `''` → `unknown`; `'./a//b/'` → `a/b`; `'a\\b'` → `a/b`; `'.///'` → `unknown`;
     - an absolute path inside the root → posix relative; an absolute path outside → basename;
     - a candidate equal to the root → `''`. That is a real quirk and the test must pin it.
   - Net about −50 lines.
2. `requireUsablePayload(source, payload, exclude)` becomes a free function. `excludeSource` stays per service. Net about −20.
3. `src/servers/runtime/analysis/analysisBridgeReplies.ts` holds:
   - `broadcastFilteredGitReferences(host, ctx)`, moved verbatim. It removes `historicalComparisonBridge.ts:225-244` and the inline copy at `projectEvolutionBridge.ts:218-233`.
   - `replyWithReferences(ctx, {load, referencesType, errorType})`.
   - `describeBridgeError(error, fallbackCode)`, applied only at `historicalComparisonBridge.ts:212-218` and `projectEvolutionBridge.ts:238-244`. It is not applied at `projectEvolutionBridge.ts:83` or `:128`.
   - All wire-type strings are passed in as arguments, so the pinned literals stay in the bridge files. Net about −45.

**W5: only after a behavioural characterization exists.**
- `test/analysis/gitHistoryServices.test.cjs` uses fakeVscode, a registry stub and an `ExecutePython` stub injected through `require.cache`, and a real temp git repo (pattern at `historicalComparison.test.cjs:202-323`). It snapshots:
  - the constructor throw matrix by analysis mode;
  - the busy codes `comparison-busy` and `project-evolution-busy`;
  - the missing-target policy: historical throws and does not cache (`historicalComparisonService.ts:248-254`); evolution caches `missingTarget:true` and records a per-frame exclusion (`projectEvolutionService.ts:499-507`, `:214-219`);
  - the exact output of the three file-target decorators, including the ordinal, the `entry.name` fallback and no trim in evolution;
  - cache isolation, measured by analyzer call counts;
  - the artifacts written;
  - that `dispose` disposes an owned catalog only.
- Then `gitAnalysisSessionContext.ts` adds:
  - `GitAnalysisSessionContext`, which takes an already-resolved session, the snapshot namespace, the error code and the cache version. It owns `gitService`, `sourceCatalog`, the cache, `filterReferences`, `getAvailability` and `dispose`.
  - `SingleJobGate<TReq,TRes>`.
- Each pin is retired in the commit that moves its text, and replaced by the behavioural assertion.

**Delta.** W4 removes about 115 lines. W5 removes about 60 more and takes `analyzeSource` from two copies to one with a policy parameter. Risk: W4 low, W5 medium.

**Left for 1.3.0.**
- Unifying the three file-target decorators.
- The live-vs-export evolution-key divergence.
- Deleting DEAD-02, the unreachable guard at `historicalComparisonService.ts:158-163`. That is a defence decision, not a refactor.

---

## T3. Big-function decompositions

**With behavioural tests.** Each commit is an in-file extraction gated by the existing suite.

| Function | Extracted functions | CCN before → after |
|---|---|---|
| `buildExportManifest` (`exportManifest.ts:310-489`) | `collectDependencyEntity`, `collectComparisonReplays`, `findNewestEvolutionRevision`, `resolveExportGitData`, `buildAnalysisViewEntity`, and three pure reason builders (`dependencyGraphReason`, `historicalComparisonReason`, `projectEvolutionReason`) | 61 → orchestrator ≈ 8, largest part ≈ 9 |
| `runGitRevisionExport` (`gitRevisionExportCore.ts:190-429`) | module-private `classifyExportRevisionFailure(reason)` (the chain at `gitRevisionExportCore.ts:331-346`; it must not touch `gitAnalysisEligibility.ts`), `groupSourcesByCommit`, `writeWorkingCopyPayload`, `prepareStoreOrCancel`, `exportRevisionGroup`, `assembleGitData` | 46 → ≈ 10, largest part ≈ 8 |
| `relativizeExportArtifacts` (`exportManifest.ts:180-240`) | `rewriteUrlFields(record, keys): boolean` | 18 → ≈ 8 |
| `validateExportPackage` (`exportPackageTransaction.ts:118-166`) | `assertIsFile(absolutePath, failureMessage)` and `collectManifestPayloadUrls(manifest)`. Callers keep their own path resolution and message. | 16 → ≈ 6 |
| `listReferences` (`gitRepositoryService.ts:41-140`) | per-format parsers and `parseForEachRefOutput` | 26 → ≈ 8 (estimate from the audit; I did not read this body) |
| `materializeDirectory` (`gitRepositoryService.ts:317-404`) | `planDirectoryMaterialization`, which stores `relativeFromTarget`, and `copyPlannedFiles`. The unreachable re-guard goes. | 19 → ≈ 8+6 (estimate from the audit; I did not read this body) |

Before the first split, one commit strengthens the nets:
- `exportManifest.test.cjs` gains a byte-level `JSON.stringify` snapshot per scenario, with `exportedAt` normalized. The runtimes iterate `entities` in order, so the push order and key order are behaviour.
- `gitRevisionExporter.test.cjs` gains a snapshot of `gitData` plus the directory listing.

**Pinned by source text only.**

- **`classifyStderrLine`: `executePython.ts:474-548`, CCN 34.**
  - A new vscode-free module `src/code_analysis/engine/utils/pythonStderrProtocol.ts` exports `classifyStderrLine(line): { kind; logLines: string[]; report?: { message: string; increment?: number } } | null`.
  - The callback keeps the chunk split and does `if (progress && r.report) progress.report(r.report)`.
  - The test `test/analysis/pythonStderrProtocol.test.cjs` pins a table of about 20 lines, including two quirks:
    - valid JSON that is a non-null primitive, e.g. `42`, produces no log at all;
    - JSON `null` falls into the text branch.
  - CCN goes to about 4 for the callback and about 9 and 7 for the two classifier halves.
- **`spawnAndCollect`.**
  - Signature: `spawnAndCollect(...): Promise<{kind:'spawn-error';result}|{kind:'closed';code;stdout;stderr}>`.
  - First resolve wins, as today. The close logs still print after an error, as today.
  - `resolvePythonScriptPath` stays in the file, because `'dist', 'code_analysis', 'python'` is pinned (`analysisPaths.test.cjs:11-12`).
  - The signature `private parsePythonOutput(stdoutData: string): any {` is pinned (`livePanelDomIntegration.test.cjs:200`). The typing perspective's TYPE-02 must update that pin.
  - `executePythonScript` shrinks from 242 lines to about 60.
  - `executeXRAnalysis`: the four `progress.report` literals at `executePython.ts:208`, `:218`, `:257` and `:291` keep their strings and their position relative to the returns. The recovery path at `:257` and the normal path at `:291` both still emit.
- **`exportFolder`: `activeAnalysesCommands.ts:304-572`, CCN 45.**
  - Private methods, all in the same file: `promptGitExportRequest(session, selection): Promise<{kind:'request';value}|{kind:'abort'}>`, itself split into `pickGitScope`, `pickPerformanceProfile` and `confirmGitExport`; then `chooseExportDestination`, `stageExportPackage` and `reportExportCompletion`.
  - The first QuickPick stays inside `exportFolder`. The new methods are declared after it, so `canPickMany: true` still precedes `openLabel: 'Select Export Destination'` (`activeAnalysesActions.test.cjs:161-163`). Add the `Continue Export` positional assert.
  - Parameter names carry the pins. The helpers must use exactly `sourcePath`, `destinationPath`, `stagingPath`, `selection`, `transaction`, `manifest`, `session` and `capabilities`. The pins at `activeAnalysesActions.test.cjs:60-61`, `:112`, `:119-128`, `:131`, `:139` and `:165-166` match full call text.
  - Characterization first: a scripted-dialog test under fakeVscode over 8 paths (cancel at each gate, zero commits, destination exists, non-XR happy path), recording the dialog sequence and the final toast.
  - CCN goes to about 9, with the largest helper about 10. Risk: medium.
- **`dependencyGraphBridge`.** Two changes, both in the same file:
  - Hoist the six Sets to module-level constants. Do not name any of them `allowedGranularity`; there is a negative pin.
  - Extract `sanitizeDependencyScope(payload)` and the defaults table, guarded by a `deepEqual` snapshot.
  - The `existingDependencyState?.layout|mapping|scope` texts stay in the file (`dependencyGraph.test.cjs:575-577`). CCN goes from 22 and 19 to about 10 and 8.
- **`analysisMessageRouter` (CX-10).**
  - The descriptor table destroys the pinned `allowsEmptyShell = mode === 'historical-compare' … || mode === 'project-evolution'` at `analysisMessageRouter.ts:116-117`.
  - It belongs in W5, behind a behavioural router test.

---

## T4. ModularTreeDataProvider

**Layout.** An in-file, module-scope table.

```ts
interface SectionItemAdapter {
  sectionName: string;
  itemTypeKeys: string[];      // convertToSectionItem reads these in order with ||
  defaultItemType: string;
  carriedProps: string[];      // child → modularItem copy-back
  ctorCarried: string[];       // trailing constructor args
  loadItemClass: () => new (...a: any[]) => vscode.TreeItem; // thunk with a LITERAL require()
}
const SECTION_ITEM_ADAPTERS: readonly SectionItemAdapter[] = [ /* 8 rows, in today's chain order */ ];
```

Verified divergences the table must transcribe:
- `analysis` uses `['analysisItemType','type']` in `convertToSectionItem` (`ModularTreeDataProvider.ts:522`). In `createModularChild`, `child.type` is the ninth and last arm (`ModularTreeDataProvider.ts:403-412`). That chain is therefore `adapters.map(a => a.itemTypeKeys[0])`, then `child.type`, then `'item'`.
- The copy-back blocks are independent `if`s keyed on the child's own discriminators, not on `sectionName` (`ModularTreeDataProvider.ts:420-452`). The rewrite must iterate all adapters.
- `originalAnalysisItem` and `originalLearnMoreItem` are copied back (`ModularTreeDataProvider.ts:440`, `:451`) but are never passed to constructors (`ModularTreeDataProvider.ts:519-528`, `:559-568`). That is why `carriedProps` differs from `ctorCarried`.

**Characterization first: `test/views/modularTreeItemBridge.test.cjs`.**
- It loads under fakeVscode and calls the two methods through the prototype with `.call({})`. Neither method uses `this` (`ModularTreeDataProvider.ts:398-573`), so no provider, `VenvManager` or registry is constructed.
- For each of the 8 sections it feeds these children:
  - a full child;
  - a child with no discriminator;
  - a child whose label is an object;
  - a child with two discriminators, as an order proof;
  - a child carrying only `type`.
- It snapshots the 17 carried properties of each modular item, then the constructor name, item type and carried props of the converted item. An unknown section must come back unchanged.

**Slices.**
- C1: the test.
- C2: `createStaticSectionHeader` becomes a free function. I did not check whether it uses `this`.
- C3: `convertToSectionItem` moves to the table. CCN goes from 42 to about 5. This retires the text pin at `remoteAccessImplementation.test.cjs:191`; the behavioural "participant survives both conversions" assertion is stronger.
- C4: `createModularChild` moves to the same table. CCN goes from 21 to about 6. This retires `remoteAccessImplementation.test.cjs:190`.
- C5, optional: the 8 section literals move to `src/views/sectionDefinitions.ts`.
  - `analysisTreeBridge.test.cjs:19` (`AnalysisSectionProvider`) is re-pointed.
  - The three negative pins at `analysisTreeBridge.test.cjs:22-24` are extended to the new file.

The `analysisItemType` and `originalAnalysisItem` literals stay satisfied because the table is in the file. Risk: medium. It removes about 110 lines.

**Left for 1.3.0.** The typed `SectionChild` union (TYPE-01, `import type` only). An options-object constructor for the item classes.

---

## T5. Component-asset family

**Decision.** Use per-file descriptors plus a generic core, not one central table.
- A central table would pull the exported identifiers out of their files.
- Its only other consumer would be the unified XR parser manifest, which the skeptic refuted.

**Layout.** `customComponents/singleFileRuntimeAsset.ts` is not added to `index.ts`. It exports:
- `SingleFileRuntimeAsset { outputName; sourceSegments; label }`;
- `assertSourceExists`, `resolveRuntimeSourcePath`, `assertRuntimeSourceExists`, `copyRuntimeToOutput`, `readRuntimeContent`.

Each asset file keeps its `*_OUTPUT_NAME` constant, a local descriptor and its exported `copy*`/`read*` functions as one-line wrappers. The literally pinned ones stay where they are: `copyVirtualScreenRuntimeToOutput`, `copyCodeXrCollaborationRuntimeToOutput`, `copyCodeXrDomSceneCollaborationRuntimeToOutput`, `copyCodeXrAvatarRuntimeToOutput` (`virtualScreenRuntime.test.cjs:249-252`).

**Characterization first: `test/analysis/componentAssetFamily.test.cjs`.** The family is vscode-free and loads straight from `out/`. For every exported `copy*` or `read*` function:
- `read*` returns bytes equal to the template or the assembled runtime;
- `copy*` writes the expected file name into a temp dir and returns its path;
- a bogus `extensionPath` rejects with the exact `<label> not found at <path>` message. The label strings are the only real transcription risk.

**Slices.**
- A: promote `assertSourceExists` (`collaborationComponentAsset.ts:16-21`) and use it in the 10 files that inline the check.
- B: the generic core for the 8 live single-file assets (avatar, codexrDebug, common, commonGitRefPicker, dependencyVisualBudget, immersiveRig, pointerPolicy, renderBudget). This lands after `visualStyleComponentAsset.ts` has been deleted.
- C: the two embedded single-file blocks, the virtual-screen manager and the dom-scene collaboration runtime.
- D: delete the `resolve*`/`assert*` wrappers that become unused (BOIL-02: zero external consumers).
- E: `codexrRoomComponentAsset.ts` and `guideScreenComponentAsset.ts` are left bespoke in 1.2.1 and named in STATUS.
- F: the parsers become two independent loops.
  - `for (const copy of FILE_XR_COPY_STEPS) await copy(extensionPath, outputPath)` uses a literal array kept in each parser file.
  - All 22 calls share one signature (`fileXRParser.ts:127-148`).
  - Order and membership are untouched. The guard list at `fileXRParser.ts:171+` is untouched. The pins are bare identifiers and stay green.

**Delta.** About −120 lines for A to C, and about −60 for D. Risk: low to medium.

---

## T6. Oversized modules

- **a. `collaborationRoomServer.ts`, 1,175 lines.** A behavioural test already exists (`test/servers/collaborationRoomServer.test.cjs`).
  - Slice 1: the 11 pure helpers move to `collaboration/roomMessageCodec.ts`: `parseMessage`, `send`, `sendError`, `normalizeEntityState`, `normalizeTransform`, `normalizeVector`, `resolveRoomId`, `normalizeId`, `normalizeOptionalId`, `getEntityKey`, `createId`.
  - Slice 2: the wire and state types move to `collaboration/roomTypes.ts`, re-exported from the class file.
  - Correction to the audit: `CollaborationRoomServerOptions` and `CollaborationApplicationMessageContext` (`collaborationRoomServer.ts:98-115`) must stay in the class file.
    - `handleApplicationMessage?:` occurs only at `collaborationRoomServer.ts:101`.
    - `historicalComparison.test.cjs:385` reads this file alone, so moving the type breaks that pin.
  - About −110 lines from the class.
  - Record for 1.3.0: a room registry, participant identity as pure functions, and the shared WebSocket endpoint scaffold.
- **b. `screenBroadcastSignalingServer.ts`.** The `mediaFrame.ts` slice is not zero-risk.
  - `virtualScreenRuntime.test.cjs:505-521` and about ten assertions further on pin, in this file, the frame constants, `const temporalLayer = kindByte >> FRAME_LAYER_SHIFT;` and the private `shouldThinFrame(...)` signature.
  - Slice: first rewrite that parity test to require `out/.../mediaFrame.js` and compare the exported constants with values parsed from the browser runtime. Extend the negative pins (`MAX_RELAY_VIEWERS`, `relay-capacity`, `'no-signal'`, `broadcast-replaced`) to the new file. Then extract.
  - This is a cut candidate.
- **c. `multiServerLauncher.ts`.**
  - The dead lifecycle half goes in W2 (`multiServerLauncher.ts:233-318`, keeping `getRunningServerCount`).
  - W4 slice: `launch/serverFactory.ts` takes `launchServerByType` and the three `determine*` helpers. The class stays as the façade.
  - Import direction: `multiServerLauncher.ts:10` imports a view module that itself imports `servers/runtime/previewRenderer` (`handleServerActions.ts:6`).
    - Neutral fix: move the `openInBrowser` and `openInPanel` bodies verbatim to `src/active_servers/services/serverOpenActions.ts`.
    - `ServerActionHandlers` delegates to it. The launcher imports the service; that edge already exists at `multiServerLauncher.ts:11`.
    - This slice is optional and last.
- **d. `handleServerActions.ts`.**
  - Commit 1: `serverDetailsFormat.ts` takes the formatting band at lines 717-815 plus `getServerLabel` (:503), `formatRemoteStatus` (:770) and `formatPendingRequests` (:789).
  - Commit 2: `withServer(serverId, fn)` replaces the 7 registry-lookup guards. The toast and the `console.error` stay verbatim.
  - The 15 public statics are preserved.
  - The action table is left for 1.3.0. It cannot be keyed on `action`, because `appendRemoteActions` emits two `remoteStatus` entries.
- **e. `venvManager.ts`, 852 lines, zero tests.** The structural split is not in 1.2.1.
  - The one safe slice is `src/python_env/runtime/pythonCommandRunner.ts`. It is vscode-free and takes `executeCommand`, `createCommandError` and `PythonCommandExecutionError` (`venvManager.ts:474-575`), with an injected `{info,error}` logger and `timeoutMs = 60000`.
  - It is characterized by real child processes using `node -e`: exit 0, non-zero exit, a spawn ENOENT, a timeout with a short override, and the stderr-only output join.
  - Everything else (pip orchestration, filesystem repair, UI) is record-only. A regression there is visible only on a clean machine.
- **f. `activeAnalysesCommands.ts` prelude.** An in-file `resolveSessionOrReport(arg)` serves the five handlers. The two toast strings stay verbatim. It removes about 44 lines and drops `closeAnalysis` from CCN 19 to about 14.

---

## T7. Python

**`analyze_classes` golden characterization.** It must exist first. Today nothing asserts a single value this function produces.
- `test/python/class_counter/test_class_counter_golden.py` is a unittest, discovered by `run-python-tests.cjs:50-63`. The module is stdlib-only.
- Fixtures live at `fixtures/<arm>/sample<ext>`, one per dispatch arm, 21 in total.
  - Aliases are produced at test time by copying the fixture under each alias extension.
  - Extra cases: an uppercase extension, an unlisted extension (the exact 4-key warning dict), an unreadable file and an invalid-UTF-8 file (the error shape).
- `golden/<arm>.json` holds the ordered `classes` list and `classCount`.
  - A committed `regenerate_golden.py` must be run on the pre-refactor code.
  - After the rewrite, `git diff --exit-code` on the goldens must be empty.
- Quirk fixtures:
  - C++ `enum class X` yields two entries (`class_counter_analyzer.py:164` and `:166`).
  - Go `type X struct` yields two entries, as does C `typedef struct`.
  - A dataclass reports the line of its decorator and is excluded by name (`class_counter_analyzer.py:32-60`).
  - Vue line numbers are relative to the first script block after `.strip()` (`class_counter_analyzer.py:456`, `:570`).
  - Vue has its own 10-pattern list (`class_counter_analyzer.py:437-448`), against 13 for JS (`class_counter_analyzer.py:66-80`).
  - Perl uses DOTALL (`class_counter_analyzer.py:422`). Objective-C uses `group(1)`. `.h` routes to the C++ arm (`class_counter_analyzer.py:155`).
  - The `.rs` and `.jsx` arms are covered, and one fixture is CRLF.
- The runner exits 0 when no interpreter is found. The commit message must therefore paste the real unittest summary.

**Rewrite.**
- `_CLASS_SPECS` is a tuple of `(extensions, patterns, flags=re.MULTILINE, source=identity)` in today's `elif` order. A duplicate-extension assert runs at import.
- `_scan(text, patterns, flags)` keeps pattern-major order. `_scan_python` stays bespoke. The Vue row sets `source=extract_script_from_vue`.
- No PEP 604 unions.
- CCN goes from 90 to about 6, 3 and 5. The file goes from 592 to about 260 lines.
- The `main()`, `__main__` and `sys`/`json` import deletion lands first, as its own commit.

**`dependency_analysis_engine.py`, in order.**
- P1: fix the `sys.modules` leak in `test_xr_schema.py`.
- P2: call `_empty_metrics` at the two inline sites.
- P3: call `_add_graph_metrics(nodes, edges)` from `analyze_dependencies`. The inline copy at lines 790-823 is equivalent if every directory node carries `external` (`node["external"]` inline vs `.get` at `dependency_analysis_engine.py:353`). Assert that in the test.
- P4: the `_iter_raw_targets` generator.
- P5: a fallback characterization that saves and restores `sys.modules`, then `_find_block_end` and `_lexical_function_entry`.
- P6 and P7, in W5: a golden payload and cache snapshot over `test/fixtures/dependency-languages/` comes first. Then:
  - `_ensure_external_node`, which has a hard prerequisite on P3 because of `node_by_id[target_id] = external` at `dependency_analysis_engine.py:787` (per audit);
  - the phase split of the CCN 45 and CCN 42 functions.
  - Constraints: `_read_text` stays a module attribute, `root = os.path.realpath(...)` stays verbatim, and node and edge insertion order are preserved.

**Coordinators.** Out of 1.2.1: the module names are load-bearing, the three `main()` functions differ (one prints errors to stderr, the others to stdout — per audit), and the payoff is about 12 lines.

**`sumaryFiles` → `summaryFiles`: in.** One commit after the livePanels twin is deleted.
- I found exactly one binding reference, `executePython.ts:346`, plus `.claude/docs/PYTHON_ANALYSIS.md:42`.
- Webpack `clean:true` handles `dist`.
- A stale directory may remain under `.vscode-test/dev-extension`. The audit judged it harmless; I did not read `scripts/prepare-dev-extension.mjs` myself.

---

## T8. Browser runtimes

The skeptic pass on this area is still pending.

- **a. LivePanel SSE.** The audit's `createLivePanelSse` as written breaks pins.
  - Both panel scripts must contain `case 'dependency-updated':`, `case 'historical-progress':` and `case 'historical-updated':`. The directory script must also contain `flashSSEStatus('New data received')` and `showSSEStatus('connected')`.
  - The pins are at `directoryLivePanelUi.test.cjs:482`, `:573-574`, `:624-626` and `dependencyGraph.test.cjs:681`.
  - Order of work:
    1. Put the directory panel's unconditional logs behind `DEBUG_MODE` (LOG-02).
    2. Add `connectLivePanelSse({label, onMessage})` to `panelShell.js`: EventSource wiring, JSON parse, the `window.analysisSSE` assignment, and open/error status.
    3. Each panel keeps its own `handleSSEMessage` switch. This needs zero test edits and removes about 45 lines.
  - Collision nets: `livePanelBundle.test.cjs:54` and `:70`.
  - Characterization first: a fake `EventSource` driven through the six message types on both bundles, recording callback order.
  - Hoisting the switch is optional and needs the pins re-pointed.
- **b. Immersive rig.** `bindImmersiveSessionLifecycle(component)` is a closure-local helper.
  - It replaces the duplicated wiring at `codexrImmersiveRigRuntime.js:177-185` and `:229-237`.
  - First add the missing `codexr-ar-fill-light` attach/detach test. `immersiveRigRuntime.test.cjs` covers only the rig component.
  - Preserve the bind-before-`addEventListener` order and the early return when there is no scene.
- **c. Decompositions.** Each needs its characterization table first.
  - `refreshUi`: `computeUiFlags` plus three appliers, keeping the sweep order.
  - `computePlanarAxisTargetScale`: an options object, `hasUsableContainmentInputs` and `computeBandState`. No arithmetic is reordered and `!== false` is preserved.
  - `applySharedState`: `isRequestCurrent`. The missing snapshot-identity clause is commented, not added. Adding it would be a behaviour change and is recorded for 1.3.0.
  - All three are cut candidates.
- **d. What may move to `templates/components/common`: nothing in 1.2.1.**
  - The DOM-scene template never loads common.
  - `refreshRuntimeCopies` scans only `templates/components/codexr` (`exportManifest.ts:502`). An exported copy would therefore pair a refreshed consumer with a stale provider.
  - Land the documentation line in `COMPONENTS.md` and one assertion that the DOM template does not reference `codexrCommonRuntime.js`.
- **e. Avatar ids.** The sync test comes first: it compares TS `COLLABORATION_AVATARS`, the `SKINS` table in the avatar runtime and the regex in `clientCore.js`. Then `CODEXR_AVATAR_IDS` is derived on the TS side.
  - Today's import at `collaborationRoomServer.ts:6` is type-only. Making it a value import adds a runtime edge.
  - `collaborationProfile.ts` has no imports, so `out/` stays vscode-free.
  - Never derive from `ASSIGNABLE_AVATAR_IDS`, because it contains `auto`.

---

## T9. Small twins

Each item is one commit.

1. A shared `chartTypeModel.ts` comes first.
   - `ChartType` is declared three times, identically: `analysisConfiguration.ts:10`, `chartTypeDirectory.ts:13`, `chartTypeFile.ts:14`.
   - `ChartTypeInfo` is declared twice.
   - The two `AnalysisMode` unions differ (`chartTypeDirectory.ts:12` vs `chartTypeFile.ts:13`) and are imported as aliases of `AnalysisDirectoryMode` and `AnalysisFileMode`. Types only; nothing is emitted.
2. A chart-type settings core modelled on `sharedDimensionMappingSettingCore.ts`, after a behavioural test that covers the no-chart case for both twins.
   - The configuration carries `unknownChartLabel` and the info-message template.
   - The command factories carry every divergent string.
   - The one error-dialect normalization is record-only, because it changes user-visible text.
3. The `profileConfigurationCommands` block at lines 186-225, which is identical to lines 271-310, becomes `pickSavedProfile()`. Its test must include the bare `catch {}` corrupted-profile case.
4. Launchers: `makeRequirementProcessor` and `makeSessionWatcherStarter`, applied only at the four throwing sites. `launcherVisualizeDOM` is untouched.
5. `CodeXRTreeItemBase` for exactly six classes (the skeptic names five; whether there is a sixth is unresolved).
   - The five confirmed are in `serverItems.ts`, `activeServerItems.ts`, `babiaExampleItems.ts`, `visualizeDataItems.ts` and `visualizationSettingsItems.ts`.
   - Treat `pythonEnvItems.ts` as the sixth only if its `??` tooltip dialect (`pythonEnvItems.ts:30`) is kept as an override.
   - `ModularTreeItem` is excluded. The saving is about 25 lines.
   - This one is cut-eligible.
6. `settingsAccessors.ts`:
   - import the path constants from `settingsStorage.ts` (`settingsStorage.ts:11-13`);
   - add one generic accessor that keeps the globalState fallback for the two colour settings only;
   - make `getAllSelectedSettings` read the file once. A round-trip test comes first.
7. LAN URL: only the three unguarded sites, `handleServerActions.ts:211` and `:721` and `activeServerItems.ts:167`. They go through `NetworkUtils.getExternalUrlOrNull`. The three guarded sites are left alone.
8. The registry-lookup guard is T6d commit 2.

---

## Measurement and gate per item

Each item records in `.claude/docs/V1.2.1_STATUS.md`:
- lines before and after;
- lizard CCN for the touched functions;
- the identical-line count for the de-duplication pairs;
- the test count.

Gates:
- `npm test` must be green on every commit.
- T7 also needs `npm run test:python`.
- T7 and T3 also need `npm run test:analysis`.
- T8c needs the matching browser harness.

## Ranking by value-to-risk

1. T3, the behaviourally tested splits (the CCN 61 and 46 functions plus the four smaller ones).
2. T7, `analyze_classes` (CCN 90, with full goldens).
3. T2, the W4 slices.
4. T3, the `executePython` classifier and spawn split, which also unlocks the logging migration.
5. T5, slices A to D and F.
6. T1, the HTTPS servers.
7. T4, the tree registry.
8. T9, items 1, 3, 6, 7 and 8.
9. T6, items a, d, f and the runner slice of e.
10. T8, items a, b, d and e.
11. T7, the dependency engine slices P1 to P5.
12. T3, `exportFolder`.
13. T2, the W5 composed context.
14. T3, the router table (CX-10).
15. T7, P6 and P7.

**Cut order if time runs out, first to go first:**
1. T7 P6 and P7.
2. The T2 W5 context.
3. CX-10.
4. `exportFolder`.
5. The T8c decompositions.
6. T6b, `mediaFrame.ts`.
7. T6c, the launcher import direction.
8. T9 item 5 and T9 item 4.
9. T4 slice C5.
10. T1 slice S6.
11. The T8a switch hoist.

Already out of 1.2.1: the `venvManager` split, the coordinators, a central asset manifest, and any move into `common/`.

### Critical Files for Implementation
- C:\Users\Admin\Desktop\Desarrollo\Code-XR\test\runners\run-node-tests.cjs
- C:\Users\Admin\Desktop\Desarrollo\Code-XR\src\code_analysis\export\exportManifest.ts
- C:\Users\Admin\Desktop\Desarrollo\Code-XR\src\code_analysis\python\tools\class_counter_analyzer.py
- C:\Users\Admin\Desktop\Desarrollo\Code-XR\src\servers\runtime\httpsCustomServer.ts
- C:\Users\Admin\Desktop\Desarrollo\Code-XR\src\views\ModularTreeDataProvider.ts
