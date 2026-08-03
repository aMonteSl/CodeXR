---
name: cleanup
description: Run a code cleanup or optimization task on the v1.2.1 maintenance branch — pick one backlog item, prove it is safe to remove or reshape, keep the change behaviour-neutral, and record the before/after measurement. Use when asked to clean up, remove dead code, shrink a file, optimize, tighten lint, or reduce package size.
---

# Clean up CodeXR (v1.2.1 maintenance branch)

v1.2.1 has **one job: remove and improve, never add**. The backlog, the baseline measurements and the ranking live in `.claude/docs/V1.2.1_STATUS.md` — read it before anything else. This skill is the *how*.

## The rule that governs everything

**Behaviour-neutral unless the CHANGELOG says otherwise.** A user on 1.2.0 upgrading to 1.2.1 should notice a smaller package and nothing else. If a cleanup only pays off by changing behaviour, stop and ask — that is 1.3.0 scope.

## 1. Pick exactly one item

One item per session, from the ranked backlog in `V1.2.1_STATUS.md`. Do not bundle "while I was in there" changes — they destroy the ability to bisect a regression, which is the whole safety net of a cleanup branch.

If the user names something not in the backlog, add it to the backlog first with its measurement, then work it.

## 2. Prove it before you delete it

Never delete on the strength of a name, a comment, or a doc's claim. Deadness is a **measured property**:

| Claim | Proof required |
|---|---|
| "This file is dead" | `grep -rn "<basename>" src templates test package.json` — zero importers, **and** not registered as a command |
| "This asset is unused" | grep the name across `src/`, `templates/`, `package.json` `files` allowlist, and the webpack copy config |
| "This export is unused" | grep the symbol across `src/` **and** `test/` — tests import from `out/`, so a test-only consumer still counts |
| "This branch of code is unreachable" | a test that fails when you remove it, or don't remove it |

Two traps this repo has already set:
- **`debugThemeProblem.ts` looks dead and is not** — `src/commands/index.ts` registers it. Command IDs go through `assertUniqueCommandIds`; removing a registration without removing its entry throws at activation.
- **`src/active_servers/views/` vs `src/views/active_servers/` is deliberate**, not accidental duplication (`AI_WORKFLOWS.md:42`). Trace imports before "consolidating".

## 3. Characterize before you reshape

For any file split or refactor (backlog item 6), follow the precedent that worked: `httpServer.ts` went 2,102 → 487 lines with a **byte-identical characterization diff** (`V1.2.0_STATUS.md:513`). Capture the observable output before, make the change, diff it after. If you cannot characterize it, the file is not ready to be split.

## 4. Never do these in a cleanup session

- **Rewriting git history** (`git filter-repo`, force-push) to shrink the 1.03 GiB pack. It is listed in the backlog as *propose only* — it rewrites every hash and breaks every clone. Its own decision, its own explicit approval.
- Touching `dist/`, `out/`, `output/`, `artifacts/`, `.vscode-test/`, `node_modules/`.
- Deleting or rewriting existing docs. Record inconsistencies in `V1.2.1_STATUS.md` instead.
- Removing migrations that protect published-1.1.0 users, or the published `Legacy*` command aliases — those break real upgrades and keybindings (`V1.2.0_STATUS.md:507`).
- Dropping a `.vsix`-shipped file without checking the `package.json` `files` allowlist — there is no `.vscodeignore`, the allowlist is the only control.

## 5. Verify

Route through the `verify` skill for the touched area, then the `npm test` gate. Two cleanup-specific additions:

- **After an ESLint config change**, land the config *and* its fallout fixes together. Never leave the gate red between commits — `lint` is inside `npm test`.
- **After an asset or `files` change**, run `npm run package:vsix` and inspect the zip contents. Confirm nothing required went missing and the size moved the way you predicted.

## 6. Record the measurement

A cleanup with no number is a claim, not a result. In `V1.2.1_STATUS.md`:

- Append a session-log section: what was cleaned, gates that ran, what you deliberately left alone and why.
- Update the affected row of the baseline table with the new value.
- CHANGELOG `[1.2.1] – Unreleased`: only if a user could notice (smaller package, removed command, changed surface). Pure internal hygiene does not need a CHANGELOG line — say so rather than inventing one.

Then close with the `session-close` skill. Branch is `v1.2.1`; **never commit to `master`**.
