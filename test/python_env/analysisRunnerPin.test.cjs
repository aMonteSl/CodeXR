const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');

const { readPinnedLizardRequirement } = require(path.join(projectRoot, 'test', 'runners', 'run-analysis-tests.cjs'));
const {
    CODEXR_PYTHON_PACKAGES,
    getPinnedPythonRequirement,
} = require(path.join(projectRoot, 'out', 'python_env', 'runtime', 'pythonPackageManifest.js'));

test('the analysis test runner measures fixtures with the lizard version users get', () => {
    // The extension installs an exact lizard into the managed venv. If the
    // fixtures were measured with whatever pip resolves today, a lizard release
    // could move every metric in the golden reports while the shipped extension
    // still pinned the old one - and the suite would not notice.
    const lizard = CODEXR_PYTHON_PACKAGES.find((pkg) => pkg.distribution === 'lizard');
    assert.ok(lizard, 'the package manifest declares lizard');

    const requirement = readPinnedLizardRequirement();

    assert.match(requirement, /^lizard==\d+\.\d+(\.\d+)?$/, 'the runner installs an exact version, never a bare "lizard"');
    assert.equal(requirement, getPinnedPythonRequirement(lizard));
});
