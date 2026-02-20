/**
 * Launch Pipeline — shared execution logic for all analysis launchers.
 *
 * Encapsulates the common 4-step flow:
 *   1. Process/get required files
 *   2. Save files to storage
 *   3. Start watcher for live updates
 *   4. Start server with SSE
 *
 * Each launcher configures the pipeline via {@link LaunchPipelineConfig} without
 * duplicating the orchestration boilerplate.
 */

import * as vscode from 'vscode';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { UnifiedSessionRegistry } from '../core/sessionRegistry';
import { ProcessedRequirements } from '../processors/FileRequirementProcessor';
import { SaveFiles } from '../utils/saveFiles';
import { SessionServerManager } from '../servers/sessionServerManager';

/** Progress percentages for each pipeline step. */
export interface ProgressSteps {
    /** After requirements processed */
    process: number;
    /** After files saved */
    save: number;
    /** After watcher started (or server, if startServerBeforeWatcher) */
    watcherOrServer: number;
    /** After server started (or watcher, if startServerBeforeWatcher) */
    serverOrWatcher: number;
    /** Final — monitoring */
    done: number;
}

/** Configuration object that each launcher passes to {@link executeLaunchPipeline}. */
export interface LaunchPipelineConfig {
    /** Log prefix for console messages, e.g. `"NEW_LAUNCHER_LIVEPANEL_ANALYSIS"` */
    logPrefix: string;
    /** Sub-folder name passed to SaveFiles, e.g. `"fileAnalysis"` */
    folderName: string;
    /** Progress percentages for each step */
    progress: ProgressSteps;

    // ---------- Strategy callbacks ----------

    /** Produce the processed files (templates + data). */
    processRequirements: () => Promise<ProcessedRequirements>;

    /**
     * Start the appropriate watcher for this analysis type.
     * @returns watcher ID if started, undefined otherwise.
     */
    startWatcher: (savedPath: string) => Promise<string | undefined | null>;

    // ---------- Optional hooks ----------

    /** Runs before step 1 (e.g. hash/directory/XR-config validation). */
    preValidation?: () => Promise<void>;

    /** Called after server started successfully (e.g. show info messages). */
    onSuccess?: (serverPort: number | undefined, serverUrl: string | undefined) => void;

    /** If true, the step order is Save → Server → Watcher instead of Save → Watcher → Server */
    startServerBeforeWatcher?: boolean;

    /** If true, `session.endTime` is set on completion. */
    setEndTime?: boolean;

    /** If true, errors are re-thrown after handling. */
    rethrowErrors?: boolean;
}

/**
 * Execute the shared 4-step launch pipeline.
 *
 * Maintains **identical** runtime behaviour to the original per-launcher code
 * while eliminating ~400 lines of duplication.
 */
