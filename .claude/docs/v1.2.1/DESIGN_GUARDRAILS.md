# v1.2.1 Design — safety net, guardrails, logging programme

> **Purpose**: file-level design for W0, W1, W3 and the logging migration: CI, test helpers (sourceText, fakeVscode), the command-contribution contract test, the tight ratchet, the H1/H2 characterization standards, the staged ESLint/tsc/ruff rollout, the vscode-free log sink, and the typing plan.
> **Stability**: frozen design input (2026-09-18). It was written read-only, before `node_modules` existed, so it contains estimates; `ROADMAP.md` carries the measured numbers and the rulings that override it. Where this file and `ROADMAP.md` disagree, `ROADMAP.md` wins.

---

This is a read-only design. Every fact below was checked against the working tree (master `bcb34bd5`, identical to the v1.2.1 source). Root = `C:\Users\Admin\Desktop\Desarrollo\Code-XR`. Counts for tsc, eslint, webpack, VSIX and ruff fallout could not be measured because `node_modules` is absent; W0 captures them.

## 0. Verified facts the design rests on

| # | Fact | Evidence |
|---|---|---|
| F1 | The lint gate cannot fail. | `eslint.config.mjs:17-27` has 5 rules, all `warn`, no `ignores`, and the parser block has no `files` key. `package.json:758` runs `eslint src` with no `--max-warnings`. |
| F2 | `compile-tests` never cleans `out/`. `test:unit` does not depend on a build. | `package.json:756`, `:761`. |
| F3 | The unit suite has an undeclared webpack prerequisite. | `test/analysis/analysisNamespace.test.cjs:29` asserts `dist/extension.js` exists. |
| F4 | `commandRegistry.test.cjs` never loads the real registrations. | It only feeds synthetic arrays to `assertUniqueCommandIds` (`test/commands/commandRegistry.test.cjs:3-44`). |
| F5 | Static extraction of command ids is impossible. A contract test must execute `registerAllCommands`. | A grep-level scan found 62 literal ids against 70 contributed. 28 contributed ids are built dynamically: `src/commands/analysis/AnalysisCommands.ts:44` (template literal) and `:65` (`registration.commandId`). All registration funnels through one call, `src/utils/commandBuilder.ts:24`. |
| F6 | The logger drops everything before `initialize()`, and that window is not empty. | `src/core/logging/logger.ts:87-90`. `src/extension.ts:32` calls `initializeExtensionContext` (which logs at `src/core/extensionContext.ts:28`) before `CodeXRLogger.initialize` at `:33`. |
| F7 | 1,652 `console.*` calls in 143 files. 25 of those files are vscode-free (265 calls). | Tests execute several vscode-free files that log, by requiring them from `out/`: `fileHashCalculator.ts` (24 calls), `pythonEnvUtils.ts` (4), `sha256Generator.ts` (3), `analysisRefreshCoordinator.ts:484`, `collaborationRoomServer.ts` (1). Importing `logger.ts` there would pull in `vscode` and break those suites. |
| F8 | Exactly 5 test pins are satisfied only by text inside a `console.*` call. | `launcherLivePanel.ts:78,:81` (pinned at `livePanelDomIntegration.test.cjs:108-109`). `sessionRegistry.ts:158` (`directoryAnalysisStartup.test.cjs:18`). `executePython.ts:166,:207` (`directoryAnalysisStartup.test.cjs:25`). `httpsDefaultServer.ts:52,:264` hold the only occurrences of "generated local certificates" in that file (`httpsCertificates.test.cjs:88`). No test asserts `console.` itself. |
| F9 | The only fake-vscode precedent uses wrong enum values. | `livePanelDomIntegration.test.cjs:32` has `ExtensionMode: { Development: 1, Production: 2 }`. The real API is Production=1, Development=2. It also loads via a `.ts` transpile hook, not `out/`. |
| F10 | All unit tests share one process and one `require.cache`. | `run-node-tests.cjs:39` uses `--test-isolation=none`. That flag does not exist on Node 20. Local Node is v24.19.0, so `DEVELOPMENT.md:10` ("Node.js 16+") is stale. |
| F11 | The git index is LF (736 files) but the working tree is CRLF (`core.autocrlf=true`). | `dist/extension.js` bytes and source-text tests therefore differ between the Windows dev machine and an ubuntu runner. `reanalysisArchitecture.test.cjs:143` is a negative assertion containing a literal `\r\n`, so it is already vacuous on LF. |
| F12 | The typing work is blocked by shape pins. | `remoteAccessImplementation.test.cjs:190-191` pins `(modularItem as any).participant = child.participant;`. `analysisTreeBridge.test.cjs:12` pins `originalAnalysisItem?: any;`. `livePanelDomIntegration.test.cjs:200` pins `private parsePythonOutput(stdoutData: string): any {`. |
| F13 | 80 of 102 template JS files are manifest fragments that do not parse standalone. | `webpack.config.js:53-57`; 11 `manifest.json` directories. ESLint cannot lint them as files. |
| F14 | Python source is pinned on quote style and on import-after-`sys.path` order. | `xrFieldSchemaIntegration.test.cjs:15` pins `choices=['livePanel', 'xr', 'schema', 'dependencies']`. `analysisPaths.test.cjs:28-29`. `main.py:12-17`. A formatter or isort would turn these red. |
| F15 | `eqeqeq`, `curly` and `no-throw-literal` have about 0 violations by grep. | The one hit is browser JS inside a template string, `pairingPage.ts:201`. |
| F16 | There are 26 deliberate `require(` calls in src. | 8 of them are in `ModularTreeDataProvider.ts:462-558`. The TS recommended set (`no-require-imports`) would flag them. |
| F17 | No test pins the `lint`, `compile-tests`, `test:unit` or `test:basic` script text. | Only `compile:dev-host` is pinned, at `devLaunchConfig.test.cjs:33`. |

