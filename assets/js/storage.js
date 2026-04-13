const TEMPLATE_KEY = 'rn_template';

export function loadTemplate() {
    return localStorage.getItem(TEMPLATE_KEY);
}

export function saveTemplate(template) {
    localStorage.setItem(TEMPLATE_KEY, template);
}
