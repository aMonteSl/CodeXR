import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import {
    CollaborationProfile,
    DEFAULT_COLLABORATION_PROFILE,
    normalizeCollaborationProfile,
} from '../model/collaborationProfile';

/**
 * The avatar shipped inside the extension. It is CC0, so it can be
 * redistributed freely — nothing is ever downloaded for it.
 */
export const AVATAR_ASSET = {
    id: 'robot-expressive',
    fileName: 'robot-expressive.glb',
    label: 'Robot Expressive',
    author: 'Tomás Laulhé',
    modifiedBy: 'Don McCurdy',
    sourcePage: 'https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    bytes: 463_988,
    triangles: 3_237,
} as const;

/** Location inside the packaged extension, relative to `extensionPath`. */
const AVATAR_ASSET_SEGMENTS = ['resources', 'avatars', AVATAR_ASSET.fileName] as const;

export interface CollaborationConfiguration {
    profile: CollaborationProfile;
    avatarModelAvailable: boolean;
    revision: number;
}

export class CollaborationProfileManager implements vscode.Disposable {
    private static instance: CollaborationProfileManager | null = null;
    private readonly onDidChangeEmitter = new vscode.EventEmitter<CollaborationConfiguration>();
    private readonly configurationDirectory: string;
    private readonly profilePath: string;
    private readonly installationIdPath: string;
    private readonly avatarPath: string;
    private readonly installationId: string;
    private profile: CollaborationProfile;
    private revision = 0;

    public readonly onDidChange = this.onDidChangeEmitter.event;

    private constructor(private readonly context: vscode.ExtensionContext) {
        this.configurationDirectory = path.join(context.globalStorageUri.fsPath, 'collaboration');
        this.profilePath = path.join(this.configurationDirectory, 'profile.v1.json');
        this.installationIdPath = path.join(this.configurationDirectory, 'installation-id');
        this.avatarPath = path.join(context.extensionPath, ...AVATAR_ASSET_SEGMENTS);
        this.installationId = this.readInstallationId();
        this.profile = this.readProfile();
    }

    public static initialize(context: vscode.ExtensionContext): CollaborationProfileManager {
        if (!CollaborationProfileManager.instance) {
            CollaborationProfileManager.instance = new CollaborationProfileManager(context);
            context.subscriptions.push(CollaborationProfileManager.instance);
        }
        return CollaborationProfileManager.instance;
    }

    public static getInstance(): CollaborationProfileManager | null {
        return CollaborationProfileManager.instance;
    }

    public getConfiguration(): CollaborationConfiguration {
        return {
            profile: { ...this.profile },
            avatarModelAvailable: this.hasAvatarModel(),
            revision: this.revision,
        };
    }

    public getAvatarModelPath(): string | null {
        return this.hasAvatarModel() ? this.avatarPath : null;
    }

    public getInstallationId(): string {
        return this.installationId;
    }

    public async updateProfile(profile: CollaborationProfile): Promise<void> {
        this.profile = normalizeCollaborationProfile(profile);
        await fs.promises.mkdir(this.configurationDirectory, { recursive: true });
        await fs.promises.writeFile(this.profilePath, JSON.stringify(this.profile, null, 2), 'utf8');
        this.emitChange();
    }

    public dispose(): void {
        this.onDidChangeEmitter.dispose();
        CollaborationProfileManager.instance = null;
    }

    private readProfile(): CollaborationProfile {
        try {
            if (fs.existsSync(this.profilePath)) {
                return normalizeCollaborationProfile(
                    JSON.parse(fs.readFileSync(this.profilePath, 'utf8')),
                );
            }
        } catch {
            // Invalid persisted data is replaced by defaults on the next update.
        }
        return { ...DEFAULT_COLLABORATION_PROFILE };
    }

    private readInstallationId(): string {
        try {
            const existing = fs.readFileSync(this.installationIdPath, 'utf8').trim();
            if (/^[a-zA-Z0-9_-]{12,80}$/.test(existing)) {
                return existing;
            }
        } catch {
            // A stable identifier is created below.
        }

        const created = `codexr-${crypto.randomBytes(18).toString('base64url')}`;
        fs.mkdirSync(this.configurationDirectory, { recursive: true });
        fs.writeFileSync(this.installationIdPath, created, { encoding: 'utf8', mode: 0o600 });
        return created;
    }

    /**
     * The model ships with the extension, so this only guards against a broken
     * install — a missing file degrades to the procedural avatar.
     */
    private hasAvatarModel(): boolean {
        try {
            const stats = fs.statSync(this.avatarPath);
            return stats.isFile() && stats.size > 0;
        } catch {
            return false;
        }
    }

    private emitChange(): void {
        this.revision += 1;
        this.onDidChangeEmitter.fire(this.getConfiguration());
    }
}