## 1. W0: baseline capture

This wave makes no commits except the STATUS table. Run from Git Bash on the dev machine. Outputs go to `B=../codexr-baseline`, outside the repo.

```bash
git switch v1.2.1 && git status --short                  # must be empty
mkdir -p $B
{ node -v; npm -v; python --version; git rev-parse HEAD; git config core.autocrlf; } > $B/env.txt
npm ci --no-audit --no-fund

# A. gate as it is today
npm run compile && npm test 2>&1 | tee $B/npm-test.txt   # record tests/suites/pass/fail/skipped/duration
for i in 1 2 3; do npm run test:unit 2>&1 | tail -12; done                   # flake baseline (socket tests, 2500 ms timeouts)
npm run test:python | tee $B/py.txt
npm run test:analysis | tee $B/analysis.txt

# B. stale-out probe (F2)
node -e "require('fs').rmSync('out',{recursive:true,force:true})" && npm run compile-tests && npm run test:unit

# C. tsc flags, one at a time
for f in noUnusedLocals noUnusedParameters noImplicitReturns noFallthroughCasesInSwitch; do
  node ./node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false -p . --$f > $B/tsc-$f.txt
  echo "$f $(grep -c 'error TS' $B/tsc-$f.txt)"
  grep -oE 'error TS[0-9]+' $B/tsc-$f.txt | sort | uniq -c
  grep -oE '^src[^(]+' $B/tsc-$f.txt | sort | uniq -c | sort -rn | head -15
done
node ./node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false -p . --lib ES2022 | grep -c 'error TS'          # DOM-lib probe
node ./node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false -p . --types node,vscode | grep -c 'error TS'   # mocha-types probe

# D. ESLint fallout per candidate rule (no config edit)
E="node ./node_modules/eslint/bin/eslint.js src -f json"
$E -o $B/eslint-now.json
$E -o $B/eslint-cand.json --parser-options projectService:true \
 --rule '{"@typescript-eslint/no-unused-vars":["warn",{"args":"after-used","argsIgnorePattern":"^_","varsIgnorePattern":"^_","caughtErrors":"none","ignoreRestSiblings":true}]}' \
 --rule '{"@typescript-eslint/no-explicit-any":"warn"}' \
 --rule '{"@typescript-eslint/no-floating-promises":["warn",{"checkThenables":true}]}' \
 --rule '{"@typescript-eslint/no-misused-promises":"warn"}' \
 --rule '{"@typescript-eslint/no-require-imports":"warn"}' \
 --rule '{"no-console":"warn"}' --rule '{"eqeqeq":"error"}' --rule '{"curly":"error"}' --rule '{"semi":"error"}' --rule '{"no-throw-literal":"error"}'
$E -o $B/eslint-dist.json --rule '{"complexity":["warn",0]}' \
 --rule '{"max-lines-per-function":["warn",{"max":1,"skipBlankLines":true,"skipComments":true}]}' \
 --rule '{"max-lines":["warn",{"max":1,"skipBlankLines":true,"skipComments":true}]}' \
 --rule '{"max-depth":["warn",0]}' --rule '{"max-params":["warn",0]}'
node -e "const r=require(require('path').resolve(process.argv[1]));const c={};for(const f of r)for(const m of f.messages){const k=m.ruleId||'fatal';c[k]=(c[k]||0)+1}console.table(c)" $B/eslint-cand.json
```

- Parse the numbers out of the `eslint-dist.json` messages to get histograms and p90/p95/p99 for each size rule.
- ESLint 9's `complexity` also counts optional chaining and default values. Its numbers will be higher than the audit's 81/31/10/6.
- Recommended-set fallout needs config objects. Measure it with an untracked `eslint.measure.mjs` at the repo root, run with `-c`, and delete it afterwards. It must be at the root so the plugin import resolves.
- Also check that `typescriptEslint.configs['flat/recommended']` exists in the installed 8.31. If it does not, W3 adds the `typescript-eslint` meta-package.

```bash
# E. ship artefacts
for i in 1 2; do CODEXR_NO_SOURCEMAPS=1 npm run package && sha256sum dist/extension.js && wc -c dist/extension.js; done  # hashes MUST match (determinism)
find dist -type f | sort | xargs sha256sum > $B/dist-prod.sha256
find dist -type f | wc -l; du -sb dist
CODEXR_NO_SOURCEMAPS=1 npm run compile && sha256sum dist/extension.js && wc -c dist/extension.js   # unminified build, used by standard H2
npm run package:vsix && wc -c artifacts/code-xr-1.2.1.vsix
unzip -l artifacts/code-xr-1.2.1.vsix > $B/vsix-files.txt; unzip -Z1 artifacts/code-xr-1.2.1.vsix | wc -l

# F. ruff probe (throwaway venv outside the repo)
python -m venv $B/rv && $B/rv/Scripts/python -m pip install ruff
$B/rv/Scripts/ruff check src/code_analysis/python test/python scripts --select E9,F,C901 --target-version py37 --statistics
```

- **Gate:** the two production hashes match. Every number lands in a new "Tool-measured baseline" table in `V1.2.1_STATUS.md`, with platform and EOL noted. Open a draft PR from v1.2.1 to master so CI runs on every push once W1a lands.
- **Risk:** none, nothing in the repo is mutated. If the build turns out to be non-deterministic, standard H1 must be redesigned before W2 starts.

## 2. W1: safety net

One commit per lettered item, in the order given in §6.

