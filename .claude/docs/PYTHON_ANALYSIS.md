# Code-XR Python Analysis Backend

> **Purpose**: Understand the only non-TypeScript subsystem — the Python engine that produces all code metrics — and its contract with the extension.
> **Stability**: Stable — update when CLI modes, the field schema contract, or the venv mechanism change.
> Verified against `src/code_analysis/python/` and `src/python_env/` structure on 2026-07-08.

## Why this file exists

The Python backend is a frequent source of confusion:
- It lives in `src/code_analysis/python/` but is **not compiled** — webpack's CopyPlugin copies it verbatim into `dist/code_analysis/python` at build time (excluding `*.ts` and `__pycache__`).
- It runs inside a **managed virtual environment** created by the extension itself, not the system Python.
- Its output schema drives TypeScript-side validation, so Python and TS must change together.

## Entry point and CLI

`src/code_analysis/python/main.py` — argparse CLI, JSON output on stdout.

- `--mode {livePanel, xr, schema, dependencies}`
- `--type {file, directory, project}`

The TS bridge is `src/code_analysis/engine/utils/executePython.ts`, which spawns the venv's interpreter against `main.py` and parses the JSON. Progress is streamed via `python/utils/progress_logger.py` conventions. *[inferred: exact progress protocol — verify in executePython.ts if you need it]*

## Layout

```
src/code_analysis/python/
├── main.py                 CLI entry; wires sys.path for subpackages
├── tools/                  analyzer wrappers
│   ├── lizard_analyzer.py       Lizard → cyclomatic complexity, function/line counts
│   ├── class_counter_analyzer.py
│   └── python_comment_analyzer.py
├── utils/                  engines and shared helpers
│   ├── file_analysis_engine.py / directory_analysis_engine.py
│   ├── dependency_analysis_engine.py      (dependency graph; tree-sitter-language-pack)
│   ├── metric_language_contract.py        per-language metric capabilities
│   ├── xr_field_schema.py                 ★ the field schema (see contract below)
│   ├── file_metric_summary.py, line_metric_utils.py, directory_scan_utils.py
│   └── babia_path_utils.py, progress_logger.py
├── livePanels/             LivePanel coordinators (file/directory, deep, reanalysis)
├── XR/                     xr_file_analysis_coordinator.py, xr_directory_analysis_coordinator.py
├── html/                   html_dom_parser.py (DOM visualization backend)
└── examples/, sumaryFiles/ progress/reanalysis coordinators
```

## The field-schema contract (critical seam)

1. `python/utils/xr_field_schema.py` defines which metric fields exist per analysis type.
2. TS fetches it via `main.py --mode schema`, cached/served by `src/code_analysis/services/xrFieldSchemaService.ts` (prefetched at startup by the `StartupCoordinator`).
3. `src/babia_templates/processing/dimensionValidator.ts` validates user dimension mappings against that schema before launching an XR scene.

**Rule**: any metric added/renamed/removed in Python must flow through the schema, and the analysis/manual-metrics tests must be re-run. A mismatch surfaces as dimension-mapping validation failures or empty charts.

## Virtual environment (`src/python_env/`)

- `runtime/venvManager.ts` creates/verifies/reinstalls the venv; package manifest and env UI state live alongside it. User-facing commands: `codeXR.pythonEnv.*` (create/delete/status/reinitialize/verify/debug).
- Python dependencies (e.g. `lizard`, `tree-sitter-language-pack`) are installed into this venv at runtime. **Needs verification**: the exact dependency manifest location (there is no top-level `requirements.txt`; the manifest appears to live inside `src/python_env/` — confirm before changing dependencies).
- Context key `codeXR.pythonEnv.uiLocked` gates analysis context menus while the env is being set up.

## Languages and metrics

- Metrics: cyclomatic complexity (CCN), LOC/comment lines, function/class counts, parameters — primarily via **Lizard**. Dependency relations via **tree-sitter-language-pack** (pinned; confidence levels exact/best-effort/unsupported/ambiguous — see `docs/features/DEPENDENCY_GRAPH_XR.md`).
- Language support: README claims 24, dependency-graph doc and roadmap say 23, and `test/fixtures/dependency-languages/` holds ~25 fixture languages. **The source of truth is `src/utils/languageMetadata.ts` (TS side) + `python/utils/metric_language_contract.py` (Python side)** — check those, not the docs, when a language question matters. (Recorded as documentation debt in `V1.2.0_STATUS.md`.)

## Testing the Python side

| Command | Covers |
|---|---|
| `npm run test:python` | pytest-style suites in `test/python/` (dependencies, directory scanning, html_dom protocol, path normalization, xr file analysis, xr schema) |
| `npm run test:analysis` | End-to-end metric equivalence over `manual_test/` fixtures (one per language); asserts XR and LivePanel produce identical `data.json` |
| `npm run test:htmlanalysis` | HTML/DOM parser |
| `test/analysis/manual_metrics_suite.py` | Manual metrics suite (driven by the analysis runner) |

## How future agents should use this document

- Touching anything under `python/`? Plan the TS-side schema/validation impact first (section "field-schema contract"), then run `test:python` + `test:analysis`.
- Never assume system Python is used — always reason in terms of the managed venv.
- Don't edit anything under `dist/` — the Python files there are build artifacts copied from `src/`.
