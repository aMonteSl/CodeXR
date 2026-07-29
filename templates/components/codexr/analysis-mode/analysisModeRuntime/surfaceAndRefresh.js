// == analysisModeRuntime.js | surfaceAndRefresh (assembled per manifest.json; see COMPONENTS.md) ==
  function ensureAnalysisSurfaceRuntime() {
    if (root.CodeXRAnalysisSurfaceRuntime) {
      return root.CodeXRAnalysisSurfaceRuntime;
    }
    var SURFACE_ID = 'codexrAnalysisSurface';
    var NORMAL_ROOT_ID = 'codexrNormalAnalysisRoot';
    var registeredRoots = new Map();
    var normalRootsMemory = [];
    var localGeneration = 0;

    function documentRef() {
      return root.document;
    }

    function sceneRef() {
      return documentRef()?.querySelector?.('a-scene') || null;
    }

    function getSurface(createIfMissing) {
      var document = documentRef();
      if (!document) { return null; }
      var cfg = getConfig();
      var surfaceId = String(cfg?.normalSurfaceId || SURFACE_ID);
      var surface = document.getElementById?.(surfaceId);
      if (!surface && createIfMissing !== false && document.createElement) {
        surface = document.createElement('a-entity');
        surface.setAttribute('id', surfaceId);
        surface.setAttribute('data-codexr-analysis-surface', 'true');
        sceneRef()?.appendChild?.(surface);
        debugLog('Analysis surface created', { surfaceId: surfaceId });
      }
      return surface || null;
    }

    function getNormalRoot() {
      var document = documentRef();
      if (!document) { return null; }
      var cfg = getConfig();
      return document.getElementById?.(String(cfg?.normalRootId || NORMAL_ROOT_ID))
        || document.querySelector?.('[data-codexr-normal-root="true"]')
        || null;
    }

    function rememberNormalRoots(roots) {
      roots.forEach(function (element) {
        if (element && !normalRootsMemory.includes(element)) {
          normalRootsMemory.push(element);
        }
      });
    }

    function getNormalSurfaceRoots() {
      var document = documentRef();
      var surface = getSurface(false);
      var roots = normalRootsMemory.filter(Boolean);
      var normalRoot = getNormalRoot();
      if (normalRoot) {
        roots.push(normalRoot);
      }
      surface?.querySelectorAll?.('[data-codexr-normal-root="true"], [data-codexr-analysis-mode="single"]')
        ?.forEach(function (element) { roots.push(element); });
      document?.querySelectorAll?.('[data-codexr-normal-root="true"]')
        ?.forEach(function (element) { roots.push(element); });
      if (!roots.length) {
        getNormalVisualizationRoots().forEach(function (element) { roots.push(element); });
      }
      roots = uniqueElements(roots);
      rememberNormalRoots(roots);
      return roots;
    }

    function getModeRoots(mode) {
      var document = documentRef();
      if (!document) { return []; }
      var roots = [];
      var surface = getSurface(false);
      registeredRoots.forEach(function (entry) {
        if (entry.mode === mode && entry.element?.isConnected !== false) {
          roots.push(entry.element);
        }
      });
      document.querySelectorAll?.('[data-codexr-analysis-root="true"]').forEach(function (element) {
        if (element.getAttribute?.('data-codexr-analysis-mode') === mode) {
          roots.push(element);
        }
      });
      surface?.querySelectorAll?.('[data-codexr-analysis-mode="' + mode + '"]')?.forEach(function (element) {
        roots.push(element);
      });
      return uniqueElements(roots);
    }

    function mountRoot(mode, element) {
      if (!element) { return null; }
      var surface = getSurface(true);
      if (!surface) { return element; }
      element.setAttribute?.('data-codexr-analysis-root', 'true');
      element.setAttribute?.('data-codexr-analysis-mode', mode);
      if (element.parentNode !== surface) {
        surface.appendChild(element);
      }
      setElementSelfVisible(surface, true);
      setElementTreeVisible(element, true);
      registeredRoots.set(element.id || mode + ':' + registeredRoots.size, {
        mode: mode,
        element: element
      });
      debugLog('Surface root mounted', {
        mode: mode,
        id: element.id || '',
        surfaceChildren: surface.children?.length || 0
      });
      return element;
    }

    function removeMode(mode) {
      if (mode === 'single') {
        return detachNormalRoots('remove-single-mode');
      }
      var removed = 0;
      getModeRoots(mode).forEach(function (element) {
        removeElement(element);
        removed += 1;
      });
      registeredRoots.forEach(function (entry, key) {
        if (entry.mode === mode) {
          registeredRoots.delete(key);
        }
      });
      return removed;
    }

    function isPreservedRoot(element) {
      return element?.getAttribute?.('data-codexr-preserve') === 'true';
    }

    function removeTransientRoots() {
      var document = documentRef();
      if (!document) { return []; }
      var removed = [];
      var normalRoot = getNormalRoot();
      var surface = getSurface(false);
      document.querySelectorAll?.('[data-codexr-analysis-root="true"]').forEach(function (element) {
        if (element === normalRoot || element.getAttribute?.('data-codexr-analysis-mode') === 'single') {
          return;
        }
        // Preserved roots keep their state across the selector (the mode
        // restores them as left, like the hidden single-mode roots): hide,
        // never remove.
        if (isPreservedRoot(element)) {
          setElementTreeVisible(element, false);
          return;
        }
        removed.push(element.id || element.getAttribute?.('data-codexr-analysis-mode') || 'anonymous-root');
        removeElement(element);
      });
      surface?.children && Array.from(surface.children).forEach(function (child) {
        if (child === normalRoot || child.getAttribute?.('data-codexr-analysis-mode') === 'single') {
          return;
        }
        if (isPreservedRoot(child)) {
          setElementTreeVisible(child, false);
          return;
        }
        removed.push(child.id || child.getAttribute?.('data-codexr-analysis-mode') || 'anonymous-child');
        removeElement(child);
      });
      registeredRoots.forEach(function (entry, key) {
        if (entry.mode !== 'single' && !isPreservedRoot(entry.element)) {
          registeredRoots.delete(key);
        }
      });
      return removed;
    }

    // Hides a mode's preserved roots through the same visibility/interaction
    // bookkeeping the surface uses everywhere else (a second suspension
    // mechanism would leak: mountRoot only restores this one).
    function preserveModeRoots(mode) {
      var hidden = 0;
      getModeRoots(mode).forEach(function (element) {
        if (isPreservedRoot(element)) {
          setElementTreeVisible(element, false);
          hidden += 1;
        }
      });
      return hidden;
    }

    function detachNormalRoots(reason) {
      var surface = getSurface(false);
      var roots = getNormalSurfaceRoots();
      rememberNormalRoots(roots);
      roots.forEach(function (element) {
        setElementTreeVisible(element, false);
      });
      var activeNonNormalRootCount = 0;
      surface?.querySelectorAll?.('[data-codexr-analysis-root="true"]')?.forEach(function (element) {
        if (element.getAttribute?.('data-codexr-analysis-mode') !== 'single'
          && element.getAttribute?.('visible') !== false) {
          activeNonNormalRootCount += 1;
        }
      });
      if (surface && activeNonNormalRootCount === 0) {
        setElementTreeVisible(surface, false);
      }
      debugLog('Surface normal roots detached', {
        reason: reason || '',
        rootCount: roots.length,
        ids: roots.map(function (element) { return element.id || element.tagName || 'anonymous'; })
      });
      return roots.length;
    }

    function mountNormalRoots() {
      var surface = getSurface(true);
      if (!surface) { return 0; }
      var roots = getNormalSurfaceRoots();
      rememberNormalRoots(roots);
      setElementSelfVisible(surface, true);
      roots.forEach(function (element) {
        element.setAttribute?.('data-codexr-analysis-root', 'true');
        element.setAttribute?.('data-codexr-analysis-mode', 'single');
        if (!element.getAttribute?.('data-codexr-normal-root')) {
          element.setAttribute?.('data-codexr-normal-root', 'true');
        }
        if (element.parentNode !== surface) {
          surface.appendChild(element);
        }
        setElementTreeVisible(element, true);
      });
      debugLog('Surface normal roots mounted', {
        rootCount: roots.length,
        ids: roots.map(function (element) { return element.id || element.tagName || 'anonymous'; })
      });
      return roots.length;
    }

    function setNormalVisible(visible) {
      var rootCount = visible ? mountNormalRoots() : detachNormalRoots('set-normal-hidden');
      debugLog('Surface normal visibility changed', {
        visible: !!visible,
        rootCount: rootCount
      });
      return rootCount;
    }

    function clearForSelection(reason) {
      localGeneration += 1;
      var generation = localGeneration;
      var surface = getSurface(false);
      debugLog('Surface clear requested', {
        reason: reason || '',
        generation: generation,
        surfaceFound: !!surface,
        childCount: surface?.children?.length || 0
      });
      var removed = removeTransientRoots();
      var detachedNormalCount = detachNormalRoots(reason || 'selection-clear');
      surface = getSurface(false);
      if (surface) {
        setElementTreeVisible(surface, false);
      }
      var remaining = surface?.querySelectorAll?.('[data-codexr-analysis-root="true"]')?.length || 0;
      debugLog('Surface cleared', {
        generation: generation,
        removed: removed,
        detachedNormalCount: detachedNormalCount,
        remainingRoots: remaining
      });
      return {
        generation: generation,
        removed: removed,
        detachedNormalCount: detachedNormalCount,
        remainingRoots: remaining
      };
    }

    function activateMode(mode) {
      var surface = getSurface(true);
      if (surface) {
        setElementSelfVisible(surface, true);
      }
      if (mode === 'single') {
        removeTransientRoots();
        setNormalVisible(true);
      } else {
        setNormalVisible(false);
      }
      debugLog('Mode activated on surface', {
        mode: mode,
        childCount: surface?.children?.length || 0
      });
    }

    function getSnapshot() {
      var surface = getSurface(false);
      var roots = surface?.querySelectorAll?.('[data-codexr-analysis-root="true"]') || [];
      return {
        surfaceId: surface?.id || null,
        surfaceVisible: surface?.getAttribute?.('visible') !== false,
        childCount: surface?.children?.length || 0,
        visualRootCount: roots.length || 0,
        roots: Array.from(roots).map(function (element) {
          return {
            id: element.id || '',
            mode: element.getAttribute?.('data-codexr-analysis-mode') || '',
            visible: element.getAttribute?.('visible') !== false
          };
        }),
        registeredRootCount: registeredRoots.size,
        generation: localGeneration
      };
    }

    root.CodeXRAnalysisSurfaceRuntime = {
      getSurface: function () { return getSurface(true); },
      mountRoot: mountRoot,
      removeMode: removeMode,
      preserveModeRoots: preserveModeRoots,
      clearForSelection: clearForSelection,
      setNormalVisible: setNormalVisible,
      activateMode: activateMode,
      getSnapshot: getSnapshot,
      __testing: {
        setElementTreeVisible: setElementTreeVisible,
        clearForSelection: clearForSelection,
        removeTransientRoots: removeTransientRoots,
        detachNormalRoots: detachNormalRoots,
        mountNormalRoots: mountNormalRoots
      }
    };
    return root.CodeXRAnalysisSurfaceRuntime;
  }

  function getNormalRefreshRuntime() {
    if (root.CodeXRNormalAnalysisRefreshRuntime) {
      return root.CodeXRNormalAnalysisRefreshRuntime;
    }
    var refreshState = {
      generation: 0,
      completedGeneration: 0,
      refreshing: false,
      waiters: []
    };
    function resolveWaiters() {
      refreshState.waiters = refreshState.waiters.filter(function (waiter) {
        if (refreshState.completedGeneration <= waiter.baseline) {
          return true;
        }
        root.clearTimeout?.(waiter.timer);
        waiter.resolve({
          completed: true,
          generation: refreshState.completedGeneration
        });
        return false;
      });
    }
    root.CodeXRNormalAnalysisRefreshRuntime = {
      begin: function () {
        refreshState.generation += 1;
        refreshState.refreshing = true;
        return refreshState.generation;
      },
      complete: function (generation) {
        refreshState.completedGeneration = Math.max(
          refreshState.completedGeneration,
          Number(generation || refreshState.generation)
        );
        refreshState.refreshing = refreshState.completedGeneration < refreshState.generation;
        resolveWaiters();
        return refreshState.completedGeneration;
      },
      waitForCompletionAfter: function (baseline, timeoutMs) {
        if (refreshState.completedGeneration > Number(baseline || 0)) {
          return Promise.resolve({
            completed: true,
            generation: refreshState.completedGeneration
          });
        }
        return new Promise(function (resolve) {
          var waiter = {
            baseline: Number(baseline || 0),
            resolve: resolve,
            timer: null
          };
          waiter.timer = root.setTimeout?.(function () {
            refreshState.waiters = refreshState.waiters.filter(function (candidate) {
              return candidate !== waiter;
            });
            resolve({
              completed: false,
              generation: refreshState.completedGeneration,
              reason: 'refresh-timeout'
            });
          }, Math.max(500, Number(timeoutMs || 3500)));
          refreshState.waiters.push(waiter);
        });
      },
      getState: function () {
        return {
          generation: refreshState.generation,
          completedGeneration: refreshState.completedGeneration,
          refreshing: refreshState.refreshing
        };
      }
    };
    return root.CodeXRNormalAnalysisRefreshRuntime;
  }