### (a) CI: `.github/workflows/ci.yml`

- **Triggers.** `pull_request` to master, `push` to master, and `workflow_dispatch`. There is deliberately no push trigger on v1.2.1. The draft PR covers it and avoids duplicate runs.
- **Hardening.**
  - `permissions: contents: read`.
  - `concurrency: ci-${{ github.ref }}` with `cancel-in-progress: true`.
  - First-party `actions/*` only, no secrets, no coverage uploaders.
  - Env: `DO_NOT_TRACK=1`, `npm_config_audit=false`, `npm_config_fund=false`, `npm_config_update_notifier=false`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.
- **Node.** Add a `.nvmrc` containing `24` and point `actions/setup-node` at it via `node-version-file`. It is not in the `files` allowlist (`package.json:49-63`), so it never ships. Fix `DEVELOPMENT.md:10` in the same commit.
- **Job `gate`.**
  - Matrix: `[windows-latest, ubuntu-latest]` with `fail-fast: false`.
  - Steps: `npm ci`, then `npm test`. This is the exact local gate with no CI-only steps.
  - ubuntu starts with `continue-on-error: true` because it is the repo's first LF/POSIX run (F11). Flip it to required in a later commit once its fallout is fixed with test-only changes.
  - Do not override autocrlf. Windows runners check out CRLF like the dev machine and ubuntu checks out LF, so the matrix covers both worlds.
- **Job `python`.**
  - Same OS matrix, `actions/setup-python` 3.12, env `CODEXR_PYTHON=${{ steps.py.outputs.python-path }}`. No `npm ci` is needed because the runners use Node builtins only.
  - Runs `run-python-tests.cjs`, `run-analysis-tests.cjs`, `run-html-analysis-tests.cjs`.
  - Prerequisite commit 1: `run-python-tests.cjs:76-82` exits 1 instead of 0 when `process.env.CI` is set.
  - Prerequisite commit 2: `run-analysis-tests.cjs:75` installs `lizard==1.17.31`. The test file added with it parses the pin out of `src/python_env/runtime/pythonPackageManifest.ts:13` and asserts the runner's literal matches.
- **Job `package`.** PR only, windows: `npm run package:vsix`, `node scripts/dist-fingerprint.mjs`, then upload the VSIX and the fingerprint JSON with 14-day retention.
- **Job `harness`.** PR and dispatch only, ubuntu: `npx playwright install --with-deps chromium`, then the four harness runners.
- **Gate:** the workflow is green on windows.
- **Risk:** socket-timing flakes in `test/servers`; mitigated by the W0 flake baseline and the absence of retries.

### (b) Clean `out/` before `compile-tests`

`package.json:756` becomes:

```
"compile-tests": "node -e \"require('fs').rmSync('out',{recursive:true,force:true})\" && node ./node_modules/typescript/bin/tsc -p . --outDir out"
```

- `watch-tests` is untouched.
- **Gate:** W0 probe B is green.
- **Risk:** a test that was passing only against a stale `out/` file turns red. That is the purpose; fix it in the same commit.

### (c) Declared build prerequisites

- Keep `analysisNamespace.test.cjs:29` as it is.
- `test:basic` becomes `typecheck && lint && compile && compile-tests && test:unit`. Every W2 commit needs a dist build anyway.
- `run-node-tests.cjs` gains a preflight that exits 1 with an actionable message in three cases:
  - `dist/extension.js` is missing;
  - `out/` is missing;
  - the newest mtime under `src/**/*.ts` is later than the oldest `out/**/*.js`, which means stale. This check is valid because (b) rewrites all of `out/` on every build.
- Update `DEVELOPMENT.md` and the `verify` skill text in the same commit.
- **Risk:** `npm test` gets slower by one webpack run.

### (d) `test/helpers/sourceText.cjs` and the source-text policy

Helper API:
- `readSource(posixPath)` returns LF-normalised text. It throws "deleted or moved: update this test in the same commit" when the file is gone.
- `readConcatenated(paths[])`. The precedent already exists at `dependencyGraph.test.cjs:566-569`.
- `readSourceTree(dir, {exts, exclude})`.
- `assertAbsent(text, pattern, {canary})`. The canary is mandatory and must match, which proves the haystack is the right code.
- `assertOrdered(text, [a, b, ...])`.
- `collectFiles()`, the walker lifted from `uiPolicy.test.cjs:27-49`.

The policy goes into `test/README.md` and cleanup `SKILL.md` §3. Before any commit touches file F, run `grep -rn "<basename>" test/ scripts/`, paste the hits into the commit message, and classify each pin:

| Class | What it is | Rule |
|---|---|---|
| **G**, permanent guard | Negative removal guards; cross-artefact contracts (manifest to src, TS to Python, TS to template mirrors); security and privacy intent such as `safeRequestUrl` or no bundled certs; packaging; policy walks. | Keep. If F is split, retarget the haystack to `readConcatenated` or `readSourceTree` of the successor files, with a canary, in the same commit. The regex itself does not change. |
| **S**, shape pin | Exact signature, `as any` cast, import line, identifier, adjacency, ordering or whitespace. F12 lists three. | A behavioural characterization (loaded from `out/` with the fake vscode) must land in a prior commit that is green against the unchanged source. Only then may the refactor commit relax the pin. If the behaviour needs a real extension host, retarget the pin like a G and list it as "unconverted" in STATUS. |
| **L**, log-literal pin | The 5 pins in F8. | The message text survives verbatim in the same file or its successor set. |

Two further rules:
- A commit never edits a regex and the source it guards together, unless the edit is pure retargeting.
- Negative assertions must be EOL- and whitespace-insensitive.

