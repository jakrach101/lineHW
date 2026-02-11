const defaultHeader = [
    `ผู้ป่วย: ... (อายุ ... ปี)`,
    `Dx: ...`,
    `Admit: ...`,
    `  CC: ...`,
    `  HPI: ...`,
    `  PH: ...`,
    `  FHx: ...`,
    `  Allergy: ...`,
    `==============`,
    `💊 Review Treatment (ปรับยาล่าสุด ...)`,
    `• ...`
].join('\n');

const blankTemplate = defaultHeader;
const defaultHistory = ``;

const FORM_STORAGE_KEY = 'patientLog_formState';
const ADVANCED_MODE_STORAGE_KEY = 'patientLog_advancedMode';
const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const MEDS_STORE_KEY = 'patientLog_medsStore';
const MEDS_STORE_VERSION = 1;
const ORDERS_STORE_KEY = 'patientLog_ordersStore';
const ORDERS_STORE_VERSION = 1;
const FORM_TEXT_IDS = [
    'pHN', 'pFName', 'pAge', 'pDx', 'pIndication', 'pAdmitDate', 'pAllergy', 'pNote', 'pMedsCont', 'medsUpdateDate',
    'inputCC', 'inputHPI', 'inputPMH', 'inputFHx',
    'inputOneDay_Admit', 'inputCont_Admit', 'inputPlanMx_Admit',
    'logDate', 'logTime', 'inputS',
    'valBP', 'valT', 'valP', 'valR', 'valDTX', 'dtxType', 'valDTX_Hr',
    'valSpO2', 'valUrine', 'valStool',
    'inputO_Extra', 'inputAP', 'medsChangedList', 'medsChangeBaseline',
    'assessmentStatus', 'headerPart', 'historyPart', 'isAdmitMode',
];
const FORM_CHECK_IDS = ['medsVerified', 'assessmentWatch', 'assessmentRisk'];

const SENSITIVE_FIELDS = ['pFName', 'pDx', 'pIndication', 'pAllergy', 'pNote', 'inputCC', 'inputHPI', 'inputPMH', 'inputFHx'];

// Modal Helper Functions
function openModal(modalId, { focusSelector = 'input', delay = 50 } = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    if (focusSelector) {
        setTimeout(() => {
            const first = modal.querySelector(focusSelector);
            if (first) {
                first.focus();
                if (typeof first.select === 'function') first.select();
            }
        }, delay);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
}

// DOM Creation Helper Functions
function createElementWithConfig({ tag = 'div', className = '', id = '', text = '', html = '', attributes = {}, events = {} }) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (id) el.id = id;
    if (text) el.textContent = text;
    if (html) el.innerHTML = html;
    Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, value));
    Object.entries(events).forEach(([event, handler]) => el.addEventListener(event, handler));
    return el;
}

function createButtonWithIcon({ className, iconClass, title, onClick }) {
    return createElementWithConfig({
        tag: 'button',
        type: 'button',
        className,
        html: `<i class="${iconClass}"></i>`,
        attributes: { title },
        events: { click: onClick }
    });
}

// Visibility Toggle Helpers
function toggleElementVisibility(element, show) {
    if (!element) return;
    if (show) {
        element.classList.remove('hidden');
    } else {
        element.classList.add('hidden');
    }
}

function toggleElementsVisibility(elements, show) {
    if (!Array.isArray(elements)) elements = [elements];
    elements.forEach(el => toggleElementVisibility(el, show));
}

function handleActionClick(event, overrideEl = null) {
    const el = overrideEl || event.currentTarget;
    if (!el) return;
    const action = el.dataset.action;
    if (!action) return;

    const pass = el.dataset.pass;
    const arg = el.dataset.arg;
    const fn = getActionHandler(action);
    if (typeof fn !== 'function') {
        console.warn('Unknown action handler:', action);
        return;
    }
    if (pass === 'event') {
        fn(event);
        return;
    }
    if (pass === 'element') {
        fn(el);
        return;
    }
    if (pass === 'value') {
        const value = 'value' in el ? el.value : undefined;
        fn(value);
        return;
    }
    if (arg !== undefined) {
        fn(arg);
        return;
    }
    fn();
}

function handleActionDelegated(event) {
    const target = event.target;
    if (!target) return;
    const el = target.closest('[data-action]');
    if (!el) return;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    handleActionClick(event, el);
}

function initClickHandlers() {
    document.addEventListener('click', handleActionDelegated);
}

function invokeDeclarativeAction(spec, el, event) {
    if (!spec) return;
    const parts = spec.split(':').map((part) => part.trim()).filter(Boolean);
    if (!parts.length) return;
    const action = parts[0];
    const pass = parts[1];
    const arg = parts[2];
    const fn = getActionHandler(action);
    if (typeof fn !== 'function') {
        console.warn('Unknown declarative handler:', action);
        return;
    }

    if (!pass) {
        fn();
        return;
    }
    if (pass === 'event') {
        if (arg !== undefined) {
            fn(event, arg);
        } else {
            fn(event);
        }
        return;
    }
    if (pass === 'element') {
        if (arg !== undefined) {
            fn(el, arg);
        } else {
            fn(el);
        }
        return;
    }
    if (pass === 'value') {
        const value = el && 'value' in el ? el.value : undefined;
        if (arg !== undefined) {
            fn(value, arg);
        } else {
            fn(value);
        }
        return;
    }

    fn(pass);
}

function initDeclarativeEventHandlers() {
    const attrByEvent = {
        input: 'data-oninput',
        change: 'data-onchange',
        keydown: 'data-onkeydown',
        focusin: 'data-onfocus',
        focusout: 'data-onblur',
    };
    Object.keys(attrByEvent).forEach((eventName) => {
        document.addEventListener(eventName, (event) => {
            const target = event.target;
            if (!target || !target.getAttribute) return;
            const attr = attrByEvent[eventName];
            const spec = target.getAttribute(attr);
            if (!spec) return;
            invokeDeclarativeAction(spec, target, event);
        });
    });
}

function getActionHandler(action) {
    return ACTION_HANDLERS[action];
}

const ACTION_HANDLERS = Object.freeze({
    stepFontSize,
    resetFontSize,
    toggleTipsDetail,
    openImportExistingCase,
    loadTestData,
    openResetConfirmation,
    toggleAdvancedMode,
    saveHeaderAndHide,
    restoreTemplate,
    editPatientData,
    editAdmissionData,
    editAdmissionOrders,
    toggleHeaderMode,
    saveAdmissionNote,
    saveAdmissionOrders,
    toggleAdmissionNoteDetails,
    toggleAdmissionPlanDetails,
    toggleHistoryLock,
    openHistoryReport,
    toggleHistory,
    openClearFormConfirmation,
    insertOrderTemplate,
    openOrderTemplateModal,
    closeOrderTemplateModal,
    clearOrderTemplateSelection,
    insertSelectedTemplates,
    openTimePicker,
    openBpModal,
    toggleDtxHi,
    setDtxType,
    openLabModal,
    openNcdModal,
    openPsychModal,
    setAssessmentStatus,
    openMedsHistoryModal,
    openMedsChangeModal,
    toggleMedsCheckFromRow,
    generateLog,
    copyToClipboard,
    shareToLine,
    closeImportModal,
    closeImportReviewModal,
    handleImportPrimaryAction,
    backToImportModal,
    applyImportFromReview,
    setReportView,
    closeReportModal,
    copyReportToClipboard,
    closeConfirmation,
    executeNewCase,
    executeClearForm,
    closeRestoreTemplateModal,
    executeRestoreTemplate,
    openMedSummaryModal,
    closeMedSummaryModal,
    recalcMedSummary,
    confirmSafetyCheck,
    cancelSafetyCheck,
    closeOnboarding,
    closeBpModal,
    addBpRow,
    saveBpReadings,
    closeLabModal,
    clearLabInputs,
    addLabsToOExtra,
    closeNcdModal,
    clearNcdInputs,
    copyNcdDate,
    pasteNcdDate,
    addNcdToOExtra,
    closePsychModal,
    clearPsychInputs,
    addPsychToOExtra,
    openMedModal,
    openMedModalForAdmit,
    closeMedModal,
    refreshTreatmentReview,
    closeCopyModal,
    closeCopyModalOverlay,
    closeAdmissionNoteViewModal,
    closeAdmissionOrdersViewModal,
    openAdmissionDataModal,
    openAdmissionOrdersModal,
    openCurrentMedicationsModal,
    openInitialPlanModal,
    openMedModalAndSwitchToAdjust,
    closePatientDataModal,
    savePatientDataFromModal,
    closeAdmissionDataModal,
    saveAdmissionDataFromModal,
    closeAdmissionOrdersModal,
    saveAdmissionOrdersFromModal,
    closeCurrentMedicationsModal,
    saveCurrentMedicationsFromModal,
    closeInitialPlanModal,
    saveInitialPlanFromModal,
    switchMedTabOrder,
    switchMedTabAdjust,
    addMedOrder,
    clearMedOrderInputs,
    addNewMedFromAdjust,
    saveMedAdjustChanges,
    applyDateSelection,
    filterMedsList,
    handleBulletKeydown,
    handleDateChange,
    seedBulletOnFocus,
    updateAdmissionSummary,
    updateBpCountBadge,
    updateHeaderFromForm,
    updateMedsStatus,
    validateTemperature,
});

// UI Component Helpers
function createModalButton({ text, onClick, variant = 'primary', className = '' }) {
    const variants = {
        primary: 'bg-green-600 hover:bg-green-700',
        secondary: 'bg-blue-600 hover:bg-blue-700',
        tertiary: 'bg-amber-500 hover:bg-amber-600',
        danger: 'bg-red-600 hover:bg-red-700',
        cancel: 'bg-gray-100 text-gray-800 hover:bg-gray-50'
    };
    
    return createElementWithConfig({
        tag: 'button',
        type: 'button',
        className: `px-5 py-3 rounded-lg font-bold ${variants[variant]} ${className}`,
        text,
        events: { click: onClick }
    });
}

function createLabInput({ id, label, placeholder }) {
    return createElementWithConfig({
        tag: 'div',
        html: `
            <label class="block text-sm text-gray-700">${label}</label>
            <input type="text" id="${id}" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*"
                class="lab-input w-full border border-gray-300 rounded-lg h-10 px-2 text-base text-center" 
                placeholder="${placeholder}" aria-label="${label}">
        `
    });
}

// Expandable Placeholder Helper
function setExpandablePlaceholder(inputId, shortPlaceholder, longPlaceholder) {
    const input = document.getElementById(inputId);
    if (!input) return;

    let isExpanded = false;

    const updatePlaceholder = () => {
        const value = input.value || '';
        if (value.length > 0) {
            input.placeholder = shortPlaceholder;
            isExpanded = false;
        } else if (isExpanded) {
            input.placeholder = longPlaceholder;
        } else {
            input.placeholder = longPlaceholder;
        }
    };

    input.addEventListener('input', updatePlaceholder);
    input.addEventListener('focus', () => {
        if (!input.value) {
            isExpanded = true;
            input.placeholder = longPlaceholder;
        }
    });
    input.addEventListener('click', () => {
        if (!input.value) {
            isExpanded = true;
            input.placeholder = longPlaceholder;
        }
    });
    input.addEventListener('blur', () => {
        isExpanded = false;
        updatePlaceholder();
    });
    updatePlaceholder();
}

function resizeTextareaToContent(textarea) {
    if (!textarea) return;
    if (textarea.offsetParent === null) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
}

function initAutoResizeTextarea(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    if (textarea.dataset.autoResize === 'true') {
        resizeTextareaToContent(textarea);
        return;
    }
    const handleResize = () => resizeTextareaToContent(textarea);
    textarea.addEventListener('input', handleResize);
    textarea.addEventListener('change', handleResize);
    textarea.dataset.autoResize = 'true';
    resizeTextareaToContent(textarea);
}

function syncAgeMirrors() {
    const real = document.getElementById('pAge');
    if (!real) return;
    document.querySelectorAll('.header-age-mirror').forEach((m) => {
        if (m.value !== real.value) m.value = real.value;
    });
}

function initAgeMirrorSync() {
    const real = document.getElementById('pAge');
    const mirrors = document.querySelectorAll('.header-age-mirror');
    if (!real || !mirrors.length) return;

    mirrors.forEach((mirror) => {
        mirror.addEventListener('input', () => {
            real.value = mirror.value;
            updateHeaderFromForm();
        });
    });
    real.addEventListener('input', syncAgeMirrors);
    syncAgeMirrors();
}

// Initialize placeholders on page load
document.addEventListener('DOMContentLoaded', () => {
    // Add expandable placeholder for inputS only
    setExpandablePlaceholder('inputS', 'อาการ...', 'อาการที่คนไข้บอกขณะนี้ หรือ Notify Ward เช่นรู้สึกตัวดี, บ่นปวดแผล');
    initAutoResizeTextarea('inputS');
    initAutoResizeTextarea('inputO_Extra');
    initAutoResizeTextarea('inputAP');
    
    // Load medication data
    loadMedicationData();
    
    // Initialize Med Order preview (new 2-tab system)
    initMedOrderPreview();

    // Initialize Med Preset search/autofill dropdown
    initMedPresetSearch();

    // Sync mobile age mirror inputs with the real pAge input
    initAgeMirrorSync();
});

function simpleHash(str) {
    if (!str) return '';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

function hashSensitiveData(data) {
    SENSITIVE_FIELDS.forEach(field => {
        if (data.values[field]) {
            data.values[field + '_hash'] = simpleHash(data.values[field]);
            data.values[field] = '[REDACTED]';
        }
    });
    return data;
}

function isContentEditableElement(el) {
    return Boolean(el && (el.isContentEditable || el.hasAttribute('contenteditable')));
}

function normalizeLineBreaks(text) {
    return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function readFormValue(el) {
    if (!el) return '';
    if (isContentEditableElement(el)) return el.innerText ?? '';
    return el.value ?? '';
}

function writeFormValue(el, value) {
    if (!el) return;
    if (isContentEditableElement(el)) {
        el.innerText = value ?? '';
        return;
    }
    el.value = value ?? '';
}

const GENERATE_LABEL_DEFAULT = 'สร้างข้อความ';
const GENERATE_LABEL_DIRTY = 'อัปเดตข้อความ';
let hasGenerated = false;
let isDirty = false;
let isRestoringForm = false;
let hasRestoredFormState = false;
let hasManualTime = false;
let medsDirty = false;
let medsStore = null;
let ordersStore = null;
let isAdvancedMode = false;

function updateGenerateButtonState() {
    const btn = document.getElementById('generateBtn');
    const label = document.getElementById('generateBtnLabel');
    if (!btn || !label) return;

    if (hasGenerated && isDirty) {
        label.textContent = GENERATE_LABEL_DIRTY;
        btn.classList.add('generate-btn-update');
    } else {
        label.textContent = GENERATE_LABEL_DEFAULT;
        btn.classList.remove('generate-btn-update');
    }
}

function markDirty() {
    if (isRestoringForm) return;
    if (!hasGenerated || isDirty) return;
    isDirty = true;
    updateGenerateButtonState();
}

function clearDirtyState() {
    isDirty = false;
    updateGenerateButtonState();
}

function initDirtyTracking() {
    const selectors = [
        '#headerFormView input',
        '#headerFormView textarea',
        '#headerTextView textarea',
        '#admitSection input',
        '#admitSection textarea',
        '#headerPart',
        '#historyPart',
        '#dailyEntrySection input',
        '#dailyEntrySection textarea',
    ];
    const tracked = document.querySelectorAll(selectors.join(','));
    tracked.forEach((el) => {
        el.addEventListener('input', markDirty);
        el.addEventListener('change', markDirty);
        el.addEventListener('input', saveFormState);
        el.addEventListener('change', saveFormState);
    });
}

function safeLocalStorageSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (err) {
        console.warn('Failed to save to localStorage:', err);
        return false;
    }
}

function safeLocalStorageGetItem(key, defaultValue = null) {
    try {
        return localStorage.getItem(key) ?? defaultValue;
    } catch (err) {
        console.warn('Failed to read from localStorage:', err);
        return defaultValue;
    }
}

function safeLocalStorageRemoveItem(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (err) {
        console.warn('Failed to remove from localStorage:', err);
        return false;
    }
}

function saveFormState() {
    if (isRestoringForm) return;
    const data = {
        values: {},
        checks: {},
        headerView: document.getElementById('headerTextView')?.classList.contains('hidden') ? 'form' : 'text',
        tipsMode: tipsModeState,
        timeIsManual: hasManualTime,
        headerHidden: Boolean(document.getElementById('headerSection')?.classList.contains('hidden')),
    };
    FORM_TEXT_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            data.values[id] = readFormValue(el);
        }
    });
    FORM_CHECK_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) data.checks[id] = Boolean(el.checked);
    });
    safeLocalStorageSetItem(FORM_STORAGE_KEY, JSON.stringify(data));
}

function loadFormState() {
    const raw = safeLocalStorageGetItem(FORM_STORAGE_KEY);
    if (!raw) return;
    let data;
    try {
        data = JSON.parse(raw);
    } catch (_) {
        return;
    }
    hasRestoredFormState = true;
    isRestoringForm = true;
    if (data?.values) {
        FORM_TEXT_IDS.forEach((id) => {
            const el = document.getElementById(id);
            if (el && Object.prototype.hasOwnProperty.call(data.values, id)) {
                writeFormValue(el, data.values[id]);
            }
        });
    }
    hasManualTime = Boolean(data?.timeIsManual);
    const savedLogDate = (data?.values?.logDate || '').trim();
    if (!savedLogDate || savedLogDate !== getTodayDisplayDate()) {
        hasManualTime = false;
    }
    if (data?.checks) {
        FORM_CHECK_IDS.forEach((id) => {
            const el = document.getElementById(id);
            if (el && Object.prototype.hasOwnProperty.call(data.checks, id)) {
                el.checked = Boolean(data.checks[id]);
            }
        });
    }
    const admitVal = data?.values?.isAdmitMode;
    if (typeof admitVal === 'string') {
        toggleAdmitMode(admitVal === 'true');
    }
    const headerView = data?.headerView;
    if (headerView === 'form' || headerView === 'text') {
        switchHeaderView(headerView, { skipParse: true });
    }
    const dtxTypeVal = data?.values?.dtxType ?? '';
    setDtxType(dtxTypeVal);
    updateAssessmentButtons(document.getElementById('assessmentStatus')?.value || '');
    updateMedsStatus();
    syncMedsEditorState();
    updateMedsChangeSummary();
    updateAdmissionSummary();
    const headerHidden = Boolean(data?.headerHidden);
    setHeaderSectionHidden(headerHidden, { persist: false });
    updateBpCountBadge();
    if (data?.tipsMode === 'new' || data?.tipsMode === 'existing') {
        setTipsMode(data.tipsMode);
    }
    initAutoResizeTextarea('inputS');
    initAutoResizeTextarea('inputO_Extra');
    initAutoResizeTextarea('inputAP');
    medsDirty = false;
    isRestoringForm = false;
}

function clearFormState() {
    safeLocalStorageRemoveItem(FORM_STORAGE_KEY);
}

function sanitizeNumericInput(input) {
    const mode = input?.dataset?.numeric;
    if (!mode) return;

    const before = input.value;
    let after = before;

    if (input.id === 'valDTX') {
        const trimmed = before.trim().toUpperCase();
        if (trimmed === 'HI') {
            after = 'HI';
            if (after !== before) input.value = after;
            setDtxHiState(true);
            return;
        }
    }

    if (mode === 'int') {
        after = before.replace(/\D+/g, '');
    } else if (mode === 'decimal1') {
        after = before.replace(/,/g, '.').replace(/[^0-9.]/g, '');
        if (after.startsWith('.')) after = '0' + after;
        const dotIndex = after.indexOf('.');
        if (dotIndex !== -1) {
            const intPart = after.slice(0, dotIndex);
            const fracPart = after.slice(dotIndex + 1).replace(/\./g, '');
            after = intPart + '.' + fracPart.slice(0, 1);
        }
    }

    if (after !== before) input.value = after;

    if (input.id === 'valDTX') {
        setDtxHiState(false);
    }

    // If DTX value is cleared, reset DTX type selection (no default)
    if (input.id === 'valDTX' && !input.value.trim()) {
        setDtxType('');
    }
}

function initNumericInputs() {
    document.querySelectorAll('input[data-numeric]').forEach((input) => {
        input.addEventListener('input', () => sanitizeNumericInput(input));
        sanitizeNumericInput(input);
    });
}

// --- Font Size Controls (Accessibility) ---
const FONT_SIZE_STORAGE_KEY = 'patientLog_fontSizePx';
const FONT_SIZE_STEPS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const DEFAULT_FONT_SIZE_PX = 16;

function updateFontSizeLabel(px) {
    const label = document.getElementById('fontSizeLabel');
    if (!label) return;
    label.textContent = String(px);
}

function applyFontSizePx(px, { persist = true, announce = true } = {}) {
    const safePx = Number.isFinite(px) ? px : DEFAULT_FONT_SIZE_PX;
    const clampedPx = Math.max(FONT_SIZE_STEPS[0], Math.min(FONT_SIZE_STEPS[FONT_SIZE_STEPS.length - 1], safePx));

    document.documentElement.style.fontSize = `${clampedPx}px`;
    updateFontSizeLabel(clampedPx);

    if (persist) safeLocalStorageSetItem(FONT_SIZE_STORAGE_KEY, String(clampedPx));
    if (announce) showToast(`ขนาดตัวอักษร: ${clampedPx}`, 'info');
}

function getClosestFontSizeIndex(px) {
    let bestIndex = 0;
    let bestDiff = Infinity;
    FONT_SIZE_STEPS.forEach((s, i) => {
        const diff = Math.abs(s - px);
        if (diff < bestDiff) { bestDiff = diff; bestIndex = i; }
    });
    return bestIndex;
}

function stepFontSize(direction) {
    const current = parseInt(getComputedStyle(document.documentElement).fontSize, 10) || DEFAULT_FONT_SIZE_PX;
    const currentIndex = getClosestFontSizeIndex(current);
    const nextIndex = Math.max(0, Math.min(FONT_SIZE_STEPS.length - 1, currentIndex + (direction < 0 ? -1 : 1)));
    applyFontSizePx(FONT_SIZE_STEPS[nextIndex], { persist: true, announce: true });
}

function resetFontSize() {
    safeLocalStorageRemoveItem(FONT_SIZE_STORAGE_KEY);
    document.documentElement.style.fontSize = `${DEFAULT_FONT_SIZE_PX}px`;
    updateFontSizeLabel(DEFAULT_FONT_SIZE_PX);
    showToast('รีเซ็ตขนาดตัวอักษรแล้ว', 'info');
}

function initFontSize() {
    const saved = parseInt(safeLocalStorageGetItem(FONT_SIZE_STORAGE_KEY, '') || '', 10);
    if (Number.isFinite(saved) && saved > 0) {
        applyFontSizePx(saved, { persist: false, announce: false });
    } else {
        document.documentElement.style.fontSize = `${DEFAULT_FONT_SIZE_PX}px`;
        updateFontSizeLabel(DEFAULT_FONT_SIZE_PX);
    }
}

function markMedsDirty() {
    medsDirty = true;
}

function getTodayShortDate() {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = (today.getFullYear() + 543).toString().slice(-2);
    return `${day}/${month}/${year}`;
}

function setMedsUpdateDate(value, { persist = true } = {}) {
    const input = document.getElementById('medsUpdateDate');
    const label = document.getElementById('medsUpdateDateLabel');
    const next = (value || '').trim();
    if (input) input.value = next;
    if (label) label.textContent = next || '-';
    syncMedsStoreFromUI();
    if (persist) saveFormState();
}

function extractMedsUpdateDateFromText(text) {
    const source = text || '';
    const medsLineMatch = source.match(/^\s*💊\s*(?:Review Treatment|ยาปัจจุบัน|ยาที่ใช้ปัจจุบัน|ยาที่ใช้ที่ใช้ปัจจุบัน).*$/m);
    if (!medsLineMatch) return '';
    const dateMatch = medsLineMatch[0].match(/\(([^)]+)\)/);
    if (!dateMatch) return '';
    let rawDate = dateMatch[1].trim();
    rawDate = rawDate.replace(/^(?:วันที่ปรับยา|ปรับยาล่าสุด)\s*/i, '').trim();
    if (!/\d/.test(rawDate)) return '';
    return rawDate;
}

function initMedsUpdateDate() {
    const input = document.getElementById('medsUpdateDate');
    if (!input) return;
    let value = (input.value || '').trim();
    let shouldPersist = false;
    if (!value) {
        const headerText = document.getElementById('headerPart')?.value || '';
        value = extractMedsUpdateDateFromText(headerText);
        if (value) {
            input.value = value;
            shouldPersist = true;
        }
    }
    setMedsUpdateDate(value, { persist: shouldPersist });
}

function getMedsContent() {
    const el = document.getElementById('pMedsCont');
    if (!el) return '';
    const searchInput = document.getElementById('medsSearchInput');
    if (searchInput && searchInput.value.trim()) {
        const storedText = medsStore?.current?.text;
        if (typeof storedText === 'string' && storedText.trim()) {
            return normalizeLineBreaks(storedText);
        }
    }
    if (isContentEditableElement(el)) {
        return normalizeLineBreaks((el.innerText || '').replace(/\u00a0/g, ' '));
    }
    return normalizeLineBreaks(el.value || '');
}

function buildMedsItems(text) {
    return parseCurrentMedsLines(text).map((line) => ({ text: line }));
}

function normalizeMedsStore(store) {
    const base = store && typeof store === 'object' ? store : {};
    const version = Number.isFinite(base.version) ? base.version : MEDS_STORE_VERSION;
    const updatedAt = typeof base.updatedAt === 'string' && base.updatedAt ? base.updatedAt : new Date().toISOString();
    const current = base.current && typeof base.current === 'object' ? base.current : {};
    const text = typeof current.text === 'string' ? current.text : '';
    const updateDate = typeof current.updateDate === 'string' ? current.updateDate : '';
    const source = typeof current.source === 'string' && current.source ? current.source : 'manual';
    const rawText = typeof current.rawText === 'string' ? current.rawText : '';
    const items = Array.isArray(current.items) && current.items.length
        ? current.items
            .map((item) => {
                if (typeof item === 'string') return { text: item };
                return { text: typeof item?.text === 'string' ? item.text : '' };
            })
            .filter((item) => item.text)
        : buildMedsItems(text);
    const history = base.history && typeof base.history === 'object' ? base.history : {};
    const changes = Array.isArray(history.changes) ? history.changes : [];
    const log = Array.isArray(history.log) ? history.log : [];

    return {
        version,
        updatedAt,
        current: { text, items, updateDate, source, rawText },
        history: { changes, log },
    };
}

function createMedsStore({ currentText = '', updateDate = '', source = 'manual', rawText = '', history } = {}) {
    const text = String(currentText || '');
    return normalizeMedsStore({
        version: MEDS_STORE_VERSION,
        updatedAt: new Date().toISOString(),
        current: {
            text,
            items: buildMedsItems(text),
            updateDate: updateDate || '',
            source: source || 'manual',
            rawText: rawText || '',
        },
        history: {
            changes: Array.isArray(history?.changes) ? history.changes : [],
            log: Array.isArray(history?.log) ? history.log : [],
        },
    });
}

function loadMedsStore() {
    const raw = safeLocalStorageGetItem(MEDS_STORE_KEY, '');
    if (!raw) return null;
    try {
        return normalizeMedsStore(JSON.parse(raw));
    } catch (_) {
        return null;
    }
}

function saveMedsStore(store) {
    if (!store) return;
    safeLocalStorageSetItem(MEDS_STORE_KEY, JSON.stringify(store));
}

function getLegacyMedsHistorySnapshot() {
    let changes = [];
    let log = [];
    const rawChanges = safeLocalStorageGetItem(MEDS_HISTORY_KEY, '[]');
    const rawLog = safeLocalStorageGetItem(MEDS_HISTORY_LOG_KEY, '[]');
    try {
        changes = JSON.parse(rawChanges) || [];
    } catch (_) {
        changes = [];
    }
    try {
        log = JSON.parse(rawLog) || [];
    } catch (_) {
        log = [];
    }
    return {
        changes: Array.isArray(changes) ? changes : [],
        log: Array.isArray(log) ? log : [],
    };
}

function persistLegacyMedsHistory(history) {
    const changes = Array.isArray(history?.changes) ? history.changes : [];
    const log = Array.isArray(history?.log) ? history.log : [];
    safeLocalStorageSetItem(MEDS_HISTORY_KEY, JSON.stringify(changes));
    safeLocalStorageSetItem(MEDS_HISTORY_LOG_KEY, JSON.stringify(log));
}

function getMedsHistoryChanges() {
    const changes = medsStore?.history?.changes;
    if (Array.isArray(changes)) return changes;
    return getLegacyMedsHistorySnapshot().changes;
}

function getMedsHistoryLogEntries() {
    const log = medsStore?.history?.log;
    if (Array.isArray(log)) return log;
    return getLegacyMedsHistorySnapshot().log;
}

function setMedsStoreHistory(nextHistory, { persistLegacy = true } = {}) {
    const changes = Array.isArray(nextHistory?.changes) ? nextHistory.changes : [];
    const log = Array.isArray(nextHistory?.log) ? nextHistory.log : [];
    const currentText = getMedsContent();
    const updateDate = document.getElementById('medsUpdateDate')?.value || '';
    if (!medsStore) {
        medsStore = createMedsStore({ currentText, updateDate, history: { changes, log } });
    } else {
        medsStore = normalizeMedsStore({
            ...medsStore,
            updatedAt: new Date().toISOString(),
            history: { changes, log },
        });
    }
    medsHistoryLog = log;
    saveMedsStore(medsStore);
    if (persistLegacy) persistLegacyMedsHistory({ changes, log });
}

function migrateLegacyMedsStore() {
    const currentText = getMedsContent();
    const updateDate = document.getElementById('medsUpdateDate')?.value || '';
    const history = getLegacyMedsHistorySnapshot();
    const store = createMedsStore({ currentText, updateDate, history });
    saveMedsStore(store);
    return store;
}

function syncMedsStoreFromUI({ source, rawText } = {}) {
    const currentText = getMedsContent();
    const updateDate = document.getElementById('medsUpdateDate')?.value || '';
    if (!medsStore) {
        medsStore = createMedsStore({
            currentText,
            updateDate,
            source,
            rawText,
            history: getLegacyMedsHistorySnapshot(),
        });
        saveMedsStore(medsStore);
        return;
    }
    const nextSource = source || medsStore.current?.source || 'manual';
    const nextRawText = rawText !== undefined ? rawText : (medsStore.current?.rawText || '');
    medsStore = normalizeMedsStore({
        ...medsStore,
        updatedAt: new Date().toISOString(),
        current: {
            ...medsStore.current,
            text: currentText || '',
            items: buildMedsItems(currentText || ''),
            updateDate: updateDate || '',
            source: nextSource,
            rawText: nextRawText,
        },
    });
    saveMedsStore(medsStore);
}

function syncMedsStoreHistoryFromLocalStorage() {
    const history = getLegacyMedsHistorySnapshot();
    setMedsStoreHistory(history, { persistLegacy: false });
}

function initMedsStore() {
    const loaded = loadMedsStore();
    medsStore = loaded || migrateLegacyMedsStore();
    if (!medsStore) return;
    syncMedsStoreHistoryFromLocalStorage();
    syncMedsStoreFromUI({ source: medsStore.current?.source, rawText: medsStore.current?.rawText });
}

function setMedsContent(value, { source, rawText } = {}) {
    const el = document.getElementById('pMedsCont');
    if (!el) return;
    if (isContentEditableElement(el)) {
        el.innerText = normalizeMedsDisplayText(value || '');
        syncMedsStoreFromUI({ source, rawText });
        return;
    }
    el.value = value || '';
    syncMedsStoreFromUI({ source, rawText });
}

function placeCaretAtEnd(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
}

function handleMedsEditorKeydown(event) {
    const editor = event.currentTarget;
    if (!editor || !editor.isContentEditable) return;
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const br = document.createElement('br');
    range.insertNode(br);
    const bullet = document.createTextNode('• ');
    range.setStartAfter(br);
    range.insertNode(bullet);
    range.setStartAfter(bullet);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
}

function seedMedsEditorOnFocus() {
    const el = document.getElementById('pMedsCont');
    if (!el || !el.isContentEditable) return;
    if (el.innerText.trim() !== '') return;
    el.textContent = '• ';
    placeCaretAtEnd(el);
}

let medsInlineResetPending = false;


function validateMedicationLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return { valid: true, warnings: [] };

    const warnings = [];

    // Check for non-medication keywords
    const nonMedKeywords = ['lab', 'cbc', 'bun', 'cr', 'x-ray', 'ct', 'mri', 'npo', 'iv fluid', 'consult', 'refer', 'admit'];
    nonMedKeywords.forEach(keyword => {
        if (trimmed.toLowerCase().includes(keyword)) {
            warnings.push(`พบคำที่ไม่ใช่ยา: "${keyword}"`);
        }
    });

    // Check basic format (should have at least drug name)
    if (trimmed.length < 3) {
        warnings.push('ชื่อยาสั้นเกินไป');
    }

    return {
        valid: warnings.length === 0,
        warnings
    };
}

function showMedicationValidationWarnings(warnings) {
    const existingWarning = document.getElementById('medsValidationWarning');
    if (existingWarning) existingWarning.remove();
}

function handleMedsEditorBlur() {
    const el = document.getElementById('pMedsCont');
    if (!el || !el.isContentEditable) return;
    const normalized = normalizeMedsDisplayText(el.innerText || '');
    if ((el.innerText || '') !== normalized) {
        el.innerText = normalized;
    }
    const cleaned = normalized.trim();
    if (!cleaned || cleaned === '•') {
        el.textContent = '';
    }
    if (medsInlineResetPending) {
        renderMedsInlineChanges([]);
        medsInlineResetPending = false;
    }
    const hasEdits = parseMedsChangedData(document.getElementById('medsChangedList')?.value || '').length > 0;
    if (hasEdits) {
        updateMedsChangedFromInline();
    }
    syncMedsStoreFromUI({ source: 'manual' });
}

function handleMedsInput() {
    document.getElementById('medsVerified').checked = false;
    const hasEdits = parseMedsChangedData(document.getElementById('medsChangedList')?.value || '').length > 0;
    
    if (hasEdits) {
        updateMedsChangedFromInline({ deferRender: true });
    } else {
        const medsChangedList = document.getElementById('medsChangedList');
        if (medsChangedList) {
            removeMedsChangesFromPlan(parseMedsChangedData(medsChangedList.value || ''));
            medsChangedList.value = '';
            medsInlineResetPending = true;
        }
    }
    
    // Real-time validation
    const el = document.getElementById('pMedsCont');
    if (el && el.isContentEditable) {
        const lines = (el.innerText || '').split('\n');
        const allWarnings = [];
        lines.forEach(line => {
            const result = validateMedicationLine(line);
            allWarnings.push(...result.warnings);
        });
        showMedicationValidationWarnings(allWarnings);
    }
    
    updateMedsStatus();
    markMedsDirty();
    updateHeaderFromForm();
    updateMedsChangeSummary();
    syncMedsStoreFromUI({ source: 'manual' });
    saveFormState();
}

const MEDS_LIST_PREFIX_REGEX = /^\s*(?:[•\u25cf\u25cb\-\*]|\d+[.)])\s*/;
const MEDS_PREFIX_TRIM_REGEX = /^[\s•\u25cf\u25cb\-\*]+/;

function stripMedsListPrefix(line) {
    return String(line || '').replace(MEDS_LIST_PREFIX_REGEX, '').trim();
}

function stripMedsPrefix(value) {
    return String(value || '').replace(MEDS_PREFIX_TRIM_REGEX, '').trim();
}

function parseCurrentMedsLines(sourceText) {
    const raw = normalizeLineBreaks(typeof sourceText === 'string' ? sourceText : getMedsContent());
    return raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => stripMedsListPrefix(line))
        .filter((line) => line && line !== '...' && !line.includes('ยังไม่มีรายการยา'));
}

function normalizeMedsDisplayText(text) {
    const lines = normalizeLineBreaks(String(text || '').replace(/\u00a0/g, ' '))
        .split('\n');
    const normalized = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        if (trimmed === '...' || trimmed.includes('ยังไม่มีรายการยา')) return trimmed;
        if (MEDS_LIST_PREFIX_REGEX.test(trimmed)) {
            const rest = trimmed.replace(MEDS_LIST_PREFIX_REGEX, '').trim();
            return rest ? `• ${rest}` : '•';
        }
        return `• ${trimmed}`;
    });
    return normalized.join('\n');
}

function parseFraction(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (raw.includes('/')) {
        const [num, den] = raw.split('/').map((part) => Number(part));
        if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
        return num / den;
    }
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
}

function normalizeOrderStrengthInput(input) {
    const raw = String(input || '').trim();
    if (!raw) return '';
    if (/^\(.*\)$/.test(raw)) return raw;
    if (/\b(mg|g|mcg|ug|iu|u|unit|units|ml)\b/i.test(raw)) {
        return raw.replace(/\s+/g, '');
    }
    return `(${raw})`;
}

function parseOrderStrength(line) {
    const cleaned = String(line || '');
    const parenMatch = cleaned.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1]) return parenMatch[1].trim();
    const strengthMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(mg|g|mcg|ug|iu|u|unit|units|ml)/i);
    if (strengthMatch) return `${strengthMatch[1]}${strengthMatch[2]}`.trim();
    return '';
}

