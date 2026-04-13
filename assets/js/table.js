export function createLinkTable($tableElement) {
    return $tableElement.DataTable({
        pageLength: 10,
        language: {
            search: 'Cari Nama:',
            lengthMenu: 'Tampil _MENU_ data'
        }
    });
}

export function addGeneratedRow(table, index, invitation) {
    table.row.add([
        index + 1,
        `<strong>${invitation.name}</strong>`,
        `<div class="quick-actions">
            <a href="${invitation.waUrl}" target="_blank" class="btn btn-sm btn-success"><i class="bi bi-whatsapp me-1"></i>Kirim WA</a>
            <button class="btn btn-sm btn-outline-primary copyBtn" data-msg="${encodeURIComponent(invitation.finalMessage)}"><i class="bi bi-clipboard me-1"></i>Salin Teks</button>
        </div>`
    ]);
}

export function renderInvitationRows(table, invitations) {
    table.clear();
    invitations.forEach((item, index) => addGeneratedRow(table, index, item));
    table.draw();
}
