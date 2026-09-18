# Code-XR Development Workflow

> **Purpose**: Build, test, run and package the extension. Read this before running any command or claiming a change "works".
> **Stability**: Stable — update when scripts, launch configs, or test layers change.
> Verified against `package.json`, `.vscode/launch.json`, `.vscode/tasks.json` and `test/runners/` on 2026-07-08.

## Environment

- **Platform**: developed on Windows 11; npm scripts deliberately call tool binaries via `node ./node_modules/<tool>/bin/...` instead of bare CLI names (Windows robustness). Keep that style when adding scripts.
- **Requirements**: VS Code ≥ 1.98.0, **Node.js 24** (pinned in `.nvmrc`, which CI reads; the unit runner passes `--test-isolation=none`, which older Node versions do not have), Python 3.7+ (the extension creates and manages its own venv — see `PYTHON_ANALYSIS.md`).
- **Git**: work happens on branch `v1.2.1`; `master` is the default/PR target. Expect CRLF warnings from git on this machine — they are noise, but be aware `git status` may list files whose only difference is line endings.

## npm scripts

| Script | What it does | When to use |
|---|---|---|
| `npm run compile` | webpack build → `dist/extension.js` (+ CopyPlugin copies `src/code_analysis/python`, `templates/`, `examples/` into `dist/`) | Before F5 "workspace direct"; quick build check |
| `npm run compile:dev-host` | `compile` + `scripts/prepare-dev-extension.mjs` → stages an isolated dev copy under `.vscode-test/dev-extension` | Used automatically by the primary F5 launch config |
| `npm run watch` | webpack watch mode | Iterating on TS changes |
| `npm run typecheck` | `tsc --noEmit` (non-incremental) over the whole project | Fast correctness gate; part of `test:basic` |
| `npm run lint` | ESLint (flat config, `eslint.config.mjs`) over `src/` | Part of `test:basic`; rules are mostly "warn" |
| `npm run compile-tests` | Removes `out/`, then `tsc -p . --outDir out`. Starting empty matters: tsc never deletes output for a source that is gone, so a module deleted from `src/` would keep a compiled twin the suites still load | Part of `test:basic` |
| `npm test` = `npm run test:basic` | `typecheck` + `lint` + `compile-tests` (tsc → `out/`) + `test:unit`. Needs **no** webpack build | **The default gate. Run before declaring any change done.** |
| `npm run test:unit` | `test/runners/run-node-tests.cjs` → first refuses to start if `out/` does not match `src/` (a source newer than its output, an uncompiled source, or a compiled file whose source is gone), then collects `test/**/*.test.cjs` and runs `node --test --test-isolation=none --test-concurrency=1` — **every suite in one process**, so a test must never leave global state behind | Unit/runtime tests only (fast) |
| `npm run test:python` | `test/runners/run-python-tests.cjs` → `unittest discover` over `test/python/`. A test folder **needs an `__init__.py`** or discovery skips it silently. With no interpreter it skips locally and **fails under `CI`** | After touching `src/code_analysis/python/` |
| `npm run test:all` | `test:basic` + `test:python` | Pre-release / after cross-language changes |
| `npm run test:analysis` | `test/runners/run-analysis-tests.cjs` over `manual_test/` fixtures (one per supported language); asserts XR and LivePanel produce the same `data.json`. Its venv installs the **lizard version the extension pins** (read from `pythonPackageManifest.ts`) | After changing analysis output or language support |
| `npm run test:htmlanalysis` | HTML/DOM analysis tests | After touching `python/html/html_dom_parser.py` or DOM mode |
| `npm run test:xr-harness` | `test/runners/run-xr-containment-harness.cjs` (browser harness, uses Playwright) | After touching table/containment runtimes |
| `npm run test:project-evolution-harness` | Project Evolution playback harness | After touching project-evolution runtime |
| `npm run test:xr-immersive-harness` | `test/runners/run-xr-immersive-harness.cjs` — AR/VR semantics against real A-Frame: AR hide/keep sets, rig floor-align + AR recenter, pointer handover; plus a static contract over both scene templates | After touching the scene templates, pointer-policy or immersive-rig |
| `npm run package` | Production webpack build (hidden source maps) | Pre-packaging |
| `npm run package:vsix` | `package` + `scripts/package-vsix.mjs` → builds the `.vsix` (refuses to package without `dist/extension.js`) | Release preparation |
| `node scripts/dist-fingerprint.mjs --out <file>` · `node scripts/dist-diff.mjs <before> <after> --expect-identical-bundle` | Hash everything under `dist/` and compare two fingerprints. **H1**: an unreachable file was deleted ⇒ `extension.js` byte-identical (the production build is deterministic). `--allow-removed <path|dir/>` names copied assets that are meant to disappear. **H2**: `--bundle-lines <old> <new>` for a dead declaration removed from a live file | Proving a cleanup commit changed nothing that ships (`cleanup` skill §3) |
| `npm run test:integration` | `@vscode/test-cli` — **currently targets `out/test/**/*.test.js`, which doesn't exist; the integration layer is unpopulated** | Don't rely on it (needs verification/setup) |
| `npm run report:manual-metrics` | analysis test runner in report-only mode | Metric reports without assertions |
| `npm run guardrails:measure` | `test/tooling/measureGuardrails.cjs` — prints the cleanup metrics from the TypeScript AST (~2 s): `console.*` per module, console-only catch blocks, `any`, suppressions, files over 500 lines, functions over 80 lines, CCN over 10/15/20/30, modules unreachable from `src/extension.ts`, `console.log` in `templates/`, the lint `--max-warnings` | Before and after any cleanup item |
| `npm run guardrails:update` | Same script with `--write`: regenerates `test/tooling/guardrail-baseline.json` | In the **same commit** as a change that moves a metric — the baseline diff is that item's recorded before/after |