function extractOrderRoute(text) {
    const value = String(text || '').toLowerCase();
    if (/\biv\b/.test(value)) return 'iv';
    if (/\bim\b/.test(value)) return 'im';
    if (/\bsc\b|\bs\/c\b|\bsubcut/.test(value)) return 'sc';
    if (/\bpr\b/.test(value)) return 'pr';
    if (/\binh\b|\bneb\b/.test(value)) return 'inh';
    if (/\btop\b|\btopical\b|\bcream\b/.test(value)) return 'top';
    if (/\bpo\b|\bp\.o\.\b/.test(value)) return 'po';
    if (/\bopc\b|\bo\s*pc\b|\bo\s*ac\b|\bo\s*hs\b|\bo\b/.test(value)) return 'o';
    return '';
}

function extractOrderTiming(text) {
    const value = String(text || '').toLowerCase();
    if (/\bstat\b|ทันที/.test(value)) return 'stat';
    if (/\bprn\b|เมื่อจำเป็น/.test(value)) return 'prn';
    if (/\bac\b|ก่อนอาหาร/.test(value)) return 'ac';
    if (/\bpc\b|หลังอาหาร/.test(value)) return 'pc';
    if (/\bhs\b|ก่อนนอน/.test(value)) return 'hs';
    return '';
}

function parseFrequencyFromText(text) {
    const value = String(text || '').toLowerCase();
    if (/\bqod\b/.test(value)) return 0.5;
    if (/\bbid\b/.test(value)) return 2;
    if (/\btid\b/.test(value)) return 3;
    if (/\bqid\b/.test(value)) return 4;
    if (/\bqd\b|\bod\b|\bdaily\b/.test(value)) return 1;

    const qhMatch = value.match(/\bq(\d{1,2})h\b/);
    if (qhMatch) {
        const hours = Number(qhMatch[1]);
        if (Number.isFinite(hours) && hours > 0) return Math.round((24 / hours) * 10) / 10;
    }

    const perDayMatch = value.match(/วันละ\s*(\d+)/);
    if (perDayMatch) return Number(perDayMatch[1]);

    const timesMatch = value.match(/(\d+)\s*(ครั้ง|times)\s*\/\s*วัน/);
    if (timesMatch) return Number(timesMatch[1]);

    const timeTokens = [
        { key: 'morning', re: /เช้า/ },
        { key: 'noon', re: /กลางวัน|เที่ยง/ },
        { key: 'evening', re: /เย็น/ },
        { key: 'bed', re: /ก่อนนอน|hs\b/ },
    ];
    const found = new Set();
    timeTokens.forEach((token) => {
        if (token.re.test(value)) found.add(token.key);
    });
    if (found.size > 0) return found.size;
    return null;
}

function parseOrderLine(line, { type = 'continuous', source = 'manual' } = {}) {
    const cleaned = stripMedsListPrefix(line);
    if (!cleaned) return null;
    if (cleaned === '...' || cleaned.includes('ยังไม่มีรายการยา')) return null;

    const qtyMatch = cleaned.match(/#\s*(\d+)/);
    const qty = qtyMatch ? Number(qtyMatch[1]) : null;

    const freqMatch = cleaned.match(/(\d+(?:\/\d+)?(?:\.\d+)?)\s*(?:x|×)\s*(\d+)/i);
    const doseText = freqMatch ? freqMatch[1] : '';
    const doseAmount = freqMatch ? parseFraction(freqMatch[1]) : null;
    const freqPerDay = freqMatch ? Number(freqMatch[2]) : parseFrequencyFromText(cleaned);

    const doseUnitMatch = cleaned.match(/\b(tab|tabs|tablet|cap|caps|capsule|เม็ด|แคปซูล)\b/i);
    const doseUnit = doseUnitMatch ? doseUnitMatch[1].toLowerCase() : '';

    const strength = parseOrderStrength(cleaned);
    const nameMatch = cleaned.match(/[A-Za-zก-๙][A-Za-zก-๙\.\-]*/);
    const name = nameMatch ? nameMatch[0] : '';

    const route = extractOrderRoute(cleaned);
    const timing = extractOrderTiming(cleaned);

    const isMedication = Boolean(strength || doseAmount || freqPerDay || isLikelyMedicationLine(cleaned));
    const confidence = name && (doseAmount || freqPerDay || strength || qty)
        ? 'medium'
        : (name ? 'low' : 'none');

    return {
        id: simpleHash(`${type}|${cleaned}`),
        type,
        name,
        strength,
        doseText: doseText || '',
        doseAmount,
        doseUnit,
        freqPerDay,
        route,
        timing,
        qty,
        rawLine: cleaned,
        isMedication,
        source,
        confidence,
        createdAt: new Date().toISOString(),
    };
}

function parseOrdersFromText(oneDayText, continuousText, { source = 'manual' } = {}) {
    const items = [];
    const pushLines = (text, type) => {
        const lines = normalizeLineBreaks(text || '').split('\n');
        lines.forEach((line) => {
            const item = parseOrderLine(line, { type, source });
            if (item) items.push(item);
        });
    };
    pushLines(oneDayText, 'oneDay');
    pushLines(continuousText, 'continuous');
    return items;
}

function normalizeOrdersStore(store) {
    const base = store && typeof store === 'object' ? store : {};
    const version = Number.isFinite(base.version) ? base.version : ORDERS_STORE_VERSION;
    const current = base.current && typeof base.current === 'object' ? base.current : {};
    return {
        version,
        updatedAt: base.updatedAt || new Date().toISOString(),
        current: {
            oneDayText: current.oneDayText || '',
            continuousText: current.continuousText || '',
            items: Array.isArray(current.items) ? current.items : [],
            source: current.source || 'manual',
            rawText: current.rawText || '',
        },
    };
}

function createOrdersStore({ oneDayText = '', continuousText = '', items = [], source = 'manual', rawText = '' } = {}) {
    return normalizeOrdersStore({
        version: ORDERS_STORE_VERSION,
        updatedAt: new Date().toISOString(),
        current: {
            oneDayText,
            continuousText,
            items,
            source,
            rawText,
        },
    });
}

function loadOrdersStore() {
    const raw = safeLocalStorageGetItem(ORDERS_STORE_KEY, '');
    if (!raw) return null;
    try {
        return normalizeOrdersStore(JSON.parse(raw));
    } catch (_) {
        return null;
    }
}

function saveOrdersStore(store) {
    if (!store) return;
    safeLocalStorageSetItem(ORDERS_STORE_KEY, JSON.stringify(store));
}

function syncOrdersStoreFromUI({ source = 'manual' } = {}) {
    const oneDayText = normalizeLineBreaks(document.getElementById('inputOneDay_Admit')?.value || '');
    const continuousText = normalizeLineBreaks(document.getElementById('inputCont_Admit')?.value || '');
    const rawText = [oneDayText, continuousText].filter(Boolean).join('\n');
    const items = parseOrdersFromText(oneDayText, continuousText, { source });

    if (!ordersStore) {
        ordersStore = createOrdersStore({
            oneDayText,
            continuousText,
            items,
            source,
            rawText,
        });
    } else {
        ordersStore = normalizeOrdersStore({
            ...ordersStore,
            updatedAt: new Date().toISOString(),
            current: {
                ...ordersStore.current,
                oneDayText,
                continuousText,
                items,
                source,
                rawText,
            },
        });
    }
    saveOrdersStore(ordersStore);
}

function initOrdersStore() {
    const loaded = loadOrdersStore();
    ordersStore = loaded || createOrdersStore({});
    const handleSync = () => syncOrdersStoreFromUI({ source: 'manual' });
    const oneDayEl = document.getElementById('inputOneDay_Admit');
    const contEl = document.getElementById('inputCont_Admit');
    if (oneDayEl && !oneDayEl.dataset.orderSync) {
        oneDayEl.addEventListener('input', handleSync);
        oneDayEl.addEventListener('change', handleSync);
        oneDayEl.dataset.orderSync = 'true';
    }
    if (contEl && !contEl.dataset.orderSync) {
        contEl.addEventListener('input', handleSync);
        contEl.addEventListener('change', handleSync);
        contEl.dataset.orderSync = 'true';
    }
    syncOrdersStoreFromUI({ source: ordersStore.current?.source || 'manual' });
}

// Order Builder removed — use Med Modal Tab สั่งยา instead

function appendOrderLineToTextarea(textareaId, line) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    const trimmed = String(line || '').trim();
    if (!trimmed) return;
    const normalizedLine = MEDS_LIST_PREFIX_REGEX.test(trimmed)
        ? trimmed.replace(MEDS_LIST_PREFIX_REGEX, '').trim()
        : trimmed;
    const bulletLine = `• ${normalizedLine}`;
    const current = normalizeLineBreaks(textarea.value || '');
    const separator = current && !current.endsWith('\n') ? '\n' : '';
    textarea.value = `${current}${separator}${bulletLine}`.trimEnd();
    resizeTextareaToContent(textarea);
}


let medsEditorOpen = false;

function setMedsEditorEditable(isEditable) {
    const editor = document.getElementById('pMedsCont');
    if (!editor) return;
    editor.setAttribute('contenteditable', isEditable ? 'true' : 'false');
    editor.setAttribute('aria-readonly', isEditable ? 'false' : 'true');
}

function enableMedsEditor() {
    medsEditorOpen = !medsEditorOpen;
    setMedsEditorEditable(medsEditorOpen);
    
    const editor = document.getElementById('pMedsCont');
    const btn = document.getElementById('btnEnableMedsEditor');
    
    if (medsEditorOpen) {
        if (editor) {
            editor.focus();
            if (editor.innerText.trim() === '') {
                editor.textContent = '• ';
                placeCaretAtEnd(editor);
            }
        }
        if (btn) {
            btn.classList.remove('bg-blue-50', 'text-blue-800', 'border-blue-200');
            btn.classList.add('bg-green-100', 'text-green-800', 'border-green-300');
            btn.innerHTML = '<i class="fas fa-check"></i> เสร็จสิ้น';
        }
        showToast('เปิดโหมดแก้ไขข้อความแล้ว', 'info');
    } else {
        if (btn) {
            btn.classList.remove('bg-green-100', 'text-green-800', 'border-green-300');
            btn.classList.add('bg-blue-50', 'text-blue-800', 'border-blue-200');
            btn.innerHTML = '<i class="fas fa-edit"></i> แก้ไขข้อความ';
        }
        showToast('ปิดโหมดแก้ไขข้อความแล้ว', 'info');
    }
}

function getMedsChangeBaseline() {
    return document.getElementById('medsChangeBaseline')?.value || '';
}

function setMedsChangeBaseline(value) {
    const input = document.getElementById('medsChangeBaseline');
    if (input) input.value = value || '';
}

function ensureMedsChangeBaseline({ force = false } = {}) {
    const input = document.getElementById('medsChangeBaseline');
    if (!input) return;
    if (force || !input.value.trim()) {
        input.value = getMedsContent();
    }
}

function buildMedsEditsFromBaseline() {
    const baselineLines = parseCurrentMedsLines(getMedsChangeBaseline());
    const currentLines = parseCurrentMedsLines();
    const edits = [];
    const maxLen = Math.max(baselineLines.length, currentLines.length);
    for (let i = 0; i < maxLen; i++) {
        const original = baselineLines[i] || '';
        const current = currentLines[i] || '';
        if (current && current !== original) {
            edits.push({ index: i, original, updated: current });
        }
    }
    return edits;
}

function updateMedsChangedFromInline({ deferRender = false } = {}) {
    const input = document.getElementById('medsChangedList');
    if (!input) return;
    ensureMedsChangeBaseline();
    const previousEdits = parseMedsChangedData(input.value || '');
    const edits = buildMedsEditsFromBaseline();
    setMedsChangedData(edits);
    applyMedsChangesToPlan(edits, previousEdits);
    if (!deferRender) renderMedsInlineChanges(edits);
    updateMedsChangeSummary();
}

function cancelMedsInlineChanges() {
    const checkbox = document.getElementById('medsChanged');
    const input = document.getElementById('medsChangedList');
    const baseline = getMedsChangeBaseline();

    setMedsContent(baseline);
    if (input) {
        removeMedsChangesFromPlan(parseMedsChangedData(input.value || ''));
        input.value = '';
    }
    if (checkbox) checkbox.checked = false;
    setMedsEditorEditable(false);
    renderMedsInlineChanges([]);
    updateMedsChangeSummary();
    updateHeaderFromForm();
    updateMedsStatus();
    medsDirty = false;
    markDirty();
    saveFormState();
}

function syncMedsEditorState() {
    const hasEdits = parseMedsChangedData(document.getElementById('medsChangedList')?.value || '').length > 0;
    const statusRow = document.getElementById('medsChangedStatusRow');
    
    if (hasEdits) {
        if (statusRow) statusRow.classList.remove('hidden');
        ensureMedsChangeBaseline();
        setMedsEditorEditable(true);
    } else {
        if (statusRow) statusRow.classList.add('hidden');
        setMedsEditorEditable(false);
    }
}

function normalizeMedsChangedLine(line) {
    const cleaned = stripMedsListPrefix(line);
    return cleaned.replace(/^ปรับยา:\s*/i, '').trim();
}

function parseMedsChangedData(raw) {
    const trimmed = (raw || '').trim();
    if (!trimmed) return [];
    try {
        const data = JSON.parse(trimmed);
        if (Array.isArray(data)) {
            return data
                .map((item) => ({
                    index: (item.index === null || item.index === undefined) ? null : (Number.isFinite(Number(item.index)) ? Number(item.index) : null),
                    original: item?.original ? String(item.original) : '',
                    updated: item?.updated ? String(item.updated) : '',
                }))
                .filter((item) => item.updated && item.index !== null);
        }
    } catch (_) { }

    return trimmed
        .split('\n')
        .map((line, index) => ({
            index,
            original: '',
            updated: normalizeMedsChangedLine(line),
        }))
        .filter((item) => item.updated);
}

function setMedsChangedData(edits) {
    const input = document.getElementById('medsChangedList');
    if (!input) return;
    input.value = edits && edits.length ? JSON.stringify(edits) : '';
}

function getMedsChangedLines() {
    const raw = document.getElementById('medsChangedList')?.value || '';
    const edits = parseMedsChangedData(raw);
    return edits
        .map((item) => normalizeMedsChangedLine(item.updated))
        .filter(Boolean)
        .map((line) => `- ปรับยา: ${line}`);
}

function removeMedsChangesFromPlan(edits) {
    const plan = document.getElementById('inputAP');
    if (!plan) return;
    const lines = (plan.value || '').split('\n');
    if (!lines.length) return;
    const removeSet = new Set(
        (edits || [])
            .map((item) => normalizeMedsChangedLine(item.updated))
            .filter(Boolean)
    );
    if (!removeSet.size) return;
    const filtered = lines.filter((line) => {
        const normalized = normalizeMedsChangedLine(line);
        if (!normalized) return true;
        if (!/^\s*•\s*(ปรับยา|หยุดยา|จ่ายยาเพิ่ม|เพิ่มยาใหม่):/i.test(line)) return true;
        return !removeSet.has(normalized);
    });
    plan.value = filtered.join('\n').trimEnd();
    resizeTextareaToContent(plan);
}

function formatMedEditForPlan(edit) {
    const updated = normalizeMedsChangedLine(edit.updated);
    if (!updated) return '';
    const original = normalizeMedsChangedLine(edit.original || '');

    // Detect action from suffix keywords
    const stopMatch = updated.match(/^(.+?)\s+หยุด\s*$/);
    if (stopMatch) {
        const parsed = parseMedicationLine(stopMatch[1]);
        return `• หยุดยา: ${parsed ? parsed.name : stopMatch[1].trim()}`;
    }

    const incMatch = updated.match(/^(.+?)\s+เพิ่ม\s*$/);
    const decMatch = updated.match(/^(.+?)\s+ลด\s*$/);
    if (incMatch || decMatch) {
        const baseLine = incMatch ? incMatch[1] : decMatch[1];
        const parsed = parseMedicationLine(baseLine);
        const origParsed = original ? parseMedicationLine(original) : null;
        if (parsed && origParsed) {
            const oldDose = origParsed.dosingType === 'fixed' ? `${origParsed.dose}x${origParsed.frequency}` : origParsed.dose;
            return `• ปรับยา: ${parsed.name} ${oldDose} → ${incMatch ? 'เพิ่ม' : 'ลด'}`;
        }
        return `• ปรับยา: ${updated}`;
    }

    // Free-text edit: compare original vs updated
    const parsedNew = parseMedicationLine(updated);
    const parsedOrig = original ? parseMedicationLine(original) : null;
    if (parsedNew && parsedOrig && parsedNew.name === parsedOrig.name) {
        const oldDose = parsedOrig.dosingType === 'fixed' ? `${parsedOrig.dose}x${parsedOrig.frequency}` : parsedOrig.dose;
        const newDose = parsedNew.dosingType === 'fixed' ? `${parsedNew.dose}x${parsedNew.frequency}` : parsedNew.dose;
        if (oldDose !== newDose) {
            return `• ปรับยา: ${parsedNew.name} ${oldDose} → ${newDose} ${parsedNew.route}${parsedNew.timing ? ' ' + parsedNew.timing : ''}`.trim();
        }
    }

    // Fallback
    return `• ปรับยา: ${updated}`;
}

function applyMedsChangesToPlan(edits, previousEdits) {
    const plan = document.getElementById('inputAP');
    if (!plan) return;
    
    // Remove ALL med-change lines from plan first (ปรับยา: / หยุดยา: / จ่ายยาเพิ่ม: / เพิ่มยาใหม่:)
    const baseLines = (plan.value || '')
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => line.trim() !== '')
        .filter((line) => !/^\s*•\s*(ปรับยา|หยุดยา|จ่ายยาเพิ่ม|เพิ่มยาใหม่):/i.test(line));
    
    // Add new medication changes with proper formatting
    const additions = (edits || [])
        .map((item) => formatMedEditForPlan(item))
        .filter(Boolean);
    
    const finalLines = [...baseLines, ...additions];
    plan.value = finalLines.join('\n').trimEnd();
    resizeTextareaToContent(plan);
}

function applyMedsChangesToCurrentList(edits, previousEdits) {
    const textarea = document.getElementById('pMedsCont');
    if (!textarea) return;
    const lines = (getMedsContent() || '').split('\n');
    if (!lines.length) return;

    const medLineIndices = [];
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const normalized = stripMedsListPrefix(trimmed);
        if (!normalized) return;
        if (normalized === '...' || normalized.includes('ยังไม่มีรายการยา')) return;
        medLineIndices.push(index);
    });
    if (!medLineIndices.length) return;

    const updatesByIndex = new Map(
        (edits || [])
            .map((item) => [item.index, normalizeMedsChangedLine(item.updated)])
            .filter(([, value]) => value)
    );
    const resetsByIndex = new Map(
        (previousEdits || [])
            .filter((item) => !updatesByIndex.has(item.index))
            .map((item) => [
                item.index,
                normalizeMedsChangedLine(item.original || item.updated || '')
            ])
            .filter(([, value]) => value)
    );

    const applyUpdate = (medIndex, value) => {
        const lineIndex = medLineIndices[medIndex];
        if (lineIndex === undefined) return;
        const originalLine = lines[lineIndex];
        const prefixMatch = originalLine.match(/^(\s*(?:[•\u25cf\u25cb\-\*]|\d+[.)])\s*)/);
        const prefix = prefixMatch ? prefixMatch[1] : '• ';
        lines[lineIndex] = `${prefix}${value}`;
    };

    const medCount = medLineIndices.length;
    const appendUpdates = [];

    updatesByIndex.forEach((value, medIndex) => {
        if (medIndex >= medCount) {
            appendUpdates.push({ index: medIndex, value });
        } else {
            applyUpdate(medIndex, value);
        }
    });
    resetsByIndex.forEach((value, medIndex) => {
        if (medIndex < medCount) applyUpdate(medIndex, value);
    });

    if (appendUpdates.length) {
        const trailing = [];
        while (lines.length && lines[lines.length - 1].trim() === '') {
            trailing.unshift(lines.pop());
        }
        appendUpdates
            .sort((a, b) => a.index - b.index)
            .forEach(({ value }) => lines.push(`• ${value}`));
        lines.push(...trailing);
    }

    setMedsContent(lines.join('\n'));
}

// medsChangeModal UI removed — medication adjustments now handled via medModal tab adjust

// Medication history log per drug
let medsHistoryLog = [];

function saveMedsActionToLog(medName, action, details) {
    const entry = {
        timestamp: new Date().toISOString(),
        medName,
        action,
        details,
        logDate: document.getElementById('logDate')?.value || '',
        logTime: document.getElementById('logTime')?.value || ''
    };
    const log = [...getMedsHistoryLogEntries(), entry];
    const changes = [...getMedsHistoryChanges()];
    setMedsStoreHistory({ changes, log }, { persistLegacy: true });
}

function loadMedsHistoryLog() {
    const log = getMedsHistoryLogEntries();
    medsHistoryLog = Array.isArray(log) ? log : [];
    return medsHistoryLog;
}

function getMedsActionHistory(medName) {
    loadMedsHistoryLog();
    return medsHistoryLog.filter(entry => {
        const entryKey = extractMedKey(entry.medName) || String(entry.medName || '').toLowerCase();
        const targetKey = extractMedKey(medName) || String(medName || '').toLowerCase();
        return entryKey && targetKey && entryKey === targetKey;
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function parseMedNameAndDose(medText) {
    const cleaned = stripMedsPrefix(medText);
    if (!cleaned) return { name: '', dose: '' };

    const parenMatch = cleaned.match(/\(([^)]+)\)/);
    const strengthMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(mg|g|mcg|ug|iu|u|unit|units|ml)/i);
    let dose = '';
    if (parenMatch && parenMatch[1]) {
        dose = parenMatch[1].trim();
    } else if (strengthMatch) {
        dose = `${strengthMatch[1]}${strengthMatch[2]}`;
    } else {
        const numMatch = cleaned.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s|$)/);
        if (numMatch) dose = numMatch[1];
    }

    const nameMatch = cleaned.match(/[A-Za-zก-๙][A-Za-zก-๙\.\-]*/);
    const name = nameMatch ? nameMatch[0] : (cleaned.split(/\s+/)[0] || '');

    return { name, dose };
}

function extractMedKey(medText) {
    const { name, dose } = parseMedNameAndDose(medText);
    const base = (name || '').toLowerCase().replace(/[^\wก-๙]/g, '');
    const doseKey = (dose || '').toLowerCase().replace(/[^\wก-๙]/g, '');
    if (base && doseKey) return `${base}_${doseKey}`;
    return base || doseKey;
}

function formatMedLabel(medText) {
    const cleaned = stripMedsPrefix(medText);
    if (!cleaned) return '';
    const { name, dose } = parseMedNameAndDose(cleaned);
    const displayName = name || cleaned.split(/\s+/)[0] || cleaned;
    return dose ? `${displayName} (${dose})` : displayName;
}

function isMedicationStopped(medName) {
    const history = getMedsActionHistory(medName);
    if (history.length === 0) return false;
    
    // Check if the most recent action is "stop"
    const latest = history[0];
    return latest.action === 'stop';
}

function detectActionFromText(text) {
    const value = String(text || '');
    if (/(หยุด|งด|ยกเลิก|stop|hold|discontinue|d\/?c|\boff\b)/i.test(value)) {
        return 'stop';
    }
    if (/(เพิ่ม(?:ขนาด)?|increase|\binc\b|titrate\s*up|up\-?titrate|escalate|↑)/i.test(value)) {
        return 'increase';
    }
    if (/(ลด(?:ขนาด)?|decrease|\bdec\b|titrate\s*down|down\-?titrate|taper|wean|↓)/i.test(value)) {
        return 'decrease';
    }
    return null;
}

function getActionLabel(action) {
    const labels = {
        'increase': 'เพิ่ม',
        'decrease': 'ลด',
        'stop': 'หยุด',
        'change': 'เปลี่ยน'
    };
    return labels[action] || 'แก้แล้ว';
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderMedsInlineChanges(edits) {
    const editor = document.getElementById('pMedsCont');
    if (!editor) return;

    if (document.activeElement === editor) return;

    const rawText = getMedsContent();
    const rawLines = rawText.split('\n');
    const lineToMedIndex = new Map();
    let medIndex = 0;

    rawLines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const normalized = stripMedsListPrefix(trimmed);
        if (!normalized) return;
        if (normalized === '...' || normalized.includes('ยังไม่มีรายการยา')) return;
        lineToMedIndex.set(index, medIndex);
        medIndex += 1;
    });

    const editsList = Array.isArray(edits)
        ? edits
        : parseMedsChangedData(document.getElementById('medsChangedList')?.value || '');
    const editsByIndex = new Map(
        editsList
            .map((item) => [item.index, normalizeMedsChangedLine(item.updated)])
            .filter(([, value]) => value)
    );

    if (!editsByIndex.size && !editor.querySelector('.meds-inline-changed')) {
        return;
    }

    const htmlLines = rawLines.map((line, index) => {
        if (line === '') return '';
        const currentMedIndex = lineToMedIndex.get(index);
        if (currentMedIndex === undefined || !editsByIndex.has(currentMedIndex)) {
            return escapeHtml(line);
        }
        const prefixMatch = line.match(/^(\s*(?:[•\u25cf\u25cb\-\*]|\d+[.)])\s*)/);
        const prefix = prefixMatch ? prefixMatch[1] : '';
        const rest = line.slice(prefix.length);
        if (!rest) return escapeHtml(line);
        return `${escapeHtml(prefix)}<span class="meds-inline-changed">${escapeHtml(rest)}</span>`;
    });

    editor.innerHTML = htmlLines.join('<br>');
}

function updateMedsChangeSummary() {
    const container = document.getElementById('medsChangeSummary');
    const list = document.getElementById('medsChangeSummaryList');
    const count = document.getElementById('medsChangeCount');
    if (!container || !list) return;

    const edits = parseMedsChangedData(document.getElementById('medsChangedList')?.value || '');

    list.innerHTML = '';
    if (!edits.length) {
        container.classList.add('hidden');
        if (count) count.textContent = '0 รายการ';
        return;
    }
    container.classList.remove('hidden');
    
    edits.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'flex items-start gap-2 py-1';
        
        const icon = document.createElement('span');
        const original = item.original || '';
        const updated = item.updated;
        
        if (!original) {
            // New medication added
            icon.innerHTML = '🟢';
            icon.className = 'flex-shrink-0';
            li.innerHTML += `<span class="flex-1"><strong>เพิ่ม:</strong> ${escapeHtml(updated)}</span>`;
        } else if (!updated) {
            // Medication removed
            icon.innerHTML = '🔴';
            icon.className = 'flex-shrink-0';
            li.innerHTML += `<span class="flex-1"><strong>ลบ:</strong> <span class="line-through text-gray-400">${escapeHtml(original)}</span></span>`;
        } else {
            // Medication modified
            icon.innerHTML = '🟡';
            icon.className = 'flex-shrink-0';
            li.innerHTML += `<span class="flex-1">
                <span class="line-through text-gray-400">${escapeHtml(original)}</span>
                <i class="fas fa-arrow-right mx-1 text-gray-400"></i>
                <span class="text-green-700 font-semibold">${escapeHtml(updated)}</span>
            </span>`;
        }
        
        li.prepend(icon);
        list.appendChild(li);
    });
    
    if (count) count.textContent = `${edits.length} รายการ`;
}

function toggleMedsCheckFromRow(event) {
    if (event) {
        const target = event.target;
        if (target && (target.closest('input') || target.closest('label'))) {
            return;
        }
    }
    const checkbox = document.getElementById('medsVerified');
    checkbox.checked = !checkbox.checked;
    updateMedsStatus();
    markDirty();
    saveFormState();
}

function toggleMedsChangedFromRow(e) {
    if (e) {
        const target = e.target;
        if (target && (target.closest('input') || target.closest('label'))) {
            return;
        }
    }
    const checkbox = document.getElementById('medsChanged');
    if (!checkbox) return;
    checkbox.checked = !checkbox.checked;
    handleMedsChangedToggle();
}

function handleMedsChanged(e) {
    if (e) e.stopPropagation();
    handleMedsChangedToggle();
}

let medsChangedDraft = '';
let medsChangedWasChecked = false;

function handleMedsChangedToggle() {
    const checkbox = document.getElementById('medsChanged');
    if (!checkbox) return;
    if (checkbox.checked) {
        setMedsChangeBaseline(getMedsContent());
        setMedsEditorEditable(true);
        updateMedsChangedFromInline();
        markDirty();
        saveFormState();
        return;
    }
    cancelMedsInlineChanges();
}

let medsSearchSnapshot = '';

function filterMedsList() {
    const searchInput = document.getElementById('medsSearchInput');
    const medsContainer = document.getElementById('pMedsCont');
    if (!searchInput || !medsContainer) return;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    const sourceText = normalizeLineBreaks(medsStore?.current?.text || medsSearchSnapshot || getMedsContent());
    const medsLines = sourceText.split('\n');
    
    if (!searchTerm) {
        if (medsSearchSnapshot) {
            setMedsContent(medsStore?.current?.text || medsSearchSnapshot);
            medsSearchSnapshot = '';
        }
        renderMedsInlineChanges(parseMedsChangedData(document.getElementById('medsChangedList')?.value || ''));
        return;
    }
    
    if (!medsSearchSnapshot) {
        medsSearchSnapshot = sourceText;
    }

    // Filter matching meds
    const filteredLines = medsLines.filter(line => 
        line.toLowerCase().includes(searchTerm)
    );
    
    // Display filtered lines
    medsContainer.innerHTML = filteredLines.map(line => 
        `<div class="med-line">${escapeHtml(line)}</div>`
    ).join('');
}

function openMedsHistoryModal() {
    openModal('medModal');
    switchMedTab('adjust');
}

function openMedsChangeModal() {
    openModal('medModal');
    switchMedTab('adjust');
}

// medsChangeModal removed — medication adjustments now handled via medModal tab adjust

const MEDS_HISTORY_LOG_KEY = 'patientLog_medsHistoryLog';
const MEDS_HISTORY_KEY = 'patientLog_medsHistory';
const MAX_MEDS_HISTORY_ENTRIES = 50;

function logMedsChangeToHistory(edits) {
    const history = [...getMedsChangeHistory()];
    const entry = {
        timestamp: new Date().toISOString(),
        date: getTodayShortDate(),
        time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        edits: edits,
        patientName: document.getElementById('pFName')?.value || 'Unknown'
    };
    
    history.unshift(entry);
    if (history.length > MAX_MEDS_HISTORY_ENTRIES) {
        history.pop();
    }
    
    const log = [...getMedsHistoryLogEntries()];
    setMedsStoreHistory({ changes: history, log }, { persistLegacy: true });
}

function getMedsChangeHistory() {
    const changes = getMedsHistoryChanges();
    return Array.isArray(changes) ? changes : [];
}

function showMedsHistory() {
    const history = getMedsChangeHistory();
    if (!history.length) {
        showToast('ยังไม่มีประวัติการปรับยา', 'info');
        return;
    }
    
    let message = 'ประวัติการปรับยา:\n\n';
    history.slice(0, 10).forEach((entry, index) => {
        message += `${index + 1}. ${entry.date} ${entry.time}\n`;
        message += `   ผู้ป่วย: ${entry.patientName}\n`;
        message += `   จำนวน: ${entry.edits.length} รายการ\n`;
        entry.edits.forEach(edit => {
            const action = !edit.original ? 'เพิ่ม' : (!edit.updated ? 'ลบ' : 'แก้ไข');
            message += `   - ${action}: ${edit.original || edit.updated}\n`;
        });
        message += '\n';
    });
    
    if (history.length > 10) {
        message += `...และอีก ${history.length - 10} รายการ\n`;
    }
    
    alert(message);
}

function clearMedsHistory() {
    if (confirm('ต้องการลบประวัติการปรับยาทั้งหมดหรือไม่?')) {
        setMedsStoreHistory({ changes: [], log: [] }, { persistLegacy: true });
        showToast('ลบประวัติการปรับยาแล้ว', 'info');
    }
}

function updateMedsStatus(e) {
    if (e) e.stopPropagation();
    const isChecked = document.getElementById('medsVerified').checked;
    const badge = document.getElementById('medsStatusBadge');
    const medsChanged = document.getElementById('medsChanged');
    const shouldUpdateDate = medsChanged?.checked;

    if (isChecked && medsDirty && shouldUpdateDate) {
        setMedsUpdateDate(getTodayShortDate(), { persist: true });
        medsDirty = false;
        updateHeaderFromForm();
    }

    if (isChecked) {
        badge.className = "text-sm px-3 py-1 rounded-full bg-green-100 text-green-800 font-bold border border-green-200 shadow-sm";
        badge.innerHTML = '<i class="fas fa-check-circle"></i> ตรวจสอบแล้ว';
    } else {
        badge.className = "text-sm px-3 py-1 rounded-full bg-red-100 text-red-700 font-bold border border-red-200 shadow-sm";
        badge.innerHTML = '<i class="fas fa-exclamation-circle"></i> รอการตรวจสอบ';
    }
    renderMedsInlineChanges();
}

const IMPORT_PRIMARY_LABEL_PASTE = 'วางจากคลิปบอร์ด';
const IMPORT_PRIMARY_LABEL_CONFIRM = 'ตรวจสอบก่อนนำเข้า';
let importModalInitialized = false;
let pendingImportText = '';
let pendingImportReview = null;

function openImportModal({ text = '' } = {}) {
    const input = document.getElementById('importText');
    if (input) input.value = text || '';
    updateImportPrimaryButton();

    if (!importModalInitialized && input) {
        input.addEventListener('input', updateImportPrimaryButton);
        importModalInitialized = true;
    }

    openModal('importModal', { focusSelector: '#importText' });
}

function updateImportPrimaryButton() {
    const input = document.getElementById('importText');
    const btn = document.getElementById('importPrimaryBtn');
    if (!input || !btn) return;
    const hasText = Boolean(input.value.trim());
    btn.textContent = hasText ? IMPORT_PRIMARY_LABEL_CONFIRM : IMPORT_PRIMARY_LABEL_PASTE;
}

async function tryPasteImportText({ announce = false } = {}) {
    const input = document.getElementById('importText');
    if (!input) return false;
    if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
        if (announce) showToast('ไม่สามารถอ่านคลิปบอร์ดได้ กรุณาวางข้อความด้วยตนเอง (Cmd+V หรือ Ctrl+V)', 'warning');
        return false;
    }
    try {
        const text = await navigator.clipboard.readText();
        if (text && !input.value.trim()) {
            input.value = text;
            if (announce) showToast('วางข้อความจากคลิปบอร์ดให้อัตโนมัติแล้ว', 'info');
            return true;
        }
    } catch (_) {
        if (announce) showToast('ไม่สามารถอ่านคลิปบอร์ดได้ กรุณาวางข้อความด้วยตนเอง (Cmd+V หรือ Ctrl+V)', 'warning');
    }
    return false;
}

async function handleImportPrimaryAction() {
    const input = document.getElementById('importText');
    if (!input) return;
    if (!input.value.trim()) {
        const didPaste = await tryPasteImportText({ announce: true });
        if (didPaste) updateImportPrimaryButton();
        return;
    }
    openImportReviewModal(input.value);
}

function closeImportModal() { closeModal('importModal'); }

function openImportExistingCase() {
    startExistingCase({ skipImportPrompt: true });
    openImportModal();
}

