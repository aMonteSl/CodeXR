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

  // Wall panel geometry. The panel is TOP-ANCHORED: the controls root sits at
  // the top edge, content hangs downward and the backing plane resizes to fit
  // the row count — no dead space, no overlap between heading and rows.
  const PANEL_LAYOUT = {
    width: 4.2,
    titleY: -0.3,
    addButtonY: -0.74,
    headingY: -1.12,
    rowsTopY: -1.36,
    rowWidth: 3.9,
    rowHeight: 0.34,
    rowPitch: 0.4,
    bottomPadding: 0.2,
  };

  // Accent colours per screen kind (matches the CodeXR legend palette).
  const PANEL_KINDS = {
    fixed: { label: 'Fixed', color: '#22D3EE' },
    remote: { label: 'Remote', color: '#F59E0B' },
    broadcast: { label: 'Broadcast', color: '#3B82F6' },
    screen: { label: 'Screen', color: '#8B5CF6' },
  };

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

        this.activeScreens = new Map();
        this.remoteScreens = new Map();

        this.runtimeFactory = root.CodeXRVirtualScreenRuntime || null;
        // Screens every scene creates itself under a stable id ('default',
        // 'guide'…): shared state syncs onto them, but they are never treated
        // as removable remote screens. Seeded from the parent runtime's
        // registry — subtypes reserve their id at script load, which closes
        // the reload race where a persisted snapshot replays before the
        // subtype registers and a duplicate copy gets materialized.
        this.wellKnownScreens = new Set(this.runtimeFactory?.getWellKnownScreenIds?.() || ['default']);

        this.panelEntriesRoot = null;
        this.panelPlane = null;
        // Content signature of the last rendered panel: refreshPanel is a
        // 350 ms poll, so rebuilding only on change avoids per-tick DOM churn.
        this.panelSignature = null;

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
        this.registerWellKnownScreen('default', this.runtimeFactory);
      },

      // Adopts a screen runtime the scene created itself under a well-known id
      // (the 'default' broadcast screen, the 'guide' fixed-content screen…):
      // it joins the registry/panel and its state flows through the manager
      // without the manager owning its creation.
      registerWellKnownScreen: function (instanceId, runtime) {
        if (!instanceId || !runtime || typeof runtime.getState !== 'function') {
          return null;
        }
        this.wellKnownScreens = this.wellKnownScreens || new Set(['default']);
        this.wellKnownScreens.add(instanceId);
        // Belt & braces: if a race ever materialized a copy under this id,
        // destroy it before adopting the local runtime — a swapped record must
        // never leave orphaned screen DOM behind.
        const stale = this.activeScreens.get(instanceId);
        if (stale?.runtime && stale.runtime !== runtime) {
          stale.runtime.destroy?.();
          this.activeScreens.delete(instanceId);
          this.remoteScreens.delete(instanceId);
        }
        const record = this.ensureScreenRecord(instanceId, runtime, false);
        this.attachRuntimeToManager(instanceId, runtime);
        this.syncRecordMetadataFromState(record, runtime.getState?.());
        this.refreshPanel();
        return record;
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
            this.syncRecordMetadataFromState(existing, runtime.getState?.());
          }
          return existing;
        }

        const vscreenIndex = this.getNextVscreenIndex();
        const runtimeState = runtime?.getState?.() || {};
        const record = {
          instanceId,
          runtime,
          managed,
          collaborationSource: runtimeState.collaborationSource || 'local',
          vscreenIndex,
          displayName: runtimeState.displayName || `vscreen ${vscreenIndex}`,
          ownerPeerId: runtimeState.ownerPeerId || null,
        };

        this.activeScreens.set(instanceId, record);
        return record;
      },

      syncRecordMetadataFromState: function (record, runtimeState) {
        if (!record || !runtimeState || typeof runtimeState !== 'object') {
          return record || null;
        }
        if (typeof runtimeState.displayName === 'string' && runtimeState.displayName.trim().length > 0) {
          record.displayName = runtimeState.displayName.trim();
        }
        if (typeof runtimeState.collaborationSource === 'string' && runtimeState.collaborationSource.trim().length > 0) {
          record.collaborationSource = runtimeState.collaborationSource.trim();
        }
        if (typeof runtimeState.ownerPeerId === 'string' && runtimeState.ownerPeerId.trim().length > 0) {
          record.ownerPeerId = runtimeState.ownerPeerId.trim();
        }
        return record;
      },

      getLocalPeerId: function () {
        return this.collaborationClient?.getPeerId?.() || '';
      },

      buildManagedScreenId: function () {
        const peerId = this.getLocalPeerId() || 'anon';
        const counter = this.nextManagedInstance;
        this.nextManagedInstance += 1;
        return `screen:${peerId}:${counter}`;
      },

      createWallControls: function () {
        const controlsRoot = document.createElement('a-entity');
        controlsRoot.setAttribute('id', 'codexrWallControls');
        // Against the back wall, left of the analysis table, facing the
        // entrance: the panel is in view the moment you walk in, instead of
        // hanging on the side wall beside the spawn point where you had to
        // turn to find it. Room is at z=-10 with depth 26, so the back wall
        // sits at z=-23 and z=-22 keeps the same 1-unit clearance the main
        // screen uses; the table spans x=-3.3..3.3, so x=-7 clears it.
        // Top-anchored: refreshPanel grows the panel downwards from here.
        controlsRoot.setAttribute('position', '-7 4.1 -22');
        controlsRoot.setAttribute('rotation', '0 0 0');

        // Backing plane: refreshPanel resizes it to fit the row count.
        this.panelPlane = document.createElement('a-plane');
        this.panelPlane.setAttribute('width', String(PANEL_LAYOUT.width));
        this.panelPlane.setAttribute('height', '2');
        this.panelPlane.setAttribute('color', '#0f172a');
        this.panelPlane.setAttribute('position', '0 -1 -0.01');
        this.panelPlane.setAttribute('material', 'opacity: 0.9; transparent: true; shader: flat;');

        const title = document.createElement('a-text');
        title.setAttribute('value', 'Virtual screens');
        title.setAttribute('align', 'center');
        title.setAttribute('color', '#F8FAFC');
        title.setAttribute('width', '5.4');
        title.setAttribute('position', `0 ${PANEL_LAYOUT.titleY} 0.03`);

        const titleRule = document.createElement('a-plane');
        titleRule.setAttribute('width', String(PANEL_LAYOUT.width - 0.6));
        titleRule.setAttribute('height', '0.008');
        titleRule.setAttribute('position', `0 ${PANEL_LAYOUT.titleY - 0.22} 0.02`);
        titleRule.setAttribute('material', 'color: #38BDF8; opacity: 0.5; shader: flat;');

        const addButton = document.createElement('a-plane');
        addButton.setAttribute('id', 'codexrAddScreenButton');
        addButton.setAttribute('class', 'babiaxraycasterclass');
        addButton.setAttribute('width', '1.7');
        addButton.setAttribute('height', '0.32');
        addButton.setAttribute('color', '#1d4ed8');
        addButton.setAttribute('position', `0 ${PANEL_LAYOUT.addButtonY} 0.03`);
        addButton.setAttribute('text', 'value: + Add screen; align: center; color: #F8FAFC; width: 3.3;');

        const activeTitle = document.createElement('a-text');
        activeTitle.setAttribute('value', 'ACTIVE SCREENS');
        activeTitle.setAttribute('align', 'left');
        activeTitle.setAttribute('color', '#7DD3FC');
        activeTitle.setAttribute('width', '2.6');
        activeTitle.setAttribute('position', `${-PANEL_LAYOUT.rowWidth / 2} ${PANEL_LAYOUT.headingY} 0.03`);

        this.panelEntriesRoot = document.createElement('a-entity');
        this.panelEntriesRoot.setAttribute('id', 'codexrScreensEntries');
        this.panelEntriesRoot.setAttribute('position', `0 ${PANEL_LAYOUT.rowsTopY} 0.03`);

        addButton.addEventListener('click', () => this.addScreen());

        controlsRoot.appendChild(this.panelPlane);
        controlsRoot.appendChild(title);
        controlsRoot.appendChild(titleRule);
        controlsRoot.appendChild(addButton);
        controlsRoot.appendChild(activeTitle);
        controlsRoot.appendChild(this.panelEntriesRoot);
        this.el.appendChild(controlsRoot);
      },

      makeButton: function (label, color, position, width, onClick) {
        const btn = document.createElement('a-plane');
        btn.setAttribute('class', 'babiaxraycasterclass');
        btn.setAttribute('width', String(width || 0.55));
        btn.setAttribute('height', '0.24');
        btn.setAttribute('color', color);
        btn.setAttribute('position', position);
        btn.setAttribute('text', `value: ${label}; align: center; color: #f8fafc; width: 2.2;`);
        btn.addEventListener('click', onClick);
        return btn;
      },

      // Screen kind shown on each row (accent chip + tag).
      getRowKind: function (entry, state) {
        if (state?.contentKind === 'fixed') {
          return PANEL_KINDS.fixed;
        }
        if (entry.collaborationSource === 'remote') {
          return PANEL_KINDS.remote;
        }
        if (entry.instanceId === 'default') {
          return PANEL_KINDS.broadcast;
        }
        return PANEL_KINDS.screen;
      },

      // Muted second line: live status, size, minimized flag, remote owner.
      buildRowStatus: function (entry, state, kind) {
        const parts = [kind.label.toLowerCase()];
        if (state?.contentKind !== 'fixed') {
          if (state?.broadcastRole === 'broadcaster' || state?.mode === 'sharing') {
            parts.push('sharing');
          } else if (state?.broadcastStatus === 'live') {
            parts.push('live');
          } else if (state?.broadcastRole === 'viewer') {
            parts.push('viewing');
          } else {
            parts.push('idle');
          }
        }
        if (typeof state?.screenWidth === 'number' && state.screenWidth > 0) {
          parts.push(`${state.screenWidth.toFixed(1)}m`);
        }
        if (state?.presentationMode === 'minimized') {
          parts.push('minimized');
        }
        if (entry.collaborationSource === 'remote' && entry.ownerPeerId) {
          const owner = this.collaborationClient?.getParticipant?.(entry.ownerPeerId)?.displayName
            || String(entry.ownerPeerId).slice(0, 6);
          parts.push(`by ${owner}`);
        }
        return parts.join(' · ');
      },

      // One line per panel entry; changes trigger a rebuild, identical polls
      // are skipped entirely.
      computePanelSignature: function () {
        return Array.from(this.activeScreens.values())
          .sort((a, b) => a.vscreenIndex - b.vscreenIndex)
          .map((entry) => {
            const state = entry.runtime?.getState?.() || {};
            return [
              entry.instanceId,
              entry.displayName,
              entry.collaborationSource,
              entry.ownerPeerId || '',
              state.mode || '',
              state.broadcastRole || '',
              state.broadcastStatus || '',
              state.presentationMode || '',
              state.contentKind || '',
              (Number(state.screenWidth) || 0).toFixed(2),
            ].join('|');
          })
          .join('~');
      },

      placeScreenInFrontOfUser: function (instanceId, options) {
        const record = this.activeScreens.get(instanceId);
        if (!record?.runtime?.placeInFrontOfUser) {
          console.log('[CodeXR][VirtualScreenManager] placeScreenInFrontOfUser skipped: runtime missing', {
            instanceId,
            hasRecord: !!record,
            hasRuntime: !!record?.runtime,
          });
          return false;
        }
        const result = record.runtime.placeInFrontOfUser({
          publishState: true,
          publishTransform: true,
          updateStatus: false,
          showChrome: true,
          ...(options || {}),
        }) !== false;
        console.log('[CodeXR][VirtualScreenManager] placeScreenInFrontOfUser result', {
          instanceId,
          result,
          options: options || null,
          state: record.runtime.getState?.() || null,
        });
        return result;
      },

      schedulePlaceScreenInFrontOfUser: function (instanceId, options) {
        const record = this.activeScreens.get(instanceId);
        const flushInitialSharedState = () => {
          record?.runtime?.flushInitialSharedState?.();
        };
        const keepTryingAfterSuccess = options?.keepTryingAfterSuccess === true;
        const attemptPlace = (remainingAttempts) => {
          console.log('[CodeXR][VirtualScreenManager] schedulePlaceScreenInFrontOfUser attempt', {
            instanceId,
            remainingAttempts,
            options: options || null,
          });
          if (this.placeScreenInFrontOfUser(instanceId, options)) {
            const state = record?.runtime?.getState?.() || null;
            console.log('[CodeXR][VirtualScreenManager] schedulePlaceScreenInFrontOfUser placed', {
              instanceId,
              remainingAttempts,
              state,
            });
            if (!keepTryingAfterSuccess || remainingAttempts <= 0) {
              flushInitialSharedState();
              this.refreshPanel();
              return true;
            }
            root.setTimeout(() => {
              attemptPlace(remainingAttempts - 1);
            }, 75);
            return true;
          }
          if (remainingAttempts <= 0) {
            flushInitialSharedState();
            console.log('[CodeXR][VirtualScreenManager] schedulePlaceScreenInFrontOfUser exhausted retries', {
              instanceId,
              options: options || null,
              recordState: record?.runtime?.getState?.() || null,
            });
            return false;
          }
          root.setTimeout(() => {
            attemptPlace(remainingAttempts - 1);
          }, 50);
          return false;
        };
        return attemptPlace(Number(options?.retryCount) || 0);
      },

      clearChildren: function (entity) {
        if (!entity) {
          return;
        }
        while (entity.firstChild) {
          entity.removeChild(entity.firstChild);
        }
      },

      refreshPanel: function (force) {
        if (!this.panelEntriesRoot) {
          return;
        }
        const signature = this.computePanelSignature();
        if (force !== true && signature === this.panelSignature) {
          return;
        }
        this.panelSignature = signature;
        this.clearChildren(this.panelEntriesRoot);

        const entries = Array.from(this.activeScreens.values())
          .sort((a, b) => a.vscreenIndex - b.vscreenIndex)
          .slice(0, 8);
        const half = PANEL_LAYOUT.rowWidth / 2;

        entries.forEach((entry, index) => {
          const state = entry.runtime?.getState?.() || {};
          const kind = this.getRowKind(entry, state);
          const row = document.createElement('a-entity');
          row.setAttribute('position', `0 ${-(PANEL_LAYOUT.rowHeight / 2) - (index * PANEL_LAYOUT.rowPitch)} 0`);

          const bg = document.createElement('a-plane');
          bg.setAttribute('width', String(PANEL_LAYOUT.rowWidth));
          bg.setAttribute('height', String(PANEL_LAYOUT.rowHeight));
          bg.setAttribute('color', '#1e293b');
          bg.setAttribute('material', 'opacity: 0.85; transparent: true; shader: flat;');

          // Accent chip: the screen kind at a glance.
          const chip = document.createElement('a-plane');
          chip.setAttribute('width', '0.07');
          chip.setAttribute('height', String(PANEL_LAYOUT.rowHeight));
          chip.setAttribute('position', `${-half + 0.035} 0 0.01`);
          chip.setAttribute('material', `color: ${kind.color}; opacity: 0.95; shader: flat;`);

          const name = document.createElement('a-text');
          name.setAttribute('value', entry.displayName);
          name.setAttribute('align', 'left');
          name.setAttribute('color', '#F8FAFC');
          name.setAttribute('width', '2.4');
          name.setAttribute('position', `${-half + 0.18} 0.062 0.02`);

          const status = document.createElement('a-text');
          status.setAttribute('value', this.buildRowStatus(entry, state, kind));
          status.setAttribute('align', 'left');
          status.setAttribute('color', '#94A3B8');
          status.setAttribute('width', '1.75');
          status.setAttribute('position', `${-half + 0.18} -0.075 0.02`);

          const bringBtn = this.makeButton('Bring', '#2563eb', '0.78 0 0.02', 0.52, () => {
            this.bringScreenInFrontOfUser(entry.instanceId);
          });

          const minimized = state.presentationMode === 'minimized';
          const minBtn = this.makeButton(minimized ? 'Exp' : 'Min', '#334155', '1.24 0 0.02', 0.32, () => {
            if (minimized) {
              entry.runtime?.expand?.();
            } else {
              entry.runtime?.minimize?.();
            }
            this.refreshPanel();
          });

          row.appendChild(bg);
          row.appendChild(chip);
          row.appendChild(name);
          row.appendChild(status);
          row.appendChild(bringBtn);
          row.appendChild(minBtn);

          // Well-known screens (default, guide) are room furniture: never
          // deletable. Managed screens (local Add Screen or remote copies)
          // can be removed.
          const canDelete = entry.managed === true && !this.wellKnownScreens?.has(entry.instanceId);
          if (canDelete) {
            const removeBtn = this.makeButton('Del', '#b91c1c', '1.68 0 0.02', 0.4, () => {
              this.destroyScreen(entry.instanceId);
              this.refreshPanel();
            });
            row.appendChild(removeBtn);
          }
          this.panelEntriesRoot.appendChild(row);
        });

        // Fit the backing plane to the content (top edge stays anchored).
        const height = -PANEL_LAYOUT.rowsTopY
          + (entries.length * PANEL_LAYOUT.rowPitch)
          + PANEL_LAYOUT.bottomPadding;
        this.panelPlane?.setAttribute('height', String(height));
        this.panelPlane?.setAttribute('position', `0 ${-height / 2} -0.01`);
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
        const position = transform.position || options?.anchoredPosition || sharedConfig.anchoredPosition || { x: 0, y: 8, z: 6 };
        const rotation = transform.rotation || options?.anchoredRotation || { x: 0, y: 90, z: 0 };
        const roomId = this.collaborationClient?.getRoomId?.() || collaborationConfig.roomId || '';
        return {
          ...sharedConfig,
          enabled: true,
          broadcastEnabled: sharedConfig.broadcastEnabled !== false,
          collaborationEnabled: collaborationConfig.collaborationEnabled !== false,
          presenceEnabled: collaborationConfig.presenceEnabled !== false,
          cursorPresenceEnabled: collaborationConfig.cursorPresenceEnabled === true,
          roomId,
          signalingPath: sharedConfig.signalingPath || '/codexr-broadcast',
          roomSignalingPath: collaborationConfig.roomSignalingPath || '/codexr-room',
          sessionEndpoint: collaborationConfig.sessionEndpoint || '/api/collaboration/session',
          sceneSelector: sharedConfig.sceneSelector || this.getSceneSelector(),
          followAnchorSelector: sharedConfig.followAnchorSelector || this.getFollowAnchorSelector(),
          instanceId,
          screenId: instanceId,
          managedScreen: true,
          placeInFrontOfUserOnInit: false,
          deferInitialSharedState: options?.deferInitialSharedState === true,
          collaborationSource: options?.collaborationSource || 'local',
          ownerPeerId: options?.ownerPeerId || options?.sharedState?.ownerPeerId || null,
          displayName: options?.displayName || instanceId,
          contentKind: options?.contentKind === 'fixed' ? 'fixed' : 'broadcast',
          contentProviderId: options?.contentProviderId || '',
          contentDesignWidth: Number(options?.contentDesignWidth) || 0,
          // Geometry must survive materialization: a fixed screen rebuilt with
          // the broadcast default 16:9 would frame its content short and cut
          // the bottom band.
          aspectRatio: Number(options?.aspectRatio) > 0
            ? Number(options.aspectRatio)
            : (Number(sharedConfig.aspectRatio) > 0 ? Number(sharedConfig.aspectRatio) : (16 / 9)),
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
        this.attachRuntimeToManager(instanceId, runtime);
        runtime.init(this.buildRuntimeInitConfig(instanceId, options));
        if (options?.sharedState) {
          runtime.applySharedScreenState?.(options.sharedState, { source: 'manager-create' });
        }
        return runtime;
      },

      attachRuntimeToManager: function (instanceId, runtime) {
        if (!runtime || typeof runtime.setManagerCallbacks !== 'function') {
          return runtime;
        }
        runtime.setManagerCallbacks({
          onStateChange: (sharedState, meta) => {
            this.publishScreenState(instanceId, sharedState, meta?.eventType || 'entity-updated');
          },
          onTransformChange: (transform) => {
            this.publishScreenTransform(instanceId, transform);
          },
          onRemoveEntity: () => {
            this.removeScreenEntity(instanceId);
          },
        });
        return runtime;
      },

      publishScreenState: function (instanceId, sharedState, eventType) {
        if (!sharedState || !this.collaborationClient || typeof this.collaborationClient.sendEntityState !== 'function') {
          return false;
        }
        const record = this.activeScreens.get(instanceId);
        if (record) {
          this.syncRecordMetadataFromState(record, sharedState);
        }
        return this.collaborationClient.sendEntityState(sharedState, eventType || 'entity-updated');
      },

      publishScreenTransform: function (instanceId, transform) {
        if (!transform || !this.collaborationClient || typeof this.collaborationClient.sendEntityTransform !== 'function') {
          return false;
        }
        return this.collaborationClient.sendEntityTransform({
          entityKind: 'screen',
          entityId: instanceId,
          transform,
        });
      },

      removeScreenEntity: function (instanceId) {
        if (this.wellKnownScreens?.has(instanceId) || !this.collaborationClient || typeof this.collaborationClient.removeEntity !== 'function') {
          return false;
        }
        return this.collaborationClient.removeEntity('screen', instanceId);
      },

      ensureRemoteScreen: function (sharedState) {
        if (!sharedState || sharedState.entityKind !== 'screen' || !sharedState.entityId) {
          return null;
        }
        if (this.wellKnownScreens?.has(sharedState.entityId)) {
          // Well-known screens exist locally on every peer: sync state onto
          // the local instance instead of materializing a remote copy.
          const wellKnownRecord = this.activeScreens.get(sharedState.entityId);
          wellKnownRecord?.runtime?.applySharedScreenState?.(sharedState, { source: 'manager-well-known' });
          this.syncRecordMetadataFromState(wellKnownRecord, sharedState);
          return wellKnownRecord || null;
        }

        const existing = this.activeScreens.get(sharedState.entityId);
        if (existing) {
          existing.runtime?.applySharedScreenState?.(sharedState, { source: 'manager-existing' });
          existing.collaborationSource = 'remote';
          this.syncRecordMetadataFromState(existing, sharedState);
          this.remoteScreens.set(sharedState.entityId, existing);
          return existing;
        }

        if (sharedState.contentKind === 'fixed'
            && !this.runtimeFactory?.getContentProvider?.(sharedState.contentProviderId)) {
          // Never materialize a fixed-content screen as a dead video screen.
          console.warn('MULTI_SCREEN: skipping fixed screen without a registered provider', sharedState.contentProviderId);
          return null;
        }

        const runtime = this.createManagedRuntime(sharedState.entityId, {
          collaborationSource: 'remote',
          displayName: sharedState.displayName || sharedState.entityId,
          ownerPeerId: sharedState.ownerPeerId || null,
          transform: sharedState.transform || null,
          contentKind: sharedState.contentKind === 'fixed' ? 'fixed' : 'broadcast',
          contentProviderId: sharedState.contentProviderId || '',
          contentDesignWidth: Number(sharedState.contentDesignWidth) || 0,
          aspectRatio: Number(sharedState.aspectRatio) || 0,
          sharedState,
          idleLabel: `${sharedState.displayName || sharedState.entityId}: waiting for source.`,
        });
        if (!runtime) {
          return null;
        }

        const record = this.ensureScreenRecord(sharedState.entityId, runtime, true);
        record.collaborationSource = 'remote';
        this.syncRecordMetadataFromState(record, sharedState);
        this.remoteScreens.set(sharedState.entityId, record);
        this.refreshPanel();
        return record;
      },

      removeRemoteScreen: function (screenId) {
        if (!screenId || this.wellKnownScreens?.has(screenId)) {
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
        const seen = new Set(this.wellKnownScreens || ['default']);

        screenStates.forEach((entity) => {
          seen.add(entity.entityId);
          if (this.wellKnownScreens?.has(entity.entityId)) {
            this.activeScreens.get(entity.entityId)?.runtime?.applySharedScreenState?.(entity, { source: 'snapshot' });
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
          console.log('[CodeXR][VirtualScreenManager] addScreen skipped: maxScreens reached', {
            activeScreens: this.activeScreens.size,
            maxScreens: this.data.maxScreens,
          });
          return;
        }

        const instanceId = this.buildManagedScreenId();
        console.log('[CodeXR][VirtualScreenManager] addScreen start', {
          instanceId,
          peerId: this.getLocalPeerId() || null,
          nextVscreenIndex: this.nextVscreenIndex,
        });
        const runtime = this.createManagedRuntime(instanceId, {
          collaborationSource: 'local',
          deferInitialSharedState: true,
          ownerPeerId: this.getLocalPeerId() || null,
          displayName: `vscreen ${this.nextVscreenIndex}`,
        });
        if (!runtime) {
          console.log('[CodeXR][VirtualScreenManager] addScreen failed: runtime not created', {
            instanceId,
          });
          return;
        }

        const record = this.ensureScreenRecord(instanceId, runtime, true);
        console.log('[CodeXR][VirtualScreenManager] addScreen runtime created', {
          instanceId,
          displayName: record.displayName,
          initialState: runtime.getState?.() || null,
        });
        this.schedulePlaceScreenInFrontOfUser(instanceId, {
          retryCount: 12,
          keepTryingAfterSuccess: true,
          updateStatus: false,
          showChrome: true,
        });
        this.refreshPanel();
      },

      destroyScreen: function (instanceId, options) {
        const record = this.activeScreens.get(instanceId);
        if (!record) {
          return false;
        }
        if (instanceId === 'default' && options?.remote !== true) {
          return false;
        }

        record.runtime?.setManagerCallbacks?.(null);
        if (instanceId !== 'default' && options?.remote !== true) {
          this.removeScreenEntity(instanceId);
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
        this.refreshPanel();
        return true;
      },

      bringScreenInFrontOfUser: function (instanceId) {
        return this.placeScreenInFrontOfUser(instanceId, {
          publishState: true,
          publishTransform: true,
          updateStatus: false,
          showChrome: true,
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
