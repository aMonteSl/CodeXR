const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const runtimePath = path.join(
  projectRoot,
  'templates',
  'components',
  'codexr',
  'code-xr-boats',
  'codeXrBoatsRuntime.js',
);
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const visualStyleRuntimePath = path.join(projectRoot, 'templates', 'components', 'common', 'codexrVisualStyleRuntime.js');
const visualStyleRuntimeSource = fs.readFileSync(visualStyleRuntimePath, 'utf8');

function loadVisualStyleRuntime() {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console: {
      log() {},
      warn() {},
      error() {},
    },
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(visualStyleRuntimeSource, sandbox, { filename: visualStyleRuntimePath });
  return sandbox.module.exports;
}

function loadRuntime(extra = {}) {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console: {
      log() {},
      warn() {},
      error() {},
    },
    CodeXRVisualStyleRuntime: loadVisualStyleRuntime(),
    ...extra,
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(runtimeSource, sandbox, { filename: runtimePath });
  return sandbox.module.exports;
}

function defaultOptions(runtime, overrides = {}) {
  return runtime.__testing.buildOptions({
    area: 'area',
    height: 'height',
    color: 'color',
    palette: 'ubuntu',
    separation: 0.5,
    extra: 1,
    zone_elevation: 0.01,
    ...overrides,
  });
}

function collectAbsoluteLayoutItems(nodes) {
  const items = [];
  function visit(figure, origin = { x: 0, z: 0 }, ancestors = []) {
    const center = {
      x: origin.x + (figure.x || 0),
      z: origin.z + (figure.z || 0),
    };
    const item = {
      figure,
      ancestors,
      minX: center.x - figure.width * 0.5,
      maxX: center.x + figure.width * 0.5,
      minZ: center.z - figure.depth * 0.5,
      maxZ: center.z + figure.depth * 0.5,
    };
    items.push(item);
    const nextAncestors = figure.kind === 'quarter' ? [...ancestors, item] : ancestors;
    (figure.children || []).forEach((child) => visit(child, center, nextAncestors));
  }
  (nodes || []).forEach((node) => visit(node));
  return items;
}

function assertInside(container, item, tolerance = 0.000001) {
  assert.ok(item.minX >= container.minX - tolerance, `${item.figure.name} minX is outside ${container.figure.name}`);
  assert.ok(item.maxX <= container.maxX + tolerance, `${item.figure.name} maxX is outside ${container.figure.name}`);
  assert.ok(item.minZ >= container.minZ - tolerance, `${item.figure.name} minZ is outside ${container.figure.name}`);
  assert.ok(item.maxZ <= container.maxZ + tolerance, `${item.figure.name} maxZ is outside ${container.figure.name}`);
}

test('CodeXR boats runtime registers the codexr-boats A-Frame component', () => {
  const registered = {};
  const runtime = loadRuntime({
    AFRAME: {
      components: registered,
      registerComponent(name, definition) {
        registered[name] = definition;
      },
    },
  });

  assert.equal(typeof runtime.registerComponent, 'function');
  assert.ok(registered['codexr-boats']);
  assert.equal(registered['codexr-boats'].schema.area.default, 'area');
  assert.equal(registered['codexr-boats'].schema.height.default, 'height');
  assert.equal(registered['codexr-boats'].schema.color.default, 'color');
  assert.equal(registered['codexr-boats'].schema.animation.default, true);
  assert.equal(registered['codexr-boats'].schema.animationDuration.default, 1200);
  assert.equal(registered['codexr-boats'].schema.hideQuarterBoxLegend.default, true);
  assert.equal(registered['codexr-boats'].schema.zone_step_thickness.default, 0.012);
  assert.equal(registered['codexr-boats'].schema.zone_step_rise.default, 0.018);
  assert.equal(registered['codexr-boats'].schema.zone_base_color.default, '#4f9e54');
  assert.equal(registered['codexr-boats'].schema.zone_top_color.default, '#b8f7b0');
  assert.equal(registered['codexr-boats'].schema.minBuildingHeight.default, 0.22);
  assert.equal(registered['codexr-boats'].schema.fixed_size.default, true);
  assert.equal(registered['codexr-boats'].schema.fixed_width.default, 17.8);
  assert.equal(registered['codexr-boats'].schema.fixed_depth.default, 6.3);
  assert.equal(registered['codexr-boats'].schema.fixed_height.default, 1.174);
  assert.equal(registered['codexr-boats'].schema.fixed_padding.default, 0.18);
});

test('CodeXR boats layout normalizes numeric area and height while preserving tiny values', () => {
  const runtime = loadRuntime();
  const layout = runtime.__testing.buildLayout([
    {
      name: 'src',
      children: [
        { name: 'small.js', area: 0, height: 1, color: 'low' },
        { name: 'large.js', area: 16, height: 100, color: 'high' },
      ],
    },
  ], defaultOptions(runtime, { fixed_size: false }));

  const quarter = layout.nodes[0];
  const small = quarter.children[0];
  const large = quarter.children[1];

  assert.equal(layout.stats.leafCount, 2);
  assert.equal(quarter.kind, 'quarter');
  assert.equal(small.kind, 'building');
  assert.equal(large.kind, 'building');
  assert.ok(small.width >= 0.45);
  assert.ok(large.width > small.width);
  assert.ok(small.height >= 0.03);
  assert.ok(large.height <= 2);
  assert.ok(large.height > small.height);
});

