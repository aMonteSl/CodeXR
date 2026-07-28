# CodeXR XR historical comparator

## Summary

CodeXR 1.2.0 ships a historical comparator that renders two states of the
same analysis side by side on a single XR table. Each side keeps the chart
type chosen for the original analysis and uses the same metric mapping, so
the comparison is visually equivalent.

The comparator can face off:

- the current working copy;
- a local branch;
- a remote branch available locally;
- a tag;
- one of the 50 most recent commits available in the local repository.

No `checkout`, `fetch` or writes inside `.git` are ever executed. CodeXR
analyzes temporary snapshots and leaves the active branch, the index and the
user's files untouched.

## Compatibility with GitHub, GitLab and other Git servers

The comparator depends on **Git**, not on any provider's API.
`GitRepositoryService` runs the local `git` binary through `execFile`,
without a shell, and queries the objects and references already present in
the clone.

| Project origin | Compatible | Condition |
| --- | --- | --- |
| Local Git repository with no remote | Yes | The analyzed target must live inside the repository |
| GitHub | Yes | The repository must be cloned locally |
| GitLab | Yes | The repository must be cloned locally |
| Bitbucket, Gitea, Forgejo or self-hosted server | Yes | Must use a standard local Git repository |
| Folder downloaded as a ZIP | No | It has no Git directory or objects |
| Reference that only exists on the server | Not yet | Fetch it first with the user's own Git tooling |

Remote names are irrelevant. CodeXR enumerates `refs/remotes/*`, so it
recognizes `origin/main`, `github/main`, `gitlab/develop` or
`upstream/release` all the same.

CodeXR never runs `git fetch` automatically. That decision avoids unexpected
network operations, credential prompts and silent mutation of local
references. The list therefore represents exactly the history the user has
available in their clone at that moment.

## Functional flow

```text
Normal XR analysis
        |
        | CodeXR Field Mapping panel > Visualization mode
        v
History comparison selected
        |
        | WebSocket request to the local CodeXR server
        v
Authoritative listing of working copy, branches, tags and commits
        |
        | Independent selection of left and right
        v
References resolved to SHAs and both sources analyzed
        |
        | Immutable result and JSON datasets
        v
Table in historical-compare mode with two zones and two charts
```

The panel prevents selecting the same source on both sides. Commits are
shown in pages of five, with hash, date and abbreviated message. Branches and
tags use compact rows and `LIVE`, `BRANCH`, `TAG` and `COMMIT` badges.

## Evolution of the XR table

The previous implementation used a pedestal component that mixed decorative
geometry, measurement, scaling and chart control. To support several modes
without duplicating that logic it was replaced by two pieces:

| Component | Responsibility |
| --- | --- |
| `codexr-analysis-table` | Table geometry, colours, visual mode and zone split |
| `codexr-chart-containment` | Measuring, scaling, centering and stabilizing one specific chart |

There is no rigid class hierarchy of tables. Modes compose over the same
engine:

- `single`: one central zone with the normal behaviour;
- `historical-compare`: two symmetric zones, a central divider and
  blue/green colours.

`CodeXRAnalysisTableRuntime.getAnalysisTableZones()` returns the bounds the
charts must use. In comparison mode the usable width is split leaving the
same outer margin and an explicit central gap. Each chart gets its own
`codexr-chart-containment`, anchored to the centre of its zone.

The containment controller:

- measures the real geometry BabiaXR generates;
- ignores legends and auxiliary elements;
- applies independent limits for the `X/Z` planes and the `Y` height;
- prevents the chart from overflowing its zone;
- also recovers sizes that are too small;
- uses progressive stabilization and PID control instead of abrupt jumps;
- publishes `rebuilding`, `valid`, `invalid` and `stabilized` states;
- allows waiting jointly for several charts to become valid.

When the comparison activates, the normal chart is hidden, its interaction
suspended and it is temporarily removed from the DOM. Only after both
comparison charts exist is Field Mapping redirected to them. On exit, the
comparison resources are removed and the original chart returns to its
previous position, mapping and interaction.

## Creating the two charts

`historicalComparisonRuntime.js` reuses the original chart's BabiaXR
component. That preserves the selected type:

- `babia-boats`;
- `babia-bars`;
- `babia-barsmap`;
- `babia-bubbles`;
- `babia-pie`;
- `babia-doughnut`;
- `babia-cyls`;
- `babia-cylsmap`.

The mounting sequence avoids showing incomplete states:

1. switch the table to `historical-compare`;
2. create the comparison container;
3. prepare the data sources;
4. create one chart per zone;
5. register both IDs with Field Mapping;
6. remove the normal chart;
7. wait for valid, stabilized geometry;
8. show labels and the difference summary.

If the analyzed target did not exist in a revision, that side shows
`Target not present in this revision`. It is not a Git error: it means the
specific file or directory path did not exist yet, had already been deleted,
or lived elsewhere in that commit.

### Special isolation for `babia-boats`

BabiaXR generates buildings with IDs derived from the path, for example
`boat-src/services/auth.ts`. Two boats charts with the same structure would
produce duplicate global IDs. During an animation, the second chart could
accidentally find and mutate geometry belonging to the first.

CodeXR avoids that collision without modifying BabiaXR:

- it builds an independent tree for each dataset;
- it assigns `uid`s namespaced `codexr-left:` or `codexr-right:`;
- it hands the tree to each `babia-boats` as its own data;
- it keeps every original metric of each entry.

