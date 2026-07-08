# Code-XR Development Workflow

> **Purpose**: Build, test, run and package the extension. Read this before running any command or claiming a change "works".
> **Stability**: Stable — update when scripts, launch configs, or test layers change.
> Verified against `package.json`, `.vscode/launch.json`, `.vscode/tasks.json` and `test/runners/` on 2026-07-08.

## Environment

- **Platform**: developed on Windows 11; npm scripts deliberately call tool binaries via `node ./node_modules/<tool>/bin/...` instead of bare CLI names (Windows robustness). Keep that style when adding scripts.
- **Requirements**: VS Code ≥ 1.98.0, Node.js 16+, Python 3.7+ (the extension creates and manages its own venv — see `PYTHON_ANALYSIS.md`).
- **Git**: work happens on branch `v1.2.0`; `master` is the default/PR target. Expect CRLF warnings from git on this machine — they are noise, but be aware `git status` may list files whose only difference is line endings.

## npm scripts

| Script | What it does | When to use |
|---|---|---|
| `npm run compile` | webpack build → `dist/extension.js` (+ CopyPlugin copies `src/code_analysis/python`, `templates/`, `examples/` into `dist/`) | Before F5 "workspace direct"; quick build check |
| `npm run compile:dev-host` | `compile` + `scripts/prepare-dev-extension.mjs` → stages an isolated dev copy under `.vscode-test/dev-extension` | Used automatically by the primary F5 launch config |
| `npm run watch` | webpack watch mode | Iterating on TS changes |
| `npm run typecheck` | `tsc --noEmit` (non-incremental) over the whole project | Fast correctness gate; part of `test:basic` |
| `npm run lint` | ESLint (flat config, `eslint.config.mjs`) over `src/` | Part of `test:basic`; rules are mostly "warn" |
| `npm test` = `npm run test:basic` | `typecheck` + `lint` + `compile-tests` (tsc → `out/`) + `test:unit` | **The default gate. Run before declaring any change done.** |
| `npm run test:unit` | `test/runners/run-node-tests.cjs` → collects `test/**/*.test.cjs`, runs `node --test --test-isolation=none --test-concurrency=1` | Unit/runtime tests only (fast) |
| `npm run test:python` | `test/runners/run-python-tests.cjs` → Python suites under `test/python/` | After touching `src/code_analysis/python/` |
| `npm run test:all` | `test:basic` + `test:python` | Pre-release / after cross-language changes |
| `npm run test:analysis` | `test/runners/run-analysis-tests.cjs` over `manual_test/` fixtures (one per supported language); asserts XR and LivePanel produce the same `data.json` | After changing analysis output or language support |
| `npm run test:htmlanalysis` | HTML/DOM analysis tests | After touching `python/html/html_dom_parser.py` or DOM mode |
| `npm run test:xr-harness` | `test/runners/run-xr-containment-harness.cjs` (browser harness, uses Playwright) | After touching table/containment runtimes |
| `npm run test:project-evolution-harness` | Project Evolution playback harness | After touching project-evolution runtime |
| `npm run package` | Production webpack build (hidden source maps) | Pre-packaging |
| `npm run package:vsix` | `package` + `scripts/package-vsix.mjs` → builds the `.vsix` | Release preparation |
| `npm run test:integration` | `@vscode/test-cli` — **currently targets `out/test/**/*.test.js`, which doesn't exist; the integration layer is unpopulated** | Don't rely on it (needs verification/setup) |
| `npm run report:manual-metrics` | analysis test runner in report-only mode | Metric reports without assertions |

**Test framework note**: unit tests are **`.test.cjs` files run by Node's native test runner** (`node --test`), *not* Mocha, despite `@types/mocha` being present (that belongs to the unpopulated integration layer). New unit tests go in `test/<area>/*.test.cjs`.

## Running the extension (F5)

Two launch configs in `.vscode/launch.json`:

1. **"Run CodeXR Extension"** (primary): launches an Extension Development Host with an **isolated copy** of the extension staged under `.vscode-test/dev-extension`, with separate user-data and extensions dirs. preLaunchTask: `CodeXR: compile:dev-host`. Use this for realistic, isolated testing.
2. **"Run CodeXR Extension (workspace direct)"**: loads `${workspaceFolder}` directly as the extension. preLaunchTask: `CodeXR: compile`. Faster, less isolated.

Manual validation flow for a change: F5 → open a workspace with source files → right-click a file/folder → "Code-XR: Analysis" submenu → run the relevant mode (LivePanel / XR / DOM) → for XR, the browser opens the generated scene from a local server; check the Active Servers tree section. Debug APIs available in the browser console are documented in `docs/XR_DEBUG_COMMANDS.md`.

## Test layout

```
test/
├── analysis/            ~33 .test.cjs suites — runtimes (common, boats, visual style, charts,
│                        tables, mapping), collaboration, historical, dependency graph, watchers…
│                        + manual_metrics_suite.py
├── commands/            commandRegistry.test.cjs (unique-ID and registration checks)
├── directory_analysis/  directory-mode tests
├── logging/, python_env/, servers/, startup/   focused suites per subsystem
├── python/              pytest-style suites (dependencies, scanning, html_dom, xr schema…)
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

- **No CI for build/lint/test.** The only workflow is `.github/workflows/deploy-pages-redirect.yml` (GitHub Pages redirect on push to `master`). All gates are local.
- **`esbuild.config.mjs` is unreferenced** by any npm script — webpack is the active bundler. Likely legacy from the 0.0.8-era ESBuild migration. *Needs verification before removal.*
- **`.vscode-test.mjs` / `test:integration` mismatch**: points to `out/test/**/*.test.js`, but no such tests exist.
- `tsconfig.json` `outDir` is `out/` (used for `compile-tests`/typecheck output); the shipped bundle goes to `dist/` via webpack. Don't confuse the two.
- `tsconfig.tsbuildinfo` at root is a build cache — never edit or commit-review it.
- A leftover `CodeXR.helloWorld` command exists in package.json (scaffolding; see `V1.2.0_STATUS.md` documentation debt).

## How future agents should use this document

- Pick the *narrowest* test script that covers your change (table above), then finish with `npm run test:basic` before reporting done.
- Never claim a change works without either running the relevant test script or driving the F5 flow.
- If you add an npm script or change the build, update this file in the same session.
