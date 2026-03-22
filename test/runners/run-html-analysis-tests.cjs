const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..', '..');
const nodeTestFile = path.join(projectRoot, 'test', 'analysis', 'livePanelDomIntegration.test.cjs');
const pythonTestRoot = path.join(projectRoot, 'test', 'python', 'html_dom');
const analysisVenvPython = path.join(projectRoot, 'artifacts', 'analysis-test-venv', process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python');

function quoteArg(arg) {
    if (/^[A-Za-z0-9_./:-]+$/.test(arg)) {
        return arg;
    }

    return `"${String(arg).replace(/"/g, '\\"')}"`;
}

function spawnWithFallback(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: projectRoot,
        encoding: 'utf8',
        ...options,
    });

    if (!result.error || result.error.code !== 'EPERM') {
        return result;
    }

    const commandLine = [quoteArg(command), ...args.map(quoteArg)].join(' ');
    return spawnSync(commandLine, {
        cwd: projectRoot,
        encoding: 'utf8',
        shell: true,
        ...options,
    });
}

function run(command, args, options = {}) {
    const result = spawnWithFallback(command, args, {
        stdio: 'inherit',
        ...options,
    });

    if (result.error) {
        throw result.error;
    }

    if ((result.status ?? 1) !== 0) {
        process.exit(result.status ?? 1);
    }
}

function getPythonCandidates() {
    const candidates = [];

    if (fs.existsSync(analysisVenvPython)) {
        candidates.push({ command: analysisVenvPython, args: [], source: 'analysis test venv' });
    }

    if (process.env.CODEXR_PYTHON) {
        candidates.push({ command: process.env.CODEXR_PYTHON, args: [], source: 'CODEXR_PYTHON' });
    }

    const localAppData = process.env.LOCALAPPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Local') : null);
    if (localAppData) {
        for (const version of ['Python312', 'Python311', 'Python310']) {
            const interpreter = path.join(localAppData, 'Programs', 'Python', version, 'python.exe');
            if (fs.existsSync(interpreter)) {
                candidates.push({ command: interpreter, args: [], source: version });
            }
        }
    }

    candidates.push({ command: 'py', args: ['-3'], source: 'py launcher' });
    candidates.push({ command: 'python', args: [], source: 'python on PATH' });
    candidates.push({ command: 'python3', args: [], source: 'python3 on PATH' });

    return candidates;
}

function findPython() {
    for (const candidate of getPythonCandidates()) {
        const result = spawnWithFallback(candidate.command, [...candidate.args, '--version']);

        if (!result.error && result.status === 0) {
            return candidate;
        }
    }

    return null;
}

function main() {
    run(process.execPath, ['--test', '--test-isolation=none', '--test-concurrency=1', nodeTestFile]);

    const python = findPython();
    if (!python) {
        console.error('HTML_ANALYSIS_TEST_RUNNER: Python interpreter not found.');
        process.exit(1);
    }

    run(python.command, [
        ...python.args,
        '-m',
        'unittest',
        'discover',
        '-s',
        pythonTestRoot,
        '-p',
        'test_*.py',
    ]);
}

main();
