import test from 'node:test';
import assert from 'node:assert/strict';
import {
    parseNames,
    buildInvitationLink,
    buildFinalMessage,
    encodeWhatsAppText,
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

test('buildFinalMessage mengganti placeholder NAMA, LINK, dan PENGANTIN', () => {
    const template = 'Halo {{NAMA}}, ini {{PENGANTIN}}. Link: {{LINK}}';
    const result = buildFinalMessage(
        template,
        'Budi',
        'https://contoh.com',
        { brideName: 'Andri', groomName: 'Ranti' }
    );
    assert.equal(result, 'Halo Budi, ini Andri & Ranti. Link: https://contoh.com');
});

test('buildWhatsAppUrl menghasilkan URL API WhatsApp valid', () => {
    const result = buildWhatsAppUrl('Halo semuanya');
    assert.equal(result, 'https://api.whatsapp.com/send?text=Halo%20semuanya');
});

test('encodeWhatsAppText mengamankan emoji dan karakter khusus', () => {
    const result = encodeWhatsAppText('Halo 💍 & selamat');
    assert.equal(result, 'Halo%20%F0%9F%92%8D%20%26%20selamat');
});

test('buildWhatsAppUrl tetap meng-encode emoji untuk WhatsApp', () => {
    const result = buildWhatsAppUrl('Undangan spesial 💐 untuk kamu');
    assert.equal(result, 'https://api.whatsapp.com/send?text=Undangan%20spesial%20%F0%9F%92%90%20untuk%20kamu');
});
