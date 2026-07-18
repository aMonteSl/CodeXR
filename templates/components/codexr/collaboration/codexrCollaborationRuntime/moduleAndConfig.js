// == codexrCollaborationRuntime.js | moduleAndConfig (assembled per manifest.json; see COMPONENTS.md) ==
(function (factory) {
  const root = typeof globalThis !== 'undefined'
    ? globalThis
    : typeof self !== 'undefined'
      ? self
      : window;
  const runtime = factory(root);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = runtime;
  }
  root.CodeXRCollaborationRuntime = runtime;
  if (root.document) {
    const start = function () { runtime.autoInit(); };
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  }
})(function (global) {
  'use strict';

  const CONFIG_SCRIPT_ID = 'codexr-tooling-config-collaboration';
  const STATE_CHANGED_EVENT = 'codexr-collaboration-state-changed';
  const DEFAULT_PROFILE = {
    identityMode: 'anonymous',
    customName: '',
    avatarId: 'avatar-1',
  };
  const DEFAULT_CONFIG = {
    enabled: true,
    collaborationEnabled: true,
    presenceEnabled: true,
    cursorPresenceEnabled: false,
    sceneSelector: 'a-scene',
    roomSignalingPath: '/codexr-room',
    sessionEndpoint: '/api/collaboration/session',
    reconnectDelayMs: 900,
    presenceIntervalMs: 100,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function readConfigFromJsonScript(win) {
    const configScript = win.document?.getElementById(CONFIG_SCRIPT_ID);
    if (!configScript || typeof configScript.textContent !== 'string') {
      return null;
    }
    try {
      return JSON.parse(configScript.textContent);
    } catch (error) {
      console.warn('CODEXR_COLLAB: invalid JSON config script', error);
      return null;
    }
  }

  function mergeConfig(baseConfig, userConfig) {
    const virtualScreenConfig = userConfig?.virtualScreenConfig || userConfig?.screenConfig || null;
    const merged = { ...DEFAULT_CONFIG, ...(baseConfig || {}), ...(userConfig || {}) };
    if (virtualScreenConfig) {
      if (virtualScreenConfig.presenceEnabled === false) {
        merged.presenceEnabled = false;
      }
      if (virtualScreenConfig.cursorPresenceEnabled === true) {
        merged.cursorPresenceEnabled = true;
      }
      if (virtualScreenConfig.followAnchorSelector) {
        merged.followAnchorSelector = virtualScreenConfig.followAnchorSelector;
      }
    }
    merged.collaborationEnabled = merged.collaborationEnabled !== false;
    merged.presenceEnabled = merged.presenceEnabled !== false;
    merged.cursorPresenceEnabled = merged.cursorPresenceEnabled === true;
    return merged;
  }

  function sanitizeDisplayName(value) {
    const sanitized = String(value || '')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const length = Array.from(sanitized).length;
    return length >= 2 && length <= 32 ? sanitized : '';
  }

  function cloneVector(vector) {
    if (!vector || typeof vector !== 'object') {
      return null;
    }
    return {
      x: Number.isFinite(vector.x) ? vector.x : 0,
      y: Number.isFinite(vector.y) ? vector.y : 0,
      z: Number.isFinite(vector.z) ? vector.z : 0,
    };
  }

  function cloneTransform(transform) {
    if (!transform || typeof transform !== 'object') {
      return null;
    }
    return {
      position: cloneVector(transform.position),
      rotation: cloneVector(transform.rotation),
    };
  }

  function getPresenceLabel(presenceState) {
    return String(presenceState?.displayName || presenceState?.peerId || '').trim().slice(0, 32);
  }

  function serializeEulerDegreesFromQuaternion(quaternion, THREE) {
    if (!quaternion || !THREE) {
      return null;
    }
    const euler = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ');
    return {
      x: THREE.MathUtils.radToDeg(euler.x),
      y: THREE.MathUtils.radToDeg(euler.y),
      z: THREE.MathUtils.radToDeg(euler.z),
    };
  }
