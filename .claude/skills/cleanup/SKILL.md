---
name: cleanup
description: Run a code cleanup or optimization task on the v1.2.1 maintenance branch — take the next roadmap item, prove it is safe to remove or reshape, keep the change behaviour-neutral, and record the before/after measurement. Use when asked to clean up, remove dead code, shrink a file, optimize, tighten lint, or reduce package size.
---

# Clean up CodeXR (v1.2.1 maintenance branch)

v1.2.1 has **one job: remove and improve, never add**. Where we are lives in `.claude/docs/V1.2.1_STATUS.md`; what comes next, and in which order, lives in `.claude/docs/v1.2.1/ROADMAP.md` (read its sections A-E, then only the wave you are working on). This skill is the *how*.

## The rule that governs everything

**Behaviour-neutral unless the CHANGELOG says otherwise.** A user on 1.2.0 upgrading to 1.2.1 should notice a smaller package and nothing else. If a cleanup only pays off by changing behaviour, stop and ask — that is 1.3.0 scope. The user-visible changes the maintainer has already authorized are listed in `ROADMAP.md` §B; nothing else is.

## 1. One item, one commit

**The unit is the commit, not the session.** One roadmap item = one bisectable commit; a session may land several, in roadmap order, running the gate after each. Never fold two items into one commit and never add "while I was in there" changes — they destroy the ability to bisect a regression, which is the whole safety net of a cleanup branch. A red gate ends the session at the last green commit.

A characterization test and the reshaping it protects are **two** commits: the test lands first, green against the unchanged source.

If the user names something not in the roadmap, add it first (with its measurement), then work it.

## 2. Prove it before you delete it

Never delete on the strength of a name, a comment, or a doc's claim. Deadness is a **measured property**, and a file is dead only when all four checks pass:

| # | Check | How |
|---|---|---|
| 1 | Zero importers | static `import`, `export … from`, dynamic `import()`, `require()` — `npm run guardrails:measure` lists the modules unreachable from `src/extension.ts` |
| 2 | No reference by name or path string | `grep -rn "<basename>" src templates test scripts webpack.config.js package.json` — browser runtimes and Python scripts are loaded by path strings, which an import graph cannot see |
| 3 | Registers no command | `src/commands/index.ts` and the module's own `commands/` folder |
| 4 | **No test reads it as text** | about half the unit tests `readFileSync` a `src/` or `templates/` file and regex it; such a file is pinned even with zero importers |

| Other claims | Proof required |
|---|---|
| "This asset is unused" | grep the name across `src/`, `templates/`, the `package.json` `files` allowlist and the webpack copy config |
| "This export is unused" | grep the symbol across `src/` **and** `test/` — tests load compiled code from `out/`, so a test-only consumer still counts |
| "This branch is unreachable" | a dataflow argument written into the commit message **plus** a test that pins the precondition making it unreachable. No test can fail on the removal of a branch that truly never runs, so "a test that fails when you remove it" is not the standard |

Before acting on anything, grep `.claude/docs/v1.2.1/AUDIT.md` for the file: each area ends with a "looks dead or duplicated, but is ALIVE or deliberate" list.

Traps this repo has already set:
- **`debugThemeProblem.ts` looks dead and is a registered module** — `src/commands/index.ts` registers it. Command IDs go through `assertUniqueCommandIds`; removing a registration without removing its entry throws at activation. (Its removal is authorized, as its own commit — `ROADMAP.md` §B.)
- **`src/active_servers/views/` vs `src/views/active_servers/` is deliberate**, not accidental duplication (`AI_WORKFLOWS.md` §refactor). Half of it is dead and half is the busiest module in the area; trace imports file by file.
- **Two files are called `serverItems.ts`.** `src/views/servers/items/serverItems.ts` is alive and text-pinned by a test; `src/active_servers/views/items/serverItems.ts` is the dead one. Basename greps lie here.
- **Python is reachable through a wider gate than its own contract.** The incremental re-analysis path feeds Python extensions the metric contract does not list (`.rs`, `.jsx`, `.r`, …), so an analyzer branch that looks unreachable from Python alone can still run.

## 3. Characterize before you reshape

**Before touching a file F**, run `grep -rn "<basename>" test/ scripts/`, paste the hits into the commit message, and classify every pin:

| Class | What it is | Rule |
|---|---|---|
| **G** — permanent guard | negative removal guards, cross-artefact contracts (manifest ↔ src, TS ↔ Python, TS ↔ browser mirrors), security/privacy intent, packaging, policy walks | Keep. If F is split, retarget the haystack to the successor files (`readConcatenated` + a canary that must match) **in the same commit**; the regex itself does not change |
| **S** — shape pin | exact signature, `as any` cast, import line, identifier adjacency, ordering | A behavioural characterization (loaded from `out/`, with the fake vscode where needed) must land in a **prior** commit, green against the unchanged source. Only then may the refactor relax the pin |
| **L** — log-literal pin | message text that a test finds only inside a log call | The text survives verbatim in the same file or its successor set |