Changing an axis therefore physically rebuilds both boats and each animation
operates only on its own zone.

## Git service and safe materialization

`GitRepositoryService` is the only layer that runs Git commands. It uses
structured arguments with `execFile('git', [...])`, `windowsHide` and buffer
limits. The XR client never sends commands, paths or arbitrary revisions.

### References

The service obtains:

- the active branch via `symbolic-ref`;
- the target's modified state via `status --porcelain`;
- local and remote branches via `for-each-ref`;
- lightweight and annotated tags via `for-each-ref`;
- commits via `log --all --max-count=50`.

Before analyzing a reference it is re-resolved with
`rev-parse --verify <ref>^{commit}`. The result must be a full 40-character
SHA.

### Snapshots

For a historical revision:

- `cat-file` checks existence and size;
- `ls-tree` enumerates a directory's files;
- `show <sha>:<path>` retrieves content;
- files are written into the extension's private storage;
- nothing is ever written inside the repository or `.git`;
- snapshots are deleted when the service shuts down.

Current controls:

- at most 5,000 files;
- at most 100 MiB per snapshot;
- at most 8 MiB per file;
- validation that every destination stays inside the temporary directory;
- exclusion of ignored directories and non-analyzable formats;
- submodules and unsupported entries are skipped with warnings.

## Analysis, cache and differences

`HistoricalComparisonService` coordinates the analysis:

- `working-copy` reuses the active XR analysis' `data.json`;
- a historical reference is materialized and run through the same Python
  analyzer;
- historical results are cached by analyzer version, SHA, target, analysis
  type and depth;
- each result is published as an immutable revision with left and right
  datasets.

Comparison keys are stable:

- directories: normalized relative path;
- files: file name, function signature, parameters and ordinal.

The summary computes added, removed, modified and unchanged elements. Line
changes that alter no metrics are not counted as modifications. In this first
version a rename is represented as a removal plus an addition.

## Reactive working copy

`working-copy` is the only mutable source. After a new `data.json` is
successfully written, CodeXR emits an internal update event.

If a comparison is active:

- if both sides are historical, nothing is recomputed;
- if one side is `working-copy`, only that side is re-analyzed;
- the historical dataset and geometry are preserved;
- the delta and the summary are recomputed;
- a new authoritative revision is published;
- rapid events are coordinated to avoid concurrent jobs.

The update travels over the collaboration WebSocket and also works through
Cloudflare Quick Tunnel. It does not depend on SSE.

## Transactional Field Mapping

The selector's internal name is `CodeXRMappingUiRuntime`; its visible
interface is called **CodeXR Field Mapping**.

The runtime keeps a stable logical ID based on the original chart. On
entering a comparison, `setChartEntityIds()` temporarily switches the active
targets to the two comparison charts without changing the mapping's shared
identity.

When a metric is selected:

1. the last valid mapping is saved;
2. any previous transaction is cancelled;
3. the new mapping is applied to both charts;
4. each chart keeps its own datasource and options;
5. the table waits for both to produce valid geometry;
6. if both are valid, the mapping is confirmed and shared;
7. if one fails, both roll back to the previous mapping.

Only the visible view's controls keep `babiaxraycasterclass`, preventing
Mapping and History from intercepting each other's clicks. The
`codexr-mapping-confirmed` event also refreshes the historical summary's
aggregate variations.

## Collaboration and authority

The selection and the result are shared per room through the
`historical-comparison` entity.

- any participant can request a comparison;
- the server resolves the sources and runs the analysis;
- only one job runs at a time per room;
- the server publishes progress, errors and immutable results;
- every client renders the same mode, references and revision;
- clients cannot fabricate historical datasets or run Git.

## Cleanup and absence of legacy code

The migration removed:

- `codexr-chart-pedestal`;
- `CodeXRChartPedestalRuntime`;
- the old pedestal's asset and tests;
- aliases and references tied to the previous layout.

Closing a comparison removes datasources, charts, listeners, controllers and
comparison geometry. The service deletes its temporary snapshots on disposal
and clears its in-memory cache.

## Testing performed

Automated coverage checks:

- root repositories and nested targets;
- local branches, remotes with arbitrary names, tags and commits;
- modified working trees and detached HEAD;
- absence of `checkout`, `fetch`, shells and `.git` writes;
- materialization, limits, safe paths and missing targets;
- two symmetric zones and restoration of the normal mode;
- transactional metric selection and joint rollback;
- two `babia-boats` with isolated IDs;
- working-copy-only refresh;
- authority and synchronization over WebSocket.

Manual browser validation reproduced a comparison between `working-copy` and
a historical reference with two boats charts. After changing the height
metric from `totalLines` to `functionCount`, the attributes, metadata and
physical heights of the geometry were verified on both sides, before and
after refreshing the live source.

## Limits and future evolution

- Only locally available references and objects are listed.
- Renames are not detected as a single operation.
- There is no revision overlay or per-delta colouring yet.
- The target must belong to a local Git repository.
- Partial clones may require fetching missing objects outside CodeXR.
- Repositories using Git LFS compare the content available in Git objects;
  LFS objects are not downloaded automatically.

Planned evolutions:

- rename detection;
- filters by magnitude, language and change type;
- spatial highlighting of added, removed and modified elements;
- an overlay view;
- pagination or advanced search of references;
- explicit, consented remote refresh.
