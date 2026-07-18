/**
 * Shared LivePanel chart components (dependency-free, SVG/HTML).
 *
 * Replaces the former Chart.js CDN dependency: generated panels must be fully
 * self-contained (no network calls), so every chart here is rendered locally.
 *
 * Components (all render into a mount element and re-render via setData):
 *  - CodexrDonutChart      parts-of-whole with legend (identity/severity)
 *  - CodexrBarChart        horizontal single-series bars (magnitude ranking)
 *  - CodexrPairedBarChart  two-series comparison bars (left vs right version)
 *
 * Colors are carried by CSS slot classes (see charts.css), never inline hex,
 * so the theme toggle restyles every chart without a re-render. All data text
 * is inserted via textContent — chart inputs never touch innerHTML.
 */

const CODEXR_CATEGORICAL_SLOTS = 8;

/** Fixed-order categorical slot class for series index i (0-based). */
function codexrSeriesClass(index) {
  return `codexr-series-${(index % CODEXR_CATEGORICAL_SLOTS) + 1}`;
}

/** Singleton floating tooltip shared by every chart on the page. */
const codexrChartTooltip = {
  element: null,
  ensure() {
    if (!this.element) {
      this.element = document.createElement('div');
      this.element.className = 'codexr-chart-tooltip';
      document.body.appendChild(this.element);
    }
    return this.element;
  },
  show(event, title, lines) {
    const tooltip = this.ensure();
    tooltip.textContent = '';
    const titleEl = document.createElement('span');
    titleEl.className = 'codexr-tooltip-title';
    titleEl.textContent = title;
    tooltip.appendChild(titleEl);
    (lines || []).forEach((line) => {
      const lineEl = document.createElement('div');
      lineEl.textContent = line;
      tooltip.appendChild(lineEl);
    });
    tooltip.classList.add('codexr-visible');
    this.move(event);
  },
  move(event) {
    const tooltip = this.ensure();
    const margin = 14;
    let x = event.clientX + margin;
    let y = event.clientY + margin;
    const rect = tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 8) {
      x = event.clientX - rect.width - margin;
    }
    if (y + rect.height > window.innerHeight - 8) {
      y = event.clientY - rect.height - margin;
    }
    tooltip.style.left = `${Math.max(x, 8)}px`;
    tooltip.style.top = `${Math.max(y, 8)}px`;
  },
  hide() {
    if (this.element) {
      this.element.classList.remove('codexr-visible');
    }
  },
};

function codexrFormatShare(value, total) {
  if (!total) {
    return '0.0%';
  }
  return `${((value / total) * 100).toFixed(1)}%`;
}

function codexrDefaultValueFormat(value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(2);
}

/**
 * Donut chart: segments = [{ label, value, colorClass }].
 * Renders an SVG donut (2px surface gaps between segments), a center total,
 * and a legend with value + share per segment. Hovering a segment or its
 * legend row highlights both and shows the shared tooltip.
 */
class CodexrDonutChart {
  constructor(mount, options = {}) {
    this.mount = typeof mount === 'string' ? document.getElementById(mount) : mount;
    this.options = {
      size: options.size || 190,
      strokeWidth: options.strokeWidth || 28,
      centerLabel: options.centerLabel || 'Total',
      ariaLabel: options.ariaLabel || 'Donut chart',
      valueFormat: options.valueFormat || codexrDefaultValueFormat,
    };
  }

  setData(segments) {
    if (!this.mount) {
      return;
    }
    this.mount.textContent = '';
    const visible = (segments || []).filter((segment) => (segment.value || 0) > 0);
    const total = visible.reduce((sum, segment) => sum + segment.value, 0);
    if (!visible.length || total <= 0) {
      this.renderEmpty();
      return;
    }

    const container = document.createElement('div');
    container.className = 'codexr-donut';
    container.appendChild(this.buildSvg(visible, total));
    container.appendChild(this.buildLegend(visible, total));
    this.mount.appendChild(container);
  }

  renderEmpty() {
    const empty = document.createElement('div');
    empty.className = 'codexr-chart-empty';
    empty.textContent = 'No data to display.';
    this.mount.appendChild(empty);
  }

