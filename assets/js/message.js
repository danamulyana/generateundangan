const WHATSAPP_URL = 'https://api.whatsapp.com/send?text=';
const WHATSAPP_PERSONAL_URL = 'https://api.whatsapp.com/send?phone=';

export function encodeWhatsAppText(message) {
    return encodeURIComponent(String(message || ''));
}

export function parseNames(rawNames) {
    return rawNames
        .split('\n')
        .map((name) => name.trim())
        .filter((name) => name !== '');
}

export function parseGuestWithPhone(rawGuests) {
    return rawGuests
        .split('\n')
        .map((line) => {
            const trimmed = line.trim();
            const parts = trimmed.split('|').map(p => p.trim());
            
            if (parts.length === 2) {
                const name = parts[0];
                const phone = parts[1].replace(/\D/g, ''); // Extract digits only
                return { name, phone: phone || null };
            }
            return { name: trimmed, phone: null };
        })
        .filter((item) => item.name !== '');
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
    return `${WHATSAPP_URL}${encodeWhatsAppText(message)}`;
}

export function buildWhatsAppUrlPersonal(phone, message) {
    // Ensure phone starts with country code (62 for Indonesia)
    let normalizedPhone = phone.toString().replace(/\D/g, '');
    if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '62' + normalizedPhone.slice(1);
    }
    if (!normalizedPhone.startsWith('62')) {
        normalizedPhone = '62' + normalizedPhone;
    }
    
    return `${WHATSAPP_PERSONAL_URL}${normalizedPhone}&text=${encodeWhatsAppText(message)}`;
}
