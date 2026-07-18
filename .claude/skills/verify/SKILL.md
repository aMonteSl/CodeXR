---
name: verify
description: Verify a CodeXR change before declaring it done — route to the narrowest test script for the touched area, run the npm test gate, and drive the F5/browser flow when a runtime surface changed. Use whenever a code change is about to be reported as working.
---

# Verify a CodeXR change

Never claim a change works without running tests or the F5 flow. Route by what was touched, run the narrow script first (faster failure), then finish with the default gate.

## 1. Pick the narrowest script for the touched area

| Touched | Run first |
|---|---|
| `src/code_analysis/python/**` | `npm run test:python`, then `npm run test:analysis` if output schema/metrics changed |
| `python/html/html_dom_parser.py` or DOM mode | `npm run test:htmlanalysis` |
| `templates/components/**` runtimes | the matching `test/analysis/*.test.cjs` via `node --test test/analysis/<suite>.test.cjs`; table/containment → `npm run test:xr-harness`; project evolution → `npm run test:project-evolution-harness` |
| `templates/analysis_livePanel/**` | `node --test test/analysis/directoryLivePanelUi.test.cjs test/analysis/livePanelDomIntegration.test.cjs` |
| `src/servers/**` | suites under `test/servers/` |
| `src/commands/**` or command registration | `node --test test/commands/commandRegistry.test.cjs` (unique IDs enforced) |
| Language support / metrics output | `npm run test:analysis` (XR and LivePanel must produce identical `data.json`) |

Single suite: `node --test --test-isolation=none --test-concurrency=1 test/<area>/<file>.test.cjs`. Unit tests are Node native test runner `.test.cjs` files — **not Mocha**. Some suites assert against compiled output: run `npm run compile-tests` (tsc → `out/`) first if a suite imports from `out/`.

## 2. Always finish with the default gate

```
npm test        # typecheck + lint + compile-tests + test:unit
npm run compile # webpack build, catches template/asset copy issues
```

Both must be green. Report the actual counts (e.g. "339/339").

## 3. Runtime surfaces need a live check

If the change affects generated scenes, LivePanel pages, or servers, automated tests are not sufficient evidence on their own:

- F5 **"Run CodeXR Extension"** (isolated host under `.vscode-test/dev-extension`) → open a workspace → right-click file/folder → "Code-XR: Analysis" → run the affected mode (LivePanel / XR / DOM).
- XR scenes: browser console debug APIs are documented in `docs/XR_DEBUG_COMMANDS.md` (`CodeXR.help()`).
- If you could not run the live check (e.g. non-interactive session), say so explicitly and label the claim: tests confirmed, browser behavior **inferred**.

## 4. Report with claim labels

confirmed (you ran it) / self-assessed (a doc claims it) / inferred / open. Never upgrade a label to make the report look better.
