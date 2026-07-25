const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(
    path.join(projectRoot, 'templates', 'components', 'common', 'codexrGitRefPickerRuntime.js'),
    'utf8',
);

// Minimal A-Frame-free DOM: elements support setAttribute/appendChild/click.
function makeElement(tag) {
    const el = {
        tagName: tag,
        attributes: {},
        children: [],
        _listeners: {},
        firstChild: null,
        parentNode: null,
        setAttribute(key, value) { this.attributes[key] = value; },
        getAttribute(key) { return this.attributes[key]; },
        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);
            this.firstChild = this.children[0];
            return child;
        },
        removeChild(child) {
            this.children = this.children.filter((c) => c !== child);
            this.firstChild = this.children[0] || null;
        },
        addEventListener(type, handler) { this._listeners[type] = handler; },
        click() { this._listeners.click && this._listeners.click(); },
    };
    return el;
}

function loadPicker() {
    const document = { createElement: (tag) => makeElement(tag) };
    const sandbox = { window: null, document, module: { exports: {} }, console };
    sandbox.window = sandbox;
    vm.runInNewContext(source, sandbox, { filename: 'codexrGitRefPickerRuntime.js' });
    return { api: sandbox.CodeXRGitRefPickerRuntime, document };
}

// Flatten a picker subtree to the VISIBLE row planes. Rows are pooled (created
// once, reused), so unused pool rows sit hidden — only visible ones count.
function collectRows(el, out = []) {
    if (!el) { return out; }
    const cls = el.attributes && el.attributes.class;
    if (typeof cls === 'string'
        && cls.indexOf('codexr-git-ref-row') >= 0
        && el.attributes.visible !== 'false') {
        out.push(el);
    }
    (el.children || []).forEach((child) => collectRows(child, out));
    return out;
}

function rowText(row) {
    return (row.children || [])
        .filter((c) => c.tagName === 'a-text')
        .map((c) => c.attributes.value)
        .join(' | ');
}

const REFERENCES = {
    sources: [
        { id: 'working-copy', kind: 'workingCopy', label: 'main (live)', revisionType: 'working-copy' },
        { id: 'branch-a', kind: 'gitRef', refType: 'branch', label: 'feature/x', revisionType: 'branch' },
        { id: 'tag-a', kind: 'gitRef', refType: 'tag', label: 'v1.0.0', revisionType: 'tag' },
        { id: 'commit-a', kind: 'gitRef', refType: 'commit', label: 'abc12345', revisionType: 'commit', description: '2026-01-02 first' },
        { id: 'commit-b', kind: 'gitRef', refType: 'commit', label: 'def67890', revisionType: 'merge', description: '2026-01-03 merged' },
    ],
    suggestedSourceIds: ['commit-a', 'commit-b'],
};

test('describeSource is the shared Git vocabulary (label/date/subject/type/color)', () => {
    const { api } = loadPicker();
    const live = api.describeSource(REFERENCES.sources[0]);
    assert.equal(live.typeLabel, 'LIVE');
    assert.equal(live.typeColor, '#06b6d4');
    assert.equal(live.isLive, true);
    assert.equal(live.date, 'Working copy');

    assert.equal(api.describeSource(REFERENCES.sources[1]).typeLabel, 'BRANCH');
    assert.equal(api.describeSource(REFERENCES.sources[2]).typeLabel, 'TAG');
    assert.equal(api.describeSource(REFERENCES.sources[4]).typeLabel, 'MERGE');

    const commit = api.describeSource(REFERENCES.sources[3]);
    assert.equal(commit.typeLabel, 'COMMIT');
    assert.equal(commit.date, '2026-01-02');
    assert.equal(commit.subject, 'first');
    assert.equal(commit.category, 'commit');

    // Merges are their own category, split from plain commits.
    assert.equal(api.sourceCategory(REFERENCES.sources[4]), 'merge');
    assert.equal(api.filterByCategory(REFERENCES.sources, 'commit').length, 1);
    assert.equal(api.filterByCategory(REFERENCES.sources, 'merge').length, 1);
    assert.equal(api.filterByCategory(REFERENCES.sources, 'tag').length, 1);
    // 'all' is every git ref (not the working copy — that is pinned separately).
    assert.equal(api.filterByCategory(REFERENCES.sources, 'all').length, 4);
    assert.ok(!api.filterByCategory(REFERENCES.sources, 'all').some((s) => s.kind === 'workingCopy'));
});

