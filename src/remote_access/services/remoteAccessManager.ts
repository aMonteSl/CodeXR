import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CollaborationProfileManager } from '../../collaboration';
import { ActiveServer } from '../../active_servers/model/activeServerModel';
import { getActiveServerRegistry } from '../../active_servers/registry/activeServerRegistry';
import { ServerSettingsManager } from '../../servers/storage/serverSettingsManager';
import { DEFAULT_REMOTE_ACCESS_STATE, RemoteAccessState } from '../model/remoteAccessModel';
import {
    PairingFailureEvent,
    PairingRequestCreatedEvent,
    RemoteSessionAuthority,
} from '../security/remoteSessionAuthority';
import { CloudflaredBinaryManager } from './cloudflaredBinaryManager';

interface ShareRecord {
    process: ChildProcessWithoutNullStreams;
    stopping: boolean;
    disposePairingListener: () => void;
    disposePendingListener: () => void;
    disposeFailureListener: () => void;
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

/** Mirrors the authority's per-request attempt budget. */
const MAX_PAIRING_CODE_PROMPTS = 5;

export class RemoteAccessManager implements vscode.Disposable {
    private static instance: RemoteAccessManager | null = null;
    private readonly binaryManager: CloudflaredBinaryManager;
    private readonly shares = new Map<string, ShareRecord>();
    private readonly guestConnections = new Map<string, GuestConnection>();
    private readonly registrySubscription: vscode.Disposable;
    private disposed = false;
    private autoStartSuppressed = false;