  buildSvg(segments, total) {
    const { size, strokeWidth, ariaLabel, valueFormat } = this.options;
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('class', 'codexr-donut-svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', ariaLabel);

    const center = size / 2;
    const radius = (size - strokeWidth - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    // A fixed 2px gap on the circle between adjacent segments (skip for one segment).
    const gap = segments.length > 1 ? 2 : 0;

    let offset = 0;
    segments.forEach((segment, index) => {
      const share = segment.value / total;
      const arcLength = Math.max(share * circumference - gap, 1);
      const circle = document.createElementNS(svgNs, 'circle');
      circle.setAttribute('cx', String(center));
      circle.setAttribute('cy', String(center));
      circle.setAttribute('r', String(radius));
      circle.setAttribute(
        'class',
        `codexr-donut-segment ${segment.colorClass || codexrSeriesClass(index)}`,
      );
      circle.setAttribute('stroke-width', String(strokeWidth));
      circle.setAttribute('stroke-dasharray', `${arcLength} ${circumference - arcLength}`);
      circle.setAttribute('stroke-dashoffset', String(-offset));
      circle.setAttribute('transform', `rotate(-90 ${center} ${center})`);
      circle.dataset.codexrIndex = String(index);
      this.attachHover(circle, segment, total, valueFormat);
      svg.appendChild(circle);
      offset += share * circumference;
    });

    const centerValue = document.createElementNS(svgNs, 'text');
    centerValue.setAttribute('x', String(center));
    centerValue.setAttribute('y', String(center + 2));
    centerValue.setAttribute('text-anchor', 'middle');
    centerValue.setAttribute('class', 'codexr-donut-center-value');
    centerValue.textContent = valueFormat(total);
    svg.appendChild(centerValue);

    const centerLabel = document.createElementNS(svgNs, 'text');
    centerLabel.setAttribute('x', String(center));
    centerLabel.setAttribute('y', String(center + 22));
    centerLabel.setAttribute('text-anchor', 'middle');
    centerLabel.setAttribute('class', 'codexr-donut-center-label');
    centerLabel.textContent = this.options.centerLabel;
    svg.appendChild(centerLabel);

    return svg;
  }

  buildLegend(segments, total) {
    const { valueFormat } = this.options;
    const legend = document.createElement('ul');
    legend.className = 'codexr-chart-legend';
    segments.forEach((segment, index) => {
      const item = document.createElement('li');
      item.dataset.codexrIndex = String(index);

      const swatch = document.createElement('span');
      swatch.className = `codexr-legend-swatch ${segment.colorClass || codexrSeriesClass(index)}`;
      const label = document.createElement('span');
      label.className = 'codexr-legend-label';
      label.textContent = segment.label;
      const value = document.createElement('span');
      value.className = 'codexr-legend-value';
      value.textContent = valueFormat(segment.value);
      const share = document.createElement('span');
      share.className = 'codexr-legend-share';
      share.textContent = codexrFormatShare(segment.value, total);

      item.append(swatch, label, value, share);
      this.attachHover(item, segment, total, valueFormat);
      legend.appendChild(item);
    });
    return legend;
  }

  attachHover(element, segment, total, valueFormat) {
    const index = element.dataset.codexrIndex;
    element.addEventListener('mouseenter', (event) => {
      this.setHighlight(index, true);
      codexrChartTooltip.show(event, segment.label, [
        `${valueFormat(segment.value)} (${codexrFormatShare(segment.value, total)})`,
      ]);
    });
    element.addEventListener('mousemove', (event) => codexrChartTooltip.move(event));
    element.addEventListener('mouseleave', () => {
      this.setHighlight(index, false);
      codexrChartTooltip.hide();
    });
  }

  setHighlight(index, active) {
    this.mount
      .querySelectorAll(`[data-codexr-index="${index}"]`)
      .forEach((element) => element.classList.toggle('codexr-hover', active));
  }
}

/**
 * Horizontal single-series bar chart: rows = [{ label, value, detail, colorClass, onClick }].
 * Bars share one scale (max value = full track). Values are direct-labeled;
 * `detail` lines surface in the tooltip. Rows with onClick render as clickable.
 */
class CodexrBarChart {
  constructor(mount, options = {}) {
    this.mount = typeof mount === 'string' ? document.getElementById(mount) : mount;
    this.options = {
      maxRows: options.maxRows || 10,
      colorClass: options.colorClass || 'codexr-sequential',
      valueFormat: options.valueFormat || codexrDefaultValueFormat,
    };
  }

  setData(rows) {
    if (!this.mount) {
      return;
    }
    this.mount.textContent = '';
    const visible = (rows || []).slice(0, this.options.maxRows);
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'codexr-chart-empty';
      empty.textContent = 'No data to display.';
      this.mount.appendChild(empty);
      return;
    }

    const maxValue = Math.max(...visible.map((row) => row.value || 0), 1);
    const container = document.createElement('div');
    container.className = 'codexr-bars';