function normalizeImportText(text) {
    let result = normalizeLineBreaks(text || '');
    const fixes = [];

    // 1. Old format: separate "Indication: xxx" line → merge into "Dx: ... (xxx)"
    const indicationLineRegex = /^(\s*Dx(?:\/Indication)?:\s*.+)\n\s*Indication:\s*(.+)$/m;
    const indicationMatch = result.match(indicationLineRegex);
    if (indicationMatch) {
        const dxPart = indicationMatch[1].trimEnd();
        const indPart = indicationMatch[2].trim();
        if (indPart && indPart !== '...') {
            result = result.replace(indicationLineRegex, `${dxPart} (${indPart})`);
            fixes.push('รวม Indication เข้ากับ Dx');
        }
    }

    // 2. Old format: "วันที่รับ:" → "Admit:"
    const oldAdmitRegex = /^(\s*)วันที่รับ:\s*/m;
    if (oldAdmitRegex.test(result)) {
        result = result.replace(oldAdmitRegex, '$1Admit: ');
        fixes.push('แปลง "วันที่รับ:" → "Admit:"');
    }

    // 3. Old format: "แพ้ยา:" without "Allergy:" label → add Allergy: prefix
    const oldAllergyRegex = /^(\s*)แพ้ยา:\s*/m;
    if (oldAllergyRegex.test(result) && !/^\s*Allergy:/mi.test(result)) {
        result = result.replace(oldAllergyRegex, '$1Allergy: ');
        fixes.push('แปลง "แพ้ยา:" → "Allergy:"');
    }

    // 4. Old meds header variants: "ยาที่ใช้ปัจจุบัน" / "ยาปัจจุบัน" without 💊 → add emoji
    const oldMedsHeaderRegex = /^(\s*)(ยาที่ใช้ปัจจุบัน|ยาปัจจุบัน|ยาที่ใช้ที่ใช้ปัจจุบัน)(?!\s*\()/m;
    if (oldMedsHeaderRegex.test(result) && !/💊/.test(result)) {
        result = result.replace(oldMedsHeaderRegex, '$1💊 Review Treatment');
        fixes.push('แปลง header ยาเป็น format ใหม่');
    }

    // 5. Old separator: very long "======..." (>30 chars) → normalize to 14 chars
    result = result.replace(/^={15,}\s*$/gm, '==============');

    return { text: result, fixes };
}

function validateImportFields() {
    const fields = [
        { id: 'pFName', label: 'ชื่อผู้ป่วย' },
        { id: 'pDx', label: 'Dx' },
        { id: 'pAdmitDate', label: 'วันที่รับ' },
        { id: 'pAllergy', label: 'แพ้ยา' },
    ];
    const missing = [];
    fields.forEach(({ id, label }) => {
        const val = (document.getElementById(id)?.value || '').trim();
        if (!val || val === '...') missing.push(label);
    });

    const medsText = getMedsContent().trim();
    if (!medsText || medsText === '(ยังไม่มีรายการยา)') {
        missing.push('รายการยา');
    }

    return missing;
}

function processImport(importText) {
    const rawText = importText ?? document.getElementById('importText')?.value ?? '';
    const normalized = normalizeImportText(rawText);
    const text = normalized.text;
    if (!text.trim()) return;
    resetCaseForImport();
    handleFullTextImport(text);
    closeImportModal();
    switchHeaderView('form');
    const historyText = document.getElementById('historyPart')?.value || '';
    applyParsedMedsHistory(parseMedsChangesFromHistoryText(historyText));
    syncMedsStoreFromUI({ source: 'import', rawText: text });
    syncOrdersStoreFromUI({ source: 'import' });
    setHeaderSectionHidden(true, { scroll: true });
    document.getElementById('medsVerified').checked = false;
    updateMedsStatus();

    const missing = validateImportFields();
    const fixes = normalized.fixes;

    if (fixes.length) {
        showToast(`ปรับ format อัตโนมัติ: ${fixes.join(', ')}`, 'info');
    }

    if (missing.length) {
        setTimeout(() => {
            showToast(`⚠️ ข้อมูลอาจไม่ครบ ตรวจสอบ: ${missing.join(', ')}`, 'warning');
        }, fixes.length ? 2000 : 0);
    } else if (!fixes.length) {
        showToast("นำเข้าข้อมูลเรียบร้อย! กรุณาตรวจสอบยาอีกครั้ง", "warning");
    }

    markDirty();
    saveFormState();
}

function resetImportReviewState() {
    pendingImportText = '';
    pendingImportReview = null;
}

function openImportReviewModal(text) {
    const imported = normalizeImportText(text || '');
    const normalized = imported.text;
    if (!normalized.trim()) {
        showToast('กรุณาวางข้อความก่อน', 'warning');
        return;
    }
    if (imported.fixes.length) {
        showToast(`ปรับ format อัตโนมัติ: ${imported.fixes.join(', ')}`, 'info');
    }
    const preview = buildImportReviewData(normalized);
    pendingImportText = normalized;
    pendingImportReview = preview;
    renderImportReview(preview);
    closeImportModal();
    openModal('importReviewModal', { focusSelector: '#importReviewConfirmBtn' });
}

function closeImportReviewModal() {
    closeModal('importReviewModal');
    resetImportReviewState();
}

function backToImportModal() {
    const text = pendingImportText || '';
    closeModal('importReviewModal');
    openImportModal({ text });
}

function applyImportFromReview() {
    const text = pendingImportText || '';
    if (!text.trim()) {
        showToast('ไม่มีข้อความให้นำเข้า', 'warning');
        return;
    }
    processImport(text);
    closeImportReviewModal();
}

function formatImportEntryLabel(entry) {
    const dateValue = entry?.date || entry?.dateText || '';
    const timeValue = entry?.time || entry?.timeText || '';
    const label = [dateValue, timeValue].filter(Boolean).join(' ').trim();
    return label || 'ไม่พบวันที่/เวลา';
}

function buildImportHeaderPreview(headerText) {
    const lines = normalizeLineBreaks(headerText || '').split('\n');
    const maxLines = 10;
    const preview = lines.slice(0, maxLines).join('\n').trim();
    if (!preview) return 'ไม่พบส่วนหัวเรื่อง';
    if (lines.length > maxLines) return `${preview}\n...`;
    return preview;
}

function collectUnparsedMedChangeLines(entries) {
    const results = [];
    const seen = new Set();
    const medWordRegex = /(ยา|med|drug|rx)/i;

    entries.forEach((entry) => {
        const headerLine = entry[0] || '';
        const { dateText, timeText } = parseHistoryEntryHeader(headerLine);
        const bodyLines = entry.slice(1);
        const planLines = extractSoapSectionLines(bodyLines, 'P');
        const sourceLines = planLines.length ? planLines : bodyLines;

        sourceLines.forEach((line) => {
            const cleaned = String(line || '').replace(/^P:\s*/i, '').trim();
            if (!cleaned) return;
            if (parseMedChangeLine(cleaned)) return;
            const hasKeyword = MED_CHANGE_HINT_REGEX.test(cleaned);
            const hasMedWord = medWordRegex.test(cleaned);
            const hasSignature = isLikelyMedicationLine(cleaned);
            if (!hasKeyword && !(hasMedWord && hasSignature)) return;
            const key = `${dateText}|${timeText}|${cleaned}`;
            if (seen.has(key)) return;
            seen.add(key);
            results.push({ dateText, timeText, line: cleaned });
        });
    });

    return results;
}

function buildImportReviewData(text) {
    const parsed = parseFullTextImport(text);
    const historyText = parsed?.historyText || '';
    const entries = splitHistoryEntries(historyText);
    const parsedHistory = parseMedsChangesFromHistoryText(historyText);
    const changes = Array.isArray(parsedHistory?.changes) ? parsedHistory.changes : [];
    const changeCount = changes.reduce((total, entry) => total + (entry?.edits?.length || 0), 0);
    const unparsedLines = collectUnparsedMedChangeLines(entries);
    const headerPreview = buildImportHeaderPreview(parsed?.headerText || '');

    return {
        entryCount: entries.length,
        changes,
        changeCount,
        unparsedLines,
        headerPreview,
    };
}

function renderImportReview(preview) {
    if (!preview) return;
    const entryCountEl = document.getElementById('importReviewEntryCount');
    const changeCountEl = document.getElementById('importReviewChangeCount');
    const unparsedCountEl = document.getElementById('importReviewUnparsedCount');
    const headerPreviewEl = document.getElementById('importReviewHeaderPreview');
    const changesList = document.getElementById('importReviewChangesList');
    const changesEmpty = document.getElementById('importReviewChangesEmpty');
    const unparsedList = document.getElementById('importReviewUnparsedList');
    const unparsedEmpty = document.getElementById('importReviewUnparsedEmpty');

    if (entryCountEl) entryCountEl.textContent = String(preview.entryCount || 0);
    if (changeCountEl) changeCountEl.textContent = String(preview.changeCount || 0);
    if (unparsedCountEl) unparsedCountEl.textContent = String(preview.unparsedLines?.length || 0);
    if (headerPreviewEl) headerPreviewEl.textContent = preview.headerPreview || 'ไม่พบส่วนหัวเรื่อง';

    if (changesList) changesList.innerHTML = '';
    const changes = Array.isArray(preview.changes) ? preview.changes : [];
    if (!changes.length) {
        if (changesEmpty) changesEmpty.classList.remove('hidden');
    } else {
        if (changesEmpty) changesEmpty.classList.add('hidden');
        changes.forEach((entry) => {
            const label = formatImportEntryLabel(entry);
            const hasDate = Boolean(entry?.date || entry?.time);

            const card = document.createElement('div');
            card.className = 'p-3 bg-gray-50 rounded-lg border border-gray-200';

            const header = document.createElement('div');
            header.className = `text-sm font-bold ${hasDate ? 'text-gray-800' : 'text-amber-700'}`;
            header.textContent = label;
            card.appendChild(header);

            const list = document.createElement('ul');
            list.className = 'mt-2 list-disc list-inside text-sm text-gray-700 space-y-1';
            const edits = Array.isArray(entry?.edits) ? entry.edits : [];
            edits.forEach((edit) => {
                const line = normalizeMedsChangedLine(edit?.updated || '');
                if (!line) return;
                const item = document.createElement('li');
                item.textContent = line;
                list.appendChild(item);
            });
            if (!list.children.length) {
                const empty = document.createElement('div');
                empty.className = 'text-xs text-gray-500 mt-2';
                empty.textContent = 'ไม่พบรายการใน entry นี้';
                card.appendChild(empty);
            } else {
                card.appendChild(list);
            }

            changesList?.appendChild(card);
        });
    }

    if (unparsedList) unparsedList.innerHTML = '';
    const unparsed = Array.isArray(preview.unparsedLines) ? preview.unparsedLines : [];
    if (!unparsed.length) {
        if (unparsedEmpty) unparsedEmpty.classList.remove('hidden');
    } else {
        if (unparsedEmpty) unparsedEmpty.classList.add('hidden');
        unparsed.forEach((item) => {
            const label = formatImportEntryLabel(item);
            const hasDate = Boolean(item?.dateText || item?.timeText);

            const row = document.createElement('div');
            row.className = 'p-2 border border-amber-200 bg-amber-50 rounded-lg';

            const header = document.createElement('div');
            header.className = `text-xs font-bold ${hasDate ? 'text-amber-800' : 'text-amber-700'}`;
            header.textContent = label;

            const line = document.createElement('div');
            line.className = 'text-sm text-gray-800 mt-1 font-mono';
            line.textContent = item?.line || '';

            row.appendChild(header);
            row.appendChild(line);
            unparsedList?.appendChild(row);
        });
    }
}

function parseFullTextImport(text) {
    const normalizedText = normalizeLineBreaks(text || '');
    const markerRegex = /\n={10,}\n\(ส่วนที่ 2: บันทึกอาการรายวัน\)\n?/m;
    const match = normalizedText.match(markerRegex);

    let headerText = '';
    let historyText = '';
    if (match && typeof match.index === 'number') {
        headerText = normalizedText.slice(0, match.index).trim();
        historyText = normalizedText.slice(match.index + match[0].length).trim();
    } else {
        const separators = [...normalizedText.matchAll(/^={10,}\s*$/gm)];
        if (separators.length > 1) {
            let chosen = null;
            let fallback = null;
            for (let i = separators.length - 1; i >= 0; i--) {
                const sepMatch = separators[i];
                const sepIndex = sepMatch.index ?? -1;
                if (sepIndex === -1) continue;
                const after = normalizedText.slice(sepIndex + sepMatch[0].length).trim();
                if (!after) continue;
                if (!fallback) fallback = sepMatch;
                if (/^\s*🔻/m.test(after) || HISTORY_DATE_LINE_REGEX.test(after)) {
                    chosen = sepMatch;
                    break;
                }
            }
            const selected = chosen || fallback;
            if (selected && typeof selected.index === 'number') {
                headerText = normalizedText.slice(0, selected.index).trim();
                historyText = normalizedText.slice(selected.index + selected[0].length).trim();
            } else {
                headerText = normalizedText.trim();
            }
        } else {
            headerText = normalizedText.trim();
        }
    }

    const allergyMatch = normalizedText.match(/(?:แพ้ยา|Allergy)[\s:]*([^\n]+)/i);
    const detectedAllergy = allergyMatch && allergyMatch[1] ? allergyMatch[1].trim() : '';
    const medsDate = extractMedsUpdateDateFromText(headerText);
    const admitPlan = historyText ? extractAdmitPlanFromHistory(historyText) : '';
    const admitOrders = historyText ? extractAdmissionOrdersFromHistory(historyText) : { oneDay: '', continuous: '' };

    return {
        normalizedText,
        headerText,
        historyText,
        detectedAllergy,
        medsDate,
        admitPlan,
        admitOrders,
    };
}

function applyFullTextImport(parsed) {
    if (!parsed) return;
    const { headerText, historyText, detectedAllergy, medsDate, admitPlan, admitOrders } = parsed;

    if (detectedAllergy) {
        const allergyInput = document.getElementById('pAllergy');
        if (allergyInput && (!allergyInput.value || allergyInput.value.includes('...'))) {
            allergyInput.value = detectedAllergy;
        }
    }

    document.getElementById('headerPart').value = headerText || '';
    if (medsDate) setMedsUpdateDate(medsDate, { persist: false });
    if (historyText) document.getElementById('historyPart').value = historyText;
    const planInput = document.getElementById('inputPlanMx_Admit');
    if (planInput) planInput.value = admitPlan || '';

    const oneDayInput = document.getElementById('inputOneDay_Admit');
    const contInput = document.getElementById('inputCont_Admit');
    if (oneDayInput && admitOrders?.oneDay) oneDayInput.value = admitOrders.oneDay;
    if (contInput && admitOrders?.continuous) contInput.value = admitOrders.continuous;

    updateAdmissionSummary();
    saveData();
    switchHeaderView('text');
    checkHistoryVisibility();
    saveFormState();
    syncOrdersStoreFromUI({ source: 'import' });
}

function handleFullTextImport(text) {
    const parsed = parseFullTextImport(text);
    applyFullTextImport(parsed);
}

// Initialize hidden date picker styles on load
window.addEventListener('DOMContentLoaded', () => {
    const picker = document.getElementById('hiddenDatePicker');
    if (picker) {
        picker.style.display = 'block';
        picker.style.position = 'absolute';
        picker.style.opacity = '0';
        picker.style.height = '0';
        picker.style.width = '0';
        picker.style.bottom = '0';
        picker.style.left = '0';
    }
});

function handleDateChange(input, targetId) {
    document.getElementById('dateTargetId').value = targetId;
    document.getElementById('hiddenDatePicker').value = input.value;
    applyDateSelection();
}

function applyDateSelection() {
    const dateVal = document.getElementById('hiddenDatePicker').value;
    if (!dateVal) return;
    const targetId = document.getElementById('dateTargetId').value;
    const targetInput = document.getElementById(targetId);
    const parts = dateVal.split('-');
    const yearAD = parseInt(parts[0]);
    const month = parts[1];
    const day = parts[2];
    const yearBE = (yearAD + 543).toString().slice(-2);

    const mIndex = parseInt(month) - 1;
    targetInput.value = `${parseInt(day)} ${THAI_MONTHS_SHORT[mIndex]} ${yearBE}`;

    if (targetId === 'pAdmitDate') updateHeaderFromForm();
    if (targetId === 'logDate') {
        hasManualTime = false;
        if (isLogDateToday()) setCurrentTime({ force: true });
        updateAdmissionSummary();
    }
    markDirty();
    saveFormState();
}

function setDtxHiState(isActive) {
    const btn = document.getElementById('btnDtxHi');
    if (!btn) return;
    btn.classList.toggle('dtx-hi-active', isActive);
    btn.classList.toggle('dtx-hi-inactive', !isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
}

function toggleDtxHi() {
    const input = document.getElementById('valDTX');
    if (!input) return;
    const isHi = (input.value || '').trim().toUpperCase() === 'HI';
    input.value = isHi ? '' : 'HI';
    sanitizeNumericInput(input);
    markDirty();
    saveFormState();
}

// NEW: Function to handle DTX Type Buttons
function setDtxType(type) {
    const allowed = ['AC', 'PC', 'R'];
    const normalized = allowed.includes(type) ? type : '';
    const dtxTypeInput = document.getElementById('dtxType');
    const prevValue = dtxTypeInput?.value || '';
    if (dtxTypeInput) dtxTypeInput.value = normalized;
    const didChange = prevValue !== normalized;
    if (didChange) markDirty();
    const btnIds = { AC: 'btnDtxAC', PC: 'btnDtxPC', R: 'btnDtxR' };
    const activeClass = 'dtx-btn-active';
    const inactiveClass = 'dtx-btn-inactive';

    allowed.forEach((t) => {
        const btn = document.getElementById(btnIds[t]);
        if (!btn) return;

        // Reset State
        btn.classList.remove(activeClass, inactiveClass);

        if (t === normalized) {
            btn.classList.add(activeClass);
            btn.setAttribute('aria-pressed', 'true');
        } else {
            btn.classList.add(inactiveClass);
            btn.setAttribute('aria-pressed', 'false');
        }
    });

    // Toggle Time Input (Show ONLY for AC or PC, but mostly meaningful for PC)
    // User requested less confusion. Let's show it for PC mainly.
    // Actually, some use "AC 8hr" (Fasting). Let's show for AC and PC, but hide for Random.
    const timeContainer = document.getElementById('dtxTimeContainer');
    if (['AC', 'PC'].includes(normalized)) {
        timeContainer.classList.remove('hidden');
        // Auto focus logic? Maybe annoying on mobile.
    } else {
        timeContainer.classList.add('hidden');
        document.getElementById('valDTX_Hr').value = ''; // Clear if hidden
    }

    const dtxVal = document.getElementById('valDTX')?.value?.trim() || '';
    const dtxGroup = document.getElementById('dtxTypeButtonGroup');
    const dtxError = document.getElementById('dtxTypeError');
    if (normalized || !dtxVal) {
        if (dtxGroup) dtxGroup.classList.remove('ring-error');
        if (dtxError) dtxError.classList.add('hidden');
    }
    if (didChange) saveFormState();
}

// NEW: Function to handle Assessment (A) Buttons
function setAssessmentStatus(status) {
    const allowed = ['ดีขึ้น', 'แย่ลง', 'พอเดิม'];
    const normalized = allowed.includes(status) ? status : '';
    const input = document.getElementById('assessmentStatus');
    if (!input) return;
    const nextValue = (input.value === normalized) ? '' : normalized;
    const didChange = input.value !== nextValue;
    if (didChange) markDirty();
    input.value = nextValue;
    updateAssessmentButtons(nextValue);
    
    // Hide "watch closely" checkbox when "Better" is selected
    const watchLabel = document.getElementById('assessmentWatchLabel');
    if (watchLabel) {
        if (nextValue === 'ดีขึ้น') {
            watchLabel.classList.add('hidden');
            // Uncheck the checkbox when hiding
            const watchCheckbox = document.getElementById('assessmentWatch');
            if (watchCheckbox) watchCheckbox.checked = false;
        } else {
            watchLabel.classList.remove('hidden');
        }
    }
    
    if (didChange) saveFormState();
}

function updateAssessmentButtons(activeStatus) {
    const items = [
        { id: 'btnAssessBetter', value: 'ดีขึ้น' },
        { id: 'btnAssessWorse', value: 'แย่ลง' },
        { id: 'btnAssessSame', value: 'พอเดิม' },
    ];
    const activeClass = 'assess-btn-active';
    const inactiveClass = 'assess-btn-inactive';
    const statusClassMap = {
        'ดีขึ้น': 'assess-btn-active-better',
        'พอเดิม': 'assess-btn-active-same',
        'แย่ลง': 'assess-btn-active-worse',
    };
    const statusClasses = Object.values(statusClassMap);

    items.forEach(({ id, value }) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.remove(activeClass, inactiveClass, ...statusClasses);
        if (value === activeStatus) {
            btn.classList.add(activeClass);
            if (statusClassMap[value]) btn.classList.add(statusClassMap[value]);
            btn.setAttribute('aria-pressed', 'true');
        } else {
            btn.classList.add(inactiveClass);
            btn.setAttribute('aria-pressed', 'false');
        }
    });
}

// --- BP MULTI MEASURE (Compact via Modal) ---
function parseBpReadings(text) {
    if (!text) return [];
    const normalized = text.replace(/->|→/g, ',');
    const stripLabel = (value) => value
        .replace(/^BP\s*\d*\)?\s*/i, '')
        .replace(/^[•\-]\s*/, '')
        .trim();
    const parts = normalized
        .split(/[\n,;|]+/g)
        .map(stripLabel)
        .filter(Boolean);
    if (parts.length > 1) return parts;

    const matches = normalized.match(/\d{2,3}\s*\/\s*\d{2,3}(?:\s*\/\s*\d{2,3})?/g);
    if (matches && matches.length > 1) {
        return matches.map(match => match.replace(/\s+/g, ' ').trim());
    }
    return parts;
}

function updateBpCountBadge() {
    const badge = document.getElementById('bpCountBadge');
    const bpInput = document.getElementById('valBP');
    if (!badge || !bpInput) return;

    const values = parseBpReadings(bpInput.value);
    if (values.length > 1) {
        badge.textContent = String(values.length);
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function openBpModal() {
    const container = document.getElementById('bpListContainer');
    const bpInput = document.getElementById('valBP');
    if (!container || !bpInput) return;

    container.innerHTML = '';
    const values = parseBpReadings(bpInput.value);
    const seed = values.length ? values : [''];
    seed.forEach(v => addBpRow(v, false));

    openModal('bpModal');
}

function closeBpModal() {
    closeModal('bpModal');
}

// NEW: Update indices for BP rows
function updateBpRowIndicies() {
    const container = document.getElementById('bpListContainer');
    if (!container) return;
    const rows = container.querySelectorAll('.bp-row'); // helper class
    rows.forEach((row, index) => {
        const label = row.querySelector('.bp-label');
        if (label) {
            label.textContent = `BP ${index + 1})`;
        }
    });
}

function addBpRow(value = '', focus = true) {
    const container = document.getElementById('bpListContainer');
    if (!container) return;

    const row = createElementWithConfig({
        className: 'flex gap-2 items-center bp-row'
    });

    // Label
    const label = createElementWithConfig({
        tag: 'span',
        className: 'text-base font-bold text-indigo-700 whitespace-nowrap bp-label w-12 text-right',
        text: 'BP'
    });

    // Input
    const input = createElementWithConfig({
        tag: 'input',
        type: 'text',
        className: 'flex-1 border border-gray-300 rounded-lg px-3 py-2 h-11 text-base text-center bg-white',
        attributes: { placeholder: 'ระบุ BP' },
        events: {
            keydown: (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addBpRow('', true);
                }
            }
        }
    });
    input.value = value;

    // Remove button
    const removeBtn = createButtonWithIcon({
        className: 'w-11 h-11 rounded-lg bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200 font-bold flex-shrink-0',
        iconClass: 'fas fa-times',
        title: 'ลบค่า BP',
        onClick: () => {
            row.remove();
            if (container.children.length === 0) {
                addBpRow('', true);
            } else {
                updateBpRowIndicies();
            }
        }
    });

    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(removeBtn);
    container.appendChild(row);

    updateBpRowIndicies();

    if (focus) input.focus();
}

function saveBpReadings() {
    const container = document.getElementById('bpListContainer');
    const bpInput = document.getElementById('valBP');
    if (!container || !bpInput) return;

    const inputs = Array.from(container.querySelectorAll('input'));
    const values = inputs.map(i => (i.value || '').trim()).filter(Boolean);
    bpInput.value = values.join(', ');
    closeBpModal();
    updateBpCountBadge();
    showToast(values.length ? 'บันทึก BP แล้ว' : 'ล้างค่า BP แล้ว', values.length ? 'success' : 'info');
    markDirty();
    saveFormState();
}

function openLabModal() {
    openModal('labModal', { focusSelector: '.lab-input' });
}

function closeLabModal() {
    closeModal('labModal');
}

function clearLabInputs() {
    document.querySelectorAll('#labModal .lab-input').forEach((input) => {
        input.value = '';
    });
}

function openNcdModal() {
    openModal('ncdModal');
    setupNcdToggles();
}

function setupNcdToggles() {
    document.querySelectorAll('#ncdModal input[type="checkbox"][data-toggle]').forEach((checkbox) => {
        const toggleId = checkbox.dataset.toggle;
        const fieldsDiv = document.getElementById(toggleId);
        const parentDiv = checkbox.closest('.border');
        if (fieldsDiv && parentDiv) {
            const updateVisibility = () => {
                if (checkbox.checked) {
                    fieldsDiv.classList.remove('hidden');
                    parentDiv.classList.add('border-green-500', 'bg-green-50');
                    parentDiv.classList.remove('border-gray-200');
                } else {
                    fieldsDiv.classList.add('hidden');
                    fieldsDiv.querySelectorAll('input').forEach(input => input.value = '');
                    parentDiv.classList.remove('border-green-500', 'bg-green-50');
                    parentDiv.classList.add('border-gray-200');
                }
            };
            checkbox.addEventListener('change', updateVisibility);
            updateVisibility();
        }
    });

    // Show/hide copy buttons based on date value
    document.querySelectorAll('#ncdModal input[type="date"]').forEach((dateInput) => {
        const copyBtn = dateInput.parentElement.querySelector('button[data-action="copyNcdDate"]');
        if (copyBtn) {
            const updateCopyButton = () => {
                if (dateInput.value) {
                    copyBtn.classList.remove('hidden');
                } else {
                    copyBtn.classList.add('hidden');
                }
            };
            dateInput.addEventListener('input', updateCopyButton);
            dateInput.addEventListener('change', updateCopyButton);
            updateCopyButton();
        }
    });
}

function closeNcdModal() {
    closeModal('ncdModal');
}

function copyNcdDate(event) {
    const copyButton = event?.target?.closest('button')
        || document.activeElement?.closest('button[data-action="copyNcdDate"]');
    if (!copyButton) return;

    const sourceId = copyButton.dataset.source;
    const sourceDate = document.getElementById(sourceId)?.value || '';
    
    if (!sourceDate) {
        showToast('กรุณาเลือกวันที่ก่อนคัดลอก', 'warning');
        return;
    }

    // Remove highlight from all copy buttons
    document.querySelectorAll('#ncdModal button[data-action="copyNcdDate"]').forEach(btn => {
        btn.classList.remove('bg-green-200', 'border-2', 'border-green-500');
        btn.classList.add('bg-gray-100');
    });

    // Highlight the clicked copy button
    copyButton.classList.remove('bg-gray-100');
    copyButton.classList.add('bg-green-200', 'border-2', 'border-green-500');

    // Remove all existing paste buttons
    document.querySelectorAll('#ncdModal button[data-action="pasteNcdDate"]').forEach(btn => {
        btn.remove();
    });

    // Show paste buttons in other checked items
    const checkedCheckboxes = document.querySelectorAll('#ncdModal input[type="checkbox"]:checked');
    let pasteCount = 0;

    checkedCheckboxes.forEach((checkbox) => {
        const checkboxId = checkbox.id;
        const dateId = checkboxId + 'Date';
        if (dateId !== sourceId) {
            const dateInput = document.getElementById(dateId);
            const fieldsDiv = dateInput?.parentElement?.parentElement;
            
            // Check if the fields div is visible (not hidden)
            if (dateInput && fieldsDiv && !fieldsDiv.classList.contains('hidden') && !dateInput.value) {
                const parent = dateInput.parentElement;
                const pasteBtn = document.createElement('button');
                pasteBtn.type = 'button';
                pasteBtn.setAttribute('data-action', 'pasteNcdDate');
                pasteBtn.setAttribute('data-pass', 'event');
                pasteBtn.setAttribute('data-source', sourceId);
                pasteBtn.setAttribute('data-target', dateId);
                pasteBtn.className = 'px-2 py-1 bg-blue-100 hover:bg-blue-200 border-2 border-blue-400 rounded-lg text-xs text-blue-600';
                pasteBtn.title = 'วางวันที่';
                pasteBtn.innerHTML = '<i class="fas fa-paste"></i>';

                parent.appendChild(pasteBtn);
                pasteCount++;
            }
        }
    });

    if (pasteCount > 0) {
        showToast(`แสดงปุ่มวางวันที่ ${pasteCount} รายการ`, 'info');
    } else {
        showToast('ไม่มีรายการที่สามารถวางวันที่ได้ (มีวันที่แล้วหรือไม่ได้ check)', 'info');
        // Remove highlight if no paste buttons
        copyButton.classList.remove('bg-green-200', 'border-2', 'border-green-500');
        copyButton.classList.add('bg-gray-100');
    }
}

function pasteNcdDate(event) {
    const button = event?.target?.closest('button');
    if (!button) return;
    const sourceId = button.dataset.source;
    const targetId = button.dataset.target;
    const sourceDate = document.getElementById(sourceId)?.value || '';
    
    if (sourceDate) {
        const targetInput = document.getElementById(targetId);
        if (targetInput) {
            targetInput.value = sourceDate;
            button.remove();
            const sourceInput = document.getElementById(sourceId);
            const copyBtn = sourceInput?.parentElement?.querySelector('button[data-action="copyNcdDate"]');
            if (copyBtn) {
                copyBtn.classList.remove('bg-green-200', 'border-2', 'border-green-500');
                copyBtn.classList.add('bg-gray-100');
            }
            document.querySelectorAll('#ncdModal button[data-action="pasteNcdDate"]').forEach(b => b.remove());
            showToast('วางวันที่แล้ว', 'success');
        }
    }
}

function clearNcdInputs() {
    document.querySelectorAll('#ncdModal input[type="checkbox"]').forEach((checkbox) => {
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));
    });
    document.querySelectorAll('#ncdModal input[type="text"]').forEach((input) => {
        input.value = '';
    });
    document.querySelectorAll('#ncdModal input[type="date"]').forEach((input) => {
        input.value = '';
    });
}

function addNcdToOExtra() {
    const getChecked = (id) => document.getElementById(id)?.checked || false;
    const getDate = (id) => {
        const value = document.getElementById(id)?.value || '';
        if (!value) return '';
        const [year, month, day] = value.split('-');
        const beYear = parseInt(year) + 543;
        return `${day}/${month}/${beYear}`;
    };
    const getResult = (id) => {
        const value = document.getElementById(id)?.value?.trim() || '';
        return value;
    };
    const items = [];
    
    if (getChecked('ncdNephropathy')) {
        const date = getDate('ncdNephropathyDate');
        const result = getResult('ncdNephropathyResult');
        const parts = [];
        if (date) parts.push(date);
        if (result) parts.push(result);
        items.push(`DN${parts.length ? ` (${parts.join(', ')})` : ''}`);
    }
    if (getChecked('ncdRetinopathy')) {
        const date = getDate('ncdRetinopathyDate');
        const result = getResult('ncdRetinopathyResult');
        const parts = [];
        if (date) parts.push(date);
        if (result) parts.push(result);
        items.push(`DR${parts.length ? ` (${parts.join(', ')})` : ''}`);
    }
    if (getChecked('ncdFoot')) {
        const date = getDate('ncdFootDate');
        const result = getResult('ncdFootResult');
        const parts = [];
        if (date) parts.push(date);
        if (result) parts.push(result);
        items.push(`Foot exam${parts.length ? ` (${parts.join(', ')})` : ''}`);
    }
    if (getChecked('ncdCardiovascular')) {
        const date = getDate('ncdCardiovascularDate');
        const result = getResult('ncdCardiovascularResult');
        const parts = [];
        if (date) parts.push(date);
        if (result) parts.push(result);
        items.push(`CVD${parts.length ? ` (${parts.join(', ')})` : ''}`);
    }
    if (getChecked('ncdDental')) {
        const date = getDate('ncdDentalDate');
        const result = getResult('ncdDentalResult');
        const parts = [];
        if (date) parts.push(date);
        if (result) parts.push(result);
        items.push(`Dental${parts.length ? ` (${parts.join(', ')})` : ''}`);
    }

    if (!items.length) {
        showToast('กรุณาเลือกการคัดกรองอย่างน้อย 1 รายการ', 'warning');
        return;
    }

    const oExtra = document.getElementById('inputO_Extra');
    if (!oExtra) return;
    const current = oExtra.value.trim();
    const isEmptyBullet = current === '•';
    const base = current && !isEmptyBullet ? current : '';
    const ncdText = `• คัดกรองภาวะแทรกซ้อน DM/HT: ${items.join(', ')}`;
    oExtra.value = base ? `${base}\n${ncdText}` : ncdText;
    resizeTextareaToContent(oExtra);

    clearNcdInputs();
    closeNcdModal();
    showToast('เพิ่มผลคัดกรอง NCD ลงในข้อมูล O อื่นๆ แล้ว');
    oExtra.focus();
    markDirty();
    saveFormState();
}

function addLabsToOExtra() {
    const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
    const buildLine = (label, items) => {
        const parts = items
            .map(({ key, value }) => (value ? `${key} ${value}` : ''))
            .filter(Boolean);
        return parts.length ? `• ${label}: ${parts.join(', ')}` : '';
    };

    const lines = [];
    lines.push(buildLine('CBC', [
        { key: 'WBC', value: getVal('labCbcWbc') },
        { key: 'Hb', value: getVal('labCbcHb') },
        { key: 'Hct', value: getVal('labCbcHct') },
        { key: 'Plt', value: getVal('labCbcPlt') },
        { key: 'Neu', value: getVal('labCbcNeu') },
        { key: 'Lym', value: getVal('labCbcLym') },
    ]));
    lines.push(buildLine('Renal', [
        { key: 'BUN', value: getVal('labBun') },
        { key: 'Cr', value: getVal('labCr') },
        { key: 'Uric', value: getVal('labUric') },
        { key: 'UPCR', value: getVal('labUprc') },
    ]));
    lines.push(buildLine('Electrolytes', [
        { key: 'Na', value: getVal('labNa') },
        { key: 'K', value: getVal('labK') },
        { key: 'Cl', value: getVal('labCl') },
        { key: 'HCO3', value: getVal('labHco3') },
        { key: 'Ca', value: getVal('labCa') },
        { key: 'Mg', value: getVal('labMg') },
        { key: 'PO4', value: getVal('labPo4') },
    ]));
    lines.push(buildLine('Glucose', [
        { key: 'FBS', value: getVal('labFbs') },
        { key: 'HbA1c', value: getVal('labHba1c') },
    ]));
    lines.push(buildLine('LFT', [
        { key: 'AST', value: getVal('labAst') },
        { key: 'ALT', value: getVal('labAlt') },
        { key: 'ALP', value: getVal('labAlp') },
        { key: 'TB', value: getVal('labTb') },
        { key: 'PT', value: getVal('labPt') },
        { key: 'PTT', value: getVal('labPtt') },
        { key: 'INR', value: getVal('labInr') },
    ]));
    lines.push(buildLine('UA', [
        { key: 'Spec gr.', value: getVal('labUaSg') },
        { key: 'pH', value: getVal('labUaPh') },
        { key: 'RBC', value: getVal('labUaRbc') },
        { key: 'WBC', value: getVal('labUaWbc') },
        { key: 'Epi', value: getVal('labUaEpi') },
    ]));

    const filledLines = lines.filter(Boolean);
    if (!filledLines.length) {
        showToast('กรุณากรอกค่า Lab ก่อนกดเพิ่ม (เช่น CBC 10.5, Cr 1.2)', 'warning');
        return;
    }

    const oExtra = document.getElementById('inputO_Extra');
    if (!oExtra) return;
    const current = oExtra.value.trim();
    const isEmptyBullet = current === '•';
    const base = current && !isEmptyBullet ? current : '';
    oExtra.value = base ? `${base}\n${filledLines.join('\n')}` : filledLines.join('\n');
    resizeTextareaToContent(oExtra);

    clearLabInputs();
    closeLabModal();
    showToast('เพิ่มผล Lab ลงในข้อมูล O อื่นๆ แล้ว');
    oExtra.focus();
    markDirty();
    saveFormState();
}

function openPsychModal() {
    openModal('psychModal', { focusSelector: '.psych-input' });
}

function closePsychModal() {
    closeModal('psychModal');
}

function clearPsychInputs() {
    document.querySelectorAll('#psychModal .psych-input').forEach((input) => {
        input.value = '';
    });
}

function addPsychToOExtra() {
    const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
    const stage = document.getElementById('psychStage')?.value?.trim() || '';

    const lines = [];
    const oas = getVal('psychOas');
    if (oas) lines.push(`• OAS: ${oas}`);
    const q2 = getVal('psych2Q');
    const q9 = getVal('psych9Q');
    const q8 = getVal('psych8Q');
    const qParts = [];
    if (q2) qParts.push(`2Q = ${q2}`);
    if (q9) qParts.push(`9Q = ${q9}`);
    if (q8) qParts.push(`8Q = ${q8}`);
    if (qParts.length) lines.push(`• ${qParts.join(' | ')}`);
    const ciwa = getVal('psychCiwa');
    if (ciwa) lines.push(`• CIWA-Ar: ${ciwa}`);
    if (stage) lines.push(`• Stage of change: ${stage}`);

    if (!lines.length) {
        showToast('กรุณากรอกข้อมูลแบบประเมินจิตเวชก่อนกดเพิ่ม', 'warning');
        return;
    }

    const oExtra = document.getElementById('inputO_Extra');
    if (!oExtra) return;
    const current = oExtra.value.trim();
    const isEmptyBullet = current === '•';
    const base = current && !isEmptyBullet ? current : '';
    oExtra.value = base ? `${base}\n${lines.join('\n')}` : lines.join('\n');
    resizeTextareaToContent(oExtra);

    clearPsychInputs();
    closePsychModal();
    showToast('เพิ่มแบบประเมินจิตเวชลงในข้อมูล O อื่นๆ แล้ว');
    oExtra.focus();
    markDirty();
    saveFormState();
}

// ========== MEDICATION FUNCTIONS (Redesigned: pMedsCont = single source of truth) ==========
// Standard Format: • [name]([strength]) [dose]x[freq] [route] [timing] #[amount]
// Example: • Enalapril(5) 1x2 po pc #80
// pMedsCont holds the canonical medication list as text lines.
// medicationData is kept only for backward compatibility but NOT used as source of truth.

let medicationData = {
    medications: [],
    admitDate: null
};

