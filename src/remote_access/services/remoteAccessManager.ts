import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CollaborationProfileManager } from '../../collaboration';
import { ActiveServer } from '../../active_servers/model/activeServerModel';
import { getActiveServerRegistry } from '../../active_servers/registry/activeServerRegistry';
import { ServerSettingsManager } from '../../servers/storage/serverSettingsManager';
import { DEFAULT_REMOTE_ACCESS_STATE, RemoteAccessState } from '../model/remoteAccessModel';
import { PairingRequestCreatedEvent, RemoteSessionAuthority } from '../security/remoteSessionAuthority';
import { CloudflaredBinaryManager } from './cloudflaredBinaryManager';

interface ShareRecord {
    process: ChildProcessWithoutNullStreams;
    stopping: boolean;
    disposePairingListener: () => void;
    disposePendingListener: () => void;
}

interface RemoteCapableServer {
    createInvitation(): string;
    getRemoteSessionAuthority(): RemoteSessionAuthority;
    setRemotePublicUrl(publicUrl: string | null): void;
}

interface GuestConnection {
    origin: string;
    extensionToken: string;
    profileSubscription: vscode.Disposable;
}

export class RemoteAccessManager implements vscode.Disposable {
    private static instance: RemoteAccessManager | null = null;
    private readonly binaryManager: CloudflaredBinaryManager;
    private readonly shares = new Map<string, ShareRecord>();
    private readonly guestConnections = new Map<string, GuestConnection>();
    private readonly registrySubscription: vscode.Disposable;
    private disposed = false;

    private constructor(private readonly context: vscode.ExtensionContext) {
        this.binaryManager = new CloudflaredBinaryManager(context);
        this.registrySubscription = getActiveServerRegistry().onRegistryChange((event) => {
            if (event.type === 'serverRemoved' && event.serverId) {
                void this.stopSharing(event.serverId, false);
            }
        });
    }

    public static initialize(context: vscode.ExtensionContext): RemoteAccessManager {
        if (!RemoteAccessManager.instance) {
            RemoteAccessManager.instance = new RemoteAccessManager(context);
            context.subscriptions.push(RemoteAccessManager.instance);
        }
        return RemoteAccessManager.instance;
    }

    public static getInstance(): RemoteAccessManager | null {
        return RemoteAccessManager.instance;
    }

    public async startSharing(serverId: string): Promise<RemoteAccessState> {
        const settings = ServerSettingsManager.getInstance(this.context);
        await settings.ensureInitialized();
        if (!settings.getServerSettings().remoteAccess.enabled) {
            throw new Error('Habilita primero "Conexiones entre redes" en Server Configuration.');
        }
        const registry = getActiveServerRegistry();
        const server = registry.getServer(serverId);
        if (!server) {
            throw new Error('El servidor activo ya no existe.');
        }
        if (this.shares.has(serverId)) {
            return server.remoteAccess || { ...DEFAULT_REMOTE_ACCESS_STATE };
        }
        const remoteServer = this.asRemoteCapableServer(server);
        const binaryPath = await this.binaryManager.resolveBinary(true);
        if (!binaryPath) {
            return { ...DEFAULT_REMOTE_ACCESS_STATE };
        }

        this.updateState(serverId, { status: 'starting', pendingRequests: 0 });
        const isolatedHome = path.join(
            this.context.globalStorageUri.fsPath,
            'remote-access',
            'quick-tunnel-home',
        );
        await fs.promises.mkdir(isolatedHome, { recursive: true });
        const args = ['tunnel', '--no-autoupdate', '--url', server.url];
        if (server.url.startsWith('https://')) {
            args.push('--no-tls-verify');
        }
        const child = spawn(binaryPath, args, {
            shell: false,
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                HOME: isolatedHome,
                USERPROFILE: isolatedHome,
            },
        });
        child.stdin.end();
        const authority = remoteServer.getRemoteSessionAuthority();
        const disposePairingListener = authority.onPairingRequest((event) => {
            this.handlePairingRequest(serverId, event);
        });
        const disposePendingListener = authority.onPendingRequestsChanged((pendingRequests) => {
            const current = getActiveServerRegistry().getServer(serverId)?.remoteAccess;
            if (current) {
                this.updateState(serverId, { ...current, pendingRequests });
            }
        });
        const record: ShareRecord = {
            process: child,
            stopping: false,
            disposePairingListener,
            disposePendingListener,
        };
        this.shares.set(serverId, record);

        child.once('error', (error) => {
            this.failShare(serverId, error.message);
        });
        child.once('exit', (code, signal) => {
            if (!record.stopping) {
                this.failShare(
                    serverId,
                    `cloudflared se cerró inesperadamente (${signal || code || 'sin código'}).`,
                );
            }
        });

