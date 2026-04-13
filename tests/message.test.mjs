import test from 'node:test';
import assert from 'node:assert/strict';
import {
    parseNames,
    buildInvitationLink,
    buildFinalMessage,
    buildWhatsAppUrl
} from '../assets/js/message.js';

test('parseNames membersihkan baris kosong', () => {
    const result = parseNames('Budi\n\n Siti \n');
    assert.deepEqual(result, ['Budi', 'Siti']);
});

test('buildInvitationLink menambahkan encoded nama ke base URL', () => {
    const result = buildInvitationLink('Siti Aminah', 'https://contoh.com/?dear=');
    assert.equal(result, 'https://contoh.com/?dear=Siti%20Aminah');
});

test('buildFinalMessage mengganti placeholder NAMA dan LINK', () => {
    const template = 'Halo {{NAMA}}, link: {{LINK}}';
    const result = buildFinalMessage(template, 'Budi', 'https://contoh.com');
    assert.equal(result, 'Halo Budi, link: https://contoh.com');
});

test('buildWhatsAppUrl menghasilkan URL API WhatsApp valid', () => {
    const result = buildWhatsAppUrl('Halo semuanya');
    assert.equal(result, 'https://api.whatsapp.com/send?text=Halo%20semuanya');
});
