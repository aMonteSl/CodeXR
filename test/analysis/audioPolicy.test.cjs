const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const scanRoots = ['src', 'templates', 'resources'];
const audioExtensions = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']);
// The virtual screen runtime is split into part files; every part under its
// parts directory shares the broadcast-audio allowance.
const allowedBroadcastAudioDir = path.join(
    projectRoot,
    'templates',
    'components',
    'codexr',
    'virtual-screen',
    'virtualScreenRuntime',
);

function walkFiles(directory) {
    if (!fs.existsSync(directory)) {
        return [];
    }

    const entries = fs.readdirSync(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...walkFiles(entryPath));
            continue;
        }
        files.push(entryPath);
    }

    return files;
}

function readProjectFile(...segments) {
    return fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

function toProjectRelative(filePath) {
    return path.relative(projectRoot, filePath).replace(/\\/g, '/');
}

test('plugin-owned assets do not bundle UI audio files', () => {
    const bundledAudioFiles = scanRoots.flatMap((root) => (
        walkFiles(path.join(projectRoot, root))
            .filter((filePath) => audioExtensions.has(path.extname(filePath).toLowerCase()))
            .map(toProjectRelative)
    ));

    assert.deepEqual(
        bundledAudioFiles,
        [],
        `Unexpected bundled audio files were found: ${bundledAudioFiles.join(', ')}`,
    );
});

test('plugin-owned audio APIs stay scoped to screen sharing broadcast only', () => {
    const restrictedAudioPatterns = [
        { label: 'HTMLAudioElement construction', regex: /\bnew\s+(?:win\.)?Audio\s*\(/ },
        { label: 'audio element creation', regex: /createElement\s*\(\s*['"]audio['"]\s*\)|<audio\b/i },
        { label: 'Web Audio API', regex: /\b(?:webkit)?AudioContext\b/ },
        { label: 'oscillator audio generation', regex: /\b(?:createOscillator|oscillator)\b/ },
        { label: 'speech synthesis', regex: /\b(?:speechSynthesis|SpeechSynthesisUtterance)\b/ },
        { label: 'screen audio capture flags', regex: /\b(?:systemAudio|windowAudio)\b/ },
    ];

    const violations = [];
    const codeFiles = scanRoots.flatMap((root) => (
        walkFiles(path.join(projectRoot, root)).filter((filePath) => {
            const extension = path.extname(filePath).toLowerCase();
            return extension === '.js' || extension === '.ts' || extension === '.html';
        })
    ));

    for (const filePath of codeFiles) {
        if (filePath.startsWith(allowedBroadcastAudioDir + path.sep)) {
            continue;
        }

        const source = fs.readFileSync(filePath, 'utf8');
        for (const pattern of restrictedAudioPatterns) {
            if (pattern.regex.test(source)) {
                violations.push(`${toProjectRelative(filePath)} -> ${pattern.label}`);
            }
        }
    }

    assert.deepEqual(
        violations,
        [],
        `Unexpected non-broadcast audio hooks were found: ${violations.join(', ')}`,
    );

    const { readAssembledRuntime } = require(path.join(projectRoot, 'test', 'helpers', 'runtimeAssembly.cjs'));
    const runtimeSource = readAssembledRuntime('virtual-screen', 'virtualScreenRuntime.js');

    assert.match(runtimeSource, /createElement\s*\(\s*['"]audio['"]\s*\)/);
    assert.match(runtimeSource, /\baudio\.play\s*\(/);
    assert.match(runtimeSource, /\bvideo\.muted = true\b/);
    assert.match(runtimeSource, /\baudio\.muted = false\b/);
    assert.match(runtimeSource, /\bsystemAudio: 'include'/);
    assert.match(runtimeSource, /\bwindowAudio: 'system'/);
    assert.doesNotMatch(runtimeSource, /\bnew\s+(?:win\.)?Audio\s*\(/);
    assert.doesNotMatch(runtimeSource, /\b(?:webkit)?AudioContext\b/);
    assert.doesNotMatch(runtimeSource, /\b(?:createOscillator|oscillator)\b/);
    assert.doesNotMatch(runtimeSource, /\b(?:speechSynthesis|SpeechSynthesisUtterance)\b/);
});
