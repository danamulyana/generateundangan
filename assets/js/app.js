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
import { buildInvitationLink, buildFinalMessage, buildWhatsAppUrl, parseGuestWithPhone, buildWhatsAppUrlPersonal } from './message.js';
import { createLinkTable, renderInvitationRows } from './table.js';
import {
    DEFAULT_BASE_INVITATION_URL,
    GA_MEASUREMENT_ID,
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
    const RECENT_EMOJIS_KEY = 'rn_recent_emojis';
    const RECENT_EMOJIS_LIMIT = 5;

    const EMOJI_SHORTHAND = {
        ring: '💍',
        cincin: '💍',
        flower: '💐',
        bunga: '💐',
        red_heart: '❤️',
        hati_merah: '❤️',
        love: '❤️',
        white_heart: '🤍',
        hati_putih: '🤍',
        heart: '💖',
        hati: '💖',
        two_hearts: '💕',
        dua_hati: '💕',
        gift: '💝',
        hadiah: '💝',
        letter: '💌',
        surat: '💌',
        diamond: '💎',
        berlian: '💎',
        bow: '🎀',
        pita: '🎀',
        ribbon: '🎀',
        sparkle: '✨',
        kilau: '✨',
        party: '🎉',
        pesta: '🎉',
        confetti: '🎊',
        konfeti: '🎊',
        balloon: '🎈',
        balon: '🎈',
        gift_box: '🎁',
        kotak: '🎁',
        cake: '🎂',
        kue: '🎂',
        smile: '😊',
        senyum: '😊',
        happy: '😀',
        ceria: '😀',
        laugh: '😄',
        tawa: '😄',
        love_smile: '🥰',
        gemas: '🥰',
        heart_eyes: '😍',
        mata_hati: '😍',
        kiss: '😘',
        cium: '😘',
        angel: '😇',
        malaikat: '😇',
        hug: '🤗',
        peluk: '🤗',
        touched: '🥹',
        terharu: '🥹',
        lol: '😂',
        ketawa: '😂',
        wink: '😉',
        kedip: '😉',
        wow: '🤩',
        takjub: '🤩',
        toast: '🥂',
        bersulang: '🥂',
        fireworks: '🎆',
        kembang_api: '🎆',
        bottle: '🍾',
        botol: '🍾',
        rose: '🌹',
        mawar: '🌹',
        cherry: '🌸',
        sakura: '🌸',
        hibiscus: '🌺',
        tulip: '🌷',
        daisy: '🌼',
        daun_bunga: '🌼',
        sunflower: '🌻',
        bunga_matahari: '🌻',
        leaf: '🌿',
        daun: '🌿',
        clover: '🍀',
        semanggi: '🍀',
        dove: '🕊️',
        merpati: '🕊️',
        chapel: '💒',
        gereja: '💒',
        nikah: '💒',
        bride: '👰',
        pengantin: '👰',
        groom: '🤵',
        couple: '💑',
        pasangan: '💑',
        family: '👨‍👩‍👧‍👦',
        keluarga: '👨‍👩‍👧‍👦'
    };

    const table = createLinkTable($('#linkTable'));
    let appState = getDefaultAppState();
    let activeUsageTour = null;
    let templateSelection = { start: 0, end: 0 };
    let emojiSuggestionState = { start: -1, end: -1, prefix: '' };

    function loadRecentEmojis() {
        try {
            const raw = localStorage.getItem(RECENT_EMOJIS_KEY);
            if (!raw) {
                return [];
            }

            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed
                .map((item) => String(item || '').trim())
                .filter((item) => item !== '')
                .slice(0, RECENT_EMOJIS_LIMIT);
        } catch (error) {
            return [];
        }
    }

    function saveRecentEmojis(items) {
        localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(items.slice(0, RECENT_EMOJIS_LIMIT)));
    }

    function renderRecentEmojis() {
        const group = $('#recentEmojiGroup');
        const grid = $('#recentEmojiGrid');
        const recent = loadRecentEmojis();

        grid.empty();

        if (recent.length === 0) {
            group.prop('hidden', true);
            return;
        }

        recent.forEach((emoji) => {
            const button = $('<button>')
                .attr('type', 'button')
                .addClass('emoji-picker-item')
                .attr('data-emoji', emoji)
                .attr('aria-label', `Emoji terbaru ${emoji}`)
                .text(emoji);

            grid.append(button);
        });

        group.prop('hidden', false);
    }

    function addRecentEmoji(emoji) {
        const normalized = String(emoji || '').trim();
        if (normalized === '') {
            return;
        }

        const next = [normalized, ...loadRecentEmojis().filter((item) => item !== normalized)].slice(0, RECENT_EMOJIS_LIMIT);
        saveRecentEmojis(next);
        renderRecentEmojis();
    }

    function initAnalytics() {
        const measurementId = String(GA_MEASUREMENT_ID || '').trim();
        if (!measurementId) {
            return;
        }

        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function gtag() {
            window.dataLayer.push(arguments);
        };

        if (!document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}"]`)) {
            const script = document.createElement('script');
            script.async = true;
            script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
            document.head.appendChild(script);
        }

        window.gtag('js', new Date());
        window.gtag('config', measurementId, {
            anonymize_ip: true,
            send_page_view: true
        });
    }

    function trackAnalyticsEvent(eventName, params = {}) {
        if (typeof window.gtag !== 'function') {
            return;
        }

        window.gtag('event', eventName, {
            app_name: 'RuangNada Generator',
            ...params
        });
    }

    initAnalytics();

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

    function rememberTemplateSelection() {
        const textarea = $('#templateInput').get(0);
        if (!textarea) {
            return;
        }

        templateSelection = {
            start: typeof textarea.selectionStart === 'number' ? textarea.selectionStart : templateSelection.start,
            end: typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : templateSelection.end
        };
    }

    function insertTemplateText(snippet) {
        const textarea = $('#templateInput').get(0);
        if (!textarea) {
            return;
        }

        textarea.focus();

        const currentValue = textarea.value;
        const start = Number.isFinite(templateSelection.start) ? templateSelection.start : currentValue.length;
        const end = Number.isFinite(templateSelection.end) ? templateSelection.end : currentValue.length;
        const insertion = start > 0 && !currentValue.endsWith('\n') ? `\n${snippet}` : snippet;
        const nextValue = currentValue.slice(0, start) + insertion + currentValue.slice(end);

        textarea.value = nextValue;
        saveTemplate(nextValue);
        syncPresetFromCurrentTemplate();

        const cursorPosition = start + insertion.length;
        templateSelection = { start: cursorPosition, end: cursorPosition };
        textarea.setSelectionRange(cursorPosition, cursorPosition);
    }

    function openEmojiPicker() {
        const panel = $('#emojiPickerPanel');
        const toggle = $('#emojiPickerToggle');

        renderRecentEmojis();
        panel.prop('hidden', false).addClass('is-open');
        toggle.attr('aria-expanded', 'true');
    }

    function closeEmojiPicker() {
        const panel = $('#emojiPickerPanel');
        const toggle = $('#emojiPickerToggle');

        panel.removeClass('is-open').prop('hidden', true);
        toggle.attr('aria-expanded', 'false');
    }

    function toggleEmojiPicker() {
        const panel = $('#emojiPickerPanel');

        if (panel.is('[hidden]')) {
            openEmojiPicker();
            return;
        }

        closeEmojiPicker();
    }

    function closeEmojiInlineSuggestion() {
        const suggestion = $('#emojiSuggestion');
        suggestion.prop('hidden', true);
        emojiSuggestionState = { start: -1, end: -1, prefix: '' };
    }

    function getEmojiSuggestionsForPrefix(prefix) {
        if (!prefix || prefix.length === 0) {
            return [];
        }

        const lowerPrefix = prefix.toLowerCase();
        const matches = Object.entries(EMOJI_SHORTHAND)
            .filter(([name]) => name.startsWith(lowerPrefix))
            .map(([name, emoji]) => ({ name, emoji }));

        return matches.slice(0, 8);
    }

    function renderEmojiInlineSuggestions(suggestions, cursorOffset) {
        const suggestion = $('#emojiSuggestion');
        const suggestionList = $('#emojiSuggestionList');

        if (!suggestions || suggestions.length === 0) {
            closeEmojiInlineSuggestion();
            return;
        }

        suggestionList.empty();

        suggestions.forEach((item) => {
            const btn = $('<button>')
                .addClass('emoji-suggestion-item')
                .attr('type', 'button')
                .attr('data-emoji', item.emoji)
                .attr('data-name', item.name)
                .html(`<span>${item.emoji}</span>${item.name}`)
                .on('click', function (event) {
                    event.preventDefault();
                    applyEmojiInlineSuggestion(item.emoji);
                });

            suggestionList.append(btn);
        });

        suggestion.prop('hidden', false);
    }

    function applyEmojiInlineSuggestion(emoji) {
        const textarea = $('#templateInput').get(0);
        if (!textarea || emojiSuggestionState.start < 0) {
            return;
        }

        const currentValue = textarea.value;
        const lineStart = currentValue.lastIndexOf('\n', emojiSuggestionState.start) + 1;
        const beforePrefix = currentValue.slice(0, lineStart);
        const afterSuggestion = currentValue.slice(emojiSuggestionState.end);

        const nextValue = beforePrefix + emoji + afterSuggestion;
        textarea.value = nextValue;

        saveTemplate(nextValue);
        syncPresetFromCurrentTemplate();

        const cursorPosition = lineStart + emoji.length;
        templateSelection = { start: cursorPosition, end: cursorPosition };
        textarea.setSelectionRange(cursorPosition, cursorPosition);
        textarea.focus();

        addRecentEmoji(emoji);
        closeEmojiInlineSuggestion();
    }

    function handleTemplateInput() {
        const textarea = $('#templateInput').get(0);
        if (!textarea) {
            closeEmojiInlineSuggestion();
            return;
        }

        const currentValue = textarea.value;
        const cursor = textarea.selectionStart;

        const beforeCursor = currentValue.slice(0, cursor);
        const colonIndex = beforeCursor.lastIndexOf(':');

        if (colonIndex === -1) {
            closeEmojiInlineSuggestion();
            return;
        }

        const lastNewline = beforeCursor.lastIndexOf('\n');
        const lastSpace = beforeCursor.lastIndexOf(' ');
        const lastBoundary = Math.max(lastNewline, lastSpace);

        if (colonIndex <= lastBoundary) {
            closeEmojiInlineSuggestion();
            return;
        }

        const prefix = beforeCursor.slice(colonIndex + 1);

        if (prefix.match(/[^a-z0-9_]/i)) {
            closeEmojiInlineSuggestion();
            return;
        }

        const suggestions = getEmojiSuggestionsForPrefix(prefix);

        if (suggestions.length > 0) {
            emojiSuggestionState = {
                start: colonIndex,
                end: cursor,
                prefix: prefix
            };
            renderEmojiInlineSuggestions(suggestions);
        } else {
            closeEmojiInlineSuggestion();
        }
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

    function isMobileViewport() {
        return window.matchMedia('(max-width: 767.98px)').matches;
    }

    function cleanupUsageTourArtifacts() {
        // Prevent stale TourGuide nodes from reusing an empty/closed dialog on re-open.
        document.querySelectorAll('.tg-dialog, .tg-backdrop, .tg-overlay, .tg-highlight').forEach((node) => {
            node.remove();
        });

        document.body.classList.remove('tg-open', 'tg-active', 'tg-dialog-open');
    }

    function getUsageTourSteps(isMobile) {
        const mobileStepOptions = isMobile
            ? {
                dialogPlacement: 'bottom',
                targetPadding: 10
            }
            : {};

        return [
            {
                target: '#brideNameInput',
                title: '1. Isi Nama Pengantin',
                content: 'Masukkan nama pengantin agar template otomatis memakai placeholder {{PENGANTIN}}, {{PENGANTIN_1}}, dan {{PENGANTIN_2}}.',
                ...mobileStepOptions
            },
            {
                target: '#couplePresetSlot',
                title: '2. Simpan Profil Pengantin',
                content: 'Pilih slot lalu klik Simpan Slot. Anda juga bisa Rename Label supaya mudah dibedakan antar client.',
                ...mobileStepOptions
            },
            {
                target: '#textareaInput',
                title: '3. Masukkan Daftar Tamu',
                content: 'Format: satu nama per baris. Opsional: tambah nomor HP dengan format "Nama | 6281234567890" untuk kirim personal WA. Jika tanpa nomor, akan generate link generik.',
                ...mobileStepOptions
            },
            {
                target: '#templatePreset',
                title: '4. Pilih Template Pesan',
                content: 'Pilih template siap pakai atau gunakan mode kustom sesuai kebutuhan acara.',
                ...mobileStepOptions
            },
            {
                target: '#templateInput',
                title: '5. Edit Template & Tambah Emoji',
                content: 'Sesuaikan isi pesan. Gunakan tombol Emoji untuk pilih 34+ emoji, atau ketik :name (cth: :ring, :party, :love) untuk saran cepat. Juga ada format bold, italic, coret, monospace.',
                ...mobileStepOptions
            },
            {
                target: '#generateLinks',
                title: '6. Generate Semua Link',
                content: 'Klik untuk membuat link undangan, teks WhatsApp, dan mengisi tabel hasil generate. Sistem akan otomatis mendeteksi nomor HP yang ada.',
                ...mobileStepOptions
            },
            {
                target: '#linkTable',
                title: '7. Kelola Data Undangan',
                content: 'Di tabel: lihat nomor WA (personal atau generik), kirim WA langsung, salin teks, hapus satu/banyak baris. Kolom "No WA" menunjukkan nomor personal atau "-" jika generik.',
                ...mobileStepOptions
            },
            {
                target: '#exportCsv',
                title: '8. Backup dan Pindah Device',
                content: 'Gunakan Export CSV/Backup dan Import Backup dengan mode Merge atau Replace. Data tamu (termasuk nomor HP) tersimpan aman di browser Anda.',
                ...mobileStepOptions
            }
        ];
    }

    function startUsageTour() {
        const TourGuideClient = window.tourguide?.TourGuideClient;
        if (!TourGuideClient) {
            Swal.fire('Info', 'TourGuideJS belum tersedia. Coba refresh halaman.', 'info');
            return;
        }

        if (activeUsageTour && typeof activeUsageTour.exit === 'function') {
            activeUsageTour.exit();
        }

        cleanupUsageTourArtifacts();

        const mobile = isMobileViewport();

        activeUsageTour = new TourGuideClient({
            steps: getUsageTourSteps(mobile),
            nextLabel: 'Lanjut',
            prevLabel: 'Kembali',
            finishLabel: 'Selesai',
            closeButton: true,
            dialogClass: 'rn-tour-dialog',
            backdropClass: 'rn-tour-backdrop',
            progressBar: '#1a7a6b',
            dialogPlacement: mobile ? 'bottom' : 'right',
            completeOnFinish: false,
            showStepProgress: true,
            showStepDots: true,
            keyboardControls: true,
            exitOnEscape: true,
            dialogAnimate: true,
            backdropAnimate: true,
            targetPadding: mobile ? 10 : 16,
            autoScrollOffset: mobile ? 84 : 24
        });

        activeUsageTour.start();
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
                        <li>Generate link undangan WhatsApp otomatis (personal jika nomor tersedia, generik jika tidak).</li>
                        <li>Pilihan template pesan siap pakai + mode kustom.</li>
                        <li>Format cepat WhatsApp (bold, italic, coret, monospace) + emoji picker lengkap.</li>
                        <li>Saran emoji cepat dengan format <code>:nama</code> dan fitur emoji terakhir dipakai.</li>
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
                                <li>Nama pengantin, template pesan, daftar tamu, profil preset, dan emoji terakhir dipakai disimpan lokal pada browser/perangkat Anda.</li>
                                <li>Jika Anda memakai fitur export/import, simpan file backup dengan aman karena dapat memuat daftar tamu, nomor WA, pesan, base URL, serta profil pengantin.</li>
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
            trackAnalyticsEvent('save_couple_preset', {
                slot_id: slotId,
                has_auto_label: autoLabel !== ''
            });
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
            trackAnalyticsEvent('rename_couple_preset', {
                slot_id: slotId,
                has_label: nextLabel !== ''
            });
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
        trackAnalyticsEvent('load_couple_preset', {
            slot_id: slotId
        });
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
            trackAnalyticsEvent('delete_couple_preset', {
                slot_id: slotId
            });
            Swal.fire('Berhasil!', `Preset ${slotId.toUpperCase()} berhasil dihapus.`, 'success');
        }
    });

    $('#templateSizeDown').on('click', function () {
        adjustTemplateRows(-TEMPLATE_ROW_STEP);
        trackAnalyticsEvent('adjust_template_rows', {
            action: 'decrease',
            rows: Number($('#templateInput').attr('rows')) || DEFAULT_TEMPLATE_ROWS
        });
    });

    $('#templateSizeUp').on('click', function () {
        adjustTemplateRows(TEMPLATE_ROW_STEP);
        trackAnalyticsEvent('adjust_template_rows', {
            action: 'increase',
            rows: Number($('#templateInput').attr('rows')) || DEFAULT_TEMPLATE_ROWS
        });
    });

    $('#templateSizeReset').on('click', function () {
        setTemplateRows(DEFAULT_TEMPLATE_ROWS);
        trackAnalyticsEvent('adjust_template_rows', {
            action: 'reset',
            rows: DEFAULT_TEMPLATE_ROWS
        });
    });

    $('#openUsageTour').on('click', function () {
        trackAnalyticsEvent('open_usage_tour');
        startUsageTour();
    });

    $('#templatePreset').on('change', function () {
        const selectedPresetId = $(this).val();

        if (selectedPresetId === CUSTOM_TEMPLATE_PRESET) {
            saveSelectedTemplatePreset(CUSTOM_TEMPLATE_PRESET);
            trackAnalyticsEvent('select_template_preset', {
                preset_id: CUSTOM_TEMPLATE_PRESET
            });
            return;
        }

        applyPresetById(selectedPresetId);
        trackAnalyticsEvent('select_template_preset', {
            preset_id: selectedPresetId
        });
        Swal.fire('Template Dipakai', 'Template pesan berhasil diisi otomatis.', 'success');
    });

    $('#generateLinks').on('click', async function () {
        const guests = parseGuestWithPhone($('#textareaInput').val());
        const template = $('#templateInput').val();
        const baseInvitationUrl = normalizeBaseInvitationUrl($('#baseUrlInput').val());
        const coupleProfile = getCoupleProfileFromInputs();

        if (guests.length === 0) {
            Swal.fire('Oops!', 'Masukkan minimal satu nama tamu.', 'warning');
            return;
        }

        saveTemplate(template);
        $('#baseUrlInput').val(baseInvitationUrl);

        const invitations = guests.map((guest) => {
            const invitationLink = buildInvitationLink(guest.name, baseInvitationUrl);
            const finalMessage = buildFinalMessage(template, guest.name, invitationLink, coupleProfile);
            
            // Use personal WhatsApp URL if phone number provided, otherwise use generic
            const waUrl = guest.phone 
                ? buildWhatsAppUrlPersonal(guest.phone, finalMessage)
                : buildWhatsAppUrl(finalMessage);

            return {
                id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: guest.name,
                whatsappNumber: guest.phone || null,
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

        const personalRecipients = guests.filter((guest) => guest.phone).length;
        trackAnalyticsEvent('generate_links', {
            total_invites: guests.length,
            personal_recipients: personalRecipients,
            generic_recipients: guests.length - personalRecipients
        });

        Swal.fire('Berhasil!', `${guests.length} Undangan siap dikirim.`, 'success');
    });

    $('#templateInput').on('select keyup mouseup click input', function () {
        rememberTemplateSelection();
    });

    $(document).on('click', '.formatSnippetBtn, .emoji-picker-item', function () {
        const snippet = $(this).data('snippet') || $(this).data('emoji');

        if (!snippet) {
            return;
        }

        insertTemplateText(snippet);

        if ($(this).hasClass('emoji-picker-item')) {
            addRecentEmoji(snippet);
            trackAnalyticsEvent('insert_emoji', {
                source: 'picker'
            });
        } else {
            trackAnalyticsEvent('insert_format_snippet');
        }

        closeEmojiPicker();
    });

    $('#emojiPickerToggle').on('click', function (event) {
        event.stopPropagation();
        const isClosed = $('#emojiPickerPanel').is('[hidden]');
        trackAnalyticsEvent('toggle_emoji_picker', {
            action: isClosed ? 'open' : 'close'
        });
        toggleEmojiPicker();
    });

    $('#emojiSuggestion, #emojiSuggestionList').on('click', function (event) {
        event.stopPropagation();
    });

    $(document).on('click', function () {
        closeEmojiPicker();
        closeEmojiInlineSuggestion();
    });

    $(document).on('keydown', function (event) {
        if (event.key === 'Escape') {
            closeEmojiPicker();
            closeEmojiInlineSuggestion();
        }
    });

    $('#templateInput').on('input', function () {
        saveTemplate($(this).val());
        syncPresetFromCurrentTemplate();
        handleTemplateInput();
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

        trackAnalyticsEvent('copy_message_text', {
            message_length: msg.length
        });

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
            trackAnalyticsEvent('delete_single_row');
            Swal.fire('Berhasil!', '1 baris berhasil dihapus.', 'success');
        }
    });

    $(document).on('click', '.sendWaBtn', function () {
        const invitationId = String($(this).data('id') || '');
        const invitation = appState.invitations.find((item) => item.id === invitationId);

        trackAnalyticsEvent('send_whatsapp_click', {
            recipient_type: invitation?.whatsappNumber ? 'personal' : 'generic'
        });
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
            trackAnalyticsEvent('delete_selected_rows', {
                deleted_count: deletedCount
            });
            Swal.fire('Berhasil!', `${deletedCount} baris berhasil dihapus.`, 'success');
        }
    });

    $('#clearTable').on('click', async function () {
        const previousCount = appState.invitations.length;

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

        trackAnalyticsEvent('clear_table', {
            removed_invites: previousCount
        });
    });

    $('#exportCsv').on('click', function () {
        if (appState.invitations.length === 0) {
            Swal.fire('Info', 'Belum ada data untuk diexport.', 'info');
            return;
        }

        exportInvitationsAsCsv(appState.invitations);
        trackAnalyticsEvent('export_csv', {
            invite_count: appState.invitations.length
        });
    });

    $('#exportJson').on('click', function () {
        exportStateAsJson(appState);
        trackAnalyticsEvent('export_backup_json', {
            invite_count: appState.invitations.length
        });
    });

    $('#importJson').on('click', function () {
        $('#importFileInput').val('');
        $('#importFileInput').trigger('click');
        trackAnalyticsEvent('open_import_dialog');
    });

    $('#importFileInput').on('change', async function (event) {
        const file = event.target.files && event.target.files[0];
        if (!file) {
            return;
        }

        trackAnalyticsEvent('select_import_file', {
            file_size_kb: Math.round((file.size || 0) / 1024)
        });

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

                trackAnalyticsEvent('import_backup', {
                    mode: 'replace',
                    imported_count: appState.invitations.length
                });

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

            trackAnalyticsEvent('import_backup', {
                mode: 'merge',
                added_count: mergeResult.addedCount,
                skipped_count: mergeResult.skippedCount,
                total_count: appState.invitations.length
            });

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
