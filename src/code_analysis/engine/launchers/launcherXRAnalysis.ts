/**
 * XR Analysis Launcher
 * Handles the launch and orchestration of XR-based analysis for both files and directories.
 *
 * Delegates the common pipeline to {@link executeLaunchPipeline},
 * providing XR-specific configuration (chart validation, dimension mappings,
 * FileWatcherOrchestrator / DirectoryWatcherOrchestrator).
 */

import * as vscode from 'vscode';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { UnifiedSessionRegistry } from '../core/sessionRegistry';
import { FileRequirementProcessor } from '../processors/FileRequirementProcessor';
import { FileWatcherOrchestrator } from '../watchers/fileWatcherOrchestrator';
import { DirectoryWatcherOrchestrator } from '../watchers/directoryWatcherOrchestrator';
import { AnalysisConfigurationStorage } from '../../configuration/analysisConfigurationStorage';
import { DimensionValidator } from '../../../babia_templates/processing/dimensionValidator';
import { BabiaChartRegistry } from '../../../babia_templates/registry/chartRegistry';
import { DimensionMapping } from '../../../babia_templates/models/chartModels';
import { executeLaunchPipeline } from './launchPipeline';
import { XRFieldSchemaService } from '../../services/xrFieldSchemaService';

const LOG_PREFIX = 'NEW_LAUNCHER_XR_ANALYSIS';

export class LauncherXRAnalysis {
    private static async validateXRConfiguration(
        chartType: string,
        dimensionMappings: Record<string, string>,
        analysisType: 'file' | 'directory',
        registry: UnifiedSessionRegistry,
        sessionId: string,
        context: vscode.ExtensionContext,
    ): Promise<{ isValid: boolean; error?: string }> {
        console.log(`${LOG_PREFIX}: Validating ${analysisType} XR configuration...`);
        const label = analysisType.charAt(0).toUpperCase() + analysisType.slice(1);

        if (!chartType) {
            const msg = `${label} XR Analysis Error: No chart type selected. Please configure chart type in Analysis Settings.`;
            registry.updateSessionStatus(sessionId, 'error', undefined, msg);
            return { isValid: false, error: msg };
        }

        if (!dimensionMappings || Object.keys(dimensionMappings).length === 0) {
            const msg = `${label} XR Analysis Error: No dimension mappings configured. Please configure dimension mappings in Analysis Settings.`;
            registry.updateSessionStatus(sessionId, 'error', undefined, msg);
            return { isValid: false, error: msg };
        }

        const chartMetadata = BabiaChartRegistry.getInstance().getChart(chartType);
        if (!chartMetadata) {
            const msg = `${label} XR Analysis Error: Unknown chart type '${chartType}'. Please select a valid chart type.`;
            registry.updateSessionStatus(sessionId, 'error', undefined, msg);
            return { isValid: false, error: msg };
        }

        const schemaService = XRFieldSchemaService.getInstance(context);
        const fieldTypes = await schemaService.getFieldTypeMap(analysisType, true);
        if (!fieldTypes) {
            const msg = `${label} XR Analysis Error: Python field schema is not available yet. Wait for the Python environment to be ready and review Dimension Mapping again.`;
            registry.updateSessionStatus(sessionId, 'error', undefined, msg);
            return { isValid: false, error: msg };
        }

        const mappingsArray: DimensionMapping[] = Object.entries(dimensionMappings).map(
            ([dimension, dataField]) => ({ dimension, dataField }),
        );

        const validationResult = DimensionValidator.validateMappings(chartMetadata, mappingsArray, fieldTypes);
        if (!validationResult.isValid) {
            const msg = `${label} XR Analysis Error: Invalid dimension mappings:\n${validationResult.errors.join('\n')}`;
            console.error('Validation errors:', validationResult.errors);
            if (validationResult.warnings.length > 0) {
                console.warn('Validation warnings:', validationResult.warnings);
            }
            registry.updateSessionStatus(sessionId, 'error', undefined, msg);
            return { isValid: false, error: msg };
        }

        if (validationResult.warnings.length > 0) {
            console.warn(`${label} XR Analysis Warnings:`, validationResult.warnings);
        }

        console.log(`${LOG_PREFIX}: ${label} XR configuration validated successfully`);
        console.log(`Chart Type: ${chartType}`);
        for (const [dimension, dataField] of Object.entries(dimensionMappings)) {
            console.log(`      ${dimension}  ${dataField}`);
        }

        return { isValid: true };
    }

