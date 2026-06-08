import type { CollaborationClientKind } from '../../remote_access/model/remoteAccessModel';

export interface ConnectedParticipantSummary {
    peerId: string;
    displayName: string;
    avatarId: string;
    clientKind: CollaborationClientKind;
    connectionScope: 'local' | 'remote';
    connectedAt: string;
}