**Test framework note**: unit tests are **`.test.cjs` files run by Node's native test runner** (`node --test`), *not* Mocha, despite `@types/mocha` being present (that belongs to the unpopulated integration layer). New unit tests go in `test/<area>/*.test.cjs`.

## Running the extension (F5)

Two launch configs in `.vscode/launch.json`:

1. **"Run CodeXR Extension"** (primary): launches an Extension Development Host with an **isolated copy** of the extension staged under `.vscode-test/dev-extension`, with separate user-data and extensions dirs. preLaunchTask: `CodeXR: compile:dev-host`. Use this for realistic, isolated testing.
2. **"Run CodeXR Extension (workspace direct)"**: loads `${workspaceFolder}` directly as the extension. preLaunchTask: `CodeXR: compile`. Faster, less isolated.

Manual validation flow for a change: F5 → open a workspace with source files → right-click a file/folder → "Code-XR: Analysis" submenu → run the relevant mode (LivePanel / XR / DOM) → for XR, the browser opens the generated scene from a local server; check the Active Servers tree section. Debug APIs available in the browser console are documented in `docs/xr-testing/XR_DEBUG_COMMANDS.md`.

## Test layout

```
test/
├── analysis/            ~33 .test.cjs suites — runtimes (common, boats, visual style, charts,
│                        tables, mapping), collaboration, historical, dependency graph, watchers…
│                        + manual_metrics_suite.py
├── commands/            commandRegistry.test.cjs (unique-ID checks on synthetic arrays) +
│                        commandContributions.test.cjs: executes the REAL registerAllCommands under the
│                        fake vscode and ties it to package.json; internalCommandIds.cjs lists every
│                        registered-but-uncontributed command with how it is reached
├── directory_analysis/  directory-mode tests
├── logging/, python_env/, servers/, startup/, collaboration/, packaging/, utils/,
│   visualize_data/, visualization_settings/   focused suites per subsystem
├── helpers/             sourceText.cjs (LF readers, assertAbsent with a mandatory canary),
│                        fakeVscode.cjs (scoped fake `vscode` to EXECUTE out/ modules),
│                        runtimeAssembly.cjs (test-side mirror of the runtime assembler)
├── tooling/             measureGuardrails.cjs + guardrail-baseline.json + the ratchet test
├── python/              unittest suites (dependencies + goldens, analyzers, scanning, html_dom,
│                        xr schema…); backend_sandbox.py scopes a fake lizard to one module
├── fixtures/dependency-languages/   sample sources in ~25 languages
├── manual/              browser-run HTML harnesses (xr-containment, project-evolution-playback…)
└── runners/             the .cjs runner scripts npm scripts point to
```

Also `manual_test/` (repo root): per-language fixtures consumed by `npm run test:analysis` (see `manual_test/README.md`).

## Packaging

- Bundler: **webpack** (`webpack.config.js`), target node, entry `src/extension.ts` → `dist/extension.js` (commonjs2, `clean: true`), `vscode` external.
- **No `.vscodeignore`** — VSIX contents are controlled by the `files` allowlist in package.json: `dist/**`, selected `resources/`, README/LICENSE/notices/CHANGELOG, **`docs/**`** (yes, docs ship to users), `templates/**`, `examples/**`. `.claude/` is **not** in the list and never ships.
- `npm run package:vsix` produces the installable `.vsix`. During release prep, inspect the VSIX contents against the allowlist (see `AI_WORKFLOWS.md`).

## Known tooling quirks (do not "fix" casually)

- **CI** (`.github/workflows/ci.yml`, since 1.2.1) runs on pull requests to `master`: `npm test` and the Python suites on `windows-latest` and `ubuntu-latest`, plus a job that packages the VSIX and uploads it with its dist fingerprint. It runs exactly the local gates — nothing is CI-only. `ubuntu-latest` reports without blocking until its first LF/POSIX fallout is fixed. The browser harnesses stay local (they need Playwright's Chromium and live CDNs). The other workflow, `deploy-pages-redirect.yml`, only publishes the GitHub Pages redirect.
- **`esbuild.config.mjs` is unreferenced** by any npm script — webpack is the active bundler. Likely legacy from the 0.0.8-era ESBuild migration. *Needs verification before removal.*
- **`.vscode-test.mjs` / `test:integration` mismatch**: points to `out/test/**/*.test.js`, but no such tests exist.
- `tsconfig.json` `outDir` is `out/` (used for `compile-tests`/typecheck output); the shipped bundle goes to `dist/` via webpack. Don't confuse the two.
- `tsconfig.tsbuildinfo` at root is a build cache — never edit or commit-review it.
- A leftover `CodeXR.helloWorld` command exists in package.json (scaffolding; see `V1.2.0_STATUS.md` documentation debt).

## How future agents should use this document

- Pick the *narrowest* test script that covers your change (table above), then finish with `npm run test:basic` before reporting done.
- Never claim a change works without either running the relevant test script or driving the F5 flow.
- If you add an npm script or change the build, update this file in the same session.
