# CodeXR — Launch media

Screenshots, GIFs and video stills for the README and the website. **Nothing here ships inside the VSIX**: `package.json`'s `files` allowlist only picks `resources/favicon.ico`, `resources/icon.*`, `resources/avatars/**` and `resources/languages_icons/**`, so `media/` can never be packaged by accident. `resources/` means "assets the extension uses at runtime"; `media/` means "assets that explain the extension".

```
media/
├── SHOTLIST.md     this file
├── v1.1.0/         assets of the previous release (moved from resources/, history preserved)
└── v1.2.0/         "Threads, Timelines & Global Networks"
```

## Rules

**Weight budget.** This is not a style preference — the current 1.1.0 GIFs are 30-44 MB each, which GitHub's image proxy and the Marketplace will not serve at a usable speed, so they are effectively invisible to visitors today.

| Format | Used in | Hard limit | Target |
|---|---|---|---|
| PNG | README + web | 500 KB | ~250 KB, max 1600 px wide |
| GIF | README | **5 MB** | 2-3 MB · ≤15 s · ~1000 px · 12-15 fps |
| Video | web | — | YouTube; in the README use a PNG thumbnail linking to it |

**Marketplace constraints.** README images need **absolute HTTPS URLs**; **SVG is not rendered**; **video cannot be embedded**. That is why videos live on YouTube and appear here as a linked thumbnail.

**Referencing.** `https://raw.githubusercontent.com/aMonteSl/CodeXR/<ref>/media/v1.2.0/<file>`. Use the release **tag** once it exists (`v1.0.0`, `v1.0.1` and `v1.1.0` already do) — a tag is immutable, so a published listing can never lose its images. Until then the `v1.2.0` branch is the ref in use.

**Naming.** `<block>-<subject>.<ext>`, lowercase, hyphens: `deps-metrics.png`, `net-flow.png`.

**Capture setup.** Same theme, same window size and the same demo project across every shot, so the README does not look assembled from different eras. Prefer a project big enough for the dependency graph to look interesting but small enough to stay readable.

## Shot list — v1.2.0

Status: `pending` → `captured` → `optimized` → `published`.

### Cover

| ID | File | Type | Where | What it must show | Status |
|---|---|---|---|---|---|
| H1 | `hero.png` | PNG | README + web | The room with the pedestal table, the dependency graph behind it and two avatars. The header image under the release name. | pending |

### The three new analyses

| ID | File | Type | Where | What it must show | Status |
|---|---|---|---|---|---|
| A1 | `deps-graph.gif` | GIF | both | Enter the mode from the selector, the graph builds, orbit it, select a node (everything unrelated dims), open its detail card. | pending |
| A2 | `deps-metrics.png` | PNG | both | Metrics mapped to geometry — size = `fanIn`, height = `fanOut`, colour — with 2-3 annotations. **The single most important shot of the release**: it is the proof of "what breaks most if you touch it is visible across the room". | pending |
| A3 | `deps-layouts.png` | PNG | both | One image, three panels: `force-3d`, `hierarchical`, `metric-space`. | pending |
| A4 | `history-compare.gif` | GIF | both | Pick the two sources → the dual table appears → the per-metric delta table. | pending |
| A5 | `evolution-movie.gif` | GIF | both | The player advancing several frames with the revision overlay. Long version → video V1. | pending |
| A6 | `chart-switch.gif` | GIF | both | Changing the chart type in the classic analysis from Field Mapping. | pending |

### Collaboration

| ID | File | Type | Where | What it must show | Status |
|---|---|---|---|---|---|
| C1 | `avatars.png` | PNG | both | The avatars with their own colour and the floating name above each head. | pending |
| C2 | `session.png` | PNG | both | Two or more people around the same table with their pointers — the room *working*, not just the models. Replaces 1.1.0's `collaborativeWorkspace.png`. | pending |

### Cross-network

| ID | File | Type | Where | What it must show | Status |
|---|---|---|---|---|---|
| N1 | `net-flow.png` | PNG | README + web | Annotated diagram: host → `cloudflared` (outbound) → Cloudflare → guest, with the six-digit code. One image that tells the whole process — what actually works in a README. | pending |
| N2 | `net-step-1..5.png` | PNG ×5 | **web** | Carousel: enable the setting in SERVERS → Start Remote Access → the notification with the code → the guest picks their name → the guest inside the scene. Five dialog screenshots tire a README; on the website a carousel is the right shape. | pending |
| N3 | `net-join.gif` | GIF | README | The real flow condensed (optional if N1 + N2 suffice). | pending |

### Screens

| ID | File | Type | Where | What it must show | Status |
|---|---|---|---|---|---|
| S1 | `screen-controls.png` | PNG | both | The new chrome with Join / Share / Stop — the 1.2.0 equivalent of `v1.1.0/screen/virtualScreenAndControler-v.1.1.0.png`. | pending |
| S2 | `screen-remote.png` | PNG | both | Someone broadcasting and a **remote** guest watching it: the visual proof that it crosses networks. S1 shows the buttons, this shows that it works. | pending |

### In-room guide

| ID | File | Type | Where | What it must show | Status |
|---|---|---|---|---|---|
| G1 | `guide-screen.png` | PNG | both | The guide screen in the scene with its tabs visible (or a short GIF paging through them). | pending |
| G2 | `guide-html.png` | PNG | web | The same guide served as `guide.html`, for reading outside XR. Nearly free to capture. | pending |

### LivePanel

| ID | File | Type | Where | What it must show | Status |
|---|---|---|---|---|---|
| L1 | `livepanel-deps.png` | PNG | both | Dependency Summary: counters, fan-in/fan-out rankings, cycles. | pending |
| L2 | `livepanel-history.png` | PNG | both | Historical Comparison in 2D with its delta table. | pending |
| L3 | `livepanel-file.png` | PNG | web | The modernized file panel (optional). | pending |

### VS Code UI

| ID | File | Type | Where | What it must show | Status |
|---|---|---|---|---|---|
| V1 | `sidebar.png` | PNG | both | ACTIVE SERVERS with COLLABORATION inside, connected users and the actions. For a VS Code extension the sidebar is the first thing a user recognizes, and it is a whole CHANGELOG block with no other visual. | pending |
| V2 | `participant-details.png` | PNG | web | The participant detail dialog with *Remove from Session* (optional). | pending |

### Videos (YouTube, embedded on the website)

| ID | Subject | Status |
|---|---|---|
| V-1 | Full walkthrough of an analysis: launch → table → Field Mapping → mode selector. | pending |
| V-2 | Collaborative session with two people, avatars and a shared screen. | pending |
| V-3 | Cross-network end to end: enable, share, pair with the code, guest inside. | pending |

## Pending decision

The 1.1.0 GIFs in `v1.1.0/gifts/` (30-44 MB each) are almost certainly not rendering for visitors. Either re-export them within the budget above or drop them from the new README. Worth resolving in the README pass.
