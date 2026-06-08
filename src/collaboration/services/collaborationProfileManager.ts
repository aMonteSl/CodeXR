import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import {
    CollaborationProfile,
    DEFAULT_COLLABORATION_PROFILE,
    normalizeCollaborationProfile,
} from '../model/collaborationProfile';

export const AVATAR_ASSET = {
    id: 'quaternius-animated-base-character',
    fileName: 'quaternius-animated-base-character.glb',
    label: 'Quaternius Animated Base Character',
    sourcePage: 'https://poly.pizza/m/cwYvO5UauX',
    url: 'https://static.poly.pizza/0b65e14d-a349-44cc-836c-efdeb6933d48.glb',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    bytes: 2_266_136,
    maxBytes: 3 * 1024 * 1024,
} as const;

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
        this.avatarPath = path.join(this.configurationDirectory, 'assets', AVATAR_ASSET.fileName);
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

    public async downloadAvatarModel(): Promise<boolean> {
        if (this.hasAvatarModel()) {
            return true;
        }

        const size = (AVATAR_ASSET.bytes / (1024 * 1024)).toFixed(2);
        const confirmation = await vscode.window.showInformationMessage(
            `CodeXR descargara ${size} MiB una sola vez. El modelo se guardara en el almacenamiento global de la extension y se reutilizara en todos los analisis. Fuente: Quaternius. Licencia: ${AVATAR_ASSET.license}.`,
            { modal: true },
            'Descargar modelo',
        );
        if (confirmation !== 'Descargar modelo') {
            return false;
        }

        const targetDirectory = path.dirname(this.avatarPath);
        const temporaryPath = `${this.avatarPath}.download`;
        await fs.promises.mkdir(targetDirectory, { recursive: true });
        try {
            await this.downloadToFile(AVATAR_ASSET.url, temporaryPath);
            await fs.promises.rename(temporaryPath, this.avatarPath);
        } catch (error) {
            await fs.promises.rm(temporaryPath, { force: true });
            throw error;
        }

        this.emitChange();
        return true;
    }

    public async removeAvatarModel(): Promise<void> {
        await fs.promises.rm(this.avatarPath, { force: true });
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

    private hasAvatarModel(): boolean {
        try {
            const stats = fs.statSync(this.avatarPath);
            return stats.isFile() && stats.size > 0 && stats.size <= AVATAR_ASSET.maxBytes;
        } catch {
            return false;
        }
    }

    private emitChange(): void {
        this.revision += 1;
        this.onDidChangeEmitter.fire(this.getConfiguration());
    }

    private downloadToFile(url: string, destination: string, redirects = 0): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = https.get(url, (response) => {
                const status = response.statusCode || 0;
                const redirect = response.headers.location;
                if (status >= 300 && status < 400 && redirect && redirects < 4) {
                    response.resume();
                    const nextUrl = new URL(redirect, url).toString();
                    this.downloadToFile(nextUrl, destination, redirects + 1).then(resolve, reject);
                    return;
                }
                if (status !== 200) {
                    response.resume();
                    reject(new Error(`El proveedor del avatar respondio con HTTP ${status || 'desconocido'}.`));
                    return;
                }

                const declaredLength = Number(response.headers['content-length'] || 0);
                if (declaredLength > AVATAR_ASSET.maxBytes) {
                    response.resume();
                    reject(new Error('El modelo supera el limite de descarga permitido.'));
                    return;
                }

                const output = fs.createWriteStream(destination, { flags: 'w' });
                let received = 0;
                response.on('data', (chunk: Buffer) => {
                    received += chunk.length;
                    if (received > AVATAR_ASSET.maxBytes) {
                        response.destroy(new Error('El modelo supera el limite de descarga permitido.'));
                    }
                });
                response.pipe(output);
                output.on('finish', () => output.close(() => resolve()));
                output.on('error', reject);
                response.on('error', reject);
            });
            request.on('error', reject);
        });
    }
}
