---
name: capture-media
description: Capture the launch screenshots for the README and the website (LivePanel pages, XR scenes, guide.html) by driving a real running analysis with Playwright, reviewing every shot before keeping it. Use when asked to produce, retake or optimize any asset listed in media/SHOTLIST.md.
---

# Capture launch media

Produce the assets in `media/SHOTLIST.md` from a **real analysis of a real project**, not from test fixtures — these images sell the extension, so the data behind them has to look like real work.

The value of doing this as a skill instead of a script is the review loop: **you look at every capture and judge it before keeping it**. A script cannot tell that a chart rendered half-loaded, that a panel is showing an empty state, or that the theme flipped.

## What is automatable, and what is not

| Automatable here | Not automatable — the user captures it manually |
|---|---|
| LivePanel pages (file + directory), `guide.html`, XR scenes, two-participant sessions | The VS Code sidebar and its dialogs (`V1`, `V2`, part of `N2`) |

Playwright drives web pages, not the VS Code window. Never claim a sidebar shot was automated.

**GIFs need ffmpeg, which is not installed on this machine.** Playwright records `.webm` natively (`recordVideo`), which is what YouTube wants, but webm → GIF needs ffmpeg. If asked for a GIF, say so and offer the `.webm` instead of silently producing nothing.

## Before capturing: get a live analysis

Everything is captured against **the analysis server the extension already runs**, because the historical comparison needs its REST endpoints (`/api/historical/references`, `/api/historical/compare`) and a statically served folder has none.

Ask the user to:
1. Open the project to capture (a real, sizeable one — BabiaXR/A-Frame style, not a toy).
2. Run the analysis for the panel being captured (directory analysis for `L1`/`L2`, file analysis for `L3`).
3. Leave it open and give you **the URL** (`http://localhost:<port>`).

Confirm the URL answers before doing anything else. If they cannot give a URL, the fallback is the analysis output on disk (`<workspaceStorage>/<hash>/amonteSl.code-xr/analysis/`), served statically — good enough for the classic panel, **not** for historical comparison.

## Capture loop — one shot at a time

Write the capture script under the **scratchpad**, never in the repo: this is a tool, not project code. Use the repo's own Playwright (`require('playwright')` from the project root).

For each shot in `media/SHOTLIST.md`:

1. **Navigate and settle.** `waitUntil: 'networkidle'`, then wait for the section's own content, never a blind timeout — e.g. wait until `#dependency-node-count` has a non-empty value before shooting the dependency summary. A number still at `0` or `—` means the panel has not received its data.
2. **Force the theme deliberately.** The panel keeps the theme on `<body data-theme>`. Pick one for the whole set and state it; a README where half the shots are light and half dark looks broken.
3. **Shoot the element, not the viewport.** `page.locator('#dependency-graph-summary').screenshot({ path })` gives clean framing with no browser chrome, no scrollbars and no unrelated sections. Use full-page shots only for a whole-panel overview.
4. **Look at it.** Read the PNG back with the Read tool and check: is the data real (not zeros/empty states), did every chart paint, is any row cut mid-height, is text legible at README width, is there a stray tooltip or focus ring? If anything is off, fix the wait or the framing and retake. **Do not keep a shot you have not looked at.**
5. **Check the weight.** Budget from `SHOTLIST.md`: PNG ≤ 500 KB, target ~250 KB. If it is over, lower `deviceScaleFactor` (2 → 1.5) or narrow the viewport rather than resampling afterwards — there is no image tool installed.
6. **Name and place it**: `media/v1.2.0/<name>.png`, exactly the name in the shot list.
7. **Update the status** of that row in `media/SHOTLIST.md` (`pending` → `captured`).

## Known anchors

LivePanel sections (directory panel unless noted):

| Shot | Selector | Wait for |
|---|---|---|
| `L1 livepanel-deps.png` | `#dependency-graph-summary` | `#dependency-node-count` non-empty and not `0` |
| `L2 livepanel-history.png` | `#historical-comparison` | a comparison actually run: pick two sources, press `#historical-compare-btn`, wait for `#historical-detail-table` rows |
| `L3 livepanel-file.png` | `#app` (file panel), full page | the functions table populated |
| whole panel | `#app` | — |

Other useful ids: `#complexity-overview`, `#complex-files-table`, `#complexity-distribution-chart`, `#historical-metrics-chart`, `#historical-added-count`.

XR scenes: the camera rig is `#rig` and the camera `#head`. Set the framing explicitly with `page.evaluate` (position + rotation) so a retake is pixel-identical; never capture "wherever the camera happened to be".

## Rules

- **Real data only.** If a section shows an empty state, fix the analysis or pick another project — never ship a screenshot of an empty panel because it technically rendered.
- **One project across the whole set.** Same project, same theme, same viewport, so the README does not look assembled from different eras.
- **Never invent progress.** A shot is `captured` only after you looked at the file. If a shot cannot be produced, leave it `pending` and say why.
- `media/` never ships in the VSIX (it is not in the `files` allowlist). Keep it that way — do not add media under `resources/`.