// Parse medication line to extract data
function parseMedicationLine(line) {
    // Remove bullet point and normalize * to x
    line = line.replace(/^[•\-\*]\s*/, '').replace(/\*/g, 'x').trim();
    
    // Known routes — if timing slot matches a route, swap them
    const KNOWN_ROUTES = new Set(['po', 'o', 'oral', 'sc', 'iv', 'im', 'sl', 'pr', 'inh', 'top', 'ext', 'neb']);
    const swapRouteTimingIfNeeded = (r, t) => {
        const rLow = (r || '').toLowerCase();
        const tLow = (t || '').toLowerCase();
        if (!KNOWN_ROUTES.has(rLow) && KNOWN_ROUTES.has(tLow)) return { route: t, timing: r };
        return { route: r || '', timing: t || '' };
    };

    // Helper: parse fractional dose
    const parseDose = (d) => {
        if (!d) return 0;
        if (String(d).includes('/')) {
            const [num, den] = String(d).split('/').map(Number);
            return den ? num / den : 0;
        }
        return parseFloat(d) || 0;
    };

    // --- Variable dosing: [name]([strength]) [m-n-e] [route] [timing] [#amount] ---
    // With parentheses
    const varParenQty = /^(.+?)\((.+?)\)\s+([\d.\/]+)-([\d.\/]+)-([\d.\/]+)\s+(\S+)(?:\s+(\S+))?\s+#(\d+)/;
    const varParenNoQty = /^(.+?)\((.+?)\)\s+([\d.\/]+)-([\d.\/]+)-([\d.\/]+)\s+(\S+)(?:\s+(\S+))?\s*$/;
    // Without parentheses: e.g. Mixtard 30-0-22 ac sc #1
    const varNakedQty = /^([A-Za-zก-๙][A-Za-zก-๙\s.\-]*?)\s+([\d.\/]+)-([\d.\/]+)-([\d.\/]+)\s+(\S+)(?:\s+(\S+))?\s+#(\d+)/;
    const varNakedNoQty = /^([A-Za-zก-๙][A-Za-zก-๙\s.\-]*?)\s+([\d.\/]+)-([\d.\/]+)-([\d.\/]+)\s+(\S+)(?:\s+(\S+))?\s*$/;

    const varParenMatch = line.match(varParenQty) || line.match(varParenNoQty);
    const varNakedMatch = !varParenMatch ? (line.match(varNakedQty) || line.match(varNakedNoQty)) : null;
    const variableMatch = varParenMatch || varNakedMatch;

    if (variableMatch) {
        let medName, strength, morning, noon, evening, route, timing, amount;
        if (varParenMatch) {
            [, medName, strength, morning, noon, evening, route, timing, amount] = varParenMatch;
            medName = `${medName.trim()}(${strength})`;
        } else {
            // Naked format: no strength in parentheses
            if (varNakedMatch.length === 8) {
                // varNakedQty: name, m, n, e, route, timing, amount
                [, medName, morning, noon, evening, route, timing, amount] = varNakedMatch;
            } else {
                // varNakedNoQty: name, m, n, e, route, timing
                [, medName, morning, noon, evening, route, timing] = varNakedMatch;
            }
            medName = medName.trim();
            strength = '';
        }

        const morningDose = parseDose(morning);
        const noonDose = parseDose(noon);
        const eveningDose = parseDose(evening);
        const pillsPerDay = morningDose + noonDose + eveningDose;
        const rt = swapRouteTimingIfNeeded(route, timing);

        return {
            name: medName,
            strength: strength || '',
            dose: `${morning}-${noon}-${evening}`,
            dosingType: 'variable',
            morning: morningDose,
            noon: noonDose,
            evening: eveningDose,
            pillsPerDay,
            route: rt.route,
            timing: rt.timing,
            initialAmount: parseInt(amount) || 0,
            currentAmount: parseInt(amount) || 0,
            startDate: new Date().toISOString().split('T')[0],
            active: true,
            id: Date.now().toString()
        };
    }

    // --- Fixed dosing: [name]([strength]) [dose]x[freq] [route] [timing] [#amount] ---
    // With parentheses
    const fixParenQty = /^(.+?)\((.+?)\)\s+(.+?)x(\d+)\s+(\S+)(?:\s+(\S+))?\s+#(\d+)/;
    const fixParenNoQty = /^(.+?)\((.+?)\)\s+(.+?)x(\d+)\s+(\S+)(?:\s+(\S+))?\s*$/;
    // Without parentheses: e.g. Aspirin 1x1 po pc #30
    const fixNakedQty = /^([A-Za-zก-๙][A-Za-zก-๙\s.\-]*?)\s+(.+?)x(\d+)\s+(\S+)(?:\s+(\S+))?\s+#(\d+)/;
    const fixNakedNoQty = /^([A-Za-zก-๙][A-Za-zก-๙\s.\-]*?)\s+(.+?)x(\d+)\s+(\S+)(?:\s+(\S+))?\s*$/;

    const fixParenMatch = line.match(fixParenQty) || line.match(fixParenNoQty);
    const fixNakedMatch = !fixParenMatch ? (line.match(fixNakedQty) || line.match(fixNakedNoQty)) : null;
    const fixedMatch = fixParenMatch || fixNakedMatch;

    if (!fixedMatch) return null;

    let fName, fStrength, fDose, fFreq, fRoute, fTiming, fAmount;
    if (fixParenMatch) {
        [, fName, fStrength, fDose, fFreq, fRoute, fTiming, fAmount] = fixParenMatch;
        fName = `${fName.trim()}(${fStrength})`;
    } else {
        if (fixNakedMatch.length === 7) {
            [, fName, fDose, fFreq, fRoute, fTiming, fAmount] = fixNakedMatch;
        } else {
            [, fName, fDose, fFreq, fRoute, fTiming] = fixNakedMatch;
        }
        fName = fName.trim();
        fStrength = '';
    }

    let dosePerTime = parseDose(fDose) || 1;
    const frequency = parseInt(fFreq) || 1;
    const pillsPerDay = dosePerTime * frequency;
    const initialAmount = parseInt(fAmount) || 0;
    const frt = swapRouteTimingIfNeeded(fRoute, fTiming);

    return {
        name: fName,
        strength: fStrength || '',
        dose: fDose,
        dosingType: 'fixed',
        dosePerTime,
        frequency,
        pillsPerDay,
        route: frt.route,
        timing: frt.timing,
        initialAmount,
        currentAmount: initialAmount,
        startDate: new Date().toISOString().split('T')[0],
        active: true,
        id: Date.now().toString()
    };
}

// Helper: find baseline #qty for a medication by matching drug name
function findBaselineQty(medLine) {
    const parsed = parseMedicationLine(medLine);
    if (!parsed) return 0;
    const targetName = (parsed.name || '').toLowerCase().replace(/\s/g, '');

    // Look in medsChangeBaseline (original meds before any adjustments)
    const baseline = (document.getElementById('medsChangeBaseline')?.value || '').trim()
        || getMedsContent();
    const lines = baseline.split('\n').map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
        const bp = parseMedicationLine(line);
        if (!bp || !bp.initialAmount) continue;
        const bName = (bp.name || '').toLowerCase().replace(/\s/g, '');
        if (bName === targetName) return bp.initialAmount;
    }
    return 0;
}

// Calculate remaining pills for a medication
function calculateMedRemaining(medLine, { medsStartDate, refDate } = {}) {
    const parsed = parseMedicationLine(medLine);
    if (!parsed || !parsed.pillsPerDay) return null;

    // If current line has no #qty, look up from baseline (original dispensing)
    if (!parsed.initialAmount) {
        parsed.initialAmount = findBaselineQty(medLine);
        parsed.currentAmount = parsed.initialAmount;
    }
    if (!parsed.initialAmount) return null;

    const startDateRaw = medsStartDate
        || (document.getElementById('medsUpdateDate')?.value || '').trim()
        || (document.getElementById('pAdmitDate')?.value || '').trim();
    const refDateRaw = refDate || (document.getElementById('logDate')?.value || '').trim();

    const startObj = parseThaiDateInput(startDateRaw);
    const refObj = parseThaiDateInput(refDateRaw) || new Date();
    if (!startObj) return null;

    const startDay = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate());
    const refDay = new Date(refObj.getFullYear(), refObj.getMonth(), refObj.getDate());
    const daysPassed = Math.max(0, Math.floor((refDay - startDay) / 86400000));

    const used = Math.round(parsed.pillsPerDay * daysPassed * 10) / 10;
    const remaining = Math.max(0, Math.round((parsed.initialAmount - used) * 10) / 10);
    const daysLeft = parsed.pillsPerDay > 0 ? Math.floor(remaining / parsed.pillsPerDay) : 0;

    // Calculate expiry date
    const expiryDate = new Date(refDay);
    expiryDate.setDate(expiryDate.getDate() + daysLeft);

    return {
        ...parsed,
        daysPassed,
        used,
        remaining,
        daysLeft,
        expiryDate,
        startDate: startDateRaw,
    };
}

// Calculate remaining after a dose change
function calculateMedRemainingAfterChange(originalLine, newPillsPerDay) {
    const info = calculateMedRemaining(originalLine);
    if (!info) return null;

    const newDaysLeft = newPillsPerDay > 0 ? Math.floor(info.remaining / newPillsPerDay) : 0;
    return {
        ...info,
        newPillsPerDay,
        newDaysLeft,
        pillsPerDayChange: newPillsPerDay - info.pillsPerDay,
    };
}

// Format remaining info as short Thai text
function formatRemainingText(info) {
    if (!info) return '';
    const pills = Number.isInteger(info.remaining) ? info.remaining : info.remaining.toFixed(1);
    return `เหลือ ${pills} เม็ด (พอ ${info.daysLeft} วัน)`;
}

// Get all medications with remaining calculations
function getAllMedsRemaining() {
    const lines = parseCurrentMedsLines();
    return lines
        .map((line) => calculateMedRemaining(line))
        .filter(Boolean);
}

// Format Thai date from Date object
function formatThaiShortDate(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '-';
    const day = date.getDate();
    const monthShort = THAI_MONTHS_SHORT[date.getMonth()];
    const year = (date.getFullYear() + 543).toString().slice(-2);
    return `${day} ${monthShort} ${year}`;
}

// Open medication summary modal
function openMedSummaryModal() {
    openModal('medSummaryModal');
    renderMedSummaryTable();
}

function closeMedSummaryModal() {
    closeModal('medSummaryModal');
}

function recalcMedSummary() {
    renderMedSummaryTable();
}

function calcFollowUpFromInputs() {
    const d = parseInt(document.getElementById('followUpDays')?.value) || 0;
    const wk = parseInt(document.getElementById('followUpWeeks')?.value) || 0;
    const mo = parseInt(document.getElementById('followUpMonths')?.value) || 0;
    const totalDays = d + (wk * 7);

    const label = document.getElementById('medSummaryFollowUpLabel');
    const input = document.getElementById('medSummaryFollowUpDate');
    const picker = document.getElementById('followUpDatePicker');

    // Clear date picker when using d/wk/mo inputs
    if (picker) picker.value = '';

    if (d === 0 && wk === 0 && mo === 0) {
        if (input) input.value = '';
        if (label) label.textContent = '';
        renderMedSummaryTable();
        return;
    }

    const logDateRaw = (document.getElementById('logDate')?.value || '').trim();
    const baseObj = parseThaiDateInput(logDateRaw) || new Date();
    const target = new Date(baseObj.getFullYear(), baseObj.getMonth() + mo, baseObj.getDate() + totalDays);

    setFollowUpTarget(target);
}

function calcFollowUpFromDatePicker() {
    const picker = document.getElementById('followUpDatePicker');
    const raw = (picker?.value || '').trim();
    if (!raw) return;

    const target = new Date(raw + 'T00:00:00');
    if (isNaN(target.getTime())) return;

    // Calculate difference from logDate and fill d/wk/mo fields
    const logDateRaw = (document.getElementById('logDate')?.value || '').trim();
    const baseObj = parseThaiDateInput(logDateRaw) || new Date();
    const baseDay = new Date(baseObj.getFullYear(), baseObj.getMonth(), baseObj.getDate());
    const diffDays = Math.max(0, Math.round((target - baseDay) / 86400000));

    const weeks = Math.floor(diffDays / 7);
    const days = diffDays % 7;

    const dEl = document.getElementById('followUpDays');
    const wkEl = document.getElementById('followUpWeeks');
    const moEl = document.getElementById('followUpMonths');
    if (dEl) dEl.value = days || '';
    if (wkEl) wkEl.value = weeks || '';
    if (moEl) moEl.value = '';

    setFollowUpTarget(target);
}

function setFollowUpTarget(target) {
    const input = document.getElementById('medSummaryFollowUpDate');
    const label = document.getElementById('medSummaryFollowUpLabel');

    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    if (input) input.value = `${yyyy}-${mm}-${dd}`;
    if (label) label.textContent = `→ ${formatThaiShortDate(target)}`;

    renderMedSummaryTable();
}

function renderMedSummaryTable() {
    const container = document.getElementById('medSummaryTableContainer');
    const dateInfo = document.getElementById('medSummaryDateInfo');
    const warningsEl = document.getElementById('medSummaryWarnings');
    if (!container) return;

    const medsDateRaw = (document.getElementById('medsUpdateDate')?.value || '').trim();
    const admitDateRaw = (document.getElementById('pAdmitDate')?.value || '').trim();
    const dispenseDateRaw = medsDateRaw || admitDateRaw;
    const logDateRaw = (document.getElementById('logDate')?.value || '').trim();

    // Follow-up date for D/C calculation (type="date" gives YYYY-MM-DD)
    const followUpRaw = (document.getElementById('medSummaryFollowUpDate')?.value || '').trim();
    let followUpObj = null;
    if (followUpRaw) {
        // Try native date format first (YYYY-MM-DD from date picker)
        const nativeDate = new Date(followUpRaw + 'T00:00:00');
        if (!isNaN(nativeDate.getTime())) {
            followUpObj = nativeDate;
        } else {
            followUpObj = parseThaiDateInput(followUpRaw);
        }
    }
    const hasFollowUp = !!followUpObj;
    const followUpDisplay = hasFollowUp ? formatThaiShortDate(followUpObj) : '';

    if (dateInfo) {
        if (dispenseDateRaw) {
            const source = medsDateRaw ? 'ปรับยาล่าสุด' : 'วัน Admit';
            let text = `💊 จ่ายยาวันที่: ${dispenseDateRaw} (${source}) | 📅 วันปัจจุบัน: ${logDateRaw || 'วันนี้'}`;
            if (hasFollowUp) text += ` | 🗓️ วันนัด: ${followUpDisplay}`;
            dateInfo.textContent = text;
        } else {
            dateInfo.textContent = '⚠️ ยังไม่ได้ระบุวัน Admit หรือวันปรับยาล่าสุด — ไม่สามารถคำนวณยาเหลือได้';
        }
    }

    const lines = parseCurrentMedsLines();
    if (!lines.length) {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">ไม่มียาในรายการ</p>';
        return;
    }

    // Calculate follow-up day for "จ่ายเพิ่ม" column
    const refObj = parseThaiDateInput(logDateRaw) || new Date();
    const refDay = new Date(refObj.getFullYear(), refObj.getMonth(), refObj.getDate());
    let followUpDay = null;
    let daysToFollowUp = 0;
    if (hasFollowUp) {
        followUpDay = new Date(followUpObj.getFullYear(), followUpObj.getMonth(), followUpObj.getDate());
        daysToFollowUp = Math.max(0, Math.ceil((followUpDay - refDay) / 86400000));
    }

    const results = lines.map((line) => ({
        line,
        info: calculateMedRemaining(line),
        parsed: parseMedicationLine(line),
    }));

    const warnings = [];
    let earliestExpiry = null;
    let earliestMedName = '';
    let totalExtraPills = [];

    // Table header
    let tableHTML = `
        <table class="w-full text-sm border-collapse">
            <thead>
                <tr class="bg-purple-50 text-purple-900">
                    <th class="text-left px-2 py-2 border-b border-purple-200">ชื่อยา</th>
                    <th class="text-center px-2 py-2 border-b border-purple-200">เม็ด/วัน</th>
                    <th class="text-center px-2 py-2 border-b border-purple-200">เหลือ</th>
                    <th class="text-center px-2 py-2 border-b border-purple-200">พอใช้</th>
                    <th class="text-center px-2 py-2 border-b border-purple-200 font-bold">📅 ยาหมด</th>
                    ${hasFollowUp ? '<th class="text-center px-2 py-2 border-b border-purple-200 font-bold bg-green-50 text-green-800">💊 จ่ายเพิ่ม</th>' : ''}
                </tr>
            </thead>
            <tbody>`;

    const colSpan = hasFollowUp ? 6 : 5;

    results.forEach(({ line, info, parsed }) => {
        if (!parsed) {
            tableHTML += `
                <tr class="border-b border-gray-100">
                    <td class="px-2 py-2 text-gray-500" colspan="${colSpan}">${escapeHtml(line)} <span class="text-xs text-gray-400">(parse ไม่ได้)</span></td>
                </tr>`;
            return;
        }

        if (!info) {
            tableHTML += `
                <tr class="border-b border-gray-100">
                    <td class="px-2 py-2 font-medium">${escapeHtml(parsed.name)}</td>
                    <td class="text-center px-2 py-2">${parsed.pillsPerDay || '-'}</td>
                    <td class="text-center px-2 py-2">${parsed.initialAmount || '-'}</td>
                    <td class="text-center px-2 py-2 text-gray-400" colspan="${hasFollowUp ? 3 : 2}">ไม่มีข้อมูลวันที่</td>
                </tr>`;
            return;
        }

        const isLow = info.daysLeft <= 7;
        const isOut = info.remaining <= 0;
        const rowClass = isOut ? 'bg-red-50' : (isLow ? 'bg-amber-50' : '');
        const pillsDisplay = Number.isInteger(info.remaining) ? info.remaining : info.remaining.toFixed(1);
        const expiryText = formatThaiShortDate(info.expiryDate);

        if (isOut) warnings.push(`${parsed.name} — ยาหมดแล้ว ต้องนัดมารับยา`);
        else if (isLow) warnings.push(`${parsed.name} — เหลือ ${info.daysLeft} วัน (หมด ${expiryText})`);

        if (info.expiryDate && (!earliestExpiry || info.expiryDate < earliestExpiry)) {
            earliestExpiry = info.expiryDate;
            earliestMedName = parsed.name;
        }

        // Calculate extra pills needed for follow-up
        let extraCell = '';
        if (hasFollowUp && info.pillsPerDay > 0) {
            const pillsNeeded = Math.ceil(info.pillsPerDay * daysToFollowUp);
            const extraPills = Math.max(0, Math.ceil(pillsNeeded - info.remaining));
            if (extraPills > 0) {
                extraCell = `<td class="text-center px-2 py-2 font-bold text-green-700 bg-green-50">${extraPills} เม็ด</td>`;
                totalExtraPills.push({ name: parsed.name, extra: extraPills, pillsPerDay: info.pillsPerDay });
            } else {
                extraCell = `<td class="text-center px-2 py-2 text-gray-400 bg-green-50">พอ ✓</td>`;
            }
        }

        tableHTML += `
            <tr class="border-b border-gray-100 ${rowClass}">
                <td class="px-2 py-2 font-medium">${escapeHtml(parsed.name)}</td>
                <td class="text-center px-2 py-2">${parsed.pillsPerDay}</td>
                <td class="text-center px-2 py-2 ${isOut ? 'text-red-600 font-bold' : ''}">${pillsDisplay}</td>
                <td class="text-center px-2 py-2 font-bold ${isOut ? 'text-red-600' : (isLow ? 'text-amber-600' : '')}">${info.daysLeft} วัน</td>
                <td class="text-center px-2 py-2 font-bold text-sm ${isOut ? 'text-red-600' : (isLow ? 'text-amber-600' : 'text-purple-700')}">${expiryText}</td>
                ${extraCell}
            </tr>`;
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;

    // Warnings section
    if (warningsEl) {
        let html = '';

        // D/C dispensing summary (กรณี 3)
        if (hasFollowUp && totalExtraPills.length > 0) {
            html += `
                <div class="bg-green-50 border border-green-200 border-l-4 border-l-green-500 rounded-lg p-3 mb-2">
                    <p class="font-bold text-green-800 text-sm"><i class="fas fa-prescription-bottle-alt mr-1"></i>ยาที่ต้องจ่ายเพิ่มก่อน D/C (ให้พอถึงวันนัด ${followUpDisplay}, อีก ${daysToFollowUp} วัน)</p>
                    <ul class="mt-1 text-sm text-green-700 list-disc list-inside">
                        ${totalExtraPills.map(m => `<li><strong>${m.name}</strong> — จ่ายเพิ่ม <strong>${m.extra} เม็ด</strong> (ใช้วันละ ${m.pillsPerDay})</li>`).join('')}
                    </ul>
                </div>`;
        } else if (hasFollowUp && totalExtraPills.length === 0) {
            html += `
                <div class="bg-green-50 border border-green-200 border-l-4 border-l-green-500 rounded-lg p-3 mb-2">
                    <p class="font-bold text-green-800 text-sm"><i class="fas fa-check-circle mr-1"></i>ยาทุกตัวพอใช้ถึงวันนัด ${followUpDisplay} ✓</p>
                </div>`;
        }

        // Appointment suggestion (ถ้าไม่ได้ใส่วันนัด)
        if (!hasFollowUp && earliestExpiry) {
            const suggestDate = new Date(earliestExpiry);
            suggestDate.setDate(suggestDate.getDate() - 3);
            const suggestText = formatThaiShortDate(suggestDate);
            const expiryDateText = formatThaiShortDate(earliestExpiry);
            html += `
                <div class="bg-purple-50 border border-purple-200 border-l-4 border-l-purple-500 rounded-lg p-3 mb-2">
                    <p class="font-bold text-purple-800 text-sm"><i class="fas fa-calendar-check mr-1"></i>แนะนำวันนัด</p>
                    <p class="text-sm text-purple-700 mt-1">ยาที่หมดเร็วสุด: <strong>${earliestMedName}</strong> (หมด ${expiryDateText})</p>
                    <p class="text-sm text-purple-700">ควรนัดมารับยาก่อน: <strong class="text-purple-900">${suggestText}</strong></p>
                </div>`;
        }

        if (warnings.length) {
            html += `
                <div class="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-lg p-3">
                    <p class="font-bold text-amber-800 text-sm"><i class="fas fa-exclamation-triangle mr-1"></i>ยาใกล้หมด / หมดแล้ว</p>
                    <ul class="mt-1 text-sm text-amber-700 list-disc list-inside">
                        ${warnings.map(w => `<li>${w}</li>`).join('')}
                    </ul>
                </div>`;
        }

        if (html) {
            warningsEl.classList.remove('hidden');
            warningsEl.innerHTML = html;
        } else {
            warningsEl.classList.add('hidden');
            warningsEl.innerHTML = '';
        }
    }
}

// Generate standard format line from medication data
function generateMedicationLine(med) {
    const timing = med.timing ? ` ${med.timing}` : '';
    if (med.dosingType === 'variable') {
        return `• ${med.name} ${med.dose} ${med.route}${timing} #${med.currentAmount}`;
    }
    return `• ${med.name} ${med.dose}x${med.frequency} ${med.route}${timing} #${med.currentAmount}`;
}

function openMedModal() {
    openModal('medModal', { focusSelector: '#medOrderName' });
    refreshMedOrderList();
    switchMedTab('order');
}

function openMedModalForAdmit(target) {
    openMedModal();
    const targetEl = document.getElementById('medOrderTarget');
    if (targetEl && target) targetEl.value = target;
}

function openMedModalAndSwitchToAdjust() {
    openModal('medModal');
    switchMedTab('adjust');
}

function closeMedModal() {
    closeModal('medModal');
}

// ===== NEW 2-Tab Medication System =====
// ── Med Presets (autofill) ──
const MED_PRESETS = [
    // DM — oral
    { name: 'Metformin', strength: '500', route: 'po', timing: 'pc', group: 'DM' },
    { name: 'Glipizide', strength: '5', route: 'po', timing: 'ac', group: 'DM' },
    { name: 'Pioglitazone', strength: '15', route: 'po', timing: 'pc', group: 'DM' },
    { name: 'Sitagliptin', strength: '100', route: 'po', timing: 'pc', group: 'DM' },
    { name: 'Empagliflozin', strength: '10', route: 'po', timing: 'pc', group: 'DM' },
    { name: 'Dapagliflozin', strength: '10', route: 'po', timing: 'pc', group: 'DM' },
    // DM — insulin
    { name: 'Mixtard', strength: '', route: 'sc', timing: 'ac', group: 'Insulin' },
    { name: 'Novomix', strength: '', route: 'sc', timing: 'ac', group: 'Insulin' },
    { name: 'NPH', strength: '', route: 'sc', timing: 'hs', group: 'Insulin' },
    { name: 'RI', strength: '', route: 'sc', timing: 'ac', group: 'Insulin' },
    // HT
    { name: 'Amlodipine', strength: '10', route: 'po', timing: 'pc', group: 'HT' },
    { name: 'Enalapril', strength: '5', route: 'po', timing: 'pc', group: 'HT' },
    { name: 'Losartan', strength: '50', route: 'po', timing: 'pc', group: 'HT' },
    { name: 'Lercanidipine', strength: '20', route: 'po', timing: 'pc', group: 'HT' },
    { name: 'Carvedilol', strength: '12.5', route: 'po', timing: 'pc', group: 'HT' },
    { name: 'HCTZ', strength: '25', route: 'po', timing: 'pc', group: 'HT' },
    { name: 'Hydralazine', strength: '25', route: 'po', timing: 'pc', group: 'HT' },
    { name: 'Atenolol', strength: '50', route: 'po', timing: 'pc', group: 'HT' },
    { name: 'Atenolol', strength: '100', route: 'po', timing: 'pc', group: 'HT' },
    { name: 'Propranolol', strength: '10', route: 'po', timing: 'pc', group: 'HT' },
    { name: 'Propranolol', strength: '40', route: 'po', timing: 'pc', group: 'HT' },
    { name: 'Spironolactone', strength: '25', route: 'po', timing: 'pc', group: 'HT' },
    // Lipid
    { name: 'Simvastatin', strength: '20', route: 'po', timing: 'hs', group: 'Lipid' },
    { name: 'Atorvastatin', strength: '40', route: 'po', timing: 'hs', group: 'Lipid' },
    { name: 'Fenofibrate', strength: '160', route: 'po', timing: 'pc', group: 'Lipid' },
    // Antiplatelet / Anticoagulant
    { name: 'Aspirin', strength: '81', route: 'po', timing: 'pc', group: 'Other' },
    { name: 'Warfarin', strength: '3', route: 'po', timing: 'hs', group: 'Other' },
    { name: 'Warfarin', strength: '5', route: 'po', timing: 'hs', group: 'Other' },
    // Gout
    { name: 'Allopurinol', strength: '100', route: 'po', timing: 'pc', group: 'Other' },
    { name: 'Colchicine', strength: '0.6', route: 'po', timing: 'pc', group: 'Other' },
    // Psych
    { name: 'Risperidone', strength: '2', route: 'po', timing: 'hs', group: 'Psych' },
    { name: 'Haloperidol', strength: '5', route: 'po', timing: 'hs', group: 'Psych' },
    { name: 'Quetiapine', strength: '25', route: 'po', timing: 'hs', group: 'Psych' },
    { name: 'Diazepam', strength: '2', route: 'po', timing: 'hs', group: 'Psych' },
    { name: 'Lorazepam', strength: '0.5', route: 'po', timing: 'hs', group: 'Psych' },
    { name: 'Sertraline', strength: '50', route: 'po', timing: 'pc', group: 'Psych' },
    { name: 'Fluoxetine', strength: '20', route: 'po', timing: 'pc', group: 'Psych' },
    { name: 'Amitriptyline', strength: '10', route: 'po', timing: 'hs', group: 'Psych' },
    // GI
    { name: 'Omeprazole', strength: '20', route: 'po', timing: 'ac', group: 'GI' },
    { name: 'Domperidone', strength: '10', route: 'po', timing: 'ac', group: 'GI' },
    // Pain
    { name: 'Paracetamol', strength: '500', route: 'po', timing: 'prn', group: 'Pain' },
    { name: 'Tramadol', strength: '50', route: 'po', timing: 'prn', group: 'Pain' },
    // Supplement
    { name: 'CaCO3', strength: '1000', route: 'po', timing: 'pc', group: 'Supplement' },
    { name: 'Ferrous fumarate', strength: '200', route: 'po', timing: 'pc', group: 'Supplement' },
    { name: 'Folic acid', strength: '5', route: 'po', timing: 'pc', group: 'Supplement' },
    { name: 'Vitamin B complex', strength: '', route: 'po', timing: 'pc', group: 'Supplement' },
];

function buildMedPresetLabel(p) {
    const s = p.strength ? ` (${p.strength})` : '';
    return `${p.name}${s} ${p.route} ${p.timing}`.trim();
}

function applyMedPreset(preset) {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    setVal('medOrderName', preset.name);
    setVal('medOrderStrength', preset.strength || '');
    setVal('medOrderRoute', preset.route);
    setVal('medOrderTiming', preset.timing);
    updateMedOrderPreview();
    document.getElementById('medOrderDoseFreq')?.focus();
}

function initMedPresetSearch() {
    const nameInput = document.getElementById('medOrderName');
    if (!nameInput) return;

    let dropdown = document.getElementById('medPresetDropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'medPresetDropdown';
        dropdown.className = 'med-preset-dropdown hidden';
        nameInput.parentElement.style.position = 'relative';
        nameInput.parentElement.appendChild(dropdown);
    }

    const showDropdown = (query) => {
        const q = (query || '').trim().toLowerCase();
        let matches = MED_PRESETS;
        if (q) {
            matches = MED_PRESETS.filter(p => {
                const label = `${p.name} ${p.strength} ${p.group}`.toLowerCase();
                return q.split(/\s+/).every(tok => label.includes(tok));
            });
        }
        if (!matches.length) { dropdown.classList.add('hidden'); return; }

        let currentGroup = '';
        dropdown.innerHTML = '';
        matches.forEach((preset, idx) => {
            if (preset.group !== currentGroup) {
                currentGroup = preset.group;
                const groupEl = document.createElement('div');
                groupEl.className = 'med-preset-group';
                groupEl.textContent = currentGroup;
                dropdown.appendChild(groupEl);
            }
            const item = document.createElement('div');
            item.className = 'med-preset-item';
            item.textContent = buildMedPresetLabel(preset);
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                applyMedPreset(preset);
                dropdown.classList.add('hidden');
            });
            dropdown.appendChild(item);
        });
        dropdown.classList.remove('hidden');
    };

    nameInput.addEventListener('focus', () => showDropdown(nameInput.value));
    nameInput.addEventListener('input', () => showDropdown(nameInput.value));
    nameInput.addEventListener('blur', () => {
        setTimeout(() => dropdown.classList.add('hidden'), 150);
    });

    nameInput.addEventListener('keydown', (e) => {
        if (dropdown.classList.contains('hidden')) return;
        const items = dropdown.querySelectorAll('.med-preset-item');
        const active = dropdown.querySelector('.med-preset-item.active');
        let idx = Array.from(items).indexOf(active);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (active) active.classList.remove('active');
            idx = (idx + 1) % items.length;
            items[idx].classList.add('active');
            items[idx].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (active) active.classList.remove('active');
            idx = idx <= 0 ? items.length - 1 : idx - 1;
            items[idx].classList.add('active');
            items[idx].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            if (active) {
                e.preventDefault();
                active.click();
            }
        } else if (e.key === 'Escape') {
            dropdown.classList.add('hidden');
        }
    });
}

// Tab 1: สั่งยา — builds a line and appends to pMedsCont (or orders textarea)
// Tab 2: ปรับยา — reads pMedsCont, allows edit/stop/add, writes back

function switchMedTabOrder() { switchMedTab('order'); }
function switchMedTabAdjust() { switchMedTab('adjust'); }

function switchMedTab(mode) {
    const orderTab = document.getElementById('medTabOrder');
    const adjustTab = document.getElementById('medTabAdjust');
    const orderContent = document.getElementById('medOrderContent');
    const adjustContent = document.getElementById('medAdjustContent');

    // Reset
    [orderTab, adjustTab].forEach(t => {
        if (!t) return;
        t.classList.remove('border-green-600', 'border-amber-600', 'text-green-600', 'text-amber-600');
        t.classList.add('border-transparent', 'text-gray-500');
    });
    [orderContent, adjustContent].forEach(c => { if (c) c.classList.add('hidden'); });

    if (mode === 'order') {
        if (orderTab) { orderTab.classList.add('border-green-600', 'text-green-600'); orderTab.classList.remove('border-transparent', 'text-gray-500'); }
        if (orderContent) orderContent.classList.remove('hidden');
        refreshMedOrderList();
    } else if (mode === 'adjust') {
        if (adjustTab) { adjustTab.classList.add('border-amber-600', 'text-amber-600'); adjustTab.classList.remove('border-transparent', 'text-gray-500'); }
        if (adjustContent) adjustContent.classList.remove('hidden');
        loadMedAdjustList();
    }
}

// --- Tab 1: สั่งยา ---
function updateMedOrderPreview() {
    const name = document.getElementById('medOrderName')?.value.trim() || '';
    const strength = document.getElementById('medOrderStrength')?.value.trim() || '';
    const doseFreq = (document.getElementById('medOrderDoseFreq')?.value.trim() || '').replace(/\*/g, 'x');
    const route = document.getElementById('medOrderRoute')?.value.trim() || 'po';
    const timing = document.getElementById('medOrderTiming')?.value.trim() || '';
    const qty = document.getElementById('medOrderQty')?.value || '';

    const strengthPart = strength ? ` (${strength})` : '';
    const timingPart = timing ? ` ${timing}` : '';
    const qtyPart = qty ? ` #${qty}` : '';

    const preview = name
        ? `• ${name}${strengthPart} ${doseFreq} ${route}${timingPart}${qtyPart}`
        : '• [ชื่อยา] ([ขนาด]) [dose]x[freq] [route] [timing] #[จำนวน]';

    const el = document.getElementById('medOrderPreview');
    if (el) el.textContent = preview;
}

function initMedOrderPreview() {
    const fields = ['medOrderName', 'medOrderStrength', 'medOrderDoseFreq', 'medOrderRoute', 'medOrderTiming', 'medOrderQty'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateMedOrderPreview);
            el.addEventListener('change', updateMedOrderPreview);
        }
    });
    // Refresh list when target changes
    const targetEl = document.getElementById('medOrderTarget');
    if (targetEl) {
        targetEl.addEventListener('change', refreshMedOrderList);
    }
}

function addMedOrder() {
    const name = document.getElementById('medOrderName')?.value.trim();
    if (!name) { showToast('กรุณากรอกชื่อยา', 'warning'); return; }

    const strength = document.getElementById('medOrderStrength')?.value.trim() || '';
    const doseFreq = (document.getElementById('medOrderDoseFreq')?.value.trim() || '').replace(/\*/g, 'x');
    const route = document.getElementById('medOrderRoute')?.value.trim() || 'po';
    const timing = document.getElementById('medOrderTiming')?.value.trim() || '';
    const qty = document.getElementById('medOrderQty')?.value || '';
    const target = document.getElementById('medOrderTarget')?.value || 'pMedsCont';

    const strengthPart = strength ? ` (${strength})` : '';
    const timingPart = timing ? ` ${timing}` : '';
    const qtyPart = qty ? ` #${qty}` : '';
    const line = `• ${name}${strengthPart} ${doseFreq} ${route}${timingPart}${qtyPart}`.replace(/\s+/g, ' ').trim();

    if (target === 'pMedsCont') {
        appendLineToPMedsCont(line);
    } else {
        appendOrderLineToTextarea(target, line);
        syncOrdersStoreFromUI({ source: 'builder' });
    }

    clearMedOrderInputs();
    refreshMedOrderList();
    const targetLabels = { pMedsCont: 'รายการยาปัจจุบัน', inputCont_Admit: 'Continuous Orders', inputOneDay_Admit: 'One-day Orders' };
    showToast(`เพิ่มยาลง ${targetLabels[target] || target} แล้ว`, 'success');
    document.getElementById('medOrderName')?.focus();
}