One test-only commit fixes `reanalysisArchitecture.test.cjs:143` and any siblings that a small scan finds.

There is no mass rewrite. The helper is mandatory for new or edited tests and under the touch rule only.

- **Gate:** `npm test`.
- **Risk:** low.

### (e) `test/helpers/fakeVscode.cjs`

API:
- `createFakeVscode(overrides)` returns `{ vscode, channels, registeredCommands, executedCommands, messages, setConfig(key, value), fireConfigChange(key) }`.
- `fakeExtensionContext({extensionMode, root})` returns a context with an mkdtemp storage directory, in-memory Mementos and an empty `subscriptions` array.
- `withFakeVscode(fake, fn)` and `freshRequireOut(relPath)`.

Real minimal implementations, because tests assert properties on them:
- `TreeItem`, `ThemeIcon`, `ThemeColor`, `Uri` (`file`, `parse`, `joinPath`, `fsPath`), a working `EventEmitter`, `Disposable`.
- Enums with real values: `ExtensionMode {Production:1, Development:2, Test:3}` (this fixes F9), `TreeItemCollapsibleState`, `ConfigurationTarget`, `ProgressLocation`, `ViewColumn`.
- `getConfiguration().get(key, default)` returns the default unless `setConfig` was called.

Recorders for `createOutputChannel`, `show*Message`, `registerCommand` and `executeCommand`.

Everything else is an auto-stub Proxy. It is callable and constructible, and it exposes a real `prototype` so that `class X extends vscode.Y` works. A `strict: true` option throws on any API that was not listed.

`withFakeVscode` hooks `Module._load` for the `vscode` id and restores it in `finally`. It also evicts every `out/` module loaded during the callback from `require.cache`. That eviction is mandatory under F10, because otherwise fake-bound singletons leak into other suites.

The helper loads modules from `out/`. It has its own `test/helpers/fakeVscode.test.cjs`. A separate follow-up commit migrates `livePanelDomIntegration.test.cjs:20-91` to it with the assertions unchanged.

- **Risk:** medium. Mitigate fidelity gaps with strict mode and per-test overrides.

### (f) `test/commands/commandContributions.test.cjs` and `test/commands/internalCommandIds.cjs`

Inside `withFakeVscode`, the test loads `out/commands/index.js`, calls `registerAllCommands(fakeContext)` and reads `registeredCommands`. This is the first test that executes `assertUniqueCommandIds` on the real set, which is exactly the activation failure that W2's 18 command deletions could cause.

Assertions:
1. `registerAllCommands` does not throw.
2. `contributed − registered = ∅`.
3. `registered − contributed` equals exactly the ids in `INTERNAL_COMMAND_IDS`. Each entry is `{id, kind: 'tree-item' | 'programmatic' | 'legacy-alias' | 'pending-removal', reason}`. The list is seeded at 53 (123 − 70).
4. Every internal id whose kind is not `pending-removal` is referenced at least once outside its registration, in `src/`, `templates/` or the package.json menus and keybindings. "Unreachable registered command" becomes machine-checked.
5. Every command id in menus and keybindings is contributed.
6. Legacy aliases are present. Alias-ness is declared by hand with `kind: 'legacy-alias'` in `internalCommandIds.cjs`, because the fake vscode exposes only the id and the wrapper callback. The check is that every `legacy-alias` entry remains registered.

Each W2 command deletion must edit the list in its own commit, and that edit is its before/after record.

Time-box the loader. `analysisCommands.ts:42-53` builds 11 Setting objects and storage at registration time, so the temp-dir context may need a few overrides. The fallback is a TS-AST extractor of `id:` and `commandId:` literals plus the 11 `runLast` expansions. It is weaker because it cannot prove assertion 1.

Update the `verify` skill row for `src/commands/**`.

- **Risk:** medium.

### (g) Ratchet: `test/tooling/measureGuardrails.cjs`, `guardrail-baseline.json`, `guardrailRatchet.test.cjs`

Add scripts `guardrails:measure` and `guardrails:update`.

**Measurement** uses the TypeScript compiler API, parse only, about 2 s. The precedent is `require('typescript')` at `livePanelDomIntegration.test.cjs:6`. A console call inside a browser template string (`pairingPage.ts:201`) is correctly not counted, which matches `no-console`.

Baseline shape:

```json
{ "schemaVersion": 1,
  "generatedBy": "node test/tooling/measureGuardrails.cjs --write",
  "definitions": { "<metric>": "<counting unit>" },
  "ratcheted": {
    "console.total": 0,
    "console.byModule": { "code_analysis": 0, "servers": 0 },
    "console.allowlist": ["src/core/logging/logSink.ts"],
    "catch.consoleOnly": 0, "catch.emptyNoComment": 0,
    "any.total": 0, "any.byModule": {},
    "suppressions.total": 0,
    "size.filesOver500": ["<paths>"],
    "functions.over80Lines": 0,
    "complexity.over10": 0, "complexity.over15": 0, "complexity.over20": 0, "complexity.over30": 0,
    "reachability.unreachable": ["<paths>"],
    "commands.internalIds": 53,
    "templates.ungatedConsoleLog": 0,
    "eslint.maxWarnings": null },
  "informational": { "src.files": 0, "src.lines": 0, "console.byFile": {}, "any.byFile": {}, "complexity.worst10": [], "size.maxFileLines": 0 },
  "waivers": [] }
```

