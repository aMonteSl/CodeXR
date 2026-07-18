---
name: add-language
description: Add or adjust supported-language coverage in CodeXR — the Python metric contract, TS language metadata, dependency-graph support, fixtures, and the analysis test matrix. Use when adding a language, changing per-language metric capabilities, or investigating language-count discrepancies.
---

# Language support changes

Language support spans two worlds that must change together. The **source of truth** is code, not docs (README says 24, other docs 23 — known documentation debt):

- TS side: `src/utils/languageMetadata.ts`
- Python side: `src/code_analysis/python/utils/metric_language_contract.py`

## Checklist for adding/changing a language

1. **Python contract**: declare the language's metric capabilities in `metric_language_contract.py`. Metrics come primarily from Lizard; dependency relations from `tree-sitter-language-pack` (`utils/dependency_analysis_engine.py`) with confidence levels exact / best-effort / unsupported / ambiguous.
2. **Field schema impact**: if any metric field is added/renamed, it must flow through `python/utils/xr_field_schema.py` → `--mode schema` → `xrFieldSchemaService.ts` → `dimensionValidator.ts`. A mismatch surfaces as dimension-mapping failures or empty charts. See `.claude/docs/PYTHON_ANALYSIS.md` §field-schema contract.
3. **TS metadata**: mirror the language in `src/utils/languageMetadata.ts` (extensions, display name, capabilities).
4. **Fixtures**:
   - `manual_test/<language>/` — per-language fixture consumed by `npm run test:analysis` (see `manual_test/README.md`).
   - `test/fixtures/dependency-languages/` — sample source for dependency-graph tests.
5. **Venv dependencies**: if a new Python package is needed, it goes through the managed venv manifest in `src/python_env/` (`venvManager.ts`) — never assume system Python, never add an implicit download (no downloads without explicit user consent).

## Validation

```
npm run test:python      # Python suites (dependencies, scanning, schema)
npm run test:analysis    # end-to-end: XR and LivePanel must produce identical data.json per language
npm test                 # default gate
```

## Docs to touch in the same session

- `docs/DEPENDENCY_GRAPH_XR.md` language table (if dependency support changed).
- The language-count claims are inconsistent across README/roadmap/docs — if your change alters the real count, update the count **everywhere it appears** or record the remaining mismatch in `.claude/docs/V1.2.0_STATUS.md` §Documentation debt.