test('CodeXR boats can cap local building height for table containment margin', () => {
  const runtime = loadRuntime();
  const layout = runtime.__testing.buildLayout([
    {
      name: 'src',
      children: [
        { name: 'small.js', area: 1, height: 1, color: 'low' },
        { name: 'large.js', area: 16, height: 1000, color: 'high' },
      ],
    },
  ], defaultOptions(runtime, {
    maxBuildingHeight: 1.15,
    fixed_size: false,
  }));

  const large = layout.nodes[0].children[1];
  assert.equal(Number(large.height.toFixed(6)), 1.15);
});

test('CodeXR boats fixed-size layout keeps a stable local box across data and mapping changes', () => {
  const runtime = loadRuntime();
  const options = defaultOptions(runtime, {
    fixed_size: true,
    fixed_width: 10,
    fixed_depth: 4,
    fixed_height: 1.2,
    fixed_padding: 0.2,
  });
  const small = runtime.__testing.buildLayout([
    { name: 'one.ts', area: 1, height: 1, color: 'low' },
  ], options);
  const large = runtime.__testing.buildLayout([
    {
      name: 'src',
      children: [
        { name: 'a.ts', area: 1, height: 4, heightLarge: 400, color: 'low' },
        { name: 'b.ts', area: 16, height: 80, heightLarge: 1000, color: 'high' },
        { name: 'c.ts', area: 9, height: 25, heightLarge: 50, color: 'mid' },
      ],
    },
  ], options);
  const remapped = runtime.__testing.buildLayout(large.nodes.map((node) => node.raw), defaultOptions(runtime, {
    height: 'heightLarge',
    fixed_size: true,
    fixed_width: 10,
    fixed_depth: 4,
    fixed_height: 1.2,
    fixed_padding: 0.2,
  }));

  [small, large, remapped].forEach((layout) => {
    assert.equal(Number(layout.bounds.size.x.toFixed(3)), 9.6);
    assert.equal(Number(layout.bounds.size.z.toFixed(3)), 3.6);
    assert.equal(Number(layout.bounds.size.y.toFixed(3)), 1.2);
    if (layout.nodes[0].kind === 'quarter') {
      assert.equal(Number(layout.nodes[0].width.toFixed(3)), 9.6);
      assert.equal(Number(layout.nodes[0].depth.toFixed(3)), 3.6);
      assert.equal(layout.nodes[0].fixedRootSlab, true);
      assert.equal(Number(layout.bounds.fixed.rootWidth.toFixed(3)), 9.6);
      assert.equal(Number(layout.bounds.fixed.rootDepth.toFixed(3)), 3.6);
    }
    assert.equal(layout.bounds.min.y, 0);
    assert.ok(Math.abs(layout.bounds.min.x + 4.8) < 0.001);
    assert.ok(Math.abs(layout.bounds.max.x - 4.8) < 0.001);
  });
});

test('CodeXR boats fixed root slab stays stable across area remapping extremes', () => {
  const runtime = loadRuntime();
  const tree = [
    {
      name: 'project',
      children: [
        { name: 'a.ts', functionCount: 1, commentRatio: 0.01, totalLines: 30, color: 1 },
        { name: 'b.ts', functionCount: 30, commentRatio: 0.75, totalLines: 120, color: 5 },
        { name: 'c.ts', functionCount: 3, commentRatio: 0.2, totalLines: 75, color: 9 },
      ],
    },
  ];
  const functionArea = runtime.__testing.buildLayout(tree, defaultOptions(runtime, {
    area: 'functionCount',
    height: 'totalLines',
    fixed_width: 12,
    fixed_depth: 5,
    fixed_padding: 0.25,
  }));
  const ratioArea = runtime.__testing.buildLayout(tree, defaultOptions(runtime, {
    area: 'commentRatio',
    height: 'totalLines',
    fixed_width: 12,
    fixed_depth: 5,
    fixed_padding: 0.25,
  }));

  [functionArea, ratioArea].forEach((layout) => {
    assert.equal(Number(layout.nodes[0].width.toFixed(3)), 11.5);
    assert.equal(Number(layout.nodes[0].depth.toFixed(3)), 4.5);
    assert.equal(Number(layout.bounds.size.x.toFixed(3)), 11.5);
    assert.equal(Number(layout.bounds.size.z.toFixed(3)), 4.5);
  });
});

test('CodeXR boats layout creates elevated path quarters with deterministic spacing', () => {
  const runtime = loadRuntime();
  const layout = runtime.__testing.buildLayout([
    {
      name: 'src',
      children: [
        {
          name: 'services',
          children: [
            { name: 'auth.ts', area: 2, height: 8, color: 3 },
          ],
        },
        {
          name: 'views',
          children: [
            { name: 'login.ts', area: 2, height: 5, color: 1 },
          ],
        },
      ],
    },
  ], defaultOptions(runtime, { fixed_size: false }));

  const src = layout.nodes[0];
  const services = src.children[0];
  const views = src.children[1];

  assert.equal(src.kind, 'quarter');
  assert.equal(services.kind, 'quarter');
  assert.equal(views.kind, 'quarter');
  assert.ok(src.height > 0);
  assert.ok(services.height > src.height);
  assert.notEqual(services.x, views.x);
  assert.ok(layout.width > 0);
  assert.ok(layout.depth > 0);
  assert.ok(layout.bounds);
  assert.equal(layout.bounds.min.y, 0);
});

