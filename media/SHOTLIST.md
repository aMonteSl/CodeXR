# CodeXR — Launch media

Screenshots, GIFs and videos for the README and the website. **Nothing here ships inside the VSIX**: `package.json`'s `files` allowlist only picks `resources/favicon.ico`, `resources/icon.*`, `resources/avatars/**` and `resources/languages_icons/color/**` (the SVGs the tree actually uses — the unused `no_color/` PNGs are excluded), so `media/` can never be packaged by accident. `resources/` means "assets the extension uses at runtime"; `media/` means "assets that explain the extension".

This file is the inventory of what is actually here, not a wish list. When you add or retake something, update the table it belongs to.

```
media/
├── SHOTLIST.md                 this file
├── v1.1.0/                     assets of the previous release (history preserved)
└── v1.2.0/                     "Threads, Timelines & Global Networks"
    ├── hero.png                cover shot
    ├── analysis/               what each analysis looks like
    │   ├── live_panel/         the 2D panels
    │   └── xr/                 the XR scene, one folder per analysis
    ├── controllers/xr/         the in-scene control panels, one folder per analysis
    ├── guide/                  the in-room guide screen and its browser twin
    ├── ui/                     the VS Code side of the product
    └── videos/                 one folder per analysis (see the rule below)
```

The four analyses keep the same folder name everywhere they appear — `normal`, `dependency`, `historical`, `project_evolution` — so a shot, a controller close-up and a video of the same analysis sit at the same path segment in three different trees.

## Rules

**Weight budget.** Not a style preference: the 1.1.0 GIFs are 30-44 MB each, which GitHub's image proxy and the Marketplace will not serve at a usable speed, so they are effectively invisible to visitors.

| Format | Used in | Hard limit | Target |
|---|---|---|---|
| PNG | README + web | 500 KB | ~250 KB, max 1600 px wide |
| GIF | README | **5 MB** | 10 fps, 64 colours, width traded against length (see below) |
| Video | web | — | YouTube; in the README use a PNG thumbnail linking to it |

**Marketplace constraints.** README images need **absolute HTTPS URLs**; **SVG is not rendered**; **video cannot be embedded**. That is why videos live on YouTube and appear here as a linked thumbnail.

**Referencing.** `https://raw.githubusercontent.com/aMonteSl/CodeXR/<ref>/media/v1.2.0/<file>`. Use the release **tag** once it exists: a tag is immutable, so a published listing can never lose its images.

**Careful: `v1.2.0` is currently both a branch and a tag**, and an ambiguous ref resolves to the **branch** (verified against `raw.githubusercontent.com`, which serves the branch's README and not the tag's). That is why shots added after the tag was cut still render. It also means the immutability above is not actually in effect right now: if the branch is ever deleted, the ref falls back to the tag and every image added after the tag was cut would 404. Before deleting the branch, move the tag to its tip (`git tag -f v1.2.0 <tip>` plus `git push --force origin refs/tags/v1.2.0:refs/tags/v1.2.0`) or repoint the README at `refs/heads/<branch>`.

**Videos: three files per analysis.** Every folder under `videos/` holds the same trio, all three named after the same subject, and each one has exactly one destination:

| File | What it is | Where it goes |
|---|---|---|
| `<subject>_explanation.mp4` | the narrated take (AI voice-over) | **YouTube**, embedded on the website |
| `<subject>_demo.mp4` | the same recording without narration | stays here, as the master |
| `<subject>_demo.gif` | the raw take, whole, sped up | **README**, inside the 5 MB budget |

The GIF is made from the raw take, never from the narrated one: without a voice the loop has to work in silence.

**One speed-up factor for every GIF: ×8.** Each GIF covers its whole recording, nothing is cut, so the four share the same GIF-second-per-video-second ratio and a longer analysis reads as a longer loop — the 4:11 movie should not be squeezed into the same seconds as the 1:16 one.

Time is the fixed constraint, **pixels are the slack**: ×8, 10 fps, 64 colours and two-pass palette are identical for all four, and the width is stepped down per video until the file fits the 5 MB budget. That is why the long ones are narrower. Recipe (`W` = the width in the table below):

```bash
ffmpeg -y -i <subject>_demo.mp4 -vf "setpts=PTS/8,fps=10,scale=W:-2:flags=lanczos,palettegen=max_colors=64:stats_mode=diff" palette.png
```
```bash
ffmpeg -y -i <subject>_demo.mp4 -i palette.png -lavfi "setpts=PTS/8,fps=10,scale=W:-2:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" -loop 0 <subject>_demo.gif
```

## v1.2.0 — what is here

### Cover

| File | Size | What it shows |
|---|---|---|
| `hero.png` | 1.5 MB | The room: pedestal table with the dependency graph, two avatars with name tags (Leia and Luke), the guide screen, a shared virtual screen with the editor, and the dependency controller. Covers the whole product in one frame. |

### Analyses — XR (`analysis/xr/`)