Metric definitions:
- **CCN** = 1 + the number of `if`, loops, `case`, `catch`, `?:`, `&&`, `||` and `??`. This is the script's own definition and does not claim parity with ESLint.
- **`reachability.unreachable`** = modules with no import, export-from, `require('./…')`, `import()` or type-only edge from `src/extension.ts`, minus modules that a test requires via `out/` or reads as text.
- **`templates.ungatedConsoleLog`** is regex-based because of F13. It excludes `xr-chart-debug`, whose console output is behaviourally tested at `xrChartDebugRuntime.test.cjs:309-335`.
- **`suppressions.total`** counts `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` and `eslint-disable`. It stays at 0.
- **`eslint.maxWarnings`** is read from the `lint` script. It is the only metric where "must not exceed the baseline" has any force.

Ratchet semantics:
- The ratchet is tight. A worse value fails the test and names the offending files. A better value also fails, with the message "run npm run guardrails:update and commit the baseline in this commit".
- The baseline diff is therefore each item's recorded before/after measurement.
- Lists must be a subset of the baseline; shrinking a list requires updating it.
- Per-module maps absorb file splits. Per-file data is informational only and drives the worst-first ordering.
- `--write` refuses a regression unless `--allow-regression "<reason>"` is given. That appends `{metric, from, to, reason, date}` to `waivers`. Adding a new lint rule is the only expected use.
- Files must be emoji-free (`uiPolicy.test.cjs:105-115`).

- **Risk:** low. Land this before W2 so that deletions show up as numbers.

### (h) Two characterization standards

Files: `scripts/dist-fingerprint.mjs` and `scripts/dist-diff.mjs`. Both only hash or diff; neither builds anything. Both standards are documented in cleanup `SKILL.md` §3.

**H1, deletion of an unreachable file (hard gate).**
- Procedure: before editing, run `CODEXR_NO_SOURCEMAPS=1 npm run package` then `node scripts/dist-fingerprint.mjs > $B/before.json`. Apply the change, rebuild, fingerprint again.
- Pass condition: the `extension.js` sha256 is identical, and the dist file-list diff equals exactly the predicted removed copied assets. That set is empty for TS deletions and non-empty for `.py` or template deletions.
- The comparison is always parent against HEAD on the same machine, never against a stored global hash (F11).
- Commit trailer: `Characterization: dist-identical <sha12>`.
- The same gate applies to typing-only commits in §5.

**H2, removal of an in-file dead declaration (reviewed shrink).**
- Record both builds.
  - Production build: bytes and sha. It may come out identical because of tree-shaking; record that if so.
  - Unminified `npm run compile` build: `dist-diff.mjs` reports `{bytesBefore, bytesAfter, insertedLines, deletedLines}`.
- Pass condition: `insertedLines == 0`, or every inserted line is explained in the commit message. Module-id renumbering happens when a deleted import orphans a module.

Optional: a `workflow_dispatch` job that re-verifies every `dist-identical` trailer in a commit range, building each commit once.

## 3. W3: guardrails on, staged so the gate is never red

One commit per step. A rule lands at `error` only when its count is 0, or its fixes are in the same commit. Never run a blanket `eslint --fix`. Autofix is allowed only as `--fix --rule X` for one rule, followed by the full gate, because `curly`, `prefer-const` and import fixes rewrite pinned lines.

1. **Restructure only.**
   - Global ignores: `dist out artifacts output .vscode-test node_modules manual_test examples pages media docs resources test/fixtures test/manual/assembled src/code_analysis/python templates/components/codexr/*/*/**`. The last entry is the fragments (F13).
   - Add `files: ["src/**/*.ts"]` to the parser block. Keep the same 5 rules at the same severities.
   - Characterization: `eslint --print-config src/extension.ts` and the warning count are both identical before and after.
2. **Promote the 5 existing rules to `error` and add `--max-warnings=0`.** F15 predicts zero fallout. The gate can now fail.
3. **`@typescript-eslint/no-unused-vars` at `error`.**
   - Options: `{args:'after-used', argsIgnorePattern:'^_', varsIgnorePattern:'^_', caughtErrors:'none', ignoreRestSiblings:true}`.
   - If W0 shows more than about 40 sites, enable the rule progressively by glob (`UNUSED_VARS_DONE = [...]`), one directory per commit with its fixes.
   - Before deleting an import, grep `test/` for the symbol. Import lines are pinned, for example `livePanelDomIntegration.test.cjs:116`.
   - Safety basis: TS import elision, since the tsconfig has no `verbatimModuleSyntax`. Spot-check with H1.
4. **Recommended sets: `@eslint/js` plus the TS `flat/recommended`.**
   - Declare `@eslint/js` and `globals` as devDependencies.
   - Every rule with fallout goes into an explicit `TRIAGE` block at `warn`. Set `--max-warnings=N` to the measured total and record it in the baseline with a waiver.
   - Afterwards, one commit per rule: fix it, promote it to error, lower N.
   - `@typescript-eslint/no-require-imports` is `error` globally and `off` in an override naming the 7 files from F16, with the reason in a comment.
   - `linterOptions.reportUnusedDisableDirectives: "error"`.
5. **Type-aware rules.** `parserOptions: {projectService: true, tsconfigRootDir: import.meta.dirname}`. Add `no-floating-promises {checkThenables:true, ignoreVoid:true}` and `no-misused-promises`, both at `warn`. N rises once, by waiver. No lint cache.
6. **Size rules at `warn`.** `complexity 15`, `max-depth 4`, `max-lines-per-function {max:80, skipBlankLines, skipComments}`, `max-lines {max:500, skipBlankLines, skipComments}`, `max-params 5`. Confirm each threshold against the W0 distribution in the commit message. N rises once.
7. **`no-explicit-any` at `warn`.** N rises once.
8. **Second config block** for `test/**/*.cjs` (commonjs), `scripts/**/*.mjs`, `webpack.config.js` and `eslint.config.mjs`.
   - Use `js.configs.recommended` with `globals.node`, `no-unused-vars` with the same options, and `no-console` off.
   - The `lint` script moves to explicit roots: `eslint src test scripts webpack.config.js eslint.config.mjs`.
