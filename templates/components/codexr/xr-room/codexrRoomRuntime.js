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
    if (!AFRAME || AFRAME.components['codexr-room']) {
      return;
    }

    AFRAME.registerComponent('codexr-room', {
      schema: {
        width: { type: 'number', default: 22 },
        depth: { type: 'number', default: 26 },
        height: { type: 'number', default: 11 },
        wallThickness: { type: 'number', default: 0.25 },
        floorThickness: { type: 'number', default: 0.18 },
        ceilingThickness: { type: 'number', default: 0.18 },
        openSide: { type: 'string', default: 'south' },
        railingHeight: { type: 'number', default: 1.2 },
        railingThickness: { type: 'number', default: 0.12 },
        wallTexture: { type: 'string', default: './assets/codexr/xr-room/textures/wall.svg' },
        floorTexture: { type: 'string', default: './assets/codexr/xr-room/textures/floor.svg' },
        ceilingTexture: { type: 'string', default: './assets/codexr/xr-room/textures/ceiling.svg' },
        railingTexture: { type: 'string', default: './assets/codexr/xr-room/textures/railing.svg' },
        wallRepeat: { type: 'string', default: '8 4' },
        floorRepeat: { type: 'string', default: '10 10' },
        ceilingRepeat: { type: 'string', default: '8 8' },
        railingRepeat: { type: 'string', default: '4 1' },
        glassRailing: { type: 'boolean', default: true },
        glassRailingOpacity: { type: 'number', default: 0.34 },
        glassRailingTint: { type: 'string', default: '#d7ecff' },
      },

      init: function () {
        this.rebuildRoom();
      },

      update: function () {
        this.rebuildRoom();
      },

      remove: function () {
        this.clearRoom();
      },

      clearRoom: function () {
        const children = this.el.querySelectorAll('[data-codexr-room-part]');
        children.forEach((child) => child.remove());
      },

      createBox: function (partName, size, position, texture, repeat, sideTag) {
        const box = document.createElement('a-box');
        box.setAttribute('data-codexr-room-part', partName);
        box.setAttribute('width', String(size.width));
        box.setAttribute('height', String(size.height));
        box.setAttribute('depth', String(size.depth));
        box.setAttribute('position', `${position.x} ${position.y} ${position.z}`);
        const glassRailingEnabled = partName === 'railing-open-side' && this.data.glassRailing;
        if (glassRailingEnabled) {
          const clampedOpacity = Math.max(0.08, Math.min(0.92, this.data.glassRailingOpacity));
          box.setAttribute('material', `color: ${this.data.glassRailingTint}; opacity: ${clampedOpacity}; transparent: true; roughness: 0.06; metalness: 0.02; side: double;`);
        } else {
          box.setAttribute('material', `src: url(${texture}); repeat: ${repeat}; roughness: 0.9; metalness: 0.02; side: double;`);
        }
        box.setAttribute('class', 'babiaxraycasterclass');
        if (sideTag) {
          box.setAttribute('data-codexr-room-side', sideTag);
        }
        return box;
      },

      normalizeOpenSide: function (side) {
        const value = (side || '').toLowerCase();
        return ['north', 'south', 'east', 'west'].includes(value) ? value : 'south';
      },

      rebuildRoom: function () {
        const data = this.data;
        const openSide = this.normalizeOpenSide(data.openSide);

        const width = Math.max(4, data.width);
        const depth = Math.max(4, data.depth);
        const height = Math.max(3, data.height);
        const wallThickness = Math.max(0.05, data.wallThickness);
        const floorThickness = Math.max(0.05, data.floorThickness);
        const ceilingThickness = Math.max(0.05, data.ceilingThickness);
        const railingHeight = Math.max(0.4, data.railingHeight);
        const railingThickness = Math.max(0.04, data.railingThickness);

        const halfWidth = width / 2;
        const halfDepth = depth / 2;
        const halfHeight = height / 2;

        this.clearRoom();

        const floor = this.createBox(
          'floor',
          { width: width, height: floorThickness, depth: depth },
          { x: 0, y: floorThickness / 2, z: 0 },
          data.floorTexture,
          data.floorRepeat,
        );

        const ceiling = this.createBox(
          'ceiling',
          { width: width, height: ceilingThickness, depth: depth },
          { x: 0, y: height - (ceilingThickness / 2), z: 0 },
          data.ceilingTexture,
          data.ceilingRepeat,
        );

        this.el.appendChild(floor);
        this.el.appendChild(ceiling);

        if (openSide !== 'north') {
          this.el.appendChild(this.createBox(
            'wall-north',
            { width: width, height: height, depth: wallThickness },
            { x: 0, y: halfHeight, z: -halfDepth },
            data.wallTexture,
            data.wallRepeat,
            'north',
          ));
        }

        if (openSide !== 'south') {
          this.el.appendChild(this.createBox(
            'wall-south',
            { width: width, height: height, depth: wallThickness },
            { x: 0, y: halfHeight, z: halfDepth },
            data.wallTexture,
            data.wallRepeat,
            'south',
          ));
        }

        if (openSide !== 'west') {
          this.el.appendChild(this.createBox(
            'wall-west',
            { width: wallThickness, height: height, depth: depth },
            { x: -halfWidth, y: halfHeight, z: 0 },
            data.wallTexture,
            data.wallRepeat,
            'west',
          ));
        }

        if (openSide !== 'east') {
          this.el.appendChild(this.createBox(
            'wall-east',
            { width: wallThickness, height: height, depth: depth },
            { x: halfWidth, y: halfHeight, z: 0 },
            data.wallTexture,
            data.wallRepeat,
            'east',
          ));
        }

        const railingPositionBySide = {
          north: { x: 0, y: railingHeight / 2, z: -halfDepth },
          south: { x: 0, y: railingHeight / 2, z: halfDepth },
          east: { x: halfWidth, y: railingHeight / 2, z: 0 },
          west: { x: -halfWidth, y: railingHeight / 2, z: 0 },
        };

        const railingSizeBySide = {
          north: { width: width, height: railingHeight, depth: railingThickness },
          south: { width: width, height: railingHeight, depth: railingThickness },
          east: { width: railingThickness, height: railingHeight, depth: depth },
          west: { width: railingThickness, height: railingHeight, depth: depth },
        };

        this.el.appendChild(this.createBox(
          'railing-open-side',
          railingSizeBySide[openSide],
          railingPositionBySide[openSide],
          data.railingTexture,
          data.railingRepeat,
          `${openSide}-railing`,
        ));
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
