/**
 * Analysis Commands Registration
 * Converts analysis registrations to the shared command format.
 */
import * as vscode from 'vscode';
import { CodeAnalysisCommands } from '../../code_analysis/commands/analysisCommands';
import { ExtensionCommandRegistration } from '../shared';

const LAST_ANALYSIS_STORAGE_KEY = 'codeXR.analysis.lastKind';
const LAST_ANALYSIS_CONTEXT_KEY = 'codeXR.analysis.lastKind';
const DEFAULT_LAST_ANALYSIS_KIND = 'analyzeProjectXRDeep';

const ANALYSIS_ACTIONS = [
    { kind: 'analyzeFile', commandId: 'codeXR.analysis.analyzeFile' },
    { kind: 'analyzeFileXR', commandId: 'codeXR.analysis.analyzeFileXR' },
    { kind: 'analyzeDirectory', commandId: 'codeXR.analysis.analyzeDirectory' },
    { kind: 'analyzeDirectoryDeep', commandId: 'codeXR.analysis.analyzeDirectoryDeep' },
    { kind: 'analyzeDirectoryXR', commandId: 'codeXR.analysis.analyzeDirectoryXR' },
    { kind: 'analyzeDirectoryXRDeep', commandId: 'codeXR.analysis.analyzeDirectoryXRDeep' },
    { kind: 'analyzeProject', commandId: 'codeXR.analysis.analyzeProject' },
    { kind: 'analyzeProjectDeep', commandId: 'codeXR.analysis.analyzeProjectDeep' },
    { kind: 'analyzeProjectXR', commandId: 'codeXR.analysis.analyzeProjectXR' },
    { kind: 'analyzeProjectXRDeep', commandId: 'codeXR.analysis.analyzeProjectXRDeep' },
    { kind: 'visualizeDOM', commandId: 'codeXR.analysis.visualizeDOM' },
] as const;

const ANALYSIS_ACTION_BY_KIND = new Map<string, string>(ANALYSIS_ACTIONS.map((action) => [action.kind, action.commandId]));
const ANALYSIS_KIND_BY_COMMAND = new Map<string, string>(ANALYSIS_ACTIONS.map((action) => [action.commandId, action.kind]));

async function setLastAnalysisKind(context: vscode.ExtensionContext, kind: string): Promise<void> {
    const normalizedKind = ANALYSIS_ACTION_BY_KIND.has(kind as any) ? kind : DEFAULT_LAST_ANALYSIS_KIND;
    await context.globalState.update(LAST_ANALYSIS_STORAGE_KEY, normalizedKind);
    await vscode.commands.executeCommand('setContext', LAST_ANALYSIS_CONTEXT_KEY, normalizedKind);
}

function getLastAnalysisKind(context: vscode.ExtensionContext): string {
    const stored = context.globalState.get<string>(LAST_ANALYSIS_STORAGE_KEY);
    return stored && ANALYSIS_ACTION_BY_KIND.has(stored as any) ? stored : DEFAULT_LAST_ANALYSIS_KIND;
}

function createRunLastRegistrations(context: vscode.ExtensionContext): ExtensionCommandRegistration[] {
    void vscode.commands.executeCommand('setContext', LAST_ANALYSIS_CONTEXT_KEY, getLastAnalysisKind(context));
    return ANALYSIS_ACTIONS.map((action) => ({
        id: `codeXR.analysis.runLast.${action.kind}`,
        module: 'ANALYSIS',
        description: `Run last analysis (${action.kind})`,
        handler: async (...args: any[]) => {
            const targetKind = getLastAnalysisKind(context);
            const targetCommandId = ANALYSIS_ACTION_BY_KIND.get(targetKind as any)
                || ANALYSIS_ACTION_BY_KIND.get(DEFAULT_LAST_ANALYSIS_KIND);
            if (!targetCommandId) {
                throw new Error('No CodeXR analysis command is available to run.');
            }
            await vscode.commands.executeCommand(targetCommandId, ...args);
        },
        errorMessage: 'Failed to run last CodeXR analysis',
    }));
}

export function getAnalysisCommandRegistrations(
    context: vscode.ExtensionContext,
    refreshCallback?: () => void,
): ExtensionCommandRegistration[] {
    const registrations = CodeAnalysisCommands.getCommandRegistrations(context, refreshCallback).map((registration) => ({
        id: registration.commandId,
        module: registration.module ?? 'ANALYSIS',
        description: registration.description,
        handler: async (...args: any[]) => {
            const lastKind = ANALYSIS_KIND_BY_COMMAND.get(registration.commandId);
            await registration.callback(...args);
            if (lastKind) {
                await setLastAnalysisKind(context, lastKind);
            }
        },
        errorMessage: registration.errorMessage,
        silentErrors: registration.silentErrors,
    }));
    return [
        ...registrations,
        ...createRunLastRegistrations(context),
    ];
}

