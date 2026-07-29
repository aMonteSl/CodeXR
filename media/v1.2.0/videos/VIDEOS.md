# CodeXR videos — v1.2.0

Every video published for this release, with its YouTube link, its raw master
and its GIF. This is the single place to look up a link: the README, the
website and the store listing all point at these ids, so a re-recording means
changing the id here and in whatever references it.

**The `.mp4` masters are not in git** (`.gitignore`: `media/**/*.mp4`). Every
one is over GitHub's 100 MB per-file limit, so they live on the recording
machine; what travels is the GIF beside them plus the cut on YouTube.

## Tutorial

| Video | Link | Master | Length | GIF |
|---|---|---|---|---|
| Complete tutorial (v1.2.0) | [`youtu.be/dtvFhUQ1uKY`](https://youtu.be/dtvFhUQ1uKY) | `tutorial/Tutorial CodeXR_v1.2.0.mp4` (1.72 GB) | 12:24 | none |

No GIF on purpose: at the house ×8 factor a twelve-minute take is a 93-second
loop, which cannot fit the 5 MB budget at any width worth watching. The
narration script for this one is not in the repo; the Project Evolution script
is, as a reference for the tone.

## Analysis walkthroughs (narrated, one per analysis)

Recorded at 1920×1080. Each folder holds the narrated cut, the silent raw
master, and the GIF made from the raw take. GIF recipe in
[`../../SHOTLIST.md`](../../SHOTLIST.md): **×8**, 10 fps, 64 colours, two-pass
palette, width stepped per video until it fits 5 MB.

| Analysis | Link | Master | Length | GIF |
|---|---|---|---|---|
| Classic analysis | [`youtu.be/76p1ibPaf3I`](https://youtu.be/76p1ibPaf3I) | `normal/normal_analysis_demo.mp4` (168 MB) | 1:16 | 3.90 MB, 720×406, 9.5 s |
| Dependency graph | [`youtu.be/42hIQTUD0-g`](https://youtu.be/42hIQTUD0-g) | `dependency/dependency_analysis_demo.mp4` (213 MB) | 1:48 | 4.25 MB, 656×370, 13.5 s |
| Historical comparison | [`youtu.be/b37qDCQeZg0`](https://youtu.be/b37qDCQeZg0) | `historical/historical_comparison_demo.mp4` (169 MB) | 1:18 | 4.07 MB, 660×372, 9.8 s |
| Project Evolution | [`youtu.be/QDN8tcKx60w`](https://youtu.be/QDN8tcKx60w) | `project_evolution/project_evolution_demo.mp4` (208 MB) | 3:02 | 4.02 MB, 600×308, 22.7 s |

Project Evolution was re-recorded on 2026-07-29 after the mode was improved;
its previous id (`Qs1OHWCqXSs`) was deleted and must not be reused anywhere.

## Tried on three real projects (silent walkthroughs)

The same three public codebases used to validate every release, each toured
through all four analyses with no narration.

| Project | Link | Master | Length | GIF |
|---|---|---|---|---|
| BabiaXR ([aframe-babia-components](https://github.com/babiaxr/aframe-babia-components)) | [`youtu.be/ZJo2eFBEPKA`](https://youtu.be/ZJo2eFBEPKA) | `testedProjects/BabiaXR/BabiaXR.mp4` (472 MB) | 3:18 | 4.70 MB, 520×292, 12.4 s |
| Express ([expressjs/express](https://github.com/expressjs/express)) | [`youtu.be/ExHQhj6ibWU`](https://youtu.be/ExHQhj6ibWU) | `testedProjects/ExpressJS/ExpressJS.mp4` (569 MB) | 3:59 | 4.68 MB, 480×270, 15.0 s |
| JetUML ([prmr/JetUML](https://github.com/prmr/JetUML)) | [`youtu.be/Wy0T7dR2F-k`](https://youtu.be/Wy0T7dR2F-k) | `testedProjects/JetUML/JetUML.mp4` (608 MB) | 4:16 | 4.22 MB, 460×258, 16.0 s |

**These three use ×16, not ×8.** They are project tours of three to four
minutes, so the ×8 of the analysis family would have produced 25 to 32 second
loops, and fitting those under 5 MB meant dropping to about 355 px wide, too
small to read a panel. ×16 halves the frames and buys back the pixels: the
loops land at 12 to 16 seconds, comparable to the analysis GIFs, at a width you
can actually see. The factor is consistent **within** this family, which is
what the rule in SHOTLIST is really protecting.
