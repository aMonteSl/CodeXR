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
    const reAnalysisManager = readProjectFile('src', 'code_analysis', 'engine', 'watchers', 'reAnalysisManager.ts');
    const directoryReAnalyzer = readProjectFile('src', 'code_analysis', 'engine', 'watchers', 'directoryReAnalyzer.ts');

    assert.match(fileWatcher, /this\.lastKnownMtimeMs === statSnapshot\.mtimeMs && this\.lastKnownSize === statSnapshot\.size/);
    assert.match(fileWatcher, /currentHash === this\.lastDetectedHash/);
    assert.match(fileWatcher, /executeVisualizeDOMRegeneration/);
    assert.match(fileWatcher, /analysisRefreshCoordinator\.publishChanges/);
    assert.match(fileWatcher, /registerHandler\(session\.id, 'historical-compare'/);
    assert.match(fileWatcher, /\{ notifyClients: this\.session\.analysisMode !== 'XR' \}/);

    assert.match(directoryWatcher, /scanDirectoryScope\(this\.session\.targetPath, this\.session\.isDeep\)/);
    assert.match(directoryWatcher, /diffAgainst\(snapshot\.files\)/);
    assert.match(directoryWatcher, /resolveActuallyChanged\(diff\.suspectedChanged, currentByPath\)/);
    assert.match(directoryWatcher, /session\.filesToHash = this\.sourceHashTracker\.getTrackedFiles\(\)/);
    assert.match(directoryWatcher, /analysisRefreshCoordinator\.publishChanges/);
    assert.match(directoryWatcher, /registerHandler\(session\.id, 'single'/);
    assert.match(directoryWatcher, /registerHandler\(session\.id, 'historical-compare'/);
    assert.equal(
        (directoryWatcher.match(/\{ notifyClients: this\.session\.analysisMode !== 'XR' \}/g) || []).length,
        2,
    );

    assert.match(reAnalysisManager, /options: \{ notifyClients\?: boolean \} = \{\}/);
    assert.match(reAnalysisManager, /if \(options\.notifyClients !== false\) \{/);
    assert.match(directoryReAnalyzer, /options: \{ notifyClients\?: boolean \} = \{\}/);
    assert.match(directoryReAnalyzer, /if \(options\.notifyClients !== false\) \{/);
});

test('watcher configuration changes propagate to active sessions and directory rename events trigger partial refresh', () => {
    const sessionWatcherManager = readProjectFile('src', 'code_analysis', 'engine', 'watchers', 'sessionWatcherManager.ts');
    const delayCommands = readProjectFile('src', 'code_analysis', 'commands', 'subsections', 'analysis_settings', 'auto_analysis_delay', 'autoAnalysisDelayCommands.ts');
    const enabledCommands = readProjectFile('src', 'code_analysis', 'commands', 'subsections', 'analysis_settings', 'auto_analysis_enabled', 'autoAnalysisEnabledCommands.ts');
    const fileWatcher = readProjectFile('src', 'code_analysis', 'engine', 'watchers', 'fileWatcherOrchestrator.ts');
    const directoryWatcher = readProjectFile('src', 'code_analysis', 'engine', 'watchers', 'directoryWatcherOrchestrator.ts');
    const analysisBootstrap = readProjectFile('src', 'code_analysis', 'engine', 'processors', 'analysisBootstrap.ts');
    const livePanelDirectoryRequirements = readProjectFile('src', 'code_analysis', 'engine', 'processors', 'requirementRules', 'LivePanelDirectoryRequirements.ts');

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
    assert.match(analysisBootstrap, /resolveTrackedSystemPath\(session\.targetPath, entry\)/);
    assert.match(livePanelDirectoryRequirements, /return this\.analysisBootstrap\.bootstrap\(session, theme\);/);
});

test('mode activation reconciles watcher hashes without forcing a full analysis', () => {
    const manager = readProjectFile(
        'src', 'code_analysis', 'engine', 'watchers', 'sessionWatcherManager.ts',
    );
    const fileWatcher = readProjectFile(
        'src', 'code_analysis', 'engine', 'watchers', 'fileWatcherOrchestrator.ts',
    );
    const directoryWatcher = readProjectFile(
        'src', 'code_analysis', 'engine', 'watchers', 'directoryWatcherOrchestrator.ts',
    );
    const server = readProjectFile('src', 'servers', 'runtime', 'httpServer.ts');
    const coordinator = readProjectFile(
        'src', 'code_analysis', 'refresh', 'analysisRefreshCoordinator.ts',
    );

    assert.match(manager, /static async reconcileSession/);
    assert.match(fileWatcher, /public async reconcileNow\(\): Promise<boolean>/);
    assert.match(directoryWatcher, /public async reconcileNow\(\): Promise<boolean>/);
    assert.match(server, /await SessionWatcherManager\.reconcileSession/);
    assert.match(coordinator, /return this\.setActiveMode\(sessionId, mode\)/);
    assert.doesNotMatch(
        coordinator.match(/public activateMode[\s\S]*?\n    \}/)?.[0] || '',
        /force|sourceRevision - 1/,
    );
});
