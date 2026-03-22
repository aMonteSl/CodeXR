import { CommonCommands } from '../../utils/commonCommands';
import { ExtensionCommandRegistration } from '../shared';

/**
 * General/common commands used throughout the extension.
 */
export function getGeneralCommandRegistrations(): ExtensionCommandRegistration[] {
    return [
        {
            id: 'codexr.tree.refresh',
            module: 'GENERAL_COMMANDS',
            description: 'Tree refresh',
            handler: () => {
                console.log('GENERAL_COMMANDS: Tree refresh command executed');
                CommonCommands.refreshTreeView();
            },
        },
        {
            id: 'codexr.servers.refresh',
            module: 'GENERAL_COMMANDS',
            description: 'Legacy tree refresh',
            handler: () => {
                console.log('GENERAL_COMMANDS: Legacy servers refresh command executed, delegating to tree refresh');
                CommonCommands.refreshTreeView();
            },
        },
        {
            id: 'codexr.servers.refreshServers',
            module: 'GENERAL_COMMANDS',
            description: 'Legacy server tree refresh alias',
            handler: () => {
                console.log('GENERAL_COMMANDS: Legacy server refresh alias executed, delegating to tree refresh');
                CommonCommands.refreshTreeView();
            },
        },
        {
            id: 'codeXR.modularTree.refresh',
            module: 'GENERAL_COMMANDS',
            description: 'Modular tree refresh',
            handler: () => {
                console.log('GENERAL_COMMANDS: Modular tree refresh command executed');
                CommonCommands.refreshTreeView();
            },
        },
    ];
}
