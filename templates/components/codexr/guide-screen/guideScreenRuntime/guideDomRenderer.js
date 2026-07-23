// == guideScreenRuntime.js | guideDomRenderer (assembled per manifest.json; see COMPONENTS.md) ==
  // Pure HTML projection of the guide model for guide.html (and anything else
  // that wants the guide as a document). Kept free of A-Frame and DOM globals:
  // guideHtmlString() is a pure string builder, renderGuideHtml() just mounts it.

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function guideMetricsHtml(section) {
    if (!Array.isArray(section.metrics) || !section.metrics.length) { return ''; }
    var entries = section.metrics.map(function (metric) {
      return '<div class="guide-metric">'
        + '<dt style="color:' + escapeHtml(section.color) + '">' + escapeHtml(metric.term) + '</dt>'
        + '<dd>' + escapeHtml(metric.definition) + '</dd>'
        + '</div>';
    }).join('');
    return '<h3>Data represented</h3><dl class="guide-metrics">' + entries + '</dl>';
  }

  function guideHtmlString() {
    var sections = GUIDE_SECTIONS.map(function (section) {
      var bullets = section.lines.map(function (line) {
        return '<li>' + escapeHtml(line) + '</li>';
      }).join('');
      return [
        '<section class="guide-section" id="' + escapeHtml(section.id) + '">',
        '<h2 style="border-color:' + escapeHtml(section.color) + '">' + escapeHtml(section.title) + '</h2>',
        '<ul>' + bullets + '</ul>',
        guideMetricsHtml(section),
        '</section>'
      ].join('');
    }).join('');
    var toc = GUIDE_SECTIONS.map(function (section) {
      return '<a href="#' + escapeHtml(section.id) + '" style="border-color:' + escapeHtml(section.color) + '">'
        + escapeHtml(section.title) + '</a>';
    }).join('');
    return '<nav class="guide-toc">' + toc + '</nav>' + sections;
  }

  function renderGuideHtml(container) {
    if (!container) { return false; }
    container.innerHTML = guideHtmlString();
    return true;
  }
