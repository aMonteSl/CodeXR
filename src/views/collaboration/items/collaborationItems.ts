import * as vscode from 'vscode';
import {
    CollaborationConfiguration,
    COLLABORATION_AVATARS,
} from '../../../collaboration';

export type CollaborationItemType = 'identity' | 'name' | 'avatar' | 'asset' | 'session' | 'info';

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
        const avatar = COLLABORATION_AVATARS.find((candidate) => candidate.id === profile.avatarId)
            || COLLABORATION_AVATARS[0];
        const identityDescription = profile.identityMode === 'custom' ? 'Nombre personalizado' : 'Anonimo';
        const nameDescription = profile.identityMode === 'custom'
            ? profile.customName
            : 'Alias de Star Wars al conectar';

        return [
            new CollaborationTreeItem(
                'Unirse a sesión remota',
                'session',
                'Pegar enlace',
                { command: 'codeXR.collaboration.joinRemote', title: 'Unirse a sesión remota' },
                new vscode.ThemeIcon('link-external'),
                'Usa el perfil configurado en esta instalación de CodeXR.',
            ),
            new CollaborationTreeItem(
                'Identidad',
                'identity',
                identityDescription,
                { command: 'codeXR.collaboration.selectIdentity', title: 'Cambiar identidad' },
                new vscode.ThemeIcon(profile.identityMode === 'custom' ? 'account' : 'eye-closed'),
                'Elige entre un nombre personalizado o un alias anonimo generado por la sala.',
            ),
            new CollaborationTreeItem(
                'Nombre',
                'name',
                nameDescription,
                { command: 'codeXR.collaboration.setName', title: 'Cambiar nombre' },
                new vscode.ThemeIcon('edit'),
            ),
            new CollaborationTreeItem(
                'Color del avatar',
                'avatar',
                avatar.label,
                { command: 'codeXR.collaboration.selectAvatar', title: 'Cambiar color del avatar' },
                new vscode.ThemeIcon('symbol-color', new vscode.ThemeColor('charts.foreground')),
                `${avatar.label}: ${avatar.color}`,
            ),
            new CollaborationTreeItem(
                'Modelo 3D',
                'asset',
                configuration.avatarModelAvailable ? 'Instalado globalmente' : 'Avatar procedural',
                {
                    command: configuration.avatarModelAvailable
                        ? 'codeXR.collaboration.manageAvatarModel'
                        : 'codeXR.collaboration.downloadAvatarModel',
                    title: 'Gestionar modelo 3D',
                },
                new vscode.ThemeIcon(configuration.avatarModelAvailable ? 'check' : 'cloud-download'),
                configuration.avatarModelAvailable
                    ? 'El modelo descargado se reutiliza en todos los analisis.'
                    : 'Descarga opcional de 2.16 MiB. Sin ella se usa el avatar procedural.',
            ),
        ];
    }
}
