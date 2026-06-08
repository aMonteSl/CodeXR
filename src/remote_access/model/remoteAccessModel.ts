import { CollaborationProfile } from '../../collaboration/model/collaborationProfile';

export type RemoteAccessProvider = 'cloudflare-quick';
export type RemoteAccessStatus = 'stopped' | 'starting' | 'shared' | 'error';
export type CollaborationClientKind = 'codexr' | 'browser';

export interface RemoteAccessSettings {
    enabled: boolean;
    provider: RemoteAccessProvider;
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
    enabled: false,
    provider: 'cloudflare-quick',
};

export const DEFAULT_REMOTE_ACCESS_STATE: RemoteAccessState = {
    status: 'stopped',
    pendingRequests: 0,
};
