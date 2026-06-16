(function (factory) {
  const root = typeof globalThis !== 'undefined'
    ? globalThis
    : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
        ? window
        : this;

  const runtime = factory(root);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = runtime;
  }

  root.CodeXRDomSceneCollaborationRuntime = runtime;

  if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', function () {
        runtime.autoInit();
      }, { once: true });
    } else {
      runtime.autoInit();
    }
  }
})(function (root) {
  'use strict';

  const ENTITY_KIND = 'dom-scene-control';
  const ENTITY_ID = 'htmlDOM';

  const state = {
    initialized: false,
    suppressPublish: false,
  };

  const refs = {
    htmlDom: null,
  };

  function getDocument() {
    return root.document || null;
  }

  function getHtmlDom() {
    refs.htmlDom = refs.htmlDom || getDocument()?.querySelector('#htmlDOM') || null;
    return refs.htmlDom;
  }

  function getCollaborationClient() {
    const collaborationRuntime = root.CodeXRCollaborationRuntime;
    if (!collaborationRuntime || typeof collaborationRuntime.getClient !== 'function') {
      return null;
    }
    return collaborationRuntime.getClient(root);
  }

  function getHelpers() {
    return root.CodeXRDomCollaborationHelpers || null;
  }

  function cloneVector(vector) {
    if (!vector || typeof vector !== 'object') {
      return { x: 0, y: 0, z: 0 };
    }
    return {
      x: Number(vector.x) || 0,
      y: Number(vector.y) || 0,
      z: Number(vector.z) || 0,
    };
  }

  function getBabiaHtmlState() {
    const helpers = getHelpers();
    if (helpers && typeof helpers.getCurrentBabiaHtmlState === 'function') {
      return helpers.getCurrentBabiaHtmlState() || {};
    }

    const entity = getHtmlDom();
    const config = entity ? entity.getAttribute('babia-html') : null;
    return {
      entity,
      distanceLevels: config && typeof config.distanceLevels === 'number' ? config.distanceLevels : 0.7,
      html: config && typeof config.html === 'string' ? config.html : '',
    };
  }

  function applyBabiaHtml(distanceLevels, htmlContent) {
    const helpers = getHelpers();
    if (helpers && typeof helpers.applyBabiaHtml === 'function') {
      helpers.applyBabiaHtml(distanceLevels, htmlContent);
      return;
    }

    const current = getBabiaHtmlState();
    if (!current.entity) {
      return;
    }

    current.entity.removeAttribute('babia-html');
    root.requestAnimationFrame?.(function () {
      current.entity.setAttribute('babia-html', {
        renderHTML: true,
        renderHTMLOnlyLeafs: true,
        html: htmlContent || current.html || '',
        distanceLevels: distanceLevels,
      });
    });
  }

  function buildSharedState() {
    const entity = getHtmlDom();
    if (!entity) {
      return null;
    }
    const babiaState = getBabiaHtmlState();
    return {
      entityKind: ENTITY_KIND,
      entityId: ENTITY_ID,
      rotation: cloneVector(entity.getAttribute('rotation')),
      position: cloneVector(entity.getAttribute('position')),
      scale: cloneVector(entity.getAttribute('scale')),
      distanceLevels: Number(babiaState.distanceLevels) || 0.7,
    };
  }

  function publishSharedState(eventType) {
    if (state.suppressPublish) {
      return false;
    }
    const client = getCollaborationClient();
    const snapshot = buildSharedState();
    if (!client || !snapshot) {
      return false;
    }
    return client.sendEntityState(snapshot, eventType || 'entity-updated');
  }

  function publishInitialSharedState() {
    return publishSharedState('entity-added');
  }

  function applySharedState(snapshot) {
    const entity = getHtmlDom();
    if (!entity || !snapshot || typeof snapshot !== 'object') {
      return false;
    }

    state.suppressPublish = true;
    try {
      if (snapshot.rotation) {
        entity.setAttribute('rotation', cloneVector(snapshot.rotation));
      }
      if (snapshot.position) {
        entity.setAttribute('position', cloneVector(snapshot.position));
      }
      if (snapshot.scale) {
        entity.setAttribute('scale', cloneVector(snapshot.scale));
      }
      if (typeof snapshot.distanceLevels === 'number') {
        applyBabiaHtml(snapshot.distanceLevels);
      }
      return true;
    } finally {
      state.suppressPublish = false;
    }
  }

  function rotate(axis) {
    const entity = getHtmlDom();
    if (!entity) {
      return;
    }
    const rotation = cloneVector(entity.getAttribute('rotation'));
    rotation[axis] += 90;
    entity.setAttribute('rotation', rotation);
    publishSharedState();
  }

  function setDistanceLevels(distanceLevels) {
    applyBabiaHtml(distanceLevels);
    publishSharedState();
  }

  function bindButton(buttonId, handler) {
    const button = getDocument()?.querySelector(`#${buttonId}`);
    if (!button) {
      return;
    }
    button.addEventListener('click', handler);
  }

  function init() {
    if (state.initialized) {
      return runtime;
    }

    if (!getHtmlDom()) {
      return runtime;
    }

    bindButton('rotateX', function () { rotate('x'); });
    bindButton('rotateY', function () { rotate('y'); });
    bindButton('rotateZ', function () { rotate('z'); });
    bindButton('collapse', function () { setDistanceLevels(0.01); });
    bindButton('expand', function () { setDistanceLevels(0.7); });

    getCollaborationClient()?.registerEntityRuntime?.({
      entityKind: ENTITY_KIND,
      entityId: ENTITY_ID,
      applySharedState,
      publishInitialSharedState,
    });

    state.initialized = true;
    return runtime;
  }

  function autoInit() {
    init();
  }

  const runtime = {
    init,
    autoInit,
    applySharedState,
    publishInitialSharedState,
    getSharedState: buildSharedState,
  };

  return runtime;
});