    private static async validateAndGetXRConfiguration(
        analysisType: 'file' | 'directory',
        registry: UnifiedSessionRegistry,
        sessionId: string,
        context: vscode.ExtensionContext,
    ): Promise<{ chartType: string; dimensionMappings: Record<string, string> }> {
        console.log(`${LOG_PREFIX}: STEP 0 - Validating ${analysisType} XR configuration...`);
        registry.updateSessionStatus(sessionId, 'analyzing', 10);

        const storage = AnalysisConfigurationStorage.getInstance(context);
        const chartType = analysisType === 'file'
            ? await storage.getChartTypeFile()
            : await storage.getDirectoryChartType();
        const dimensionMappings = analysisType === 'file'
            ? await storage.getDimensionMappingFile()
            : await storage.getDimensionMappingDirectory();

        const result = await this.validateXRConfiguration(
            chartType,
            dimensionMappings,
            analysisType,
            registry,
            sessionId,
            context,
        );

        if (!result.isValid) {
            vscode.window.showErrorMessage(result.error!);
            throw new Error(result.error!);
        }

        const label = analysisType.charAt(0).toUpperCase() + analysisType.slice(1);
        console.log(`${LOG_PREFIX}: STEP 0 completed - ${label} XR configuration validated`);

        return { chartType, dimensionMappings };
    }

    static async launchFileXRAnalysis(
        session: UnifiedAnalysisSession,
        context: vscode.ExtensionContext,
    ): Promise<void> {
        const registry = UnifiedSessionRegistry.getInstance(context);

        await executeLaunchPipeline(session, context, {
            logPrefix: LOG_PREFIX,
            folderName: 'fileAnalysis',
            progress: { process: 30, save: 50, watcherOrServer: 70, serverOrWatcher: 90, done: 100 },

            preValidation: async () => {
                await LauncherXRAnalysis.validateAndGetXRConfiguration('file', registry, session.id, context);
            },

            processRequirements: async () => {
                const processor = new FileRequirementProcessor(context);
                return processor.processRequirements(session);
            },

            startWatcher: async () => {
                const watcher = new FileWatcherOrchestrator(session, context);
                await watcher.startWatching();
                return session.watcherId;
            },

            onSuccess: (port) => {
                vscode.window.showInformationMessage(
                    `XR Analysis completed for file: ${session.targetName} - Server running on port ${port}`,
                );
            },
        });
    }

    static async launchDirectoryXRAnalysis(
        session: UnifiedAnalysisSession,
        context: vscode.ExtensionContext,
    ): Promise<void> {
        const registry = UnifiedSessionRegistry.getInstance(context);

        await executeLaunchPipeline(session, context, {
            logPrefix: LOG_PREFIX,
            folderName: 'directoryAnalysis',
            progress: { process: 30, save: 50, watcherOrServer: 80, serverOrWatcher: 90, done: 100 },

            preValidation: async () => {
                console.log(`${LOG_PREFIX}: Target: ${session.targetName}${session.isDeep ? ' (Deep mode)' : ' (Normal mode)'}`);
                await LauncherXRAnalysis.validateAndGetXRConfiguration('directory', registry, session.id, context);
            },

            processRequirements: async () => {
                const processor = new FileRequirementProcessor(context);
                return processor.processRequirements(session);
            },

            startWatcher: async () => {
                const watcher = new DirectoryWatcherOrchestrator(session, context);
                return watcher.startWatching();
            },

            onSuccess: (port) => {
                vscode.window.showInformationMessage(
                    `XR Directory Analysis completed for: ${session.targetName}${session.isDeep ? ' (Deep)' : ''} - Server running on port ${port}`,
                );
            },
        });
    }
}
