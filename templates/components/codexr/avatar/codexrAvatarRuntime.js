(function (factory) {
  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const runtime = factory(root);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = runtime;
  }
  root.CodeXRAvatarRuntime = runtime;
  runtime.registerAFrameComponent();
})(function (global) {
  'use strict';

  const ASSET_MANIFEST = {
    id: 'quaternius-animated-base-character',
    label: 'Quaternius Animated Base Character',
    sourcePage: 'https://poly.pizza/m/cwYvO5UauX',
    modelUrl: '/api/collaboration/avatar-model',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    bytes: 2266136,
    triangles: 13744,
  };
  const SKINS = [
    { id: 'avatar-1', label: 'Azure', color: '#38bdf8' },
    { id: 'avatar-2', label: 'Amber', color: '#f59e0b' },
    { id: 'avatar-3', label: 'Emerald', color: '#22c55e' },
    { id: 'avatar-4', label: 'Violet', color: '#a78bfa' },
    { id: 'avatar-5', label: 'Rose', color: '#fb7185' },
    { id: 'avatar-6', label: 'Slate', color: '#94a3b8' },
  ];

  function formatBytes(bytes) {
    return `${(Number(bytes || 0) / (1024 * 1024)).toFixed(2)} MiB`;
  }

  function getSkin(avatarId) {
    return SKINS.find(function (skin) { return skin.id === avatarId; }) || SKINS[0];
  }

  function createAssetManager(win) {
    let available = false;
    let modelUrl = ASSET_MANIFEST.modelUrl;
    let objectUrl = '';
    let loadingPromise = null;
    const listeners = new Set();

    function notify() {
      const state = getState();
      listeners.forEach(function (listener) { listener(state); });
      win.document?.dispatchEvent(new win.CustomEvent('codexr-avatar-assets-changed', {
        detail: state,
      }));
    }

    async function readResponse() {
      const response = await win.fetch(modelUrl, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`Avatar model request failed with ${response.status}`);
      }
      return response;
    }

    async function load() {
      if (objectUrl) {
        return objectUrl;
      }
      if (!available) {
        return null;
      }
      if (loadingPromise) {
        return loadingPromise;
      }
      loadingPromise = readResponse()
        .then(function (response) { return response.blob(); })
        .then(function (blob) {
          objectUrl = win.URL.createObjectURL(blob);
          notify();
          return objectUrl;
        })
        .catch(function (error) {
          loadingPromise = null;
          notify();
          throw error;
        });
      return loadingPromise;
    }

    function configure(configuration) {
      available = configuration?.available === true;
      modelUrl = configuration?.modelUrl || ASSET_MANIFEST.modelUrl;
      if (!available && objectUrl) {
        win.URL.revokeObjectURL?.(objectUrl);
        objectUrl = '';
      }
      notify();
      return available ? load() : Promise.resolve(null);
    }

    function getState() {
      return {
        available,
        ready: !!objectUrl,
        loading: !!loadingPromise && !objectUrl,
        manifest: ASSET_MANIFEST,
        sizeLabel: formatBytes(ASSET_MANIFEST.bytes),
      };
    }

    return {
      getState,
      load,
      configure,
      subscribe(listener) {
        listeners.add(listener);
        return function () { listeners.delete(listener); };
      },
    };
  }

  function getAssetManager(win) {
    if (!win.__CODEXR_AVATAR_ASSET_MANAGER__) {
      win.__CODEXR_AVATAR_ASSET_MANAGER__ = createAssetManager(win);
    }
    return win.__CODEXR_AVATAR_ASSET_MANAGER__;
  }

  function createPrimitive(document, primitive, color, dimensions) {
    const entity = document.createElement('a-entity');
    entity.setAttribute('geometry', `primitive: ${primitive}; ${dimensions}`);
    entity.setAttribute('material', `color: ${color}; roughness: 0.82; metalness: 0.04;`);
    return entity;
  }

  function cloneVector(value, fallback) {
    if (!value || typeof value !== 'object') {
      return { ...(fallback || { x: 0, y: 0, z: 0 }) };
    }
    return {
      x: Number.isFinite(value.x) ? value.x : 0,
      y: Number.isFinite(value.y) ? value.y : 0,
      z: Number.isFinite(value.z) ? value.z : 0,
    };
  }

  function resolveAnimationClip(model, preferredNames, fallbackIndex) {
    const clips = model?.animations || [];
    const preferred = clips.find(function (clip) {
      const normalized = String(clip.name || '').toLocaleLowerCase();
      return preferredNames.some(function (name) { return normalized.includes(name); });
    });
    return preferred?.name || (Number.isInteger(fallbackIndex) ? clips[fallbackIndex]?.name : '') || '';
  }

  function registerAFrameComponent() {
    const AFRAME = global.AFRAME;
    if (!AFRAME || AFRAME.components['codexr-avatar']) {
      return;
    }

    AFRAME.registerComponent('codexr-avatar', {
      schema: {
        peerId: { type: 'string', default: '' },
        displayName: { type: 'string', default: '' },
        avatarId: { type: 'string', default: 'avatar-1' },
        smoothing: { type: 'number', default: 12 },
        lodDistance: { type: 'number', default: 12 },
        hideDistance: { type: 'number', default: 32 },
      },

      init: function () {
        this.assetManager = getAssetManager(global);
        this.target = null;
        this.lastBodyPosition = null;
        this.lastMovementAt = 0;
        this.currentAnimation = '';
        this.modelActive = false;
        this.clips = { idle: '', walk: '', run: '' };
        this.buildAvatar();
        this.unsubscribeAssets = this.assetManager.subscribe(() => this.syncModel());
        this.syncModel();
      },

      update: function (oldData) {
        if (!oldData || oldData.avatarId !== this.data.avatarId) {
          this.applySkin();
        }
        if (!oldData || oldData.displayName !== this.data.displayName) {
          this.labelEl.setAttribute('value', this.data.displayName || this.data.peerId.slice(0, 6));
        }
      },

      remove: function () {
        this.unsubscribeAssets?.();
      },

      buildAvatar: function () {
        const document = this.el.ownerDocument;
        const skin = getSkin(this.data.avatarId);
        this.bodyRoot = document.createElement('a-entity');
        this.modelEl = document.createElement('a-entity');
        this.proceduralRoot = document.createElement('a-entity');
        this.leftHandEl = createPrimitive(document, 'sphere', skin.color, 'radius: 0.065');
        this.rightHandEl = createPrimitive(document, 'sphere', skin.color, 'radius: 0.065');
        this.labelEl = document.createElement('a-text');

        const torso = createPrimitive(document, 'cylinder', skin.color, 'radius: 0.22; height: 0.72');
        const head = createPrimitive(document, 'sphere', skin.color, 'radius: 0.145');
        const hips = createPrimitive(document, 'box', skin.color, 'width: 0.38; height: 0.18; depth: 0.2');
        const leftLeg = createPrimitive(document, 'cylinder', skin.color, 'radius: 0.075; height: 0.72');
        const rightLeg = createPrimitive(document, 'cylinder', skin.color, 'radius: 0.075; height: 0.72');

        torso.setAttribute('position', '0 -0.54 0');
        head.setAttribute('position', '0 0 0');
        hips.setAttribute('position', '0 -0.91 0');
        leftLeg.setAttribute('position', '-0.11 -1.35 0');
        rightLeg.setAttribute('position', '0.11 -1.35 0');
        this.proceduralParts = [torso, head, hips, leftLeg, rightLeg];
        this.proceduralParts.forEach((part) => this.proceduralRoot.appendChild(part));

        this.modelEl.setAttribute('position', '0 -1.62 0');
        this.modelEl.setAttribute('rotation', '0 180 0');
        this.modelEl.addEventListener('model-loaded', (event) => this.handleModelLoaded(event));
        this.modelEl.addEventListener('model-error', () => {
          this.modelActive = false;
          this.modelEl.setAttribute('visible', false);
          this.proceduralRoot.setAttribute('visible', true);
        });

        this.labelEl.setAttribute('align', 'center');
        this.labelEl.setAttribute('color', '#e2e8f0');
        this.labelEl.setAttribute('width', '2.5');
        this.labelEl.setAttribute('position', '0 0.3 0');
        this.labelEl.setAttribute('value', this.data.displayName || this.data.peerId.slice(0, 6));

        this.bodyRoot.appendChild(this.proceduralRoot);
        this.bodyRoot.appendChild(this.modelEl);
        this.bodyRoot.appendChild(this.labelEl);
        this.el.appendChild(this.bodyRoot);
        this.el.appendChild(this.leftHandEl);
        this.el.appendChild(this.rightHandEl);
      },

      syncModel: function () {
        const state = this.assetManager.getState();
        if (!state.available) {
          this.modelActive = false;
          this.modelEl.setAttribute('visible', false);
          this.proceduralRoot.setAttribute('visible', true);
          return;
        }
        this.assetManager.load().then((url) => {
          if (url && this.modelEl.getAttribute('gltf-model') !== url) {
            this.modelEl.setAttribute('gltf-model', url);
          }
        }).catch(() => {
          this.modelActive = false;
          this.modelEl.setAttribute('visible', false);
          this.proceduralRoot.setAttribute('visible', true);
        });
      },

      handleModelLoaded: function (event) {
        const model = event.detail?.model;
        this.clips = {
          idle: resolveAnimationClip(model, ['idle', 'stand', 'breath'], null),
          walk: resolveAnimationClip(model, ['walk'], 1),
          run: resolveAnimationClip(model, ['run', 'jog'], 2),
        };
        this.modelActive = true;
        this.applySkinToModel(model);
        this.modelEl.setAttribute('visible', true);
        this.proceduralRoot.setAttribute('visible', false);
        this.leftHandEl.setAttribute('visible', false);
        this.rightHandEl.setAttribute('visible', false);
        this.playAnimation('idle');
      },

      applySkin: function () {
        const skin = getSkin(this.data.avatarId);
        this.proceduralParts.concat([this.leftHandEl, this.rightHandEl]).forEach(function (entity) {
          entity?.setAttribute('material', 'color', skin.color);
        });
        this.applySkinToModel(this.modelEl.getObject3D('mesh'));
      },

      applySkinToModel: function (model) {
        const skin = getSkin(this.data.avatarId);
        model?.traverse?.(function (node) {
          if (!node.isMesh || !node.material) {
            return;
          }
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          const tintedMaterials = materials.map(function (material) {
            if (!material?.color) {
              return material;
            }
            const tinted = material.clone();
            tinted.color.lerp(new global.THREE.Color(skin.color), 0.22);
            return tinted;
          });
          node.material = Array.isArray(node.material) ? tintedMaterials : tintedMaterials[0];
        });
      },

      setPresenceState: function (presenceState) {
        this.target = {
          head: presenceState?.head || null,
          body: presenceState?.body || null,
          leftHand: presenceState?.leftHand || null,
          rightHand: presenceState?.rightHand || null,
        };
        if (presenceState?.displayName && presenceState.displayName !== this.data.displayName) {
          this.el.setAttribute('codexr-avatar', 'displayName', presenceState.displayName);
        }
        if (presenceState?.avatarId && presenceState.avatarId !== this.data.avatarId) {
          this.el.setAttribute('codexr-avatar', 'avatarId', presenceState.avatarId);
        }
      },

      tick: function (time, delta) {
        if (!this.target?.head?.position || !global.THREE) {
          this.el.setAttribute('visible', false);
          return;
        }
        this.el.setAttribute('visible', true);
        const factor = 1 - Math.exp(-Math.max(1, this.data.smoothing) * Math.max(0.001, delta / 1000));
        const bodyPose = this.target.body?.position ? this.target.body : null;
        const headPosition = bodyPose
          ? cloneVector(bodyPose.position)
          : {
              ...cloneVector(this.target.head.position),
              y: Number(this.target.head.position.y || 1.6) - 1.6,
            };
        const bodyPosition = this.bodyRoot.object3D.position;
        const previousPosition = bodyPosition.clone();
        bodyPosition.lerp(new global.THREE.Vector3(headPosition.x, headPosition.y, headPosition.z), factor);

        const yaw = Number(this.target.head.rotation?.y || 0);
        this.bodyRoot.object3D.rotation.y = global.THREE.MathUtils.lerp(
          this.bodyRoot.object3D.rotation.y,
          global.THREE.MathUtils.degToRad(yaw),
          factor,
        );
        this.updateHand(this.leftHandEl, this.target.leftHand, factor);
        this.updateHand(this.rightHandEl, this.target.rightHand, factor);
        this.updateLod();

        const horizontalDistance = Math.hypot(
          bodyPosition.x - previousPosition.x,
          bodyPosition.z - previousPosition.z,
        );
        const speed = horizontalDistance / Math.max(0.001, delta / 1000);
        if (speed > 1.4) {
          this.playAnimation('run');
          this.lastMovementAt = time;
        } else if (speed > 0.08) {
          this.playAnimation('walk');
          this.lastMovementAt = time;
        } else if (time - this.lastMovementAt > 220) {
          this.playAnimation('idle');
        }
      },

      updateHand: function (entity, pose, factor) {
        const visible = !this.modelActive && !!pose?.position;
        entity.setAttribute('visible', visible);
        if (!visible) {
          return;
        }
        const position = cloneVector(pose.position);
        entity.object3D.position.lerp(new global.THREE.Vector3(position.x, position.y, position.z), factor);
        if (pose.rotation) {
          entity.object3D.rotation.set(
            global.THREE.MathUtils.degToRad(pose.rotation.x || 0),
            global.THREE.MathUtils.degToRad(pose.rotation.y || 0),
            global.THREE.MathUtils.degToRad(pose.rotation.z || 0),
          );
        }
      },

      updateLod: function () {
        const camera = this.el.sceneEl?.camera;
        if (!camera) {
          return;
        }
        const distance = camera.getWorldPosition(new global.THREE.Vector3())
          .distanceTo(this.bodyRoot.object3D.position);
        const hidden = distance > this.data.hideDistance;
        this.bodyRoot.setAttribute('visible', !hidden);
        this.leftHandEl.setAttribute('visible', !hidden && !!this.target?.leftHand?.position);
        this.rightHandEl.setAttribute('visible', !hidden && !!this.target?.rightHand?.position);
        if (hidden) {
          return;
        }
        const modelReady = !!this.modelEl.getObject3D('mesh');
        const useModel = modelReady && distance <= this.data.lodDistance;
        this.modelActive = useModel;
        this.modelEl.setAttribute('visible', useModel);
        this.proceduralRoot.setAttribute('visible', !useModel);
        this.leftHandEl.setAttribute('visible', !useModel && !!this.target?.leftHand?.position);
        this.rightHandEl.setAttribute('visible', !useModel && !!this.target?.rightHand?.position);
        this.labelEl.setAttribute('visible', distance <= this.data.lodDistance * 1.5);
      },

      playAnimation: function (state) {
        const clip = this.clips[state] || (state === 'run' ? this.clips.walk : '');
        if (!clip) {
          if (state === 'idle' && this.currentAnimation) {
            this.currentAnimation = '';
            this.modelEl.removeAttribute('animation-mixer');
          }
          return;
        }
        if (clip === this.currentAnimation) {
          return;
        }
        this.currentAnimation = clip;
        this.modelEl.setAttribute('animation-mixer', {
          clip,
          loop: 'repeat',
          crossFadeDuration: 0.2,
        });
      },
    });
  }

  return {
    ASSET_MANIFEST,
    SKINS,
    formatBytes,
    getSkin,
    createAssetManager,
    getAssetManager: function (win) { return getAssetManager(win || global); },
    configureAsset: function (configuration) {
      return getAssetManager(global).configure(configuration || {});
    },
    registerAFrameComponent,
  };
});