9. **`tsconfig.tooling.json`.**
   - Options: `allowJs`, `checkJs`, `noEmit`, `module`/`moduleResolution: NodeNext`, `types: ["node"]`, `strict`, `skipLibCheck`.
   - Include: `webpack.config.js`, `eslint.config.mjs`, `scripts/**/*.mjs`.
   - `typecheck` chains both projects.
10. **tsconfig flags, in this order.**
    1. `noFallthroughCasesInSwitch`.
    2. `noImplicitReturns`, with explicit-return fixes. This is the only flag that forces edits; check for S-pins first.
    3. `noUnusedLocals`, flipped only after step 3 has driven its count to 0, so the flip is free.
    4. `noUnusedParameters` stays **off**, by decision. ESLint's `after-used` owns unused parameters. The tsc flag forces `_` renames on positional callback parameters, and ts-loader shares this tsconfig, so any transient unused symbol would fail the F5 `compile` preLaunchTask. Reconsider only if the W0 count is 20 or fewer.
    - `noImplicitOverride`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `consistent-type-imports` are record-only. The last one's autofix rewrites pinned import lines.
11. **Python lint.** Put `ruff.toml` at the repo root. A config file inside `src/code_analysis/python` would ship, because of `webpack.config.js:42-47`.
    - `include = ["src/code_analysis/python/**/*.py","test/python/**/*.py","test/analysis/*.py","scripts/*.py"]`.
    - `[lint] select = ["E9","F","C901"]`, `unfixable = ["ALL"]`, `mccabe.max-complexity = 20`.
    - `per-file-ignores` with C901 for `class_counter_analyzer.py`, `dependency_analysis_engine.py` and whatever other offenders W0 measures. Remove each ignore when its W4/W5 rewrite lands.
    - Do not select E402, I, W, E501 or Q, and do not use `ruff format` (F14).
    - Add `test/runners/run-python-lint.cjs` and a `lint:python` script. It skips with a warning locally and exits 1 under `CI`. It is part of `test:all` and the CI python job, but not `npm test`. Pin ruff to an exact version in CI.
12. **Templates block, last.**
    - Covers the 22 standalone `templates/**/*.js` files only.
    - Settings: `sourceType: "script"`, `globals.browser` plus `AFRAME`, `THREE`, `module`, `exports`, `js.configs.recommended`, `no-undef` at warn, `no-console` off.
    - Fragments are covered by a new `test/analysis/assembledRuntimesParse.test.cjs` that runs `new vm.Script(readAssembledRuntime(...))` for each manifest. A manifest-aware ESLint processor is record-only.
    - Closing: `no-console`; see §4.

- **Gate for every step:** `npm test` green, baseline updated.
- **Risk:** step 4 is the largest unknown. Steps 3 and 10.2 touch source, so use the pin grep and H1.

## 4. The logging programme

### Sink: `src/core/logging/logSink.ts`

It imports `./logPolicy` only and never `vscode`.

```ts
export type MessageFactory = string | (() => string);
export interface ScopedLogger { debug; info; warn; error }   // moved here; logger.ts re-exports it
export interface LogSink { appendLine(line: string): void }
export interface LogCore {
  getLogger(scope: string): ScopedLogger;
  write(level, scope, message, metadata?): void;
  attachSink(sink: LogSink): { dispose(): void };
  setVerbose(enabled: boolean): void;
}
export function createLogCore(opts?: { bufferLimit?: number; mirror?: Pick<Console,'warn'|'error'> }): LogCore;
export const logCore: LogCore;                     // process-wide default
export const getLogger = (scope: string) => logCore.getLogger(scope);
export function formatLogLine(iso, level, scope, msg): string;   // `[ISO] [LEVEL] [SCOPE] msg`, byte-identical to logger.ts:94
export function formatMetadata(m: unknown): string;               // moved verbatim from logger.ts:113-127
```

`logger.ts` keeps its public API, so the 15 existing importers do not change. Its `getLogger` and `write` delegate to `logCore`. `initialize()` does, in order: create the channel, `updateLoggingMode` (which calls `logCore.setVerbose`), then `attachSink({appendLine: l => channel.appendLine(l)})`, pushing the returned disposable. The config listener calls `setVerbose`.

Import rule: migrated modules import `{ getLogger }` from `core/logging/logSink`. Only `extension.ts` needs `logger.ts`.

### Pre-initialize decision: bounded buffer, not drop

- Records are rendered eagerly into a ring of 500, drop-oldest, with an "N earlier lines dropped" marker.
- The buffer is flushed on `attachSink`, with level gating applied at flush time, when verbosity is known.
- While no sink is attached, warn and error are also mirrored to `console.warn` and `console.error`. That is the single allowlisted console use.

Why this and not the alternatives:
- **Dropping** loses real output (F6). It also violates ERR-03 in the scenario where a failed activation never reaches `initialize`.
- **Console fallthrough** makes pre-init verbosity ungated and never reaches the output channel.
- **The buffer** makes the ordering at `extension.ts:32-33` irrelevant. Its bound keeps unit-test processes and failed activations leak-free.

After the channel is disposed, or when `appendLine` throws, the core detaches and returns to buffer-plus-mirror. Logging never throws.

Test observation: `createLogCore()` gives each test its own instance with a memory sink, so there is no shared state under F10.

### Contract tests (three commits)

