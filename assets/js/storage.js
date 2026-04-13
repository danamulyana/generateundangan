const TEMPLATE_KEY = 'rn_template';
const TEMPLATE_ROWS_KEY = 'rn_template_rows';
const TEMPLATE_PRESET_KEY = 'rn_template_preset';
const ONBOARDING_ACK_KEY = 'rn_onboarding_ack_v1';

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

export function loadSelectedTemplatePreset() {
    return localStorage.getItem(TEMPLATE_PRESET_KEY);
}

export function saveSelectedTemplatePreset(templatePresetId) {
    localStorage.setItem(TEMPLATE_PRESET_KEY, templatePresetId);
}

export function hasOnboardingAcknowledged() {
    return localStorage.getItem(ONBOARDING_ACK_KEY) === 'true';
}

export function saveOnboardingAcknowledged() {
    localStorage.setItem(ONBOARDING_ACK_KEY, 'true');
}
