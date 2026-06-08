import * as vscode from 'vscode';
import {
    CollaborationProfileManager,
    COLLABORATION_AVATARS,
    sanitizeCollaborationName,
} from '../../collaboration';
import { ExtensionCommandRegistration } from '../shared';
import { RemoteAccessManager } from '../../remote_access';

interface RefreshableTreeProvider {
    refreshSection?(sectionName: string): void;
}

export function getCollaborationCommandRegistrations(
    context: vscode.ExtensionContext,
    treeDataProvider?: RefreshableTreeProvider,
): ExtensionCommandRegistration[] {
    const manager = CollaborationProfileManager.initialize(context);
    const refresh = () => treeDataProvider?.refreshSection?.('collaboration');

    return [
        {
            id: 'codeXR.collaboration.joinRemote',
            module: 'COLLABORATION',
            description: 'Join a remote CodeXR session',
            handler: async () => {
                const remoteAccess = RemoteAccessManager.getInstance()
                    || RemoteAccessManager.initialize(context);
                await remoteAccess.joinInvitation();
            },
        },
        {
            id: 'codeXR.collaboration.selectIdentity',
            module: 'COLLABORATION',
            description: 'Select collaboration identity mode',
            handler: async () => {
                const current = manager.getConfiguration().profile;
                const selection = await vscode.window.showQuickPick([
                    {
                        label: 'Anonimo',
                        description: 'La sala asignara un alias de Star Wars',
                        mode: 'anonymous' as const,
                    },
                    {
                        label: 'Nombre personalizado',
                        description: current.customName || 'Configura un nombre entre 2 y 32 caracteres',
                        mode: 'custom' as const,
                    },
                ], { placeHolder: 'Identidad para las sesiones de colaboracion' });
                if (!selection) {
                    return;
                }
                if (selection.mode === 'custom' && !current.customName) {
                    await vscode.commands.executeCommand('codeXR.collaboration.setName');
                    return;
                }
                await manager.updateProfile({ ...current, identityMode: selection.mode });
                refresh();
            },
        },
        {
            id: 'codeXR.collaboration.setName',
            module: 'COLLABORATION',
            description: 'Set collaboration display name',
            handler: async () => {
                const current = manager.getConfiguration().profile;
                const value = await vscode.window.showInputBox({
                    title: 'Nombre de colaboracion',
                    prompt: 'Entre 2 y 32 caracteres. Los caracteres de control se eliminan.',
                    value: current.customName,
                    validateInput: (input) => sanitizeCollaborationName(input)
                        ? undefined
                        : 'Introduce un nombre valido de entre 2 y 32 caracteres.',
                });
                if (value === undefined) {
                    return;
                }
                await manager.updateProfile({
                    ...current,
                    identityMode: 'custom',
                    customName: sanitizeCollaborationName(value),
                });
                refresh();
            },
        },
        {
            id: 'codeXR.collaboration.selectAvatar',
            module: 'COLLABORATION',
            description: 'Select collaboration avatar color',
            handler: async () => {
                const current = manager.getConfiguration().profile;
                const selection = await vscode.window.showQuickPick(
                    COLLABORATION_AVATARS.map((avatar) => ({
                        label: avatar.label,
                        description: avatar.color,
                        avatarId: avatar.id,
                    })),
                    { placeHolder: 'Color del avatar' },
                );
                if (!selection) {
                    return;
                }
                await manager.updateProfile({ ...current, avatarId: selection.avatarId });
                refresh();
            },
        },
        {
            id: 'codeXR.collaboration.downloadAvatarModel',
            module: 'COLLABORATION',
            description: 'Download the shared avatar model',
            handler: async () => {
                if (await manager.downloadAvatarModel()) {
                    vscode.window.showInformationMessage(
                        'Modelo de avatar instalado. Se usara en todos los analisis de CodeXR.',
                    );
                    refresh();
                }
            },
        },
        {
            id: 'codeXR.collaboration.manageAvatarModel',
            module: 'COLLABORATION',
            description: 'Manage the installed avatar model',
            handler: async () => {
                const selection = await vscode.window.showQuickPick([
                    {
                        label: 'Conservar modelo',
                        description: 'Seguir usando el modelo 3D en todos los analisis',
                        action: 'keep',
                    },
                    {
                        label: 'Eliminar modelo descargado',
                        description: 'Volver al avatar procedural',
                        action: 'remove',
                    },
                ]);
                if (selection?.action === 'remove') {
                    await manager.removeAvatarModel();
                    vscode.window.showInformationMessage('Modelo eliminado. CodeXR usara el avatar procedural.');
                    refresh();
                }
            },
        },
    ];
}