1. `test/logging/logger.test.cjs`, using the fake vscode, pins the **current** contract:
   - one `CodeXR` channel;
   - the line shape;
   - the lazy factory is not invoked when the level is gated;
   - Error metadata renders as `.stack`, a string passes through, a circular object falls back to `String()`;
   - warn and error are always emitted;
   - the dev-mode and setting matrix;
   - a second `initialize` adds no listener (`logger.ts:55-57`);
   - a config change emits "Verbose logging enabled.";
   - lines before `initialize` are **dropped**.
2. The sink extraction flips exactly that one assertion, from dropped to buffered then flushed. It adds `test/logging/logSink.test.cjs`, which needs no vscode and covers buffer order, the bound and its marker, the mirror, sink-throw safety and the verbose toggle. It also adds a permanent guard that `logSink.ts` contains no vscode import and loads from `out/` bare.
3. CHANGELOG line: diagnostics move from the DevTools console to the CodeXR output channel, and detail requires `codeXR.debug.verboseLogs`.

### Mapping rule (mechanical)

- `console.error` becomes `logger.error`. `console.warn` becomes `logger.warn`. These are never downgraded.
- `console.log` becomes `logger.debug`.
- **Named `info` exceptions** are state transitions of a user-visible resource:
  - server started or stopped, with its URL;
  - analysis started or completed for a target;
  - Python environment created or repaired;
  - tunnel up or down;
  - export completed;
  - watcher started or stopped;
  - certificate pair generated.
- The existing `PREFIX:` moves to the scope argument. The rest of the literal stays verbatim. Secondary prefixes stay in the message.
- Arguments:
  - `(msg, err)` becomes `(msg, err)`.
  - `(msg, obj)` becomes `(msg, obj)`.
  - Three or more arguments become `(msg, [rest])`.
  - Interpolated templates take the lazy `() =>` form.

### ERR-03 safety rule

- A `console.log` inside a `CatchClause`, or one carrying the caught error (for example `pythonEnvUtils.ts:193,:220,:241`), maps to at least `logger.warn`. The only exception is a block commented as an expected probe and listed in the commit message.
- Conversion commits are 1:1. The number of console calls removed equals the number of logger calls added, there are no control-flow edits, and nothing is deleted.
- Narration pruning (blank separators, "Step N" lines, banners) is a separate commit per top-level module after that module's conversion.
  - It may not touch any line inside a catch block.
  - It may not delete an F8 literal.
- Enforcement comes from `catch.emptyNoComment = 0` and a `catch.consoleOnly` that only falls. No separate ERR-03 pre-pass is needed.

### Commit order, worst first

Current counts; W2 deletions reduce several first. Each commit lowers the baseline and appends its glob to `NO_CONSOLE_DONE` in `eslint.config.mjs`, where `no-console: "error"` applies. Every intermediate state is locked and shippable.

| # | Scope | Calls | Notes |
|---|---|---|---|
| 1 | `code_analysis/engine/utils` | 175 | `executePython.ts` 126, keep literals `:166` and `:207`. `saveFiles.ts` 25. `fileHashCalculator.ts` 24: after EXPORT-03 the remainder is tested and vscode-free, so it uses the sink. |
| 2 | `servers/runtime` TLS and launcher | 121 | `multiServerLauncher` 54, `httpsDefaultServer` 37 (keep the literal at `:52` or `:264`), `httpsCustomServer` 30. |
| 3 | `servers/runtime` remainder | 134 | `sseClientRegistry` 34, `SSEManager` 25, `httpServer` 20 (keep the `safeRequestUrl` lines), `staticAssets` 19, `portManager` 15. Mostly vscode-free. |
| 4 | `views` | 130 | |
| 5 | `active_servers` | 127 | `serverControl` 46, `handleServerActions` 38. |
| 6 | `code_analysis/views` | 110 | |
| 7 | `visualize_data` | 108 | |
| 8 | `code_analysis/commands` | 104 | |
| 9 | `visualization_settings` | 83 | |
| 10 | `babia_templates` | 72 | |
| 11 | `utils` | 50 | `commandBuilder.ts:27,:49`; `sha256Generator` uses the sink. |
| 12 | `babia_examples` | 49 | |
| 13 | `servers/{commands,utils,views}` | 67 | `servers/views` is 0 if DEAD-02 has landed. |
| 14 | `code_analysis/engine/{parsers,watchers,servers}` | 108 | |
| 15 | `code_analysis/{engine/launchers, engine/core, engine/processors, engine root, services, configuration, refresh, utils}` | about 91 after W2 | Keep the literals `launcherLivePanel:78,:81` and `sessionRegistry:158`. `configuration` falls from 105 to about 15 once `configurationManagerExample` (44) and `debugThemeProblem` (46) are deleted. |
| 16 | `python_env` 26, `commands` 4, `core` 1, `remote_access` 1 | 32 | `pythonEnvUtils` uses the sink. |
| 17 | Closing | | Replace `NO_CONSOLE_DONE` with `src/**/*.ts`. Override `no-console: off` for `src/core/logging/logSink.ts` only. The ratchet asserts `console.total` equals the allowlisted count. |

Gate for each commit: `npm test`, plus re-running the "pin satisfied only by console text" scan, which must still report the same 5 pins satisfied.

### Templates: a separate convention, not a migration

- `console.warn` and `console.error` are for genuine faults.
- `console.log` goes only through each runtime's existing gate. Do not add a new global.
  - `DEBUG_MODE`/`debugLog` at `directoryAnalysismain.js:26-33`.
  - `analysisModeRuntime/constantsAndDomUtils.js:68`.
  - `analysisTableRuntime/geometryUtils.js:148`.