export async function executeLaunchPipeline(
    session: UnifiedAnalysisSession,
    context: vscode.ExtensionContext,
    config: LaunchPipelineConfig,
): Promise<void> {
    const log = (msg: string) => console.log(`${config.logPrefix}: ${msg}`);
    const logError = (msg: string) => console.error(`${config.logPrefix}: ${msg}`);

    log(`Starting analysis with session ${session.id}`);

    const registry = UnifiedSessionRegistry.getInstance(context);

    try {
        // ── Optional pre-validation ──────────────────────────────
        if (config.preValidation) {
            await config.preValidation();
        }

        // ── STEP 1: Process requirements ─────────────────────────
        log(`STEP 1 - Getting template files and data.json...`);
        registry.updateSessionStatus(session.id, 'analyzing', config.progress.process);

        const processedFiles = await config.processRequirements();

        log(`Received ${processedFiles.loadedFiles.size} processed template files`);
        for (const [fileName, content] of processedFiles.loadedFiles) {
            log(`  ${fileName} (${content.length} chars)`);
        }

        // ── STEP 2: Save files ───────────────────────────────────
        log(`STEP 2 - Saving processed files to storage...`);
        registry.updateSessionStatus(session.id, 'analyzing', config.progress.save);

        const saveFiles = new SaveFiles();
        const savedPath = await saveFiles.saveFilesToStorage(
            processedFiles.loadedFiles,
            config.folderName,
            session.outputDirectory,
            context,
        );

        log(`Files successfully saved to: ${savedPath}`);

        // Update session with save information
        session.savedFilesPath = savedPath;
        for (const [fileName, content] of processedFiles.loadedFiles) {
            session.requiredFiles.set(fileName, content);
        }

        // ── STEPS 3 & 4: Watcher + Server (order configurable) ──
        if (config.startServerBeforeWatcher) {
            await startServer(session, context, registry, config, log, logError, savedPath);
            await startWatcher(session, registry, config, log, savedPath);
        } else {
            await startWatcher(session, registry, config, log, savedPath);
            await startServer(session, context, registry, config, log, logError, savedPath);
        }

        // ── Finalize ─────────────────────────────────────────────
        if (config.setEndTime) {
            session.endTime = new Date();
        }

        log(`Analysis completed successfully!`);

    } catch (error) {
        logError(`Error during analysis: ${error}`);

        registry.updateSessionStatus(
            session.id,
            'error',
            config.rethrowErrors ? 0 : undefined,
            error instanceof Error ? error.message : String(error),
        );

        if (config.setEndTime) {
            session.status = 'error';
            session.endTime = new Date();
        }

        vscode.window.showErrorMessage(
            `Failed to start analysis: ${error instanceof Error ? error.message : String(error)}`,
        );

        if (config.rethrowErrors) {
            throw error;
        }
    }
}

// ── Internal helpers ─────────────────────────────────────────────

async function startWatcher(
    session: UnifiedAnalysisSession,
    registry: UnifiedSessionRegistry,
    config: LaunchPipelineConfig,
    log: (msg: string) => void,
    savedPath: string,
): Promise<void> {
    const stepProgress = config.startServerBeforeWatcher
        ? config.progress.serverOrWatcher
        : config.progress.watcherOrServer;

    log(`Starting watcher...`);
    registry.updateSessionStatus(session.id, 'analyzing', stepProgress);

    const watcherId = await config.startWatcher(savedPath);
    if (watcherId) {
        log(`Watcher started successfully with ID: ${watcherId}`);
        session.watcherId = watcherId;
    } else {
        log(`Watcher could not be started`);
    }
}

async function startServer(
    session: UnifiedAnalysisSession,
    context: vscode.ExtensionContext,
    registry: UnifiedSessionRegistry,
    config: LaunchPipelineConfig,
    log: (msg: string) => void,
    logError: (msg: string) => void,
    _savedPath: string,
): Promise<void> {
    const stepProgress = config.startServerBeforeWatcher
        ? config.progress.watcherOrServer
        : config.progress.serverOrWatcher;

    log(`Starting server with SSE...`);
    registry.updateSessionStatus(session.id, 'analyzing', stepProgress);

    const sessionServerManager = new SessionServerManager(context);
    const serverStatus = await sessionServerManager.startServerForSession(session);

    if (serverStatus.isServerActive) {
        log(`Server started successfully on port ${serverStatus.port}`);
        log(`Server URL: ${serverStatus.serverUrl}`);

        if (serverStatus.port) {
            const portRegistered = registry.registerSessionPort(session.id, serverStatus.port);
            log(`Port ${serverStatus.port} registration result: ${portRegistered}`);
        }

        session.assignedPort = serverStatus.port;
        session.serverUrl = serverStatus.serverUrl;

        registry.updateSessionStatus(session.id, 'monitoring', config.progress.done);

        // Optional success callback
        config.onSuccess?.(serverStatus.port, serverStatus.serverUrl);
    } else {
        logError(`Server could not be started for session ${session.id}`);

        if (config.startServerBeforeWatcher) {
            // VisualizeDOM pattern: throw to abort remaining steps
            throw new Error(`Failed to start server for analysis`);
        } else {
            registry.updateSessionStatus(session.id, 'error', undefined, 'Server could not be started');
        }
    }
}
