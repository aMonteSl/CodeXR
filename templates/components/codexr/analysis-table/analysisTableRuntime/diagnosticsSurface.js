// == analysisTableRuntime.js | diagnosticsSurface (assembled per manifest.json; see COMPONENTS.md) ==
  function getAnalysisTableElement() {
    var doc = root.document;
    return doc && doc.getElementById ? doc.getElementById('codexrAnalysisTable') : null;
  }

  function getAnalysisTableComponent() {
    var table = getAnalysisTableElement();
    return table && table.components ? table.components[TABLE_COMPONENT_NAME] : null;
  }

  function getCurrentTableMode() {
    var component = getAnalysisTableComponent();
    if (component && component.data && component.data.mode) {
      return component.data.mode;
    }
    var table = getAnalysisTableElement();
    var attr = table && table.getAttribute ? table.getAttribute(TABLE_COMPONENT_NAME) : null;
    if (attr && typeof attr === 'object' && attr.mode) {
      return attr.mode;
    }
    if (typeof attr === 'string') {
      var match = attr.match(/(?:^|;\s*)mode:\s*([^;]+)/);
      if (match) {
        return match[1].trim();
      }
    }
    return 'single';
  }

  function applyTableWarning(diagnostic) {
    var component = getAnalysisTableComponent();
    if (!component || typeof component.setContainmentWarning !== 'function') {
      return false;
    }
    return component.setContainmentWarning(diagnostic || { level: 'ok' });
  }

  function isEntityVisible(el) {
    var current = el;
    while (current && current !== root.document) {
      if (current.getAttribute) {
        var visibleAttr = current.getAttribute('visible');
        if (visibleAttr === false || visibleAttr === 'false') {
          return false;
        }
      }
      if (current.object3D && current.object3D.visible === false) {
        return false;
      }
      current = current.parentNode;
    }
    return true;
  }

  function getVisibleContainmentCharts(doc) {
    return getContainmentCharts(doc).filter(isEntityVisible);
  }

  function getVisibleDependencyGraphRoots(doc) {
    if (!doc || !doc.querySelectorAll) {
      return [];
    }
    var roots = doc.querySelectorAll(
      '#codexrDependencyGraph, [codexr-dependency-graph], [data-codexr-analysis-mode="dependency-graph"], [data-codexr-dependency-axes]'
    );
    return Array.prototype.slice.call(roots || []).filter(isEntityVisible);
  }

  function resolveWaitTarget(target, doc) {
    if (typeof target === 'function') {
      try {
        return resolveWaitTarget(target(), doc);
      } catch (error) {
        debugLog('wait-target-resolution-failed', {
          error: error && error.message ? error.message : String(error)
        });
        return null;
      }
    }

    if (typeof target === 'string') {
      var rawTarget = target.trim();
      if (!rawTarget || !doc) {
        return null;
      }

      var idCandidate = rawTarget.charAt(0) === '#' ? rawTarget.slice(1) : rawTarget;
      if (idCandidate && doc.getElementById) {
        var byId = doc.getElementById(idCandidate);
        if (byId) {
          return byId;
        }
      }

      if (doc.querySelector) {
        try {
          return doc.querySelector(rawTarget);
        } catch (error) {
          debugLog('wait-target-selector-failed', {
            target: rawTarget,
            error: error && error.message ? error.message : String(error)
          });
        }
      }
      return null;
    }

    return target || null;
  }

  function resolveDiagnosticTargets(targets, doc) {
    if (Array.isArray(targets) && targets.length) {
      return targets.map(function (target) {
        return resolveWaitTarget(target, doc);
      }).filter(function (chart) {
        return !!chart && isEntityVisible(chart);
      });
    }
    if (targets) {
      var chart = resolveWaitTarget(targets, doc);
      return chart && isEntityVisible(chart) ? [chart] : [];
    }
    return getVisibleContainmentCharts(doc);
  }

  function summarizeChartDiagnostic(status) {
    if (!status) {
      return {
        level: 'warning',
        reason: 'chart-status-unavailable',
        message: 'No chart detected'
      };
    }
    if (status.valid === false) {
      return {
        level: 'error',
        reason: status.reason || 'invalid-chart',
        message: status.message || 'Chart exceeds table limits'
      };
    }
    var details = status.details || {};
    if (details.heightOverflow || status.reason === 'height-overflow') {
      return {
        level: 'error',
        reason: 'height-overflow',
        message: 'Chart exceeds table limits',
        details: details
      };
    }
    if (details.compromised) {
      return {
        level: 'warning',
        reason: 'compromised',
        message: 'Chart is constrained by table limits',
        details: details
      };
    }
    if (details.needsCorrection) {
      return {
        level: 'ok',
        reason: status.reason === 'containment-correcting' || details.phase !== 'steady-fit'
          ? 'containment-correcting'
          : 'normalizing',
        message: '',
        details: details
      };
    }
    return {
      level: 'ok',
      reason: 'ok',
      message: ''
    };
  }

  function stabilizeTableDiagnostic(diagnostic) {
    if (!diagnostic || diagnostic.level === 'ok') {
      TABLE_DIAGNOSTIC_STATE.key = '';
      TABLE_DIAGNOSTIC_STATE.firstSeenAt = 0;
      return diagnostic || { level: 'ok' };
    }
    if (diagnostic.level === 'error') {
      TABLE_DIAGNOSTIC_STATE.key = '';
      TABLE_DIAGNOSTIC_STATE.firstSeenAt = 0;
      return diagnostic;
    }

    var reason = diagnostic.reason || diagnostic.message || 'warning';
    if (reason !== 'underflow' && reason !== 'normalizing') {
      TABLE_DIAGNOSTIC_STATE.key = '';
      TABLE_DIAGNOSTIC_STATE.firstSeenAt = 0;
      return diagnostic;
    }

    var key = (diagnostic.mode || '') + ':' + reason + ':' + (diagnostic.chartCount || 0);
    var now = Date.now();
    if (TABLE_DIAGNOSTIC_STATE.key !== key) {
      TABLE_DIAGNOSTIC_STATE.key = key;
      TABLE_DIAGNOSTIC_STATE.firstSeenAt = now;
      return Object.assign({}, diagnostic, {
        level: 'ok',
        reason: reason + '-pending',
        message: ''
      });
    }
    if ((now - TABLE_DIAGNOSTIC_STATE.firstSeenAt) < TABLE_WARNING_PERSISTENCE_MS) {
      return Object.assign({}, diagnostic, {
        level: 'ok',
        reason: reason + '-pending',
        message: ''
      });
    }
    return diagnostic;
  }

  function buildActiveContainmentDiagnostics(targets) {
    var doc = root.document;
    var mode = getCurrentTableMode();
    if (mode === 'selection') {
      return {
        level: 'ok',
        mode: mode,
        chartCount: 0,
        statuses: [],
        reason: 'selection-mode'
      };
    }
    var charts = resolveDiagnosticTargets(targets, doc);
    if (!charts.length) {
      if (mode === 'dependency-graph' && getVisibleDependencyGraphRoots(doc).length) {
        return {
          level: 'ok',
          mode: mode,
          chartCount: 0,
          visualCount: getVisibleDependencyGraphRoots(doc).length,
          statuses: [],
          reason: 'dependency-graph-visible'
        };
      }
      return stabilizeTableDiagnostic({
        level: 'warning',
        mode: mode,
        chartCount: 0,
        statuses: [],
        reason: 'chart-not-found',
        message: 'No chart detected'
      });
    }
    var statuses = charts.map(function (chart) {
      return root[RUNTIME_GLOBAL_NAME].getChartStatus(chart);
    });
    var summaries = statuses.map(summarizeChartDiagnostic);
    var worst = summaries.find(function (diagnostic) {
      return diagnostic.level === 'error';
    }) || summaries.find(function (diagnostic) {
      return diagnostic.level === 'warning';
    }) || { level: 'ok', reason: 'ok', message: '' };
    return stabilizeTableDiagnostic(Object.assign({}, worst, {
      mode: mode,
      chartCount: charts.length,
      statuses: statuses
    }));
  }