function clearMedOrderInputs() {
    ['medOrderName', 'medOrderStrength', 'medOrderDoseFreq', 'medOrderTiming', 'medOrderQty'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const routeEl = document.getElementById('medOrderRoute');
    if (routeEl) routeEl.value = 'po';
    const dd = document.getElementById('medPresetDropdown');
    if (dd) dd.classList.add('hidden');
    updateMedOrderPreview();
}

function refreshMedOrderList() {
    const listEl = document.getElementById('medOrderList');
    if (!listEl) return;
    const target = document.getElementById('medOrderTarget')?.value || 'pMedsCont';
    let lines = [];
    let label = 'รายการยาปัจจุบัน';

    if (target === 'pMedsCont') {
        lines = getMedsLines();
        label = 'รายการยาปัจจุบัน';
    } else {
        const textarea = document.getElementById(target);
        if (textarea) {
            lines = textarea.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        }
        label = target === 'inputCont_Admit' ? 'Continuous Orders' : 'One-day Orders';
    }

    const headerEl = listEl.closest('.mt-4')?.querySelector('h4');
    if (headerEl) {
        headerEl.innerHTML = `<i class="fas fa-list text-purple-600 mr-1"></i>${label}`;
    }

    if (lines.length === 0) {
        listEl.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">ยังไม่มียา</p>';
        return;
    }
    listEl.innerHTML = lines.map((l, i) => `<div class="flex items-center justify-between gap-2 py-0.5">
        <span class="text-sm font-mono text-gray-800 flex-1 min-w-0 truncate">${escapeHtml(l)}</span>
        <button type="button" data-remove-med="${i}" data-remove-target="${escapeHtml(target)}"
            class="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors text-xs"
            title="ลบยานี้">
            <i class="fas fa-times"></i>
        </button>
    </div>`).join('');

    listEl.querySelectorAll('[data-remove-med]').forEach(btn => {
        btn.addEventListener('click', () => handleRemoveMedClick(btn));
    });
}

function handleRemoveMedClick(btn) {
    if (btn.dataset.confirmRemove === 'true') {
        const index = Number(btn.dataset.removeMed);
        const target = btn.dataset.removeTarget;
        removeMedOrderLine(index, target);
        return;
    }
    btn.dataset.confirmRemove = 'true';
    btn.classList.remove('text-gray-400', 'hover:text-red-600', 'hover:bg-red-50');
    btn.classList.add('text-white', 'bg-red-500', 'hover:bg-red-600');
    btn.innerHTML = '<span class="text-[10px] font-bold whitespace-nowrap">ลบ?</span>';
    btn.style.width = 'auto';
    btn.style.padding = '0 6px';
    setTimeout(() => {
        if (btn.isConnected && btn.dataset.confirmRemove === 'true') {
            btn.dataset.confirmRemove = '';
            btn.classList.add('text-gray-400', 'hover:text-red-600', 'hover:bg-red-50');
            btn.classList.remove('text-white', 'bg-red-500', 'hover:bg-red-600');
            btn.innerHTML = '<i class="fas fa-times"></i>';
            btn.style.width = '1.5rem';
            btn.style.padding = '';
        }
    }, 3000);
}

function removeMedOrderLine(index, target) {
    if (target === 'pMedsCont') {
        const lines = getMedsLines();
        if (index >= 0 && index < lines.length) {
            const removed = lines.splice(index, 1)[0];
            setMedsLines(lines);
            showToast(`ลบยาแล้ว: ${stripMedsListPrefix(removed)}`, 'info');
        }
    } else {
        const textarea = document.getElementById(target);
        if (textarea) {
            const lines = textarea.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (index >= 0 && index < lines.length) {
                const removed = lines.splice(index, 1)[0];
                textarea.value = lines.join('\n');
                resizeTextareaToContent(textarea);
                syncOrdersStoreFromUI({ source: 'builder' });
                showToast(`ลบยาแล้ว: ${stripMedsListPrefix(removed)}`, 'info');
            }
        }
    }
    refreshMedOrderList();
}

// --- Tab 2: ปรับยา (operates directly on pMedsCont) ---

// Helper: get medication lines from pMedsCont
function getMedsLines() {
    const text = getMedsContent();
    return text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
}

// Helper: set medication lines back to pMedsCont
function setMedsLines(lines) {
    setMedsContent(lines.join('\n'), { source: 'adjust' });
    markDirty();
    saveFormState();
}

// Helper: append a single line to pMedsCont
function appendLineToPMedsCont(line) {
    const lines = getMedsLines();
    lines.push(line);
    setMedsLines(lines);
}

function loadMedAdjustList() {
    const listEl = document.getElementById('medAdjustList');
    if (!listEl) return;

    const medLines = getMedsLines();

    if (medLines.length === 0) {
        listEl.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">ไม่มียาในรายการ</p>';
        return;
    }

    listEl.innerHTML = medLines.map((med, index) => {
        const parsed = parseMedicationLine(med);
        const name = parsed ? parsed.name : stripMedsListPrefix(med);
        const currentDose = parsed ? (parsed.dosingType === 'variable' ? parsed.dose : `${parsed.dose || ''}x${parsed.frequency || ''}`) : '';
        const route = parsed ? parsed.route : '';
        const timing = parsed ? parsed.timing : '';
        const qty = parsed ? parsed.initialAmount : '';
        const escaped = escapeHtml(med);

        return `
        <div class="p-2 bg-white rounded border border-gray-200" data-med-index="${index}" data-med-original="${escaped}">
            <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-bold text-gray-800 truncate flex-1">${escapeHtml(name)}</span>
                <span class="text-xs text-gray-500 font-mono">${escapeHtml(currentDose)} ${escapeHtml(route)} ${escapeHtml(timing)} ${qty ? '#' + qty : ''}</span>
            </div>
            <div class="flex items-center gap-2 mt-1.5">
                <select data-med-adjust-select="${index}" class="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white font-bold">
                    <option value="">— เลือก —</option>
                    <option value="changeDose">เปลี่ยน dose</option>
                    <option value="stop">หยุดยา</option>
                    <option value="refill">จ่ายยาใหม่</option>
                </select>
                <div id="medAdjustInput_${index}" class="flex-1 flex items-center gap-1 hidden"></div>
                <button type="button" id="medAdjustConfirm_${index}" data-med-adjust-confirm="${index}" class="hidden px-2 py-1 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold whitespace-nowrap">
                    <i class="fas fa-check mr-1"></i>ยืนยัน
                </button>
            </div>
        </div>`;
    }).join('');

    listEl.querySelectorAll('[data-med-adjust-select]').forEach((sel) => {
        sel.addEventListener('change', () => {
            onMedAdjustAction(Number(sel.dataset.medAdjustSelect), sel);
        });
    });
    listEl.querySelectorAll('[data-med-adjust-confirm]').forEach((btn) => {
        btn.addEventListener('click', () => {
            confirmMedAdjust(Number(btn.dataset.medAdjustConfirm));
        });
    });
}

function onMedAdjustAction(index, selectEl) {
    const action = selectEl.value;
    const inputContainer = document.getElementById(`medAdjustInput_${index}`);
    const confirmBtn = document.getElementById(`medAdjustConfirm_${index}`);
    if (!inputContainer || !confirmBtn) return;

    inputContainer.innerHTML = '';
    inputContainer.classList.add('hidden');
    confirmBtn.classList.add('hidden');

    if (!action) return;

    inputContainer.classList.remove('hidden');
    confirmBtn.classList.remove('hidden');

    if (action === 'changeDose') {
        inputContainer.innerHTML = `
            <label class="text-xs text-gray-600">dose ใหม่:</label>
            <input type="text" id="medAdjNewDose_${index}" placeholder="เช่น 1x1 หรือ 1-0-1"
                class="w-24 border border-amber-300 rounded px-2 py-1 text-xs text-center font-mono">
        `;
        inputContainer.querySelector('input')?.focus();
    } else if (action === 'stop') {
        inputContainer.innerHTML = `<span class="text-xs text-red-600 font-bold"><i class="fas fa-stop-circle mr-1"></i>หยุดยานี้</span>`;
    } else if (action === 'refill') {
        inputContainer.innerHTML = `
            <label class="text-xs text-gray-600">จ่ายเพิ่ม:</label>
            <input type="number" id="medAdjNewQty_${index}" placeholder="#" min="1"
                class="w-16 border border-green-300 rounded px-2 py-1 text-xs text-center font-mono">
            <span class="text-xs text-gray-500">เม็ด</span>
        `;
        inputContainer.querySelector('input')?.focus();
    }
}

function confirmMedAdjust(index) {
    const row = document.querySelector(`[data-med-index="${index}"]`);
    if (!row) return;
    const original = row.dataset.medOriginal;
    const parsed = parseMedicationLine(original);
    if (!parsed) { showToast('ไม่สามารถ parse ยานี้ได้', 'warning'); return; }

    const selectEl = row.querySelector('select');
    const action = selectEl?.value;
    if (!action) return;

    const lines = getMedsLines();
    let newLine = '';
    let historyText = '';

    if (action === 'changeDose') {
        const newDose = document.getElementById(`medAdjNewDose_${index}`)?.value.trim();
        if (!newDose) { showToast('กรุณากรอก dose ใหม่', 'warning'); return; }
        // Build new line WITHOUT # (dose change = no new dispensing)
        const timing = parsed.timing ? ` ${parsed.timing}` : '';
        newLine = `• ${parsed.name} ${newDose} ${parsed.route}${timing}`;
        const oldDose = parsed.dosingType === 'fixed' ? `${parsed.dose}x${parsed.frequency}` : parsed.dose;
        historyText = `ปรับยา: ${parsed.name} ${oldDose} → ${newDose} ${parsed.route}${timing}`.trim();
    } else if (action === 'stop') {
        // Remove line from list
        lines.splice(index, 1);
        setMedsLines(lines);
        historyText = `หยุดยา: ${parsed.name}`;
        addToMedAdjustHistory(historyText);
        // Show remaining badge info
        const info = calculateMedRemaining(original);
        if (info) {
            const pills = Number.isInteger(info.remaining) ? info.remaining : info.remaining.toFixed(1);
            showToast(`หยุดยา ${parsed.name} — ยาเหลือ ${pills} เม็ด`, 'info');
        }
        loadMedAdjustList();
        return;
    } else if (action === 'refill') {
        const newQty = document.getElementById(`medAdjNewQty_${index}`)?.value.trim();
        if (!newQty || parseInt(newQty) <= 0) { showToast('กรุณากรอกจำนวนเม็ด', 'warning'); return; }
        // Build new line WITH # (actual dispensing)
        const doseStr = parsed.dosingType === 'variable'
            ? parsed.dose
            : `${parsed.dose || '1'}x${parsed.frequency || '1'}`;
        const timing = parsed.timing ? ` ${parsed.timing}` : '';
        newLine = `• ${parsed.name} ${doseStr} ${parsed.route}${timing} #${newQty}`;
        const doseDisplay = parsed.dosingType === 'variable' ? parsed.dose : `${parsed.dose}x${parsed.frequency}`;
        historyText = `จ่ายยาเพิ่ม: ${parsed.name} ${doseDisplay} ${parsed.route}${timing} #${newQty}`;
        // Update medsUpdateDate to today
        setMedsUpdateDate(getTodayShortDate(), { persist: true });
    }

    if (newLine) {
        lines[index] = newLine;
        setMedsLines(lines);
        addToMedAdjustHistory(historyText);
        showToast(historyText, 'success');
        loadMedAdjustList();
    }
}

// editMedFromAdjust and stopMedFromAdjust removed — replaced by confirmMedAdjust() with dropdown UI

function addNewMedFromAdjust() {
    const input = document.getElementById('medAdjustNewMed');
    let newMed = input?.value.trim();
    if (!newMed) {
        showToast('กรุณากรอกชื่อยา', 'warning');
        return;
    }
    // Auto-add bullet if missing
    if (!newMed.startsWith('•') && !newMed.startsWith('-') && !newMed.startsWith('*')) {
        newMed = '• ' + newMed;
    }
    appendLineToPMedsCont(newMed);
    const newParsed = parseMedicationLine(newMed);
    const addName = newParsed ? newParsed.name : stripMedsListPrefix(newMed);
    addToMedAdjustHistory(`เพิ่มยาใหม่: ${addName}`);
    input.value = '';
    loadMedAdjustList();
    showToast('เพิ่มยาใหม่แล้ว', 'success');
}

function addToMedAdjustHistory(change) {
    const historyEl = document.getElementById('medAdjustHistory');
    if (!historyEl) return;

    const existingPlaceholder = historyEl.querySelector('p');
    if (existingPlaceholder) historyEl.innerHTML = '';

    const changeEl = document.createElement('div');
    changeEl.className = 'change-item p-2 bg-amber-100 rounded border border-amber-300 text-sm';
    changeEl.innerHTML = `
        <i class="fas fa-arrow-right text-amber-600 mr-1"></i>${escapeHtml(change)}
        <button type="button" class="float-right text-red-600 hover:text-red-800" aria-label="ลบรายการ">
            <i class="fas fa-times"></i>
        </button>
    `;
    changeEl.querySelector('button').addEventListener('click', () => changeEl.remove());
    historyEl.appendChild(changeEl);
}

function saveMedAdjustChanges() {
    const changes = document.querySelectorAll('#medAdjustHistory .change-item');

    if (changes.length === 0) {
        showToast('ไม่มีการเปลี่ยนแปลงที่จะบันทึก', 'warning');
        return;
    }

    // Collect change texts for A/P — text is already formatted correctly
    const changeTexts = Array.from(changes).map(el => {
        let text = el.textContent.trim().replace(/×/g, '').trim();
        text = text.replace(/^\s+/, '').trim();
        if (!text) return '';
        return `• ${text}`;
    }).filter(Boolean);

    // Append to A/P (replace existing med-change lines, then add new ones)
    const apInput = document.getElementById('inputAP');
    if (apInput) {
        const baseLines = (apInput.value || '')
            .split('\n')
            .map((line) => line.trimEnd())
            .filter((line) => line.trim() !== '')
            .filter((line) => !/^\s*•\s*(ปรับยา|หยุดยา|จ่ายยาเพิ่ม|เพิ่มยาใหม่):/i.test(line));
        const finalLines = [...baseLines, ...changeTexts];
        apInput.value = finalLines.join('\n').trimEnd();
        resizeTextareaToContent(apInput);
    }

    // Log to medication history
    const edits = changeTexts.map(text => ({
        original: '',
        updated: text
    }));
    if (edits.length > 0) {
        logMedsChangeToHistory(edits);
    }

    // Update medsChanged checkbox
    const medsChangedCheckbox = document.getElementById('medsChanged');
    if (medsChangedCheckbox) medsChangedCheckbox.checked = true;

    // Reset medsVerified
    const medsVerified = document.getElementById('medsVerified');
    if (medsVerified) medsVerified.checked = false;
    updateMedsStatus();

    // Render inline changes in pMedsCont
    renderMedsInlineChanges();

    // Show medsChangedStatusRow
    const statusRow = document.getElementById('medsChangedStatusRow');
    if (statusRow) statusRow.classList.remove('hidden');

    // Clear history panel
    const historyEl = document.getElementById('medAdjustHistory');
    if (historyEl) {
        historyEl.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">ยังไม่มีการเปลี่ยนแปลง</p>';
    }

    closeMedModal();
    showToast('บันทึกการปรับยาแล้ว', 'success');
    markDirty();
    saveFormState();
}

// Backward-compat stubs for old functions that may still be referenced
function saveMedicationData() {
    try { localStorage.setItem('medicationData', JSON.stringify(medicationData)); } catch (e) {}
}
function loadMedicationData() {
    try { const s = localStorage.getItem('medicationData'); if (s) medicationData = JSON.parse(s); } catch (e) {}
}
function renderMedicationList() { refreshMedOrderList(); }

// Admission Data Modal Functions
function openAdmissionDataModal() {
    // Load current values into modal
    document.getElementById('modalInputCC').value = document.getElementById('inputCC')?.value || '';
    document.getElementById('modalInputHPI').value = document.getElementById('inputHPI')?.value || '';
    document.getElementById('modalInputPMH').value = document.getElementById('inputPMH')?.value || '';
    document.getElementById('modalInputFHx').value = document.getElementById('inputFHx')?.value || '';
    
    openModal('admissionDataModal', { focusSelector: '#modalInputCC' });
}

function closeAdmissionDataModal() {
    closeModal('admissionDataModal');
}

function saveAdmissionDataFromModal() {
    // Save values from modal to actual inputs
    document.getElementById('inputCC').value = document.getElementById('modalInputCC').value;
    document.getElementById('inputHPI').value = document.getElementById('modalInputHPI').value;
    document.getElementById('inputPMH').value = document.getElementById('modalInputPMH').value;
    document.getElementById('inputFHx').value = document.getElementById('modalInputFHx').value;
    
    // Update header
    updateHeaderFromForm();
    
    // Show the admission fields container
    const container = document.getElementById('admitFields_container');
    if (container) {
        container.classList.remove('hidden');
    }
    
    closeAdmissionDataModal();
    showToast('บันทึกข้อมูลแรกรับแล้ว', 'success');
    markDirty();
    saveFormState();
}

// Admission Orders Modal Functions
function openAdmissionOrdersModal() {
    // Load current values into modal
    document.getElementById('modalInputOneDay').value = document.getElementById('inputOneDay_Admit')?.value || '';
    document.getElementById('modalInputContinuous').value = document.getElementById('inputCont_Admit')?.value || '';
    
    openModal('admissionOrdersModal', { focusSelector: '#modalInputOneDay' });
}

function closeAdmissionOrdersModal() {
    closeModal('admissionOrdersModal');
}

function saveAdmissionOrdersFromModal() {
    // Save values from modal to actual inputs
    const oneDayInput = document.getElementById('inputOneDay_Admit');
    const continuousInput = document.getElementById('inputCont_Admit');
    
    if (oneDayInput) {
        oneDayInput.value = document.getElementById('modalInputOneDay').value;
        resizeTextareaToContent(oneDayInput);
    }
    
    if (continuousInput) {
        continuousInput.value = document.getElementById('modalInputContinuous').value;
        resizeTextareaToContent(continuousInput);
    }

    // Auto-copy Continuous Orders → pMedsCont as baseline
    const contMeds = (continuousInput?.value || '').trim();
    if (contMeds) {
        setMedsContent(contMeds, { source: 'admit', rawText: contMeds });
        updateHeaderFromForm();
        const medsVerified = document.getElementById('medsVerified');
        if (medsVerified) medsVerified.checked = false;
        updateMedsStatus();
        markMedsDirty();
    }
    
    // Show the admission plan container
    const container = document.getElementById('admitPlan_container');
    if (container) {
        container.classList.remove('hidden');
    }
    
    // Sync orders
    syncOrdersStoreFromUI({ source: 'admission' });
    
    closeAdmissionOrdersModal();
    showToast('บันทึก Orders แล้ว', 'success');
    markDirty();
    saveFormState();
}

// Current Medications Modal Functions
function openCurrentMedicationsModal() {
    // Load current values into modal
    const pMedsCont = document.getElementById('pMedsCont');
    const medsUpdateDate = document.getElementById('medsUpdateDate');
    
    document.getElementById('modalPMedsCont').value = pMedsCont?.textContent || '';
    document.getElementById('modalMedsUpdateDate').value = medsUpdateDate?.value || '';
    
    openModal('currentMedicationsModal', { focusSelector: '#modalPMedsCont' });
}

function closeCurrentMedicationsModal() {
    closeModal('currentMedicationsModal');
}

function saveCurrentMedicationsFromModal() {
    // Save values from modal to actual elements
    const pMedsCont = document.getElementById('pMedsCont');
    
    if (pMedsCont) {
        pMedsCont.textContent = document.getElementById('modalPMedsCont').value;
    }
    
    const newDate = document.getElementById('modalMedsUpdateDate').value;
    setMedsUpdateDate(newDate, { persist: false });
    
    closeCurrentMedicationsModal();
    showToast('บันทึกรายการยาแล้ว', 'success');
    markDirty();
    saveFormState();
}

// Initial Plan Modal Functions
function openInitialPlanModal() {
    // Load current values into modal
    const planMxInput = document.getElementById('inputPlanMx_Admit');
    document.getElementById('modalInputPlanMx').value = planMxInput?.value || '';
    
    openModal('initialPlanModal', { focusSelector: '#modalInputPlanMx' });
}

function closeInitialPlanModal() {
    closeModal('initialPlanModal');
}

function saveInitialPlanFromModal() {
    // Save values from modal to actual input
    const planMxInput = document.getElementById('inputPlanMx_Admit');
    
    if (planMxInput) {
        planMxInput.value = document.getElementById('modalInputPlanMx').value;
        resizeTextareaToContent(planMxInput);
    }
    
    closeInitialPlanModal();
    showToast('บันทึกแผนการรักษาแล้ว', 'success');
    markDirty();
    saveFormState();
}

function toggleAdmitMode(forceState = null) {
    const isAdmitInput = document.getElementById('isAdmitMode');
    const currentVal = isAdmitInput.value === 'true';
    const newState = (forceState !== null) ? forceState : !currentVal;

    isAdmitInput.value = newState ? 'true' : 'false';

    const btn = document.getElementById('btnToggleAdmit');
    const admitSection = document.getElementById('admitSection');
    const admitFields = document.getElementById('admitFields_container');
    const standardAP = document.getElementById('standardAP_container');
    const admitPlan = document.getElementById('admitPlan_container');
    const admitPlanHint = document.getElementById('admitPlanHint');

    // const apTitle = document.getElementById('apSectionTitle'); // Removed
    const planLabel = document.getElementById('planLabel');
    const dailyEntryLabel = document.getElementById('dailyEntryLabel');

    const updatePlanLabels = (isAdmitMode) => {
        if (planLabel) {
            planLabel.textContent = isAdmitMode
                ? 'P (Plan) - แผนการรักษา (Admission Orders):'
                : 'P (Plan - แผนการรักษา):';
        }
        if (dailyEntryLabel) {
            dailyEntryLabel.innerHTML = isAdmitMode
                ? '<i class="fas fa-edit mr-1"></i> ข้อมูลแรกรับจาก IPD (Home ward nurse note)'
                : '<i class="fas fa-edit mr-1"></i> บันทึกอาการวันนี้ (Progress note)';
        }
    };

    if (newState) {
        if (btn) {
            btn.classList.remove('bg-white', 'text-amber-800', 'border-amber-300');
            btn.classList.add('bg-amber-700', 'text-white', 'border-amber-700', 'shadow-md');
            btn.innerHTML = '<i class="fas fa-check-circle"></i> แสดงข้อมูลแรกรับ (เปิด)';
        }
        if (admitSection) admitSection.classList.remove('hidden');
        updatePlanLabels(true);
        if (admitFields) {
            admitFields.classList.remove('hidden');
            admitFields.classList.add('animate-pulse-once');
            setTimeout(() => admitFields.classList.remove('animate-pulse-once'), 500);
        }
        if (standardAP) standardAP.classList.add('hidden');
        if (admitPlan) admitPlan.classList.remove('hidden');
        if (admitPlanHint) admitPlanHint.classList.remove('hidden');
    } else {
        if (btn) {
            btn.classList.add('bg-white', 'text-amber-800', 'border-amber-300');
            btn.classList.remove('bg-amber-700', 'text-white', 'border-amber-700', 'shadow-md');
            btn.innerHTML = '<i class="fas fa-plus-circle"></i> เพิ่มข้อมูลแรกรับ (Admit Note)';
        }
        if (admitSection) admitSection.classList.add('hidden');
        updatePlanLabels(false);
        if (admitFields) admitFields.classList.add('hidden');
        if (standardAP) standardAP.classList.remove('hidden');
        if (admitPlan) admitPlan.classList.add('hidden');
        if (admitPlanHint) admitPlanHint.classList.add('hidden');
    }

    if (newState !== currentVal) markDirty();
}

function setCurrentTime({ force = false } = {}) {
    const timeEl = document.getElementById('logTime');
    if (!timeEl) return;
    if (!force && !isLogDateToday()) return;
    if (hasManualTime && !force) return;
    const nowValue = formatTimeHHMM(new Date());
    if (timeEl.value !== nowValue) {
        timeEl.value = nowValue;
        if (!isRestoringForm) {
            markDirty();
            saveFormState();
        }
    }
}

function initDate({ force = false } = {}) {
    const todayLabel = getTodayDisplayDate();
    const logDateInput = document.getElementById('logDate');
    if (logDateInput && (force || !logDateInput.value.trim())) {
        logDateInput.value = todayLabel;
    }
    const timeEl = document.getElementById('logTime');
    if (timeEl && (force || !timeEl.value.trim())) {
        if (force) hasManualTime = false;
        setCurrentTime({ force: true });
    } else {
        setCurrentTime();
    }

    if (force || !hasRestoredFormState) {
        toggleAdmitMode(false);
    }
}

function formatTimeHHMM(date) {
    const d = date instanceof Date ? date : new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

function getTodayDisplayDate() {
    const today = new Date();
    const day = today.getDate();
    const monthShort = THAI_MONTHS_SHORT[today.getMonth()];
    const year = (today.getFullYear() + 543).toString().slice(-2);
    return `${day} ${monthShort} ${year}`;
}

function isLogDateToday() {
    const logDateInput = document.getElementById('logDate');
    const current = logDateInput?.value?.trim() || '';
    return current === getTodayDisplayDate();
}

function openTimePicker(targetId) {
    const el = document.getElementById(targetId);
    if (!el) return;
    el.focus();
    if (typeof el.showPicker === 'function') {
        try { el.showPicker(); } catch (_) { }
    }
}

function loadData() {
    const savedHeader = safeLocalStorageGetItem('patientLog_header', defaultHeader);
    const savedHistory = safeLocalStorageGetItem('patientLog_history', defaultHistory);
    
    const normalizedHeader = normalizeHeaderLines(savedHeader);
    document.getElementById('headerPart').value = normalizedHeader;
    if (normalizedHeader !== savedHeader) {
        safeLocalStorageSetItem('patientLog_header', normalizedHeader);
    }
    document.getElementById('historyPart').value = savedHistory;
    checkHistoryVisibility();
}

function saveData() {
    const headerValue = document.getElementById('headerPart').value;
    const historyValue = document.getElementById('historyPart').value;
    
    safeLocalStorageSetItem('patientLog_header', headerValue);
    safeLocalStorageSetItem('patientLog_history', historyValue);
}

function restoreTemplate() {
    openModal('restoreTemplateModal', { focusSelector: null });
}

function closeRestoreTemplateModal() {
    closeModal('restoreTemplateModal');
}

function executeRestoreTemplate() {
    closeModal('restoreTemplateModal');
    document.getElementById('headerPart').value = blankTemplate;
    markDirty();
    saveFormState();
}

const HEADER_INLINE_LABEL_REGEX = /(?:\b(?:CC|HPI|PH|FHx|Allergy|Note)\b|หมายเหตุ)\s*:/i;
const stripInlineHeaderLabels = (value) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';
    const match = trimmed.match(HEADER_INLINE_LABEL_REGEX);
    if (!match) return trimmed;
    if (match.index === 0) return '';
    return trimmed.slice(0, match.index).trim();
};

const normalizeHeaderLines = (text) => {
    if (!text) return text;
    let changed = false;
    const lines = text.split('\n').map((line) => {
        const match = line.match(/^(\s*)(CC|HPI|PH|FHx|Allergy|Note|หมายเหตุ):\s*(.*)$/i);
        if (!match) return line;
        const indent = match[1];
        const label = match[2];
        const valueRaw = match[3];
        const cleaned = stripInlineHeaderLabels(valueRaw);
        if (cleaned !== valueRaw.trim()) changed = true;
        return `${indent}${label}: ${cleaned}`.trimEnd();
    });
    return changed ? lines.join('\n') : text;
};

function parseHeaderToForm() {
    const raw = normalizeLineBreaks(document.getElementById('headerPart').value).trim();
    if (!raw) return;
    const separatorMatches = raw.match(/^={10,}\s*$/gm);
    if (raw.includes("(ส่วนที่ 2: บันทึกอาการรายวัน)") || (separatorMatches && separatorMatches.length > 1)) {
        handleFullTextImport(raw);
        return;
    }
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l);
    let nameVal = "", ageVal = "", dxVal = "", indicationVal = "", allergyVal = "", admitVal = "", medsText = "";
    let ccVal = "", hpiVal = "", pmhVal = "", fhxVal = "", noteVal = "";

    const nameMatch = raw.match(/ผู้ป่วย:\s*(.*?)(?:\s*\((\d+)\s*ปี\))?$/m);
    if (nameMatch) { nameVal = nameMatch[1]; ageVal = nameMatch[2] || ""; }
    else if (lines.length > 0) {
        let line0 = lines[0].replace("ผู้ป่วย:", "").trim();
        const ageMatch = line0.match(/(.*?)(?:\s*\((\d+)\s*ปี\))?$/);
        if (ageMatch) { nameVal = ageMatch[1]; ageVal = ageMatch[2] || ""; } else { nameVal = line0; }
    }

    const dxMatch = raw.match(/^\s*Dx\/Indication:\s*(.*?)(?:\n|$)/mi) || raw.match(/^\s*Dx:\s*(.*?)(?:\n|$)/mi);
    if (dxMatch) {
        dxVal = dxMatch[1].trim();
    } else if (lines.length > 1) {
        let potentialDx = lines[1];
    if (!potentialDx.includes("วันที่รับ") && !potentialDx.includes("Admit") && !potentialDx.includes("ยาที่ใช้")) {
        dxVal = potentialDx.replace("Dx/Indication:", "").replace("Dx:", "").replace("แพ้ยา:", "").trim();
    }
    }

    if (dxVal) {
        const dxParenMatch = dxVal.match(/^(.*)\(([^()]*)\)\s*$/);
        if (dxParenMatch) {
            dxVal = dxParenMatch[1].trim();
            indicationVal = dxParenMatch[2].trim();
        }
    }

    // const indicationMatch = ... // Removed as it's merged

    const ccMatch = raw.match(/^\s*CC:\s*(.*?)(?:\n|$)/m);
    if (ccMatch) ccVal = stripInlineHeaderLabels(ccMatch[1]);
    const hpiMatch = raw.match(/^\s*HPI:\s*(.*?)(?:\n|$)/m);
    if (hpiMatch) hpiVal = stripInlineHeaderLabels(hpiMatch[1]);
    const pmhMatch = raw.match(/^\s*PH:\s*(.*?)(?:\n|$)/m);
    if (pmhMatch) pmhVal = stripInlineHeaderLabels(pmhMatch[1]);
    const fhxMatch = raw.match(/^\s*FHx:\s*(.*?)(?:\n|$)/m);
    if (fhxMatch) fhxVal = stripInlineHeaderLabels(fhxMatch[1]);

    const allergyMatch =
        raw.match(/^\s*Allergy:\s*(.*?)(?:\n|={5,}|$)/mi) ||
        raw.match(/^\s*แพ้ยา:\s*(.*?)(?:\n|={5,}|$)/mi);
    if (allergyMatch) allergyVal = stripInlineHeaderLabels(allergyMatch[1]);

    const noteMatch =
        raw.match(/^\s*หมายเหตุ:\s*(.*?)(?:\n|={5,}|$)/mi) ||
        raw.match(/^\s*Note:\s*(.*?)(?:\n|={5,}|$)/mi);
    if (noteMatch) noteVal = stripInlineHeaderLabels(noteMatch[1]);

    const admitMatch = raw.match(/^\s*(?:Admit|วันที่รับ):\s*(.*?)(?:\n|$)/mi);
    if (admitMatch) admitVal = admitMatch[1].trim();
    else {
        for (const line of lines) {
            if (line.match(/(\d{1,2}[\/\s][^\s]+[\/\s]\d{2,4})/) && !line.includes("ยาที่ใช้")) {
                admitVal = line.replace(/^(?:Admit|วันที่รับ):/i, "").trim();
                break;
            }
        }
    }

    const medsHeaderRegex = /^\s*(?:[•\u25cf\u25cb\-\*]\s*)?(?:💊|💉)?\s*(?:Review Treatment|ยาปัจจุบัน|ยาที่ใช้ปัจจุบัน|ยาที่ใช้ที่ใช้ปัจจุบัน)/i;
    const rawLines = raw.split('\n');
    let medsStartLineIndex = -1;
    for (let i = 0; i < rawLines.length; i++) {
        if (medsHeaderRegex.test(rawLines[i])) {
            medsStartLineIndex = i;
            break;
        }
    }
    if (medsStartLineIndex !== -1) {
        medsText = rawLines.slice(medsStartLineIndex + 1).join('\n').trim();
    } else {
        let startMedsIndex = -1;
        for (let i = 3; i < lines.length; i++) {
            if (MEDS_LIST_PREFIX_REGEX.test(lines[i])) { startMedsIndex = i; break; }
        }
        if (startMedsIndex !== -1) medsText = lines.slice(startMedsIndex).join('\n');
    }
    if (medsText) {
        medsText = medsText
            .split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.includes('อัปเดต') && !l.includes('Update'))
            .filter(l => !/ปรับยาล่าสุด|วันที่ปรับยา/i.test(l))
            .map(l => stripMedsListPrefix(l))
            .filter(l => l && l !== '(ยังไม่มีรายการยา)' && !/^\(\s*.*\s*\)$/.test(l))
            .join('\n');
    }
    const medsDate = extractMedsUpdateDateFromText(raw);
    if (medsDate) setMedsUpdateDate(medsDate, { persist: false });

    document.getElementById('pFName').value = nameVal === "..." ? "" : nameVal;
    document.getElementById('pAge').value = ageVal;
    document.getElementById('pDx').value = dxVal === "..." ? "" : dxVal;
    document.getElementById('pIndication').value = indicationVal === "..." ? "" : indicationVal;
    document.getElementById('pAllergy').value = allergyVal === "..." ? "" : allergyVal;
    document.getElementById('pNote').value = noteVal === "..." ? "" : noteVal;
    document.getElementById('pAdmitDate').value = admitVal === "..." ? "" : admitVal;
    setMedsContent(medsText === "..." ? "" : medsText);
    const ccEl = document.getElementById('inputCC');
    const hpiEl = document.getElementById('inputHPI');
    const pmhEl = document.getElementById('inputPMH');
    const fhxEl = document.getElementById('inputFHx');
    if (ccEl) ccEl.value = ccVal === "..." ? "" : ccVal;
    if (hpiEl) hpiEl.value = hpiVal === "..." ? "" : hpiVal;
    if (pmhEl) pmhEl.value = pmhVal === "..." ? "" : pmhVal;
    if (fhxEl) fhxEl.value = fhxVal === "..." ? "" : fhxVal;
}

function getCurrentHeaderView() {
    const headerTextView = document.getElementById('headerTextView');
    return headerTextView && !headerTextView.classList.contains('hidden') ? 'text' : 'form';
}

function setHeaderTabs(view) {
    const tabForm = document.getElementById('tabForm');
    const tabText = document.getElementById('tabText');
    if (tabForm) tabForm.className = view === 'form' ? "tab-active pb-1" : "tab-inactive pb-1";
    if (tabText) {
        tabText.className = view === 'text' ? "tab-active pb-1" : "tab-inactive pb-1";
        tabText.classList.toggle('hidden', !isAdvancedMode);
    }
}

function setAdvancedMode(isEnabled, { persist = true, syncView = true } = {}) {
    isAdvancedMode = Boolean(isEnabled);
    const btn = document.getElementById('advancedModeToggle');
    if (btn) {
        btn.classList.toggle('bg-gray-100', !isAdvancedMode);
        btn.classList.toggle('border-gray-300', !isAdvancedMode);
        btn.classList.toggle('text-gray-700', !isAdvancedMode);
        btn.classList.toggle('hover:bg-gray-200', !isAdvancedMode);
        btn.classList.toggle('bg-amber-600', isAdvancedMode);
        btn.classList.toggle('border-amber-600', isAdvancedMode);
        btn.classList.toggle('text-white', isAdvancedMode);
        btn.classList.toggle('hover:bg-amber-700', isAdvancedMode);
        btn.innerHTML = isAdvancedMode
            ? '<i class="fas fa-sliders"></i> โหมดขั้นสูง: เปิด'
            : '<i class="fas fa-sliders"></i> โหมดขั้นสูง: ปิด';
        btn.setAttribute('aria-pressed', isAdvancedMode ? 'true' : 'false');
    }

    if (!isAdvancedMode && syncView) {
        switchHeaderView('form');
    } else {
        setHeaderTabs(getCurrentHeaderView());
    }

    if (persist) {
        safeLocalStorageSetItem(ADVANCED_MODE_STORAGE_KEY, isAdvancedMode ? '1' : '0');
    }
}

function toggleAdvancedMode() {
    setAdvancedMode(!isAdvancedMode);
}

function switchHeaderView(view, options = {}) {
    const { skipParse = false } = options;
    if (view === 'text' && !isAdvancedMode) view = 'form';
    if (view === 'form') {
        if (!skipParse) parseHeaderToForm();
        document.getElementById('headerFormView').classList.remove('hidden');
        document.getElementById('headerTextView').classList.add('hidden');
        setHeaderTabs('form');
        const allergyError = document.getElementById('allergyError');
        if (allergyError) allergyError.classList.add('hidden');
        document.getElementById('pAllergy').classList.remove('ring-error');
        updateHeaderFromForm();
    } else {
        document.getElementById('headerFormView').classList.add('hidden');
        document.getElementById('headerTextView').classList.remove('hidden');
        setHeaderTabs('text');
    }
    saveFormState();
}

function updateHeaderFromForm() {
    syncAgeMirrors();
    const name = document.getElementById('pFName').value.trim() || 'ชื่อ-นามสกุล';
    const age = document.getElementById('pAge').value.trim();
    const dxBaseValue = document.getElementById('pDx').value.trim();
    const dxBase = dxBaseValue || '...';
    const indicationRaw = (document.getElementById('pIndication')?.value || '').trim();
    let dx = dxBase;
    if (indicationRaw) {
        dx = dxBaseValue ? `${dxBase} (${indicationRaw})` : indicationRaw;
    }
    // const indication = document.getElementById('pIndication').value.trim() || '...'; // Removed
    const admitDate = document.getElementById('pAdmitDate').value.trim() || '...';
    const allergy = stripInlineHeaderLabels(document.getElementById('pAllergy').value.trim());
    const note = stripInlineHeaderLabels((document.getElementById('pNote')?.value || '').trim());
    const medsCont = getMedsContent().trim();

    const allergyError = document.getElementById('allergyError');
    if (allergyError && allergy) allergyError.classList.add('hidden');
    if (allergy) document.getElementById('pAllergy').classList.remove('ring-error');
    const ageStr = age ? ` (${age} ปี)` : '';
    const toSingleLine = (text) => (text || '').replace(/\s*\n\s*/g, ' ').trim();
    const cc = stripInlineHeaderLabels(toSingleLine(document.getElementById('inputCC')?.value));
    const hpi = stripInlineHeaderLabels(toSingleLine(document.getElementById('inputHPI')?.value));
    const pmh = stripInlineHeaderLabels(toSingleLine(document.getElementById('inputPMH')?.value));
    const fhx = stripInlineHeaderLabels(toSingleLine(document.getElementById('inputFHx')?.value));
    const medsUpdateDate = (document.getElementById('medsUpdateDate')?.value || '').trim();
    const medsDateLabel = medsUpdateDate || '...';
    let medsBlock = `💊 Review Treatment (ปรับยาล่าสุด ${medsDateLabel})`;
    if (medsCont) {
        const lines = medsCont.split('\n');
        lines.forEach(line => {
            const cleanLine = line.trim();
            if (!cleanLine) return;
            const bulletLine = cleanLine.startsWith('•') ? cleanLine : '• ' + cleanLine;
            // Replace original #qty with remaining qty
            const info = calculateMedRemaining(cleanLine);
            if (info && info.remaining >= 0) {
                const remainQty = Number.isInteger(info.remaining) ? info.remaining : Math.round(info.remaining);
                // Remove existing #qty and append remaining
                const withoutQty = bulletLine.replace(/\s*#\d+/, '');
                medsBlock += `\n${withoutQty} #${remainQty}`;
            } else {
                medsBlock += `\n${bulletLine}`;
            }
        });
    } else { medsBlock += `\n• (ยังไม่มีรายการยา)`; }
    const headerLines = [
        `ผู้ป่วย: ${name}${ageStr}`,
        `Dx: ${dx}`,
        // `Indication: ${indication}`, // Removed
        `Admit: ${admitDate}`,
        `  CC: ${cc}`,
        `  HPI: ${hpi}`,
        `  PH: ${pmh}`,
        `  FHx: ${fhx}`,
        `  Allergy: ${allergy}`,
    ];
    if (note) headerLines.push(`  หมายเหตุ: ${note}`);
    headerLines.push(`==============`, medsBlock);
    document.getElementById('headerPart').value = headerLines.join('\n');
    updateAdmissionSummary();
    saveData();
}

function formatPlanSummaryText(text) {
    const raw = (text || '').trim();
    if (!raw) return '...';
    return raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            if (/^[•\u2022]/.test(line)) return line;
            if (line.startsWith('-')) return `• ${line.replace(/^-+\s*/, '')}`;
            return line;
        })
        .join('\n');
}

