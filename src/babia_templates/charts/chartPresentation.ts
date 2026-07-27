/**
 * Canonical per-chart presentation contract.
 *
 * One place answers, for every BabiaXR chart CodeXR can put on the analysis
 * table: how the entity must be oriented, which base component attributes it
 * needs beyond the user-mapped fields, and how many data rows it can express
 * legibly. The generated scene is built FROM this object and the scene injects
 * it as JSON (#codexr-chart-base-config), so the in-scene runtimes (chart
 * switch, historical duals, evolution movie) cannot drift from the generator —
 * the same pattern that already kept babia-boats consistent.
 *
 * Verified against the BabiaXR sources (aframe-babia-components):
 * - Pie slices are a-cylinder and the doughnut uses torus segments: both lie
 *   flat by construction, and the official demos stand them up with
 *   rotation="90 0 0" on the entity. That rotation lives here.
 * - babia-bubbles declares heightMax/radiusMax WITHOUT defaults: omitting them
 *   renders bubbles at raw metric scale (a 12k-line file becomes a 12k-unit
 *   column). They must always travel with the component.
 * - The bars/cyls families draw ONE element per data row keyed by the x_axis
 *   label — Babia does not aggregate, and duplicate labels overwrite each
 *   other. A chart can therefore only be made legible by limiting ROWS
 *   (rowBudget, applied as a top-N slice by the runtime), never by remapping
 *   to a lower-cardinality field.
 * - babia-cylsmap computes axis lengths with Math.max over radii filtered by
 *   `o != ''`, which drops 0 (JS coercion) and yields -Infinity when a row's
 *   radius is 0. Dimensions declared `numeric-positive` must be honoured by
 *   VALUE, not just by field type — the runtime slice filters those rows.
 */

export const DEFAULT_BOATS_LEGEND_TEXT = `{name}
{fheight} (height): {height}
{farea} (area): {area}
{fcolor} (color): {color}`;

// One tree convention for every babia-boats — the one the normal analysis
// always used: directory quarters split the FULL analyzed path (filePath),
// file mode the synthetic treePath (fileName/functionName). Evolution and
// historical analyses run in per-commit temp copies, so their services
// REBUILD filePath against the original target (buildBabiaStyleFilePath) —
// same field, same shape, identical quarters.
export const XR_BOATS_TREE_FIELDS = {
    directory: 'filePath',
    file: 'treePath',
} as const;

// Canonical babia-boats base construction (kept as a named export: the
// legacy `boats` key of the injected config and the tree builder read it).
export const BOATS_BASE_COMPONENT_ATTRIBUTES: Record<string, string | number | boolean> = {
    legend: true,
    legend_text: DEFAULT_BOATS_LEGEND_TEXT,
    height_building_legend: -0.5,
    legend_scale: 0.25,
    legend_lookat: '[camera]',
    axis_name: true,
    extra: 1,
    separation: 0.5,
    zone_elevation: 0.01,
    height_quarter_legend_box: 0.01,
    height_quarter_legend_title: 2.5,
};