- `xr-chart-debug` is exempt.
- Document the convention in `templates/components/COMPONENTS.md`. Only the `templates.ungatedConsoleLog` ratchet lands now. The runtime-js LOG-01, LOG-02 and LOG-03 edits wait for their skeptic pass.

## 5. Error handling and typing

**`withErrorHandler`: delete it.** `src/utils/errorHandler.ts:75-90` has zero references in src, test, scripts, templates or `.claude`. Use standard H2. Adopting it instead would replace site-specific defaults with `undefined`, which changes behaviour.

- Do not adopt `handleError` anywhere new in 1.2.1. The logging programme already owns those catch lines.
- `handleError(…, Log)` loses the module scope, and `errorHandler.ts` imports vscode.
- Keep the `ErrorDomain` enum members.
- Record-only for 1.3.0: ERR-04b's 21 sites that return a silent default, and the domain taxonomy.
- The 11 `catch { /* reason */ }` blocks are the house convention. They are pinned by `catch.emptyNoComment = 0`.

**TYPE-01, the `SectionChild` union.** Create `src/views/common/sectionChild.ts`. It is types only, uses `import type` for the 8 item classes, and exports `SectionChild`.
- `ModularTreeItem` gains the missing carried fields (`participant`, `pythonEnvItemType`, `learnMoreItemType`, `originalLearnMoreItem`, …) as `declare` fields. With `target: ES2022`, `useDefineForClassFields` is on, so a plain optional field emits an own-property initializer. That would change runtime and dist.
- Hard constraints:
  - the 8 `require()` calls at `:462-558` stay;
  - the diff has no new value import of any `*Items` module.
- Gate: **H1 byte-identical**, since types erase.
- Prerequisite commit: `test/views/modularTreeRoundTrip.test.cjs`, using the fake vscode.
  - It calls `ModularTreeDataProvider.prototype.createModularChild` and `convertToSectionItem` for all 8 sections.
  - It asserts that the 17 carried properties survive both conversions.
  - Only after that may the S-pins at `remoteAccessImplementation.test.cjs:190-191` and `analysisTreeBridge.test.cjs:12` be relaxed, in the typing commit.
- Risk: medium. The `ModularTreeDataProvider` graph may be heavy to load; if so, use prototype calls with a stub `this`.

**TYPE-02, typed Python result.** Create `src/code_analysis/engine/models/pythonAnalysisResult.ts`, types only.
- Contents: envelope, file, directory, schema and dependency payloads, plus a stderr progress line type.
- Derive the types from `test/python/**`, `xr_field_schema.py` and the `manual_metrics_suite` outputs, never from TS usage.
- Apply them to the 10 `Promise<any>` signatures in `executePython.ts` (`:26-368`). `chartTypeFile.ts:200` is excluded.
- There is no runtime guard in 1.2.1. A guard that rejects would be a behaviour change, so record it for 1.3.0. `parsePythonOutput` returns `unknown` and is cast at the boundary.
- Prerequisite: a behavioural `parsePythonOutput` test via the fake vscode, which replaces the S-pin at `livePanelDomIntegration.test.cjs:200`.
- Gate: H1 byte-identical, plus `npm run test:all` and `test:analysis`. `npm test` does not run the Python suites.

**TYPE-03.** `directoryReanalysisData.ts` is a good third candidate. It has 13 any-escapes, a real unit test, and it is vscode-free.

**Everything else** is covered by the tight `any.total` and `any.byModule` ratchet, `no-explicit-any` at warn, and `suppressions.total = 0`.

## 6. Landing order

1. W0.
2. W1a-pre, the two runner fixes.
3. W1a, CI. It lands green because it runs today's gate.
4. W1b.
5. W1c.
6. W1d, the helper plus the policy, then the vacuous-negatives fix.
7. W1e.
8. W1f.
9. W1g.
10. W1h, then the docs sync of `test/README.md` and `DEVELOPMENT.md`.
11. W2 runs under H1, H2 and the ratchet.
12. W3 steps 1 to 12.
13. Logging, in parallel with W4: the logger test, then the sink, then rows 1 to 17.
14. The S-pin conversions, then TYPE-01, TYPE-02 and TYPE-03, before W5.
15. Flip ubuntu CI to required once it is green.

## 7. Newly recorded, for 1.3.0 only

- A `LogOutputChannel` with native levels. It would change the line format and the meaning of the verbose setting.
- A runtime guard for the Python payload.
- A manifest-aware ESLint processor for the template fragments.
- `.gitattributes` EOL normalisation.
- `consistent-type-imports`.
- A `semi` replacement before ESLint 10.
- SHA-pinning the GitHub Actions.
- A Python floor job, once the 3.10-floor finding is settled.

### Critical Files for Implementation
- `C:\Users\Admin\Desktop\Desarrollo\Code-XR\package.json` (scripts `:749-773`, devDependencies, contributes; every gate change lands here)
- `C:\Users\Admin\Desktop\Desarrollo\Code-XR\eslint.config.mjs` (the whole W3 staging, `NO_CONSOLE_DONE`, the `no-require-imports` override)
- `C:\Users\Admin\Desktop\Desarrollo\Code-XR\src\core\logging\logger.ts` (becomes the vscode adapter over the new `src/core/logging/logSink.ts`)
- `C:\Users\Admin\Desktop\Desarrollo\Code-XR\test\runners\run-node-tests.cjs` (preflight; the shared-process constraint that shapes `test/helpers/fakeVscode.cjs`)
- `C:\Users\Admin\Desktop\Desarrollo\Code-XR\test\analysis\livePanelDomIntegration.test.cjs` (fake-vscode precedent `:20-91`, `require('typescript')` precedent `:6`, S-pin `:200`, L-pins `:108-109`)