test('compare picker: All default, Live first, merge/commit split, time sort', () => {
    const { api } = loadPicker();
    const selection = { left: 'working-copy', right: '' };
    const picker = api.createPicker({
        mode: 'compare',
        pageSize: 5,
        slots: [{ id: 'left', label: 'LEFT' }, { id: 'right', label: 'RIGHT' }],
        slotSelection: (slot) => selection[slot],
        resolveRowState: (src, ctx) => ({ selected: selection[ctx.activeSlot] === src.id, color: '#be123c' }),
        onSelect: (id, slot) => { selection[slot] = id; },
    });
    picker.setReferences(REFERENCES);

    // Default category is All, newest-first, with Live (working copy) pinned first.
    assert.equal(picker.getState().category, 'all');
    assert.equal(picker.getState().sortDir, 'desc');
    let rows = collectRows(picker.el);
    assert.equal(rows.length, 5); // Live + 4 git refs
    assert.match(rowText(rows[0]), /main \(live\)/);
    assert.match(rowText(rows[1]), /def67890/); // 2026-01-03 leads the dated refs
    assert.match(rowText(rows[2]), /abc12345/); // 2026-01-02

    // Time toggle → oldest-first among dated refs; Live still first.
    picker.setSortDir('asc');
    rows = collectRows(picker.el);
    assert.match(rowText(rows[0]), /main \(live\)/);
    const order = rows.map(rowText).join(' ');
    assert.ok(order.indexOf('abc12345') < order.indexOf('def67890'));
    picker.setSortDir('desc');

    // Commits tab: Live + commit-a only (the merge is excluded).
    picker.setCategory('commit');
    rows = collectRows(picker.el);
    assert.equal(rows.length, 2);
    assert.match(rowText(rows[0]), /main \(live\)/);
    picker.setActiveSlot('right');
    rows[1].click();
    assert.equal(selection.right, 'commit-a');

    // Merges tab: Live + the merge; Tags tab: Live + the tag.
    picker.setCategory('merge');
    rows = collectRows(picker.el);
    assert.equal(rows.length, 2);
    assert.match(rowText(rows[1]), /MERGE/);
    picker.setCategory('tag');
    assert.equal(collectRows(picker.el).length, 2);
});

test('sequence picker: click-order badges reflect selection order and renumber on toggle', () => {
    const { api } = loadPicker();
    const manual = [];
    const picker = api.createPicker({
        mode: 'sequence',
        pageSize: 10,
        resolveRowState: (src) => {
            const index = manual.indexOf(src.id);
            return index >= 0
                ? { selected: true, color: '#7c3aed', orderLabel: String(index + 1) }
                : { selected: false };
        },
        onRowClick: (src) => {
            const at = manual.indexOf(src.id);
            if (at >= 0) { manual.splice(at, 1); } else { manual.push(src.id); }
        },
    });
    picker.setReferences(REFERENCES);

    // Live (working copy) is pinned first — same as compare mode, so the branch
    // you are on never disappears from the list. The rest follows the TIME
    // toggle (newest first by default); suggested frames do not jump the queue
    // (they used to occupy whole pages in fixed order, which made the
    // Oldest/Newest toggle look dead) — their membership shows as badges.
    const ordered = [...picker.getVisibleSources()].map((s) => s.id);
    assert.equal(ordered[0], 'working-copy');
    assert.deepEqual(ordered.slice(1, 3), ['commit-b', 'commit-a']);
    // Flipping the sort really reorders the dated rows (live stays pinned).
    picker.setSortDir('asc');
    const oldestFirst = [...picker.getVisibleSources()].map((s) => s.id);
    assert.equal(oldestFirst[0], 'working-copy');
    assert.deepEqual(oldestFirst.slice(1, 3), ['commit-a', 'commit-b']);
    picker.setSortDir('desc');

    const rows = collectRows(picker.el);
    const byId = {};
    picker.getVisibleSources().forEach((s, i) => { byId[s.id] = rows[i]; });

    // Click commit-b then commit-a → badges follow CLICK order (b=1, a=2),
    // independent of the row order in the list.
    byId['commit-b'].click();
    byId['commit-a'].click();
    assert.deepEqual(manual, ['commit-b', 'commit-a']);
    picker.render();
    const findRow = (label) => collectRows(picker.el).find((row) => rowText(row).indexOf(label) >= 0);
    assert.match(rowText(findRow('def67890')), /1/); // commit-b clicked first
    assert.match(rowText(findRow('abc12345')), /2/); // commit-a clicked second

    // Toggle commit-b off → commit-a renumbers to 1.
    findRow('def67890').click();
    assert.deepEqual(manual, ['commit-a']);
    picker.render();
    assert.match(rowText(findRow('abc12345')), /1/);
});

