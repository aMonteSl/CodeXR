/**
 * Shared LivePanel Dependency Summary panel.
 *
 * One implementation for every LivePanel template (file and directory). The
 * panel owns the whole section lifecycle:
 *  - load():   fetches the dependency-graph.json artifact produced by the
 *              server's incremental re-analysis chain (404 = still analyzing,
 *              not an error — a `dependency-updated` SSE event follows);
 *  - render(): tiles + ranking/external/cycles/confidence/capability tables
 *              (shared DataTable instances, created once, updated in place).
 *
 * Mount contract (same element ids in every template):
 *   #dependency-status, #dependency-summary-content,
 *   #dependency-node-count, #dependency-edge-count, #dependency-external-count,
 *   #dependency-cycle-count, #dependency-warning-count,
 *   #dependency-fan-in-table, #dependency-fan-out-table,
 *   #dependency-external-table, #dependency-cycles-table,
 *   #dependency-confidence-table, #dependency-capability-table,
 *   #dependency-warnings-list
 *
 * Depends on the shared DataTable component (dataTable.js) being bundled first.
 */

const CODEXR_DEPENDENCY_CONFIDENCE_BADGE = { exact: 'is-good', probable: 'is-warn', ambiguous: 'is-bad' };
const CODEXR_DEPENDENCY_CAPABILITY_BADGE = { exact: 'is-good', 'best-effort': 'is-warn', unsupported: 'is-bad' };

class CodexrDependencySummaryPanel {
  constructor() {
    this.tables = new Map();
  }

  /**
   * Fetch the latest dependency artifact and render it. Same-origin, relative
   * URL — never a hardcoded host; works over local HTTP or HTTPS.
   */
  load() {
    return fetch('./dependency-graph.json?t=' + Date.now())
      .then((response) => {
        if (response.status === 404) {
          this.setStatus('Analyzing dependencies...', false);
          return null;
        }
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.json();
      })
      .then((dataset) => {
        if (!dataset) {
          return;
        }
        this.render(dataset);
        this.setStatus('Updated ' + new Date().toLocaleTimeString(), false);
      })
      .catch((error) => {
        console.error('Failed to load dependency summary:', error);
        this.setStatus('Failed: ' + error.message, true);
      });
  }

  render(dataset) {
    const cycleGroups = this.groupCycles(dataset);
    const nodeRows = this.nodeRows(dataset);

    this.renderTiles(dataset, cycleGroups);
    this.renderRankingTable('dependency-fan-in-table', nodeRows, 'fanIn', 'Fan-In');
    this.renderRankingTable('dependency-fan-out-table', nodeRows, 'fanOut', 'Fan-Out');
    this.renderExternalTable(dataset);
    this.renderCyclesTable(cycleGroups);
    this.renderConfidenceTable(dataset);
    this.renderCapabilityTable(dataset);
    this.renderWarnings(dataset);

    const content = document.getElementById('dependency-summary-content');
    if (content) {
      content.classList.remove('hidden');
    }
  }

  setStatus(message, isError) {
    const status = document.getElementById('dependency-status');
    if (!status) {
      return;
    }
    status.textContent = message || '';
    status.classList.toggle('error', !!isError);
  }

  // ── Dataset derivations ────────────────────────────────────────────

