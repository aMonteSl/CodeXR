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

  // Immersive-entry adapter for CodeXR scenes: three small, independent jobs.
  //
  // 1. Fly automatically in VR and AR. Desktop stays ground-based (WASD via
  //    movement-controls' own keyboard behaviour); entering any immersive
  //    session turns `fly` on for movement-controls (native aframe-extras:
  //    left stick walks, right stick turns, both by quaternion), and exiting
  //    restores whatever `fly` was before.
  //
  // 2. Recenter in AR only. The virtual room is far bigger than a physical
  //    one, and the desktop spawn point sits several metres from the
  //    pedestal — in AR that lands the table across, or through, a real
  //    wall. Entering AR moves the rig to (arX, arZ) facing it (`local-floor`
  //    orients -Z to wherever the user is looking when the session starts, so
  //    yaw 0 means "in front of me"); exiting restores the exact desktop
  //    pose. VR is untouched: the whole room is the point there.
  //
  // 3. Floor-align the rig — but ONLY for a real WebXR session. Eye height
  //    lives on the rig (desktop needs it there: the camera sits at the rig
  //    origin). In a real session, three.js writes the device's local-floor
  //    pose — which already contains the user's height above their physical
  //    floor — into the CAMERA entity, on top of whatever the rig has: leave
  //    the rig at 1.75 and the user enters at 1.75 + ~1.6 ≈ 3.35 m, floating
  //    over the room (first thing the WebXR emulator showed). So on a real
  //    session the rig's y drops to 0 and the pose supplies the height; on
  //    exit the desktop height comes back.
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

  function registerComponent(AFRAME) {
    if (!AFRAME || AFRAME.components['codexr-immersive-rig']) {
      return;
    }

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
        this.savedHeight = null;
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
        if (this.data.autoFly && this.savedFly === null) {
          const movement = this.el.getAttribute('movement-controls') || {};
          this.savedFly = !!movement.fly;
          this.el.setAttribute('movement-controls', 'fly', true);
        }

        if (inAR && this.data.arRecenter && !this.savedPose) {
          this.savedPose = {
            position: object3D.position.clone(),
            rotation: object3D.rotation.clone(),
          };
          object3D.position.set(this.data.arX, object3D.position.y, this.data.arZ);
          object3D.rotation.set(0, 0, 0);
        }

        // Real WebXR session: the device pose supplies the eye height, so the
        // rig must stop supplying it too (see job 3 in the header). Simulated
        // entries have no sceneEl.xrSession and keep the desktop height.
        if (sceneEl.xrSession && this.savedHeight === null) {
          this.savedHeight = object3D.position.y;
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

        // The AR-recenter restore above already brings the full position back;
        // this covers the VR case (no savedPose) and is a no-op after it.
        if (object3D && this.savedHeight !== null) {
          object3D.position.y = this.savedHeight;
          this.savedHeight = null;
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
