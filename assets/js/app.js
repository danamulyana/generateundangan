import {
    hasOnboardingAcknowledged,
    loadSelectedTemplatePreset,
    loadTemplate,
    loadTemplateRows,
    saveOnboardingAcknowledged,
    saveSelectedTemplatePreset,
    saveTemplate,
    saveTemplateRows
} from './storage.js';
import { parseNames, buildInvitationLink, buildFinalMessage, buildWhatsAppUrl } from './message.js';
import { createLinkTable, renderInvitationRows } from './table.js';
import { DEFAULT_BASE_INVITATION_URL, getDefaultAppState, normalizeBaseInvitationUrl } from './config.js';
import { getTemplateById, MESSAGE_TEMPLATES } from './templates.js';
import { clearAppState, loadAppState, saveAppState } from './db.js';
import {
    exportInvitationsAsCsv,
    exportStateAsJson,
    mergeInvitationLists,
    normalizeInvitations,
    readJsonFile,
    validateImportedPayload
} from './transfer.js';

$(document).ready(async function () {
    const CUSTOM_TEMPLATE_PRESET = 'custom';
    const DEFAULT_TEMPLATE_ROWS = 8;
    const MIN_TEMPLATE_ROWS = 6;
    const MAX_TEMPLATE_ROWS = 30;
    const TEMPLATE_ROW_STEP = 2;

    const table = createLinkTable($('#linkTable'));
    let appState = getDefaultAppState();

    async function showOnboardingModalIfNeeded() {
        if (hasOnboardingAcknowledged()) {
            return;
        }

        const result = await Swal.fire({
            title: 'Selamat Datang di RuangNada Invitation Generator',
            html: `
                <div style="text-align:left; font-size:0.95rem; line-height:1.5;">
                    <p><strong>Fitur yang tersedia:</strong></p>
                    <ul>
                        <li>Generate link undangan WhatsApp otomatis dari daftar nama.</li>
                        <li>Pilihan template pesan siap pakai + mode kustom.</li>
                        <li>Format cepat WhatsApp (bold, italic, coret, monospace).</li>
                        <li>Auto-save data di browser (tetap ada saat refresh).</li>
                        <li>Export CSV, Export Backup, dan Import Backup lintas device.</li>
                        <li>Import mode Merge/Replace dengan deteksi duplikat.</li>
                    </ul>
                    <p class="mb-1"><strong>T&amp;C:</strong></p>
                    <ul>
                        <li>pastikan undangan anda dari ruangnada invitation</li>
                        <li>Pastikan Anda berhak menghubungi penerima undangan.</li>
                        <li>Dilarang menggunakan tool untuk spam atau pesan merugikan.</li>
                        <li>RuangNada tidak bertanggung jawab atas kesalahan pengetikan nama, nomor WhatsApp yang tidak aktif, atau konten pesan yang dikirimkan oleh pengguna.</li>
                        <li>Sistem ini tidak menyimpan data nama tamu Anda di server kami (Full Client-Side). Keamanan data sepenuhnya menjadi tanggung jawab pengguna saat melakukan ekspor/impor file backup.</li>
                        <li>Tool ini disediakan "sebagaimana adanya". RuangNada berhak memperbarui fitur atau menghentikan layanan generator ini sewaktu-waktu untuk pemeliharaan sistem.</li>
                    </ul>
                </div>
            `,
            input: 'checkbox',
            inputValue: 0,
            inputPlaceholder: 'Saya sudah membaca dan menyetujui T&C.',
            confirmButtonText: 'Mulai Gunakan',
            allowOutsideClick: false,
            allowEscapeKey: false,
            inputValidator: (checked) => {
                if (!checked) {
                    return 'Centang persetujuan T&C untuk melanjutkan.';
                }

                return null;
            }
        });

        if (result.isConfirmed) {
            saveOnboardingAcknowledged();
        }
    }

    function getPresetByContent(content) {
        return MESSAGE_TEMPLATES.find((item) => item.content.trim() === String(content || '').trim()) || null;
    }

    function populateTemplatePresets() {
        const select = $('#templatePreset');
        select.empty();
        select.append(`<option value="${CUSTOM_TEMPLATE_PRESET}">Kustom (Template Sendiri)</option>`);

        MESSAGE_TEMPLATES.forEach((item) => {
            select.append(`<option value="${item.id}">${item.title}</option>`);
        });
    }

    function syncPresetFromCurrentTemplate() {
        const currentValue = $('#templateInput').val();
        const matchedPreset = getPresetByContent(currentValue);

        if (matchedPreset) {
            $('#templatePreset').val(matchedPreset.id);
            saveSelectedTemplatePreset(matchedPreset.id);
            return;
        }

        $('#templatePreset').val(CUSTOM_TEMPLATE_PRESET);
        saveSelectedTemplatePreset(CUSTOM_TEMPLATE_PRESET);
    }

    function applyPresetById(templateId) {
        const selectedTemplate = getTemplateById(templateId);
        if (!selectedTemplate) {
            return;
        }

        $('#templateInput').val(selectedTemplate.content);
        saveTemplate(selectedTemplate.content);
        saveSelectedTemplatePreset(selectedTemplate.id);
    }

    populateTemplatePresets();
    await showOnboardingModalIfNeeded();

    try {
        appState = await loadAppState();
    } catch (error) {
        Swal.fire('Peringatan', 'IndexedDB tidak bisa diakses. Data hanya tersimpan sementara sesi ini.', 'warning');
    }

    const savedTemplate = loadTemplate();
    if (savedTemplate) {
        $('#templateInput').val(savedTemplate);
    }

    const savedTemplatePreset = loadSelectedTemplatePreset();
    if (savedTemplatePreset && savedTemplatePreset !== CUSTOM_TEMPLATE_PRESET && !savedTemplate) {
        applyPresetById(savedTemplatePreset);
    }

    syncPresetFromCurrentTemplate();

    const savedTemplateRows = loadTemplateRows();
    if (savedTemplateRows) {
        const initialRows = Math.max(MIN_TEMPLATE_ROWS, Math.min(MAX_TEMPLATE_ROWS, savedTemplateRows));
        $('#templateInput').attr('rows', initialRows);
    }

    $('#baseUrlInput').val(normalizeBaseInvitationUrl(appState.baseInvitationUrl));
    renderInvitationRows(table, appState.invitations);

    function setTemplateRows(nextRows) {
        const safeRows = Math.max(MIN_TEMPLATE_ROWS, Math.min(MAX_TEMPLATE_ROWS, nextRows));
        $('#templateInput').attr('rows', safeRows);
        saveTemplateRows(safeRows);
    }

    function adjustTemplateRows(delta) {
        const textarea = $('#templateInput');
        const currentRows = Number(textarea.attr('rows')) || DEFAULT_TEMPLATE_ROWS;
        setTemplateRows(currentRows + delta);
    }

    $('#templateSizeDown').on('click', function () {
        adjustTemplateRows(-TEMPLATE_ROW_STEP);
    });

    $('#templateSizeUp').on('click', function () {
        adjustTemplateRows(TEMPLATE_ROW_STEP);
    });

    $('#templateSizeReset').on('click', function () {
        setTemplateRows(DEFAULT_TEMPLATE_ROWS);
    });

    $('#templatePreset').on('change', function () {
        const selectedPresetId = $(this).val();

        if (selectedPresetId === CUSTOM_TEMPLATE_PRESET) {
            saveSelectedTemplatePreset(CUSTOM_TEMPLATE_PRESET);
            return;
        }

        applyPresetById(selectedPresetId);
        Swal.fire('Template Dipakai', 'Template pesan berhasil diisi otomatis.', 'success');
    });

    $('#generateLinks').on('click', async function () {
        const names = parseNames($('#textareaInput').val());
        const template = $('#templateInput').val();
        const baseInvitationUrl = normalizeBaseInvitationUrl($('#baseUrlInput').val());

        if (names.length === 0) {
            Swal.fire('Oops!', 'Masukkan minimal satu nama tamu.', 'warning');
            return;
        }

        saveTemplate(template);
        $('#baseUrlInput').val(baseInvitationUrl);

        const invitations = names.map((name) => {
            const invitationLink = buildInvitationLink(name, baseInvitationUrl);
            const finalMessage = buildFinalMessage(template, name, invitationLink);
            const waUrl = buildWhatsAppUrl(finalMessage);

            return {
                name,
                invitationLink,
                finalMessage,
                waUrl,
                createdAt: new Date().toISOString()
            };
        });

        appState = {
            invitations,
            baseInvitationUrl
        };

        renderInvitationRows(table, appState.invitations);

        try {
            await saveAppState(appState);
        } catch (error) {
            Swal.fire('Peringatan', 'Data gagal disimpan ke IndexedDB.', 'warning');
        }

        Swal.fire('Berhasil!', `${names.length} Undangan siap dikirim.`, 'success');
    });

    $('.formatSnippetBtn').on('click', function () {
        const snippet = $(this).data('snippet');
        const textarea = $('#templateInput').get(0);
        const currentValue = textarea.value;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        const insertion = start > 0 && !currentValue.endsWith('\n') ? `\n${snippet}` : snippet;
        const nextValue = currentValue.slice(0, start) + insertion + currentValue.slice(end);

        textarea.value = nextValue;
        saveTemplate(nextValue);
        syncPresetFromCurrentTemplate();
        const cursorPosition = start + insertion.length;
        textarea.focus();
        textarea.setSelectionRange(cursorPosition, cursorPosition);
    });

    $('#templateInput').on('input', function () {
        saveTemplate($(this).val());
        syncPresetFromCurrentTemplate();
    });

    $(document).on('click', '.copyBtn', function () {
        const msg = decodeURIComponent($(this).data('msg'));
        navigator.clipboard.writeText(msg);

        $(this)
            .text('Tersalin!')
            .addClass('btn-primary')
            .removeClass('btn-outline-primary');

        setTimeout(() => {
            $(this)
                .text('Salin Teks')
                .addClass('btn-outline-primary')
                .removeClass('btn-primary');
        }, 2000);
    });

    $('#clearTable').on('click', async function () {
        appState = {
            invitations: [],
            baseInvitationUrl: normalizeBaseInvitationUrl($('#baseUrlInput').val() || DEFAULT_BASE_INVITATION_URL)
        };

        try {
            await clearAppState();
            await saveAppState(appState);
        } catch (error) {
            Swal.fire('Peringatan', 'Gagal membersihkan data IndexedDB.', 'warning');
        }

        table.clear().draw();
        $('#textareaInput').val('');
    });

    $('#exportCsv').on('click', function () {
        if (appState.invitations.length === 0) {
            Swal.fire('Info', 'Belum ada data untuk diexport.', 'info');
            return;
        }

        exportInvitationsAsCsv(appState.invitations);
    });

    $('#exportJson').on('click', function () {
        exportStateAsJson(appState);
    });

    $('#importJson').on('click', function () {
        $('#importFileInput').val('');
        $('#importFileInput').trigger('click');
    });

    $('#importFileInput').on('change', async function (event) {
        const file = event.target.files && event.target.files[0];
        if (!file) {
            return;
        }

        try {
            const payload = await readJsonFile(file);

            if (!validateImportedPayload(payload)) {
                Swal.fire('Gagal', 'Format file backup tidak valid.', 'error');
                return;
            }

            const importedState = {
                invitations: normalizeInvitations(payload.state.invitations),
                baseInvitationUrl: normalizeBaseInvitationUrl(payload.state.baseInvitationUrl)
            };

            if (importedState.invitations.length === 0) {
                Swal.fire('Info', 'Backup valid, tetapi tidak ada data undangan yang bisa dipakai.', 'info');
                return;
            }

            const shouldAskMode = appState.invitations.length > 0;
            let importMode = 'replace';

            if (shouldAskMode) {
                const choice = await Swal.fire({
                    title: 'Pilih Mode Import',
                    text: 'Merge akan menambahkan data baru tanpa menimpa data saat ini.',
                    icon: 'question',
                    showCancelButton: true,
                    showDenyButton: true,
                    confirmButtonText: 'Merge Data',
                    denyButtonText: 'Replace Semua',
                    cancelButtonText: 'Batal'
                });

                if (choice.isDismissed) {
                    return;
                }

                importMode = choice.isConfirmed ? 'merge' : 'replace';
            }

            if (importMode === 'replace') {
                appState = importedState;
                $('#baseUrlInput').val(appState.baseInvitationUrl);
                renderInvitationRows(table, appState.invitations);
                await saveAppState(appState);

                Swal.fire('Berhasil!', `${appState.invitations.length} data berhasil diimport dengan mode replace.`, 'success');
                return;
            }

            const mergeResult = mergeInvitationLists(appState.invitations, importedState.invitations);
            appState = {
                invitations: mergeResult.merged,
                baseInvitationUrl: normalizeBaseInvitationUrl($('#baseUrlInput').val())
            };

            renderInvitationRows(table, appState.invitations);
            await saveAppState(appState);

            Swal.fire(
                'Merge Selesai!',
                `Ditambahkan: ${mergeResult.addedCount}, Duplikat dilewati: ${mergeResult.skippedCount}, Total data sekarang: ${appState.invitations.length}.`,
                'success'
            );
        } catch (error) {
            Swal.fire('Gagal', 'Terjadi kesalahan saat import backup.', 'error');
        }
    });
});
