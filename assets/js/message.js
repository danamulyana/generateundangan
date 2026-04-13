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

export function buildFinalMessage(template, name, invitationLink) {
    return template.replace('{{NAMA}}', name).replace('{{LINK}}', invitationLink);
}

export function buildWhatsAppUrl(message) {
    return `${WHATSAPP_URL}${encodeURIComponent(message)}`;
}
