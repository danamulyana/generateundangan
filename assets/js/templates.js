export const MESSAGE_TEMPLATES = [
    {
        id: 'formal',
        title: 'Formal Klasik',
        content: `*Tanpa Mengurangi Rasa Hormat*

Yth. *{{NAMA}}*,

Kami mengundang Anda untuk hadir di momen bahagia kami:
*{{PENGANTIN}}*

Klik tautan di bawah untuk melihat detail acara dan RSVP:
{{LINK}}

Terima kasih.`
    },
    {
        id: 'semi-formal',
        title: 'Semi Formal Hangat',
        content: `Halo *{{NAMA}}*,

Dengan penuh sukacita, kami mengundang Anda untuk hadir di hari bahagia kami.

*{{PENGANTIN_1}} & {{PENGANTIN_2}}*

Detail acara dapat dilihat di:
{{LINK}}

Kehadiran Anda akan menjadi kebahagiaan besar bagi kami.`
    },
    {
        id: 'friendly',
        title: 'Santai Akrab',
        content: `Hai {{NAMA}}!

Kami lagi bahagia banget dan pengen kamu ikut merayakan momen spesial kami.

Pernikahan *{{PENGANTIN}}*

Info lengkap acara ada di sini:
{{LINK}}

Datang ya, ditunggu!`
    },
    {
        id: 'keluarga',
        title: 'Khusus Keluarga',
        content: `Assalamu'alaikum Wr. Wb.

Kepada Yth. *{{NAMA}}* beserta keluarga,

Kami mengundang untuk hadir pada acara pernikahan kami.

*{{PENGANTIN}}*

Informasi lengkap acara:
{{LINK}}

Jazakumullahu khairan atas doa dan kehadirannya.`
    }
];

export function getTemplateById(templateId) {
    return MESSAGE_TEMPLATES.find((item) => item.id === templateId) || null;
}
