// == xrChartMappingUiRuntime.js | part 30: chart-discovery (assembled with its siblings; see COMPONENTS.md) ==
  function getChartEntity(config) {
    var entities = getChartEntities(config);
    return entities.length ? entities[0] : null;
  }

  function getConfiguredChartEntityIds(config) {
    return Array.isArray(state.chartEntityIdsOverride) && state.chartEntityIdsOverride.length
      ? state.chartEntityIdsOverride
      : (Array.isArray(config && config.chartEntityIds) && config.chartEntityIds.length
        ? config.chartEntityIds
        : [config && config.chartEntityId]);
  }

  function hasEntityAttribute(entity, attributeName) {
    if (!entity || !attributeName) {
      return false;
    }
    if (typeof entity.hasAttribute === 'function') {
      return entity.hasAttribute(attributeName);
    }
    return typeof entity.getAttribute === 'function' && entity.getAttribute(attributeName) !== undefined;
  }

  function isAnalysisRootEntity(entity) {
    return !!(entity && (
      hasEntityAttribute(entity, 'data-codexr-analysis-root')
      || hasEntityAttribute(entity, 'data-codexr-normal-root')
      || hasEntityAttribute(entity, 'data-codexr-analysis-surface')
    ));
  }

  function isChartMappingEntity(entity, componentName) {
    if (!entity) {
      return false;
    }
    if (hasEntityAttribute(entity, 'codexr-chart-containment')) {
      return true;
    }
    if (isAnalysisRootEntity(entity)) {
      return false;
    }
    return !!(componentName && hasEntityAttribute(entity, componentName));
  }

  function queryEntities(scope, selector) {
    if (!scope || typeof scope.querySelectorAll !== 'function') {
      return [];
    }
    try {
      return Array.prototype.slice.call(scope.querySelectorAll(selector) || []);
    } catch (error) {
      return [];
    }
  }

  function getChartSearchScopes(config) {
    var document = getDoc();
    if (!document) {
      return [];
    }

    var scopeIds = [
      config && config.normalRootId,
      config && config.normalSurfaceId,
      'codexrNormalAnalysisRoot',
      'codexrAnalysisSurface'
    ].filter(Boolean);
    var scopes = [];
    scopeIds.forEach(function (id) {
      if (!document.getElementById) {
        return;
      }
      var scope = document.getElementById(id);
      if (scope && scopes.indexOf(scope) === -1) {
        scopes.push(scope);
      }
    });
    scopes.push(document);
    return scopes;
  }

  function findFallbackChartEntity(config, preferredId) {
    var document = getDoc();
    if (!document) {
      return null;
    }
    var componentName = getChartComponentName(config);

    if (preferredId && document.getElementById) {
      var preferred = document.getElementById(preferredId);
      if (isChartMappingEntity(preferred, componentName)) {
        return preferred;
      }
      var contained = queryEntities(preferred, '[codexr-chart-containment]');
      if (contained.length) {
        var containedMatch = componentName
          ? contained.find(function (entity) { return hasEntityAttribute(entity, componentName); })
          : null;
        return containedMatch || contained[0];
      }
    }

    var scopes = getChartSearchScopes(config);
    for (var i = 0; i < scopes.length; i += 1) {
      var charts = queryEntities(scopes[i], '[codexr-chart-containment]');
      if (!charts.length) {
        continue;
      }
      if (componentName) {
        var componentMatch = charts.find(function (entity) {
          return hasEntityAttribute(entity, componentName);
        });
        if (componentMatch) {
          return componentMatch;
        }
      }
      return charts[0];
    }
    return null;
  }

  function buildChartValidationTargets(config) {
    var ids = getConfiguredChartEntityIds(config).filter(Boolean).map(String);
    if (!ids.length) {
      return [function resolveChartTarget() {
        return findFallbackChartEntity(config);
      }];
    }
    return ids.map(function (id) {
      return function resolveChartTarget() {
        return findFallbackChartEntity(config, id);
      };
    });
  }

  function getChartEntities(config) {
    var document = getDoc();
    if (!document || !config) {
      return [];
    }
    var ids = getConfiguredChartEntityIds(config);
    var componentName = getChartComponentName(config);
    var directMatches = ids
      .filter(Boolean)
      .map(function (id) { return document.getElementById(id); })
      .filter(function (entity) { return isChartMappingEntity(entity, componentName); });
    if (directMatches.length) {
      return directMatches;
    }

    var fallback = findFallbackChartEntity(config);
    return fallback ? [fallback] : [];
  }
