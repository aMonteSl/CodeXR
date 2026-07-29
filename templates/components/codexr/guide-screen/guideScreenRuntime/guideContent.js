// == guideScreenRuntime.js | guideContent (assembled per manifest.json; see COMPONENTS.md) ==
(function registerCodeXRGuideRuntime(root) {
  'use strict';

  // Single source of truth for the CodeXR user guide. The same model renders
  // (a) natively on the in-room XR guide screen (guideScreen.js) and (b) as the
  // guide.html page every analysis server serves next to the scene — keep it
  // declarative: sections with a title, an accent colour (matching the mode
  // selector), one-line bullets (~62 chars max so the XR screen never has to
  // wrap them) and an optional `metrics` glossary ({term, definition} pairs,
  // definitions ≤ ~58 chars, same one-row constraint). Definitions mirror the
  // real analysis contracts: xr_field_schema.py for normal analysis and the
  // dependency runtime's nodeDetailModel/edgeStyle for the graph. No markup.
  var GUIDE_SECTIONS = [
    {
      id: 'overview',
      tab: 'Start',
      title: 'Welcome to CodeXR',
      color: '#22d3ee',
      lines: [
        'CodeXR turns your source code metrics into an XR scene.',
        'The pedestal table is the stage for every analysis mode.',
        'The floating controller panel drives mappings and filters.',
        'Press Analyses on the controller panel to switch analyses.',
        'The room is collaborative: everyone shares the state.',
        'Move: WASD + mouse on desktop; sticks and rays in VR.',
        'Drag this screen by its edges; corners resize it.',
        'Scroll while dragging to push or pull the screen.'
      ]
    },
    {
      id: 'single',
      tab: 'Normal',
      title: 'Normal analysis',
      color: '#0e7490',
      lines: [
        'Charts of per-file and per-function metrics (~23 languages).',
        'Map lines of code, complexity, functions or parameters.',
        'The Field Mapping panel picks the metric per dimension.',
        'Mapping changes apply once you confirm them.',
        'Charts: bars, cylinders, bubbles, pie and more.',
        'Saving a file re-analyzes it and refreshes the charts live.'
      ],
      metrics: [
        { term: 'Total / code lines', definition: 'All lines vs the lines that are actual code.' },
        { term: 'Comment ratio', definition: 'Comment lines divided by total lines.' },
        { term: 'Function count', definition: 'Functions detected in the file.' },
        { term: 'Complexity (CCN)', definition: 'Independent decision paths through a function.' },
        { term: 'Complexity bands', definition: 'CCN over 10 is high; over 25 is critical.' },
        { term: 'Max complexity', definition: 'Highest CCN found among the file functions.' },
        { term: 'Parameters', definition: 'Arguments in a function signature (avg and max).' },
        { term: 'Nesting depth', definition: 'How deep loops and branches are stacked.' }
      ]
    },
    {
      id: 'dependency-graph',
      tab: 'Deps',
      title: 'Dependency graph',
      color: '#7c3aed',
      lines: [
        'Nodes: files, folders, symbols. Edges: 7 relation kinds.',
        'Metrics: fan-in, fan-out, degree, cycles and Instability.',
        'Layouts: force-3d, hierarchical and metric-space.',
        'The Edges button colours by relation kind or intensity.',
        'Each relation filter button carries its edge colour chip.',
        'Flow particle size and speed are shared with the room.',
        'Click nodes or edges to pin legends (up to 6, no overlap).',
        'Open folders and files from a pinned legend to navigate.',
        'Up and Root buttons walk back up the folder hierarchy.',
        'External packages collapse into one summary portal.',
        'Detail auto-tunes density; Reset view re-centers you.'
      ],
      metrics: [
        { term: 'Fan-in', definition: 'Incoming: how many files depend on this one.' },
        { term: 'Fan-out', definition: 'Outgoing: how many files this one depends on.' },
        { term: 'Degree', definition: 'Fan-in plus fan-out: total connections.' },
        { term: 'Relations', definition: 'Individual relations, counting duplicates.' },
        { term: 'Cycle', definition: 'Size of its circular-dependency group; 0 = none.' },
        { term: 'Instability', definition: 'Fan-out / degree: 0 stable core, 1 unstable.' },
        { term: 'Confidence', definition: 'Edge opacity: exact, probable or ambiguous.' },
        { term: 'Occurrences', definition: 'Edge intensity: how often the relation repeats.' }
      ]
    },
    {
      id: 'historical',
      tab: 'History',
      title: 'Historical comparison',
      color: '#be123c',
      lines: [
        'Compares your working copy against a branch, tag or commit.',
        'Pick the reference from the controller panel list.',
        'A dual table shows both versions with per-metric deltas.',
        'Saving files updates the comparison live.',
        'Git access is read-only: reviewing is always safe.'
      ],
      metrics: [
        { term: 'Reference', definition: 'The branch, tag or commit you compare against.' },
        { term: 'Working copy', definition: 'Your current files, including unsaved edits.' },
        { term: 'Delta', definition: 'New value minus old value for each metric.' },
        { term: 'Compared metrics', definition: 'Lines, functions, complexity: the normal set.' }
      ]
    },
    {
      id: 'evolution',
      tab: 'Evolution',
      title: 'Project evolution',
      color: '#f59e0b',
      lines: [
        'Plays your Git history as a chronological movie.',
        'Build the movie from the controller panel timeline.',
        'Timelines: automatic, range or manual commit picks.',
        'Player controls let you play, pause and seek frames.',
        'Each frame keeps your current chart mapping.'
      ],
      metrics: [
        { term: 'Frame', definition: 'One commit rendered as a full analysis scene.' },
        { term: 'Timeline', definition: 'Auto picks commits; range and manual are yours.' },
        { term: 'Frame data', definition: 'The directory metrics recomputed per commit.' },
        { term: 'Playback', definition: 'Play, pause and seek; speed is adjustable.' }
      ]
    },
    {
      id: 'tips',
      tab: 'Tips',
      title: 'Tips & collaboration',
      color: '#16a34a',
      lines: [
        'Hover for a quick card; click to pin, click again to release.',
        'Pinned legends arrange above the graph and face you.',
        'Flow size and speed buttons re-pace the edge particles.',
        'The virtual screen can broadcast a desktop window.',
        'Invite others from Active Servers; tunnels are opt-in.',
        'No telemetry; downloads always ask for consent first.',
        'Read this guide in a browser: /guide.html on this server.'
      ]
    }
  ];
