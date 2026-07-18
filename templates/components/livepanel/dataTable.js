/**
 * Shared LivePanel DataTable component.
 *
 * A single, dependency-free interactive table used by every list in the LivePanel
 * analyses (file details, complex files, dependency rankings, external packages,
 * cycles, confidence and capability breakdowns). Sharing one implementation keeps
 * every table visually and behaviorally identical:
 *
 *   - a search box that filters rows across the searchable columns,
 *   - sortable columns (click a header to toggle direction, or pick a column from
 *     the "Sort by" menu),
 *   - a fixed-height, internally-scrolling body with a pinned header row.
 *
 * This file is bundled ahead of each template's own script by `LivePanelParser`,
 * so `DataTable` and `escapeHtml` are in scope for the template code that follows.
 */

/**
 * Escape a value for safe insertion into HTML as text. Untrusted strings (file
 * paths, dependency labels, warnings) always pass through here before rendering.
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value === null || value === undefined ? '' : String(value);
  return div.innerHTML;
}

/**
 * @typedef {Object} DataTableColumn
 * @property {string} key                       Unique column identifier.
 * @property {string} [label]                   Header text (defaults to `key`).
 * @property {'left'|'center'|'right'} [align]   Cell alignment (default 'left').
 * @property {boolean} [sortable]               Whether the column can be sorted (default true).
 * @property {boolean} [searchable]             Whether the search box matches this column (default true).
 * @property {'asc'|'desc'} [defaultDir]        Direction applied when the column is first sorted (default 'asc').
 * @property {(row:Object)=>(string|number)} [value]   Raw value used for sorting/searching (default `row[key]`).
 * @property {(row:Object)=>string} [render]           Cell HTML — MUST be pre-escaped (default: escaped raw value).
 */

/** Fill a column definition with defaults so the table can treat all columns uniformly. */
function normalizeDataTableColumn(column) {
  const value = typeof column.value === 'function'
    ? column.value
    : (row) => row[column.key];

  return {
    key: column.key,
    label: column.label === undefined || column.label === null ? column.key : column.label,
    align: column.align || 'left',
    sortable: column.sortable !== false,
    searchable: column.searchable !== false,
    defaultDir: column.defaultDir === 'desc' ? 'desc' : 'asc',
    value,
    render: typeof column.render === 'function'
      ? column.render
      : (row) => escapeHtml(formatDataTableValue(value(row))),
  };
}

/** Stringify a raw cell value for the default (escaped) renderer. */
function formatDataTableValue(value) {
  return value === null || value === undefined ? '' : String(value);
}

class DataTable {
  /**
   * @param {string|HTMLElement} mount   Container element, or its id.
   * @param {Object} options
   * @param {DataTableColumn[]} options.columns
   * @param {Object[]} [options.rows=[]]
   * @param {boolean} [options.searchable=true]           Show the search box.
   * @param {string} [options.searchPlaceholder='Search...']
   * @param {string} [options.emptyMessage='No data available']
   * @param {{key:string, dir:'asc'|'desc'}} [options.sort]  Initial sort (defaults to the first sortable column).
   * @param {(row:Object)=>string} [options.rowClass]        Extra CSS class per row.
   * @param {(row:Object, event:Event)=>void} [options.onRowClick]
   */
  constructor(mount, options) {
    const config = options || {};
    this.mount = typeof mount === 'string' ? document.getElementById(mount) : mount;
    this.columns = (config.columns || []).map(normalizeDataTableColumn);
    this.rows = config.rows || [];
    this.searchPlaceholder = config.searchPlaceholder || 'Search...';
    this.emptyMessage = config.emptyMessage || 'No data available';
    this.rowClass = config.rowClass || null;
    this.onRowClick = config.onRowClick || null;
    this.searchTerm = '';

    // Search is only offered when explicitly enabled and at least one column opts in.
    this.searchable = config.searchable !== false && this.columns.some((column) => column.searchable);

    const sortableColumns = this.columns.filter((column) => column.sortable);
    const initialSort = config.sort
      || (sortableColumns[0] ? { key: sortableColumns[0].key, dir: sortableColumns[0].defaultDir } : null);
    this.sortKey = initialSort ? initialSort.key : null;
    this.sortDir = initialSort ? initialSort.dir : 'asc';

    this.headerCells = {};
    this._visibleRows = [];

    if (this.mount) {
      this._buildSkeleton();
      this.render();
    }
  }

  /** Replace the dataset and re-render the body (keeps the current search/sort). */
  setRows(rows) {
    this.rows = rows || [];
    this._renderBody();
  }

  /** Re-render the body and refresh the header sort indicators. */
  render() {
    if (!this.mount) {
      return;
    }
    this._renderBody();
    this._syncSortIndicators();
  }

