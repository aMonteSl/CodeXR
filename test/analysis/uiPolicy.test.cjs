const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const textExtensions = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.cjs',
    '.mjs',
    '.json',
    '.md',
    '.html',
    '.css',
    '.py',
    '.txt',
    '.svg',
]);

function readProjectFile(...segments) {
    return fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

function collectTextFiles(root) {
    const files = [];
    const stack = [path.join(projectRoot, root)];
    while (stack.length > 0) {
        const current = stack.pop();
        if (!current || !fs.existsSync(current)) {
            continue;
        }
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                if (!['node_modules', '.git', 'artifacts', 'dist', 'out'].includes(entry.name)) {
                    stack.push(fullPath);
                }
                continue;
            }
            if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase())) {
                files.push(fullPath);
            }
        }
    }
    return files;
}

test('auto-analysis delay defaults to RealTime and selector labels are plain text', () => {
    const model = readProjectFile('src', 'code_analysis', 'configuration', 'models', 'analysisConfiguration.ts');
    const profile = readProjectFile(
        'src',
        'code_analysis',
        'views',
        'subsections',
        'analysis_settings',
        'profile_configuration',
        'profileConfiguration.ts',
    );
    const commands = readProjectFile(
        'src',
        'code_analysis',
        'commands',
        'subsections',
        'analysis_settings',
        'auto_analysis_delay',
        'autoAnalysisDelayCommands.ts',
    );

    assert.match(model, /autoAnalysisDelay:\s*\{\s*type: 'RealTime'/);
    assert.match(profile, /autoAnalysisDelay:\s*\{\s*type: 'RealTime'/);
    for (const label of ['Real Time (0s)', '1 Second', '3 Seconds', '5 Seconds', '10 Seconds', 'Custom Value...']) {
        assert.match(commands, new RegExp(`label: '${label.replace(/[()]/g, '\\$&')}'`));
    }
    assert.doesNotMatch(commands, emojiPattern);
});

test('XR mapping UI is always injected and no longer has an enabled config flag', () => {
    const fileParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'fileXRParser.ts');
    const directoryParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'directoryXRParser.ts');
    const storage = readProjectFile('src', 'code_analysis', 'configuration', 'analysisConfigurationStorage.ts');
    const model = readProjectFile('src', 'code_analysis', 'configuration', 'models', 'analysisConfiguration.ts');
    const templateProcessor = readProjectFile('src', 'babia_templates', 'processing', 'templateProcessor.ts');

    assert.match(fileParser, /babiaUiVisibleByDefault: babiaUiConfig\.visibleByDefault/);
    assert.match(directoryParser, /babiaUiVisibleByDefault: babiaUiConfig\.visibleByDefault/);
    const oldInjectionFlag = ['babia', 'Ui', 'Enabled'].join('');
    const oldConfigRead = ['babia', 'Ui', 'Config.enabled'].join('');
    const oldGetter = ['getXR', 'Babia', 'Ui', 'Enabled'].join('');
    const oldSetter = ['setXR', 'Babia', 'Ui', 'Enabled'].join('');

    assert.equal(fileParser.includes(oldInjectionFlag), false);
    assert.equal(fileParser.includes(oldConfigRead), false);
    assert.equal(directoryParser.includes(oldInjectionFlag), false);
    assert.equal(directoryParser.includes(oldConfigRead), false);
    assert.equal(storage.includes(oldGetter), false);
    assert.equal(storage.includes(oldSetter), false);
    assert.doesNotMatch(model, /enabled: boolean|enabled: true/);
    assert.equal(templateProcessor.includes(oldInjectionFlag), false);
    assert.doesNotMatch(templateProcessor, /const enabled =/);
});

test('plugin text sources do not contain emoji characters', () => {
    const files = [
        path.join(projectRoot, 'package.json'),
        ...collectTextFiles('src'),
        ...collectTextFiles('templates'),
        ...collectTextFiles('docs'),
        ...collectTextFiles('test'),
    ];
    const offenders = files.filter((filePath) => emojiPattern.test(fs.readFileSync(filePath, 'utf8')));
    assert.deepEqual(offenders.map((filePath) => path.relative(projectRoot, filePath)), []);
});