test('time sort prefers the precise timestamp over the day-granular date', () => {
    const { api } = loadPicker();
    // Two commits on the SAME short date: only the epoch timestamp can order
    // them. Undated refs sort last in both directions.
    const sameDay = {
        sources: [
            { id: 'working-copy', kind: 'workingCopy', label: 'main (live)', revisionType: 'working-copy' },
            { id: 'commit-early', kind: 'gitRef', refType: 'commit', label: 'early111', revisionType: 'commit', date: '2026-02-01', timestamp: 1000 },
            { id: 'commit-late', kind: 'gitRef', refType: 'commit', label: 'late2222', revisionType: 'commit', date: '2026-02-01', timestamp: 2000 },
            { id: 'commit-undated', kind: 'gitRef', refType: 'commit', label: 'nodate33', revisionType: 'commit' },
        ],
        suggestedSourceIds: [],
    };
    const picker = api.createPicker({
        mode: 'sequence',
        pageSize: 10,
        resolveRowState: () => ({ selected: false }),
        onRowClick: () => {},
    });
    picker.setReferences(sameDay);
    // Spread into a host array: the picker's arrays come from the vm context,
    // whose Array prototype fails deepStrictEqual against host arrays.
    assert.deepEqual(
        [...picker.getVisibleSources()].map((s) => s.id),
        ['working-copy', 'commit-late', 'commit-early', 'commit-undated'],
    );
    picker.setSortDir('asc');
    assert.deepEqual(
        [...picker.getVisibleSources()].map((s) => s.id),
        ['working-copy', 'commit-early', 'commit-late', 'commit-undated'],
    );
});

test('registerGitGatedMode enables or disables the mode option with a shared reason', () => {
    const registered = [];
    const modeRuntime = {
        registerModeOption(option) { registered.push(option); return () => {}; },
    };

    // With no mode runtime on root the helper is a safe no-op.
    const { api } = loadPicker();
    assert.equal(typeof api.registerGitGatedMode({}), 'function');

    // With the mode runtime present it registers enabled/disabled options.
    const sandbox = { window: null, document: { createElement: makeElement }, module: { exports: {} }, console };
    sandbox.window = sandbox;
    sandbox.CodeXRAnalysisModeRuntime = modeRuntime;
    vm.runInNewContext(source, sandbox, { filename: 'codexrGitRefPickerRuntime.js' });
    sandbox.CodeXRGitRefPickerRuntime.registerGitGatedMode({
        modeId: 'historical-compare', label: 'Historical comparison', color: '#be123c',
        capabilityKey: 'historicalComparison',
        capabilities: { historicalComparison: true },
        reasonFallback: 'Historical comparison requires a local Git repository.',
        onSelect() {},
    });
    sandbox.CodeXRGitRefPickerRuntime.registerGitGatedMode({
        modeId: 'project-evolution', label: 'Project evolution', color: '#f59e0b',
        capabilityKey: 'projectEvolution',
        capabilities: { projectEvolution: false, projectEvolutionReason: 'No repo here.' },
        reasonFallback: 'Project evolution requires a local Git repository.',
        onSelect() {},
    });
    assert.equal(registered[0].disabled, false);
    assert.equal(registered[1].disabled, true);
    assert.equal(registered[1].disabledReason, 'No repo here.');
});

test('both Git services delegate availability to GitRepositoryService', () => {
    const read = (relative) => fs.readFileSync(path.join(projectRoot, relative), 'utf8');
    const gitService = read('src/code_analysis/historical/gitRepositoryService.ts');
    const historical = read('src/code_analysis/historical/historicalComparisonService.ts');
    const evolution = read('src/code_analysis/historical/projectEvolutionService.ts');

    assert.match(gitService, /public async getAvailability\(/);
    assert.match(historical, /return this\.gitService\.getAvailability\(/);
    assert.match(evolution, /return this\.gitService\.getAvailability\(/);
    // The duplicated try/catch bodies are gone.
    assert.doesNotMatch(historical, /await this\.gitService\.resolveRepositoryRoot\(\)/);
    assert.doesNotMatch(evolution, /await this\.gitService\.resolveRepositoryRoot\(\)/);
});