  /** The rows currently shown, after search filtering and sorting. Pure — safe to test. */
  getVisibleRows() {
    const term = this.searchTerm.trim().toLowerCase();

    let rows = this.rows;
    if (term && this.searchable) {
      rows = rows.filter((row) => this._rowMatchesTerm(row, term));
    }

    const column = this._columnByKey(this.sortKey);
    if (column) {
      const direction = this.sortDir === 'desc' ? -1 : 1;
      rows = rows.slice().sort((a, b) => direction * compareDataTableValues(column.value(a), column.value(b)));
    }

    return rows;
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  _columnByKey(key) {
    return this.columns.find((column) => column.key === key) || null;
  }

  _rowMatchesTerm(row, term) {
    return this.columns.some((column) => {
      if (!column.searchable) {
        return false;
      }
      return formatDataTableValue(column.value(row)).toLowerCase().includes(term);
    });
  }

  _buildSkeleton() {
    this.mount.classList.add('data-table');
    this.mount.innerHTML = '';

    const hasSortable = this.columns.some((column) => column.sortable);
    if (this.searchable || hasSortable) {
      const toolbar = document.createElement('div');
      toolbar.className = 'data-table-toolbar';

      if (this.searchable) {
        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.className = 'data-table-search';
        this.searchInput.placeholder = this.searchPlaceholder;
        this.searchInput.addEventListener('input', () => {
          this.searchTerm = this.searchInput.value || '';
          this._renderBody();
        });
        toolbar.appendChild(this.searchInput);
      }

      const sortableColumns = this.columns.filter((column) => column.sortable);
      if (sortableColumns.length > 0) {
        this.sortSelect = document.createElement('select');
        this.sortSelect.className = 'data-table-sort';
        this.sortSelect.innerHTML = sortableColumns
          .map((column) => `<option value="${escapeHtml(column.key)}">Sort by ${escapeHtml(column.label)}</option>`)
          .join('');
        this.sortSelect.value = this.sortKey || '';
        this.sortSelect.addEventListener('change', () => this._applySort(this.sortSelect.value));
        toolbar.appendChild(this.sortSelect);
      }

      this.mount.appendChild(toolbar);
    }

    const scroll = document.createElement('div');
    scroll.className = 'data-table-scroll';

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    this.columns.forEach((column) => {
      const th = document.createElement('th');
      th.textContent = column.label;
      th.className = `align-${column.align}${column.sortable ? ' sortable' : ''}`;
      th.setAttribute('data-key', column.key);
      if (column.sortable) {
        th.addEventListener('click', () => this._toggleSort(column.key));
      }
      this.headerCells[column.key] = th;
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    this.tbody = document.createElement('tbody');
    table.appendChild(thead);
    table.appendChild(this.tbody);
    scroll.appendChild(table);
    this.mount.appendChild(scroll);

    if (this.onRowClick) {
      this.tbody.addEventListener('click', (event) => this._handleRowClick(event));
    }
  }

  _applySort(key) {
    const column = this._columnByKey(key);
    if (!column) {
      return;
    }
    this.sortKey = key;
    this.sortDir = column.defaultDir;
    this.render();
  }

  _toggleSort(key) {
    const column = this._columnByKey(key);
    if (!column) {
      return;
    }
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = column.defaultDir;
    }
    this.render();
  }

  _renderBody() {
    if (!this.tbody) {
      return;
    }

    const rows = this.getVisibleRows();
    this._visibleRows = rows;

    if (rows.length === 0) {
      this.tbody.innerHTML =
        `<tr><td class="data-table-empty" colspan="${this.columns.length}">${escapeHtml(this.emptyMessage)}</td></tr>`;
      return;
    }

    this.tbody.innerHTML = rows.map((row, index) => {
      const classes = [];
      if (this.rowClass) {
        const extra = this.rowClass(row);
        if (extra) {
          classes.push(extra);
        }
      }
      if (this.onRowClick) {
        classes.push('clickable');
      }
      const classAttr = classes.length ? ` class="${classes.join(' ')}"` : '';
      const cells = this.columns
        .map((column) => `<td class="align-${column.align}">${column.render(row)}</td>`)
        .join('');
      return `<tr${classAttr} data-row-index="${index}">${cells}</tr>`;
    }).join('');
  }

  _syncSortIndicators() {
    this.columns.forEach((column) => {
      const th = this.headerCells[column.key];
      if (!th) {
        return;
      }
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (column.key === this.sortKey) {
        th.classList.add(this.sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
      }
    });
    if (this.sortSelect && this.sortKey) {
      this.sortSelect.value = this.sortKey;
    }
  }

  _handleRowClick(event) {
    let node = event.target;
    while (node && node !== this.tbody && !(node.getAttribute && node.getAttribute('data-row-index') !== null)) {
      node = node.parentNode;
    }
    if (!node || node === this.tbody) {
      return;
    }
    const index = Number(node.getAttribute('data-row-index'));
    const row = this._visibleRows[index];
    if (row) {
      this.onRowClick(row, event);
    }
  }
}

/** Compare two cell values: numeric when both are numbers, locale-aware otherwise. */
function compareDataTableValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a === null || a === undefined ? '' : a)
    .localeCompare(String(b === null || b === undefined ? '' : b));
}
