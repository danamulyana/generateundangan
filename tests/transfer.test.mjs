import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeInvitationLists, normalizeInvitations } from '../assets/js/transfer.js';

test('normalizeInvitations membuang data yang tidak valid', () => {
    const result = normalizeInvitations([
        {
            name: 'Budi',
            invitationLink: 'https://contoh.com/?dear=Budi',
            finalMessage: 'Halo Budi',
            waUrl: 'https://api.whatsapp.com/send?text=Halo%20Budi'
        },
        {
            name: '',
            invitationLink: 'https://contoh.com/?dear=',
            finalMessage: 'Invalid',
            waUrl: 'https://api.whatsapp.com/send?text=Invalid'
        }
    ]);

    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'Budi');
});

test('mergeInvitationLists menambahkan data baru dan melewati duplikat', () => {
    const existing = [
        {
            name: 'Budi',
            invitationLink: 'https://contoh.com/?dear=Budi',
            finalMessage: 'Halo Budi',
            waUrl: 'https://api.whatsapp.com/send?text=Halo%20Budi'
        }
    ];

    const imported = [
        {
            name: 'Budi',
            invitationLink: 'https://contoh.com/?dear=Budi',
            finalMessage: 'Halo Budi',
            waUrl: 'https://api.whatsapp.com/send?text=Halo%20Budi'
        },
        {
            name: 'Siti',
            invitationLink: 'https://contoh.com/?dear=Siti',
            finalMessage: 'Halo Siti',
            waUrl: 'https://api.whatsapp.com/send?text=Halo%20Siti'
        }
    ];

    const result = mergeInvitationLists(existing, imported);

    assert.equal(result.addedCount, 1);
    assert.equal(result.skippedCount, 1);
    assert.equal(result.importedCount, 2);
    assert.equal(result.merged.length, 2);
});