const ORDER_LABEL_VARIANTS = {
    oneDay: [
        'One Day Order',
        'One-Day Order',
        'OD Order',
        'Order OD',
        'OD',
        'คำสั่งวันเดียว',
        'คำสั่ง 1 วัน',
        'คำสั่งครั้งเดียว',
        'สั่งครั้งเดียว',
        'Order ครั้งเดียว',
        'Order วันเดียว',
    ],
    continuous: [
        'Continuous Order',
        'Continue Order',
        'CO',
        'C Order',
        'Long Term Order',
        'Long-term Order',
        'Maintenance Order',
        'ยาต่อเนื่อง',
        'คำสั่งต่อเนื่อง',
        'Order ต่อเนื่อง',
        'ยาเดิม',
        'ยาประจำ',
        'สั่งต่อเนื่อง',
    ],
};
const ORDER_LABEL_REGEX_CACHE = {};

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getOrderLabelRegex(type) {
    if (ORDER_LABEL_REGEX_CACHE[type]) return ORDER_LABEL_REGEX_CACHE[type];
    const variants = ORDER_LABEL_VARIANTS[type] || [];
    if (!variants.length) {
        ORDER_LABEL_REGEX_CACHE[type] = /$^/;
        return ORDER_LABEL_REGEX_CACHE[type];
    }
    const escaped = variants.map(escapeRegExp).join('|');
    ORDER_LABEL_REGEX_CACHE[type] = new RegExp(
        `^\\s*(?:[•\\u25cf\\u25cb\\-\\*]|\\d+[.)])?\\s*(?:${escaped})\\s*(?:[:：\\-–]\\s*(.*))?$`,
        'i'
    );
    return ORDER_LABEL_REGEX_CACHE[type];
}

function parseOrderLabelLine(line, type) {
    const regex = getOrderLabelRegex(type);
    const match = String(line || '').match(regex);
    if (!match) return null;
    return (match[1] || '').trim();
}

function isOrderLabelLine(line, type) {
    return parseOrderLabelLine(line, type) !== null;
}

function isAnyOrderLabelLine(line) {
    return isOrderLabelLine(line, 'oneDay') || isOrderLabelLine(line, 'continuous');
}

function extractPlanFromEntry(lines) {
    if (!Array.isArray(lines) || lines.length === 0) return '';
    let capture = false;
    const planLines = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*P:\s*/.test(line)) {
            capture = true;
            const first = line.replace(/^\s*P:\s*/, '');
            if (first.trim()) planLines.push(first);
            continue;
        }
        if (!capture) continue;
        if (/^\s*(S:|O:|A:)\s*/.test(line)) break;
        if (isHistoryEntryHeaderLine(line)) break;
        if (isAnyOrderLabelLine(line)) break;
        if (!line.trim()) continue;
        planLines.push(line);
    }
    if (!planLines.length) return '';
    return planLines
        .map((line) => line.replace(/\s+$/, ''))
        .map((line) => line.replace(/^\s+/, ''))
        .filter(Boolean)
        .map((line) => {
            if (/^[•\u2022]/.test(line)) return line;
            if (/^-/.test(line)) return `• ${line.replace(/^-+\s*/, '')}`;
            return line;
        })
        .join('\n');
}

function extractAdmitPlanFromHistory(historyText) {
    const text = normalizeLineBreaks(historyText || '').trim();
    if (!text) return '';
    const entries = splitHistoryEntries(text);
    if (!entries.length) return '';

    const admitEntry = entries.find((entry) => entry[0]?.includes('(แรกรับ)'));
    let plan = extractPlanFromEntry(admitEntry || []);
    if (plan) return plan;

    for (const entry of entries) {
        plan = extractPlanFromEntry(entry);
        if (plan) return plan;
    }
    return '';
}

function extractOrderBlockFromEntry(entryLines, type) {
    if (!Array.isArray(entryLines) || !entryLines.length) return '';
    const stopRegex = /^\s*(S|O|A|P):\s*/;
    let capture = false;
    const lines = [];
    for (let i = 1; i < entryLines.length; i++) {
        const line = entryLines[i];
        if (!capture) {
            const inline = parseOrderLabelLine(line, type);
            if (inline !== null) {
                capture = true;
                if (inline) lines.push(inline);
            }
            continue;
        }
        if (stopRegex.test(line) || isAnyOrderLabelLine(line) || isHistoryEntryHeaderLine(line)) break;
        if (!line.trim()) continue;
        lines.push(line.replace(/^\s+/, ''));
    }
    return lines.join('\n').trim();
}

function extractAdmissionOrdersFromHistory(historyText) {
    const text = normalizeLineBreaks(historyText || '').trim();
    if (!text) return { oneDay: '', continuous: '' };
    let entries = splitHistoryEntries(text);
    if (!entries.length) entries = [['', ...text.split('\n')]];

    const admitEntry = entries.find((entry) => entry[0]?.includes('(แรกรับ)'));
    const orderedEntries = [];
    if (admitEntry) orderedEntries.push(admitEntry);
    entries.slice().reverse().forEach((entry) => {
        if (entry !== admitEntry) orderedEntries.push(entry);
    });

    const findBlock = (type) => {
        for (const entry of orderedEntries) {
            const block = extractOrderBlockFromEntry(entry, type);
            if (block) return block;
        }
        return '';
    };

    return {
        oneDay: findBlock('oneDay'),
        continuous: findBlock('continuous'),
    };
}

function parseHistoryEntryHeader(headerLine) {
    const raw = (headerLine || '').replace(/^🔻\s*/, '').trim();
    const cleaned = raw.replace(/\(แรกรับ\)/g, '').trim();
    const timeMatch = cleaned.match(HISTORY_TIME_REGEX);
    let dateText = extractDateToken(cleaned) || cleaned;
    let timeText = '';
    if (timeMatch) {
        timeText = timeMatch[1];
    }
    let dateObj = parseThaiDateInput(dateText);
    if (!dateObj && dateText) {
        const fallback = new Date(dateText);
        if (!Number.isNaN(fallback.getTime())) dateObj = fallback;
    }
    if (dateObj && timeText) {
        const [hour, minute] = timeText.split(':').map((part) => parseInt(part, 10));
        if (Number.isFinite(hour) && Number.isFinite(minute)) {
            dateObj.setHours(hour, minute, 0, 0);
        }
    }
    const timestamp = dateObj && !Number.isNaN(dateObj.getTime())
        ? dateObj.toISOString()
        : new Date().toISOString();
    return { dateText, timeText, timestamp };
}

const MED_CHANGE_KEYWORD_PATTERN = [
    'ปรับยา',
    'เปลี่ยนยา',
    'หยุดยา',
    'งดยา',
    'เพิ่มยา',
    'ลด(?:ขนาด)?ยา',
    'ปรับขนาดยา',
    'adjust(?:\\s*dose)?',
    'change',
    'switch',
    'stop',
    'hold',
    'discontinue',
    'd\\/?c',
    'increase',
    'decrease',
    'titrate(?:\\s*(?:up|down))?',
    'up\\-?titrate',
    'down\\-?titrate',
].join('|');

const MED_CHANGE_LINE_REGEX = new RegExp(
    `^\\s*(?:P:\\s*)?(?:(?:[•\\-\\*]|\\d+[.)])\\s*)?(${MED_CHANGE_KEYWORD_PATTERN})\\s*[:：\\-]?\\s*(.+)$`,
    'i'
);
const MED_CHANGE_HINT_REGEX = new RegExp(MED_CHANGE_KEYWORD_PATTERN, 'i');

function isLikelyMedicationLine(text) {
    const value = String(text || '').toLowerCase();
    return (
        /\b\d+(?:\.\d+)?\s*(mg|g|mcg|ug|iu|u|unit|units|ml)\b/.test(value) ||
        /\b\d+\s*(?:x|×)\s*\d+\b/.test(value) ||
        /\b\d+\s*(tab|tabs|tablet|cap|caps|capsule)\b/.test(value) ||
        /\b\d+\s*(เม็ด|แคปซูล)\b/.test(value) ||
        /\b(po|pc|ac|hs|bid|tid|qid|q\d+h|prn|stat|iv|im|sc|s\/c|p\.o\.)\b/.test(value) ||
        /#\s*\d+/.test(value)
    );
}

function parseMedChangeLine(line) {
    const match = String(line || '').match(MED_CHANGE_LINE_REGEX);
    if (!match) return null;
    const keyword = match[1] || '';
    const detailRaw = match[2] || '';
    const detail = normalizeMedsChangedLine(detailRaw);
    if (!detail) return null;
    const keywordLower = keyword.toLowerCase();
    if (!keyword.includes('ยา') && !/(drug|med|dose)/i.test(keywordLower)) {
        if (!isLikelyMedicationLine(detail)) return null;
    }
    return { keyword, detail };
}

function parseMedsChangesFromHistoryText(historyText) {
    const text = normalizeLineBreaks(historyText || '').trim();
    if (!text) return { changes: [], log: [] };
    let entries = splitHistoryEntries(text);
    if (!entries.length) entries = [['', ...text.split('\n')]];

    const patientName = document.getElementById('pFName')?.value || 'Unknown';
    const changes = [];
    const log = [];

    entries.forEach((entry) => {
        const headerLine = entry[0] || '';
        const { dateText, timeText, timestamp } = parseHistoryEntryHeader(headerLine);
        const bodyLines = entry.slice(1);
        const planLines = extractSoapSectionLines(bodyLines, 'P');
        const sourceLines = planLines.length ? planLines : bodyLines;
        const changeLines = sourceLines
            .map((line) => parseMedChangeLine(line))
            .filter(Boolean);
        if (!changeLines.length) return;

        const edits = changeLines.map((item, index) => ({
            index,
            original: '',
            updated: item.detail,
        }));
        changes.push({
            timestamp,
            date: dateText || '',
            time: timeText || '',
            edits,
            patientName,
        });
        changeLines.forEach((item) => {
            const action = detectActionFromText(item.keyword) || detectActionFromText(item.detail) || 'change';
            log.push({
                timestamp,
                medName: item.detail,
                action,
                details: item.detail,
                logDate: dateText || '',
                logTime: timeText || '',
            });
        });
    });

    changes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    log.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return { changes, log };
}

function applyParsedMedsHistory(parsed, { persistEmpty = false } = {}) {
    if (!parsed) return;
    const changes = Array.isArray(parsed.changes) ? parsed.changes : [];
    const log = Array.isArray(parsed.log) ? parsed.log : [];
    if (!changes.length && !log.length && !persistEmpty) return;
    setMedsStoreHistory({ changes, log }, { persistLegacy: true });
}

function parseThaiDateInput(value) {
    const trimmed = (value || '').trim();
    if (!trimmed) return null;
    const monthMap = {
        'ม.ค.': 0, 'ม.ค': 0, 'มค': 0,
        'ก.พ.': 1, 'ก.พ': 1, 'กพ': 1,
        'มี.ค.': 2, 'มี.ค': 2, 'มีค': 2,
        'เม.ย.': 3, 'เม.ย': 3, 'เมย': 3,
        'พ.ค.': 4, 'พ.ค': 4, 'พค': 4,
        'มิ.ย.': 5, 'มิ.ย': 5, 'มิย': 5,
        'ก.ค.': 6, 'ก.ค': 6, 'กค': 6,
        'ส.ค.': 7, 'ส.ค': 7, 'สค': 7,
        'ก.ย.': 8, 'ก.ย': 8, 'กย': 8,
        'ต.ค.': 9, 'ต.ค': 9, 'ตค': 9,
        'พ.ย.': 10, 'พ.ย': 10, 'พย': 10,
        'ธ.ค.': 11, 'ธ.ค': 11, 'ธค': 11,
    };
    let day;
    let monthIdx;
    let yearToken;
    const thaiMonthPattern = '(?:ม\\.?ค\\.?|ก\\.?พ\\.?|มี\\.?ค\\.?|เม\\.?ย\\.?|พ\\.?ค\\.?|มิ\\.?ย\\.?|ก\\.?ค\\.?|ส\\.?ค\\.?|ก\\.?ย\\.?|ต\\.?ค\\.?|พ\\.?ย\\.?|ธ\\.?ค\\.?)';
    let match = trimmed.match(new RegExp(`^(\\d{1,2})\\s*(${thaiMonthPattern})\\s*(\\d{2,4})$`, 'i'));
    if (match) {
        day = parseInt(match[1], 10);
        monthIdx = monthMap[match[2]];
        yearToken = match[3];
        if (monthIdx === undefined) return null;
    } else {
        match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (!match) return null;
        day = parseInt(match[1], 10);
        monthIdx = parseInt(match[2], 10) - 1;
        yearToken = match[3];
        if (monthIdx < 0 || monthIdx > 11) return null;
    }
    let yearNum = parseInt(yearToken, 10);
    if (Number.isNaN(yearNum)) return null;
    let yearAD;
    if (yearNum < 100) {
        yearAD = 2500 + yearNum - 543;
    } else if (yearNum >= 2400) {
        yearAD = yearNum - 543;
    } else {
        yearAD = yearNum;
    }
    const date = new Date(yearAD, monthIdx, day);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function calculateLosDays(admitDate, refDate) {
    if (!admitDate || !refDate) return null;
    const start = new Date(admitDate.getFullYear(), admitDate.getMonth(), admitDate.getDate());
    const end = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
    const diffMs = end.getTime() - start.getTime();
    if (!Number.isFinite(diffMs)) return null;
    const days = Math.floor(diffMs / 86400000) + 1;
    if (days < 1) return null;
    return days;
}

function isNegativeAllergy(value) {
    const raw = (value || '').trim();
    if (!raw || raw === '...') return true;
    const lower = raw.toLowerCase();
    if (raw === '-') return true;
    if (/ปฏิเสธ|ปฎิเสธ|ไม่มี/.test(raw)) return true;
    if (/\bno\b|\bnone\b/.test(lower)) return true;
    return false;
}

function updateAdmissionSummary() {
    const nameEl = document.getElementById('admissionSummaryName');
    const dxEl = document.getElementById('admissionSummaryDx');
    const admitEl = document.getElementById('admissionSummaryAdmit');
    const allergyEl = document.getElementById('admissionSummaryAllergy');
    const losEl = document.getElementById('admissionSummaryLos');
    const noteRow = document.getElementById('admissionSummaryNoteRow');
    const noteEl = document.getElementById('admissionSummaryNote');
    const ccEl = document.getElementById('admissionSummaryCc');
    const hpiEl = document.getElementById('admissionSummaryHpi');
    const pmhEl = document.getElementById('admissionSummaryPmh');
    const fhxEl = document.getElementById('admissionSummaryFhx');
    if (!nameEl || !dxEl || !admitEl || !allergyEl || !losEl || !noteRow || !noteEl || !ccEl || !hpiEl || !pmhEl || !fhxEl) return;

    const toSingleLine = (text) => (text || '').replace(/\s*\n\s*/g, ' ').trim();
    const safeText = (text) => (text ? text : '...');

    const name = (document.getElementById('pFName')?.value || '').trim();
    const age = (document.getElementById('pAge')?.value || '').trim();
    let nameDisplay = safeText(name);
    if (age) nameDisplay = `${nameDisplay} (${age} ปี)`;

    const dxRaw = (document.getElementById('pDx')?.value || '').trim();
    const indicationRaw = (document.getElementById('pIndication')?.value || '').trim();
    let dxCombined = dxRaw || '...';
    if (indicationRaw) {
        dxCombined = dxRaw ? `${dxRaw} (${indicationRaw})` : indicationRaw;
    }
    const dx = safeText(dxCombined);
    const admitRaw = (document.getElementById('pAdmitDate')?.value || '').trim();
    const admit = safeText(admitRaw);
    const allergyRaw = (document.getElementById('pAllergy')?.value || '').trim();
    const allergy = safeText(stripInlineHeaderLabels(allergyRaw));
    const noteRaw = stripInlineHeaderLabels((document.getElementById('pNote')?.value || '').trim());
    const planRaw = (document.getElementById('inputPlanMx_Admit')?.value || '').trim();
    const plan = formatPlanSummaryText(planRaw);
    const planText = document.getElementById('admissionPlanSummaryText');
    const logDateRaw = (document.getElementById('logDate')?.value || '').trim();
    const admitDateObj = parseThaiDateInput(admitRaw);
    const logDateObj = parseThaiDateInput(logDateRaw) || new Date();
    const losDays = calculateLosDays(admitDateObj, logDateObj);

    const cc = safeText(stripInlineHeaderLabels(toSingleLine(document.getElementById('inputCC')?.value)));
    const hpi = safeText(stripInlineHeaderLabels(toSingleLine(document.getElementById('inputHPI')?.value)));
    const pmh = safeText(stripInlineHeaderLabels(toSingleLine(document.getElementById('inputPMH')?.value)));
    const fhx = safeText(stripInlineHeaderLabels(toSingleLine(document.getElementById('inputFHx')?.value)));

    nameEl.textContent = nameDisplay;
    dxEl.textContent = dx;
    admitEl.textContent = admit;
    allergyEl.textContent = allergy;
    losEl.textContent = losDays ? `${losDays} วัน` : '...';
    ccEl.textContent = cc;
    hpiEl.textContent = hpi;
    pmhEl.textContent = pmh;
    fhxEl.textContent = fhx;

    if (planText) {
        planText.textContent = planRaw ? plan : 'ยังไม่ได้กรอก';
    }

    const isNegative = isNegativeAllergy(allergy);
    allergyEl.classList.toggle('text-red-700', !isNegative);
    allergyEl.classList.toggle('text-gray-900', isNegative);

    if (noteRaw) {
        noteRow.classList.remove('hidden');
        noteEl.textContent = noteRaw;
    } else {
        noteRow.classList.add('hidden');
        noteEl.textContent = '';
    }

    // Update treatment review section
    refreshTreatmentReview();
}

function refreshTreatmentReview() {
    // Visual feedback on refresh button
    const refreshBtn = document.querySelector('[data-action="refreshTreatmentReview"]');
    if (refreshBtn) {
        const icon = refreshBtn.querySelector('.fa-sync-alt');
        if (icon) icon.classList.add('fa-spin');
        refreshBtn.classList.add('bg-purple-200');
        setTimeout(() => {
            if (icon) icon.classList.remove('fa-spin');
            refreshBtn.classList.remove('bg-purple-200');
        }, 600);
    }

    const medsListEl = document.getElementById('treatmentReviewMedsList');
    const contOrdersSection = document.getElementById('treatmentReviewContOrders');
    const contListEl = document.getElementById('treatmentReviewContList');
    if (!medsListEl) return;

    // --- Continuous Orders (baseline from admission) ---
    const contTextarea = document.getElementById('inputCont_Admit');
    const contText = (contTextarea?.value || '').trim();
    if (contText && contOrdersSection && contListEl) {
        contOrdersSection.classList.remove('hidden');
        contListEl.textContent = contText;
    } else if (contOrdersSection) {
        contOrdersSection.classList.add('hidden');
    }

    // --- Current Medications with remaining pills ---
    const medLines = getMedsLines();
    if (medLines.length === 0) {
        medsListEl.innerHTML = '<p class="text-sm text-gray-400 text-center py-2">ยังไม่มียา</p>';
    } else {
        // Calculate LoS for pill remaining estimation
        const admitRaw = (document.getElementById('pAdmitDate')?.value || '').trim();
        const logDateRaw = (document.getElementById('logDate')?.value || '').trim();
        const admitDateObj = parseThaiDateInput(admitRaw);
        const logDateObj = parseThaiDateInput(logDateRaw) || new Date();
        const losDays = calculateLosDays(admitDateObj, logDateObj) || 0;

        medsListEl.innerHTML = medLines.map(line => {
            const parsed = parseMedicationLine(line);
            if (!parsed) {
                return `<div class="flex items-center gap-2 text-sm py-1 px-2 bg-gray-50 rounded border border-gray-200">
                    <span class="flex-1 font-mono text-gray-700">${escapeHtml(line)}</span>
                </div>`;
            }

            const pillsPerDay = parsed.pillsPerDay || 0;
            const totalAmount = parsed.initialAmount || 0;
            const pillsUsed = pillsPerDay * losDays;
            const pillsRemaining = Math.max(0, totalAmount - pillsUsed);
            const daysRemaining = pillsPerDay > 0 ? Math.floor(pillsRemaining / pillsPerDay) : '∞';

            let badgeColor = 'bg-green-100 text-green-800 border-green-200';
            if (typeof daysRemaining === 'number') {
                if (daysRemaining <= 3) badgeColor = 'bg-red-100 text-red-800 border-red-200';
                else if (daysRemaining <= 7) badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
            }

            const doseDisplay = parsed.dosingType === 'variable'
                ? `${parsed.dose}`
                : `${parsed.dose}x${parsed.frequency}`;

            return `<div class="flex items-center gap-2 text-sm py-1.5 px-2 bg-white rounded border border-gray-200 hover:bg-gray-50">
                <div class="flex-1 min-w-0">
                    <span class="font-bold text-gray-900">${escapeHtml(parsed.name)}</span>
                    <span class="text-gray-600 ml-1">${escapeHtml(doseDisplay)} ${escapeHtml(parsed.route)}${parsed.timing ? ' ' + escapeHtml(parsed.timing) : ''}</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <span class="text-xs text-gray-500">เหลือ <b>${pillsRemaining}</b>/${totalAmount}</span>
                    <span class="inline-flex items-center text-xs font-bold px-1.5 py-0.5 rounded border ${badgeColor}">
                        ${typeof daysRemaining === 'number' ? daysRemaining + ' วัน' : daysRemaining}
                    </span>
                </div>
            </div>`;
        }).join('');
    }

    // --- Stopped Medications ---
    const stoppedSection = document.getElementById('treatmentReviewStopped');
    const stoppedListEl = document.getElementById('treatmentReviewStoppedList');
    if (!stoppedSection || !stoppedListEl) return;

    loadMedsHistoryLog();
    const stopEntries = medsHistoryLog.filter(e => e.action === 'stop');
    // Deduplicate by medName key — keep latest stop per med
    const seen = new Map();
    for (const entry of stopEntries) {
        const key = extractMedKey(entry.medName) || String(entry.medName || '').toLowerCase();
        if (!key) continue;
        const existing = seen.get(key);
        if (!existing || new Date(entry.timestamp) > new Date(existing.timestamp)) {
            seen.set(key, entry);
        }
    }
    const uniqueStops = [...seen.values()].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (uniqueStops.length === 0) {
        stoppedSection.classList.add('hidden');
        return;
    }

    stoppedSection.classList.remove('hidden');
    stoppedListEl.innerHTML = uniqueStops.map(entry => {
        const label = formatMedLabel(entry.medName) || escapeHtml(entry.medName);
        const date = entry.logDate || '';
        return `<div class="flex items-center gap-2 text-sm py-1 px-2 bg-red-50 rounded border border-red-200">
            <i class="fas fa-times-circle text-red-400 text-xs"></i>
            <span class="flex-1 font-semibold text-red-800">${escapeHtml(label)}</span>
            ${date ? `<span class="text-xs text-red-400">${escapeHtml(date)}</span>` : ''}
        </div>`;
    }).join('');
}

function showHistorySection({ scroll = false } = {}) {
    const container = document.getElementById('historyContainer');
    const showBtn = document.getElementById('showHistoryBtn');
    if (container) container.classList.remove('hidden');
    if (showBtn) showBtn.classList.add('hidden');
    if (scroll && container) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setHeaderSectionHidden(isHidden, options = {}) {
    const { scroll = false, persist = true, focusEdit = false } = options;
    const headerSection = document.getElementById('headerSection');
    const notice = document.getElementById('headerHiddenNotice');
    const summary = document.getElementById('admissionSummary');

    if (headerSection) headerSection.classList.toggle('hidden', isHidden);
    if (notice) notice.classList.toggle('hidden', !isHidden);
    if (summary) summary.classList.toggle('hidden', !isHidden);

    if (isHidden) {
        checkHistoryVisibility();
        if (scroll) {
            const summary = document.getElementById('admissionSummary');
            if (summary) summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } else if (scroll && headerSection) {
        headerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (focusEdit) {
        switchHeaderView('form');
        const nameInput = document.getElementById('pFName');
        if (nameInput) {
            setTimeout(() => {
                nameInput.focus();
                nameInput.click();
            }, 100);
        }
    }

    if (persist && !isRestoringForm) saveFormState();
}

function revealHeaderSectionForEdit() {
    setHeaderSectionHidden(false, { scroll: true, focusEdit: true });
}

function saveHeaderAndHide() {
    const headerTextView = document.getElementById('headerTextView');
    if (headerTextView && !headerTextView.classList.contains('hidden')) {
        switchHeaderView('form');
    } else {
        updateHeaderFromForm();
    }
    updateAdmissionSummary();
    setHeaderSectionHidden(true);
    
    // Scroll to edit section
    setTimeout(() => {
        const editSection = document.getElementById('headerHiddenNotice');
        if (editSection) {
            editSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, 100);
}

function toggleAdmissionNoteDetails() {
    // Open modal instead of accordion
    openAdmissionNoteViewModal();
}

function toggleAdmissionPlanDetails() {
    // Open modal instead of accordion
    openAdmissionOrdersViewModal();
}

function openAdmissionNoteViewModal() {
    const modal = document.getElementById('admissionNoteViewModal');
    if (!modal) return;
    
    // Populate modal with data
    const cc = document.getElementById('inputCC')?.value || '-';
    const hpi = document.getElementById('inputHPI')?.value || '-';
    const pmh = document.getElementById('inputPMH')?.value || '-';
    const fhx = document.getElementById('inputFHx')?.value || '-';
    
    document.getElementById('viewCC').textContent = cc;
    document.getElementById('viewHPI').textContent = hpi;
    document.getElementById('viewPMH').textContent = pmh;
    document.getElementById('viewFHx').textContent = fhx;
    
    openModal('admissionNoteViewModal', { focusSelector: null });
}

function closeAdmissionNoteViewModal() {
    closeModal('admissionNoteViewModal');
}

function openAdmissionOrdersViewModal() {
    const modal = document.getElementById('admissionOrdersViewModal');
    if (!modal) return;
    
    // Populate modal with data
    const oneDay = document.getElementById('inputOneDay_Admit')?.value || '-';
    const continuous = document.getElementById('inputCont_Admit')?.value || '-';
    const planMx = document.getElementById('inputPlanMx_Admit')?.value || '-';
    
    document.getElementById('viewOneDay').textContent = oneDay;
    document.getElementById('viewContinuous').textContent = continuous;
    document.getElementById('viewPlanMx').textContent = planMx;
    
    openModal('admissionOrdersViewModal', { focusSelector: null });
}

function closeAdmissionOrdersViewModal() {
    closeModal('admissionOrdersViewModal');
}

function hasExistingAdmissionData() {
    // Check if any admission fields have data
    const cc = document.getElementById('inputCC')?.value?.trim() || '';
    const hpi = document.getElementById('inputHPI')?.value?.trim() || '';
    const pmh = document.getElementById('inputPMH')?.value?.trim() || '';
    const fhx = document.getElementById('inputFHx')?.value?.trim() || '';
    const oneDay = document.getElementById('inputOneDay_Admit')?.value?.trim() || '';
    const continuous = document.getElementById('inputCont_Admit')?.value?.trim() || '';
    const planMx = document.getElementById('inputPlanMx_Admit')?.value?.trim() || '';
    
    return cc || hpi || pmh || fhx || oneDay || continuous || planMx;
}

function editPatientData() {
    openPatientDataModal();
}

// Patient Data Modal Functions
function openPatientDataModal() {
    // Load current values into modal
    document.getElementById('modalPHN').value = document.getElementById('pHN')?.value || '';
    document.getElementById('modalPFName').value = document.getElementById('pFName')?.value || '';
    document.getElementById('modalPAge').value = document.getElementById('pAge')?.value || '';
    document.getElementById('modalPDx').value = document.getElementById('pDx')?.value || '';
    document.getElementById('modalPIndication').value = document.getElementById('pIndication')?.value || '';
    document.getElementById('modalPAdmitDate').value = document.getElementById('pAdmitDate')?.value || '';
    document.getElementById('modalPAllergy').value = document.getElementById('pAllergy')?.value || '';
    
    openModal('patientDataModal', { focusSelector: '#modalPHN' });
}

function closePatientDataModal() {
    closeModal('patientDataModal');
}

function savePatientDataFromModal() {
    // Validate HN (required field)
    const hn = document.getElementById('modalPHN').value.trim();
    if (!hn) {
        showToast('กรุณากรอก HN', 'warning');
        document.getElementById('modalPHN').focus();
        return;
    }
    
    // Save values from modal to actual inputs
    document.getElementById('pHN').value = hn;
    document.getElementById('pFName').value = document.getElementById('modalPFName').value;
    document.getElementById('pAge').value = document.getElementById('modalPAge').value;
    document.getElementById('pDx').value = document.getElementById('modalPDx').value;
    document.getElementById('pIndication').value = document.getElementById('modalPIndication').value;
    document.getElementById('pAdmitDate').value = document.getElementById('modalPAdmitDate').value;
    document.getElementById('pAllergy').value = document.getElementById('modalPAllergy').value;
    
    // Update header display
    updateHeaderFromForm();
    
    closePatientDataModal();
    showToast('บันทึกข้อมูลคนไข้แล้ว', 'success');
    markDirty();
    saveFormState();
}

function editAdmissionData() {
    // Show admission fields container and scroll to it
    const admitFields = document.getElementById('admitFields_container');
    if (admitFields) {
        admitFields.classList.remove('hidden');
        admitFields.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    showToast('เปิดส่วนแก้ไขข้อมูลแรกรับแล้ว - แก้ไขเสร็จให้กด "บันทึก"', 'info');
}

function editAdmissionOrders() {
    // Show admission plan container and scroll to it
    const admitPlan = document.getElementById('admitPlan_container');
    if (admitPlan) {
        admitPlan.classList.remove('hidden');
        admitPlan.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    showToast('เปิดส่วนแก้ไข Admission Orders แล้ว - แก้ไขเสร็จให้กด "บันทึก"', 'info');
}

function saveAdmissionNote() {
    // Save admission note and hide the container
    updateHeaderFromForm();
    updateAdmissionSummary();
    const admitFields = document.getElementById('admitFields_container');
    if (admitFields) admitFields.classList.add('hidden');
    
    // Hide admitSection in existing case mode
    const admitSection = document.getElementById('admitSection');
    if (admitSection) admitSection.classList.add('hidden');
    
    showToast('บันทึกข้อมูลแรกรับเรียบร้อยแล้ว', 'success');
    saveFormState();
}

function saveAdmissionOrders() {
    // Auto-copy Continuous Orders → pMedsCont as baseline
    const contMeds = (document.getElementById('inputCont_Admit')?.value || '').trim();
    if (contMeds) {
        setMedsContent(contMeds, { source: 'admit', rawText: contMeds });
        updateHeaderFromForm();
        const medsVerified = document.getElementById('medsVerified');
        if (medsVerified) medsVerified.checked = false;
        updateMedsStatus();
        markMedsDirty();
    }

    // Save admission orders and hide the container
    updateAdmissionSummary();
    const admitPlan = document.getElementById('admitPlan_container');
    if (admitPlan) admitPlan.classList.add('hidden');
    
    // Hide admitSection in existing case mode
    const admitSection = document.getElementById('admitSection');
    if (admitSection) admitSection.classList.add('hidden');
    
    showToast('บันทึก Admission Orders เรียบร้อยแล้ว', 'success');
    markDirty();
    saveFormState();
}

function checkHistoryVisibility() {
    const history = document.getElementById('historyPart').value.trim();
    const container = document.getElementById('historyContainer');
    const showBtn = document.getElementById('showHistoryBtn');
    if (history === "") { container.classList.add('hidden'); showBtn.classList.add('hidden'); }
    else { container.classList.add('hidden'); showBtn.classList.remove('hidden'); }
}

function toggleHistory() {
    const container = document.getElementById('historyContainer');
    if (container.classList.contains('hidden')) { container.classList.remove('hidden'); document.getElementById('showHistoryBtn').classList.add('hidden'); }
    else { container.classList.add('hidden'); document.getElementById('showHistoryBtn').classList.remove('hidden'); }
}

function toggleHistoryLock() {
    const textarea = document.getElementById('historyPart');
    const btn = document.getElementById('btnHistoryLock');
    const isLocked = textarea.hasAttribute('readonly');
    if (isLocked) {
        textarea.removeAttribute('readonly');
        textarea.classList.remove('bg-gray-100', 'text-gray-600', 'cursor-not-allowed');
        textarea.classList.add('bg-white', 'text-gray-900');
        btn.innerHTML = '<i class="fas fa-lock-open text-green-600"></i> ปลดล็อกแล้ว';
        btn.classList.remove('bg-gray-200', 'text-gray-700', 'border-gray-300');
        btn.classList.add('bg-green-100', 'text-green-700', 'border-green-200');
        textarea.focus();
    } else {
        textarea.setAttribute('readonly', 'true');
        textarea.classList.remove('bg-white', 'text-gray-900');
        textarea.classList.add('bg-gray-100', 'text-gray-600', 'cursor-not-allowed');
        btn.innerHTML = '<i class="fas fa-lock text-xs"></i> ล็อก';
        btn.classList.remove('bg-green-100', 'text-green-700', 'border-green-200');
        btn.classList.add('bg-gray-200', 'text-gray-700', 'border-gray-300');
    }
}

const THAI_MONTH_PATTERN = '(?:ม\\.?ค\\.?|ก\\.?พ\\.?|มี\\.?ค\\.?|เม\\.?ย\\.?|พ\\.?ค\\.?|มิ\\.?ย\\.?|ก\\.?ค\\.?|ส\\.?ค\\.?|ก\\.?ย\\.?|ต\\.?ค\\.?|พ\\.?ย\\.?|ธ\\.?ค\\.?)';
const HISTORY_DATE_TOKEN_REGEX = new RegExp(
    `(\\d{1,2}\\s*${THAI_MONTH_PATTERN}\\s*\\d{2,4}|\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})`,
    'i'
);
const HISTORY_DATE_LINE_REGEX = new RegExp(
    `^\\s*(?:🔻\\s*)?(?:วันที่\\s*)?(?:\\d{1,2}\\s*${THAI_MONTH_PATTERN}\\s*\\d{2,4}|\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})(?:\\s*(?:เวลา)?\\s*\\d{1,2}:\\d{2})?`,
    'i'
);
const HISTORY_TIME_REGEX = /(\d{1,2}:\d{2})/;

function isHistoryEntryHeaderLine(line) {
    const text = String(line || '');
    return text.trim().startsWith('🔻') || HISTORY_DATE_LINE_REGEX.test(text);
}

function extractDateToken(text) {
    const match = String(text || '').match(HISTORY_DATE_TOKEN_REGEX);
    return match ? match[1] : '';
}

function splitHistoryEntries(historyText) {
    const lines = normalizeLineBreaks(historyText || '').split('\n');
    const entries = [];
    let current = [];
    let hasContent = false;

    const pushCurrent = () => {
        if (current.length && hasContent) entries.push(current);
        current = [];
        hasContent = false;
    };

    lines.forEach((line) => {
        if (isHistoryEntryHeaderLine(line)) {
            pushCurrent();
            current = [line];
            hasContent = Boolean(line.trim());
            return;
        }
        if (!current.length) {
            if (!line.trim()) return;
            current = [''];
        }
        current.push(line);
        if (line.trim()) hasContent = true;
    });
    if (current.length && hasContent) entries.push(current);
    return entries;
}

function extractSoapSection(lines, label) {
    const pattern = new RegExp(`^\\s*${label}:\\s*`);
    const startIndex = lines.findIndex((line) => pattern.test(line));
    if (startIndex === -1) return '';
    const sectionLines = [];
    const firstLine = lines[startIndex].replace(pattern, '').trim();
    if (firstLine) sectionLines.push(firstLine);

    for (let i = startIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*(S|O|A|P):\s*/.test(line)) break;
        if (isHistoryEntryHeaderLine(line)) break;
        if (/^\s*(={5,}|-{5,})\s*$/.test(line)) break;
        if (!line.trim()) continue;
        sectionLines.push(line.trim());
    }

    return sectionLines.join('\n');
}

function extractSoapSectionLines(lines, label) {
    const pattern = new RegExp(`^\\s*${label}:\\s*`);
    const startIndex = lines.findIndex((line) => pattern.test(line));
    if (startIndex === -1) return [];
    const sectionLines = [];
    const firstLine = lines[startIndex].replace(pattern, '').trim();
    if (firstLine) sectionLines.push(firstLine);

    for (let i = startIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*(S|O|A|P):\s*/.test(line)) break;
        if (isHistoryEntryHeaderLine(line)) break;
        if (/^\s*(={5,}|-{5,})\s*$/.test(line)) break;
        if (!line.trim()) continue;
        sectionLines.push(line.trim());
    }
    return sectionLines;
}

function formatReportBlock(label, value) {
    const raw = (value || '').trim();
    if (!raw) return `${label}: ...`;
    const lines = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    if (!lines.length) return `${label}: ...`;
    return lines
        .map((line, idx) => (idx === 0 ? `${label}: ${line}` : `   ${line}`))
        .join('\n');
}

function buildHistoryReportText() {
    const historyText = document.getElementById('historyPart')?.value || '';
    const entries = splitHistoryEntries(historyText);
    if (!entries.length) return '';
    const lastEntry = entries[entries.length - 1];
    const headerLine = (lastEntry[0] || '').replace(/^🔻\s*/, '').trim();
    const bodyLines = lastEntry.slice(1);

    const s = extractSoapSection(bodyLines, 'S');
    const o = extractSoapSection(bodyLines, 'O');
    const a = extractSoapSection(bodyLines, 'A');
    const p = extractSoapSection(bodyLines, 'P');

    const nameRaw = (document.getElementById('pFName')?.value || '').trim();
    const ageRaw = (document.getElementById('pAge')?.value || '').trim();
    const hnRaw = (document.getElementById('pHN')?.value || '').trim();
    let nameDisplay = nameRaw || '...';
    if (ageRaw) nameDisplay = `${nameDisplay} (${ageRaw} ปี)`;

    const dxRaw = (document.getElementById('pDx')?.value || '').trim();
    const indicationRaw = (document.getElementById('pIndication')?.value || '').trim();
    let dxCombined = dxRaw || '';
    if (indicationRaw) {
        dxCombined = dxRaw ? `${dxRaw} (${indicationRaw})` : indicationRaw;
    }

    const admitRaw = (document.getElementById('pAdmitDate')?.value || '').trim();
    const allergyRaw = stripInlineHeaderLabels((document.getElementById('pAllergy')?.value || '').trim());
    const pmhRaw = (document.getElementById('inputPMH')?.value || '').trim();
    const medsRaw = getMedsContent();
    const noteRaw = (document.getElementById('pNote')?.value || '').trim();

    // Calculate LoS
    const admitDateObj = parseThaiDateInput(admitRaw);
    const today = new Date();
    const losDays = admitDateObj ? calculateLosDays(admitDateObj, today) : null;
    const losText = losDays !== null ? `${losDays} วัน` : '';

    const safe = (value) => (value && value.trim() ? value.trim() : '-');

    const lines = [
        '📋 สรุปข้อมูลผู้ป่วย (Referral Summary)',
        '═══════════════════════════',
        `ชื่อ: ${safe(nameDisplay)}`,
    ];
    if (hnRaw) lines.push(`HN: ${hnRaw}`);
    lines.push(
        `Dx: ${safe(dxCombined)}`,
        `Admit: ${safe(admitRaw)}${losText ? ` (LoS ${losText})` : ''}`,
        `Allergy: ${safe(allergyRaw)}`,
    );
    if (pmhRaw && pmhRaw !== '-') lines.push(`PMH: ${safe(pmhRaw)}`);
    if (noteRaw) lines.push(`Note: ${noteRaw}`);

    lines.push('');

    // Current medications
    if (medsRaw) {
        lines.push('💊 Current Medications:');
        const medLines = medsRaw.split('\n').map(l => l.trim()).filter(l => l);
        medLines.forEach(l => lines.push(`  ${l}`));
        lines.push('');
    }

    lines.push(
        `📝 บันทึกล่าสุด: ${safe(headerLine)}`,
        formatReportBlock('S', s),
        formatReportBlock('O', o),
        formatReportBlock('A', a),
        formatReportBlock('P', p),
    );

    return lines.join('\n');
}

const REPORT_VIEWS = ['summary', 'table', 'text'];

function setReportView(view) {
    const nextView = REPORT_VIEWS.includes(view) ? view : 'summary';
    const tabMap = {
        summary: 'reportTabSummary',
        table: 'reportTabTable',
        text: 'reportTabText',
    };
    const viewMap = {
        summary: 'reportViewSummary',
        table: 'reportViewTable',
        text: 'reportViewText',
    };

    Object.entries(tabMap).forEach(([key, id]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.remove('report-tab-active', 'report-tab-inactive');
        btn.classList.add(key === nextView ? 'report-tab-active' : 'report-tab-inactive');
    });

    Object.entries(viewMap).forEach(([key, id]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('hidden', key !== nextView);
    });
}

function parseEntryTimestamp(headerLine) {
    const clean = (headerLine || '').replace(/^🔻\s*/, '').trim();
    const dateToken = extractDateToken(clean);
    const timeMatch = clean.match(HISTORY_TIME_REGEX);
    return {
        headerText: clean,
        dateText: dateToken || '',
        timeText: timeMatch ? timeMatch[1] : '',
    };
}

const VITAL_RANGES = {
    bt:   { min: 30, max: 45 },
    pr:   { min: 20, max: 300 },
    rr:   { min: 4, max: 60 },
    spo2: { min: 50, max: 100 },
    bpSys: { min: 40, max: 300 },
    bpDia: { min: 20, max: 200 },
    dtxValue: { min: 10, max: 1000 },
};

const ABNORMAL_THRESHOLDS = {
    bt:   { low: 36.0, high: 37.5, critLow: 35.0, critHigh: 38.5 },
    pr:   { low: 60, high: 100, critLow: 50, critHigh: 120 },
    rr:   { low: 12, high: 20, critLow: 8, critHigh: 30 },
    spo2: { low: 95, high: 101, critLow: 90, critHigh: 101 },
    bpSys: { low: 90, high: 140, critLow: 80, critHigh: 180 },
    bpDia: { low: 60, high: 90, critLow: 50, critHigh: 110 },
    dtxValue: { low: 70, high: 180, critLow: 60, critHigh: 250 },
};

const NORMAL_REFERENCE = {
    bt: 37.0,
    pr: 80,
    rr: 16,
    spo2: 97,
    bpSys: 120,
    bpDia: 80,
    dtxValue: 100,
};

function getAbnormalLevel(value, key) {
    if (value === null || value === undefined || value === '') return 'none';
    const num = Number(value);
    if (!Number.isFinite(num)) return 'none';
    const th = ABNORMAL_THRESHOLDS[key];
    if (!th) return 'none';
    if (num <= th.critLow || num >= th.critHigh) return 'critical';
    if (num < th.low || num > th.high) return 'warning';
    return 'normal';
}

function getAbnormalColor(level) {
    if (level === 'critical') return '#dc2626';
    if (level === 'warning') return '#f59e0b';
    return '';
}

function getTrendArrow(series) {
    if (!series || series.length < 2) return '';
    const last = series[series.length - 1];
    const prev = series[series.length - 2];
    const diff = last - prev;
    const threshold = Math.abs(prev) * 0.03 || 0.5;
    if (diff > threshold) return ' ↑';
    if (diff < -threshold) return ' ↓';
    return ' →';
}

function extractNumericValue(text, pattern) {
    if (!text) return null;
    const match = text.match(pattern);
    if (!match || match[1] === undefined) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
}

function sanitizeVital(value, key) {
    if (value === null || value === undefined) return value;
    const range = VITAL_RANGES[key];
    if (!range) return value;
    const num = Number(value);
    if (!Number.isFinite(num)) return value;
    if (num < range.min || num > range.max) return null;
    return value;
}

function extractBpValuesFromText(text) {
    const raw = text || '';
    const matches = [...raw.matchAll(/\bBP(?:\s*\d*\)?)?\s*[:=]?\s*([0-9]{2,3}\s*\/\s*[0-9]{2,3})/gi)];
    const values = [];
    matches.forEach((match) => {
        const value = match[1].replace(/\s+/g, '');
        if (value && !values.includes(value)) values.push(value);
    });
    return values;
}

function parseBpValue(bpString) {
    const match = (bpString || '').match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    if (!match) return null;
    const sys = Number(match[1]);
    const dia = Number(match[2]);
    if (!Number.isFinite(sys) || !Number.isFinite(dia)) return null;
    return { sys, dia };
}

function parseDtxNumeric(value) {
    const raw = (value || '').trim();
    if (!raw) return null;
    if (/^hi\b/i.test(raw) || /\bhi\b/i.test(raw)) return null;
    const match = raw.match(/([0-9]+(?:\.[0-9])?)/);
    if (!match) return null;
    const num = Number(match[1]);
    return Number.isFinite(num) ? num : null;
}

function parseVitalsFromOSection(oSection) {
    const raw = (oSection || '').trim();
    if (!raw) return null;

    const lines = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const textInline = lines.join(' ');

    const bt = extractNumericValue(textInline, /\bBT\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i);
    const pr = extractNumericValue(textInline, /\bPR\s*[:=]\s*([0-9]+)/i);
    const rr = extractNumericValue(textInline, /\bRR\s*[:=]\s*([0-9]+)/i);

    const bpValues = extractBpValuesFromText(raw);
    const bpDisplay = bpValues.join(', ');
    const bpParsed = parseBpValue(bpValues[bpValues.length - 1] || '');

    const spo2 = extractNumericValue(raw, /\bSpO2\s*[:=]?\s*([0-9]{2,3})/i);

    const dtxLine = lines.find((line) => /DTX\s*:/i.test(line)) || '';
    const dtxRaw = dtxLine
        .replace(/^[•\-\s]+/, '')
        .replace(/DTX\s*:\s*/i, '')
        .trim();
    const dtxValue = parseDtxNumeric(dtxRaw);

    const hasAny = [bt, pr, rr, bpDisplay, spo2, dtxRaw].some((value) => {
        if (typeof value === 'number') return true;
        return Boolean(value);
    });

    if (!hasAny) return null;

    const sBt = sanitizeVital(bt, 'bt');
    const sPr = sanitizeVital(pr, 'pr');
    const sRr = sanitizeVital(rr, 'rr');
    const sSpo2 = sanitizeVital(spo2, 'spo2');
    const sBpSys = sanitizeVital(bpParsed?.sys ?? null, 'bpSys');
    const sBpDia = sanitizeVital(bpParsed?.dia ?? null, 'bpDia');
    const sDtx = sanitizeVital(dtxValue, 'dtxValue');

    return {
        bt: sBt,
        pr: sPr,
        rr: sRr,
        bpDisplay: (sBpSys !== null && sBpDia !== null) ? bpDisplay : '',
        bpSys: sBpSys,
        bpDia: sBpDia,
        spo2: sSpo2,
        dtxRaw: sDtx !== null ? dtxRaw : '',
        dtxValue: sDtx,
    };
}

function buildVitalsTimeline(historyText) {
    const entries = splitHistoryEntries(historyText || '');
    const timeline = [];

    entries.forEach((entry) => {
        const headerLine = entry[0] || '';
        const { headerText, dateText, timeText } = parseEntryTimestamp(headerLine);
        const bodyLines = entry.slice(1);
        const oSection = extractSoapSection(bodyLines, 'O');
        const vitals = parseVitalsFromOSection(oSection);
        if (!vitals) return;
        timeline.push({
            headerText,
            dateText,
            timeText,
            ...vitals,
        });
    });

    return timeline;
}

function formatMetricValue(value, key) {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value);
    if (key === 'bt') return num.toFixed(1);
    return String(Math.round(num));
}

function isFiniteNumber(value) {
    if (value === null || value === undefined || value === '') return false;
    return Number.isFinite(Number(value));
}

function findLatestEntry(timeline, predicate) {
    for (let i = timeline.length - 1; i >= 0; i -= 1) {
        if (predicate(timeline[i])) return timeline[i];
    }
    return null;
}

function renderSparkline(container, values, color, opts) {
    if (!container) return;
    container.innerHTML = '';
    const width = 120;
    const height = 36;
    const padding = 3;
    const refValue = opts?.refValue ?? null;
    const labels = opts?.labels || [];
    const metricKey = opts?.metricKey || '';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', String(height));

    if (!values.length) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(padding));
        line.setAttribute('x2', String(width - padding));
        line.setAttribute('y1', String(height / 2));
        line.setAttribute('y2', String(height / 2));
        line.setAttribute('stroke', '#cbd5f5');
        line.setAttribute('stroke-width', '2');
        svg.appendChild(line);
        container.appendChild(svg);
        return;
    }

    let min = Math.min(...values);
    let max = Math.max(...values);
    if (refValue !== null) {
        min = Math.min(min, refValue);
        max = Math.max(max, refValue);
    }
    const range = max - min || 1;

    if (refValue !== null) {
        const refY = height - padding - ((refValue - min) / range) * (height - padding * 2);
        const refLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        refLine.setAttribute('x1', String(padding));
        refLine.setAttribute('x2', String(width - padding));
        refLine.setAttribute('y1', String(refY));
        refLine.setAttribute('y2', String(refY));
        refLine.setAttribute('stroke', '#d1d5db');
        refLine.setAttribute('stroke-width', '1');
        refLine.setAttribute('stroke-dasharray', '3,3');
        svg.appendChild(refLine);
    }

    const points = values.map((value, index) => {
        const x = padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1);
        const y = height - padding - ((value - min) / range) * (height - padding * 2);
        return { x, y };
    });

    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', color);
    polyline.setAttribute('stroke-width', '2');
    polyline.setAttribute('points', points.map((pt) => `${pt.x},${pt.y}`).join(' '));
    svg.appendChild(polyline);

    points.forEach((pt, i) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(pt.x));
        circle.setAttribute('cy', String(pt.y));
        circle.setAttribute('r', i === points.length - 1 ? '3' : '0');
        circle.setAttribute('fill', color);
        circle.style.cursor = 'pointer';
        circle.style.transition = 'r 0.15s';
        const displayVal = formatMetricValue(values[i], metricKey);
        const label = labels[i] || '';
        const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        titleEl.textContent = label ? `${label}: ${displayVal}` : displayVal;
        circle.appendChild(titleEl);
        circle.addEventListener('mouseenter', () => circle.setAttribute('r', '4'));
        circle.addEventListener('mouseleave', () => circle.setAttribute('r', i === points.length - 1 ? '3' : '0'));
        svg.appendChild(circle);
    });

    container.appendChild(svg);
}