    visible.forEach((row) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'codexr-bar-row';
      if (typeof row.onClick === 'function') {
        rowEl.classList.add('codexr-clickable');
        rowEl.addEventListener('click', row.onClick);
      }

      const label = document.createElement('span');
      label.className = 'codexr-bar-label';
      label.textContent = row.label;
      label.title = row.label;

      const track = document.createElement('div');
      track.className = 'codexr-bar-track';
      const fill = document.createElement('div');
      fill.className = `codexr-bar-fill ${row.colorClass || this.options.colorClass}`;
      fill.style.width = `${Math.max(((row.value || 0) / maxValue) * 100, 1)}%`;
      track.appendChild(fill);

      const value = document.createElement('span');
      value.className = 'codexr-bar-value';
      value.textContent = this.options.valueFormat(row.value || 0);

      rowEl.append(label, track, value);
      rowEl.addEventListener('mouseenter', (event) => {
        codexrChartTooltip.show(event, row.label, [
          this.options.valueFormat(row.value || 0),
          ...(row.detail ? [row.detail] : []),
        ]);
      });
      rowEl.addEventListener('mousemove', (event) => codexrChartTooltip.move(event));
      rowEl.addEventListener('mouseleave', () => codexrChartTooltip.hide());
      container.appendChild(rowEl);
    });

    this.mount.appendChild(container);
  }
}

/**
 * Two-series comparison bars: rows = [{ label, left, right }].
 * Series identity is fixed (left = slot 1, right = slot 2) and named in the
 * legend; both bars share one scale so lengths are comparable across series.
 */
class CodexrPairedBarChart {
  constructor(mount, options = {}) {
    this.mount = typeof mount === 'string' ? document.getElementById(mount) : mount;
    this.options = {
      leftLabel: options.leftLabel || 'Left',
      rightLabel: options.rightLabel || 'Right',
      valueFormat: options.valueFormat || codexrDefaultValueFormat,
    };
  }

  setLabels(leftLabel, rightLabel) {
    this.options.leftLabel = leftLabel;
    this.options.rightLabel = rightLabel;
  }

  setData(rows) {
    if (!this.mount) {
      return;
    }
    this.mount.textContent = '';
    const visible = rows || [];
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'codexr-chart-empty';
      empty.textContent = 'No data to display.';
      this.mount.appendChild(empty);
      return;
    }

    const legend = document.createElement('div');
    legend.className = 'codexr-paired-legend';
    [
      { label: this.options.leftLabel, colorClass: 'codexr-series-1' },
      { label: this.options.rightLabel, colorClass: 'codexr-series-2' },
    ].forEach((entry) => {
      const item = document.createElement('span');
      const swatch = document.createElement('span');
      swatch.className = `codexr-legend-swatch ${entry.colorClass}`;
      const text = document.createElement('span');
      text.textContent = entry.label;
      item.append(swatch, text);
      legend.appendChild(item);
    });
    this.mount.appendChild(legend);

    const maxValue = Math.max(
      ...visible.map((row) => Math.max(row.left || 0, row.right || 0)),
      1,
    );
    const container = document.createElement('div');
    container.className = 'codexr-bars';

    visible.forEach((row) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'codexr-bar-row';

      const label = document.createElement('span');
      label.className = 'codexr-bar-label';
      label.textContent = row.label;
      label.title = row.label;

      const pair = document.createElement('div');
      pair.className = 'codexr-paired-pair';
      [
        { value: row.left || 0, colorClass: 'codexr-series-1' },
        { value: row.right || 0, colorClass: 'codexr-series-2' },
      ].forEach((series) => {
        const track = document.createElement('div');
        track.className = 'codexr-bar-track';
        const fill = document.createElement('div');
        fill.className = `codexr-bar-fill ${series.colorClass}`;
        fill.style.width = `${Math.max((series.value / maxValue) * 100, 1)}%`;
        track.appendChild(fill);
        pair.appendChild(track);
      });

      const values = document.createElement('span');
      values.className = 'codexr-bar-value';
      values.textContent = `${this.options.valueFormat(row.left || 0)} → ${this.options.valueFormat(row.right || 0)}`;

      rowEl.append(label, pair, values);
      rowEl.addEventListener('mouseenter', (event) => {
        codexrChartTooltip.show(event, row.label, [
          `${this.options.leftLabel}: ${this.options.valueFormat(row.left || 0)}`,
          `${this.options.rightLabel}: ${this.options.valueFormat(row.right || 0)}`,
          `Delta: ${this.options.valueFormat((row.right || 0) - (row.left || 0))}`,
        ]);
      });
      rowEl.addEventListener('mousemove', (event) => codexrChartTooltip.move(event));
      rowEl.addEventListener('mouseleave', () => codexrChartTooltip.hide());
      container.appendChild(rowEl);
    });

    this.mount.appendChild(container);
  }
}