        try {
            const publicUrl = await this.waitForPublicUrl(child);
            remoteServer.setRemotePublicUrl(publicUrl);
            const invitationToken = remoteServer.createInvitation();
            const invitationUrl = new URL('/join', publicUrl);
            invitationUrl.searchParams.set('invite', invitationToken);
            const state: RemoteAccessState = {
                status: 'shared',
                publicUrl,
                invitationUrl: invitationUrl.toString(),
                pendingRequests: authority.getPendingRequestCount(),
            };
            this.updateState(serverId, state);
            return state;
        } catch (error) {
            await this.stopSharing(serverId, false);
            const message = error instanceof Error ? error.message : String(error);
            this.updateState(serverId, { status: 'error', pendingRequests: 0, error: message });
            throw error;
        }
    }

    public async stopSharing(serverId: string, notify = true): Promise<void> {
        const share = this.shares.get(serverId);
        const server = getActiveServerRegistry().getServer(serverId);
        if (share) {
            share.stopping = true;
            share.disposePairingListener();
            share.disposePendingListener();
            this.shares.delete(serverId);
            share.process.kill();
        }
        this.getRemoteServer(server)?.setRemotePublicUrl(null);
        this.getAuthority(server)?.revokeAll();
        this.updateState(serverId, { ...DEFAULT_REMOTE_ACCESS_STATE });
        if (notify && (share || server?.remoteAccess?.status === 'shared')) {
            vscode.window.showInformationMessage('La conexión remota se ha detenido y sus sesiones han sido revocadas.');
        }
    }

    public async stopAll(): Promise<void> {
        await Promise.all(Array.from(this.shares.keys()).map((serverId) => this.stopSharing(serverId, false)));
    }

    public async copyInvitation(serverId: string): Promise<void> {
        const state = getActiveServerRegistry().getServer(serverId)?.remoteAccess;
        if (!state?.invitationUrl) {
            throw new Error('Este servidor no tiene una invitación remota activa.');
        }
        await vscode.env.clipboard.writeText(state.invitationUrl);
        vscode.window.showInformationMessage('Enlace de invitación remota copiado.');
    }

    public async joinInvitation(value?: string): Promise<void> {
        const invitationValue = value || await vscode.window.showInputBox({
            title: 'Unirse a sesión remota',
            prompt: 'Pega el enlace de invitación generado por CodeXR.',
            placeHolder: 'https://...trycloudflare.com/join?invite=...',
            ignoreFocusOut: true,
        });
        if (!invitationValue) {
            return;
        }
        const invitationUrl = this.parseInvitationUrl(invitationValue);
        const profileManager = CollaborationProfileManager.getInstance();
        if (!profileManager) {
            throw new Error('El perfil de colaboración de CodeXR no está disponible.');
        }
        const configuration = profileManager.getConfiguration();
        const request = await this.postJson(`${invitationUrl.origin}/api/remote/pair/request`, {
            invitationToken: invitationUrl.searchParams.get('invite'),
            clientKind: 'codexr',
            installationId: profileManager.getInstallationId(),
            profile: configuration.profile,
        });
        const code = await vscode.window.showInputBox({
            title: 'Código de emparejamiento',
            prompt: 'Introduce el código de seis cifras que muestra CodeXR al anfitrión.',
            placeHolder: '000000',
            validateInput: (input) => /^\d{6}$/.test(input) ? undefined : 'Introduce exactamente seis cifras.',
            ignoreFocusOut: true,
        });
        if (!code) {
            return;
        }
        const paired = await this.postJson(`${invitationUrl.origin}/api/remote/pair/confirm`, {
            requestId: request.requestId,
            code,
        });
        const extensionToken = String(paired.extensionToken || '');
        const browserUrl = String(paired.browserUrl || '');
        if (!extensionToken || !browserUrl) {
            throw new Error('La respuesta de emparejamiento no contiene una sesión válida.');
        }
        this.trackGuestConnection(invitationUrl.origin, extensionToken, profileManager);
        await vscode.env.openExternal(vscode.Uri.parse(browserUrl));
        vscode.window.showInformationMessage('Sesión remota emparejada y abierta con el perfil de este CodeXR.');
    }

    public dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.registrySubscription.dispose();
        for (const connection of this.guestConnections.values()) {
            connection.profileSubscription.dispose();
        }
        this.guestConnections.clear();
        void this.stopAll();
        RemoteAccessManager.instance = null;
    }

    private asRemoteCapableServer(server: ActiveServer): RemoteCapableServer {
        const instance = server.serverInstance as Partial<RemoteCapableServer> | undefined;
        if (
            !instance
            || typeof instance.createInvitation !== 'function'
            || typeof instance.getRemoteSessionAuthority !== 'function'
            || typeof instance.setRemotePublicUrl !== 'function'
        ) {
            throw new Error('Este servidor no soporta acceso remoto.');
        }
        return instance as RemoteCapableServer;
    }

    private getAuthority(server: ActiveServer | undefined): RemoteSessionAuthority | null {
        try {
            return server ? this.asRemoteCapableServer(server).getRemoteSessionAuthority() : null;
        } catch {
            return null;
        }
    }

    private getRemoteServer(server: ActiveServer | undefined): RemoteCapableServer | null {
        try {
            return server ? this.asRemoteCapableServer(server) : null;
        } catch {
            return null;
        }
    }

    private waitForPublicUrl(child: ChildProcessWithoutNullStreams): Promise<string> {
        return new Promise((resolve, reject) => {
            let settled = false;
            const inspect = (chunk: Buffer) => {
                const match = chunk.toString('utf8').match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
                if (match && !settled) {
                    settled = true;
                    clearTimeout(timer);
                    resolve(match[0]);
                }
            };
            child.stdout.on('data', inspect);
            child.stderr.on('data', inspect);
            child.once('error', (error) => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    reject(error);
                }
            });
            child.once('exit', () => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    reject(new Error('cloudflared se cerró antes de publicar el enlace.'));
                }
            });
            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error('Cloudflare no publicó un enlace temporal en 30 segundos.'));
                }
            }, 30_000);
        });
    }

    private handlePairingRequest(serverId: string, event: PairingRequestCreatedEvent): void {
        const server = getActiveServerRegistry().getServer(serverId);
        const pendingRequests = this.getAuthority(server)?.getPendingRequestCount() || 0;
        if (server?.remoteAccess) {
            this.updateState(serverId, { ...server.remoteAccess, pendingRequests });
        }
        void vscode.window.showInformationMessage(
            `Solicitud remota de ${event.displayName}. Código temporal: ${event.code}`,
            'Copiar código',
        ).then((answer) => {
            if (answer === 'Copiar código') {
                void vscode.env.clipboard.writeText(event.code);
            }
        });
    }

    private failShare(serverId: string, message: string): void {
        const share = this.shares.get(serverId);
        share?.disposePairingListener();
        share?.disposePendingListener();
        this.shares.delete(serverId);
        const server = getActiveServerRegistry().getServer(serverId);
        this.getRemoteServer(server)?.setRemotePublicUrl(null);
        this.getAuthority(server)?.revokeAll();
        this.updateState(serverId, {
            status: 'error',
            pendingRequests: 0,
            error: message,
        });
        void vscode.window.showErrorMessage(`Conexión remota cerrada: ${message}`);
    }

    private updateState(serverId: string, state: RemoteAccessState): void {
        getActiveServerRegistry().updateRemoteAccessState(serverId, state);
        void vscode.commands.executeCommand('codeXR.activeServers.refreshServers');
    }

    private parseInvitationUrl(value: string): URL {
        let parsed: URL;
        try {
            parsed = new URL(value.trim());
        } catch {
            throw new Error('El enlace de invitación no es válido.');
        }
        if (
            parsed.protocol !== 'https:'
            || !parsed.hostname.endsWith('.trycloudflare.com')
            || parsed.pathname !== '/join'
            || !/^[a-zA-Z0-9_-]{20,100}$/.test(parsed.searchParams.get('invite') || '')
        ) {
            throw new Error('El enlace no es una invitación temporal válida de CodeXR.');
        }
        return parsed;
    }

    private async postJson(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        });
        const payload = await response.json() as Record<string, unknown>;
        if (!response.ok) {
            throw new Error(String(payload.message || `La conexión remota respondió con HTTP ${response.status}.`));
        }
        return payload;
    }

    private trackGuestConnection(
        origin: string,
        extensionToken: string,
        profileManager: CollaborationProfileManager,
    ): void {
        this.guestConnections.get(origin)?.profileSubscription.dispose();
        const synchronize = async () => {
            try {
                await fetch(`${origin}/api/remote/profile`, {
                    method: 'PUT',
                    headers: {
                        authorization: `Bearer ${extensionToken}`,
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify({ profile: profileManager.getConfiguration().profile }),
                });
            } catch {
                // A later profile update can retry while the remote session remains active.
            }
        };
        const profileSubscription = profileManager.onDidChange(() => void synchronize());
        this.guestConnections.set(origin, { origin, extensionToken, profileSubscription });
    }
}
