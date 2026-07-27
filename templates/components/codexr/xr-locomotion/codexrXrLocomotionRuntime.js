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

  // Thumbstick locomotion for CodeXR scenes.
  //
  // aframe-extras' movement-controls delegates gamepad input to its own
  // gamepad-controls, which looks the XR pads up through the tracked-controls
  // system; that path delivered nothing here, and debugging someone else's
  // plumbing is not worth it when A-Frame already publishes the input we need:
  // the per-device controller components map the thumbstick (axes 2 and 3 on
  // meta-touch-controls) and emit `thumbstickmoved` with {x, y}. We listen to
  // that, so this works with any controller A-Frame supports, and it can be
  // driven directly in tests.
  //
  // BOTH controllers do exactly the same thing, on purpose: push either stick
  // forward to walk, push either stick sideways to snap-turn. Nothing is
  // reserved for one hand.
  //
  // Walking is camera-relative and stays on the floor plane — the rig IS the
  // floor (see codexr-immersive-rig), so y is never touched here.

  function registerComponent(AFRAME) {
    if (!AFRAME || AFRAME.components['codexr-xr-locomotion']) {
      return;
    }

    AFRAME.registerComponent('codexr-xr-locomotion', {
      schema: {
        speed: { type: 'number', default: 2.2 },        // metres per second
        deadzone: { type: 'number', default: 0.15 },
        turnThreshold: { type: 'number', default: 0.6 },
        turnAngle: { type: 'number', default: 30 },      // degrees per snap
        // Sideways stick strafes instead of snap-turning.
        strafe: { type: 'boolean', default: false },
        cameraSelector: { type: 'string', default: '[camera]' },
        controllerSelectors: { type: 'string', default: '#leftController,#rightController' },
      },

      init: function () {
        this.axes = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
        // Snap turn must fire once per push, not once per frame.
        this.turnArmed = { left: true, right: true };
        this.listeners = [];
        this.setup = this.setup.bind(this);

        const sceneEl = this.el.sceneEl || this.el;
        if (sceneEl.hasLoaded) {
          this.setup();
        } else {
          sceneEl.addEventListener('loaded', this.setup, { once: true });
        }
      },

      remove: function () {
        this.listeners.forEach(function (entry) {
          entry.target.removeEventListener(entry.eventName, entry.handler);
        });
        this.listeners = [];
      },

      setup: function () {
        const sceneEl = this.el.sceneEl || this.el;
        const selectors = this.data.controllerSelectors.split(',');
        const sides = ['left', 'right'];
        const self = this;

        selectors.forEach(function (selector, index) {
          const el = sceneEl.querySelector(selector.trim());
          if (!el) {
            return;
          }
          const side = sides[index] || 'right';

          self.listen(el, 'thumbstickmoved', function (event) {
            const detail = event.detail || {};
            self.axes[side] = {
              x: Number(detail.x) || 0,
              y: Number(detail.y) || 0,
            };
          });

          // Fallback for controller components that publish raw axes only.
          // meta-touch-controls maps the thumbstick to axes 2 and 3.
          self.listen(el, 'axismove', function (event) {
            const axis = (event.detail && event.detail.axis) || [];
            if (axis.length < 4) {
              return;
            }
            self.axes[side] = {
              x: Number(axis[2]) || 0,
              y: Number(axis[3]) || 0,
            };
          });
        });
      },

      listen: function (target, eventName, handler) {
        target.addEventListener(eventName, handler);
        this.listeners.push({ target: target, eventName: eventName, handler: handler });
      },

      cameraYaw: function () {
        const sceneEl = this.el.sceneEl || this.el;
        const cameraEl = sceneEl.querySelector(this.data.cameraSelector);
        if (!cameraEl || !cameraEl.object3D) {
          return this.el.object3D ? this.el.object3D.rotation.y : 0;
        }
        // The camera's yaw is relative to the rig, so the rig's own yaw has to
        // be added back in to get a world heading.
        return cameraEl.object3D.rotation.y + this.el.object3D.rotation.y;
      },

      tick: function (time, delta) {
        const object3D = this.el.object3D;
        if (!object3D || !delta) {
          return;
        }
        const data = this.data;
        const step = (delta / 1000) * data.speed;

        let forward = 0;
        let sideways = 0;
        const self = this;

        ['left', 'right'].forEach(function (side) {
          const axis = self.axes[side];

          if (Math.abs(axis.y) > data.deadzone) {
            // Sticks report -1 when pushed forward.
            forward += -axis.y;
          }

          if (data.strafe) {
            if (Math.abs(axis.x) > data.deadzone) {
              sideways += axis.x;
            }
            return;
          }

          if (Math.abs(axis.x) > data.turnThreshold) {
            if (self.turnArmed[side]) {
              self.turnArmed[side] = false;
              const direction = axis.x > 0 ? -1 : 1;
              object3D.rotation.y += direction * data.turnAngle * (Math.PI / 180);
            }
          } else if (Math.abs(axis.x) < data.turnThreshold * 0.5) {
            self.turnArmed[side] = true;
          }
        });

        if (!forward && !sideways) {
          return;
        }

        // Clamp so pushing both sticks at once is not twice as fast.
        forward = Math.max(-1, Math.min(1, forward));
        sideways = Math.max(-1, Math.min(1, sideways));

        const yaw = this.cameraYaw();
        const sin = Math.sin(yaw);
        const cos = Math.cos(yaw);

        // Walking on the floor plane: y is owned by the rig's floor position.
        object3D.position.x += (forward * -sin + sideways * cos) * step;
        object3D.position.z += (forward * -cos - sideways * sin) * step;
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
