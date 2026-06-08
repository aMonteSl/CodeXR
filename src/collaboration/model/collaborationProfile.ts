export type IdentityMode = 'anonymous' | 'custom';

export interface CollaborationProfile {
    identityMode: IdentityMode;
    customName: string;
    avatarId: string;
}

export const DEFAULT_COLLABORATION_PROFILE: CollaborationProfile = {
    identityMode: 'anonymous',
    customName: '',
    avatarId: 'avatar-1',
};

export const COLLABORATION_AVATARS = [
    { id: 'avatar-1', label: 'Azure', color: '#38bdf8' },
    { id: 'avatar-2', label: 'Amber', color: '#f59e0b' },
    { id: 'avatar-3', label: 'Emerald', color: '#22c55e' },
    { id: 'avatar-4', label: 'Violet', color: '#a78bfa' },
    { id: 'avatar-5', label: 'Rose', color: '#fb7185' },
    { id: 'avatar-6', label: 'Slate', color: '#94a3b8' },
] as const;

export const VALID_AVATAR_IDS = new Set<string>(
    COLLABORATION_AVATARS.map((avatar) => avatar.id),
);

export function sanitizeCollaborationName(value: unknown): string {
    if (typeof value !== 'string') {
        return '';
    }
    const sanitized = value
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const length = Array.from(sanitized).length;
    return length >= 2 && length <= 32 ? sanitized : '';
}

export function normalizeCollaborationProfile(value: unknown): CollaborationProfile {
    const profile = value && typeof value === 'object'
        ? value as Partial<CollaborationProfile>
        : {};
    const customName = sanitizeCollaborationName(profile.customName);
    return {
        identityMode: profile.identityMode === 'custom' && customName ? 'custom' : 'anonymous',
        customName,
        avatarId: VALID_AVATAR_IDS.has(profile.avatarId || '')
            ? profile.avatarId!
            : DEFAULT_COLLABORATION_PROFILE.avatarId,
    };
}