| File | Size | What it shows |
|---|---|---|
| `normal/normal.png` | 2.9 MB | Classic analysis: the boats city on the cyan table, Field Mapping on the right, the guide open on its Normal tab. |
| `dependency/dependency_force-3d.png` | 3.0 MB | The graph in the `force-3d` layout. |
| `dependency/dependency_hierarchical.png` | 3.0 MB | The same graph in `hierarchical`. |
| `dependency/dependency_metric-space.png` | 3.0 MB | The same graph in `metric-space`, with real axes. |
| `dependency/dependency_example.png` | 328 KB | Close crop of the graph scoped to a folder (`Folder: tests`). |
| `dependency/dependency_example_1.png` | 1.0 MB | Second graph example. |
| `dependency/dependency_node_card.png` | 1.1 MB | The pinned node card — Fan-in, Fan-out, Degree, Relations, Cycle, Lines and Instability for a directory, with `Open folder` and the selection halo. The best single shot of what the metrics are. |
| `historical/historical_comparison.png` | 2.8 MB | The dual table in crimson, `master (live) (modified) — Working copy` against `origin/boros — 2021-02-12`, guide on its History tab. |
| `historical/historical_comparison_example.png` | 1.1 MB | Second comparison example. |
| `project_evolution/project_evolution.png` | 2.8 MB | The movie on the amber table with the frame overlay (`210ad275 — 2021-10-27`) and the player panel. |
| `project_evolution/project_evolution_example_1.png` | 985 KB | Second movie example. |

### Analyses — LivePanel (`analysis/live_panel/`)

| File | Size | What it shows |
|---|---|---|
| `livepanel-deps.png` | 94 KB | Dependency Summary: counters and the top fan-in / fan-out rankings. |
| `livepanel-history.png` | 117 KB | Historical Comparison in 2D with its delta table. |
| `livepanel-file.png` | 226 KB | The modernized file panel. |

### Controllers (`controllers/xr/`)

One folder per analysis, plus the shared chrome. These are the close-ups of the floating panel.

| File | Size | What it shows |
|---|---|---|
| `analysis_selector/analysis_selector.png` | 257 KB | The `Visualization mode` panel with the four colour-coded analyses. |
| `normal/codexr_field_mapping.png` | 866 KB | Field Mapping: chart picker plus Area / Height / Color. |
| `dependency/dependency_controller.png` | 503 KB | The dependency panel: layout, metric mapping, relation filters, edges, detail, flow. |
| `historical/historical_comparison_main.png` | 464 KB | The comparison panel: source selection and actions. |
| `historical/historical_comparison_field_mapping.png` | 1.2 MB | Field Mapping in comparison context. |
| `project_evolution/project_evolution_controller.png` | 566 KB | The player: timeline mode, generate, transport and speeds. |
| `project_evolution/project_evolution_field_mapping.png` | 1.2 MB | Field Mapping in movie context. |
| `new_virtual_screens_controllers/virtual_controller.png` | 598 KB | The virtual-screen chrome and the Virtual screens panel. |

### Guide (`guide/`)

The in-room guide screen, tab by tab, in its two projections: `*_guide.png` is the Guide text, `*_data.png` the Data glossary.

`landing.png` (Start) · `normal_guide.png` / `normal_data.png` · `deps_guide.png` / `deps_guide_2.png` / `deps_data.png` · `history_guide.png` / `history_data.png` · `evolution_guide.png` / `evolution_data.png` · `tips.png` · `guide-html.png` (the same guide served as `guide.html`, for reading outside XR).

All around 0.9-1.0 MB each.

### VS Code UI (`ui/`)

| File | Size | What it shows |
|---|---|---|
| `new_active_servers.png` | 39 KB | ACTIVE SERVERS with COLLABORATION inside it. |
| `new_server_configuration.png` | 12 KB | The server configuration dialog. |

### Videos (`videos/`)

All recorded at 1920×1080. The raw takes are near-lossless masters — they are big on purpose; only the GIF and the YouTube upload are meant to travel.