export interface ChartPresentationProfile {
    /** Entity rotation the chart needs to stand the way Babia designed it. */
    rotation: string;
    /**
     * How the table may scale the chart. 'uniform' (circular charts) applies
     * one factor to all axes — per-axis scaling would squash a rotated disk
     * and turn a circle into an ellipse. 'planar-uniform' (row charts with
     * flat axis labels and/or round geometry) keeps x and z at the same scale
     * value while y follows the height band — independent planar axes left
     * axis labels at raw size and made cylinders/spheres elliptical. Omitted
     * means the default per-axis containment pipeline.
     */
    fit?: 'uniform' | 'planar-uniform';
    /**
     * Maximum data rows the chart can express legibly. Charts with a budget
     * are fed a top-N slice of the dataset by the runtime; charts without one
     * (boats — per-file by design) get the full dataset.
     */
    rowBudget?: number;
    /**
     * Dimension whose mapped field ranks rows for the top-N slice (largest
     * first). Only meaningful together with rowBudget.
     */
    orderBy?: string;
    /**
     * Dimensions Babia uses to KEY the chart's elements (babia-name). Rows
     * sharing the same key values collapse onto one element — the later row
     * silently overwrites the earlier one — so the slice keeps only the
     * highest-ranked row per distinct key combination.
     */
    keyBy?: string[];
    /**
     * Extra world-units of clearance above the table's anchor plane.
     *
     * The anchor plane sits at the tabletop SLAB, ~1.7 cm below the glass
     * surface drawn over it. Flat-bottomed charts (bars, boats, cylinders)
     * hide that offset inside the glass, but geometry with a rounded bottom
     * gets visibly sliced by the surface at grazing angles — the half-buried
     * bubbles. Charts that need to REST ON the visible surface declare the
     * clearance here. Note the containment anchor has a ~1.5 cm deadband
     * against jitter, so a lift only takes effect above that.
     */
    surfaceLift?: number;
    /**
     * Component attributes the chart always needs beyond the mapped fields
     * (normalization caps, title placement, boats construction). Merged under
     * the mapping on every build — generated scene and live switch alike.
     */
    baseAttributes: Record<string, string | number | boolean>;
}

export const CHART_PRESENTATION_PROFILES: Record<string, ChartPresentationProfile> = {
    bars: {
        rotation: '0 0 0',
        fit: 'planar-uniform',
        rowBudget: 20,
        orderBy: 'height',
        keyBy: ['x_axis'],
        baseAttributes: {},
    },
    barsmap: {
        rotation: '0 0 0',
        rowBudget: 30,
        orderBy: 'height',
        keyBy: ['x_axis', 'z_axis'],
        baseAttributes: {},
    },
    cyls: {
        rotation: '0 0 0',
        fit: 'planar-uniform',
        rowBudget: 20,
        orderBy: 'height',
        keyBy: ['x_axis'],
        baseAttributes: { radiusMax: 1 },
    },
    cylsmap: {
        rotation: '0 0 0',
        fit: 'planar-uniform',
        rowBudget: 30,
        orderBy: 'height',
        keyBy: ['x_axis', 'z_axis'],
        baseAttributes: { radiusMax: 1 },
    },
    pie: {
        rotation: '90 0 0',
        fit: 'uniform',
        rowBudget: 12,
        orderBy: 'size',
        keyBy: ['key'],
        baseAttributes: { titlePosition: '2.5 0 -3' },
    },
    donut: {
        rotation: '90 0 0',
        fit: 'uniform',
        rowBudget: 12,
        orderBy: 'size',
        keyBy: ['key'],
        baseAttributes: { titlePosition: '2.5 0 -3' },
    },
    bubbles: {
        rotation: '0 0 0',
        // Bubbles are SPHERES: any anisotropy (even planar-uniform's free y
        // axis) stretches them into ellipsoids — one factor on all axes.
        fit: 'uniform',
        rowBudget: 12,
        orderBy: 'height',
        keyBy: ['x_axis', 'z_axis'],
        // Spheres are the one geometry the glass surface cuts visibly.
        surfaceLift: 0.03,
        // babia-bubbles has NO defaults for these: without them every bubble
        // is drawn at raw metric scale and the chart towers out of the room.
        baseAttributes: { heightMax: 5, radiusMax: 1.5 },
    },
    boats: {
        rotation: '0 0 0',
        baseAttributes: BOATS_BASE_COMPONENT_ATTRIBUTES,
    },
};

export function getChartPresentationProfile(chartId: string): ChartPresentationProfile {
    return CHART_PRESENTATION_PROFILES[chartId] ?? { rotation: '0 0 0', baseAttributes: {} };
}

export function serializeComponentAttributes(attributes: Record<string, string | number | boolean>): string {
    return Object.entries(attributes)
        .map(([key, value]) => `${key}: ${value}`)
        .join(';\n                                 ');
}
