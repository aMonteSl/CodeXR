(function (factory) {
  const root = typeof globalThis !== 'undefined'
    ? globalThis
    : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
        ? window
        : typeof global !== 'undefined'
          ? global
          : this;

  const runtime = factory(root);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = runtime;
  }

  root.CodeXRVirtualScreenRuntime = runtime;

  if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', function () {
        runtime.autoInit();
      }, { once: true });
    } else {
      runtime.autoInit();
    }
  }
})(function (global) {
  'use strict';

  const DEFAULT_CONFIG = {
    enabled: true,
    sceneSelector: 'a-scene',
    followAnchorSelector: '#rig',
    anchoredPosition: { x: 0, y: 8, z: 6 },
    anchoredRotation: { x: -10, y: 0, z: 0 },
    followOffset: { x: 0, y: 0.7, z: -2.2 },
    followRotation: { x: 0, y: 0, z: 0 },
    defaultSizeIndex: 2,
    sizeSteps: [3.2, 4.0, 4.8, 5.8, 6.8],
    aspectRatio: 16 / 9,
    minWidth: 2.6,
    maxWidth: 10.0,
    minimizedWidth: 2.1,
    minimizedHeight: 0.42,
    dragDepthStep: 0.45,
    controllerDepthStep: 0.08,
    labels: {
      idle: 'Share a screen, window, or browser tab in this XR scene.',
      minimized: 'Virtual screen minimized.',
      permissionDenied: 'Screen sharing permission was denied. Use Share again to retry.',
      unavailable: 'Screen capture is not available in this browser.',
      sourceEnded: 'The shared source stopped. Expand the screen to share again.',
      move: 'Drag a side handle to move the virtual screen.',
      resize: 'Drag a corner handle to resize the virtual screen.',
    },
  };

  const SOURCE_MESSAGES = {
    screen: {
      pending: 'Choose a screen, browser tab, or window in the native picker.',
      active: 'Sharing screen/window',
    },
    window: {
      pending: 'Choose the window or app you want to share.',
      active: 'Sharing window/app',
    },
    vscode: {
      pending: 'Choose the VS Code window in the native picker.',
      active: 'Sharing VS Code window',
    },
  };

  const HEADER_BUTTONS = {
    lookAt: 'codexrHeaderLookAt',
    follow: 'codexrHeaderFollow',
    minimize: 'codexrHeaderMinimize',
    stop: 'codexrHeaderStop',
  };

  const CORNER_HANDLES = {
    topLeft: 'codexrResizeTopLeft',
    topRight: 'codexrResizeTopRight',
    bottomLeft: 'codexrResizeBottomLeft',
    bottomRight: 'codexrResizeBottomRight',
  };

  const EDGE_HANDLES = {
    top: 'codexrMoveTop',
    right: 'codexrMoveRight',
    bottom: 'codexrMoveBottom',
    left: 'codexrMoveLeft',
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatVector(vector) {
    return `${vector.x} ${vector.y} ${vector.z}`;
  }

  function mergeConfig(userConfig) {
    const merged = { ...DEFAULT_CONFIG, ...(userConfig || {}) };
    merged.anchoredPosition = { ...DEFAULT_CONFIG.anchoredPosition, ...(userConfig?.anchoredPosition || {}) };
    merged.anchoredRotation = { ...DEFAULT_CONFIG.anchoredRotation, ...(userConfig?.anchoredRotation || {}) };
    merged.followOffset = { ...DEFAULT_CONFIG.followOffset, ...(userConfig?.followOffset || {}) };
    merged.followRotation = { ...DEFAULT_CONFIG.followRotation, ...(userConfig?.followRotation || {}) };
    merged.labels = { ...DEFAULT_CONFIG.labels, ...(userConfig?.labels || {}) };
    merged.sizeSteps = Array.isArray(userConfig?.sizeSteps) && userConfig.sizeSteps.length > 0
      ? userConfig.sizeSteps.slice()
      : DEFAULT_CONFIG.sizeSteps.slice();
    merged.minWidth = userConfig?.minWidth || DEFAULT_CONFIG.minWidth;
    merged.maxWidth = userConfig?.maxWidth || DEFAULT_CONFIG.maxWidth;
    return merged;
  }

  function createRuntime(win) {
    const state = {
      initialized: false,
      mode: 'idle',
      lookAtCameraEnabled: true,
      follow: false,
      followTransform: null,
      legendSide: 'right',
      chromeVisible: false,
      currentSourceLabel: '',
      statusMessage: DEFAULT_CONFIG.labels.idle,
      stream: null,
      screenWidth: DEFAULT_CONFIG.sizeSteps[DEFAULT_CONFIG.defaultSizeIndex],
      sizeIndex: DEFAULT_CONFIG.defaultSizeIndex,
      lastIntent: 'screen',
      drag: null,
      dragLoopActive: false,
      followLoopActive: false,
      faceCameraLoopActive: false,
      legendCollapsed: false,
    };

    const refs = {
      config: mergeConfig(win.__CODEXR_VIRTUAL_SCREEN_CONFIG__),
      scene: null,
      followAnchor: null,
      videoSource: null,
      root: null,
      frame: null,
      display: null,
      interactionPlane: null,
      dragPlane: null,
      headerStrip: null,
      status: null,
      legendRoot: null,
      legendPanel: null,
      legendText: null,
      legendToggle: null,
      shareButton: null,
      headerButtons: {},
      cornerHandles: {},
      edgeHandles: {},
      cleanupBound: false,
      inputHandlersBound: false,
      controllerTargets: [],
      chromeHideTimer: null,
    };

    function getDocument() {
      return win.document;
    }

    function getScene() {
      if (refs.scene && refs.scene.isConnected) {
        return refs.scene;
      }
      refs.scene = getDocument()?.querySelector(refs.config.sceneSelector) || null;
      return refs.scene;
    }

    function getFollowAnchor() {
      if (refs.followAnchor && refs.followAnchor.isConnected) {
        return refs.followAnchor;
      }
      refs.followAnchor = getDocument()?.querySelector(refs.config.followAnchorSelector) || getScene();
      return refs.followAnchor;
    }

    function getCameraWorldQuaternion() {
      if (!global.THREE) {
        return null;
      }
      const scene = getScene();
      if (scene?.camera?.getWorldQuaternion) {
        const quaternion = new global.THREE.Quaternion();
        scene.camera.getWorldQuaternion(quaternion);
        return quaternion;
      }
      const cameraEntity = getDocument()?.querySelector('a-camera, [camera]');
      return getWorldQuaternion(cameraEntity) || getWorldQuaternion(getFollowAnchor());
    }

    function ensureVideoSource() {
      if (refs.videoSource && refs.videoSource.isConnected) {
        return refs.videoSource;
      }
      const document = getDocument();
      if (!document) {
        return null;
      }
      let video = document.getElementById('codexrVirtualScreenVideo');
      if (!video) {
        video = document.createElement('video');
        video.id = 'codexrVirtualScreenVideo';
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        video.style.display = 'none';
        document.body.appendChild(video);
      }
      refs.videoSource = video;
      return video;
    }

    function createEntity(tagName, attributes) {
      const entity = getDocument().createElement(tagName);
      Object.entries(attributes || {}).forEach(([key, value]) => entity.setAttribute(key, value));
      return entity;
    }

    function setEntityVisible(entity, visible) {
      entity?.setAttribute('visible', visible ? 'true' : 'false');
    }

    function setMaterial(entity, material) {
      if (entity) {
        entity.setAttribute('material', material);
      }
    }

    function setText(entity, label, color, width, wrapCount) {
      if (!entity) {
        return;
      }
      const target = entity.__codexrTextEntity || entity;
      if (target.tagName?.toLowerCase?.() === 'a-text') {
        target.setAttribute('value', label);
        target.setAttribute('color', color);
        target.setAttribute('align', 'center');
        target.setAttribute('width', String(width));
        target.setAttribute('wrap-count', String(wrapCount));
        return;
      }
      target.setAttribute('text', `value: ${label}; color: ${color}; align: center; width: ${width}; wrapCount: ${wrapCount};`);
    }

    function createButton(id, glyph, width, height, textWidth, wrapCount) {
      const button = createEntity('a-plane', {
        id,
        class: 'babiaxraycasterclass codexr-screen-button',
        width: String(width),
        height: String(height),
        color: '#0F172A',
        material: 'color: #0F172A; opacity: 0.18; transparent: true; shader: flat;',
      });
      const label = createEntity('a-text', {
        value: glyph,
        color: '#F8FAFC',
        align: 'center',
        width: String(textWidth),
        'wrap-count': String(wrapCount),
        position: '0 0 0.02',
      });
      button.appendChild(label);
      button.__codexrGlyph = glyph;
      button.__codexrTextWidth = textWidth;
      button.__codexrWrapCount = wrapCount;
      button.__codexrTextEntity = label;
      setText(button, glyph, '#F8FAFC', textWidth, wrapCount);
      return button;
    }

    function createHandle(id, width, height) {
      return createEntity('a-plane', {
        id,
        class: 'babiaxraycasterclass codexr-screen-handle',
        width: String(width),
        height: String(height),
        color: '#FFFFFF',
        material: 'color: #FFFFFF; opacity: 0.0; transparent: true; shader: flat;',
      });
    }

    function setButtonStyle(entity, opacity, fillColor, textColor) {
      if (!entity) {
        return;
      }
      entity.setAttribute('color', fillColor);
      setMaterial(entity, `color: ${fillColor}; opacity: ${opacity}; transparent: true; shader: flat;`);
      setText(entity, entity.__codexrGlyph || '', textColor, entity.__codexrTextWidth || 1, entity.__codexrWrapCount || 4);
    }

    function getControlLegend() {
      const lookAtLabel = state.lookAtCameraEnabled ? 'Purple look-at' : 'Pink look-at off';
      const followLabel = state.follow ? 'Orange follow active' : 'Blue follow';
      if (state.mode === 'minimized') {
        return `${lookAtLabel}\n${followLabel}\nGreen expand\nRed stop\nMove: sides drag\nDepth: wheel/thumbstick while dragging`;
      }
      return `${lookAtLabel}\n${followLabel}\nYellow minimize\nRed stop\nMove: sides drag\nResize: corners\nDepth: wheel/thumbstick while dragging`;
    }

    function getLegendLayoutMetrics(width, minimized) {
      const legendTextValue = getControlLegend();
      const legendLines = legendTextValue.split('\n');
      const maxLegendLineLength = legendLines.reduce((maxLength, line) => Math.max(maxLength, line.length), 0);
      const horizontalPadding = minimized ? 0.34 : 0.40;
      const verticalPadding = minimized ? 0.24 : 0.30;
      const lineHeight = minimized ? 0.22 : 0.25;
      const estimatedTextWidth = maxLegendLineLength * (minimized ? 0.075 : 0.080);
      const legendWidth = clamp(
        Math.max(width * 0.72, estimatedTextWidth + (horizontalPadding * 2)),
        minimized ? 3.0 : 3.4,
        minimized ? 5.8 : 7.2,
      );
      const legendHeight = clamp(
        (legendLines.length * lineHeight) + (verticalPadding * 2),
        minimized ? 1.55 : 2.10,
        minimized ? 2.65 : 3.35,
      );
      const textWidth = Math.max(2.4, legendWidth - (horizontalPadding * 2));
      const wrapCount = Math.max(maxLegendLineLength + 4, minimized ? 26 : 30);
      return {
        legendWidth,
        legendHeight,
        textWidth,
        wrapCount,
        horizontalPadding,
        verticalPadding,
      };
    }

    function setHandleStyle(entity, visible) {
      if (!entity) {
        return;
      }
      setMaterial(entity, `color: #FFFFFF; opacity: ${visible ? 0.34 : 0.0}; transparent: true; shader: flat;`);
    }

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
        id: 'codexrVirtualScreenRoot',
        position: formatVector(refs.config.anchoredPosition),
        rotation: formatVector(refs.config.anchoredRotation),
      });

      refs.frame = createEntity('a-plane', {
        id: 'codexrVirtualScreenFrame',
        color: '#0F172A',
        material: 'color: #0F172A; opacity: 0.86; transparent: true; shader: flat;',
        position: '0 0 -0.01',
      });

      refs.display = createEntity('a-video', {
        id: 'codexrVirtualScreenDisplay',
        src: '#codexrVirtualScreenVideo',
        position: '0 0 0.01',
        visible: 'false',
      });

      refs.interactionPlane = createEntity('a-plane', {
        id: 'codexrVirtualScreenSurface',
        class: 'babiaxraycasterclass codexr-screen-surface',
        color: '#FFFFFF',
        material: 'color: #FFFFFF; opacity: 0.001; transparent: true; side: double;',
        position: '0 0 0.02',
      });

      refs.dragPlane = createEntity('a-plane', {
        id: 'codexrVirtualScreenDragPlane',
        class: 'babiaxraycasterclass codexr-screen-drag-plane',
        width: '28',
        height: '18',
        color: '#FFFFFF',
        material: 'color: #FFFFFF; opacity: 0.001; transparent: true; side: double;',
        position: '0 0 0.015',
        visible: 'false',
      });

      refs.headerStrip = createEntity('a-plane', {
        id: 'codexrVirtualScreenHeader',
        color: '#0F172A',
        material: 'color: #0F172A; opacity: 0.0; transparent: true; shader: flat;',
        position: '0 0 0.03',
      });

      refs.status = createEntity('a-text', {
        id: 'codexrVirtualScreenStatus',
        align: 'center',
        color: '#F8FAFC',
        width: '8',
        value: refs.config.labels.idle,
        position: '0 0.95 0.04',
      });

      refs.legendRoot = createEntity('a-entity', {
        id: 'codexrVirtualScreenLegendRoot',
      });

      refs.legendPanel = createEntity('a-plane', {
        id: 'codexrVirtualScreenLegendPanel',
        class: 'babiaxraycasterclass codexr-screen-legend',
        color: '#0F172A',
        material: 'color: #0F172A; opacity: 0.72; transparent: true; shader: flat;',
      });

      refs.legendText = createEntity('a-text', {
        id: 'codexrVirtualScreenLegendText',
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

      refs.shareButton = createButton('codexrShareSource', '▣', 0.86, 0.86, 1.6, 4);
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
      refs.root.appendChild(refs.display);
      refs.root.appendChild(refs.interactionPlane);
      refs.root.appendChild(refs.dragPlane);
      refs.root.appendChild(refs.headerStrip);
      refs.root.appendChild(refs.status);
      refs.root.appendChild(refs.legendRoot);
      refs.root.appendChild(refs.shareButton);
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
        refs.interactionPlane,
        refs.headerStrip,
        refs.status,
        refs.legendRoot,
        refs.legendPanel,
        refs.legendText,
        refs.legendToggle,
        refs.shareButton,
        ...Object.values(refs.headerButtons),
        ...Object.values(refs.cornerHandles),
        ...Object.values(refs.edgeHandles),
      ].forEach(wireChromeVisibility);
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
      if (state.mode === 'active' || state.mode === 'minimized') {
        return '';
      }
      return state.statusMessage || refs.config.labels.idle;
    }

    function layout() {
      if (!refs.root) {
        return;
      }
      updateLegendSide();

      const minimized = state.mode === 'minimized';
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
      refs.display.setAttribute('width', String(width));
      refs.display.setAttribute('height', String(height));
      refs.interactionPlane.setAttribute('width', String(width));
      refs.interactionPlane.setAttribute('height', String(height));
      refs.dragPlane.setAttribute('width', String(Math.max(28, width * 5.5)));
      refs.dragPlane.setAttribute('height', String(Math.max(18, height * 5.5)));
      refs.headerStrip.setAttribute('width', String(frameWidth));
      refs.headerStrip.setAttribute('height', minimized ? '0.20' : '0.16');
      refs.headerStrip.setAttribute('position', minimized ? '0 0 0.03' : `0 ${headerY} 0.03`);

      refs.status.setAttribute('width', String(Math.max(6, width + 1.4)));
      refs.status.setAttribute('position', minimized ? '0 0.28 0.04' : '0 0.95 0.04');
      refs.shareButton.setAttribute('position', '0 0 0.04');
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

      const minimized = state.mode === 'minimized';
      const active = state.mode === 'active';
      const expanded = !minimized;
      const chromeVisible = state.chromeVisible || !!state.drag;
      const headerVisible = minimized || chromeVisible;
      const showShareButton = state.mode === 'idle';
      const showStatus = !active && !minimized;
      const showLegend = (active || minimized) && chromeVisible;

      setEntityVisible(refs.display, active && expanded);
      setEntityVisible(refs.frame, true);
      setEntityVisible(refs.interactionPlane, expanded);
      setEntityVisible(refs.dragPlane, !!state.drag);
      setEntityVisible(refs.headerStrip, headerVisible);
      setEntityVisible(refs.status, showStatus);
      setEntityVisible(refs.legendRoot, showLegend);
      setEntityVisible(refs.legendPanel, showLegend && !state.legendCollapsed);
      setEntityVisible(refs.legendText, showLegend && !state.legendCollapsed);
      setEntityVisible(refs.legendToggle, showLegend);
      setEntityVisible(refs.shareButton, showShareButton);
      Object.values(refs.headerButtons).forEach((button) => setEntityVisible(button, headerVisible));
      Object.values(refs.cornerHandles).forEach((handle) => setEntityVisible(handle, expanded && chromeVisible));
      Object.values(refs.edgeHandles).forEach((handle) => setEntityVisible(handle, chromeVisible));

      refs.status.setAttribute('value', getDisplayedStatusText());
      refs.legendText.setAttribute('value', getControlLegend());
      refs.legendToggle.__codexrGlyph = state.legendCollapsed ? '+' : '−';
      refs.headerButtons.lookAt.__codexrGlyph = state.lookAtCameraEnabled ? '◈' : '◇';
      refs.headerButtons.follow.__codexrGlyph = state.follow ? '◉' : '◎';
      refs.headerButtons.minimize.__codexrGlyph = minimized ? '□' : '—';
      refs.headerButtons.stop.__codexrGlyph = '×';

      setButtonStyle(refs.shareButton, 0.20, '#F8FAFC', '#0F172A');
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
    }

    function setMode(mode, message) {
      state.mode = mode;
      if (typeof message === 'string' && message.length > 0) {
        state.statusMessage = message;
      }
      if (mode === 'idle') {
        state.chromeVisible = false;
      }
      layout();
      refreshUi();
    }

    function buildCaptureOptions(intent) {
      const options = {
        video: {
          cursor: 'always',
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
        surfaceSwitching: 'include',
        selfBrowserSurface: 'exclude',
      };
      options.monitorTypeSurfaces = intent === 'screen' ? 'include' : 'exclude';
      return options;
    }

    async function requestCapture(intent) {
      if (!win.navigator?.mediaDevices?.getDisplayMedia) {
        throw new Error(refs.config.labels.unavailable);
      }
      return win.navigator.mediaDevices.getDisplayMedia(buildCaptureOptions(intent));
    }

    function classifyCaptureError(error) {
      const name = error?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        return refs.config.labels.permissionDenied;
      }
      if (name === 'AbortError') {
        return 'Screen sharing was cancelled.';
      }
      if (name === 'NotFoundError') {
        return 'No shareable screen, tab, or window is currently available.';
      }
      return error?.message || 'Unable to start screen sharing.';
    }

    function updateVideoSource(stream) {
      const video = ensureVideoSource();
      if (!video) {
        return;
      }
      video.srcObject = stream;
      const playResult = video.play();
      if (playResult && typeof playResult.catch === 'function') {
        playResult.catch(() => {});
      }
    }

    function releaseStream(stopTracks) {
      if (!state.stream) {
        return;
      }
      if (stopTracks && typeof state.stream.getTracks === 'function') {
        state.stream.getTracks().forEach((track) => track.stop());
      }
      state.stream = null;
      const video = ensureVideoSource();
      if (video) {
        video.srcObject = null;
      }
    }

    function stopCapture(message, options) {
      const shouldMinimize = options?.minimizeAfterStop === true;
      releaseStream(true);
      state.currentSourceLabel = '';
      if (shouldMinimize) {
        setMode('minimized', message || refs.config.labels.minimized);
      } else {
        setMode('idle', message || refs.config.labels.idle);
      }
    }

    function attachTrackEndedListener(stream) {
      const tracks = typeof stream?.getVideoTracks === 'function' ? stream.getVideoTracks() : [];
      const track = tracks[0];
      if (!track) {
        return;
      }
      track.addEventListener('ended', function () {
        stopCapture(refs.config.labels.sourceEnded, { minimizeAfterStop: false });
      }, { once: true });
    }

    async function startCapture(intent) {
      const previousStream = state.stream;
      const previousLabel = state.currentSourceLabel;
      state.lastIntent = intent;
      showChrome();
      setMode('idle', SOURCE_MESSAGES[intent].pending);

      try {
        const stream = await requestCapture(intent);
        if (previousStream && previousStream !== stream) {
          releaseStream(true);
        }
        state.stream = stream;
        updateVideoSource(stream);
        attachTrackEndedListener(stream);
        state.currentSourceLabel = SOURCE_MESSAGES[intent].active;
        setMode('active', SOURCE_MESSAGES[intent].active);
      } catch (error) {
        if (previousStream) {
          state.stream = previousStream;
          state.currentSourceLabel = previousLabel;
          setMode('active', previousLabel || refs.config.labels.idle);
          return;
        }
        state.currentSourceLabel = '';
        setMode('idle', classifyCaptureError(error));
      }
    }

    function switchSource() {
      void startCapture('screen');
    }
    function setAnchoredTransform() {
      if (!refs.root) {
        return;
      }
      refs.root.setAttribute('position', formatVector(refs.config.anchoredPosition));
      refs.root.setAttribute('rotation', formatVector(refs.config.anchoredRotation));
    }

    function scheduleAnimationFrame(callback) {
      const nextFrame = win.requestAnimationFrame || global.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };
      nextFrame(callback);
    }

    function enableFollow() {
      if (state.follow) {
        return;
      }
      const followTransform = captureFollowTransformFromCamera();
      if (!followTransform) {
        return;
      }
      state.followTransform = followTransform;
      state.follow = true;
      updateLegendSide();
      layout();
      ensureFollowLoop();
      showChrome();
      console.log('VIRTUAL_SCREEN: follow enabled', {
        position: state.followTransform?.position
          ? { x: state.followTransform.position.x, y: state.followTransform.position.y, z: state.followTransform.position.z }
          : null,
      });
      updateStatus(state.currentSourceLabel || 'Virtual screen follows the user.');
    }

    function disableFollow() {
      if (!state.follow) {
        return;
      }
      state.follow = false;
      state.followTransform = null;
      updateLegendSide();
      layout();
      if (state.lookAtCameraEnabled) {
        ensureFaceCameraLoop();
      }
      showChrome();
      console.log('VIRTUAL_SCREEN: follow disabled');
      updateStatus(state.currentSourceLabel || 'Virtual screen anchored in the scene.');
    }

    function toggleFollow() {
      if (state.follow) {
        disableFollow();
      } else {
        enableFollow();
      }
    }

    function recenter() {
      if (!refs.root) {
        return;
      }
      if (state.follow) {
        state.followTransform = captureFollowTransformFromCamera();
        applyFollowTransform();
      } else {
        const scene = getScene();
        if (scene) {
          scene.appendChild(refs.root);
        }
        setAnchoredTransform();
        if (state.lookAtCameraEnabled) {
          applyFaceCameraOrientation();
        }
      }
      showChrome();
      updateStatus(state.currentSourceLabel || 'Virtual screen recentered.');
    }

    function adjustSize(direction) {
      const nextIndex = clamp(findClosestSizeIndex(state.screenWidth) + direction, 0, refs.config.sizeSteps.length - 1);
      state.sizeIndex = nextIndex;
      state.screenWidth = refs.config.sizeSteps[nextIndex];
      layout();
      refreshUi();
      showChrome();
      updateStatus(state.currentSourceLabel || 'Virtual screen size updated.');
    }

    function minimize() {
      setMode('minimized', refs.config.labels.minimized);
    }

    function expand() {
      if (state.stream) {
        setMode('active', state.currentSourceLabel || refs.config.labels.idle);
      } else {
        setMode('idle', refs.config.labels.idle);
      }
      showChrome();
    }

    function getWorldPosition(entity) {
      if (!entity?.object3D || !global.THREE) {
        return null;
      }
      const vector = new global.THREE.Vector3();
      entity.object3D.getWorldPosition(vector);
      return vector;
    }

    function getCameraWorldPosition() {
      if (!global.THREE) {
        return null;
      }
      const scene = getScene();
      if (scene?.camera?.getWorldPosition) {
        const vector = new global.THREE.Vector3();
        scene.camera.getWorldPosition(vector);
        return vector;
      }
      const cameraEntity = getDocument()?.querySelector('a-camera, [camera]');
      return getWorldPosition(cameraEntity) || getWorldPosition(getFollowAnchor());
    }

    function getWorldQuaternion(entity) {
      if (!entity?.object3D || !global.THREE) {
        return null;
      }
      const quaternion = new global.THREE.Quaternion();
      entity.object3D.getWorldQuaternion(quaternion);
      return quaternion;
    }

    function applyWorldTransform(entity, worldPosition, worldQuaternion) {
      if (!entity?.object3D?.parent || !global.THREE || !worldPosition?.clone || !worldQuaternion?.clone) {
        return false;
      }
      const parent = entity.object3D.parent;
      parent.updateMatrixWorld?.(true);

      const localPosition = worldPosition.clone();
      parent.worldToLocal(localPosition);

      const parentQuaternion = new global.THREE.Quaternion();
      parent.getWorldQuaternion(parentQuaternion);
      const localQuaternion = parentQuaternion.clone().invert().multiply(worldQuaternion.clone());

      entity.object3D.position.copy(localPosition);
      entity.object3D.quaternion.copy(localQuaternion);
      return true;
    }

    function updateLegendSide() {
      if (!refs.root?.object3D || !global.THREE) {
        return false;
      }
      const cameraWorldPosition = getCameraWorldPosition();
      const cameraWorldQuaternion = getCameraWorldQuaternion();
      const rootWorldPosition = getWorldPosition(refs.root);
      if (!cameraWorldPosition?.clone || !cameraWorldQuaternion?.clone || !rootWorldPosition?.clone) {
        return false;
      }

      const screenInViewSpace = rootWorldPosition.clone()
        .sub(cameraWorldPosition)
        .applyQuaternion(cameraWorldQuaternion.clone().invert());
      const legendSwitchThreshold = 0.28;
      const desiredSide = screenInViewSpace.x > legendSwitchThreshold
        ? 'left'
        : screenInViewSpace.x < -legendSwitchThreshold
          ? 'right'
          : state.legendSide;

      if (desiredSide === state.legendSide) {
        return false;
      }
      state.legendSide = desiredSide;
      return true;
    }

    function applyFaceCameraOrientation() {
      if (!refs.root?.object3D || !global.THREE) {
        return false;
      }
      const cameraWorldPosition = getCameraWorldPosition();
      const rootWorldPosition = getWorldPosition(refs.root);
      if (!cameraWorldPosition?.clone || !rootWorldPosition?.clone) {
        return false;
      }
      const targetWorldQuaternion = computeFaceUserQuaternion(rootWorldPosition, cameraWorldPosition);
      if (!targetWorldQuaternion?.clone) {
        return false;
      }
      const applied = applyWorldTransform(refs.root, rootWorldPosition, targetWorldQuaternion);
      if (applied && updateLegendSide()) {
        layout();
      }
      return applied;
    }

    function computeFaceUserQuaternion(screenWorldPosition, cameraWorldPosition) {
      if (!global.THREE || !screenWorldPosition?.clone || !cameraWorldPosition?.clone) {
        return null;
      }

      const forward = cameraWorldPosition.clone().sub(screenWorldPosition);
      if (forward.lengthSq() < 0.000001) {
        return getWorldQuaternion(refs.root);
      }
      forward.normalize();

      let referenceUp = new global.THREE.Vector3(0, 1, 0);
      let right = new global.THREE.Vector3().crossVectors(referenceUp, forward);
      if (right.lengthSq() < 0.000001) {
        referenceUp = new global.THREE.Vector3(1, 0, 0);
        right = new global.THREE.Vector3().crossVectors(referenceUp, forward);
      }
      if (right.lengthSq() < 0.000001) {
        referenceUp = new global.THREE.Vector3(0, 0, 1);
        right = new global.THREE.Vector3().crossVectors(referenceUp, forward);
      }
      right.normalize();

      const up = new global.THREE.Vector3().crossVectors(forward, right).normalize();
      const basis = new global.THREE.Matrix4().makeBasis(right, up, forward);
      return new global.THREE.Quaternion().setFromRotationMatrix(basis);
    }

    function captureFollowTransformFromCamera() {
      if (!refs.root?.object3D || !global.THREE) {
        return null;
      }
      const cameraWorldPosition = getCameraWorldPosition();
      const cameraWorldQuaternion = getCameraWorldQuaternion();
      const rootWorldPosition = getWorldPosition(refs.root);
      if (!cameraWorldPosition?.clone || !cameraWorldQuaternion?.clone || !rootWorldPosition?.clone) {
        return null;
      }

      const inverseCameraQuaternion = cameraWorldQuaternion.clone().invert();
      return {
        position: rootWorldPosition.clone().sub(cameraWorldPosition).applyQuaternion(inverseCameraQuaternion.clone()),
        distance: rootWorldPosition.distanceTo(cameraWorldPosition),
      };
    }

    function applyFollowTransform() {
      if (!state.followTransform?.position?.clone) {
        return false;
      }
      const cameraWorldPosition = getCameraWorldPosition();
      const cameraWorldQuaternion = getCameraWorldQuaternion();
      if (!cameraWorldPosition?.clone || !cameraWorldQuaternion?.clone) {
        return false;
      }

      const targetWorldPosition = state.followTransform.position.clone()
        .applyQuaternion(cameraWorldQuaternion.clone())
        .add(cameraWorldPosition.clone());
      const targetWorldQuaternion = computeFaceUserQuaternion(targetWorldPosition, cameraWorldPosition);
      const applied = applyWorldTransform(refs.root, targetWorldPosition, targetWorldQuaternion);
      if (applied && updateLegendSide()) {
        layout();
      }
      return applied;
    }

    function updateFollow() {
      if (!state.follow || !state.followTransform) {
        state.followLoopActive = false;
        return;
      }
      applyFollowTransform();
      scheduleAnimationFrame(updateFollow);
    }

    function ensureFollowLoop() {
      if (state.followLoopActive) {
        return;
      }
      state.followLoopActive = true;
      scheduleAnimationFrame(updateFollow);
    }

    function updateFaceCamera() {
      if (state.follow || !state.lookAtCameraEnabled || !refs.root?.isConnected) {
        state.faceCameraLoopActive = false;
        return;
      }
      applyFaceCameraOrientation();
      scheduleAnimationFrame(updateFaceCamera);
    }

    function ensureFaceCameraLoop() {
      if (state.faceCameraLoopActive || !state.lookAtCameraEnabled) {
        return;
      }
      state.faceCameraLoopActive = true;
      scheduleAnimationFrame(updateFaceCamera);
    }

    function getRaycasterIntersection(entity, pointerEl) {
      const raycaster = pointerEl?.components?.raycaster;
      if (!raycaster || typeof raycaster.getIntersection !== 'function') {
        return null;
      }
      return raycaster.getIntersection(entity);
    }

    function getPointerRay(pointerEl) {
      const raycasterComponent = pointerEl?.components?.raycaster;
      const raycaster = raycasterComponent?.raycaster;
      if (!raycaster?.ray) {
        return null;
      }
      return raycaster.ray;
    }

    function getPointerEntity(evt) {
      return evt?.detail?.cursorEl || evt?.detail?.raycasterEl || null;
    }

    function getPointerType(pointerEl) {
      if (!pointerEl) {
        return 'unknown';
      }
      const cursorData = pointerEl.components?.cursor?.data;
      if (cursorData?.rayOrigin === 'mouse') {
        return 'mouse';
      }
      const cursorAttr = typeof pointerEl.getAttribute === 'function' ? pointerEl.getAttribute('cursor') : null;
      if (cursorAttr?.rayOrigin === 'mouse') {
        return 'mouse';
      }
      return 'controller';
    }

    function getWorldPointFromEvent(evt, pointerEl) {
      if (evt?.detail?.intersection?.point && typeof evt.detail.intersection.point.clone === 'function') {
        return evt.detail.intersection.point.clone();
      }
      const raycasterIntersection = getRaycasterIntersection(refs.interactionPlane, pointerEl);
      if (raycasterIntersection?.point && typeof raycasterIntersection.point.clone === 'function') {
        return raycasterIntersection.point.clone();
      }
      return null;
    }

    function worldToParentLocal(worldPoint) {
      if (!refs.root?.object3D?.parent || !worldPoint?.clone) {
        return null;
      }
      const localPoint = worldPoint.clone();
      refs.root.object3D.parent.worldToLocal(localPoint);
      return localPoint;
    }

    function getDragPlaneNormal() {
      if (!global.THREE) {
        return null;
      }
      const referenceQuaternion = getCameraWorldQuaternion() || getWorldQuaternion(refs.root);
      if (!referenceQuaternion?.clone) {
        return null;
      }
      return new global.THREE.Vector3(0, 0, -1).applyQuaternion(referenceQuaternion.clone()).normalize();
    }

    function buildDragPlane(worldPoint, planeNormal) {
      if (!global.THREE || !worldPoint?.clone) {
        return null;
      }
      const normal = planeNormal?.clone ? planeNormal.clone() : getDragPlaneNormal();
      if (!normal?.clone) {
        return null;
      }
      return new global.THREE.Plane().setFromNormalAndCoplanarPoint(normal, worldPoint.clone());
    }

    function getDragDepthAxis(rootWorldPosition) {
      if (!global.THREE || !rootWorldPosition?.clone) {
        return null;
      }
      const cameraWorldPosition = getCameraWorldPosition();
      if (!cameraWorldPosition?.clone) {
        return null;
      }
      const axis = rootWorldPosition.clone().sub(cameraWorldPosition);
      if (axis.lengthSq() === 0) {
        return null;
      }
      return axis.normalize();
    }

    function getSurfaceIntersection(pointerEl) {
      if (state.drag?.plane && global.THREE) {
        const ray = getPointerRay(pointerEl);
        if (ray?.intersectPlane) {
          const worldPoint = new global.THREE.Vector3();
          const hit = ray.intersectPlane(state.drag.plane, worldPoint);
          if (hit) {
            return worldPoint.clone();
          }
          console.log('VIRTUAL_SCREEN: drag intersection missing');
          return null;
        }
      }

      const intersection = getRaycasterIntersection(refs.interactionPlane, pointerEl);
      if (intersection?.point && typeof intersection.point.clone === 'function') {
        return intersection.point.clone();
      }
      return null;
    }

    function applyResize(intersectionPoint) {
      if (!refs.root?.object3D || !global.THREE || !intersectionPoint?.clone) {
        return;
      }
      const localPoint = refs.root.object3D.worldToLocal(intersectionPoint.clone());
      const targetWidth = Math.max(
        Math.abs(localPoint.x) * 2,
        Math.abs(localPoint.y) * 2 * refs.config.aspectRatio,
      );
      state.screenWidth = clamp(targetWidth, refs.config.minWidth, refs.config.maxWidth);
      state.sizeIndex = findClosestSizeIndex(state.screenWidth);
      layout();
      refreshUi();
    }

    function applyDragRootWorldPosition(worldPosition) {
      const localPosition = worldToParentLocal(worldPosition);
      if (!localPosition) {
        return false;
      }
      refs.root.object3D.position.copy(localPosition);
      return true;
    }

    function applyMove(intersectionPoint) {
      if (!state.drag || !intersectionPoint?.clone) {
        return;
      }
      const referencePoint = state.drag.currentStartPoint || state.drag.startPoint;
      const referenceRootPosition = state.drag.currentStartRootWorldPosition || state.drag.startRootWorldPosition;
      const targetWorldPosition = intersectionPoint.clone().sub(referencePoint).add(referenceRootPosition);
      if (!applyDragRootWorldPosition(targetWorldPosition)) {
        return;
      }
      if (!state.follow && state.lookAtCameraEnabled) {
        applyFaceCameraOrientation();
      }
      if (updateLegendSide()) {
        layout();
      }
      console.log('VIRTUAL_SCREEN: move update', {
        x: refs.root.object3D.position.x,
        y: refs.root.object3D.position.y,
        z: refs.root.object3D.position.z,
        handle: state.drag?.handleKey || 'unknown',
      });
    }

    function adjustDragDepth(delta) {
      if (!state.drag || state.drag.kind !== 'move' || !state.drag.depthAxis?.clone) {
        return;
      }
      state.drag.targetDepthOffset += delta;
      console.log('VIRTUAL_SCREEN: depth update', {
        delta,
        target: state.drag.targetDepthOffset,
        current: state.drag.currentDepthOffset,
      });
    }

    function updateDragDepthSmoothing() {
      if (!state.drag || state.drag.kind !== 'move' || !state.drag.depthAxis?.clone) {
        return;
      }
      const depthDelta = state.drag.targetDepthOffset - state.drag.currentDepthOffset;
      if (Math.abs(depthDelta) < 0.0005) {
        state.drag.currentDepthOffset = state.drag.targetDepthOffset;
      } else {
        state.drag.currentDepthOffset += depthDelta * 0.18;
      }

      const currentDepthVector = state.drag.depthAxis.clone().multiplyScalar(state.drag.currentDepthOffset);
      state.drag.currentStartPoint = state.drag.startPoint.clone().add(currentDepthVector);
      state.drag.currentStartRootWorldPosition = state.drag.startRootWorldPosition.clone().add(currentDepthVector);
      state.drag.plane = buildDragPlane(state.drag.currentStartPoint, state.drag.planeNormal);
    }

    function handleWheelDuringDrag(evt) {
      if (!state.drag || state.drag.kind !== 'move' || state.drag.pointerType !== 'mouse') {
        return;
      }
      const direction = Math.sign(evt.deltaY || 0);
      if (!direction) {
        return;
      }
      evt.preventDefault?.();
      adjustDragDepth(direction * refs.config.dragDepthStep);
    }

    function handleThumbstickDuringDrag(evt) {
      if (!state.drag || state.drag.kind !== 'move' || state.drag.pointerType !== 'controller') {
        return;
      }
      const pointerEl = state.drag.pointerEl;
      if (pointerEl?.id && evt.currentTarget?.id && evt.currentTarget.id !== pointerEl.id) {
        return;
      }
      const axisY = typeof evt.detail?.y === 'number'
        ? evt.detail.y
        : Array.isArray(evt.detail?.axis) && typeof evt.detail.axis[1] === 'number'
          ? evt.detail.axis[1]
          : null;
      if (typeof axisY !== 'number' || Math.abs(axisY) < 0.15) {
        return;
      }
      evt.preventDefault?.();
      evt.stopPropagation?.();
      adjustDragDepth(axisY * refs.config.controllerDepthStep);
    }

    function updateDrag() {
      if (!state.drag) {
        state.dragLoopActive = false;
        return;
      }
      updateDragDepthSmoothing();
      const intersectionPoint = getSurfaceIntersection(state.drag.pointerEl);
      if (!intersectionPoint) {
        scheduleAnimationFrame(updateDrag);
        return;
      }
      if (state.drag.kind === 'resize') {
        applyResize(intersectionPoint);
      } else {
        applyMove(intersectionPoint);
      }
      scheduleAnimationFrame(updateDrag);
    }

    function startDrag(kind, handleKey, evt) {
      if ((state.mode === 'minimized' && kind === 'resize') || !global.THREE || !refs.root?.object3D) {
        return;
      }
      if (state.follow) {
        disableFollow();
      }
      const pointerEl = getPointerEntity(evt);
      const startPoint = getWorldPointFromEvent(evt, pointerEl);
      const rootWorldPosition = getWorldPosition(refs.root);
      const planeNormal = getDragPlaneNormal();
      if (!pointerEl || !startPoint || !rootWorldPosition) {
        return;
      }
      state.drag = {
        kind,
        handleKey,
        pointerEl,
        pointerType: getPointerType(pointerEl),
        startPoint,
        startRootWorldPosition: rootWorldPosition,
        currentStartPoint: startPoint.clone(),
        currentStartRootWorldPosition: rootWorldPosition.clone(),
        planeNormal,
        plane: buildDragPlane(startPoint, planeNormal),
        depthAxis: kind === 'move' ? getDragDepthAxis(rootWorldPosition) : null,
        currentDepthOffset: 0,
        targetDepthOffset: 0,
      };
      console.log('VIRTUAL_SCREEN: drag start', {
        kind,
        handleKey,
        pointerType: state.drag.pointerType,
        startPoint: { x: startPoint.x, y: startPoint.y, z: startPoint.z },
      });
      if (!state.dragLoopActive) {
        state.dragLoopActive = true;
        scheduleAnimationFrame(updateDrag);
      }
      showChrome();
      setEntityVisible(refs.dragPlane, true);
      updateStatus(kind === 'resize' ? refs.config.labels.resize : refs.config.labels.move);
    }

    function endDrag() {
      if (!state.drag) {
        return;
      }
      console.log('VIRTUAL_SCREEN: drag end');
      state.drag = null;
      setEntityVisible(refs.dragPlane, false);
      if (!state.follow && state.lookAtCameraEnabled) {
        applyFaceCameraOrientation();
        ensureFaceCameraLoop();
      }
      updateStatus(state.currentSourceLabel || (state.mode === 'minimized' ? refs.config.labels.minimized : refs.config.labels.idle));
      scheduleChromeHide();
    }

    function wireCleanupHandlers() {
      if (refs.cleanupBound || !win.addEventListener) {
        return;
      }
      refs.cleanupBound = true;
      win.addEventListener('mouseup', endDrag);
      win.addEventListener('blur', endDrag);
    }

    function wireDepthInputHandlers() {
      if (refs.inputHandlersBound || !win.addEventListener) {
        return;
      }
      refs.inputHandlersBound = true;
      win.addEventListener('wheel', handleWheelDuringDrag, { passive: false });
      const scene = getScene();
      if (scene) {
        scene.addEventListener('thumbstickmoved', handleThumbstickDuringDrag);
      }
      const controllerSelector = '#rightController, #leftController, [laser-controls], [tracked-controls], [oculus-touch-controls], [vive-controls], [windows-motion-controls], [generic-tracked-controller-controls]';
      refs.controllerTargets = Array.from(getDocument()?.querySelectorAll(controllerSelector) || []);
      refs.controllerTargets.forEach((controller) => {
        controller.addEventListener('thumbstickmoved', handleThumbstickDuringDrag);
      });
    }

    function wireControlHandlers() {
      refs.shareButton.addEventListener('click', function () {
        void startCapture('screen');
      });
      refs.headerButtons.lookAt.addEventListener('click', function () {
        toggleLookAtCamera();
      });
      refs.headerButtons.follow.addEventListener('click', function () {
        toggleFollow();
      });
      refs.legendToggle.addEventListener('click', function () {
        toggleLegend();
      });
      refs.headerButtons.minimize.addEventListener('click', function () {
        if (state.mode === 'minimized') {
          expand();
        } else {
          minimize();
        }
      });
      refs.headerButtons.stop.addEventListener('click', function () {
        stopCapture('Sharing stopped.', { minimizeAfterStop: true });
        showChrome();
      });
    }

    function wireDragHandlers() {
      Object.entries(refs.cornerHandles).forEach(([key, handle]) => {
        handle.addEventListener('mousedown', function (evt) {
          startDrag('resize', key, evt);
        });
        handle.addEventListener('mouseup', endDrag);
      });
      Object.entries(refs.edgeHandles).forEach(([key, handle]) => {
        handle.addEventListener('mousedown', function (evt) {
          startDrag('move', key, evt);
        });
        handle.addEventListener('mouseup', endDrag);
      });
      const scene = getScene();
      if (scene) {
        scene.addEventListener('mouseup', endDrag);
      }
    }

    function finishInitialization() {
      ensureVideoSource();
      state.screenWidth = refs.config.sizeSteps[clamp(refs.config.defaultSizeIndex || DEFAULT_CONFIG.defaultSizeIndex, 0, refs.config.sizeSteps.length - 1)];
      state.sizeIndex = findClosestSizeIndex(state.screenWidth);
      createUi();
      setAnchoredTransform();
      if (state.lookAtCameraEnabled) {
        applyFaceCameraOrientation();
      }
      layout();
      setMode('idle', refs.config.labels.idle);
      if (state.lookAtCameraEnabled) {
        ensureFaceCameraLoop();
      }
      state.initialized = true;
    }

    function init(userConfig) {
      refs.config = mergeConfig(userConfig || win.__CODEXR_VIRTUAL_SCREEN_CONFIG__);
      if (!refs.config.enabled) {
        return api;
      }
      const scene = getScene();
      if (!scene || state.initialized) {
        return api;
      }
      const start = function () {
        finishInitialization();
      };
      if (scene.hasLoaded) {
        start();
      } else {
        scene.addEventListener('loaded', start, { once: true });
      }
      return api;
    }

    function autoInit() {
      init(win.__CODEXR_VIRTUAL_SCREEN_CONFIG__);
    }

    const api = {
      init,
      autoInit,
      buildCaptureOptions,
      requestCapture,
      classifyCaptureError,
      startCapture,
      stopCapture,
      switchSource,
      minimize,
      expand,
      toggleLookAtCamera,
      toggleFollow,
      recenter,
      adjustSize,
      getState() {
        return {
          mode: state.mode,
          lookAtCameraEnabled: state.lookAtCameraEnabled,
          follow: state.follow,
          chromeVisible: state.chromeVisible,
          sizeIndex: state.sizeIndex,
          screenWidth: state.screenWidth,
          currentSourceLabel: state.currentSourceLabel,
          lastIntent: state.lastIntent,
          initialized: state.initialized,
          dragActive: !!state.drag,
            dragPointerType: state.drag?.pointerType || null,
            dragDepthOffset: state.drag?.currentDepthOffset || 0,
            dragTargetDepthOffset: state.drag?.targetDepthOffset || 0,
            legendCollapsed: state.legendCollapsed,
            legendSide: state.legendSide,
            followTrackingActive: state.follow && !!state.followTransform,
            faceCameraTrackingActive: !state.follow && !state.drag && state.faceCameraLoopActive,
            hasFollowTransform: !!state.followTransform,
          };
        },
    };

    api.DEFAULT_CONFIG = DEFAULT_CONFIG;
    api.mergeConfig = mergeConfig;
    api.createRuntime = createRuntime;
    return api;
  }

  const runtime = createRuntime(global);
  runtime.DEFAULT_CONFIG = DEFAULT_CONFIG;
  runtime.mergeConfig = mergeConfig;
  runtime.createRuntime = createRuntime;
  return runtime;
});





























