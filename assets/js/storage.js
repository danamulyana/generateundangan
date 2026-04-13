const TEMPLATE_KEY = 'rn_template';
const TEMPLATE_ROWS_KEY = 'rn_template_rows';

export function loadTemplate() {
    return localStorage.getItem(TEMPLATE_KEY);
}

export function saveTemplate(template) {
    localStorage.setItem(TEMPLATE_KEY, template);
}

export function loadTemplateRows() {
    const rawValue = localStorage.getItem(TEMPLATE_ROWS_KEY);
    if (!rawValue) {
        return null;
    }

    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : null;
}

export function saveTemplateRows(rows) {
    localStorage.setItem(TEMPLATE_ROWS_KEY, String(rows));
}