  // Cycle membership isn't grouped server-side (only per-node cycleSize is
  // known), so cycles are grouped client-side via union-find over edges
  // linking cycle nodes.
  groupCycles(dataset) {
    const nodes = Array.isArray(dataset.nodes) ? dataset.nodes : [];
    const edges = Array.isArray(dataset.edges) ? dataset.edges : [];
    const cycleNodeIds = new Set(
      nodes.filter((node) => Number(node && node.metrics && node.metrics.cycleSize) > 0).map((node) => node.id),
    );
    if (cycleNodeIds.size === 0) {
      return [];
    }
    const parents = {};
    cycleNodeIds.forEach((id) => { parents[id] = id; });
    const findRoot = (id) => {
      while (parents[id] !== id) {
        parents[id] = parents[parents[id]];
        id = parents[id];
      }
      return id;
    };
    edges.forEach((edge) => {
      if (cycleNodeIds.has(edge.source) && cycleNodeIds.has(edge.target)) {
        const rootA = findRoot(edge.source);
        const rootB = findRoot(edge.target);
        if (rootA !== rootB) {
          parents[rootA] = rootB;
        }
      }
    });
    const groups = new Map();
    cycleNodeIds.forEach((id) => {
      const root = findRoot(id);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root).push(id);
    });
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    return Array.from(groups.values())
      .filter((memberIds) => memberIds.length > 1)
      .map((memberIds) => memberIds.map((id) => nodesById.get(id)).filter(Boolean))
      .sort((a, b) => b.length - a.length);
  }

  // Flatten the internal (non-external) nodes into plain rows the DataTable
  // can search, sort and render for the Fan-In / Fan-Out rankings.
  nodeRows(dataset) {
    const nodes = Array.isArray(dataset.nodes) ? dataset.nodes : [];
    return nodes
      .filter((node) => !node.external)
      .map((node) => ({
        label: node.relativePath || node.label || node.id,
        language: node.language || '-',
        fanIn: Number(node && node.metrics && node.metrics.fanIn) || 0,
        fanOut: Number(node && node.metrics && node.metrics.fanOut) || 0,
        degree: Number(node && node.metrics && node.metrics.degree) || 0,
      }));
  }

  externalUsage(dataset) {
    const edges = Array.isArray(dataset.edges) ? dataset.edges : [];
    const usage = new Map();
    edges.forEach((edge) => {
      usage.set(edge.source, (usage.get(edge.source) || 0) + 1);
      usage.set(edge.target, (usage.get(edge.target) || 0) + 1);
    });
    return usage;
  }

  // ── Section renderers ──────────────────────────────────────────────

  renderTiles(dataset, cycleGroups) {
    const nodes = Array.isArray(dataset.nodes) ? dataset.nodes : [];
    const edges = Array.isArray(dataset.edges) ? dataset.edges : [];
    const warnings = Array.isArray(dataset.warnings) ? dataset.warnings : [];
    const externalCount = nodes.filter((node) => node.external).length;

    this.setTileText('dependency-node-count', nodes.length);
    this.setTileText('dependency-edge-count', edges.length);
    this.setTileText('dependency-external-count', externalCount);
    this.setTileText('dependency-cycle-count', cycleGroups.length);
    this.setTileText('dependency-warning-count', warnings.length);
  }

  setTileText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = String(value);
    }
  }

  renderRankingTable(mountId, nodeRows, metricKey, metricLabel) {
    this.upsertTable(mountId, {
      searchPlaceholder: 'Search nodes...',
      emptyMessage: 'No data available',
      sort: { key: metricKey, dir: 'desc' },
      columns: [
        { key: 'label', label: 'Node' },
        { key: 'language', label: 'Language', align: 'center' },
        { key: metricKey, label: metricLabel, align: 'right', defaultDir: 'desc' },
      ],
    }, nodeRows.filter((row) => row[metricKey] > 0));
  }

  renderExternalTable(dataset) {
    const nodes = Array.isArray(dataset.nodes) ? dataset.nodes : [];
    const usage = this.externalUsage(dataset);
    const rows = nodes
      .filter((node) => node.external)
      .map((node) => ({
        package: node.label || node.id,
        references: usage.get(node.id) || 0,
      }));

    this.upsertTable('dependency-external-table', {
      searchPlaceholder: 'Search packages...',
      emptyMessage: 'No external dependencies detected',
      sort: { key: 'references', dir: 'desc' },
      columns: [
        { key: 'package', label: 'Package' },
        { key: 'references', label: 'Incoming References', align: 'right', defaultDir: 'desc' },
      ],
    }, rows);
  }

  // Cycles as a table: one row per detected cycle, searchable by member and
  // sortable by size (largest first by default).
  renderCyclesTable(cycleGroups) {
    const rows = cycleGroups.map((members, index) => ({
      index: index + 1,
      size: members.length,
      members: members.map((node) => node.relativePath || node.label || node.id).join(', '),
    }));

    this.upsertTable('dependency-cycles-table', {
      searchPlaceholder: 'Search members...',
      emptyMessage: 'No dependency cycles detected.',
      sort: { key: 'size', dir: 'desc' },
      columns: [
        { key: 'index', label: 'Cycle', align: 'center', searchable: false, render: (row) => `Cycle ${row.index}` },
        {
          key: 'size', label: 'Size', align: 'center', defaultDir: 'desc', searchable: false,
          render: (row) => `<span class="data-table-badge is-warn">${row.size} nodes</span>`,
        },
        { key: 'members', label: 'Members' },
      ],
    }, rows);
  }

  // Confidence breakdown: edge count and share per confidence level.
  renderConfidenceTable(dataset) {
    const edges = Array.isArray(dataset.edges) ? dataset.edges : [];
    const counts = { exact: 0, probable: 0, ambiguous: 0 };
    edges.forEach((edge) => {
      if (counts[edge.confidence] !== undefined) {
        counts[edge.confidence] += 1;
      }
    });
    const total = edges.length;
    const rows = total > 0
      ? Object.keys(counts).map((level) => ({
          confidence: level,
          edges: counts[level],
          share: counts[level] / total,
        }))
      : [];

    this.upsertTable('dependency-confidence-table', {
      searchable: false,
      emptyMessage: 'No dependency edges to classify.',
      sort: { key: 'edges', dir: 'desc' },
      columns: [
        { key: 'confidence', label: 'Confidence', render: (row) => this.badge(row.confidence, CODEXR_DEPENDENCY_CONFIDENCE_BADGE) },
        { key: 'edges', label: 'Edges', align: 'right', defaultDir: 'desc' },
        {
          key: 'share', label: 'Share', align: 'right', defaultDir: 'desc',
          render: (row) => escapeHtml(`${(row.share * 100).toFixed(1)}%`),
        },
      ],
    }, rows);
  }

  renderCapabilityTable(dataset) {
    const capabilities = dataset.capabilities || {};
    const rows = [];
    Object.keys(capabilities).sort().forEach((language) => {
      const relations = capabilities[language] || {};
      Object.keys(relations).sort().forEach((relation) => {
        rows.push({ language: language, relation: relation, capability: relations[relation] });
      });
    });

    this.upsertTable('dependency-capability-table', {
      searchPlaceholder: 'Search capabilities...',
      emptyMessage: 'No capability data available',
      sort: { key: 'language', dir: 'asc' },
      columns: [
        { key: 'language', label: 'Language' },
        { key: 'relation', label: 'Relation' },
        { key: 'capability', label: 'Capability', render: (row) => this.badge(row.capability, CODEXR_DEPENDENCY_CAPABILITY_BADGE) },
      ],
    }, rows);
  }

  renderWarnings(dataset) {
    const list = document.getElementById('dependency-warnings-list');
    if (!list) {
      return;
    }
    const warnings = Array.isArray(dataset.warnings) ? dataset.warnings : [];
    if (warnings.length === 0) {
      list.innerHTML = '<li class="dependency-empty-note">No warnings.</li>';
      return;
    }
    list.innerHTML = warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('');
  }

  // ── Shared helpers ─────────────────────────────────────────────────

  badge(value, mapping) {
    const modifier = mapping[value] || 'is-neutral';
    return `<span class="data-table-badge ${modifier}">${escapeHtml(value)}</span>`;
  }

  // Create each DataTable once and update its rows in place afterwards, so
  // search/sort state survives live updates.
  upsertTable(mountId, config, rows) {
    let table = this.tables.get(mountId);
    if (!table) {
      const mount = document.getElementById(mountId);
      if (!mount) {
        return;
      }
      table = new DataTable(mount, config);
      this.tables.set(mountId, table);
    }
    table.setRows(rows);
  }
}
