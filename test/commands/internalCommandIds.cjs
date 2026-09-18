'use strict';

/**
 * Every command the extension REGISTERS but does not CONTRIBUTE in package.json.
 *
 * An uncontributed command never shows up in the Command Palette, so something
 * else has to reach it: a tree item's `command`, an `executeCommand` call, or a
 * keybinding a user wrote against a published id. commandContributions.test.cjs
 * requires this list to match reality exactly, and checks each `kind`:
 *
 *   tree-item        a tree item carries it as its click command
 *   programmatic     invoked with vscode.commands.executeCommand
 *   legacy-alias     a published id kept alive for users' keybindings; exempt
 *                    from "must be referenced", and never removed
 *   pending-removal  referenced by nothing at all: it cannot be invoked from the
 *                    palette, a menu, a tree item or code. Its removal is
 *                    authorized (ROADMAP.md section B.2); the commit that
 *                    removes it deletes its entry here.
 *
 * Adding a command? Contribute it in package.json, or add it here with the
 * kind that says how it is reached.
 */
const INTERNAL_COMMAND_IDS = [
    // ---- ACTIVE SERVERS tree -------------------------------------------------
    { id: 'codeXR.activeServers.copyLanUrl', kind: 'tree-item', reason: 'LAN URL row of a running server' },
    { id: 'codeXR.activeServers.regeneratePairingCode', kind: 'tree-item', reason: 'remote-access pairing row' },
    { id: 'codeXR.activeServers.showParticipantDetails', kind: 'tree-item', reason: 'collaboration participant row' },
    { id: 'codeXR.activeServers.showRemoteStatus', kind: 'tree-item', reason: 'remote-access status row' },

    // ---- ANALYSIS tree: settings rows ------------------------------------------
    { id: 'codeXR.analysis.toggleAnalysisFileMode', kind: 'tree-item', reason: 'analysis file mode row' },
    { id: 'codeXR.analysis.selectAnalysisDirectoryMode', kind: 'tree-item', reason: 'analysis directory mode row' },
    { id: 'codeXR.analysis.toggleViewTheme', kind: 'tree-item', reason: 'view theme row' },
    { id: 'codeXR.analysis.toggleAutoAnalysisEnabled', kind: 'tree-item', reason: 'auto-analysis enabled row' },
    { id: 'codeXR.analysis.selectAutoAnalysisDelay', kind: 'tree-item', reason: 'auto-analysis delay row' },
    { id: 'codeXR.analysis.selectChartTypeFile', kind: 'tree-item', reason: 'file chart type row' },
    { id: 'codeXR.analysis.selectChartTypeDirectory', kind: 'tree-item', reason: 'directory chart type row' },
    { id: 'codeXR.analysis.selectDimensionMappingFile', kind: 'tree-item', reason: 'file dimension mapping rows' },
    { id: 'codeXR.analysis.selectDimensionMappingDirectory', kind: 'tree-item', reason: 'directory dimension mapping rows' },
    { id: 'codeXR.analysis.selectFilesSorting', kind: 'tree-item', reason: 'files-by-language sorting row' },
    { id: 'codeXR.analysis.selectLanguageGroupPrimarySorting', kind: 'tree-item', reason: 'language group sorting row' },
    { id: 'codeXR.analysis.selectLanguageGroupSecondarySorting', kind: 'tree-item', reason: 'language group secondary sorting row' },
    { id: 'codeXR.analysis.resetToDefaults', kind: 'tree-item', reason: 'profile configuration: reset row' },
    { id: 'codeXR.analysis.saveProfile', kind: 'tree-item', reason: 'profile configuration: save row' },
    { id: 'codeXR.analysis.loadProfile', kind: 'tree-item', reason: 'profile configuration: load row' },
    { id: 'codeXR.analysis.deleteProfile', kind: 'tree-item', reason: 'profile configuration: delete row' },

    // ---- ANALYSIS tree: file and project rows ----------------------------------
    { id: 'codeXR.analysis.runAndAnalyzeFile', kind: 'tree-item', reason: 'files-by-language file row' },
    { id: 'codeXR.analysis.projectStructure.analyzeFile', kind: 'tree-item', reason: 'project-by-language file row' },
    { id: 'codeXR.analysis.projectStructure.analyzeDirectory', kind: 'tree-item', reason: 'project-by-language directory row' },

    // ---- VISUALIZE DATA, VISUALIZATION SETTINGS, LEARN MORE trees --------------
    { id: 'codeXR.visualizeData.mapDimensionField', kind: 'tree-item', reason: 'dimension mapping row' },
    { id: 'codeXR.browseVisualizations.launch', kind: 'tree-item', reason: 'stored visualization row' },
    { id: 'codeXR.browseVisualizations.resetAll', kind: 'tree-item', reason: 'reset stored visualizations row' },
    { id: 'codeXR.visualizationSettings.configure', kind: 'tree-item', reason: 'visualization setting row' },
    { id: 'codeXR.visualizationSettings.resetAll', kind: 'tree-item', reason: 'reset visualization settings row' },
    { id: 'codeXR.learnMore', kind: 'tree-item', reason: 'Learn More row' },
    { id: 'codeXR.openAuthorWebsite', kind: 'tree-item', reason: 'author website row' },
    { id: 'codeXR.supportDeveloper', kind: 'tree-item', reason: 'support row' },

    // ---- SERVERS tree ----------------------------------------------------------
    { id: 'codexr.server.config.resetToDefault', kind: 'tree-item', reason: 'server configuration: reset row' },

    // ---- refresh plumbing ------------------------------------------------------
    { id: 'codexr.tree.refresh', kind: 'programmatic', reason: 'tree refresh after a server action' },
    { id: 'codeXR.modularTree.refresh', kind: 'programmatic', reason: 'CommonCommands.refreshTreeView' },
    { id: 'codexr.servers.refresh', kind: 'legacy-alias', reason: 'published in 1.1.0 as the servers refresh; still the id most code calls' },
    { id: 'codexr.servers.refreshServers', kind: 'legacy-alias', reason: 'published in 1.1.0; zero callers today, kept for users\' keybindings' },

    // ---- pending removal: registered, uncontributed, referenced by nothing -----
    { id: 'codeXR.analysis.setAnalysisFileModeXR', kind: 'pending-removal', reason: 'superseded by toggleAnalysisFileMode' },
    { id: 'codeXR.analysis.setAnalysisFileModeHivePanel', kind: 'pending-removal', reason: 'superseded by toggleAnalysisFileMode' },
    { id: 'codeXR.analysis.setViewThemeDark', kind: 'pending-removal', reason: 'superseded by toggleViewTheme' },
    { id: 'codeXR.analysis.setViewThemeLight', kind: 'pending-removal', reason: 'superseded by toggleViewTheme' },
    { id: 'codeXR.analysis.enableAutoAnalysis', kind: 'pending-removal', reason: 'superseded by toggleAutoAnalysisEnabled' },
    { id: 'codeXR.analysis.disableAutoAnalysis', kind: 'pending-removal', reason: 'superseded by toggleAutoAnalysisEnabled' },
    { id: 'codeXR.analysis.setAutoAnalysisDelayRealTime', kind: 'pending-removal', reason: 'superseded by selectAutoAnalysisDelay' },
    { id: 'codeXR.analysis.setAutoAnalysisDelay1s', kind: 'pending-removal', reason: 'superseded by selectAutoAnalysisDelay' },
    { id: 'codeXR.analysis.setAutoAnalysisDelay3s', kind: 'pending-removal', reason: 'superseded by selectAutoAnalysisDelay' },
    { id: 'codeXR.analysis.setAutoAnalysisDelay5s', kind: 'pending-removal', reason: 'superseded by selectAutoAnalysisDelay' },
    { id: 'codeXR.analysis.setAutoAnalysisDelay10s', kind: 'pending-removal', reason: 'superseded by selectAutoAnalysisDelay' },
    { id: 'codeXR.analysis.refreshFilesByLanguage', kind: 'pending-removal', reason: 'never wired to a tree item or a menu' },
    { id: 'codeXR.analysis.openFileFromLanguageGroup', kind: 'pending-removal', reason: 'never wired to a tree item or a menu' },
    { id: 'codeXR.analysis.cleanAnalysis', kind: 'pending-removal', reason: 'startup cleanup runs on its own; the command has no caller' },
    { id: 'codeXR.visualizeData.debugState', kind: 'pending-removal', reason: 'debug command with no caller' },
    { id: 'codexr.debug.themeConfiguration', kind: 'pending-removal', reason: 'debugThemeProblem.ts: console-only diagnostics nobody can run' },
    { id: 'codexr.debug.themeWorkflow', kind: 'pending-removal', reason: 'debugThemeProblem.ts: console-only diagnostics nobody can run' },
];

module.exports = { INTERNAL_COMMAND_IDS };
