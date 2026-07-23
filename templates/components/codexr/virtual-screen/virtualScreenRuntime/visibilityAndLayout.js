// == virtualScreenRuntime.js | visibilityAndLayout (assembled per manifest.json; see COMPONENTS.md) ==
    function clearChromeHideTimer() {
      if (refs.chromeHideTimer) {
        const clearTimer = win.clearTimeout || global.clearTimeout;
        clearTimer(refs.chromeHideTimer);
        refs.chromeHideTimer = null;
      }
    }

    function showChrome() {
      clearChromeHideTimer();
      if (!state.chromeVisible) {
        state.chromeVisible = true;
        refreshUi();
      }
    }

    function hideChromeNow() {
      clearChromeHideTimer();
      if (state.drag || state.mode === 'idle') {
        return;
      }
      if (state.chromeVisible) {
        state.chromeVisible = false;
        refreshUi();
      }
    }

    function scheduleChromeHide() {
      if (state.mode === 'idle' || state.drag) {
        return;
      }
      clearChromeHideTimer();
      const setTimer = win.setTimeout || global.setTimeout;
      refs.chromeHideTimer = setTimer(function () {
        refs.chromeHideTimer = null;
        hideChromeNow();
      }, 220);
    }

    function wireChromeVisibility(entity) {
      if (!entity?.addEventListener) {
        return;
      }
      entity.addEventListener('mouseenter', showChrome);
      entity.addEventListener('mouseleave', scheduleChromeHide);
      entity.addEventListener('raycaster-intersected', showChrome);
      entity.addEventListener('raycaster-intersected-cleared', scheduleChromeHide);
    }
    function createUi() {
      if (refs.root) {
        return;
      }

      const scene = getScene();
      if (!scene) {
        return;
      }

      refs.root = createEntity('a-entity', {
        id: getScopedId('codexrVirtualScreenRoot'),
        position: formatVector(refs.config.anchoredPosition),
        rotation: formatVector(refs.config.anchoredRotation),
      });

      refs.frame = createEntity('a-plane', {
        id: getScopedId('codexrVirtualScreenFrame'),
        color: '#0F172A',
        material: 'color: #0F172A; opacity: 0.86; transparent: true; shader: flat;',
        position: '0 0 -0.01',
      });

      if (isFixedContent(refs.config)) {
        // Fixed-content subtype: the display surface is a content slot filled
        // by the registered provider instead of the WebRTC video plane.
        refs.display = null;
        refs.contentRoot = createEntity('a-entity', {
          id: getScopedId('codexrVirtualScreenContent'),
          position: '0 0 0.01',
        });
        const buildContent = getContentProvider(refs.config.contentProviderId);
        if (buildContent) {
          buildContent(refs.contentRoot, api);
        } else {
          console.warn('VIRTUAL_SCREEN: no content provider registered for', refs.config.contentProviderId);
        }
      } else {
        refs.contentRoot = null;
        refs.display = createEntity('a-video', {
          id: getScopedId('codexrVirtualScreenDisplay'),
          src: `#${getVideoElementId()}`,
          position: '0 0 0.01',
          visible: 'false',
        });
      }

      // Raycast-only surfaces: depthWrite: false keeps these near-invisible
      // planes out of the depth buffer — otherwise every transparent object
      // behind them is clipped along the plane (the "diagonal cut" artifact,
      // most visible while dragging a screen across other components).
      refs.interactionPlane = createEntity('a-plane', {
        id: getScopedId('codexrVirtualScreenSurface'),
        class: `${RAYCAST_CLASS} codexr-screen-surface`,
        color: '#FFFFFF',
        material: 'color: #FFFFFF; opacity: 0.001; transparent: true; side: double; depthWrite: false;',
        position: '0 0 0.02',
      });

      // Deliberately created WITHOUT the raycast class: this huge invisible
      // plane only joins the raycaster's world while a drag is active
      // (setInteractive in refreshUi / the drag lifecycle), otherwise it would
      // silently block clicks across a large part of the room.
      refs.dragPlane = createEntity('a-plane', {
        id: getScopedId('codexrVirtualScreenDragPlane'),
        class: 'codexr-screen-drag-plane',
        width: '28',
        height: '18',
        color: '#FFFFFF',
        material: 'color: #FFFFFF; opacity: 0.001; transparent: true; side: double; depthWrite: false;',
        position: '0 0 0.015',
        visible: 'false',
      });

      refs.headerStrip = createEntity('a-plane', {
        id: getScopedId('codexrVirtualScreenHeader'),
        color: '#0F172A',
        material: 'color: #0F172A; opacity: 0.0; transparent: true; shader: flat;',
        position: '0 0 0.03',
      });

      refs.status = createEntity('a-text', {
        id: getScopedId('codexrVirtualScreenStatus'),
        align: 'center',
        color: '#F8FAFC',
        width: '8',
        value: refs.config.labels.idle,
        position: '0 0.95 0.04',
      });

      refs.legendRoot = createEntity('a-entity', {
        id: getScopedId('codexrVirtualScreenLegendRoot'),
      });

      refs.legendPanel = createEntity('a-plane', {
        id: getScopedId('codexrVirtualScreenLegendPanel'),
        class: `${RAYCAST_CLASS} codexr-screen-legend`,
        color: '#0F172A',
        material: 'color: #0F172A; opacity: 0.72; transparent: true; shader: flat;',
      });

      refs.legendText = createEntity('a-text', {
        id: getScopedId('codexrVirtualScreenLegendText'),
        align: 'left',
        anchor: 'left',
        baseline: 'top',
        color: '#F8FAFC',
        value: getControlLegend(),
        position: '0 0 0.02',
      });

      refs.legendToggle = createButton('codexrLegendToggle', '−', 0.28, 0.48, 0.60, 2);
      refs.legendRoot.appendChild(refs.legendPanel);
      refs.legendRoot.appendChild(refs.legendText);
      refs.legendRoot.appendChild(refs.legendToggle);

      // Fixed-content screens have no source picker: their content is immutable.
      refs.shareButton = isFixedContent(refs.config)
        ? null
        : createButton('codexrShareSource', '▣', 0.86, 0.86, 1.6, 4);
      refs.audioUnlockButton = createButton('codexrEnableAudio', refs.config.labels.audioUnlock, 1.52, 0.34, 3.1, 18);
      refs.headerButtons.lookAt = createButton(HEADER_BUTTONS.lookAt, '◈', 0.24, 0.24, 0.65, 3);
      refs.headerButtons.follow = createButton(HEADER_BUTTONS.follow, '◎', 0.24, 0.24, 0.65, 3);
      refs.headerButtons.minimize = createButton(HEADER_BUTTONS.minimize, '—', 0.24, 0.24, 0.70, 3);
      refs.headerButtons.stop = createButton(HEADER_BUTTONS.stop, '×', 0.24, 0.24, 0.65, 3);

      refs.cornerHandles.topLeft = createHandle(CORNER_HANDLES.topLeft, 0.16, 0.16);
      refs.cornerHandles.topRight = createHandle(CORNER_HANDLES.topRight, 0.16, 0.16);
      refs.cornerHandles.bottomLeft = createHandle(CORNER_HANDLES.bottomLeft, 0.16, 0.16);
      refs.cornerHandles.bottomRight = createHandle(CORNER_HANDLES.bottomRight, 0.16, 0.16);

      refs.edgeHandles.top = createHandle(EDGE_HANDLES.top, 0.80, 0.05);
      refs.edgeHandles.right = createHandle(EDGE_HANDLES.right, 0.05, 0.70);
      refs.edgeHandles.bottom = createHandle(EDGE_HANDLES.bottom, 0.80, 0.05);
      refs.edgeHandles.left = createHandle(EDGE_HANDLES.left, 0.05, 0.70);

      refs.root.appendChild(refs.frame);
      if (refs.display) {
        refs.root.appendChild(refs.display);
      }
      if (refs.contentRoot) {
        refs.root.appendChild(refs.contentRoot);
      }
      refs.root.appendChild(refs.interactionPlane);
      refs.root.appendChild(refs.dragPlane);
      refs.root.appendChild(refs.headerStrip);
      refs.root.appendChild(refs.status);
      refs.root.appendChild(refs.legendRoot);
      if (refs.shareButton) {
        refs.root.appendChild(refs.shareButton);
      }
      refs.root.appendChild(refs.audioUnlockButton);
      Object.values(refs.headerButtons).forEach((button) => refs.root.appendChild(button));
      Object.values(refs.cornerHandles).forEach((handle) => refs.root.appendChild(handle));
      Object.values(refs.edgeHandles).forEach((handle) => refs.root.appendChild(handle));
      scene.appendChild(refs.root);

      wireControlHandlers();
      wireDragHandlers();
      wireCleanupHandlers();
      wireDepthInputHandlers();
      [
        refs.frame,
        refs.display,
        refs.contentRoot,
        refs.interactionPlane,
        refs.headerStrip,
        refs.status,
        refs.legendRoot,
        refs.legendPanel,
        refs.legendText,
        refs.legendToggle,
        refs.shareButton,
        refs.audioUnlockButton,
        ...Object.values(refs.headerButtons),
        ...Object.values(refs.cornerHandles),
        ...Object.values(refs.edgeHandles),
      ].filter(Boolean).forEach(wireChromeVisibility);
      layout();
      refreshUi();
    }

    function findClosestSizeIndex(width) {
      let bestIndex = 0;
      let bestDelta = Number.POSITIVE_INFINITY;
      refs.config.sizeSteps.forEach((size, index) => {
        const delta = Math.abs(size - width);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestIndex = index;
        }
      });
      return bestIndex;
    }

    function getDisplayedStatusText() {
      if (hasDisplayedStream() || isMinimized()) {
        return '';
      }
      if (isFixedContent(refs.config)) {
        // Fixed screens are never "idle broadcast" — only transient hints
        // (move/resize/lock) surface over their content.
        return state.statusMessage === refs.config.labels.idle ? '' : (state.statusMessage || '');
      }
      return state.statusMessage || refs.config.labels.idle;
    }

    function layout() {
      if (!refs.root) {
        return;
      }
      updateLegendSide();

      const minimized = isMinimized();
      const width = minimized ? refs.config.minimizedWidth : state.screenWidth;
      const height = minimized ? refs.config.minimizedHeight : (state.screenWidth / refs.config.aspectRatio);
      const frameWidth = width + 0.12;
      const frameHeight = height + 0.12;
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      const headerY = minimized ? 0 : (height / 2) + 0.10;
      const legendExpanded = !state.legendCollapsed;
      const legendSideSign = state.legendSide === 'left' ? -1 : 1;
      const legendMetrics = getLegendLayoutMetrics(width, minimized);
      const legendWidth = legendMetrics.legendWidth;
      const legendHeight = legendMetrics.legendHeight;
      const legendOffsetX = legendSideSign * (halfWidth + (legendExpanded ? (legendWidth / 2) + 0.38 : 0.24));
      const legendOffsetY = minimized ? 0.16 : Math.max(0.18, halfHeight - 0.32);
      const legendToggleOffset = legendExpanded ? (-legendSideSign * ((legendWidth / 2) + 0.16)) : 0;

      refs.frame.setAttribute('width', String(frameWidth));
      refs.frame.setAttribute('height', String(frameHeight));
      if (refs.display) {
        refs.display.setAttribute('width', String(width));
        refs.display.setAttribute('height', String(height));
      }
      if (refs.contentRoot) {
        // Fixed content designs at contentDesignWidth; scale it with the screen
        // so corner-resizes shrink/grow the whole guide uniformly.
        const contentScale = width / (refs.config.contentDesignWidth || width || 1);
        refs.contentRoot.setAttribute('scale', `${contentScale} ${contentScale} ${contentScale}`);
      }
      refs.interactionPlane.setAttribute('width', String(width));
      refs.interactionPlane.setAttribute('height', String(height));
      refs.dragPlane.setAttribute('width', String(Math.max(28, width * 5.5)));
      refs.dragPlane.setAttribute('height', String(Math.max(18, height * 5.5)));
      refs.headerStrip.setAttribute('width', String(frameWidth));
      refs.headerStrip.setAttribute('height', minimized ? '0.20' : '0.16');
      refs.headerStrip.setAttribute('position', minimized ? '0 0 0.03' : `0 ${headerY} 0.03`);

      refs.status.setAttribute('width', String(Math.max(6, width + 1.4)));
      // Fixed-content screens keep transient hints (move/resize/lock) above the
      // screen so they never cover the content; broadcast screens keep the
      // classic centered placement over the empty idle surface.
      refs.status.setAttribute('position', minimized
        ? '0 0.28 0.04'
        : (isFixedContent(refs.config) ? `0 ${halfHeight + 0.34} 0.04` : '0 0.95 0.04'));
      refs.shareButton?.setAttribute('position', '0 0 0.04');
      refs.audioUnlockButton.setAttribute('position', minimized ? '0 -0.06 0.04' : `0 ${-(halfHeight - 0.28)} 0.04`);
      refs.legendRoot.setAttribute('position', `${legendOffsetX} ${legendOffsetY} 0.05`);
      refs.legendPanel.setAttribute('width', String(legendWidth));
      refs.legendPanel.setAttribute('height', String(legendHeight));
      refs.legendPanel.setAttribute('position', '0 0 0');
      refs.legendText.setAttribute('width', String(legendMetrics.textWidth));
      refs.legendText.setAttribute('wrap-count', String(legendMetrics.wrapCount));
      refs.legendText.setAttribute('position', `${-(legendWidth / 2) + legendMetrics.horizontalPadding} ${legendHeight / 2 - legendMetrics.verticalPadding} 0.02`);
      refs.legendToggle.setAttribute('position', `${legendToggleOffset} 0 0.03`);

      refs.headerButtons.lookAt.setAttribute('position', `${halfWidth - 0.80} ${headerY} 0.05`);
      refs.headerButtons.follow.setAttribute('position', `${halfWidth - 0.54} ${headerY} 0.05`);
      refs.headerButtons.minimize.setAttribute('position', `${halfWidth - 0.28} ${headerY} 0.05`);
      refs.headerButtons.stop.setAttribute('position', `${halfWidth - 0.02} ${headerY} 0.05`);

      refs.cornerHandles.topLeft.setAttribute('position', `${-(halfWidth + 0.08)} ${halfHeight + 0.08} 0.05`);
      refs.cornerHandles.topRight.setAttribute('position', `${halfWidth + 0.08} ${halfHeight + 0.08} 0.05`);
      refs.cornerHandles.bottomLeft.setAttribute('position', `${-(halfWidth + 0.08)} ${-(halfHeight + 0.08)} 0.05`);
      refs.cornerHandles.bottomRight.setAttribute('position', `${halfWidth + 0.08} ${-(halfHeight + 0.08)} 0.05`);

      refs.edgeHandles.top.setAttribute('width', String(Math.max(0.65, width * 0.36)));
      refs.edgeHandles.bottom.setAttribute('width', String(Math.max(0.65, width * 0.36)));
      refs.edgeHandles.left.setAttribute('height', String(Math.max(0.65, height * 0.42)));
      refs.edgeHandles.right.setAttribute('height', String(Math.max(0.65, height * 0.42)));

      refs.edgeHandles.top.setAttribute('position', `0 ${halfHeight + 0.08} 0.05`);
      refs.edgeHandles.bottom.setAttribute('position', `0 ${-(halfHeight + 0.08)} 0.05`);
      refs.edgeHandles.left.setAttribute('position', `${-(halfWidth + 0.08)} 0 0.05`);
      refs.edgeHandles.right.setAttribute('position', `${halfWidth + 0.08} 0 0.05`);
    }

    function refreshUi() {
      if (!refs.root) {
        return;
      }

      const minimized = isMinimized();
      const fixedContent = isFixedContent(refs.config);
      const active = hasDisplayedStream();
      const expanded = !minimized;
      const chromeVisible = state.chromeVisible || !!state.drag;
      const headerVisible = minimized || chromeVisible;
      const showShareButton = !fixedContent && state.mode === 'idle';
      const showStatus = !active && !minimized && !!getDisplayedStatusText();
      const showAudioUnlock = state.audioUnlockRequired && state.streamSourceType === 'remote' && state.hasAudio;
      const showLegend = (active || minimized || fixedContent) && chromeVisible;

      setEntityVisible(refs.display, active && expanded);
      // Fixed content is the screen's permanent face: visible whenever expanded.
      setEntityVisible(refs.contentRoot, fixedContent && expanded);
      setEntityVisible(refs.frame, true);
      // Interactive chrome goes through setInteractive so hidden elements also
      // leave the raycaster's world (raycastable ⇔ visible).
      setInteractive(refs.interactionPlane, expanded);
      setInteractive(refs.dragPlane, !!state.drag);
      setEntityVisible(refs.headerStrip, headerVisible);
      setEntityVisible(refs.status, showStatus);
      setEntityVisible(refs.legendRoot, showLegend);
      setInteractive(refs.legendPanel, showLegend && !state.legendCollapsed);
      setEntityVisible(refs.legendText, showLegend && !state.legendCollapsed);
      setInteractive(refs.legendToggle, showLegend);
      setInteractive(refs.shareButton, showShareButton);
      setInteractive(refs.audioUnlockButton, showAudioUnlock);
      Object.values(refs.headerButtons).forEach((button) => setInteractive(button, headerVisible));
      Object.values(refs.cornerHandles).forEach((handle) => setInteractive(handle, expanded && chromeVisible));
      Object.values(refs.edgeHandles).forEach((handle) => setInteractive(handle, chromeVisible));

      refs.status.setAttribute('value', getDisplayedStatusText());
      refs.legendText.setAttribute('value', getControlLegend());
      refs.legendToggle.__codexrGlyph = state.legendCollapsed ? '+' : '−';
      refs.headerButtons.lookAt.__codexrGlyph = state.lookAtCameraEnabled ? '◈' : '◇';
      refs.headerButtons.follow.__codexrGlyph = state.follow ? '◉' : '◎';
      refs.headerButtons.minimize.__codexrGlyph = minimized ? '□' : '—';
      refs.headerButtons.stop.__codexrGlyph = '×';
      refs.audioUnlockButton.__codexrGlyph = refs.config.labels.audioUnlock;

      setButtonStyle(refs.shareButton, 0.20, '#F8FAFC', '#0F172A');
      setButtonStyle(refs.audioUnlockButton, showAudioUnlock ? 0.92 : 0.0, '#0EA5E9', '#F8FAFC');
      setMaterial(refs.legendPanel, `color: #020617; opacity: ${showLegend && !state.legendCollapsed ? 0.84 : 0.0}; transparent: true; shader: flat;`);
      setButtonStyle(refs.legendToggle, showLegend ? 0.88 : 0.0, state.legendCollapsed ? '#16A34A' : '#F59E0B', '#111827');
      setButtonStyle(refs.headerButtons.lookAt, headerVisible ? 0.82 : 0.0, state.lookAtCameraEnabled ? '#7C3AED' : '#C08497', state.lookAtCameraEnabled ? '#F8FAFC' : '#111827');
      setButtonStyle(refs.headerButtons.follow, headerVisible ? 0.82 : 0.0, state.follow ? '#F97316' : '#2563EB', '#F8FAFC');
      setButtonStyle(refs.headerButtons.minimize, headerVisible ? 0.88 : 0.0, minimized ? '#16A34A' : '#F59E0B', '#111827');
      setButtonStyle(refs.headerButtons.stop, headerVisible ? 0.88 : 0.0, '#DC2626', '#F8FAFC');
      Object.values(refs.cornerHandles).forEach((handle) => setHandleStyle(handle, expanded && chromeVisible));
      Object.values(refs.edgeHandles).forEach((handle) => setHandleStyle(handle, chromeVisible));
      setMaterial(refs.headerStrip, `color: #0F172A; opacity: ${headerVisible ? 0.14 : 0.0}; transparent: true; shader: flat;`);
    }

    function updateStatus(message) {
      state.statusMessage = message;
      refreshUi();
    }

    function toggleLegend() {
      state.legendCollapsed = !state.legendCollapsed;
      layout();
      refreshUi();
      showChrome();
    }

    function toggleLookAtCamera() {
      state.lookAtCameraEnabled = !state.lookAtCameraEnabled;
      if (state.lookAtCameraEnabled && !state.follow && !state.drag) {
        applyFaceCameraOrientation();
        ensureFaceCameraLoop();
      }
      layout();
      refreshUi();
      showChrome();
      updateStatus(state.currentSourceLabel || (state.lookAtCameraEnabled ? 'Look-at enabled.' : 'Look-at disabled.'));
      publishSharedScreenState();
    }

    function normalizeBroadcastState(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') {
        return {
          active: false,
          broadcasterPeerId: '',
          hasAudio: false,
          sourceKind: '',
        };
      }
      return {
        active: snapshot.active === true,
        broadcasterPeerId: typeof snapshot.broadcasterPeerId === 'string' ? snapshot.broadcasterPeerId.trim() : '',
        hasAudio: snapshot.hasAudio === true,
        sourceKind: typeof snapshot.sourceKind === 'string' ? snapshot.sourceKind.trim() : '',
      };
    }