test('CodeXR boats layout keeps buildings inside every directory ancestor', () => {
  const runtime = loadRuntime();
  const layout = runtime.__testing.buildLayout([
    {
      name: 'src',
      children: [
        {
          name: 'services',
          children: [
            { name: 'auth.ts', area: 2, height: 8, color: 3 },
            { name: 'session.ts', area: 9, height: 13, color: 4 },
          ],
        },
        {
          name: 'views',
          children: [
            { name: 'login.ts', area: 16, height: 5, color: 1 },
            { name: 'home.ts', area: 4, height: 21, color: 2 },
          ],
        },
      ],
    },
  ], defaultOptions(runtime, {
    fixed_size: true,
    fixed_width: 17.8,
    fixed_depth: 6.3,
    fixed_height: 1.174,
  }));

  const items = collectAbsoluteLayoutItems(layout.nodes);
  items.filter((item) => item.figure.kind === 'building').forEach((building) => {
    assert.ok(building.ancestors.length >= 1, `${building.figure.name} should have a directory ancestor`);
    building.ancestors.forEach((ancestor) => assertInside(ancestor, building));
  });
});

test('CodeXR boats quarter slabs are thin while rise controls directory elevation', () => {
  const runtime = loadRuntime();
  const layout = runtime.__testing.buildLayout([
    {
      name: 'src',
      children: [
        {
          name: 'services',
          children: [
            { name: 'auth.ts', area: 2, height: 8, color: 3 },
          ],
        },
      ],
    },
  ], defaultOptions(runtime, { fixed_size: false }));

  const src = layout.nodes[0];
  const services = src.children[0];

  assert.equal(Number(src.thickness.toFixed(3)), 0.012);
  assert.equal(Number(src.height.toFixed(3)), 0.018);
  assert.equal(Number(services.thickness.toFixed(3)), 0.012);
  assert.equal(Number(services.height.toFixed(3)), 0.036);
  assert.ok(services.height > services.thickness);
  assert.equal(layout.bounds.min.y, 0);
  assert.ok(layout.bounds.max.y < 2.05);
});