Also grep the **import lines** of F: extracting code can orphan an import that a test pins, and `no-unused-vars` then forces a red test.

A commit never edits a regex and the source it guards together, unless the edit is pure retargeting.

Two characterization standards, both proving "no functionality was lost":
- **H1 — deleting an unreachable file, or a types-only change**: `dist/extension.js` sha256 must be **identical** between the parent commit and HEAD, production build (`CODEXR_NO_SOURCEMAPS=1 npm run package`), same machine. The build is deterministic. Trailer: `Characterization: dist-identical <sha12>`.
- **H2 — removing a dead declaration inside a live file**: a reviewed dist shrink — the bundle gets smaller and no inserted line goes unexplained.

For file splits and refactors, the precedent that worked is `httpServer.ts` 2,102 → 487 lines with a **byte-identical characterization diff** (`V1.2.0_STATUS.md:513`). Capture the observable output before, make the change, diff it after. If you cannot characterize it, the file is not ready to be split.

## 4. Never do these in a cleanup session

- **Rewriting git history** (`git filter-repo`, force-push) to shrink the 1.03 GiB pack. *Propose only* — it rewrites every hash and breaks every clone.
- Touching `dist/`, `out/`, `output/`, `artifacts/`, `.vscode-test/`, `node_modules/`.
- **Deleting docs or rewriting their history sections.** Line-level drift fixes are different and expected: when a commit makes a doc sentence false (a deleted module still described as live, a removed script still listed), fix that sentence **in the same commit**. Anything larger is recorded in `V1.2.1_STATUS.md` instead.
- Removing migrations that protect published-1.1.0 users, or the published `Legacy*` command aliases — those break real upgrades and keybindings (`V1.2.0_STATUS.md:507`). `codexr.servers.refreshServers` has zero callers and still stays.
- Dropping a `.vsix`-shipped file without checking the `package.json` `files` allowlist — there is no `.vscodeignore`, the allowlist is the only control.
- A blanket `eslint --fix`, a Python formatter or isort: tests pin import lines, quote styles and statement order in `src/` and in `main.py`.
- Touching the **XR field-schema contract** (`src/code_analysis/python/utils/xr_field_schema.py` ↔ `xrFieldSchemaService.ts`): `XR_SCHEMA_VERSION` (a bump invalidates every user's cached schema), the order, count and label strings of `XR_FILE_FIELDS` / `XR_DIRECTORY_FIELDS`, the `_text_field(…)` / `_numeric_field(…)` call syntax (regex-matched by a test), the `build_complexity_band` thresholds (three mirrored copies — de-duplicating them is a contract change), and `summarize_function_metrics` (its CCN is guard clauses, not branching).
- Converting the eight lazy `require()` calls in `ModularTreeDataProvider.ts` to static imports, or reordering `HttpServer.stop()`'s dispose-before-close — both look like smells and both are load-bearing (the second is a shipped deadlock fix).

## 5. Verify

Route through the `verify` skill for the touched area, then the `npm test` gate — on **every** commit. Additions:

- **Python touched** → `npm run test:python`; **parsers, `executePython`, export or Python touched** → `npm run test:analysis`. Neither is inside `npm test`.
- **After an ESLint or tsconfig change**, land the config *and* its fallout fixes together. Never leave the gate red between commits.
- **After an asset or `files` change**, run `npm run package:vsix` and inspect the zip contents. Confirm nothing required went missing and the size moved the way you predicted.
- **Browser runtime touched** → the matching harness (`test:xr-harness`, `test:xr-immersive-harness`, `test:xr-mode-harness`, `test:project-evolution-harness`); they need `npx playwright install chromium` and live CDNs.
- F5 checks are human-only: collect them into one checklist per session for the maintainer.

## 6. Record the measurement

A cleanup with no number is a claim, not a result.

- `npm run guardrails:measure` prints the source metrics (console calls, any, complexity, unreachable modules, large files…). When an item moves one, regenerate the baseline with `npm run guardrails:update` **in the same commit**: the `test/tooling/guardrail-baseline.json` diff is that item's recorded before/after.
- In `V1.2.1_STATUS.md`, append to the session log: what was cleaned, the numbers, the gates that ran, what you deliberately left alone and why. Update the "Now" column of the tool-measured baseline when a row moves.
- CHANGELOG `[1.2.1] – Unreleased`: only if a user could notice (smaller package, removed command, changed surface). Pure internal hygiene does not need a CHANGELOG line — say so rather than inventing one.

Then close with the `session-close` skill. Branch is `v1.2.1`; **never commit to `master`**, and ask before any `git push`.
