# Project Evolution XR

`Project Evolution` is a chronological XR analysis mode that turns local Git
history into a replayable movie of the project. It complements historical
comparison: historical comparison compares two selected sources side by side,
while project evolution shows one full-table chart changing through many
versions.

## Behavior

- The mode appears in the `Visualization mode` selector as `Project evolution`.
- The mode uses its own orange visual identity in the selector and applies a
  matching table theme while the movie is active.
- If the analyzed target is not inside a local Git repository, the option is
  disabled and explains the reason on hover/raycaster focus.
- By default, CodeXR builds an automatic timeline from older commits to newer
  commits.
- Large histories are sampled to a bounded number of frames so XR playback stays
  usable.
- If the working copy has uncommitted changes, it can be used as the final live
  frame.
- The visualization uses a single chart occupying the normal analysis table,
  not the dual chart layout used by historical comparison.

## Playback

The XR panel exposes a compact player:

- generate automatic movie;
- choose automatic, range or manual timelines without carrying stale selections
  between modes;
- page through available Git sources with previous/next arrows;
- mark range starts in green and range ends in red;
- show manual picks with their selection order;
- play and pause;
- previous and next frame;
- speed presets;
- clear the generated movie for everyone in the shared XR room;
- current frame label, frame count and progress status.

Each frame replaces the active chart datasource and asks the analysis table to
renormalize. Playback waits for the chart/table to settle, then holds briefly
before advancing, so the movie reads as a sequence of stable scenes instead of a
rapid data swap. While playback is active, a small overlay above the table shows
the current revision, date and frame number. When playback reaches the last
frame, the final chart remains visible and the panel reports completion until
the user generates another movie or presses `Clear movie`. The Field Mapping panel remains
available, so users can change the chart and dimensions while reviewing the
evolution.

`Clear movie` removes the generated `/evolution/` JSON files, clears the shared
Project Evolution entity, hides the movie chart, and resets every connected
client to the empty Project Evolution panel. It does not delete the normal
analysis `data.json`.

## Architecture

`ProjectEvolutionService` reuses the local Git snapshot materialization used by
historical comparison. It never changes the active branch and does not call
remote provider APIs.

The service writes frame payloads under `/evolution/` and publishes a shared
entity:

```ts
{
  entityKind: 'project-evolution',
  entityId: 'main',
  mode: 'project-evolution',
  result: {
    revision: number,
    mode: 'project-evolution',
    frames: ProjectEvolutionFrame[],
    generatedAt: string
  }
}
```

The browser runtime, `projectEvolutionRuntime.js`, listens for the shared entity
and keeps all connected clients on the same generated movie.

## Initial Limits

- Version units are local Git commits.
- "Pushes" are represented by commits already present in the local repository.
- GitHub, GitLab or other hosting provider APIs are not queried in this version.
- Frames are precalculated before playback to avoid analysis work during the
  animation.