test('CodeXR boats render path supports children on the slab top instead of the abstract rise', () => {
  assert.match(runtimeSource, /'data-codexr-boats-kind': 'quarter'/);
  assert.match(runtimeSource, /'data-codexr-boats-key': figure\.key/);
  assert.match(runtimeSource, /snapshotRole: 'frame'/);
  assert.match(runtimeSource, /animatePosition: false/);
  assert.match(runtimeSource, /holdPlanarSize: true/);
  assert.match(runtimeSource, /resolveContainmentSafePlanarSize/);
  assert.match(runtimeSource, /position: '0 ' \+ baseHeight \+ ' 0'/);
  assert.match(runtimeSource, /var childOrigin = \{[\s\S]*y: groupOrigin\.y \+ baseHeight/);
  assert.match(runtimeSource, /renderBuilding\(component, childLayer, child, options, snapshots, childOrigin\)/);
  assert.match(runtimeSource, /renderQuarter\(childLayer, child, options, depth \+ 1, component, snapshots, childOrigin\)/);
  assert.doesNotMatch(runtimeSource, /y: oy \+ \(figure\.height \|\| 0\)/);
});

test('CodeXR boats containment-safe quarter size expands immediately and defers shrink', () => {
  const runtime = loadRuntime();
  const expanding = runtime.__testing.resolveContainmentSafePlanarSize(
    { width: '2', depth: '1.5' },
    { width: 4, depth: 3 },
  );
  assert.equal(Number(expanding.width.toFixed(2)), 4.56);
  assert.equal(Number(expanding.depth.toFixed(2)), 3.42);
  assert.equal(expanding.shouldHoldWidth, true);
  assert.equal(expanding.shouldHoldDepth, true);

  const shrinking = runtime.__testing.resolveContainmentSafePlanarSize(
    { width: '6', depth: '5' },
    { width: 3, depth: 2 },
  );
  assert.equal(Number(shrinking.width.toFixed(2)), 6.84);
  assert.equal(Number(shrinking.depth.toFixed(2)), 5.7);
  assert.equal(shrinking.shouldHoldWidth, true);
  assert.equal(shrinking.shouldHoldDepth, true);
});

test('CodeXR boats quarter colors lighten as directory depth increases', () => {
  const runtime = loadRuntime();
  const options = defaultOptions(runtime);
  const layout = runtime.__testing.buildLayout([
    {
      name: 'src',
      children: [
        {
          name: 'services',
          children: [
            { name: 'auth.ts', area: 2, height: 8, color: 3 },
          ],
        },
      ],
    },
  ], options);

  const src = layout.nodes[0];
  const services = src.children[0];

  assert.equal(src.color, '#4f9e54');
  assert.notEqual(services.color, src.color);
  assert.equal(runtime.__testing.mixHexColor('#4f9e54', '#b8f7b0', 1), '#b8f7b0');
});

test('CodeXR boats color maps numeric values through a blue-to-red semantic gradient', () => {
  const runtime = loadRuntime();
  const layout = runtime.__testing.buildLayout([
    {
      name: 'src',
      children: [
        { name: 'low.ts', area: 1, height: 1, color: 1 },
        { name: 'mid.ts', area: 1, height: 1, color: 5 },
        { name: 'high.ts', area: 1, height: 1, color: 9 },
      ],
    },
  ], defaultOptions(runtime));
  const [low, mid, high] = layout.nodes[0].children;

  assert.equal(layout.stats.color.mode, 'numeric');
  assert.equal(low.color, '#13528a');
  assert.equal(mid.color, '#89586f');
  assert.equal(high.color, '#ff5e53');
});

test('CodeXR boats color uses a neutral midpoint when numeric values are equal', () => {
  const runtime = loadRuntime();
  const layout = runtime.__testing.buildLayout([
    { name: 'one.ts', area: 1, height: 1, color: 3 },
    { name: 'two.ts', area: 1, height: 1, color: 3 },
  ], defaultOptions(runtime));

  assert.equal(layout.stats.color.mode, 'numeric');
  layout.nodes.forEach((node) => {
    assert.equal(node.color, '#89586f');
  });
});

test('CodeXR boats color maps categorical values in deterministic Babia appearance order', () => {
  const runtime = loadRuntime();
  const options = defaultOptions(runtime);
  const layout = runtime.__testing.buildLayout([
    { name: 'js.ts', area: 1, height: 1, color: 'JavaScript' },
    { name: 'py.py', area: 1, height: 1, color: 'Python' },
  ], options);
  const fresh = runtime.__testing.buildLayout([
    { name: 'js-again.ts', area: 1, height: 1, color: 'JavaScript' },
    { name: 'py-again.py', area: 1, height: 1, color: 'Python' },
  ], options);

  assert.equal(layout.stats.color.mode, 'categorical');
  assert.equal(layout.nodes[0].color, '#ffb75f');
  assert.equal(layout.nodes[1].color, '#8e009a');
  assert.equal(fresh.nodes[0].color, '#ffb75f');
  assert.equal(fresh.nodes[1].color, '#8e009a');
  assert.notEqual(layout.nodes[0].color, layout.nodes[1].color);
});

test('CodeXR boats derives temporal building tiers from modification metadata', () => {
  const runtime = loadRuntime();
  const layout = runtime.__testing.buildLayout([
    { name: 'legacy.ts', area: 1, height: 1, color: 1, modifiedAtMs: 1000 },
    { name: 'aged.ts', area: 1, height: 1, color: 2, modifiedAtMs: 2000 },
    { name: 'current.ts', area: 1, height: 1, color: 3, modifiedAtMs: 3000 },
    { name: 'fresh.ts', area: 1, height: 1, color: 4, modifiedAtMs: 5000 },
  ], defaultOptions(runtime));

  assert.equal(layout.nodes[0].temporalTier, 'legacy');
  assert.equal(layout.nodes[1].temporalTier, 'aged');
  assert.equal(layout.nodes[2].temporalTier, 'current');
  assert.equal(layout.nodes[3].temporalTier, 'fresh');
  assert.equal(layout.stats.temporal.tierCounts.legacy, 1);
  assert.equal(layout.stats.temporal.tierCounts.aged, 1);
  assert.equal(layout.stats.temporal.tierCounts.current, 1);
  assert.equal(layout.stats.temporal.tierCounts.fresh, 1);
  assert.equal(layout.stats.temporal.skinCounts.legacy, 1);
  assert.equal(layout.stats.temporal.skinCounts.aged, 1);
  assert.equal(layout.stats.temporal.skinCounts.current, 1);
  assert.equal(layout.stats.temporal.skinCounts.fresh, 1);
  assert.equal(layout.stats.temporal.shapeCounts.legacy, 1);
  assert.equal(layout.stats.temporal.shapeCounts.aged, 1);
  assert.equal(layout.stats.temporal.shapeCounts.current, 1);
  assert.equal(layout.stats.temporal.shapeCounts.fresh, 1);
  assert.equal(layout.stats.temporal.oldest, 1000000);
  assert.equal(layout.stats.temporal.newest, 5000000);
});

test('CodeXR boats keeps mapped color independent from temporal style', () => {
  const runtime = loadRuntime();
  const layout = runtime.__testing.buildLayout([
    { name: 'old.ts', area: 1, height: 1, color: 1, modifiedAtMs: 1000 },
    { name: 'new.ts', area: 1, height: 1, color: 9, modifiedAtMs: 5000 },
  ], defaultOptions(runtime));

  assert.equal(layout.nodes[0].color, '#13528a');
  assert.equal(layout.nodes[1].color, '#ff5e53');
  assert.equal(layout.nodes[0].temporalTier, 'legacy');
  assert.equal(layout.nodes[1].temporalTier, 'fresh');
});

test('CodeXR boats separates metric envelope from visible temporal pieces', () => {
  const runtime = loadRuntime();
  const figure = {
    width: 1,
    depth: 0.8,
    height: 0.9,
    color: '#13528a',
    temporalTier: 'fresh',
  };
  const profile = runtime.__testing.getVisualStyleRuntime().getTemporalStyleProfile('fresh');
  const descriptors = runtime.__testing.buildTemporalSkinDescriptors(figure, profile, './skins');
  const planes = descriptors.filter((descriptor) => descriptor.tag === 'a-plane');
  const shapePieces = runtime.__testing.buildTemporalShapeDescriptors(figure, profile);

  assert.equal(planes.length, 5);
  assert.ok(planes.some((descriptor) => descriptor.name === 'wall-front' && descriptor.attributes.material.includes('fresh-wall.svg')));
  assert.ok(planes.some((descriptor) => descriptor.name === 'roof' && descriptor.attributes.material.includes('fresh-roof.svg')));
  assert.ok(planes.find((descriptor) => descriptor.name === 'wall-front').attributes.width >= figure.width);
  assert.ok(planes.find((descriptor) => descriptor.name === 'wall-front').attributes.height >= figure.height);
  assert.ok(planes.find((descriptor) => descriptor.name === 'roof').attributes.width >= figure.width);
  assert.ok(planes.find((descriptor) => descriptor.name === 'roof').attributes.height >= figure.depth);
  assert.ok(planes.every((descriptor) => descriptor.attributes['data-codexr-role'] === 'aux temporal-skin'));
  assert.ok(planes.every((descriptor) => descriptor.attributes.class.includes('codexr-boats-aux')));
  assert.equal(figure.width, 1);
  assert.equal(figure.depth, 0.8);
  assert.equal(figure.height, 0.9);
  assert.ok(runtime.__testing.metricEnvelopeMaterial().includes('opacity: 0.001'));
  assert.ok(runtime.__testing.metricEnvelopeMaterial().includes('transparent: true'));
  assert.ok(shapePieces.length >= 4);
  assert.ok(shapePieces.every((descriptor) => descriptor.attributes.material.includes('#13528a')));
  assert.ok(shapePieces.every((descriptor) => descriptor.attributes.material.includes('transparent: false')));
  assert.ok(shapePieces.every((descriptor) => descriptor.attributes['data-codexr-boats-key'] === undefined));
  assert.ok(shapePieces.every((descriptor) => !(descriptor.dimensions.width === figure.width && descriptor.dimensions.depth === figure.depth && descriptor.dimensions.height === figure.height)));
  assert.match(runtimeSource, /data-codexr-visible-body': 'metric-envelope'/);
  assert.match(runtimeSource, /renderVisibleBuildingPieces\(entity, figure, profile, options\)/);
  assert.doesNotMatch(runtimeSource, /renderTemporalSkin\(entity, figure, profile, options\)/);
  assert.match(runtimeSource, /function renderTemporalSkin/);
  assert.match(runtimeSource, /src: url\(/);
  assert.match(runtimeSource, /'data-codexr-role': 'aux temporal-skin'/);
  assert.match(runtimeSource, /class: AUX_CLASS,\s*'data-codexr-role': 'aux temporal-skin'/);
  assert.doesNotMatch(runtimeSource, /buildMaterialString\(figure\.color, figure\.temporalTier/);
});

test('CodeXR boats temporal descriptors produce distinct SVG silhouettes by tier', () => {
  const runtime = loadRuntime();
  const visualStyle = runtime.__testing.getVisualStyleRuntime();
  const figure = { width: 1, depth: 1, height: 1 };
  const signatures = visualStyle.TEMPORAL_TIERS.map((tier) => {
    const descriptors = runtime.__testing.buildTemporalSkinDescriptors(
      { ...figure, temporalTier: tier },
      visualStyle.getTemporalStyleProfile(tier),
      './skins',
    );
    const roof = descriptors.find((descriptor) => descriptor.name === 'roof');
    const silhouette = descriptors.find((descriptor) => descriptor.type === 'silhouette');
    return `${tier}:${roof.attributes.material}:${silhouette.assets.silhouette}`;
  });

  assert.equal(new Set(signatures).size, 4);
  assert.ok(signatures.every((signature) => signature.includes('-roof.svg')));
});

test('CodeXR boats temporal shape descriptors stay auxiliary and inside metric envelope', () => {
  const runtime = loadRuntime();
  const visualStyle = runtime.__testing.getVisualStyleRuntime();
  const figure = { width: 1.2, depth: 0.8, height: 1, color: '#ff5e53', temporalTier: 'current' };
  const signatures = visualStyle.TEMPORAL_TIERS.map((tier) => {
    const tierFigure = { ...figure, temporalTier: tier };
    const descriptors = runtime.__testing.buildTemporalShapeDescriptors(
      tierFigure,
      visualStyle.getTemporalStyleProfile(tier),
    );
    assert.ok(descriptors.length >= 4, `${tier} should have visible shape pieces`);
    descriptors.forEach((descriptor) => {
      assert.equal(descriptor.tag, 'a-box');
      assert.equal(descriptor.attributes['data-codexr-role'], 'aux temporal-shape');
      assert.equal(descriptor.attributes.class, 'codexr-boats-auxiliary');
      assert.equal(descriptor.attributes['data-codexr-boats-key'], undefined);
      assert.match(descriptor.attributes.material, /#ff5e53/);
      assert.match(descriptor.attributes.material, /transparent: false/);
      assert.ok(descriptor.dimensions.width < tierFigure.width || descriptor.dimensions.depth < tierFigure.depth || descriptor.dimensions.height < tierFigure.height);
      assert.ok(descriptor.bounds.minX >= -tierFigure.width * 0.5 - 0.000001);
      assert.ok(descriptor.bounds.maxX <= tierFigure.width * 0.5 + 0.000001);
      assert.ok(descriptor.bounds.minY >= -tierFigure.height * 0.5 - 0.000001);
      assert.ok(descriptor.bounds.maxY <= tierFigure.height * 0.5 + 0.000001);
      assert.ok(descriptor.bounds.minZ >= -tierFigure.depth * 0.5 - 0.000001);
      assert.ok(descriptor.bounds.maxZ <= tierFigure.depth * 0.5 + 0.000001);
    });
    return `${tier}:${descriptors.map((descriptor) => descriptor.name).join('|')}`;
  });

  assert.equal(new Set(signatures).size, 4);
});

test('CodeXR boats tooltip includes modification and temporal tier rows', () => {
  const runtime = loadRuntime();
  const layout = runtime.__testing.buildLayout([
    { name: 'fresh.ts', area: 1, height: 1, color: 1, modifiedAtMs: 5000 },
    { name: 'older.ts', area: 1, height: 1, color: 2, modifiedAtMs: 1000 },
  ], defaultOptions(runtime));
  const detail = runtime.__testing.buildTooltipDetail(layout.nodes[0], defaultOptions(runtime));

  assert.ok(detail.rows.some((row) => row.label === 'Modified'));
  assert.ok(detail.rows.some((row) => row.label === 'Age tier'));
  assert.ok(detail.rows.some((row) => row.label === 'Recency'));
});

test('CodeXR boats keeps low-height buildings legible even with high outliers', () => {
  const runtime = loadRuntime();
  const layout = runtime.__testing.buildLayout([
    {
      name: 'src',
      children: [
        { name: 'tiny.ts', area: 1, height: 1, color: 1 },
        { name: 'small.ts', area: 1, height: 2, color: 2 },
        { name: 'huge.ts', area: 1, height: 10000, color: 3 },
      ],
    },
  ], defaultOptions(runtime, {
    minBuildingHeight: 0.22,
    maxBuildingHeight: 1.15,
    fixed_size: false,
  }));
  const [tiny, small, huge] = layout.nodes[0].children;

  assert.equal(Number(tiny.height.toFixed(3)), 0.22);
  assert.ok(small.height > tiny.height);
  assert.equal(Number(huge.height.toFixed(3)), 1.15);
  assert.equal(layout.stats.heightP50, 2);
  assert.ok(layout.stats.heightAvg > layout.stats.heightP50);
});

test('CodeXR boats preserves the visual building floor after fixed-box normalization', () => {
  const runtime = loadRuntime();
  const layout = runtime.__testing.buildLayout([
    {
      name: 'src',
      children: [
        { name: 'tiny.ts', area: 1, height: 1, color: 1 },
        { name: 'small.ts', area: 1, height: 2, color: 2 },
        { name: 'huge.ts', area: 1, height: 10000, color: 3 },
      ],
    },
  ], defaultOptions(runtime, {
    minBuildingHeight: 0.22,
    maxBuildingHeight: 1.15,
    fixed_size: true,
    fixed_width: 17.8,
    fixed_depth: 6.3,
    fixed_height: 1.174,
  }));

  const buildings = collectAbsoluteLayoutItems(layout.nodes).filter((item) => item.figure.kind === 'building');
  assert.ok(buildings.length >= 3);
  buildings.forEach((item) => {
    assert.ok(item.figure.height >= 0.22, `${item.figure.name} height should keep the visual floor`);
  });
  assert.equal(Number(layout.bounds.fixed.buildingHeightFloor.toFixed(3)), 0.22);
  assert.ok(layout.bounds.max.y <= layout.bounds.fixed.height + 0.000001);
});

test('CodeXR boats layout keeps all primary geometry on or above the local floor', () => {
  const runtime = loadRuntime();
  const layout = runtime.__testing.buildLayout([
    {
      name: 'root',
      children: [
        {
          name: 'nested',
          children: [
            { name: 'tiny.ts', area: 0, height: 0, color: 'tiny' },
            { name: 'tall.ts', area: 9, height: 90, color: 'tall' },
          ],
        },
      ],
    },
  ], defaultOptions(runtime));

  const bounds = runtime.__testing.computeLayoutBounds(layout.nodes);
  assert.equal(bounds.min.y, 0);
  assert.ok(bounds.max.y > 0);
  assert.ok(layout.bounds.size.y > 0);
});

test('CodeXR boats tooltip details describe buildings and directory quarters', () => {
  const runtime = loadRuntime();
  const options = defaultOptions(runtime, {
    area: 'parameters',
    height: 'lineCount',
    color: 'complexity',
  });
  const layout = runtime.__testing.buildLayout([
    {
      name: 'src',
      children: [
        { name: 'main.ts', filePath: 'src/main.ts', parameters: 2, lineCount: 44, complexity: 7 },
      ],
    },
  ], options);

  const quarter = layout.nodes[0];
  const building = quarter.children[0];
  const quarterDetail = runtime.__testing.buildTooltipDetail(quarter, options);
  const buildingDetail = runtime.__testing.buildTooltipDetail(building, options);

  assert.equal(quarterDetail.title, 'src');
  assert.match(quarterDetail.subtitle, /src/);
  assert.match(quarterDetail.primary, /Directory/);
  assert.equal(buildingDetail.title, 'main.ts');
  assert.match(buildingDetail.subtitle, /src\/main\.ts/);
  assert.match(buildingDetail.primary, /parameters: 2/);
  assert.match(buildingDetail.primary, /lineCount: 44/);
  assert.match(buildingDetail.secondary, /complexity: 7/);
});

test('CodeXR boats runtime source uses common tooltip and keyed animations', () => {
  assert.match(runtimeSource, /CodeXRCommonRuntime\.createTooltip/);
  assert.match(runtimeSource, /CodeXRCommonRuntime\.updateTooltip/);
  assert.match(runtimeSource, /CodeXRCommonRuntime\.faceCamera/);
  assert.match(runtimeSource, /connectorTarget/);
  assert.match(runtimeSource, /data-codexr-interactive/);
  assert.match(runtimeSource, /data-codexr-boats-key/);
  assert.match(runtimeSource, /pinnedTooltips/);
  assert.match(runtimeSource, /clearTooltips: function/);
  assert.match(runtimeSource, /togglePinnedTooltip/);
  assert.match(runtimeSource, /addEventListener\('click'/);
  assert.match(runtimeSource, /refreshPinnedTooltips/);
  assert.match(runtimeSource, /animation__codexr_/);
  assert.match(runtimeSource, /collectRenderRoots/);
  assert.match(runtimeSource, /activeRenderRoot/);
  assert.match(runtimeSource, /pendingRenderRoot/);
  assert.match(runtimeSource, /getActiveRenderRoot/);
  assert.match(runtimeSource, /collectElementSnapshots\(activeRenderRoot\)/);
  assert.match(runtimeSource, /nearlySameVec3/);
  assert.match(runtimeSource, /requestAnimationFrame/);
  assert.match(runtimeSource, /setMaterialProperty/);
  assert.match(runtimeSource, /entity\.setAttribute\('width', snapshot\.width\)/);
  assert.match(runtimeSource, /setMaterialProperty\(entity, 'opacity', 0\)/);
  assert.doesNotMatch(runtimeSource, /component\.figureElements = \{\};\s*clearEntity\(el\);/);
  assert.match(runtimeSource, /animation__codexr_hover_color/);
  assert.match(runtimeSource, /animation__codexr_hover_emissive/);
  assert.doesNotMatch(runtimeSource, /animation__codexr_hover_scale/);
  assert.match(runtimeSource, /codexr-boats-rendered/);
  assert.match(runtimeSource, /moveTooltipToHost/);
  assert.match(runtimeSource, /sceneEl/);
  assert.doesNotMatch(runtimeSource, /Directory . children/);
});

test('CodeXR boats tooltip anchors above the tallest chart element', () => {
  const runtime = loadRuntime();
  const anchor = runtime.__testing.getTooltipAnchor(
    {
      layout: {
        bounds: {
          min: { x: -2, y: 0, z: -3 },
          max: { x: 2, y: 4, z: 1 },
        },
      },
    },
    null,
    {
      tooltipPosition: { x: 0.5, y: 0.8, z: -2 },
    },
    1.4,
  );

  assert.equal(anchor.x, 0.5);
  assert.equal(anchor.z, -1);
  assert.ok(anchor.y > 4 + 0.6);
});

test('CodeXR boats tooltip anchor escapes chart scaling when object3D is available', () => {
  const runtime = loadRuntime({
    THREE: {
      Vector3: class Vector3 {
        constructor(x = 0, y = 0, z = 0) {
          this.x = x;
          this.y = y;
          this.z = z;
        }
      },
    },
  });
  const anchor = runtime.__testing.getTooltipAnchor(
    {
      el: {
        object3D: {
          updateMatrixWorld() {},
          localToWorld(vector) {
            vector.x = 10 + vector.x * 2;
            vector.y = 1 + vector.y * 0.25;
            vector.z = -18 + vector.z * 2;
            return vector;
          },
        },
      },
      layout: {
        bounds: {
          min: { x: -2, y: 0, z: -3 },
          max: { x: 2, y: 4, z: 1 },
        },
      },
    },
    null,
    {
      tooltipPosition: { x: 0.5, y: 0.8, z: -2 },
    },
    1.02,
  );

  assert.equal(anchor.x, 11);
  assert.equal(anchor.z, -20);
  assert.ok(anchor.y > 2.5);
});

test('CodeXR boats tooltip compacts long paths for readable hover cards', () => {
  const runtime = loadRuntime();
  const compacted = runtime.__testing.compactPath('src/a/b/c/d/e/generate_structure_codexr.js', 34);

  assert.match(compacted, /^\.\.\./);
  assert.match(compacted, /generate_structure_codexr\.js$/);
  assert.ok(compacted.length <= 34);
});

test('CodeXR boats snapshots use active visible root and current object3D positions', () => {
  const runtime = loadRuntime();
  const rootEl = {
    parentNode: {},
    object3D: { visible: true, position: { x: 0, y: 0, z: 0 } },
    getAttribute(name) {
      return name === 'visible' ? true : null;
    },
  };
  const layerEl = {
    parentNode: rootEl,
    object3D: { position: { x: 3, y: 0.4, z: -2 } },
    getAttribute(name) {
      return name === 'position' ? '99 99 99' : null;
    },
  };
  const buildingEl = {
    parentNode: layerEl,
    object3D: { position: { x: 0.25, y: 0.8, z: 0.5 } },
    getAttribute(name) {
      const values = {
        'data-codexr-boats-key': 'building:src/a.ts',
        position: '88 88 88',
        width: '1',
        height: '2',
        depth: '3',
        material: 'color: #ff5733; opacity: 0.7',
      };
      return values[name] || null;
    },
  };
  rootEl.querySelectorAll = () => [buildingEl];

  const snapshots = runtime.__testing.collectElementSnapshots(rootEl);
  assert.equal(snapshots['building:src/a.ts'].chartPosition.x, 3.25);
  assert.equal(snapshots['building:src/a.ts'].chartPosition.y, 1.2000000000000002);
  assert.equal(snapshots['building:src/a.ts'].chartPosition.z, -1.5);
  assert.equal(snapshots['building:src/a.ts'].parentKey, null);

  rootEl.getAttribute = (name) => (name === 'visible' ? 'false' : null);
  assert.equal(Object.keys(runtime.__testing.collectElementSnapshots(rootEl)).length, 0);
});

test('CodeXR boats position animation stays local when the logical parent quarter is unchanged', () => {
  const runtime = loadRuntime();
  const sameParent = runtime.__testing.resolveAnimationFromPosition(
    {
      position: '0.5 0.1 -0.25',
      chartPosition: { x: 9, y: 0.1, z: 4 },
      parentKey: 'quarter:src/views',
    },
    {
      position: '0 0.1 0',
      parentOrigin: { x: 8, y: 0, z: 4 },
      parentKey: 'quarter:src/views',
    },
  );
  assert.equal(sameParent, '0.5 0.1 -0.25');

  const changedParent = runtime.__testing.resolveAnimationFromPosition(
    {
      position: '0.5 0.1 -0.25',
      chartPosition: { x: 9, y: 0.1, z: 4 },
      parentKey: 'quarter:src/views',
    },
    {
      position: '0 0.1 0',
      parentOrigin: { x: 8, y: 0, z: 4 },
      parentKey: 'quarter:src/services',
    },
  );
  assert.equal(changedParent, '1 0.1 0');
});

test('CodeXR boats snapshots keep quarter group frame separate from quarter base visual geometry', () => {
  const runtime = loadRuntime();
  const rootEl = {
    parentNode: {},
    object3D: { visible: true, position: { x: 0, y: 0, z: 0 } },
    getAttribute(name) {
      return name === 'visible' ? true : null;
    },
  };
  const groupEl = {
    parentNode: rootEl,
    object3D: { position: { x: 3, y: 0, z: -1 } },
    getAttribute(name) {
      const values = {
        'data-codexr-boats-key': 'quarter:src',
        'data-codexr-boats-kind': 'quarter',
        position: '0 0 0',
      };
      return values[name] || null;
    },
  };
  const baseEl = {
    parentNode: groupEl,
    object3D: { position: { x: 0, y: 0.02, z: 0 } },
    getAttribute(name) {
      const values = {
        'data-codexr-boats-key': 'quarter:src',
        'data-codexr-boats-kind': 'quarter-base',
        position: '0 0.02 0',
        width: '4',
        height: '0.04',
        depth: '2',
        material: 'color: #4f9e54; opacity: 0.85',
      };
      return values[name] || null;
    },
  };
  rootEl.querySelectorAll = () => [groupEl, baseEl];

  const snapshot = runtime.__testing.collectElementSnapshots(rootEl)['quarter:src'];
  assert.equal(snapshot.frame.chartPosition.x, 3);
  assert.equal(snapshot.frame.chartPosition.z, -1);
  assert.equal(snapshot.frame.parentKey, null);
  assert.equal(snapshot.visual.width, '4');
  assert.equal(snapshot.visual.height, '0.04');
  assert.equal(snapshot.visual.chartPosition.x, 3);
  assert.equal(snapshot.visual.chartPosition.y, 0.02);
});

test('CodeXR boats active root ignores pending or hidden roots with duplicated keys', () => {
  const runtime = loadRuntime();
  const hiddenPendingRoot = {
    parentNode: {},
    object3D: { visible: false },
    getAttribute(name) {
      return name === 'visible' ? false : null;
    },
  };
  const visibleActiveRoot = {
    parentNode: {},
    object3D: { visible: true },
    getAttribute(name) {
      return name === 'visible' ? true : null;
    },
  };
  const component = {
    activeRenderRoot: visibleActiveRoot,
    pendingRenderRoot: hiddenPendingRoot,
    el: {
      querySelectorAll() {
        return [visibleActiveRoot, hiddenPendingRoot];
      },
    },
  };

  assert.equal(runtime.__testing.getActiveRenderRoot(component), visibleActiveRoot);
});

test('CodeXR boats suppresses only zero-distance position animation noise', () => {
  const runtime = loadRuntime();
  assert.equal(runtime.__testing.nearlySameVec3('1 2 3', {
    x: 1 + runtime.__testing.POSITION_EPSILON / 3,
    y: 2,
    z: 3,
  }), true);
  assert.equal(runtime.__testing.nearlySameVec3('1 2 3', {
    x: 1 + runtime.__testing.POSITION_EPSILON * 10,
    y: 2,
    z: 3,
  }), false);
});