| Folder | Narrated (→ YouTube) | Raw master | Length | GIF (×8, 10 fps) |
|---|---|---|---|---|
| `normal/` | [`youtu.be/76p1ibPaf3I`](https://youtu.be/76p1ibPaf3I) (172 MB) | `normal_analysis_demo.mp4` (168 MB) | 1:16 | `normal_analysis_demo.gif` — 3.90 MB, 720×406, 9.5 s |
| `historical/` | [`youtu.be/b37qDCQeZg0`](https://youtu.be/b37qDCQeZg0) (175 MB) | `historical_comparison_demo.mp4` (169 MB) | 1:19 | `historical_comparison_demo.gif` — 4.07 MB, 660×372, 9.8 s |
| `dependency/` | [`youtu.be/42hIQTUD0-g`](https://youtu.be/42hIQTUD0-g) (219 MB) | `dependency_analysis_demo.mp4` (214 MB) | 1:48 | `dependency_analysis_demo.gif` — 4.25 MB, 656×370, 13.5 s |
| `project_evolution/` | [`youtu.be/Qs1OHWCqXSs`](https://youtu.be/Qs1OHWCqXSs) (439 MB) | `project_evolution_demo.mp4` (417 MB) | 4:11 | `project_evolution_demo.gif` — 4.34 MB, 530×298, 31.4 s |

The `<subject>_explanation.mp4` files are uploaded (links above); like the demos they are over GitHub's 100 MB limit and stay out of git.

**The `.mp4` files are not in git** (`.gitignore`: `media/**/*.mp4`). Each one is 168-439 MB, and GitHub refuses any file over 100 MB, so the masters could not be pushed even if we wanted them to be — they live on the recording machine, and what leaves is the GIF beside them plus the narrated cut on YouTube. If they ever need to be in the repo, that means Git LFS, deliberately.

The voice-over scripts for the four narrated takes were written per video and follow the same five-to-eight block structure: what it is · what you see · what you control · what else it does · closing.

### XR experiences (`v1.2.0/xr_experiences/`)

Captured live inside **real emulated WebXR sessions** (Meta Immersive Web
Emulator driven over its MCP bridge — the same rig described in
`docs/xr-testing/WEBXR_EMULATOR_TUTORIAL.md` §9), against the deep analysis of
`aframe-babia-components`. They deliberately include the emulator's own
overlay where it appears: these document how CodeXR is tested and debugged in
XR, not just how it looks. JPEG ~1600 px, 115-152 KB each.

| Shot | File | Status | What it shows |
|---|---|---|---|
| X1 | `vr-testing-cockpit.jpeg` | captured | VR session with the emulator's controller panels and gizmos around the scene — the XR debugging cockpit |
| X2 | `vr-city-at-the-table.jpeg` | captured | Standing at the table edge in VR, the boats city across the pedestal |
| X3 | `vr-flying-over-the-city.jpeg` | captured | Flying above the codebase city, whole platform below |
| X4 | `ar-recentered-pedestal.jpeg` | captured | AR entry: recentered a step from the pedestal, room/environment gone, charts lit by the AR fill light, hover legend visible |
| X5 | `ar-hover-legend-passthrough.jpeg` | captured | AR close-up: highlighted building with its metrics legend (easyrtc.js) floating in passthrough |
| X6 | `ar-development.jpeg` | captured | Full AR workspace: pedestal, guide, screens and the Field Mapping panel with the emulator's key-map overlays (user-taken; the 551 KB PNG master stays untracked beside it) |

### Cross-network sessions (`v1.2.0/collaboration/`)

The two sides of the joining flow, used by the README's cross-network tutorial. One folder per role, because every shot belongs to exactly one of them.

**`invited_user/`** is what the person joining sees in their browser. Rendered from the **real production page** (`src/servers/runtime/remote/pairingPage.ts`, compiled and served as-is, so the HTML, CSS and client script are exactly what a guest gets) with only the three endpoints it calls stubbed: a faithful capture would otherwise need a live Cloudflare tunnel and a second machine. The alias and the code shown are therefore invented, and nothing else is. Captured at 640 px wide, `deviceScaleFactor: 2`, dark scheme.

| File | Size | What it shows |
|---|---|---|
| `remote-join-identity.png` | 169 KB | Step 1 of the join page: continue as anonymous with the alias CodeXR reserved, or use a custom name, then *Request access* |
| `remote-join-code.png` | 112 KB | Step 2: the six-digit field and *Connect*, with "Request sent. Enter the code the host gives you." |
| `remote-join-rejected.png` | 117 KB | A burnt code: the field is cleared and the page answers "The code is not valid." |
| `remote-join-expired.png` | 70 KB | The page an expired or already-used invitation link lands on |

**`host_user/`** is what the person sharing sees in VS Code. Taken by hand from a **live session** (Playwright drives web pages, not the VS Code window), which is why these are tight crops of the real sidebar and its notifications rather than framed shots.

| File | Size | What it shows |
|---|---|---|
| `control_panel.png` | 42 KB | The whole COLLABORATION block: local address, the `trycloudflare.com` cross-network address, *View remote status*, *Stop remote connection*, connected users and server actions |
| `user_code.png` | 6 KB | The notification carrying the pairing code: "Remote request from Anakin. Temporary code: 957797", with *Copy code* |
| `waiting_invited_user.png` | 13 KB | The sidebar with somebody waiting: "Shared \| 1 request waiting" and the *Generate new pairing code* action |
| `control_host_users.png` | 7 KB | Connected users, each row stating avatar colour, client and scope, so Local and Remote guests are told apart at a glance |

Still missing on the host side: the participant card and its *Remove from Session* confirmation.

## Open items

- **Not covered yet**: cross-network access (the tunnel flow and the pairing code), a collaborative session with two people working, and the participant detail dialog. `hero.png` shows two avatars, which covers part of the collaboration story.
- `v1.2.0/.gitkeep` can go: the folder has content now.

## v1.1.0 (legacy)

`analysis-table/`, `collaborative/`, `comparison/`, `gifts/` and `screen/`. The four GIFs in `gifts/` are 30-44 MB — almost certainly not rendering for anyone. Either re-export them within the budget or drop them from the new README.