function renderSparklineDual(container, seriesA, seriesB, colorA, colorB) {
    if (!container) return;
    container.innerHTML = '';
    const width = 120;
    const height = 36;
    const padding = 3;

    const combined = []
        .concat(seriesA || [], seriesB || [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', String(height));

    if (!combined.length) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(padding));
        line.setAttribute('x2', String(width - padding));
        line.setAttribute('y1', String(height / 2));
        line.setAttribute('y2', String(height / 2));
        line.setAttribute('stroke', '#cbd5f5');
        line.setAttribute('stroke-width', '2');
        svg.appendChild(line);
        container.appendChild(svg);
        return;
    }

    const min = Math.min(...combined);
    const max = Math.max(...combined);
    const range = max - min || 1;

    const buildPoints = (values) => {
        const data = Array.isArray(values) ? values : [];
        if (!data.length) return [];
        return data.map((value, index) => {
            const x = padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1);
            const y = height - padding - ((value - min) / range) * (height - padding * 2);
            return { x, y };
        });
    };

    const drawLine = (points, color) => {
        if (!points.length) return;
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('fill', 'none');
        polyline.setAttribute('stroke', color);
        polyline.setAttribute('stroke-width', '2');
        polyline.setAttribute('points', points.map((pt) => `${pt.x},${pt.y}`).join(' '));
        svg.appendChild(polyline);
    };

    const drawLastPoint = (points, color) => {
        const lastPoint = points[points.length - 1];
        if (!lastPoint) return;
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(lastPoint.x));
        circle.setAttribute('cy', String(lastPoint.y));
        circle.setAttribute('r', '2.5');
        circle.setAttribute('fill', color);
        svg.appendChild(circle);
    };

    const pointsA = buildPoints(seriesA);
    const pointsB = buildPoints(seriesB);

    drawLine(pointsB, colorB);
    drawLine(pointsA, colorA);
    drawLastPoint(pointsB, colorB);
    drawLastPoint(pointsA, colorA);

    container.appendChild(svg);
}

function renderReportSummary(timeline) {
    const grid = document.getElementById('reportSummaryGrid');
    const empty = document.getElementById('reportSummaryEmpty');
    const rangeEl = document.getElementById('reportSummaryRange');
    if (!grid) return;
    grid.innerHTML = '';

    if (!timeline.length) {
        if (empty) empty.classList.remove('hidden');
        if (rangeEl) {
            rangeEl.textContent = 'ช่วงเวลา: -';
            rangeEl.classList.add('hidden');
        }
        return;
    }
    if (empty) empty.classList.add('hidden');
    if (rangeEl) rangeEl.classList.remove('hidden');

    const formatRangeStamp = (entry) => {
        if (!entry) return '-';
        const dateText = (entry.dateText || '').trim();
        const timeText = (entry.timeText || '').trim();
        if (dateText && timeText) return `${dateText} ${timeText}`;
        if (dateText) return dateText;
        if (timeText) return timeText;
        return (entry.headerText || '').trim() || '-';
    };
    if (rangeEl) {
        const firstEntry = timeline[0];
        const lastEntry = timeline[timeline.length - 1];
        const firstStamp = formatRangeStamp(firstEntry);
        const lastStamp = formatRangeStamp(lastEntry);
        const startDate = parseThaiDateInput(firstEntry?.dateText || '');
        const endDate = parseThaiDateInput(lastEntry?.dateText || '');
        const daySpan = calculateLosDays(startDate, endDate);
        let rangeText = `ช่วงเวลา: ${firstStamp} - ${lastStamp}`;
        if (daySpan) rangeText += ` (รวม ${daySpan} วัน)`;
        rangeEl.textContent = rangeText;
    }

    const metrics = [
        { key: 'bt', label: 'BT', unit: '°C', color: '#f97316', valueKey: 'bt' },
        { key: 'pr', label: 'PR', unit: '/min', color: '#ef4444', valueKey: 'pr' },
        { key: 'rr', label: 'RR', unit: '/min', color: '#06b6d4', valueKey: 'rr' },
        { key: 'bp', label: 'BP', unit: 'mmHg', color: '#6366f1', valueKey: 'bpSys', displayKey: 'bpDisplay' },
        { key: 'spo2', label: 'SpO2', unit: '%', color: '#0ea5e9', valueKey: 'spo2' },
        { key: 'dtx', label: 'DTX', unit: 'mg%', color: '#2563eb', valueKey: 'dtxValue', displayKey: 'dtxRaw' },
    ];

    const buildTimelineLabels = (tl, predicate) =>
        tl.filter(predicate).map((e) => {
            const d = (e.dateText || '').trim();
            const t = (e.timeText || '').trim();
            return d && t ? `${d} ${t}` : d || t || '';
        });

    metrics.forEach((metric) => {
        const filteredEntries = timeline.filter((entry) => isFiniteNumber(entry[metric.valueKey]));
        const series = filteredEntries.map((entry) => Number(entry[metric.valueKey]));
        const seriesLabels = buildTimelineLabels(timeline, (e) => isFiniteNumber(e[metric.valueKey]));

        const lastEntry = findLatestEntry(timeline, (entry) => {
            const displayVal = metric.displayKey ? entry[metric.displayKey] : entry[metric.valueKey];
            return displayVal !== null && displayVal !== undefined && displayVal !== '';
        });
        const lastDisplay = lastEntry
            ? (metric.displayKey ? lastEntry[metric.displayKey] : formatMetricValue(lastEntry[metric.valueKey], metric.key))
            : '-';

        let bpSeries = null;
        let bpDiaSeries = null;
        let bpLabels = [];
        if (metric.key === 'bp') {
            const bpEntries = timeline.filter((entry) =>
                isFiniteNumber(entry.bpSys) && isFiniteNumber(entry.bpDia)
            );
            bpSeries = bpEntries.map((entry) => Number(entry.bpSys));
            bpDiaSeries = bpEntries.map((entry) => Number(entry.bpDia));
            bpLabels = buildTimelineLabels(timeline, (e) => isFiniteNumber(e.bpSys) && isFiniteNumber(e.bpDia));
        }

        const abnormalKey = metric.key === 'bp' ? 'bpSys' : metric.valueKey;
        const lastNumeric = series.length ? series[series.length - 1] : null;
        const abnormalLevel = getAbnormalLevel(lastNumeric, abnormalKey);
        const abnormalColor = getAbnormalColor(abnormalLevel);

        const trendSeries = metric.key === 'bp' ? bpSeries : series;
        const trendArrow = getTrendArrow(trendSeries);

        const dataCount = metric.key === 'bp' ? (bpSeries || []).length : series.length;

        const card = document.createElement('div');
        card.className = 'report-card';
        if (abnormalLevel === 'critical') {
            card.style.borderColor = '#fca5a5';
            card.style.backgroundColor = '#fef2f2';
        } else if (abnormalLevel === 'warning') {
            card.style.borderColor = '#fde68a';
            card.style.backgroundColor = '#fffbeb';
        }

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between text-xs font-bold';
        header.style.color = metric.color;
        const countBadge = dataCount > 0 ? ` <span class="font-normal text-gray-400">(n=${dataCount})</span>` : '';
        header.innerHTML = `<span>${metric.label}${countBadge}</span><span>${metric.unit}</span>`;

        const valueRow = document.createElement('div');
        valueRow.className = 'flex items-baseline gap-1';

        const valueEl = document.createElement('div');
        valueEl.className = 'text-lg font-bold';
        valueEl.textContent = String(lastDisplay || '-');
        if (abnormalColor) {
            valueEl.style.color = abnormalColor;
        } else {
            valueEl.classList.add('text-gray-900');
        }

        const arrowEl = document.createElement('span');
        arrowEl.className = 'text-sm font-semibold';
        if (trendArrow.includes('↑')) {
            arrowEl.style.color = '#dc2626';
        } else if (trendArrow.includes('↓')) {
            arrowEl.style.color = '#2563eb';
        } else {
            arrowEl.style.color = '#6b7280';
        }
        arrowEl.textContent = trendArrow;

        valueRow.appendChild(valueEl);
        if (trendArrow) valueRow.appendChild(arrowEl);

        const sparkline = document.createElement('div');
        sparkline.className = 'report-sparkline';
        const refValue = NORMAL_REFERENCE[metric.valueKey] ?? null;
        if (metric.key === 'bp') {
            renderSparklineDual(sparkline, bpSeries, bpDiaSeries, metric.color, '#a5b4fc');
        } else {
            renderSparkline(sparkline, series, metric.color, {
                refValue,
                labels: seriesLabels,
                metricKey: metric.key,
            });
        }

        const meta = document.createElement('div');
        meta.className = 'text-xs text-gray-500';
        if (metric.key === 'bp') {
            const sysSeries = bpSeries || [];
            const diaSeries = bpDiaSeries || [];
            const buildRangeText = (label, values) => {
                if (!values.length) return '';
                const minVal = Math.min(...values);
                const maxVal = Math.max(...values);
                return `${label} ${formatMetricValue(minVal, 'bp')}-${formatMetricValue(maxVal, 'bp')}`;
            };
            const sysText = buildRangeText('SBP', sysSeries);
            const diaText = buildRangeText('DBP', diaSeries);
            if (sysText && diaText) {
                meta.textContent = `${sysText} / ${diaText}`;
            } else if (sysText) {
                meta.textContent = sysText;
            } else if (diaText) {
                meta.textContent = diaText;
            } else {
                meta.textContent = 'ยังไม่มีข้อมูลต่อเนื่อง';
            }
        } else if (series.length) {
            const min = Math.min(...series);
            const max = Math.max(...series);
            meta.textContent = `min ${formatMetricValue(min, metric.key)} / max ${formatMetricValue(max, metric.key)}`;
        } else {
            meta.textContent = 'ยังไม่มีข้อมูลต่อเนื่อง';
        }

        card.appendChild(header);
        card.appendChild(valueRow);
        card.appendChild(sparkline);
        card.appendChild(meta);
        grid.appendChild(card);
    });
}

function appendReportCell(row, text, align = 'center') {
    const td = document.createElement('td');
    td.className = 'px-2 py-2 whitespace-nowrap';
    if (align === 'left') {
        td.classList.add('text-left');
    } else if (align === 'right') {
        td.classList.add('text-right');
    } else {
        td.classList.add('text-center');
    }
    td.textContent = text;
    row.appendChild(td);
}

function renderReportTable(timeline) {
    const body = document.getElementById('reportVitalsTableBody');
    const empty = document.getElementById('reportTableEmpty');
    if (!body) return;
    body.innerHTML = '';

    if (!timeline.length) {
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');

    const rows = timeline.slice().reverse();
    rows.forEach((entry) => {
        const row = document.createElement('tr');
        appendReportCell(row, entry.dateText || '-', 'center');
        appendReportCell(row, entry.timeText || '-', 'center');
        appendReportCell(row, formatMetricValue(entry.bt, 'bt'), 'center');
        appendReportCell(row, formatMetricValue(entry.pr, 'pr'), 'center');
        appendReportCell(row, formatMetricValue(entry.rr, 'rr'), 'center');
        appendReportCell(row, entry.bpDisplay || '-', 'center');
        appendReportCell(row, formatMetricValue(entry.spo2, 'spo2'), 'center');
        appendReportCell(row, entry.dtxRaw || '-', 'left');
        body.appendChild(row);
    });
}

function openHistoryReport() {
    const report = buildHistoryReportText();
    if (!report) {
        showToast('ยังไม่มีประวัติอาการเดิมให้สรุป กรุณากรอกข้อมูลในช่อง "ประวัติอาการเดิม" ก่อน', 'warning');
        return;
    }
    const historyText = document.getElementById('historyPart')?.value || '';
    const timeline = buildVitalsTimeline(historyText);
    const output = document.getElementById('reportOutput');
    if (output) output.value = report;
    renderReportSummary(timeline);
    renderReportTable(timeline);
    setReportView(timeline.length ? 'summary' : 'text');
    openModal('reportModal', { focusSelector: '#reportOutput' });
}

function closeReportModal() {
    closeModal('reportModal');
}

function copyReportToClipboard() {
    const output = document.getElementById('reportOutput');
    if (!output) return;
    const text = output.value || '';
    if (!text.trim()) {
        showToast('ยังไม่มีรายงานให้คัดลอก กรุณากด "สร้างข้อความ" ก่อน', 'warning');
        return;
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text)
            .then(() => showToast('คัดลอกรายงานแล้ว'))
            .catch(() => {
                output.select();
                try {
                    document.execCommand('copy');
                    showToast('คัดลอกรายงานแล้ว');
                } catch (_) {
                    showToast('คัดลอกไม่สำเร็จ กรุณาลองเลือกข้อความแล้วกด Cmd+C หรือ Ctrl+C', 'error');
                }
            });
        return;
    }

    output.select();
    try {
        document.execCommand('copy');
        showToast('คัดลอกรายงานแล้ว');
    } catch (_) {
        showToast('คัดลอกไม่สำเร็จ กรุณาลองเลือกข้อความแล้วกด Cmd+C หรือ Ctrl+C', 'error');
    }
}

const ORDER_TEMPLATES = {
    oneDay: [
        '• notify แพทย์',
        '• วัด V/S ซ้ำ',
        '• [คำสั่งครั้งเดียวอื่นๆ]',
    ].join('\n'),
    continuous: [
        '• [ชื่อยา] [ขนาด] [ความถี่] [route] #[จำนวน]',
        '• วัด V/S q4h',
        '• [คำสั่งต่อเนื่องอื่นๆ]',
    ].join('\n'),
};

const TEMPLATE_TEXTS = {
    // Diet
    'diet-low-salt': '• Low salt diet',
    'diet-low-protein': '• Low protein diet',
    'diet-restrict-fluid': '• Restrict fluid',
    'diet-dm': '• DM diet',
    // Monitoring
    'mon-vs-q4h': '• Monitor V/S q4h',
    'mon-bp-2x': '• วัด BP 2 ครั้ง/วัน',
    'mon-bp-4x': '• วัด BP 4 ครั้ง/วัน',
    'mon-io': '• I/O chart',
    'mon-weight': '• Daily weight',
    // DTX
    'dtx-premeal-bd': '• DTX premeal เช้า-เย็น',
    'dtx-premeal-am': '• DTX premeal เช้า',
    'dtx-acpc': '• DTX AC/PC',
    'dtx-q4h': '• DTX q4h',
    'dtx-qid': '• DTX qid',
    // Labs
    'lab-fbs-hba1c': '• FBS, HbA1c',
    'lab-lipid': '• Lipid profile (Chol, TG, LDL, HDL)',
    'lab-renal': '• Cr, eGFR, UPCR',
    'lab-lyte': '• Electrolytes (Na, K, Cl)',
    // EKG
    'ekg-12lead': '• EKG 12 lead',
    'ekg-chest-pain': '• EKG if chest pain'
};

function openOrderTemplateModal() {
    openModal('orderTemplateModal');
}

function closeOrderTemplateModal() {
    closeModal('orderTemplateModal');
}

function clearOrderTemplateSelection() {
    document.querySelectorAll('.order-template-checkbox').forEach(cb => {
        cb.checked = false;
    });
}

function insertSelectedTemplates() {
    const checked = document.querySelectorAll('.order-template-checkbox:checked');
    if (checked.length === 0) {
        showToast('กรุณาเลือกอย่างน้อย 1 รายการ', 'warning');
        return;
    }

    const templates = [];
    checked.forEach(cb => {
        const templateKey = cb.dataset.template;
        
        if (templateKey === 'notify-custom') {
            const customText = document.getElementById('notifyCustomText')?.value.trim();
            if (customText) {
                templates.push(`• Notify MD if ${customText}`);
            }
        } else {
            const text = TEMPLATE_TEXTS[templateKey];
            if (text) templates.push(text);
        }
    });

    if (templates.length === 0) {
        showToast('กรุณากรอกข้อความหรือเลือกรายการอื่น', 'warning');
        return;
    }

    // Insert into continuous orders
    const textarea = document.getElementById('inputCont_Admit');
    if (!textarea) return;

    const current = normalizeLineBreaks(textarea.value || '');
    const trimmed = current.trim();
    let nextValue = '';
    
    if (!trimmed || trimmed === '•') {
        nextValue = templates.join('\n');
    } else {
        const separator = trimmed.endsWith('\n') ? '' : '\n';
        nextValue = `${current}${separator}${templates.join('\n')}`;
    }
    
    textarea.value = nextValue.trimEnd();
    resizeTextareaToContent(textarea);
    
    clearOrderTemplateSelection();
    document.getElementById('notifyCustomText').value = '';
    closeOrderTemplateModal();
    showToast(`แทรก ${templates.length} รายการแล้ว`, 'success');
    textarea.focus();
}

function insertOrderTemplate(type) {
    // Open the new template modal instead
    openOrderTemplateModal();
}


// --- NEW CONFIRMATION SYSTEM (Replaces blocked window.confirm) ---
function openResetConfirmation() {
    openModal('newCaseModal', { focusSelector: null });
}

function openClearFormConfirmation() {
    openModal('clearFormModal', { focusSelector: null });
}

function closeConfirmation() {
    closeModal('newCaseModal');
    closeModal('clearFormModal');
    closeModal('safetyCheckModal');
}

function executeClearForm() {
    resetFormFields();
    initDate({ force: true });
    closeConfirmation();
    saveFormState();
}

function resetFormFields() {
    // Removed 'inputAllergy_Admit' from the list
    const ids = ['inputS', 'valBP', 'valT', 'valP', 'valR', 'valDTX', 'valDTX_Hr', 'valSpO2', 'valUrine', 'valStool', 'inputO_Extra', 'inputAP', 'inputOneDay_Admit', 'inputCont_Admit', 'inputPlanMx_Admit', 'medsChangedList', 'medsChangeBaseline'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    updateBpCountBadge();
    // Reset DTX Type selection (no default)
    const prevRestoring = isRestoringForm;
    isRestoringForm = true;
    setDtxType('');
    setDtxHiState(false);
    isRestoringForm = prevRestoring;
    // Reset Assessment (A)
    const assessInput = document.getElementById('assessmentStatus');
    if (assessInput) assessInput.value = '';
    const watch = document.getElementById('assessmentWatch');
    if (watch) watch.checked = false;
    const risk = document.getElementById('assessmentRisk');
    if (risk) risk.checked = false;
    const medsChanged = document.getElementById('medsChanged');
    if (medsChanged) medsChanged.checked = false;
    setMedsEditorEditable(false);
    updateMedsChangeSummary();
    updateAdmissionSummary();
    updateAssessmentButtons('');
    syncOrdersStoreFromUI({ source: 'reset' });
    markDirty();
}

function resetCaseForImport() {
    hasGenerated = false;
    clearDirtyState();
    clearFormState();
    setHeaderSectionHidden(false, { persist: false });

    const headerPart = document.getElementById('headerPart');
    const historyPart = document.getElementById('historyPart');
    if (headerPart) headerPart.value = "";
    if (historyPart) historyPart.value = "";
    checkHistoryVisibility();

    document.getElementById('pFName').value = "";
    document.getElementById('pAge').value = "";
    document.getElementById('pDx').value = "";
    document.getElementById('pIndication').value = "";
    document.getElementById('pAllergy').value = "";
    document.getElementById('pNote').value = "";
    const ccEl = document.getElementById('inputCC');
    const hpiEl = document.getElementById('inputHPI');
    const pmhEl = document.getElementById('inputPMH');
    const fhxEl = document.getElementById('inputFHx');
    if (ccEl) ccEl.value = "";
    if (hpiEl) hpiEl.value = "";
    if (pmhEl) pmhEl.value = "";
    if (fhxEl) fhxEl.value = "";
    const allergyError = document.getElementById('allergyError');
    if (allergyError) allergyError.classList.add('hidden');
    document.getElementById('pAllergy').classList.remove('ring-error');
    setMedsContent('', { source: 'manual', rawText: '' });

    resetFormFields();
    document.getElementById('outputArea').value = "";
    document.getElementById('resultSection').classList.add('hidden');

    document.getElementById('medsVerified').checked = false;
    updateMedsStatus();
    setMedsUpdateDate('', { persist: false });
    medsDirty = false;

    hasManualTime = false;
    initDate({ force: true });
    setTipsMode('existing');
}

// --- CORE NEW CASE LOGIC (No Alert/Confirm - Uses Modal) ---
function executeNewCase() {
    closeConfirmation();

    try {
        console.log('Execute New Case Triggered');
        hasGenerated = false;
        clearDirtyState();
        clearFormState();
        setHeaderSectionHidden(false, { persist: false });

        // 1. Reset Storage
        document.getElementById('headerPart').value = "";
        document.getElementById('historyPart').value = "";
        // Hide all history elements for new case to reduce confusion
        const historyContainer = document.getElementById('historyContainer');
        const showHistoryBtn = document.getElementById('showHistoryBtn');
        if (historyContainer) historyContainer.classList.add('hidden');
        if (showHistoryBtn) showHistoryBtn.classList.add('hidden');

        // 2. Clear Header Inputs Manually
        document.getElementById('pFName').value = "";
        document.getElementById('pAge').value = "";
        document.getElementById('pDx').value = "";
        document.getElementById('pIndication').value = "";

        document.getElementById('pAllergy').value = "";
        document.getElementById('pNote').value = "";
        // Clear baseline Admission History fields
        const ccEl = document.getElementById('inputCC');
        const hpiEl = document.getElementById('inputHPI');
        const pmhEl = document.getElementById('inputPMH');
        const fhxEl = document.getElementById('inputFHx');
        if (ccEl) ccEl.value = "";
        if (hpiEl) hpiEl.value = "";
        if (pmhEl) pmhEl.value = "";
        if (fhxEl) fhxEl.value = "";
        const allergyError = document.getElementById('allergyError');
        if (allergyError) allergyError.classList.add('hidden');
        document.getElementById('pAllergy').classList.remove('ring-error');
        setMedsContent('', { source: 'manual', rawText: '' });

        // 3. Set Dates (Manual Logic - Independent of initDate)
        const today = new Date();
        const day = today.getDate();
        const monthShort = THAI_MONTHS_SHORT[today.getMonth()];
        const year = (today.getFullYear() + 543).toString().slice(-2);

        document.getElementById('pAdmitDate').value = `${day} ${monthShort} ${year}`;
        document.getElementById('logDate').value = `${day} ${monthShort} ${year}`;
        const timeEl = document.getElementById('logTime');
        if (timeEl) timeEl.value = formatTimeHHMM(today);

        // 4. Clear Body Inputs
        resetFormFields();
        document.getElementById('outputArea').value = "";
        document.getElementById('resultSection').classList.add('hidden');

        // 5. Force View & Meds Status
        document.getElementById('medsVerified').checked = false;
        const medsChanged = document.getElementById('medsChanged');
        if (medsChanged) medsChanged.checked = false;
        updateMedsStatus();
        setMedsUpdateDate('', { persist: false });
        medsDirty = false;
        switchHeaderView('form', { skipParse: true });

        // 6. FORCE ADMIT MODE ON
        toggleAdmitMode(true);
        
        // Hide edit admission button for new case
        const editAdmissionBtn = document.getElementById('editAdmissionBtn');
        if (editAdmissionBtn) editAdmissionBtn.classList.add('hidden');
        
        // Hide admission summary for new case
        const admissionSummary = document.getElementById('admissionSummary');
        if (admissionSummary) admissionSummary.classList.add('hidden');

        // 7. Focus Logic
        window.scrollTo(0, 0);
        setTimeout(() => {
            const nameInput = document.getElementById('pFName');
            if (nameInput) {
                nameInput.focus();
                nameInput.click();
            }
        }, 150);

        // Clear medication data for new case
        medicationData = {
            medications: [],
            admitDate: null
        };
        saveMedicationData();

        hasManualTime = false;
        showToast("เริ่มเคสใหม่เรียบร้อย!");
        setTipsMode('new');
        saveFormState();
    } catch (err) {
        console.error("Error in executeNewCase: ", err);
        showToast("เกิดข้อผิดพลาดในการเริ่มเคสใหม่ กรุณาลองใหม่หรือรีเฟรชหน้าเว็บ", "error");
    }
}

// --- NEW START BUTTON HANDLER ---
function startNewCase() {
    // No native confirm() here. Open modal instead.
    openResetConfirmation();
}

function triggerClearToday() {
    openClearFormConfirmation();
}

function isPlaceholderHeader(text) {
    const normalized = (text || '').trim();
    if (!normalized) return true;

    const baseHeaders = [defaultHeader, blankTemplate].map((value) => (value || '').trim());
    if (baseHeaders.includes(normalized)) return true;

    const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
    let hasRealData = false;

    lines.forEach((line) => {
        if (hasRealData) return;
        if (/^=+/.test(line)) return;

        if (/^ผู้ป่วย:/i.test(line)) {
            const val = line.replace(/^ผู้ป่วย:\s*/i, '').replace(/\(.*?\)/g, '').trim();
            if (val && val !== '...' && val !== 'ชื่อ-นามสกุล') hasRealData = true;
            return;
        }

        if (/^Dx:/i.test(line)) {
            const val = line.replace(/^Dx:\s*/i, '').trim();
            if (val && val !== '...') hasRealData = true;
            return;
        }

        if (/^Admit:/i.test(line)) {
            const val = line.replace(/^Admit:\s*/i, '').trim();
            if (val && val !== '...') hasRealData = true;
            return;
        }

        if (/^(CC|HPI|PH|FHx|Allergy):/i.test(line)) {
            const val = line.replace(/^(CC|HPI|PH|FHx|Allergy):\s*/i, '').trim();
            if (val && val !== '...') hasRealData = true;
            return;
        }

        if (/^💊/.test(line)) {
            const dateMatch = line.match(/\(([^)]+)\)/);
            if (dateMatch && /\d/.test(dateMatch[1])) hasRealData = true;
            return;
        }

        if (/^[•\-]/.test(line)) {
            if (!line.includes('ยังไม่มีรายการยา') && !line.includes('...')) hasRealData = true;
            return;
        }

        hasRealData = true;
    });

    return !hasRealData;
}