    private constructor(private readonly context: vscode.ExtensionContext) {
        this.binaryManager = new CloudflaredBinaryManager(context);
        this.registrySubscription = getActiveServerRegistry().onRegistryChange((event) => {
            if (event.type === 'serverRemoved' && event.serverId) {
                void this.stopSharing(event.serverId, false);
            }
            // With cross-network connections enabled, a freshly launched server
            // starts sharing on its own. serverAdded fires exactly once per
            // server, so this cannot feed back on itself.
            if (event.type === 'serverAdded' && event.serverId) {
                void this.autoStartSharing(event.serverId);
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
            throw new Error('Enable "Cross-network connections" in Server Configuration first.');
        }
        const registry = getActiveServerRegistry();
        const server = registry.getServer(serverId);
        if (!server) {
            throw new Error('The active server no longer exists.');
        }
        if (this.shares.has(serverId)) {
            return server.remoteAccess || { ...DEFAULT_REMOTE_ACCESS_STATE };
        }
        const remoteServer = this.asRemoteCapableServer(server);
        const binaryPath = await this.binaryManager.resolveBinary(true);
        if (!binaryPath) {
            // Declining the cloudflared download means "not right now": treat
            // it the same as an explicit disable, so the Server Configuration
            // row reflects reality instead of sitting on a silently broken
            // Enabled state. Re-enabling later (which calls startAllEligible)
            // offers the download again.
            await settings.updateServerSettings({
                remoteAccess: { ...settings.getServerSettings().remoteAccess, enabled: false },
            });
            void vscode.window.showInformationMessage(
                'Cross-network connections were turned off: cloudflared was not installed. '
                + 'Re-enable it in Server Configuration to be asked again.',
            );
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
        const disposeFailureListener = authority.onPairingFailed((event) => {
            this.handlePairingFailure(serverId, event);
        });
        const record: ShareRecord = {
            process: child,
            stopping: false,
            disposePairingListener,
            disposePendingListener,
            disposeFailureListener,
        };
        this.shares.set(serverId, record);

        child.once('error', (error) => {
            this.failShare(serverId, error.message);
        });
        child.once('exit', (code, signal) => {
            if (!record.stopping) {
                this.failShare(
                    serverId,
                    `cloudflared exited unexpectedly (${signal || code || 'no exit code'}).`,
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

    /**
     * Start sharing every running server that is not already shared.
     * Called when the user enables cross-network connections; runs
     * sequentially so a cold cloudflared download prompts consent only once.
     */
    public async startAllEligible(): Promise<void> {
        this.autoStartSuppressed = false;
        const servers = getActiveServerRegistry().getAllServers()
            .filter((server) => server.status === 'running');
        for (const server of servers) {
            await this.autoStartSharing(server.id);
        }
    }

    /**
     * Best-effort automatic share for one server. Never throws: errors are
     * logged (process failures already surface through failShare's toast),
     * and a declined cloudflared download suppresses further auto-starts so
     * every new server launch does not re-prompt.
     */
    private async autoStartSharing(serverId: string): Promise<void> {
        if (this.disposed || this.autoStartSuppressed) {
            return;
        }
        const settings = ServerSettingsManager.getInstance(this.context);
        await settings.ensureInitialized();
        if (!settings.getServerSettings().remoteAccess.enabled) {
            return;
        }
        const status = getActiveServerRegistry().getServer(serverId)?.remoteAccess?.status;
        if (this.shares.has(serverId) || (status && status !== 'stopped')) {
            return;
        }
        try {
            const state = await this.startSharing(serverId);
            if (state.status === 'stopped') {
                // The cloudflared consent modal was declined; a manual
                // "Start remote connection" re-offers the download.
                this.autoStartSuppressed = true;
                return;
            }
            if (state.status === 'shared' && state.invitationUrl) {
                const server = getActiveServerRegistry().getServer(serverId);
                const label = server?.customName?.trim() || `localhost:${server?.port ?? '?'}`;
                const invitationUrl = state.invitationUrl;
                void vscode.window.showInformationMessage(
                    `Server ${label} is now shared across networks.`,
                    'Copy invitation link',
                ).then((answer) => {
                    if (answer === 'Copy invitation link') {
                        void vscode.env.clipboard.writeText(invitationUrl);
                    }
                });
            }
        } catch (error) {
            // Unsupported servers and tunnel failures must not break a launch.
            console.error(`REMOTE_ACCESS: Auto-start failed for ${serverId}:`, error);
        }
    }

    public async stopSharing(serverId: string, notify = true): Promise<void> {
        const share = this.shares.get(serverId);
        const server = getActiveServerRegistry().getServer(serverId);
        if (share) {
            share.stopping = true;
            share.disposePairingListener();
            share.disposePendingListener();
            share.disposeFailureListener();
            this.shares.delete(serverId);
            share.process.kill();
        }
        this.getRemoteServer(server)?.setRemotePublicUrl(null);
        this.getAuthority(server)?.revokeAll();
        this.updateState(serverId, { ...DEFAULT_REMOTE_ACCESS_STATE });
        if (notify && (share || server?.remoteAccess?.status === 'shared')) {
            vscode.window.showInformationMessage('The remote connection was stopped and its sessions revoked.');
        }
    }

    public async stopAll(): Promise<void> {
        await Promise.all(Array.from(this.shares.keys()).map((serverId) => this.stopSharing(serverId, false)));
    }

    public async copyInvitation(serverId: string): Promise<void> {
        const state = getActiveServerRegistry().getServer(serverId)?.remoteAccess;
        if (!state?.invitationUrl) {
            throw new Error('This server has no active remote invitation.');
        }
        await vscode.env.clipboard.writeText(state.invitationUrl);
        vscode.window.showInformationMessage('Remote invitation link copied.');
    }

    public async joinInvitation(value?: string): Promise<void> {
        const invitationValue = value || await vscode.window.showInputBox({
            title: 'Join Remote Session',
            prompt: 'Paste the invitation link generated by CodeXR.',
            placeHolder: 'https://...trycloudflare.com/join?invite=...',
            ignoreFocusOut: true,
        });
        if (!invitationValue) {
            return;
        }
        const invitationUrl = this.parseInvitationUrl(invitationValue);
        const profileManager = CollaborationProfileManager.getInstance();
        if (!profileManager) {
            throw new Error('The CodeXR collaboration profile is not available.');
        }
        const configuration = profileManager.getConfiguration();
        const request = await this.postJson(`${invitationUrl.origin}/api/remote/pair/request`, {
            invitationToken: invitationUrl.searchParams.get('invite'),
            clientKind: 'codexr',
            installationId: profileManager.getInstallationId(),
            profile: configuration.profile,
        });
        // A wrong code burns itself but keeps the request alive, so the host can
        // hand over a new one without the guest pasting the link again.
        const paired = await this.confirmPairingWithRetries(
            invitationUrl.origin,
            String(request.requestId || ''),
        );
        if (!paired) {
            return;
        }
        const extensionToken = String(paired.extensionToken || '');
        const browserUrl = String(paired.browserUrl || '');
        if (!extensionToken || !browserUrl) {
            throw new Error('The pairing response does not contain a valid session.');
        }
        this.trackGuestConnection(invitationUrl.origin, extensionToken, profileManager);
        await vscode.env.openExternal(vscode.Uri.parse(browserUrl));
        vscode.window.showInformationMessage('Remote session paired and opened with this CodeXR profile.');
    }

    /**
     * Ask for the pairing code until it is accepted, the user cancels, or the
     * server rejects the request itself (expired / out of attempts).
     * Returns null when the user cancelled.
     */
    private async confirmPairingWithRetries(
        origin: string,
        requestId: string,
    ): Promise<Record<string, unknown> | null> {
        let prompt = 'Enter the six-digit code that CodeXR shows to the host.';

        for (let attempt = 0; attempt < MAX_PAIRING_CODE_PROMPTS; attempt += 1) {
            const code = await vscode.window.showInputBox({
                title: 'Pairing code',
                prompt,
                placeHolder: '000000',
                validateInput: (input) => /^\d{6}$/.test(input) ? undefined : 'Enter exactly six digits.',
                ignoreFocusOut: true,
            });
            if (!code) {
                return null;
            }

            try {
                return await this.postJson(`${origin}/api/remote/pair/confirm`, { requestId, code });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                // Only a rejected code is worth retrying: an expired request or
                // an exhausted attempt budget cannot be recovered here.
                if (!/no longer valid|Invalid pairing code/i.test(message)) {
                    throw error;
                }
                prompt = `${message} Ask the host to generate a new code, then enter it here.`;
            }
        }

        throw new Error('Too many invalid pairing codes. Ask the host for a new invitation.');
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
            throw new Error('This server does not support remote access.');
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
                    reject(new Error('cloudflared exited before publishing the link.'));
                }
            });
            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error('Cloudflare did not publish a temporary link within 30 seconds.'));
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
        const message = event.regenerated
            ? `New pairing code for ${event.displayName}: ${event.code}`
            : `Remote request from ${event.displayName}. Temporary code: ${event.code}`;
        void vscode.window.showInformationMessage(message, 'Copy code').then((answer) => {
            if (answer === 'Copy code') {
                void vscode.env.clipboard.writeText(event.code);
            }
        });
    }

    /**
     * A guest submitted a wrong code: the code is already burnt server-side, so
     * warn the host and offer to mint a replacement in one click.
     */
    private handlePairingFailure(serverId: string, event: PairingFailureEvent): void {
        const server = getActiveServerRegistry().getServer(serverId);
        const authority = this.getAuthority(server);

        if (event.reason === 'attempts-exceeded') {
            void vscode.window.showWarningMessage(
                `${event.displayName} (${event.remoteAddress}) ran out of pairing attempts. `
                + 'They need a new invitation to try again.',
            );
            return;
        }

        void vscode.window.showWarningMessage(
            `Failed pairing attempt from ${event.displayName} (${event.remoteAddress}). `
            + 'That code is no longer valid.',
            'Generate new code',
        ).then((answer) => {
            if (answer !== 'Generate new code') {
                return;
            }
            try {
                authority?.regeneratePairingCode(event.requestId);
            } catch {
                void vscode.window.showInformationMessage(
                    `${event.displayName} is no longer waiting to connect.`,
                );
            }
        });
    }

    private failShare(serverId: string, message: string): void {
        const share = this.shares.get(serverId);
        share?.disposePairingListener();
        share?.disposePendingListener();
        share?.disposeFailureListener();
        this.shares.delete(serverId);
        const server = getActiveServerRegistry().getServer(serverId);
        this.getRemoteServer(server)?.setRemotePublicUrl(null);
        this.getAuthority(server)?.revokeAll();
        this.updateState(serverId, {
            status: 'error',
            pendingRequests: 0,
            error: message,
        });
        void vscode.window.showErrorMessage(`Remote connection closed: ${message}`);
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
            throw new Error('The invitation link is not valid.');
        }
        if (
            parsed.protocol !== 'https:'
            || !parsed.hostname.endsWith('.trycloudflare.com')
            || parsed.pathname !== '/join'
            || !/^[a-zA-Z0-9_-]{20,100}$/.test(parsed.searchParams.get('invite') || '')
        ) {
            throw new Error('The link is not a valid CodeXR temporary invitation.');
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
            throw new Error(String(payload.message || `The remote connection responded with HTTP ${response.status}.`));
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
