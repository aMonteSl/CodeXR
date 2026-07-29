import { CollaborationProfile } from '../../collaboration/model/collaborationProfile';

export type RemoteAccessProvider = 'cloudflare-quick';
export type RemoteAccessStatus = 'stopped' | 'starting' | 'shared' | 'error';
export type CollaborationClientKind = 'codexr' | 'browser';

export interface RemoteAccessSettings {
    enabled: boolean;
    provider: RemoteAccessProvider;
    /**
     * One-shot migration marker: cross-network became enabled by default, and
     * settings persisted before that carried `enabled: false` (saved values
     * win over defaults on merge). Its absence means the stored value predates
     * the new default and gets flipped once; once sealed, the user's own
     * choice always wins.
     */
    enabledByDefaultApplied?: boolean;
}

export interface RemoteAccessState {
    status: RemoteAccessStatus;
    publicUrl?: string;
    invitationUrl?: string;
    pendingRequests: number;
    error?: string;
}

export interface AuthenticatedCollaborationSession {
    sessionId: string;
    installationId: string;
    profile: CollaborationProfile;
    clientKind: CollaborationClientKind;
    anonymousAlias?: string;
    remote: boolean;
    expiresAt: number;
}

export const DEFAULT_REMOTE_ACCESS_SETTINGS: RemoteAccessSettings = {
    enabled: true,
    provider: 'cloudflare-quick',
    enabledByDefaultApplied: true,
};

export const DEFAULT_REMOTE_ACCESS_STATE: RemoteAccessState = {
    status: 'stopped',
    pendingRequests: 0,
};
