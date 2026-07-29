import * as vscode from 'vscode';
import {
    configureServer,
    startLocalServer,
    configureHttpMode,
    configurePort,
    toggleAutoOpen,
    configureOpenMode,
    configureRemoteAccess,
    resetToDefault,
    setExtensionContext
} from '../../servers/commands/serverCommands';
import { ExtensionCommandRegistration } from '../shared';

/**
 * Server command declarations for centralized registration.
 */
export function getServerCommandRegistrations(
    context: vscode.ExtensionContext,
): ExtensionCommandRegistration[] {
    setExtensionContext(context);

    return [
        {
            id: 'codexr.server.configure',
            module: 'SERVER',
            description: 'Server configuration',
            handler: configureServer,
            errorMessage: 'Failed to configure server'
        },
        {
            id: 'codexr.server.launch',
            module: 'SERVER',
            description: 'Start local server',
            handler: startLocalServer,
            errorMessage: 'Failed to start local server'
        },
        {
            id: 'codexr.server.config.httpMode',
            module: 'SERVER',
            description: 'Configure HTTP mode',
            handler: configureHttpMode,
            errorMessage: 'Failed to configure HTTP mode'
        },
        {
            id: 'codexr.server.config.port',
            module: 'SERVER',
            description: 'Configure default port',
            handler: configurePort,
            errorMessage: 'Failed to configure default port'
        },
        {
            id: 'codexr.server.config.autoOpen',
            module: 'SERVER',
            description: 'Toggle auto-open',
            handler: toggleAutoOpen,
            errorMessage: 'Failed to toggle auto-open'
        },
        {
            id: 'codexr.server.config.openMode',
            module: 'SERVER',
            description: 'Configure open mode',
            handler: configureOpenMode,
            errorMessage: 'Failed to configure open mode'
        },
        {
            id: 'codexr.server.config.remoteAccess',
            module: 'SERVER',
            description: 'Configure remote access',
            handler: configureRemoteAccess,
            errorMessage: 'Failed to configure remote access',
        },
        {
            id: 'codexr.server.config.resetToDefault',
            module: 'SERVER',
            description: 'Reset server configuration',
            handler: resetToDefault,
            errorMessage: 'Failed to reset server configuration'
        }
    ];
}
