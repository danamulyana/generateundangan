export const DEFAULT_BASE_INVITATION_URL = 'https://andri-ranti.ruangnada.my.id/?dear=';

export function normalizeBaseInvitationUrl(rawUrl) {
    const value = (rawUrl || '').trim();
    return value === '' ? DEFAULT_BASE_INVITATION_URL : value;
}

export function getDefaultAppState() {
    return {
        invitations: [],
        baseInvitationUrl: DEFAULT_BASE_INVITATION_URL
    };
}
