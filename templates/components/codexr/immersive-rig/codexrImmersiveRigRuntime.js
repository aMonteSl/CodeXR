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

  // Immersive-entry adapter for CodeXR scenes: four small, independent jobs
  // on the component, plus two page-level compatibility patches for
  // aframe-extras' gamepad locomotion (the IWER connected-flag shim and the
  // per-hand stick gate `CodeXRStickGateRuntime`, both below).
  //
  // 1. Fly automatically in VR and AR. Desktop stays ground-based (WASD via
  //    movement-controls' own keyboard behaviour); entering any immersive
  //    session turns `fly` on for movement-controls (native aframe-extras:
  //    left stick walks, right stick turns, both by quaternion), and exiting
  //    restores whatever `fly` was before.
  //
  // 2. Restore the desktop pose on exit — for EVERY immersive entry, VR and
  //    AR alike. Flying can leave the user mid-air or outside the room, and
  //    desktop mode (fly off, no way up or through walls) cannot recover from
  //    there; the tutorial's contract is "exit returns you to the desktop
  //    spot". The pose is saved once per entry (enter-vr re-fires on headset
  //    visibility blips; the saved pose must stay the PRE-entry one).
  //
  // 3. Recenter in AR only. The virtual room is far bigger than a physical
  //    one, and the desktop spawn point sits several metres from the
  //    pedestal — in AR that lands the table across, or through, a real
  //    wall. Entering AR moves the rig to (arX, arZ) facing it (`local-floor`
  //    orients -Z to wherever the user is looking when the session starts, so
  //    yaw 0 means "in front of me"); exiting restores the exact desktop
  //    pose via job 2. VR is untouched: the whole room is the point there.
  //
  // 4. Floor-align the rig — but ONLY for a real WebXR session. Eye height
  //    lives on the rig (desktop needs it there: the camera sits at the rig
  //    origin). In a real session, three.js writes the device's local-floor
  //    pose — which already contains the user's height above their physical
  //    floor — into the CAMERA entity, on top of whatever the rig has: leave
  //    the rig at 1.75 and the user enters at 1.75 + ~1.6 ≈ 3.35 m, floating
  //    over the room (first thing the WebXR emulator showed). So on a real
  //    session the rig's y drops to 0 and the pose supplies the height; on
  //    exit the desktop height comes back with the rest of the saved pose.
  //
  //    The reliable "is this real?" signal: A-Frame assigns
  //    `sceneEl.xrSession` BEFORE emitting enter-vr for a real session
  //    (a-scene.js: setSession -> self.xrSession = xrSession ->
  //    enterVRSuccess -> emit), and it stays undefined for the simulated
  //    entries (CodeXRDebug.simulateAR/VR just add states and emit). That is
  //    what keeps all three environments at the same standing height:
  //
  //      desktop            rig 1.75 + camera 0            = 1.75
  //      simulated enter    rig 1.75 + camera 0 (no pose)  = 1.75
  //      real session       rig 0    + device pose (~1.6)  = the user's own
  //
  //    Known edge (documented, not coded around): a device that only offers
  //    the `local` reference space would deliver a pose of y ≈ 0 and the user
  //    would enter at floor level. Quest and the WebXR emulator both provide
  //    `local-floor`, which A-Frame requests by default.

  // Per-hand locomotion gate. While a controller is doing something that
  // OWNS its thumbstick (today: dragging a virtual screen, where the stick
  // pushes and pulls the grabbed screen), that hand's stick must not also
  // walk or turn the user. aframe-extras polls the gamepads directly every
  // tick — events cannot intercept it — so the claim is honoured inside the
  // getJoystick patch below. The other hand keeps its role: aframe-extras'
  // fixed scheme reads MOVEMENT from the LEFT gamepad and ROTATION from the
  // RIGHT one, so a claim only silences its own hand's function.
  function ensureStickGate(root) {
    if (!root.CodeXRStickGateRuntime) {
      const claims = { left: false, right: false };
      root.CodeXRStickGateRuntime = {
        claim: function (hand) {
          if (hand === 'left' || hand === 'right') { claims[hand] = true; }
        },
        release: function (hand) {
          if (hand === 'left' || hand === 'right') { claims[hand] = false; }
        },
        claimed: function (hand) {
          return claims[hand] === true;
        },
      };
    }
    return root.CodeXRStickGateRuntime;
  }

  function gamepadControlsPrototype(AFRAME) {
    const record = AFRAME.components && AFRAME.components['gamepad-controls'];
    return record
      ? (record.Component ? record.Component.prototype : record.prototype)
      : null;
  }

  function patchGamepadControlsJoystick(AFRAME, gate) {
    const proto = gamepadControlsPrototype(AFRAME);
    if (!proto || typeof proto.getJoystick !== 'function'
      || proto.__codexrStickGateApplied) {
      return;
    }
    proto.__codexrStickGateApplied = true;
    const original = proto.getJoystick;
    // aframe-extras' fixed joystick roles: 1 = MOVEMENT (left gamepad),
    // 2 = ROTATION (right gamepad). Everything that moves the rig funnels
    // through getJoystick, so zeroing here covers isVelocityActive,
    // isRotationActive and getVelocityDelta at once.
    proto.getJoystick = function (index, target) {
      if ((index === 1 && gate.claimed('left'))
        || (index === 2 && gate.claimed('right'))) {
        return target.set(0, 0);
      }
      return original.call(this, index, target);
    };
  }

  // aframe-extras' gamepad-controls (the stick path of movement-controls)
  // gates ALL stick input on `gamepad.connected`. Per the WebXR Gamepads
  // Module, the gamepad of an input source the session lists is connected by
  // definition — but Meta's Immersive Web Emulator (IWER) initialises its
  // Gamepad with `connected: false` and only syncs the flag inside the
  // XRTrackedInput `connected` SETTER, which nothing invokes on session
  // start. Result: trigger and laser work (A-Frame's tracked-controls never
  // reads the flag) while both sticks are silently dead in the emulator.
  // Trusting the session's input list — exactly what the spec promises —
  // makes the same build work on the emulator and on real headsets alike.
  function patchGamepadControlsConnected(AFRAME) {
    const proto = gamepadControlsPrototype(AFRAME);
    if (!proto || typeof proto.isConnected !== 'function'
      || proto.__codexrTrustsSessionInputs) {
      return;
    }
    proto.__codexrTrustsSessionInputs = true;
    const original = proto.isConnected;
    proto.isConnected = function () {
      if (original.call(this)) {
        return true;
      }
      const controllers = (this.system && this.system.controllers) || [];
      for (let i = 0; i < controllers.length; i++) {
        if (controllers[i] && controllers[i].gamepad) {
          return true;
        }
      }
      return false;
    };
  }

  // AR loses the environment's lights: aframe-environment-component parents
  // its hemisphere + directional lights under #env, #env carries
  // hide-on-enter-ar, and three.js does not descend into invisible nodes —
  // so in AR only the root ambient survives and every standard-material
  // object (charts, pedestal, logo) goes flat. This component sits on a
  // root-level directional light that idles at intensity 0 and only comes on
  // for AR sessions, restoring the directional modelling without touching
  // how desktop or VR look.
  function registerArFillLight(AFRAME) {
    if (!AFRAME || AFRAME.components['codexr-ar-fill-light']) {
      return;
    }

    AFRAME.registerComponent('codexr-ar-fill-light', {
      schema: {
        intensity: { type: 'number', default: 0.55 },
      },

      init: function () {
        this.onEnterVR = this.onEnterVR.bind(this);
        this.onExitVR = this.onExitVR.bind(this);
        const sceneEl = this.el.sceneEl;
        if (!sceneEl) {
          return;
        }
        sceneEl.addEventListener('enter-vr', this.onEnterVR);
        sceneEl.addEventListener('exit-vr', this.onExitVR);
      },

      remove: function () {
        const sceneEl = this.el.sceneEl;
        if (sceneEl) {
          sceneEl.removeEventListener('enter-vr', this.onEnterVR);
          sceneEl.removeEventListener('exit-vr', this.onExitVR);
        }
      },

      onEnterVR: function () {
        const sceneEl = this.el.sceneEl;
        const inAR = sceneEl && typeof sceneEl.is === 'function' && sceneEl.is('ar-mode');
        if (inAR) {
          this.el.setAttribute('light', 'intensity', this.data.intensity);
        }
      },

      onExitVR: function () {
        this.el.setAttribute('light', 'intensity', 0);
      },
    });
  }

  function registerComponent(AFRAME) {
    if (!AFRAME || AFRAME.components['codexr-immersive-rig']) {
      return;
    }

    patchGamepadControlsConnected(AFRAME);
    patchGamepadControlsJoystick(AFRAME, ensureStickGate(root));
    registerArFillLight(AFRAME);

    AFRAME.registerComponent('codexr-immersive-rig', {
      schema: {
        arX: { type: 'number', default: 0 },
        arZ: { type: 'number', default: 0 },
        arRecenter: { type: 'boolean', default: true },
        autoFly: { type: 'boolean', default: true },
      },

      init: function () {
        this.savedPose = null;
        this.savedFly = null;
        this.onEnterVR = this.onEnterVR.bind(this);
        this.onExitVR = this.onExitVR.bind(this);
        const sceneEl = this.el.sceneEl;
        if (!sceneEl) {
          return;
        }
        sceneEl.addEventListener('enter-vr', this.onEnterVR);
        sceneEl.addEventListener('exit-vr', this.onExitVR);
      },

      remove: function () {
        const sceneEl = this.el.sceneEl;
        if (sceneEl) {
          sceneEl.removeEventListener('enter-vr', this.onEnterVR);
          sceneEl.removeEventListener('exit-vr', this.onExitVR);
        }
      },

      onEnterVR: function () {
        const sceneEl = this.el.sceneEl;
        const object3D = this.el.object3D;
        if (!sceneEl || !object3D) {
          return;
        }
        const inAR = typeof sceneEl.is === 'function' && sceneEl.is('ar-mode');

        // Guard against a second enter-vr without an exit in between (headset
        // visibility blips re-fire it): saved state must stay whatever it was
        // BEFORE entering, never an already-adapted one.
        if (!this.savedPose) {
          this.savedPose = {
            position: object3D.position.clone(),
            rotation: object3D.rotation.clone(),
          };
        }

        if (this.data.autoFly && this.savedFly === null) {
          const movement = this.el.getAttribute('movement-controls') || {};
          this.savedFly = !!movement.fly;
          this.el.setAttribute('movement-controls', 'fly', true);
        }

        // Idempotent, so a re-fired enter-vr is harmless.
        if (inAR && this.data.arRecenter) {
          object3D.position.set(this.data.arX, object3D.position.y, this.data.arZ);
          object3D.rotation.set(0, 0, 0);
        }

        // Real WebXR session: the device pose supplies the eye height, so the
        // rig must stop supplying it too (see job 4 in the header). Simulated
        // entries have no sceneEl.xrSession and keep the desktop height.
        if (sceneEl.xrSession) {
          object3D.position.y = 0;
        }
      },

      onExitVR: function () {
        const object3D = this.el.object3D;

        if (this.savedFly !== null) {
          this.el.setAttribute('movement-controls', 'fly', this.savedFly);
          this.savedFly = null;
        }

        if (object3D && this.savedPose) {
          object3D.position.copy(this.savedPose.position);
          object3D.rotation.copy(this.savedPose.rotation);
          this.savedPose = null;
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
