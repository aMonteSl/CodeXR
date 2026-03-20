(function (factory) {
  const root = typeof globalThis !== 'undefined'
    ? globalThis
    : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
        ? window
        : this;

  factory(root);
})(function (root) {
  'use strict';

  function registerComponent(AFRAME) {
    if (!AFRAME || AFRAME.components['codexr-multi-screen-manager']) {
      return;
    }

    AFRAME.registerComponent('codexr-multi-screen-manager', {
      schema: {
        maxScreens: { type: 'number', default: 6 },
        wall: { type: 'string', default: 'west' },
        showPanel: { type: 'boolean', default: true },
      },

      init: function () {
        this.nextVscreenIndex = 0;
        this.nextManagedInstance = 1;
        this.nextSpawnSlot = 0;

        this.activeScreens = new Map();
        this.remoteScreens = new Map();

        this.panelEntriesRoot = null;
        this.panelFooter = null;

        this.runtimeFactory = root.CodeXRVirtualScreenRuntime || null;
        this.collaborationClient = root.CodeXRCollaborationRuntime?.getClient?.(root) || null;

        if (this.data.showPanel !== false) {
          this.createWallControls();
        }
        this.registerDefaultScreen();
        this.collaborationClient?.registerManager?.(this);

        this.panelRefreshHandle = root.setInterval(() => this.refreshPanel(), 350);
      },

      remove: function () {
        if (this.panelRefreshHandle) {
          root.clearInterval(this.panelRefreshHandle);
          this.panelRefreshHandle = null;
        }
        this.collaborationClient?.unregisterManager?.(this);
      },

      registerDefaultScreen: function () {
        if (!this.runtimeFactory || typeof this.runtimeFactory.getState !== 'function') {
          return;
        }
        this.ensureScreenRecord('default', this.runtimeFactory, false);
      },

      getRuntimeRootByInstance: function (instanceId) {
        const rootId = instanceId === 'default'
          ? 'codexrVirtualScreenRoot'
          : `codexrVirtualScreenRoot-${instanceId}`;
        return root.document?.getElementById(rootId) || null;
      },

      getRuntimeVideoByInstance: function (instanceId) {
        const videoId = instanceId === 'default'
          ? 'codexrVirtualScreenVideo'
          : `codexrVirtualScreenVideo-${instanceId}`;
        return root.document?.getElementById(videoId) || null;
      },

      getNextVscreenIndex: function () {
        const index = this.nextVscreenIndex;
        this.nextVscreenIndex += 1;
        return index;
      },

      ensureScreenRecord: function (instanceId, runtime, managed) {
        const existing = this.activeScreens.get(instanceId);
        if (existing) {
          if (runtime) {
            existing.runtime = runtime;
            existing.displayName = runtime.getState?.().displayName || existing.displayName;
          }
          return existing;
        }

        const vscreenIndex = this.getNextVscreenIndex();
        const record = {
          instanceId,
          runtime,
          managed,
          collaborationSource: runtime?.getState?.().collaborationSource || 'local',
          vscreenIndex,
          displayName: `vscreen ${vscreenIndex}`,
        };

        this.activeScreens.set(instanceId, record);
        return record;
      },

      createWallControls: function () {
        const controlsRoot = document.createElement('a-entity');
        controlsRoot.setAttribute('id', 'codexrWallControls');
        controlsRoot.setAttribute('position', '-8 2.2 -10.5');
        controlsRoot.setAttribute('rotation', '0 90 0');

        const panel = document.createElement('a-plane');
        panel.setAttribute('width', '4.2');
        panel.setAttribute('height', '3.8');
        panel.setAttribute('color', '#0f172a');
        panel.setAttribute('material', 'opacity: 0.86; transparent: true; shader: flat;');

        const title = document.createElement('a-text');
        title.setAttribute('value', 'Virtual Screens Control');
        title.setAttribute('align', 'center');
        title.setAttribute('color', '#e2e8f0');
        title.setAttribute('width', '4.5');
        title.setAttribute('position', '0 1.65 0.03');

        const addButton = document.createElement('a-plane');
        addButton.setAttribute('id', 'codexrAddScreenButton');
        addButton.setAttribute('class', 'babiaxraycasterclass');
        addButton.setAttribute('width', '1.7');
        addButton.setAttribute('height', '0.3');
        addButton.setAttribute('color', '#1d4ed8');
        addButton.setAttribute('position', '0 1.2 0.03');
        addButton.setAttribute('text', 'value: Add Screen; align: center; color: #e2e8f0; width: 3.3;');

        const activeTitle = document.createElement('a-text');
        activeTitle.setAttribute('value', 'Active Screens');
        activeTitle.setAttribute('align', 'left');
        activeTitle.setAttribute('color', '#93c5fd');
        activeTitle.setAttribute('width', '3.8');
        activeTitle.setAttribute('position', '-1.95 0.95 0.03');

        this.panelEntriesRoot = document.createElement('a-entity');
        this.panelEntriesRoot.setAttribute('id', 'codexrScreensEntries');
        this.panelEntriesRoot.setAttribute('position', '-0.62 0.34 0.03');

        const spawnArea = document.createElement('a-plane');
        spawnArea.setAttribute('id', 'codexrSpawnAreaInPanel');
        spawnArea.setAttribute('width', '1.25');
        spawnArea.setAttribute('height', '2.7');
        spawnArea.setAttribute('color', '#0b1220');
        spawnArea.setAttribute('material', 'opacity: 0.74; transparent: true; shader: flat;');
        spawnArea.setAttribute('position', '1.38 -0.2 0.03');

        const spawnTitle = document.createElement('a-text');
        spawnTitle.setAttribute('value', 'Spawn Zone');
        spawnTitle.setAttribute('align', 'center');
        spawnTitle.setAttribute('color', '#bfdbfe');
        spawnTitle.setAttribute('width', '2.1');
        spawnTitle.setAttribute('position', '1.38 1.0 0.04');

        const spawnHint = document.createElement('a-text');
        spawnHint.setAttribute('value', 'Add and Bring stack here');
        spawnHint.setAttribute('align', 'center');
        spawnHint.setAttribute('color', '#cbd5e1');
        spawnHint.setAttribute('width', '1.9');
        spawnHint.setAttribute('position', '1.38 -1.45 0.04');

        this.panelFooter = document.createElement('a-text');
        this.panelFooter.setAttribute('value', 'Focus: recenter. Bring: move target to spawn zone.');
        this.panelFooter.setAttribute('align', 'center');
        this.panelFooter.setAttribute('color', '#cbd5e1');
        this.panelFooter.setAttribute('width', '4.0');
        this.panelFooter.setAttribute('position', '0 -1.7 0.03');

        addButton.addEventListener('click', () => this.addScreen());

        controlsRoot.appendChild(panel);
        controlsRoot.appendChild(title);
        controlsRoot.appendChild(addButton);
        controlsRoot.appendChild(activeTitle);
        controlsRoot.appendChild(this.panelEntriesRoot);
        controlsRoot.appendChild(spawnArea);
        controlsRoot.appendChild(spawnTitle);
        controlsRoot.appendChild(spawnHint);
        controlsRoot.appendChild(this.panelFooter);
        this.el.appendChild(controlsRoot);
      },

      makeButton: function (label, color, position, width, onClick) {
        const btn = document.createElement('a-plane');
        btn.setAttribute('class', 'babiaxraycasterclass');
        btn.setAttribute('width', String(width || 0.55));
        btn.setAttribute('height', '0.2');
        btn.setAttribute('color', color);
        btn.setAttribute('position', position);
        btn.setAttribute('text', `value: ${label}; align: center; color: #f8fafc; width: 2.2;`);
        btn.addEventListener('click', onClick);
        return btn;
      },

      clearChildren: function (entity) {
        if (!entity) {
          return;
        }
        while (entity.firstChild) {
          entity.removeChild(entity.firstChild);
        }
      },

      refreshPanel: function () {
        if (!this.panelEntriesRoot) {
          return;
        }
        this.clearChildren(this.panelEntriesRoot);

        const entries = Array.from(this.activeScreens.values())
          .sort((a, b) => a.vscreenIndex - b.vscreenIndex)
          .slice(0, 8);

        entries.forEach((entry, index) => {
          const row = document.createElement('a-entity');
          row.setAttribute('position', `0 ${0.62 - (index * 0.31)} 0`);

          const bg = document.createElement('a-plane');
          bg.setAttribute('width', '2.5');
          bg.setAttribute('height', '0.25');
          bg.setAttribute('color', '#1e293b');
          bg.setAttribute('material', 'opacity: 0.82; transparent: true; shader: flat;');

          const state = entry.runtime?.getState?.();
          const summary = `${entry.displayName} | ${state?.mode || 'idle'}`;

          const text = document.createElement('a-text');
          text.setAttribute('value', summary);
          text.setAttribute('align', 'left');
          text.setAttribute('color', '#dbeafe');
          text.setAttribute('width', '2.3');
          text.setAttribute('position', '-1.15 -0.03 0.02');

          const bringBtn = this.makeButton('Bring', '#2563eb', '0.82 0 0.02', 0.52, () => {
            this.repositionScreenToSpawnZone(entry.instanceId);
          });

          const focusBtn = this.makeButton('Focus', '#0f766e', '1.38 0 0.02', 0.52, () => {
            entry.runtime?.recenter?.();
          });

          const removeBtn = this.makeButton('Del', '#b91c1c', '1.94 0 0.02', 0.44, () => {
            this.destroyScreen(entry.instanceId);
            this.refreshPanel();
          });

          row.appendChild(bg);
          row.appendChild(text);
          row.appendChild(bringBtn);
          row.appendChild(focusBtn);
          row.appendChild(removeBtn);
          this.panelEntriesRoot.appendChild(row);
        });
      },

      getSpawnSlotPosition: function (slotIndex) {
        const normalized = Number(slotIndex || 0);
        return {
          x: -7.95,
          y: 3.15 - (normalized * 0.72),
          z: -9.45,
        };
      },

      getNextSpawnSlotPosition: function () {
        const slot = this.nextSpawnSlot % 4;
        this.nextSpawnSlot += 1;
        return this.getSpawnSlotPosition(slot);
      },

      getSceneSelector: function () {
        return root.document?.querySelector('#scene') ? '#scene' : 'a-scene';
      },

      getFollowAnchorSelector: function () {
        if (root.document?.querySelector('#rig')) {
          return '#rig';
        }
        if (root.document?.querySelector('#cameraRig')) {
          return '#cameraRig';
        }
        return '#rig';
      },

      buildRuntimeInitConfig: function (instanceId, options) {
        const sharedConfig = root.__CODEXR_VIRTUAL_SCREEN_CONFIG__ || {};
        const collaborationConfig = root.__CODEXR_COLLABORATION_CONFIG__ || {};
        const transform = options?.transform || {};
        const position = transform.position || options?.anchoredPosition || this.getNextSpawnSlotPosition();
        const rotation = transform.rotation || options?.anchoredRotation || { x: 0, y: 90, z: 0 };
        return {
          ...sharedConfig,
          enabled: true,
          broadcastEnabled: sharedConfig.broadcastEnabled !== false,
          collaborationEnabled: collaborationConfig.collaborationEnabled !== false,
          presenceEnabled: collaborationConfig.presenceEnabled !== false,
          cursorPresenceEnabled: collaborationConfig.cursorPresenceEnabled === true,
          signalingPath: sharedConfig.signalingPath || '/codexr-broadcast',
          roomSignalingPath: collaborationConfig.roomSignalingPath || '/codexr-room',
          sessionEndpoint: collaborationConfig.sessionEndpoint || '/api/collaboration/session',
          sceneSelector: sharedConfig.sceneSelector || this.getSceneSelector(),
          followAnchorSelector: sharedConfig.followAnchorSelector || this.getFollowAnchorSelector(),
          instanceId,
          screenId: instanceId,
          managedScreen: true,
          collaborationSource: options?.collaborationSource || 'local',
          displayName: options?.displayName || instanceId,
          videoElementId: `codexrVirtualScreenVideo-${instanceId}`,
          anchoredPosition: {
            x: Number(position.x) || 0,
            y: Number(position.y) || 0,
            z: Number(position.z) || 0,
          },
          anchoredRotation: {
            x: Number(rotation.x) || 0,
            y: Number(rotation.y) || 0,
            z: Number(rotation.z) || 0,
          },
          labels: {
            ...(sharedConfig.labels || {}),
            idle: options?.idleLabel || `${instanceId}: choose source independently.`,
          },
        };
      },

      createManagedRuntime: function (instanceId, options) {
        if (!this.runtimeFactory || typeof this.runtimeFactory.createRuntime !== 'function') {
          return null;
        }

        const runtime = this.runtimeFactory.createRuntime(root);
        runtime.init(this.buildRuntimeInitConfig(instanceId, options));
        if (options?.sharedState) {
          runtime.applySharedScreenState?.(options.sharedState, { source: 'manager-create' });
        }
        return runtime;
      },

      ensureRemoteScreen: function (sharedState) {
        if (!sharedState || sharedState.entityKind !== 'screen' || !sharedState.entityId) {
          return null;
        }
        if (sharedState.entityId === 'default') {
          const defaultRecord = this.activeScreens.get('default');
          defaultRecord?.runtime?.applySharedScreenState?.(sharedState, { source: 'manager-default' });
          return defaultRecord || null;
        }

        const existing = this.activeScreens.get(sharedState.entityId);
        if (existing) {
          existing.runtime?.applySharedScreenState?.(sharedState, { source: 'manager-existing' });
          existing.collaborationSource = 'remote';
          existing.displayName = sharedState.displayName || existing.displayName;
          this.remoteScreens.set(sharedState.entityId, existing);
          return existing;
        }

        const runtime = this.createManagedRuntime(sharedState.entityId, {
          collaborationSource: 'remote',
          displayName: sharedState.displayName || sharedState.entityId,
          transform: sharedState.transform || null,
          sharedState,
          idleLabel: `${sharedState.displayName || sharedState.entityId}: waiting for source.`,
        });
        if (!runtime) {
          return null;
        }

        const record = this.ensureScreenRecord(sharedState.entityId, runtime, true);
        record.collaborationSource = 'remote';
        record.displayName = sharedState.displayName || record.displayName;
        this.remoteScreens.set(sharedState.entityId, record);
        this.refreshPanel();
        return record;
      },

      removeRemoteScreen: function (screenId) {
        if (!screenId || screenId === 'default') {
          return;
        }
        const record = this.remoteScreens.get(screenId) || this.activeScreens.get(screenId);
        if (!record) {
          return;
        }
        this.destroyScreen(screenId, { remote: true });
        this.remoteScreens.delete(screenId);
      },

      applyCollaborationSnapshot: function (entities) {
        const screenStates = Array.isArray(entities)
          ? entities.filter((entity) => entity && entity.entityKind === 'screen')
          : [];
        const seen = new Set(['default']);

        screenStates.forEach((entity) => {
          seen.add(entity.entityId);
          if (entity.entityId === 'default') {
            this.activeScreens.get('default')?.runtime?.applySharedScreenState?.(entity, { source: 'snapshot' });
            return;
          }
          this.ensureRemoteScreen(entity);
        });

        Array.from(this.remoteScreens.keys()).forEach((screenId) => {
          if (!seen.has(screenId)) {
            this.removeRemoteScreen(screenId);
          }
        });
        this.refreshPanel();
      },

      addScreen: function () {
        if (this.activeScreens.size >= this.data.maxScreens) {
          return;
        }

        const instanceId = `managed-${this.nextManagedInstance}`;
        this.nextManagedInstance += 1;
        const runtime = this.createManagedRuntime(instanceId, {
          collaborationSource: 'local',
          displayName: `vscreen ${this.nextVscreenIndex}`,
        });
        if (!runtime) {
          return;
        }

        const record = this.ensureScreenRecord(instanceId, runtime, true);
        runtime.setDisplayName?.(record.displayName);
        this.refreshPanel();
      },

      destroyScreen: function (instanceId, options) {
        const record = this.activeScreens.get(instanceId);
        if (!record) {
          return;
        }

        if (instanceId !== 'default' && options?.remote !== true) {
          this.collaborationClient?.removeEntity?.('screen', instanceId);
        }

        try {
          if (typeof record.runtime?.destroy === 'function') {
            record.runtime.destroy();
          } else {
            record.runtime?.stopCapture?.('Screen removed.', { minimizeAfterStop: false });
          }
        } catch (_error) {
          // Ignore runtime stop errors and continue cleanup.
        }

        const rootEntity = this.getRuntimeRootByInstance(instanceId);
        if (rootEntity?.parentElement) {
          rootEntity.parentElement.removeChild(rootEntity);
        }

        const videoElement = this.getRuntimeVideoByInstance(instanceId);
        if (videoElement?.parentElement) {
          videoElement.parentElement.removeChild(videoElement);
        }

        this.activeScreens.delete(instanceId);
        this.remoteScreens.delete(instanceId);
      },

      repositionScreenToSpawnZone: function (instanceId) {
        const screenRoot = this.getRuntimeRootByInstance(instanceId);
        if (!screenRoot) {
          return;
        }

        const target = this.getNextSpawnSlotPosition();
        screenRoot.setAttribute('position', `${target.x} ${target.y} ${target.z}`);
        const rotation = screenRoot.getAttribute('rotation') || { x: 0, y: 90, z: 0 };
        this.collaborationClient?.sendEntityTransform?.({
          entityKind: 'screen',
          entityId: instanceId,
          transform: {
            position: target,
            rotation: {
              x: Number(rotation.x) || 0,
              y: Number(rotation.y) || 0,
              z: Number(rotation.z) || 0,
            },
          },
        });
      },

      tickBehavior: function () {
        // No grouped behavior in simplified manager.
      },
    });
  }

  if (root.AFRAME) {
    registerComponent(root.AFRAME);
  } else {
    root.addEventListener('load', function () {
      registerComponent(root.AFRAME);
    });
  }
});
