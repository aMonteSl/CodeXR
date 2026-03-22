import { ActiveServersCommands } from '../../active_servers/commands/activeServersCommands';
import { ExtensionCommandRegistration } from '../shared';

interface RefreshableTreeProvider {
    refresh(): void;
}

export function getActiveServersCommandRegistrations(
    treeDataProvider?: RefreshableTreeProvider,
): ExtensionCommandRegistration[] {
    return ActiveServersCommands.getCommandRegistrations(treeDataProvider);
}

export function getActiveServersCommandIds(): Record<string, string> {
    return ActiveServersCommands.getCommandIds();
}
