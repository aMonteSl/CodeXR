import * as vscode from 'vscode';
import {
    CollaborationConfiguration,
    COLLABORATION_AVATARS,
} from '../../../collaboration';

export type CollaborationItemType = 'identity' | 'avatar' | 'asset' | 'session' | 'info';

export class CollaborationTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        public readonly collaborationItemType: CollaborationItemType,
        description?: string,
        command?: vscode.Command,
        iconPath?: vscode.ThemeIcon,
        tooltip?: string,
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = description;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip || label;
        this.contextValue = `collaboration.${collaborationItemType}`;
    }
}

export class CollaborationItemFactory {
    public static createItems(configuration: CollaborationConfiguration): CollaborationTreeItem[] {
        const profile = configuration.profile;
        const avatar = COLLABORATION_AVATARS.find((candidate) => candidate.id === profile.avatarId);
        // One row answers "what am I called?": the custom name, or Anonymous.
        const nameDescription = profile.identityMode === 'custom'
            ? profile.customName
            : 'Anonymous';

        return [
            new CollaborationTreeItem(
                'Join Remote Session',
                'session',
                'Paste invitation link',
                { command: 'codeXR.collaboration.joinRemote', title: 'Join Remote Session' },
                new vscode.ThemeIcon('link-external'),
                'Uses the profile configured in this CodeXR installation.',
            ),
            new CollaborationTreeItem(
                'Name',
                'identity',
                nameDescription,
                { command: 'codeXR.collaboration.selectIdentity', title: 'Change name' },
                new vscode.ThemeIcon(profile.identityMode === 'custom' ? 'account' : 'eye-closed'),
                'Choose between a custom name and staying anonymous. '
                + 'While anonymous, each room assigns you a Star Wars alias on connect.',
            ),
            new CollaborationTreeItem(
                'Avatar Color',
                'avatar',
                avatar ? avatar.label : 'Automatic',
                { command: 'codeXR.collaboration.selectAvatar', title: 'Change avatar color' },
                new vscode.ThemeIcon('symbol-color', new vscode.ThemeColor('charts.foreground')),
                avatar
                    ? `${avatar.label}: ${avatar.color}`
                    : 'Each room gives you a colour nobody else there is using.',
            ),
            new CollaborationTreeItem(
                '3D Model',
                'asset',
                configuration.avatarModelAvailable ? 'Included' : 'Procedural avatar',
                {
                    command: 'codeXR.collaboration.showAvatarModelInfo',
                    title: 'Show 3D model information',
                },
                new vscode.ThemeIcon(configuration.avatarModelAvailable ? 'package' : 'circle-slash'),
                configuration.avatarModelAvailable
                    ? 'Ships with CodeXR — nothing to download. Click for credits and license.'
                    : 'Missing from this installation; the procedural avatar is used instead.',
            ),
        ];
    }
}
