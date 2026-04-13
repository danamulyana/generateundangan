import {
    hasOnboardingAcknowledged,
    loadSelectedCouplePresetSlot,
    loadSelectedTemplatePreset,
    loadTemplate,
    loadTemplateRows,
    saveOnboardingAcknowledged,
    saveSelectedCouplePresetSlot,
    saveSelectedTemplatePreset,
    saveTemplate,
    saveTemplateRows
} from './storage.js';
import { parseNames, buildInvitationLink, buildFinalMessage, buildWhatsAppUrl } from './message.js';
import { createLinkTable, renderInvitationRows } from './table.js';
import {
    DEFAULT_BASE_INVITATION_URL,
    getDefaultAppState,
    normalizeBaseInvitationUrl,
    normalizeCoupleProfile,
    normalizeCouplePresetLabels,
    normalizeCouplePresets
} from './config.js';
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

    function getCoupleProfileFromInputs() {
        return normalizeCoupleProfile({
            brideName: $('#brideNameInput').val(),
            groomName: $('#groomNameInput').val()
        });
    }

    function applyCoupleProfileToInputs(coupleProfile) {
        const safeProfile = normalizeCoupleProfile(coupleProfile);
        $('#brideNameInput').val(safeProfile.brideName);
        $('#groomNameInput').val(safeProfile.groomName);
    }

    function getSelectedCouplePresetSlot() {
        return $('#couplePresetSlot').val();
    }

    function getDefaultSlotLabel(slotId) {
        const map = {
            'profil-a': 'Profil A',
            'profil-b': 'Profil B',
            'profil-c': 'Profil C'
        };

        return map[slotId] || slotId;
    }

    function updateCouplePresetSelectLabels() {
        const select = $('#couplePresetSlot');

        select.find('option').each(function () {
            const slotId = $(this).val();
            const baseLabel = getDefaultSlotLabel(slotId);
            const customLabel = appState.couplePresetLabels?.[slotId];

            $(this).text(customLabel ? `${baseLabel} - ${customLabel}` : baseLabel);
        });
    }

    async function persistAndRenderInvitations(message) {
        renderInvitationRows(table, appState.invitations);
        $('#selectAllRows').prop('checked', false);
        await persistAppStateWithWarning(message);
    }

    async function removeInvitationsByIds(ids) {
        const idSet = new Set(ids);
        const beforeCount = appState.invitations.length;

        appState = {
            ...appState,
            invitations: appState.invitations.filter((item) => !idSet.has(item.id))
        };

        const deletedCount = beforeCount - appState.invitations.length;
        if (deletedCount <= 0) {
            return 0;
        }

        await persistAndRenderInvitations('Gagal memperbarui data setelah hapus baris.');
        return deletedCount;
    }

    async function confirmDeleteRows(totalRows) {
        const result = await Swal.fire({
            title: 'Konfirmasi Hapus',
            text: `Yakin ingin menghapus ${totalRows} baris terpilih?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal'
        });

        return result.isConfirmed;
    }

    async function persistAppStateWithWarning(message) {
        try {
            await saveAppState(appState);
            return true;
        } catch (error) {
            Swal.fire('Peringatan', message, 'warning');
            return false;
        }
    }

    async function showOnboardingModalIfNeeded() {
        if (hasOnboardingAcknowledged()) {
            return;
        }

        const result = await Swal.fire({
            title: 'Selamat Datang di RuangNada Invitation Generator',
            html: `
                <div style="text-align:left; font-size:0.95rem; line-height:1.5;">
                    <p class="mb-2"><strong>Fitur yang tersedia:</strong></p>
                    <ul class="mb-3">
                        <li>Generate link undangan WhatsApp otomatis dari daftar nama.</li>
                        <li>Pilihan template pesan siap pakai + mode kustom.</li>
                        <li>Format cepat WhatsApp (bold, italic, coret, monospace).</li>
                        <li>Auto-save data di browser (tetap ada saat refresh).</li>
                        <li>Export CSV, Export Backup, dan Import Backup lintas device.</li>
                        <li>Import mode Merge/Replace dengan deteksi duplikat.</li>
                    </ul>
                    <div style="border:1px solid #d3e8e3; border-radius:12px; padding:12px; background:#f1f7f6;">
                        <p class="mb-2"><strong>T&amp;C:</strong></p>
                        <div id="onboardingTermsBox" style="max-height:220px; overflow:auto; padding-right:6px; text-align:left;">
                            <ul class="mb-0">
                                <li>Pastikan undangan yang dibuat memang digunakan untuk acara Anda dan untuk penerima yang berhak dihubungi.</li>
                                <li>Dilarang menggunakan tool ini untuk spam, penipuan, penyamaran identitas, atau aktivitas yang melanggar hukum.</li>
                                <li>Nama pengantin, template pesan, dan profil preset yang disimpan di browser hanya tersimpan lokal pada perangkat Anda melalui browser storage dan IndexedDB.</li>
                                <li>Jika Anda memakai fitur export/import, pastikan file backup disimpan aman karena isinya dapat memuat daftar tamu, pesan, base URL, dan profil pengantin.</li>
                                <li>Fitur merge saat import akan menambahkan data baru dan melewati duplikat, tetapi tetap menjadi tanggung jawab pengguna untuk memeriksa hasil akhirnya.</li>
                                <li>Fitur hapus row, hapus terpilih, reset data, atau replace import akan mengubah data yang tersimpan di browser. Pastikan Anda sudah melakukan backup jika diperlukan.</li>
                                <li>Tool ini disediakan "sebagaimana adanya". RuangNada tidak menjamin pengiriman pesan berhasil jika nomor WhatsApp tujuan tidak aktif, format pesan salah, atau layanan pihak ketiga mengalami gangguan.</li>
                                <li>RuangNada dapat menambah, mengubah, atau menghentikan fitur kapan saja untuk pemeliharaan, peningkatan kualitas, atau alasan operasional lainnya.</li>
                                <li>Pengguna bertanggung jawab penuh atas isi pesan yang dibuat, data yang dimasukkan, dan penggunaan hasil generator sesuai hukum yang berlaku.</li>
                            </ul>
                        </div>
                        <small id="onboardingTermsHint" class="d-block mt-2 text-muted">Scroll sampai bawah untuk mengaktifkan centang persetujuan.</small>
                    </div>
                </div>
            `,
            input: 'checkbox',
            inputValue: 0,
            inputPlaceholder: 'Saya sudah membaca dan menyetujui T&C.',
            confirmButtonText: 'Mulai Gunakan',
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
                const popup = Swal.getPopup();
                const checkbox = popup?.querySelector('.swal2-checkbox input');
                const termsBox = popup?.querySelector('#onboardingTermsBox');
                const termsHint = popup?.querySelector('#onboardingTermsHint');

                if (!checkbox || !termsBox) {
                    return;
                }

                checkbox.disabled = true;

                const unlockCheckboxIfRead = () => {
                    const isAtBottom = termsBox.scrollTop + termsBox.clientHeight >= termsBox.scrollHeight - 4;
                    if (isAtBottom) {
                        checkbox.disabled = false;
                        if (termsHint) {
                            termsHint.textContent = 'Persetujuan sudah aktif. Silakan centang untuk melanjutkan.';
                        }
                    }
                };

                termsBox.addEventListener('scroll', unlockCheckboxIfRead);
                unlockCheckboxIfRead();
            },
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

    appState = {
        ...appState,
        coupleProfile: normalizeCoupleProfile(appState.coupleProfile),
        couplePresets: normalizeCouplePresets(appState.couplePresets),
        couplePresetLabels: normalizeCouplePresetLabels(appState.couplePresetLabels)
    };

    updateCouplePresetSelectLabels();

    const savedCouplePresetSlot = loadSelectedCouplePresetSlot();
    if (savedCouplePresetSlot) {
        $('#couplePresetSlot').val(savedCouplePresetSlot);
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

    applyCoupleProfileToInputs(appState.coupleProfile);
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

    $('#couplePresetSlot').on('change', function () {
        saveSelectedCouplePresetSlot(getSelectedCouplePresetSlot());
    });

    $('#saveCouplePreset').on('click', async function () {
        const slotId = getSelectedCouplePresetSlot();
        const coupleProfile = getCoupleProfileFromInputs();
        const autoLabel = `${coupleProfile.brideName} & ${coupleProfile.groomName}`.trim();

        appState = {
            ...appState,
            coupleProfile,
            couplePresets: {
                ...appState.couplePresets,
                [slotId]: coupleProfile
            },
            couplePresetLabels: {
                ...appState.couplePresetLabels,
                [slotId]: autoLabel
            }
        };

        const ok = await persistAppStateWithWarning('Preset profil pengantin gagal disimpan.');
        if (ok) {
            updateCouplePresetSelectLabels();
            Swal.fire('Berhasil!', `Profil pengantin tersimpan di ${slotId.toUpperCase()}.`, 'success');
        }
    });

    $('#renameCouplePreset').on('click', async function () {
        const slotId = getSelectedCouplePresetSlot();
        const currentLabel = appState.couplePresetLabels?.[slotId] || '';

        const result = await Swal.fire({
            title: `Rename ${getDefaultSlotLabel(slotId)}`,
            input: 'text',
            inputValue: currentLabel,
            inputPlaceholder: 'Contoh: Client Budi & Siti',
            confirmButtonText: 'Simpan Label',
            showCancelButton: true,
            cancelButtonText: 'Batal'
        });

        if (!result.isConfirmed) {
            return;
        }

        const nextLabel = String(result.value || '').trim();
        const nextLabels = { ...appState.couplePresetLabels };

        if (nextLabel === '') {
            delete nextLabels[slotId];
        } else {
            nextLabels[slotId] = nextLabel;
        }

        appState = {
            ...appState,
            couplePresetLabels: nextLabels
        };

        const ok = await persistAppStateWithWarning('Label profil gagal disimpan.');
        if (ok) {
            updateCouplePresetSelectLabels();
            Swal.fire('Berhasil!', `Label ${getDefaultSlotLabel(slotId)} diperbarui.`, 'success');
        }
    });

    $('#loadCouplePreset').on('click', function () {
        const slotId = getSelectedCouplePresetSlot();
        const preset = appState.couplePresets?.[slotId];

        if (!preset) {
            Swal.fire('Info', `Slot ${slotId.toUpperCase()} belum memiliki profil tersimpan.`, 'info');
            return;
        }

        applyCoupleProfileToInputs(preset);
        appState = {
            ...appState,
            coupleProfile: normalizeCoupleProfile(preset)
        };
        Swal.fire('Berhasil!', `Profil dari ${slotId.toUpperCase()} sudah dimuat.`, 'success');
    });

    $('#deleteCouplePreset').on('click', async function () {
        const slotId = getSelectedCouplePresetSlot();
        if (!appState.couplePresets?.[slotId]) {
            Swal.fire('Info', `Slot ${slotId.toUpperCase()} sudah kosong.`, 'info');
            return;
        }

        const updatedPresets = { ...appState.couplePresets };
        const updatedLabels = { ...appState.couplePresetLabels };
        delete updatedPresets[slotId];
        delete updatedLabels[slotId];
        appState = {
            ...appState,
            couplePresets: updatedPresets,
            couplePresetLabels: updatedLabels
        };

        const ok = await persistAppStateWithWarning('Gagal menghapus preset profil pengantin.');
        if (ok) {
            updateCouplePresetSelectLabels();
            Swal.fire('Berhasil!', `Preset ${slotId.toUpperCase()} berhasil dihapus.`, 'success');
        }
    });

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
        const coupleProfile = getCoupleProfileFromInputs();

        if (names.length === 0) {
            Swal.fire('Oops!', 'Masukkan minimal satu nama tamu.', 'warning');
            return;
        }

        saveTemplate(template);
        $('#baseUrlInput').val(baseInvitationUrl);

        const invitations = names.map((name) => {
            const invitationLink = buildInvitationLink(name, baseInvitationUrl);
            const finalMessage = buildFinalMessage(template, name, invitationLink, coupleProfile);
            const waUrl = buildWhatsAppUrl(finalMessage);

            return {
                id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name,
                invitationLink,
                finalMessage,
                waUrl,
                createdAt: new Date().toISOString()
            };
        });

        appState = {
            ...appState,
            invitations,
            baseInvitationUrl,
            coupleProfile
        };

        renderInvitationRows(table, appState.invitations);

        await persistAppStateWithWarning('Data gagal disimpan ke IndexedDB.');

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

    $('#brideNameInput, #groomNameInput').on('input', async function () {
        appState = {
            ...appState,
            coupleProfile: getCoupleProfileFromInputs()
        };

        await persistAppStateWithWarning('Nama pengantin gagal disimpan otomatis.');
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

    $(document).on('click', '.deleteRowBtn', async function () {
        const invitationId = String($(this).data('id') || '');
        if (!invitationId) {
            return;
        }

        const isConfirmed = await confirmDeleteRows(1);
        if (!isConfirmed) {
            return;
        }

        const deletedCount = await removeInvitationsByIds([invitationId]);
        if (deletedCount > 0) {
            Swal.fire('Berhasil!', '1 baris berhasil dihapus.', 'success');
        }
    });

    $(document).on('change', '#selectAllRows', function () {
        const checked = $(this).is(':checked');
        $('.rowSelect').prop('checked', checked);
    });

    $(document).on('change', '.rowSelect', function () {
        const total = $('.rowSelect').length;
        const selected = $('.rowSelect:checked').length;
        $('#selectAllRows').prop('checked', total > 0 && total === selected);
    });

    $('#deleteSelectedRows').on('click', async function () {
        const selectedIds = $('.rowSelect:checked')
            .map(function () {
                return String($(this).data('id') || '');
            })
            .get()
            .filter((id) => id !== '');

        if (selectedIds.length === 0) {
            Swal.fire('Info', 'Pilih minimal satu baris untuk dihapus.', 'info');
            return;
        }

        const isConfirmed = await confirmDeleteRows(selectedIds.length);
        if (!isConfirmed) {
            return;
        }

        const deletedCount = await removeInvitationsByIds(selectedIds);
        if (deletedCount > 0) {
            Swal.fire('Berhasil!', `${deletedCount} baris berhasil dihapus.`, 'success');
        }
    });

    $('#clearTable').on('click', async function () {
        appState = {
            ...appState,
            invitations: [],
            baseInvitationUrl: normalizeBaseInvitationUrl($('#baseUrlInput').val() || DEFAULT_BASE_INVITATION_URL),
            coupleProfile: getCoupleProfileFromInputs()
        };

        try {
            await clearAppState();
        } catch (error) {
            Swal.fire('Peringatan', 'Gagal membersihkan data IndexedDB.', 'warning');
        }

        await persistAppStateWithWarning('Gagal membersihkan data IndexedDB.');

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
                baseInvitationUrl: normalizeBaseInvitationUrl(payload.state.baseInvitationUrl),
                coupleProfile: normalizeCoupleProfile(payload.state.coupleProfile),
                couplePresets: normalizeCouplePresets(payload.state.couplePresets),
                couplePresetLabels: normalizeCouplePresetLabels(payload.state.couplePresetLabels)
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
                applyCoupleProfileToInputs(appState.coupleProfile);
                updateCouplePresetSelectLabels();
                renderInvitationRows(table, appState.invitations);
                await persistAppStateWithWarning('Data import gagal disimpan ke IndexedDB.');

                Swal.fire('Berhasil!', `${appState.invitations.length} data berhasil diimport dengan mode replace.`, 'success');
                return;
            }

            const mergeResult = mergeInvitationLists(appState.invitations, importedState.invitations);
            appState = {
                ...appState,
                invitations: mergeResult.merged,
                baseInvitationUrl: normalizeBaseInvitationUrl($('#baseUrlInput').val()),
                coupleProfile: getCoupleProfileFromInputs()
            };

            renderInvitationRows(table, appState.invitations);
            await persistAppStateWithWarning('Data merge gagal disimpan ke IndexedDB.');

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
