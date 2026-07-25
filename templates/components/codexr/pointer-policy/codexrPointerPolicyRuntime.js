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

  // Single-active-pointer policy for CodeXR scenes.
  //
  // Babia legends are driven by raycaster hover events, and pie/donut/bubbles
  // share one implicit global legend reference — two live pointers corrupt the
  // legend show/hide cycle (orphan legends, NotFoundError). This component
  // guarantees exactly ONE pointer raycaster is enabled at a time:
  //   - desktop (not in VR): the mouse cursor;
  //   - VR without controllers: the gaze cursor on the camera;
  //   - VR with controllers: the right laser (left if only left is connected).
  //
  // laser-controls re-injects `cursor` + an UNFILTERED raycaster (objects: '')
  // on every controllerconnected/controllermodelready, and its
  // controllerdisconnected handler instantiates a default raycaster even on
  // desktop — so inactive controllers are re-neutralized after every injection
  // rather than configured once. Disabling a raycaster fires its pending
  // intersection-cleared/mouseleave events (A-Frame clears intersections on
  // enabled → false), so open legends close on pointer handover.

  function registerComponent(AFRAME) {
    if (!AFRAME || AFRAME.components['codexr-pointer-policy']) {
      return;
    }

    AFRAME.registerComponent('codexr-pointer-policy', {
      schema: {
        mouseSelector: { type: 'string', default: '#mouseCursor' },
        gazeSelector: { type: 'string', default: '#gazeCursor' },
        leftSelector: { type: 'string', default: '#leftController' },
        rightSelector: { type: 'string', default: '#rightController' },
        raycastSelector: { type: 'string', default: '.babiaxraycasterclass' },
      },

      init: function () {
        this.connected = { left: false, right: false };
        this.inVR = false;
        this.pointerEls = { mouse: null, gaze: null, left: null, right: null };
        this.applyTimer = null;
        this.boundHandlers = [];

        const sceneEl = this.el.sceneEl || this.el;
        const setup = this.setup.bind(this);
        if (sceneEl.hasLoaded) {
          setup();
        } else {
          sceneEl.addEventListener('loaded', setup, { once: true });
        }
      },

      remove: function () {
        if (this.applyTimer !== null) {
          clearTimeout(this.applyTimer);
          this.applyTimer = null;
        }
        this.boundHandlers.forEach(function (entry) {
          entry.target.removeEventListener(entry.eventName, entry.handler);
        });
        this.boundHandlers = [];
      },

      setup: function () {
        const sceneEl = this.el.sceneEl || this.el;
        const data = this.data;
        this.pointerEls = {
          mouse: sceneEl.querySelector(data.mouseSelector),
          gaze: sceneEl.querySelector(data.gazeSelector),
          left: sceneEl.querySelector(data.leftSelector),
          right: sceneEl.querySelector(data.rightSelector),
        };

        this.listen(sceneEl, 'enter-vr', this.onEnterVR.bind(this));
        this.listen(sceneEl, 'exit-vr', this.onExitVR.bind(this));
        this.listenToController('left');
        this.listenToController('right');

        this.inVR = typeof sceneEl.is === 'function' ? !!sceneEl.is('vr-mode') : false;
        this.applyPolicy();
      },

      listen: function (target, eventName, handler) {
        if (!target) {
          return;
        }
        target.addEventListener(eventName, handler);
        this.boundHandlers.push({ target: target, eventName: eventName, handler: handler });
      },

      listenToController: function (side) {
        const el = this.pointerEls[side];
        if (!el) {
          return;
        }
        const self = this;
        this.listen(el, 'controllerconnected', function () {
          self.connected[side] = true;
          self.scheduleApply();
        });
        this.listen(el, 'controllerdisconnected', function () {
          self.connected[side] = false;
          self.scheduleApply();
        });
        // laser-controls re-injects cursor + raycaster when the model loads,
        // after controllerconnected already ran — re-neutralize then too.
        this.listen(el, 'controllermodelready', function () {
          self.scheduleApply();
        });
      },

      onEnterVR: function () {
        this.inVR = true;
        this.scheduleApply();
      },

      onExitVR: function () {
        this.inVR = false;
        this.scheduleApply();
      },

      // Deferred so the policy runs AFTER laser-controls' own listener has
      // (re-)injected cursor/raycaster during the same event dispatch.
      scheduleApply: function () {
        if (this.applyTimer !== null) {
          return;
        }
        const self = this;
        this.applyTimer = setTimeout(function () {
          self.applyTimer = null;
          self.applyPolicy();
        }, 0);
      },

      activePointerName: function () {
        if (!this.inVR) {
          return 'mouse';
        }
        if (this.connected.right) {
          return 'right';
        }
        if (this.connected.left) {
          return 'left';
        }
        return 'gaze';
      },

      applyPolicy: function () {
        const active = this.activePointerName();
        this.applyMousePointer(this.pointerEls.mouse, active === 'mouse');
        this.applyGazePointer(this.pointerEls.gaze, active === 'gaze');
        this.applyControllerPointer(this.pointerEls.left, active === 'left');
        this.applyControllerPointer(this.pointerEls.right, active === 'right');
      },

      applyMousePointer: function (el, active) {
        if (!el) {
          return;
        }
        el.setAttribute('raycaster', 'enabled', active);
      },

      applyGazePointer: function (el, active) {
        if (!el) {
          return;
        }
        el.setAttribute('raycaster', 'enabled', active);
        // The reticle ring only shows while gaze is the active pointer.
        el.setAttribute('visible', active);
      },

      applyControllerPointer: function (el, active) {
        if (!el) {
          return;
        }
        el.setAttribute('raycaster', 'enabled', active);
        el.setAttribute('raycaster', 'showLine', active);
        if (active) {
          // laser-controls injects raycasters with objects: '' (the whole
          // scene) — the active laser must stay filtered to babia targets.
          el.setAttribute('raycaster', 'objects', this.data.raycastSelector);
          // laser-controls owns the cursor config on the active laser; make
          // sure one exists even if injection was skipped (e.g. unknown
          // controller name), so hover events reach babia.
          if (typeof el.getAttribute !== 'function' || !el.getAttribute('cursor')) {
            el.setAttribute('cursor', 'rayOrigin: entity; fuse: false');
          }
        } else if (typeof el.removeAttribute === 'function') {
          // An inactive controller keeps its model but must not stay a live
          // pointer: drop the cursor laser-controls injected.
          el.removeAttribute('cursor');
        }
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
