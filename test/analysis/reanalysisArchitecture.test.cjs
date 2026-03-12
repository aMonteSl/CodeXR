const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');

function readProjectFile(...segments) {
    return fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

test('watcher startup and cleanup go through SessionWatcherManager for XR and VisualizeDOM', () => {
    const xrLauncher = readProjectFile('src', 'code_analysis', 'engine', 'launchers', 'launcherXRAnalysis.ts');
    const domLauncher = readProjectFile('src', 'code_analysis', 'engine', 'launchers', 'launcherVisualizeDOM.ts');
    const integration = readProjectFile('src', 'code_analysis', 'services', 'serverWatcherIntegration.ts');

    assert.match(xrLauncher, /import \{ SessionWatcherManager \} from '\.\.\/watchers\/sessionWatcherManager';/);
    assert.equal(xrLauncher.includes('new FileWatcherOrchestrator('), false);
    assert.equal(xrLauncher.includes('new DirectoryWatcherOrchestrator('), false);
    assert.match(domLauncher, /import \{ SessionWatcherManager \} from '\.\.\/watchers\/sessionWatcherManager';/);
    assert.equal(domLauncher.includes('VisualizeDOMWatcher'), false);
    assert.equal(integration.includes('VisualizeDOMWatcher'), false);
    assert.match(integration, /stopWatchingSession\(sessionId\)/);
});

test('file and directory watchers use the hybrid stat-plus-hash reanalysis gate', () => {
    const fileWatcher = readProjectFile('src', 'code_analysis', 'engine', 'watchers', 'fileWatcherOrchestrator.ts');
    const directoryWatcher = readProjectFile('src', 'code_analysis', 'engine', 'watchers', 'directoryWatcherOrchestrator.ts');

    assert.match(fileWatcher, /this\.lastKnownMtimeMs === statSnapshot\.mtimeMs && this\.lastKnownSize === statSnapshot\.size/);
    assert.match(fileWatcher, /currentHash === this\.session\.hash256/);
    assert.match(fileWatcher, /executeVisualizeDOMRegeneration/);

    assert.match(directoryWatcher, /scanDirectoryScope\(this\.session\.targetPath, this\.session\.isDeep\)/);
    assert.match(directoryWatcher, /diffAgainst\(snapshot\.files\)/);
    assert.match(directoryWatcher, /resolveActuallyChanged\(diff\.suspectedChanged, currentByPath\)/);
    assert.match(directoryWatcher, /session\.filesToHash = this\.hashTracker\.getTrackedFiles\(\)/);
});

test('watcher configuration changes propagate to active sessions and directory rename events trigger partial refresh', () => {
    const sessionWatcherManager = readProjectFile('src', 'code_analysis', 'engine', 'watchers', 'sessionWatcherManager.ts');
    const delayCommands = readProjectFile('src', 'code_analysis', 'commands', 'subsections', 'analysis_settings', 'auto_analysis_delay', 'autoAnalysisDelayCommands.ts');
    const enabledCommands = readProjectFile('src', 'code_analysis', 'commands', 'subsections', 'analysis_settings', 'auto_analysis_enabled', 'autoAnalysisEnabledCommands.ts');
    const fileWatcher = readProjectFile('src', 'code_analysis', 'engine', 'watchers', 'fileWatcherOrchestrator.ts');
    const directoryWatcher = readProjectFile('src', 'code_analysis', 'engine', 'watchers', 'directoryWatcherOrchestrator.ts');
    const directoryParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'directoryXRParser.ts');
    const livePanelRequirements = readProjectFile('src', 'code_analysis', 'engine', 'processors', 'requirementRules', 'LivePanelDirectoryRequirements.ts');

    assert.match(sessionWatcherManager, /async updateAllWatcherConfigurations\(\): Promise<number>/);
    assert.match(sessionWatcherManager, /static async refreshActiveWatcherConfigurations\(context: vscode\.ExtensionContext\): Promise<number>/);
    assert.match(delayCommands, /SessionWatcherManager\.refreshActiveWatcherConfigurations\(this\.context\)/);
    assert.match(enabledCommands, /SessionWatcherManager\.refreshActiveWatcherConfigurations\(this\.context\)/);
    assert.match(fileWatcher, /public async updateDebounceConfiguration\(\): Promise<void>/);
    assert.match(fileWatcher, /this\.debounceManager\?\.updateDelay\(newDelayMs\)/);
    assert.match(directoryWatcher, /public async updateDebounceConfiguration\(\): Promise<void>/);
    assert.match(directoryWatcher, /if \(eventType === 'rename'\) \{/);
    assert.match(directoryWatcher, /this\.scheduleDebouncedReanalysis\(`rename-\$\{entryName\}`\)/);
    assert.equal(directoryWatcher.includes("if (newDelayMs === -1) {\r\n                await this.stopWatching();"), false);
    assert.match(directoryParser, /resolveTrackedSystemPath\(session\.targetPath, fileData\)/);
    assert.match(livePanelRequirements, /resolveTrackedSystemPath\(session\.targetPath, fileData\)/);
});
