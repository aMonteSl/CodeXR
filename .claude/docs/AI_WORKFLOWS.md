# AI Workflows — Task Playbooks

> **Purpose**: How a Claude Code session (or any AI agent) should approach each type of task in this repository. These are process rules, not architecture — for "what the system is", see `ARCHITECTURE.md`.
> **Stability**: Stable — update when the team's process or the test matrix changes.

## Universal session rules

1. **One unit of work per session** — one feature, one bug, one refactor, or one docs/release task. Finish and validate it before starting anything else.
2. **Start from `INDEX.md`** and read only the documents mapped to your task type. Do not scan `src/` broadly; `src/code_analysis/` alone is 246 files.
3. **Distinguish claim levels** in everything you report and write: confirmed (you verified it), self-assessed (a doc claims it), inferred, open question.
4. **Validate before declaring done**: at minimum `npm run test:basic`; plus the narrowest specialized script for the touched area (matrix in `DEVELOPMENT.md`).
5. **End-of-session checklist**:
   - [ ] Relevant tests pass (say which ones ran).
   - [ ] `V1.2.0_STATUS.md` updated if the version state changed.
   - [ ] `CHANGELOG.md` "[1.2.0] – Unreleased" updated for user-visible changes.
   - [ ] Architecture/development docs updated if their subject changed.
   - [ ] Work committed on `v1.2.0` (never commit directly to `master`).

## Playbook: new feature

1. Read: `ARCHITECTURE.md`, `V1.2.0_STATUS.md`, plus the area doc (`XR_COMPONENTS.md` and/or `PYTHON_ANALYSIS.md`) and any relevant `docs/*.md` feature doc.
2. Check the roadmap (`docs/ROADMAP_V1.2.0.md`) — is the feature in scope for this version? Respect scope decisions (e.g., boats/Code City is paused).
3. Follow the per-feature module convention (`commands/` + `model/` + `runtime|services/` + `views/{items,interactions}`); register commands through the module's registration array consumed by `src/commands/index.ts` (IDs must be unique — `assertUniqueCommandIds` enforces this).
4. If the feature adds metrics or chart dimensions, plan the Python schema ↔ TS validator sync first (`PYTHON_ANALYSIS.md` → field-schema contract).
5. Add tests: unit `.test.cjs` in `test/<area>/`; runtime changes under `templates/components/` get a runtime test; consider a manual harness for visual behavior.
6. Validate: narrow test script → `npm run test:basic` → F5 manual flow (`DEVELOPMENT.md`).
7. Update: CHANGELOG Unreleased, `V1.2.0_STATUS.md`, and the area doc if the mechanism changed.

## Playbook: bug fix

1. Read: `ARCHITECTURE.md` module map to locate the subsystem; the area doc if the bug touches a contract seam.
2. **Reproduce first** — via the narrowest test script or the F5 flow. Write a failing test when feasible (`test/<area>/*.test.cjs` or `test/python/`).
3. Fix at the root cause; do not patch around watchers/session lifecycle without reading `engine/core/analysisSession.ts` + `engine/watchers/` behavior.
4. Validate: the new/affected test + `npm run test:basic`.
5. Update CHANGELOG (Fixed) and, if the bug revealed wrong documentation, correct the doc in the same session.

## Playbook: refactor

1. Confirm scope with the user first if the refactor crosses module boundaries or touches a contract seam (field schema, chart registry, command registration, component injection, SSE keying).
2. Read: `ARCHITECTURE.md` (esp. "cross-module contracts") + the area doc.
3. Refactors must be behavior-neutral: run the full relevant matrix before *and* after (`test:basic`, plus `test:python`/`test:analysis` if analysis is touched, harnesses if runtimes are touched).
4. Respect known duplication that is historical, not accidental (e.g. `active_servers/views/` vs `views/active_servers/`) — don't "clean up" aggregation wiring without tracing imports.
5. Update `ARCHITECTURE.md` if module responsibilities or seams moved.

## Playbook: documentation update

1. Read `INDEX.md` + the target doc. Check `V1.2.0_STATUS.md` → "Documentation debt" — your task may already be catalogued there.
2. Rules: never delete existing docs; record inconsistencies instead of silently rewriting history; keep `docs/*` (user-shipped, mixed ES/EN) separate in tone from `.claude/docs/*` (internal, English).
3. Remember `docs/**` ships in the VSIX; `.claude/**` does not.
4. If you fix an inconsistency listed in `V1.2.0_STATUS.md`, remove it from the debt list in the same session.

## Playbook: release preparation

1. Read: `V1.2.0_STATUS.md` (entire file), `docs/ROADMAP_V1.2.0.md` (exit criteria + delivery sequence), `DEVELOPMENT.md` (packaging).
2. Resolve every "Needs verification" row in `V1.2.0_STATUS.md` (each has a how-to-verify hint).
3. Reconcile docs: README "What's New" → v1.2.0 content; CHANGELOG `[1.2.0] – Unreleased` → dated release entry; roadmap statuses; language-count claim fixed against `src/utils/languageMetadata.ts`; rename leftovers.
4. Quality gate: `npm run test:all` + `npm run test:analysis` + harnesses for touched runtimes; F5 smoke of the three analysis modes.
5. Package: `npm run package:vsix`; **inspect the VSIX contents** against the package.json `files` allowlist (no `.vscodeignore` exists — the allowlist is the only control). Verify no unintended files ship and nothing required is missing.
6. Respect the pre-release sequence (`1.2.0-alpha.1` → … → `rc.1` → stable) — do not jump to stable.
7. Roadmap exit criteria are hard requirements: no analysis-flow regressions vs 1.1.0, server-validated admin ops, collaboration works without avatar download, no downloads without consent.

## Context-efficiency rules (cost control)

- Never list/scan: `node_modules/`, `dist/`, `out/`, `output/`, `artifacts/`, `.vscode-test/`, `tsconfig.tsbuildinfo`, `package-lock.json`.
- Prefer targeted `Grep`/`Glob` over directory listings; prefer the module map in `ARCHITECTURE.md` over exploration.
- `package.json` is ~1,000+ lines (70 commands) — grep for the section you need instead of reading it whole.
- Large existing docs (`README.md` ~674 lines, `docs/DEPENDENCY_GRAPH_XR.md` ~477 lines) are summarized in `.claude/docs/` — read the originals only when the summary is insufficient for your task.

## How future agents should use this document

Pick the playbook matching your task, follow it top to bottom, and treat the universal rules + end-of-session checklist as non-negotiable. If a playbook step proves wrong or incomplete, fix the playbook in the same session.