function hasExistingCaseData() {
    const history = document.getElementById('historyPart')?.value?.trim() || '';
    if (history) return true;

    const formIds = [
        'pFName', 'pAge', 'pDx', 'pIndication', 'pAdmitDate', 'pAllergy', 'pNote', 'pMedsCont',
        'inputCC', 'inputHPI', 'inputPMH', 'inputFHx',
    ];
    const hasFormData = formIds.some((id) => (document.getElementById(id)?.value || '').trim());
    if (hasFormData) return true;

    const headerText = document.getElementById('headerPart')?.value || '';
    return !isPlaceholderHeader(headerText);
}

function startExistingCase(options = {}) {
    const { skipImportPrompt = false } = options;
    const shouldPromptImport = !skipImportPrompt && !hasExistingCaseData();
    switchHeaderView('form');
    toggleAdmitMode(false);
    
    // Show admission summary for existing case
    const admissionSummary = document.getElementById('admissionSummary');
    if (admissionSummary) admissionSummary.classList.remove('hidden');
    
    // Keep history hidden by default, show toggle button if history exists
    const historyContainer = document.getElementById('historyContainer');
    const showHistoryBtn = document.getElementById('showHistoryBtn');
    if (historyContainer) historyContainer.classList.add('hidden');
    const historyText = (document.getElementById('historyPart')?.value || '').trim();
    if (showHistoryBtn && historyText) showHistoryBtn.classList.remove('hidden');
    
    // Show/hide edit admission button based on whether admission data exists
    const editAdmissionBtn = document.getElementById('editAdmissionBtn');
    if (editAdmissionBtn) {
        const hasAdmissionData = hasExistingAdmissionData();
        if (hasAdmissionData) {
            editAdmissionBtn.classList.remove('hidden');
        } else {
            editAdmissionBtn.classList.add('hidden');
        }
    }
    
    const el = document.getElementById('dailyEntrySection');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTipsMode('existing');
    showToast('พร้อมทำรายงานเคสเดิมแล้ว', 'info');
    saveFormState();
    if (shouldPromptImport) {
        openImportModal();
    }
}

function generateLog() {
    // VALIDATION: Time must be selected
    const timeEl = document.getElementById('logTime');
    const timeGroup = document.getElementById('timePickerGroup');
    const timeVal = (timeEl?.value || '').trim();
    if (!timeVal) {
        if (timeGroup) timeGroup.classList.add('ring-error');
        if (timeEl) timeEl.classList.add('ring-error');
        setTimeout(() => {
            if (timeGroup) timeGroup.classList.remove('ring-error');
            if (timeEl) timeEl.classList.remove('ring-error');
        }, 1000);
        showToast('กรุณาเลือกเวลาในช่อง "เวลา" (ด้านบนขวา) ก่อนสร้างข้อความ', "error");
        if (timeGroup) timeGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    // VALIDATION: Allergy must be filled
    const allergy = document.getElementById('pAllergy').value.trim();
    if (!allergy) {
        // Switch to form view ensuring input is visible
        switchHeaderView('form');
        const allergyInput = document.getElementById('pAllergy');
        const allergyError = document.getElementById('allergyError');
        if (allergyError) allergyError.classList.remove('hidden');

        // VISUAL FEEDBACK FOR ALLERGY
        setTimeout(() => {
            allergyInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            allergyInput.classList.add('ring-error');
            allergyInput.focus();
            setTimeout(() => allergyInput.classList.remove('ring-error'), 1000);
        }, 100); // Small delay to allow view switch

        showToast("กรุณาระบุประวัติการแพ้ยา (หากไม่มีให้พิมพ์ “ปฏิเสธ” หรือ “-”)", "error");
        return;
    }

    // VALIDATION: DTX type must be selected if DTX value is filled
    const dtxVal = document.getElementById('valDTX')?.value?.trim() || '';
    const dtxType = document.getElementById('dtxType')?.value?.trim() || '';
    if (dtxVal && !dtxType) {
        const dtxGroup = document.getElementById('dtxTypeButtonGroup');
        const dtxError = document.getElementById('dtxTypeError');
        if (dtxError) dtxError.classList.remove('hidden');

        if (dtxGroup) {
            dtxGroup.classList.add('ring-error');
            setTimeout(() => dtxGroup.classList.remove('ring-error'), 1000);
            dtxGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        showToast("กรุณาเลือกช่วงเวลาเจาะ DTX (ก่อน/หลัง/สุ่ม) ในช่อง DTX Type", "error");
        return;
    }

    if (!document.getElementById('medsVerified').checked) {
        // Open Safety Modal instead of native confirm
        openModal('safetyCheckModal', { focusSelector: null });
        // Scroll to meds to visually indicate
        switchHeaderView('form');
        const medsSection = document.getElementById('standardAP_container');
        if (medsSection) {
            medsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            medsSection.classList.add('ring-4', 'ring-red-400');
            setTimeout(() => medsSection.classList.remove('ring-4', 'ring-red-400'), 1000);
        }
        return;
    }
    executeGenerateLog();
}

function handleBulletKeydown(e) {
    if (e.key === 'Enter') {
        const textarea = e.target;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        const before = value.substring(0, start);
        const after = value.substring(end);

        // Find current line
        const lastLineIndex = before.lastIndexOf('\n');
        const currentLine = before.substring(lastLineIndex + 1);

        // Check if current line starts with bullet
        if (/^[\u2022\u25cf\u25cb\-\*]\s/.test(currentLine)) {
            e.preventDefault();
            // If line is ONLY bullet, remove it (end of list)
            if (/^[\u2022\u25cf\u25cb\-\*]\s*$/.test(currentLine)) {
                textarea.value = value.substring(0, lastLineIndex + 1) + after;
                textarea.selectionStart = textarea.selectionEnd = lastLineIndex + 1;
                if (textarea.dataset.autoResize === 'true') {
                    resizeTextareaToContent(textarea);
                }
            } else {
                // Insert new bullet
                const bullet = currentLine.match(/^[\u2022\u25cf\u25cb\-\*]\s/)[0];
                const newValue = before + '\n' + bullet + after;
                textarea.value = newValue;
                textarea.selectionStart = textarea.selectionEnd = start + 1 + bullet.length;
                if (textarea.dataset.autoResize === 'true') {
                    resizeTextareaToContent(textarea);
                }
            }
        }
    }
}

function seedBulletOnFocus(e) {
    const textarea = e?.target;
    if (!textarea || textarea.dataset.autobullet !== 'true') return;
    if (textarea.value.trim() !== '') return;
    textarea.value = '• ';
    if (typeof textarea.setSelectionRange === 'function') {
        const pos = textarea.value.length;
        textarea.setSelectionRange(pos, pos);
    }
}

function confirmSafetyCheck() {
    document.getElementById('medsVerified').checked = true;
    updateMedsStatus();
    closeModal('safetyCheckModal');
    executeGenerateLog();
}

function cancelSafetyCheck() {
    closeModal('safetyCheckModal');
}

function executeGenerateLog() {
    saveData();
    const header = document.getElementById('headerPart').value.trim();
    const history = document.getElementById('historyPart').value.trim();
    const date = document.getElementById('logDate').value;
    const logTimeEl = document.getElementById('logTime');
    let time = logTimeEl?.value?.trim() || '';
    if (logTimeEl && !time) {
        time = formatTimeHHMM(new Date());
        logTimeEl.value = time;
    }
    const isAdmit = document.getElementById('isAdmitMode').value === 'true';

    // Define Indentation (3 spaces for SOAP multiline)
    const SOAP_INDENT = "   ";

    // Helper to add • bullets (Only if starts with -)
    const addBullets = (text) => {
        if (!text) return "";
        return text
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => {
                if (line.startsWith('-')) return '• ' + line.replace(/^-+\s*/, '');
                return line; // Do not force bullet if user didn't type it
            })
            .join('\n');
    };

    // Helper: Format Plan text as "P: • ..." with aligned bullets (4 spaces)
    const P_ALIGN = "    ";
    const formatPBlock = (text) => {
        const bulletText = addBullets(text);
        if (!bulletText) return "";
        const lines = bulletText.split('\n');
        return lines
            .map((line, idx) => (idx === 0 ? `P: ${line}` : `${P_ALIGN}${line}`))
            .join('\n');
    };

    const assessStatus = document.getElementById('assessmentStatus')?.value?.trim() || '';
    const assessWatch = document.getElementById('assessmentWatch')?.checked;
    const assessRisk = document.getElementById('assessmentRisk')?.checked;
    const aParts = [];
    if (assessStatus) aParts.push(assessStatus);
    if (assessWatch) aParts.push('เฝ้าดูอาการใกล้ชิด');
    if (assessRisk) aParts.push('เสี่ยงเกิดภาวะแทรกซ้อน');
    const aLine = aParts.length ? `A: ${aParts.join(', ')}` : "";

    let pFinal = "";

    if (isAdmit) {
        const ORDER_INDENT = "  ";
        const oneDay = document.getElementById('inputOneDay_Admit').value.trim();
        const cont = document.getElementById('inputCont_Admit').value.trim();
        const planMx = document.getElementById('inputPlanMx_Admit').value.trim();

        const indentWith = (text, indent) => {
            if (!text) return "";
            return text.split('\n').map(line => indent + line).join('\n');
        };

        const blocks = [];
        if (oneDay) blocks.push(`One Day Order:\n${indentWith(addBullets(oneDay), ORDER_INDENT)}`);
        if (cont) blocks.push(`Continuous Order:\n${indentWith(addBullets(cont), ORDER_INDENT)}`);
        if (planMx) blocks.push(formatPBlock(planMx));

        pFinal = blocks.join('\n');
    } else {
        // inputAP already contains med changes from both Tab 1 (applyMedsChangesToPlan)
        // and Tab 2 (saveMedAdjustChanges) — no need to append medsChangedLines again
        const rawP = document.getElementById('inputAP').value.trim();
        if (rawP) pFinal = formatPBlock(rawP);
    }

    const s = document.getElementById('inputS').value.trim();
    const formatSoapBlock = (label, text) => {
        const cleaned = (text || '').trim();
        if (!cleaned) return "";
        const lines = cleaned
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);
        if (!lines.length) return "";
        return lines
            .map((line, idx) => (idx === 0 ? `${label}: ${line}` : `${SOAP_INDENT}${line}`))
            .join('\n');
    };

    const bpRaw = document.getElementById('valBP').value.trim();
    const bpValues = parseBpReadings(bpRaw);
    const bpLines = [];
    if (bpValues.length > 1) {
        bpValues.forEach((val, idx) => {
            bpLines.push(`BP ${idx + 1}) ${val}`);
        });
    }
    const t = document.getElementById('valT').value.trim();
    const p = document.getElementById('valP').value.trim();
    const r = document.getElementById('valR').value.trim();

    // Updated DTX Generation Logic (Simplified format)
    const dtxVal = document.getElementById('valDTX').value.trim();
    let dtxStr = "";
    if (dtxVal) {
        const type = document.getElementById('dtxType').value.trim();
        const hrs = document.getElementById('valDTX_Hr').value.trim();
        const isDtxHi = dtxVal.toUpperCase() === 'HI';

        let contextStr = "";
        if (type === 'AC') {
            // Result: (ก่อนอาหาร 3 ชม.) or (ก่อนอาหาร)
            contextStr = hrs ? `ก่อนอาหาร ${hrs} ชม.` : `ก่อนอาหาร`;
        } else if (type === 'PC') {
            // Result: (หลังอาหาร 3 ชม.) or (หลังอาหาร)
            contextStr = hrs ? `หลังอาหาร ${hrs} ชม.` : `หลังอาหาร`;
        } else if (type === 'R') {
            contextStr = `Random`;
        }

        const dtxLabel = isDtxHi ? 'HI' : `${dtxVal} mg%`;
        dtxStr = contextStr ? `${dtxLabel} (${contextStr})` : dtxLabel;
    }

    const spo2 = document.getElementById('valSpO2').value.trim();
    const urine = document.getElementById('valUrine').value.trim();
    const stool = document.getElementById('valStool').value.trim();
    const oExtra = document.getElementById('inputO_Extra').value.trim();

    let oLines = [];
    let vsParts = [];
    if (t) vsParts.push(`BT=${t}`);
    if (p) vsParts.push(`PR=${p}`);
    if (r) vsParts.push(`RR=${r}`);
    if (bpValues.length === 1) vsParts.push(`BP=${bpValues[0]}`);

    const vsInline = vsParts.length ? `${vsParts.join(', ')}` : "";
    if (bpLines.length) oLines.push(...bpLines);
    // Keep excretion on its own line after V/S (no bullet)
    const excParts = [];
    if (urine) excParts.push(`ปัสสาวะ ${urine} ครั้ง`);
    if (stool) excParts.push(`ถ่าย ${stool} ครั้ง`);
    if (excParts.length) oLines.push(excParts.join(', '));
    if (dtxStr) oLines.push(`• DTX: ${dtxStr}`);
    if (spo2) oLines.push(`• SpO2: ${spo2}%`);

    if (oExtra) {
        oExtra
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .forEach((line) => oLines.push(line));
    }

    // Apply Indent to all O lines (except V/S which is shown inline with O:)
    const oFinal = oLines.map(line => SOAP_INDENT + line).join('\n');

    let logHeaderLine = `🔻 ${date}${time ? ' ' + time : ''}`;
    if (isAdmit) logHeaderLine += " (แรกรับ)";

    let newEntry = `${logHeaderLine}\n`;
    const sBlock = formatSoapBlock('S', s);
    if (sBlock) newEntry += `${sBlock}\n`;
    if (vsInline || oFinal) {
        newEntry += vsInline ? `O: ${vsInline}\n` : `O:\n`;
        if (oFinal) newEntry += `${oFinal}\n`;
    }
    const apParts = [];
    const aBlock = formatSoapBlock('A', aLine ? aLine.replace(/^A:\s*/, '') : '');
    if (aBlock) apParts.push(aBlock);
    if (pFinal) apParts.push(pFinal);
    const apText = apParts.join('\n');
    if (apText) newEntry += apText;

    const separator = "==============";

    // Updated Logic: 
    // 1. Shortened the separator line.
    // 2. Smart Check: Add separator if it's the FIRST entry of that DATE.
    // 3. Same day entries get standard double-spacing (\n\n) for readability.
    let spacer = "\n\n"; // Default spacing (1 blank line)

    // Check if current date string is already in history
    const isFirstEntryOfDay = !history.includes(date);

    if (history !== "" && isFirstEntryOfDay) {
        spacer = "\n\n-----------------\n";
    }

    let fullLog = history === "" ? `${header}\n${separator}\n${newEntry}` : `${header}\n${separator}\n${history}${spacer}${newEntry}`;

    document.getElementById('outputArea').value = fullLog;
    document.getElementById('resultSection').classList.remove('hidden');
    setTimeout(() => document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    hasGenerated = true;
    clearDirtyState();
}

function copyToClipboard() {
    const copyText = document.getElementById("outputArea");
    copyText.select();

    const onSuccess = () => {
        // Show Big Modal
        const modal = document.getElementById('copySuccessModal');
        if (modal) {
            openModal('copySuccessModal', { focusSelector: null });
        } else {
            showToast("คัดลอกเรียบร้อย!");
        }
    };

    try { document.execCommand('copy'); onSuccess(); }
    catch (err) { navigator.clipboard.writeText(copyText.value).then(onSuccess); }
}

function closeCopyModal() {
    closeModal('copySuccessModal');
}

function closeCopyModalOverlay(event) {
    if (event?.target?.id === 'copySuccessModal') {
        closeCopyModal();
    }
}

function shareToLine() {
    const text = document.getElementById('outputArea')?.value?.trim();
    if (!text) {
        showToast("ยังไม่มีข้อความให้แชร์ กรุณากด \"สร้างข้อความ\" ก่อน", "warning");
        return;
    }
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
    window.open(lineUrl, '_blank');
}

function showToast(message, type = "success") {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    document.getElementById('toastMsg').innerText = message;

    if (icon) {
        let iconName = "check-circle";
        let color = "#86efac"; // green-300
        if (type === "error") {
            iconName = "exclamation-circle";
            color = "#fecaca"; // red-200
        } else if (type === "warning") {
            iconName = "exclamation-triangle";
            color = "#fde68a"; // yellow-200
        } else if (type === "info") {
            iconName = "info-circle";
            color = "#bfdbfe"; // blue-200
        }
        icon.className = `fas fa-${iconName} mr-2`;
        icon.style.color = color;
    }

    toast.classList.remove('hidden');
    if (toast._timer) clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

const TIPS_DETAIL_STORAGE_KEY = 'patientLog_tipsDetail';
let tipsModeState = 'new';
let tipsDetailState = false;

function updateCaseModeToggle() {
    const isNew = tipsModeState === 'new';
    const badge = document.getElementById('caseModeBadge');

    if (badge) {
        badge.textContent = isNew ? 'รับเคสใหม่' : 'เคสเดิม';
        badge.classList.toggle('mode-badge-new', isNew);
        badge.classList.toggle('mode-badge-existing', !isNew);
    }
    
    // Hide admission save buttons in new case mode
    const btnSaveAdmissionNote = document.getElementById('btnSaveAdmissionNote');
    const btnSaveAdmissionOrders = document.getElementById('btnSaveAdmissionOrders');
    
    if (btnSaveAdmissionNote) {
        btnSaveAdmissionNote.classList.toggle('hidden', isNew);
    }
    
    if (btnSaveAdmissionOrders) {
        btnSaveAdmissionOrders.classList.toggle('hidden', isNew);
    }
    
    // Update header mode toggle button styling
    const headerModeToggle = document.getElementById('headerModeToggle');
    const headerModeText = document.getElementById('headerModeText');
    
    if (headerModeToggle && headerModeText) {
        headerModeText.textContent = isNew ? 'แก้ไข' : 'สรุปเคส';
        
        if (isNew) {
            headerModeToggle.className = 'text-xs font-bold px-3 py-1 rounded-full transition flex items-center gap-1.5 bg-green-500 text-white border border-green-600 hover:bg-green-600';
        } else {
            headerModeToggle.className = 'text-xs font-bold px-3 py-1 rounded-full transition flex items-center gap-1.5 bg-blue-500 text-white border border-blue-600 hover:bg-blue-600';
        }
    }
}

function updateTipsTitle() {
    const title = document.getElementById('tipsTitle');
    if (!title) return;
    const modeText = tipsModeState === 'new' ? 'เคสใหม่' : 'เคสเดิม';
    title.textContent = `วิธีใช้ (${modeText})`;
}

function setTipsDetail(isDetailed, { persist = true } = {}) {
    tipsDetailState = Boolean(isDetailed);
    const btn = document.getElementById('tipsToggleBtn');
    const container = document.getElementById('tipsContainer');
    if (btn) {
        btn.setAttribute('aria-pressed', tipsDetailState ? 'true' : 'false');
        btn.setAttribute('aria-expanded', tipsDetailState ? 'true' : 'false');
        btn.setAttribute('aria-label', tipsDetailState ? 'ซ่อนวิธีใช้' : 'แสดงวิธีใช้');
        btn.classList.toggle('bg-white', !tipsDetailState);
        btn.classList.toggle('border-gray-200', !tipsDetailState);
        btn.classList.toggle('text-blue-700', !tipsDetailState);
        btn.classList.toggle('bg-amber-100', tipsDetailState);
        btn.classList.toggle('border-amber-200', tipsDetailState);
        btn.classList.toggle('text-amber-700', tipsDetailState);
    }
    if (container) container.classList.toggle('hidden', !tipsDetailState);

    if (persist) {
        safeLocalStorageSetItem(TIPS_DETAIL_STORAGE_KEY, tipsDetailState ? '1' : '0');
    }
    updateTipsTitle();
    updateTipsVisibility();
}

function toggleTipsDetail() {
    setTipsDetail(!tipsDetailState);
}

function setTipsMode(mode) {
    const isNew = mode === 'new';
    tipsModeState = isNew ? 'new' : 'existing';
    updateTipsTitle();
    updateTipsVisibility();
    updateCaseModeToggle();
    updateHeaderSaveButtonVisibility();
}

function updateTipsVisibility() {
    const existingList = document.getElementById('tipsExisting');
    const newList = document.getElementById('tipsNew');
    const isNew = tipsModeState === 'new';

    if (existingList) existingList.classList.toggle('hidden', isNew);
    if (newList) newList.classList.toggle('hidden', !isNew);
}

function handleCaseModeExisting() {
    if (tipsModeState === 'existing') return;
    startExistingCase();
}

function handleCaseModeNew() {
    if (tipsModeState === 'new') return;
    startNewCase();
}

function initTipsMode() {
    const header = document.getElementById('headerPart')?.value?.trim() || '';
    const isDefault = !header || header === defaultHeader.trim();
    setTipsMode(isDefault ? 'new' : 'existing');
}

function updateHeaderSaveButtonVisibility() {
    const btn = document.getElementById('headerSaveHideBtn');
    if (!btn) return;
    btn.classList.toggle('hidden', tipsModeState !== 'existing');
}

function initTipsDetail() {
    const stored = safeLocalStorageGetItem(TIPS_DETAIL_STORAGE_KEY, '0');
    const isDetailed = stored === '1';
    setTipsDetail(isDetailed, { persist: false });
}

function initAdvancedMode() {
    const stored = safeLocalStorageGetItem(ADVANCED_MODE_STORAGE_KEY, '0');
    const isEnabled = stored === '1';
    setAdvancedMode(isEnabled, { persist: false, syncView: false });
}

const ONBOARDING_SHOWN_KEY = 'patientLog_onboardingShown';

function openOnboarding() {
    openModal('onboardingModal', { focusSelector: null });
}

function closeOnboarding() {
    const dontShow = document.getElementById('dontShowOnboarding');
    closeModal('onboardingModal');
    if (dontShow && dontShow.checked) {
        safeLocalStorageSetItem(ONBOARDING_SHOWN_KEY, '1');
    }
}

function initOnboarding() {
    const shown = safeLocalStorageGetItem(ONBOARDING_SHOWN_KEY, '0');
    if (shown !== '1') {
        setTimeout(() => openOnboarding(), 500);
    }
}

window.onload = function () {
    initFontSize();
    initClickHandlers();
    initDeclarativeEventHandlers();
    loadData();
    initTipsMode();
    initTipsDetail();
    initAdvancedMode();
    initDirtyTracking();
    loadFormState();
    syncMedsEditorState();
    initMedsUpdateDate();
    initMedsStore();
    initOrdersStore();
    initNumericInputs();
    initDate();
    updateBpCountBadge();
    updateMedsStatus();
    renderMedsInlineChanges();
    updateMedsChangeSummary();
    updateAdmissionSummary();
    updateGenerateButtonState();
    initOnboarding();
    const timeInput = document.getElementById('logTime');
    if (timeInput) {
        timeInput.addEventListener('input', () => { hasManualTime = true; saveFormState(); });
        timeInput.addEventListener('change', () => { hasManualTime = true; saveFormState(); });
    }
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) setCurrentTime();
    });
    setInterval(() => {
        if (!document.hidden) setCurrentTime();
    }, 60000);
    document.getElementById('headerPart').addEventListener('input', saveData);
}

function validateTemperature(input) {
    const value = input.value.trim();
    
    // Check if it's exactly 3 digits without decimal point (e.g., "365", "370")
    if (/^\d{3}$/.test(value)) {
        // Highlight the input with error styling
        input.classList.add('ring-error');
        showToast('อุณหภูมิควรเป็น xx.x (เช่น 36.5) หรือ xx (เช่น 37) กรุณาใส่จุดทศนิยม', 'error');
        
        // Remove error styling after 3 seconds
        setTimeout(() => {
            input.classList.remove('ring-error');
        }, 3000);
    }
}

function toggleHeaderMode() {
    // Toggle between new and existing case modes
    tipsModeState = tipsModeState === 'new' ? 'existing' : 'new';
    updateCaseModeToggle();
    
    // Update header mode toggle button
    const headerModeToggle = document.getElementById('headerModeToggle');
    const headerModeText = document.getElementById('headerModeText');
    
    if (headerModeToggle && headerModeText) {
        const isNew = tipsModeState === 'new';
        headerModeText.textContent = isNew ? 'แก้ไข' : 'สรุปเคส';
        
        // Update button styling
        if (isNew) {
            headerModeToggle.className = 'text-xs font-bold px-3 py-1 rounded-full transition flex items-center gap-1.5 bg-green-500 text-white border border-green-600 hover:bg-green-600';
        } else {
            headerModeToggle.className = 'text-xs font-bold px-3 py-1 rounded-full transition flex items-center gap-1.5 bg-blue-500 text-white border border-blue-600 hover:bg-blue-600';
        }
    }
    
    // Show/hide admission section based on mode
    const admitSection = document.getElementById('admitSection');
    if (admitSection) {
        if (tipsModeState === 'new') {
            admitSection.classList.remove('hidden');
        } else {
            admitSection.classList.add('hidden');
        }
    }
    
    // Show/hide admission save buttons
    const btnSaveAdmissionNote = document.getElementById('btnSaveAdmissionNote');
    const btnSaveAdmissionOrders = document.getElementById('btnSaveAdmissionOrders');
    
    if (btnSaveAdmissionNote) {
        btnSaveAdmissionNote.classList.toggle('hidden', tipsModeState === 'new');
    }
    
    if (btnSaveAdmissionOrders) {
        btnSaveAdmissionOrders.classList.toggle('hidden', tipsModeState === 'new');
    }
    
    // Update admit mode
    toggleAdmitMode(tipsModeState === 'new');
    
    showToast(`สลับเป็นโหมด ${tipsModeState === 'new' ? 'เคสใหม่' : 'เคสเดิม'} แล้ว`, 'info');
}

function loadTestData() {
    try {
        console.log('Loading test data...');
        
        // Set mode to existing case first
        tipsModeState = 'existing';
        updateCaseModeToggle();
        
        // Header Section
        const pFName = document.getElementById('pFName');
        if (pFName) pFName.value = 'นางสมศรี ดีใจ';
        
        const pAge = document.getElementById('pAge');
        if (pAge) pAge.value = '75';
        
        const pDx = document.getElementById('pDx');
        if (pDx) pDx.value = 'DM, HT';
        
        const pIndication = document.getElementById('pIndication');
        if (pIndication) pIndication.value = 'HbA1c 11.2';
        
        const pAdmitDate = document.getElementById('pAdmitDate');
        if (pAdmitDate) pAdmitDate.value = '17 ธ.ค. 68';
        
        const pAllergy = document.getElementById('pAllergy');
        if (pAllergy) pAllergy.value = 'ปฏิเสธ';
        
        // Admission Note
        const inputCC = document.getElementById('inputCC');
        if (inputCC) inputCC.value = 'น้ำตาลสูง, หายใจเหนื่อย, ปวดท้อง, แผลติดเชื้อ';
        
        const inputHPI = document.getElementById('inputHPI');
        if (inputHPI) inputHPI.value = 'คนไข้มี DM มา 10 ปี คุมไม่ดี HbA1c 11.2 มาพบแพทย์เพราะรู้สึกตัวดีขึ้น หายใจเหนื่อยเมื่อขยับ และมีปวดท้องเฉียบๆ ที่บริเวณแผลติดเชื้อที่ขาซ้าย';
        
        const inputPMH = document.getElementById('inputPMH');
        if (inputPMH) inputPMH.value = 'DM, HT, โรคไต';
        
        const inputFHx = document.getElementById('inputFHx');
        if (inputFHx) inputFHx.value = 'พ่อเป็น DM, HT แม่เป็น DM';
        
        // Admission Orders
        const inputOneDay_Admit = document.getElementById('inputOneDay_Admit');
        if (inputOneDay_Admit) inputOneDay_Admit.value = '• NSS 1000 ml IV 80 ml/hr';
        
        const inputPlanMx_Admit = document.getElementById('inputPlanMx_Admit');
        if (inputPlanMx_Admit) inputPlanMx_Admit.value = '• Admit Home Ward\n• DTX premeal + hs\n• วัด BP วันละ 2 ครั้ง\n• แนะนำควบคุมอาหาร งดหวาน มัน เค็ม\n• F/U โทรติดตามอาการทุกวัน';
        
        // Current Medications (Home Ward format)
        const medsText = '• Metformin (500) 1x2 po pc #60\n• Glipizide (5) 1x2 po ac #60\n• Amlodipine (5) 1x1 po pc #30\n• Enalapril (5) 1x1 po pc #30\n• Atorvastatin (20) 1x1 po hs #30';
        setMedsContent(medsText);
        
        // Vitals
        const valT = document.getElementById('valT');
        if (valT) valT.value = '36.5';
        
        const valP = document.getElementById('valP');
        if (valP) valP.value = '88';
        
        const valR = document.getElementById('valR');
        if (valR) valR.value = '20';
        
        const valBP = document.getElementById('valBP');
        if (valBP) valBP.value = '130/80';
        
        const valSpO2 = document.getElementById('valSpO2');
        if (valSpO2) valSpO2.value = '98';
        
        // DTX
        const valDTX = document.getElementById('valDTX');
        if (valDTX) valDTX.value = '150';
        
        const dtxType = document.getElementById('dtxType');
        if (dtxType) dtxType.value = 'AC';
        
        // Output
        const valUrine = document.getElementById('valUrine');
        if (valUrine) valUrine.value = '6';
        
        const valStool = document.getElementById('valStool');
        if (valStool) valStool.value = '1';
        
        // Lab Data (O Extra)
        const inputO_Extra = document.getElementById('inputO_Extra');
        if (inputO_Extra) {
            inputO_Extra.value = '• HbA1c: 11.2%\n• BUN/Cr: 25/1.2\n• Na/K: 138/4.2\n• WBC: 8,500\n• Hb: 12.5';
            resizeTextareaToContent(inputO_Extra);
        }
        
        // Subjective
        const inputS = document.getElementById('inputS');
        if (inputS) {
            inputS.value = 'คนไข้รู้สึกตัวดีขึ้น หายใจเหนื่อยน้อยลง แผลติดเชื้อดีขึ้น มีเนื้อเยื่อใหม่';
            resizeTextareaToContent(inputS);
        }
        
        // Assessment
        const assessmentStatus = document.getElementById('assessmentStatus');
        if (assessmentStatus) assessmentStatus.value = 'พอเดิม';
        
        const assessmentWatch = document.getElementById('assessmentWatch');
        if (assessmentWatch) assessmentWatch.checked = false;
        
        const assessmentRisk = document.getElementById('assessmentRisk');
        if (assessmentRisk) assessmentRisk.checked = true;
        
        updateAssessmentButtons('พอเดิม');
        
        // Plan
        const inputAP = document.getElementById('inputAP');
        if (inputAP) {
            inputAP.value = '• แนะนำควบคุมอาหาร งดหวาน มัน เค็ม\n• F/U โทรติดตามอาการพรุ่งนี้\n• นัดเจาะ HbA1c ซ้ำใน 3 เดือน';
            resizeTextareaToContent(inputAP);
        }
        
        // Add medication changes
        const medsChangedData = [
            { index: 0, original: '• Metformin (500) 1x2 po pc #60', updated: '• Metformin (500) 2x2 po pc (เพิ่มขนาด)' },
            { index: 1, original: '• Glipizide (5) 1x2 po ac #60', updated: '• Glipizide (5) 1/2x2 po ac (ลดขนาด)' }
        ];
        const medsChangedList = document.getElementById('medsChangedList');
        if (medsChangedList) medsChangedList.value = JSON.stringify(medsChangedData);
        
        const medsChanged = document.getElementById('medsChanged');
        if (medsChanged) medsChanged.checked = true;
        
        // Add history data
        const historyPart = document.getElementById('historyPart');
        if (historyPart) historyPart.value = '17 ธ.ค. 68\nS: รับไว้ Home Ward เพราะน้ำตาลสูง HbA1c 11.2\nO: T 36.5 P 88 R 20 BP 130/80 O2 98% DTX AC 180\n• HbA1c: 11.2%, BUN/Cr: 25/1.2\nA: DM คุมไม่ดี\nP: • เริ่มยาตาม Continuous Orders\n• แนะนำควบคุมอาหาร\n• F/U โทรพรุ่งนี้\n\n18 ธ.ค. 68\nS: โทร F/U อาการดีขึ้น กินข้าวได้ วัด DTX เอง 165\nO: BP 135/85 (วัดเอง) DTX AC 165\nA: ดีขึ้น น้ำตาลยังสูง\nP: • คุมอาหารต่อ\n• F/U โทรพรุ่งนี้';
        
        // Enable admit mode
        const isAdmitMode = document.getElementById('isAdmitMode');
        if (isAdmitMode) {
            isAdmitMode.value = 'true';
            toggleAdmitMode(true);
        }
        
        // Update displays
        updateHeaderFromForm();
        updateAdmissionSummary();

        // Verify UI state based on mode
        const admitSection = document.getElementById('admitSection');
        if (admitSection && !admitSection.classList.contains('hidden')) {
            console.warn('UI Test Failed: admitSection should be hidden in existing case mode');
            showToast('⚠️ UI Test Failed: admitSection ควรถูกซ่อนในโหมดเคสเดิม', 'warning');
        }

        const btnSaveAdmissionNote = document.getElementById('btnSaveAdmissionNote');
        if (btnSaveAdmissionNote && btnSaveAdmissionNote.classList.contains('hidden')) {
            console.warn('UI Test Failed: btnSaveAdmissionNote should be shown in existing case mode');
            showToast('⚠️ UI Test Failed: ปุ่มบันทึกข้อมูลแรกรับควรแสดงในโหมดเคสเดิม', 'warning');
        }

        const btnSaveAdmissionOrders = document.getElementById('btnSaveAdmissionOrders');
        if (btnSaveAdmissionOrders && btnSaveAdmissionOrders.classList.contains('hidden')) {
            console.warn('UI Test Failed: btnSaveAdmissionOrders should be shown in existing case mode');
            showToast('⚠️ UI Test Failed: ปุ่มบันทึก Admission Orders ควรแสดงในโหมดเคสเดิม', 'warning');
        }

        const headerModeText = document.getElementById('headerModeText');
        if (headerModeText && headerModeText.textContent !== 'Summary') {
            console.warn('UI Test Failed: headerModeText should show "Summary"');
            showToast('⚠️ UI Test Failed: Toggle button ควรแสดง "Summary"', 'warning');
        }

        const assessmentWatchLabel = document.getElementById('assessmentWatchLabel');
        if (assessmentWatchLabel && !assessmentWatchLabel.classList.contains('hidden')) {
            console.warn('UI Test Failed: assessmentWatchLabel should be hidden when assessment is not "ดีขึ้น"');
            showToast('⚠️ UI Test Failed: Checkbox "watch closely" ควรถูกซ่อน', 'warning');
        }

        // Show toast
        showToast('โหลดข้อมูลทดสอบครบทุกฟีเจอร์เรียบร้อย', 'success');
        saveFormState();

        console.log('Test data loaded successfully!');
    } catch (error) {
        console.error('Error loading test data:', error);
        showToast('เกิดข้อผิดพลาดในการโหลดข้อมูลทดสอบ', 'error');
    }
}

document.getElementById('historyPart').addEventListener('input', saveData);
