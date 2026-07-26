/**
 * LivePanel bundle integrity.
 *
 * `LivePanelParser.processTemplateFiles` serves ONE `main.js` per panel: the
 * shared components under `templates/components/livepanel/` concatenated ahead
 * of the template's own script. Concatenation puts every part in the same
 * top-level scope, so a `const` declared by both a shared component and a
 * template is a SyntaxError — and a SyntaxError in that bundle is silent and
 * total: the browser parses nothing, no handler runs, and the panel just sits
 * on its initial HTML ("No analysis data to display yet") with no error in the
 * page. That is exactly how the file panel shipped broken.
 *
 * These tests assemble the bundle the way the parser does and parse it.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const sharedDir = path.join(projectRoot, 'templates', 'components', 'livepanel');
const panelsDir = path.join(projectRoot, 'templates', 'analysis_livePanel');

/** Mirrors LivePanelParser.loadSharedComponentFiles (sorted for a stable bundle). */
function readSharedParts(extension) {
    return fs.readdirSync(sharedDir)
        .sort()
        .filter((name) => name.endsWith(extension))
        .map((name) => ({ name, source: fs.readFileSync(path.join(sharedDir, name), 'utf8') }));
}

/** Mirrors the parser: the template's own script is its first non-empty JS file. */
function readTemplateScript(panel) {
    const dir = path.join(panelsDir, panel);
    const name = fs.readdirSync(dir)
        .filter((file) => file.endsWith('.js'))
        .find((file) => fs.readFileSync(path.join(dir, file), 'utf8').trim().length > 0);
    return { name, source: fs.readFileSync(path.join(dir, name), 'utf8') };
}

function bundleFor(panel) {
    const parts = [...readSharedParts('.js'), readTemplateScript(panel)];
    // bundleParts: non-empty parts joined by a blank line.
    return {
        parts,
        source: parts.map((part) => part.source).filter((s) => s.trim().length > 0).join('\n\n'),
    };
}

const panels = fs.readdirSync(panelsDir).filter((entry) => (
    fs.statSync(path.join(panelsDir, entry)).isDirectory()
));

test('every LivePanel bundle parses — a duplicate declaration kills the whole panel', () => {
    assert.ok(panels.length > 0, 'there should be LivePanel templates to check');

    for (const panel of panels) {
        const { source } = bundleFor(panel);
        assert.doesNotThrow(
            // Compiling is enough: this catches the redeclaration without
            // running any browser code.
            () => new vm.Script(source, { filename: `livepanel-${panel}-main.js` }),
            `the ${panel} LivePanel bundle must parse as one script`,
        );
    }
});

test('no top-level name is declared by both a shared component and a panel script', () => {
    // The parse check above catches this too, but only after the fact and with
    // an opaque message. This names the offender and the two files involved.
    const topLevelDeclarations = (source) => {
        const names = new Set();
        const pattern = /^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
        let match = pattern.exec(source);
        while (match) {
            names.add(match[1]);
            match = pattern.exec(source);
        }
        return names;
    };

    const collisions = [];
    for (const panel of panels) {
        const { parts } = bundleFor(panel);
        const seen = new Map();
        for (const part of parts) {
            for (const name of topLevelDeclarations(part.source)) {
                if (seen.has(name)) {
                    collisions.push(`${panel}: '${name}' in both ${seen.get(name)} and ${part.name}`);
                } else {
                    seen.set(name, part.name);
                }
            }
        }
    }

    assert.deepEqual(collisions, [], `Duplicate top-level declarations:\n${collisions.join('\n')}`);
});

test('panels reuse the shared table registry instead of declaring their own', () => {
    // The registry exists once, in the shared shell, so live updates keep the
    // user's search and sort. A panel redeclaring it was the original bug.
    const shell = fs.readFileSync(path.join(sharedDir, 'panelShell.js'), 'utf8');
    assert.match(shell, /const dataTables = \{\};/);
    assert.match(shell, /function upsertDataTable\(mountId, options, rows\)/);

    for (const panel of panels) {
        const { source } = readTemplateScript(panel);
        assert.doesNotMatch(
            source,
            /^\s*(?:const|let|var)\s+dataTables\b/m,
            `${panel} must use the shared dataTables registry`,
        );
    }
});
