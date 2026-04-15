export const DEFAULT_BASE_INVITATION_URL = 'https://<groomname>-<brideName>.ruangnada.my.id/?dear=';
export const GA_MEASUREMENT_ID = 'G-DMMFB3VJDK';
export const DEFAULT_COUPLE_PROFILE = {
    brideName: '',
    groomName: ''
};
export const COUPLE_PRESET_SLOTS = ['profil-a', 'profil-b', 'profil-c'];

export function normalizeBaseInvitationUrl(rawUrl) {
    const value = (rawUrl || '').trim();
    return value === '' ? DEFAULT_BASE_INVITATION_URL : value;
}

export function getDefaultAppState() {
    return {
        invitations: [],
        baseInvitationUrl: DEFAULT_BASE_INVITATION_URL,
        coupleProfile: { ...DEFAULT_COUPLE_PROFILE },
        couplePresets: {},
        couplePresetLabels: {}
    };
}

export function normalizeCoupleProfile(profile) {
    const brideName = String(profile?.brideName || '').trim();
    const groomName = String(profile?.groomName || '').trim();

    return {
        brideName: brideName || DEFAULT_COUPLE_PROFILE.brideName,
        groomName: groomName || DEFAULT_COUPLE_PROFILE.groomName
    };
}

export function normalizeCouplePresets(presets) {
    if (!presets || typeof presets !== 'object') {
        return {};
    }

    const normalized = {};
    Object.keys(presets).forEach((key) => {
        const slotKey = String(key || '').trim();
        if (slotKey === '') {
            return;
        }

        normalized[slotKey] = normalizeCoupleProfile(presets[key]);
    });

    return normalized;
}

export function normalizeCouplePresetLabels(labels) {
    if (!labels || typeof labels !== 'object') {
        return {};
    }

    const normalized = {};
    Object.keys(labels).forEach((key) => {
        const slotKey = String(key || '').trim();
        const labelText = String(labels[key] || '').trim();
        if (slotKey === '' || labelText === '' || !COUPLE_PRESET_SLOTS.includes(slotKey)) {
            return;
        }

        normalized[slotKey] = labelText;
    });

    return normalized;
}
