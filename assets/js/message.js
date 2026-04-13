const WHATSAPP_URL = 'https://api.whatsapp.com/send?text=';

export function parseNames(rawNames) {
    return rawNames
        .split('\n')
        .map((name) => name.trim())
        .filter((name) => name !== '');
}

export function buildInvitationLink(name, baseInvitationUrl) {
    return `${baseInvitationUrl}${encodeURIComponent(name)}`;
}

export function buildFinalMessage(template, name, invitationLink, coupleProfile) {
    const brideName = String(coupleProfile?.brideName || '').trim();
    const groomName = String(coupleProfile?.groomName || '').trim();
    const coupleName = `${brideName} & ${groomName}`;

    return template
        .replaceAll('{{NAMA}}', name)
        .replaceAll('{{LINK}}', invitationLink)
        .replaceAll('{{PENGANTIN}}', coupleName)
        .replaceAll('{{PENGANTIN_1}}', brideName)
        .replaceAll('{{PENGANTIN_2}}', groomName);
}

export function buildWhatsAppUrl(message) {
    return `${WHATSAPP_URL}${encodeURIComponent(message)}`;
}
