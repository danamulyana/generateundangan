function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

export function exportInvitationsAsCsv(invitations) {
    const header = ['No', 'Nama Tamu', 'Link Undangan', 'Pesan'];
    const rows = invitations.map((item, index) => [
        index + 1,
        item.name,
        item.invitationLink,
        item.finalMessage
    ]);

    const csvLines = [header, ...rows].map((line) =>
        line
            .map((cell) => `"${String(cell || '').replaceAll('"', '""')}"`)
            .join(',')
    );

    downloadFile(csvLines.join('\n'), 'undangan-ruangnada.csv', 'text/csv;charset=utf-8;');
}

export function exportStateAsJson(state) {
    const payload = {
        exportedAt: new Date().toISOString(),
        state
    };

    downloadFile(
        JSON.stringify(payload, null, 2),
        'backup-ruangnada.json',
        'application/json;charset=utf-8;'
    );
}

export function readJsonFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function (event) {
            try {
                const parsed = JSON.parse(event.target.result);
                resolve(parsed);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = function () {
            reject(reader.error);
        };

        reader.readAsText(file);
    });
}

export function validateImportedPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    if (!payload.state || typeof payload.state !== 'object') {
        return false;
    }

    if (!Array.isArray(payload.state.invitations)) {
        return false;
    }

    return true;
}

function sanitizeInvitation(item) {
    if (!item || typeof item !== 'object') {
        return null;
    }

    const name = String(item.name || '').trim();
    const invitationLink = String(item.invitationLink || '').trim();
    const finalMessage = String(item.finalMessage || '').trim();
    const waUrl = String(item.waUrl || '').trim();

    if (name === '' || invitationLink === '' || finalMessage === '' || waUrl === '') {
        return null;
    }

    return {
        name,
        invitationLink,
        finalMessage,
        waUrl,
        createdAt: item.createdAt || new Date().toISOString()
    };
}

function invitationKey(item) {
    return `${item.name.toLowerCase()}::${item.invitationLink.toLowerCase()}`;
}

export function normalizeInvitations(invitations) {
    return invitations
        .map((item) => sanitizeInvitation(item))
        .filter((item) => item !== null);
}

export function mergeInvitationLists(existingInvitations, importedInvitations) {
    const existing = normalizeInvitations(existingInvitations);
    const incoming = normalizeInvitations(importedInvitations);
    const keys = new Set(existing.map((item) => invitationKey(item)));
    const merged = [...existing];

    let addedCount = 0;
    let skippedCount = 0;

    incoming.forEach((item) => {
        const key = invitationKey(item);
        if (keys.has(key)) {
            skippedCount += 1;
            return;
        }

        keys.add(key);
        merged.push(item);
        addedCount += 1;
    });

    return {
        merged,
        addedCount,
        skippedCount,
        importedCount: incoming.length
    };
}
