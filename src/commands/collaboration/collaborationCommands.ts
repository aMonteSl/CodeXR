import * as vscode from 'vscode';
import {
    AUTO_AVATAR_ID,
    AVATAR_ASSET,
    CollaborationProfileManager,
    COLLABORATION_AVATARS,
    sanitizeCollaborationName,
} from '../../collaboration';
import { formatDetailSections } from '../../utils/detailDialog';
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
    // Collaboration is rendered as a group inside the Active Servers section.
    const refresh = () => treeDataProvider?.refreshSection?.('activeServers');

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
                        label: 'Anonymous',
                        description: 'The room will assign a Star Wars alias',
                        mode: 'anonymous' as const,
                    },
                    {
                        label: 'Custom name',
                        description: current.customName || 'Set a name between 2 and 32 characters',
                        mode: 'custom' as const,
                    },
                ], { placeHolder: 'Identity for collaboration sessions' });
                if (!selection) {
                    return;
                }
                // Picking a custom name always opens the prompt (pre-filled), so
                // this single row can also edit a name that already exists.
                if (selection.mode === 'custom') {
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
                    title: 'Collaboration name',
                    prompt: 'Between 2 and 32 characters. Control characters are stripped.',
                    value: current.customName,
                    validateInput: (input) => sanitizeCollaborationName(input)
                        ? undefined
                        : 'Enter a valid name between 2 and 32 characters.',
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
                    [
                        {
                            label: 'Automatic',
                            description: 'Each room picks a colour nobody else is using',
                            avatarId: AUTO_AVATAR_ID,
                        },
                        ...COLLABORATION_AVATARS.map((avatar) => ({
                            label: avatar.label,
                            description: avatar.color,
                            avatarId: avatar.id as string,
                        })),
                    ],
                    { placeHolder: 'Avatar color' },
                );
                if (!selection) {
                    return;
                }
                await manager.updateProfile({ ...current, avatarId: selection.avatarId });
                refresh();
            },
        },
        {
            id: 'codeXR.collaboration.showAvatarModelInfo',
            module: 'COLLABORATION',
            description: 'Show the bundled avatar model attribution',
            handler: async () => {
                const installed = manager.getConfiguration().avatarModelAvailable;
                const detail = formatDetailSections([
                    [
                        ['Model', AVATAR_ASSET.label],
                        ['Author', AVATAR_ASSET.author],
                        ['Modified by', AVATAR_ASSET.modifiedBy],
                        ['License', `${AVATAR_ASSET.license} (public domain dedication)`],
                    ],
                    [
                        ['Geometry', `${AVATAR_ASSET.triangles.toLocaleString()} triangles`],
                        ['Size', `${(AVATAR_ASSET.bytes / (1024 * 1024)).toFixed(2)} MiB`],
                    ],
                    [
                        ['Status', installed
                            ? 'Bundled with the CodeXR extension — nothing is downloaded'
                            : 'Missing from this installation — the procedural avatar is used'],
                    ],
                ]);

                const answer = await vscode.window.showInformationMessage(
                    `3D Avatar Model — ${AVATAR_ASSET.label}`,
                    { modal: true, detail },
                    'Open source page',
                    'Open license',
                );
                if (answer === 'Open source page') {
                    await vscode.env.openExternal(vscode.Uri.parse(AVATAR_ASSET.sourcePage));
                } else if (answer === 'Open license') {
                    await vscode.env.openExternal(vscode.Uri.parse(AVATAR_ASSET.licenseUrl));
                }
            },
        },
    ];
}
