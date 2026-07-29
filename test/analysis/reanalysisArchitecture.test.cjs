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
    const executePython = readProjectFile('src', 'code_analysis', 'engine', 'utils', 'executePython.ts');

    assert.match(fileWatcher, /this\.lastKnownMtimeMs === statSnapshot\.mtimeMs && this\.lastKnownSize === statSnapshot\.size/);
    assert.match(fileWatcher, /currentHash === this\.lastDetectedHash/);
    assert.match(fileWatcher, /executeVisualizeDOMRegeneration/);
    assert.match(fileWatcher, /analysisRefreshCoordinator\.publishChanges/);
    assert.match(fileWatcher, /registerHandler\(session\.id, 'historical-compare'/);

    assert.match(directoryWatcher, /scanDirectoryScope\(this\.session\.targetPath, this\.session\.isDeep\)/);
    assert.match(directoryWatcher, /diffAgainst\(snapshot\.files\)/);
    assert.match(directoryWatcher, /resolveActuallyChanged\(diff\.suspectedChanged, currentByPath\)/);
    assert.match(directoryWatcher, /session\.filesToHash = this\.sourceHashTracker\.getTrackedFiles\(\)/);
    assert.match(directoryWatcher, /analysisRefreshCoordinator\.publishChanges/);
    assert.match(directoryWatcher, /registerHandler\(session\.id, 'single'/);
    assert.match(directoryWatcher, /registerHandler\(session\.id, 'historical-compare'/);
    assert.match(fileWatcher, /\{ notifyClients: this\.session\.analysisMode !== 'XR', silent: true \}/);
    assert.match(directoryWatcher, /\{ notifyClients: this\.session\.analysisMode !== 'XR', silent: true \}/);
    assert.match(directoryWatcher, /\{ notifyClients: this\.session\.analysisMode !== 'XR' \}/);

    assert.match(executePython, /options: \{ silent\?: boolean \} = \{\}/);
    assert.match(executePython, /if \(options\.silent\) \{/);
    assert.match(reAnalysisManager, /options: \{ notifyClients\?: boolean; silent\?: boolean \} = \{\}/);
    assert.match(reAnalysisManager, /executeAnalysis\(session, \{ silent: options\.silent === true \}\)/);
    assert.match(reAnalysisManager, /if \(options\.notifyClients !== false\) \{/);
    assert.match(directoryReAnalyzer, /options: \{ notifyClients\?: boolean \} = \{\}/);
    assert.match(directoryReAnalyzer, /if \(options\.notifyClients !== false\) \{/);
    assert.match(directoryReAnalyzer, /fs\.promises\.readFile\(dataJsonPath, 'utf8'\)/);
    assert.match(directoryReAnalyzer, /writeJsonAtomically\(dataJsonPath, currentData\)/);
    assert.match(directoryReAnalyzer, /executeFileReanalysis\(filesToAnalyze\)/);
    assert.doesNotMatch(directoryReAnalyzer, /readFileSync|writeFileSync|executeFileReanalysis\(\[filePath\]\)/);
});

test('coding-agent integration surfaces are removed', () => {
    const packageJson = JSON.parse(readProjectFile('package.json'));
    const webpackConfig = readProjectFile('webpack.config.js');
    const extension = readProjectFile('src', 'extension.ts');
    const analysisCommands = readProjectFile('src', 'code_analysis', 'commands', 'analysisCommands.ts');
    const analysisProvider = readProjectFile('src', 'code_analysis', 'views', 'AnalysisSectionProvider.ts');
    const activeAnalysesCommands = readProjectFile(
        'src',
        'code_analysis',
        'views',
        'subsections',
        'active_analyses',
        'commands',
        'activeAnalysesCommands.ts',
    );
    const httpServer = readProjectFile('src', 'servers', 'runtime', 'httpServer.ts')
        + readProjectFile('src', 'servers', 'runtime', 'analysis', 'analysisFeatureHost.ts')
        + readProjectFile('src', 'servers', 'runtime', 'analysis', 'analysisMessageRouter.ts')
        + readProjectFile('src', 'servers', 'runtime', 'analysis', 'dependencyGraphBridge.ts')
        + readProjectFile('src', 'servers', 'runtime', 'analysis', 'historicalComparisonBridge.ts')
        + readProjectFile('src', 'servers', 'runtime', 'analysis', 'projectEvolutionBridge.ts');
    const camelName = 'agent' + 'Context';
    const titleName = 'Agent' + ' Context';
    const commandPrefix = ['codeXR', camelName].join('.');
    const underscoredFolder = ['agent', 'context'].join('_');
    const dashedRoute = ['agent', 'context'].join('-');
    const markerPattern = new RegExp(
        [
            camelName,
            titleName,
            underscoredFolder,
            dashedRoute,
            ['codexr', 'agent', 'context'].join('-'),
            ['codexr', 'get'].join('_'),
        ].join('|'),
    );

    const contributedCommands = packageJson.contributes.commands.map((command) => command.command);
    assert.equal(contributedCommands.some((command) => command.startsWith(`${commandPrefix}.`)), false);
    assert.equal(
        Object.keys(packageJson.contributes.configuration.properties)
            .some((key) => key.startsWith(`${commandPrefix}.`)),
        false,
    );
    for (const menuItems of Object.values(packageJson.contributes.menus)) {
        assert.equal(
            menuItems.some((item) => item.command && item.command.startsWith(`${commandPrefix}.`)),
            false,
        );
    }

    assert.equal(fs.existsSync(path.join(projectRoot, 'src', 'code_analysis', underscoredFolder)), false);
    assert.equal(fs.existsSync(path.join(projectRoot, 'src', 'code_analysis', 'commands', underscoredFolder)), false);
    assert.equal(fs.existsSync(path.join(projectRoot, 'src', 'code_analysis', 'views', 'subsections', underscoredFolder)), false);
    assert.equal(fs.existsSync(path.join(projectRoot, 'docs', `${underscoredFolder.toUpperCase()}.md`)), false);
    assert.equal(fs.existsSync(path.join(projectRoot, 'docs', `${underscoredFolder.toUpperCase()}_AGENT_USAGE.md`)), false);

    for (const source of [webpackConfig, extension, analysisCommands, analysisProvider, activeAnalysesCommands, httpServer]) {
        assert.doesNotMatch(source, markerPattern);
    }
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
    const server = readProjectFile('src', 'servers', 'runtime', 'httpServer.ts')
        + readProjectFile('src', 'servers', 'runtime', 'analysis', 'historicalComparisonBridge.ts')
        + readProjectFile('src', 'servers', 'runtime', 'analysis', 'projectEvolutionBridge.ts');
    const coordinator = readProjectFile(
        'src', 'code_analysis', 'refresh', 'analysisRefreshCoordinator.ts',
    );

    assert.match(manager, /static async reconcileSession/);
    assert.match(fileWatcher, /public async reconcileNow\(\): Promise<boolean>/);
    assert.match(directoryWatcher, /public async reconcileNow\(\): Promise<boolean>/);
    assert.match(server, /await SessionWatcherManager\.reconcileSession/);
    assert.match(coordinator, /public changeActiveMode\(/);
    assert.match(coordinator, /if \(ownerChanged\) \{\s*state\.viewRevision \+= 1;/);
    assert.doesNotMatch(coordinator, /public setActiveMode\(/);
    assert.doesNotMatch(coordinator, /public activateMode\(/);
});
