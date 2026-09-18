# CodeXR Test Suite

This folder contains the local validation suite for CodeXR.

## Structure

- `test/commands`: command registration contract tests.
- `test/directory_analysis`: directory watcher and reanalysis data tests.
- `test/python`: backend Python tests grouped by capability.
- `test/runners`: small runners that make the suite work consistently on Windows.

## Commands

- `npm run test`: typecheck, lint, compile the TypeScript sources, and run Node-based unit tests.
- `npm run test:python`: run Python backend tests if a Python interpreter is available.
- `npm run test:all`: run both the Node and Python suites.
- `npm run test:integration`: reserved for VS Code extension-host integration tests.

## How the suites load code

Three mechanisms coexist, and it matters which one a test uses:

1. **Executed from `out/`** — the suite `require`s the tsc output. `npm test` rebuilds `out/` from scratch first; `npm run test:unit` on its own refuses to start when `out/` does not match `src/`.
2. **Browser runtimes evaluated from `templates/`** — usually through `test/helpers/runtimeAssembly.cjs`, the test-side mirror of the production runtime assembler.
3. **Source-text assertions** — the suite reads a `src/` or `templates/` file with `readFileSync` and matches regexes against it. About half the suites do this.

## Source-text assertions

They pin intent that no runtime call can express (a removed feature must stay removed, a settings migration must exist, two artefacts must agree). They also have sharp edges: moving a line can turn one red with identical behaviour, a **negative** assertion keeps passing forever once the code it guards moves to another file, and a file that a test reads as text is not dead even with zero importers.

Use `test/helpers/sourceText.cjs` for new or edited assertions:

- `readSource(path)` / `readConcatenated(paths)` / `readSourceTree(dir, options)` return **LF text**, so a pattern never depends on the checkout (the working tree is CRLF on Windows, LF elsewhere). A missing file throws an error that says what to do.
- `assertAbsent(text, pattern, { canary })` — the canary is mandatory and must match. It proves the haystack still holds the code the guard is about.
- `assertOrdered(text, patterns)` — sequence, not just presence.

Before changing a file, run `grep -rn "<basename>" test/ scripts/` and classify every hit:

| Class | What it is | Rule |
|---|---|---|
| **G** — permanent guard | negative removal guards; cross-artefact contracts (manifest and src, TypeScript and Python, TypeScript and its browser mirror); security or privacy intent; packaging; policy walks | Keep it. If the file is split, retarget the haystack to the successor files with `readConcatenated` and a canary, in the same commit. The regex itself does not change |
| **S** — shape pin | an exact signature, an `as any` cast, an import line, identifier adjacency, ordering, whitespace | A behavioural characterization, loaded from `out/`, lands in a **prior** commit and is green against the unchanged source. Only then may the refactor relax the pin |
| **L** — log-literal pin | message text that the test finds only inside a log call | The text survives verbatim in the same file or its successors |

A commit never edits a regex and the source it guards together, unless the edit is pure retargeting. There is no mass rewrite: existing assertions move to the helper when the file they read is touched.
