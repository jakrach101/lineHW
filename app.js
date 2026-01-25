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
    `💊 ยาปัจจุบัน (ปรับยาล่าสุด ...)`,
    `• ...`
].join('\n');

const blankTemplate = defaultHeader;
const defaultHistory = ``;

const FORM_STORAGE_KEY = 'patientLog_formState';
const ADVANCED_MODE_STORAGE_KEY = 'patientLog_advancedMode';
const MEDS_STORE_KEY = 'patientLog_medsStore';
const MEDS_STORE_VERSION = 1;
const FORM_TEXT_IDS = [
    'pFName', 'pAge', 'pDx', 'pIndication', 'pAdmitDate', 'pAllergy', 'pNote', 'pMedsCont', 'medsUpdateDate',
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
    copyAdmitMedsToHeader,
    saveAdmissionOrders,
    toggleAdmissionNoteDetails,
    toggleAdmissionPlanDetails,
    toggleHistoryLock,
    openHistoryReport,
    toggleHistory,
    openClearFormConfirmation,
    openTimePicker,
    openBpModal,
    toggleDtxHi,
    setDtxType,
    openLabModal,
    openPsychModal,
    setAssessmentStatus,
    openMedsHistoryModal,
    openMedsChangeModal,
    toggleMedsCheckFromRow,
    generateLog,
    copyToClipboard,
    shareToLine,
    closeImportModal,
    handleImportPrimaryAction,
    setReportView,
    closeReportModal,
    copyReportToClipboard,
    switchMedsTab,
    addMedsNewRow,
    undoMedsChanges,
    redoMedsChanges,
    closeMedsChangeModalDiscard,
    saveMedsChanges,
    closeConfirmation,
    executeNewCase,
    executeClearForm,
    confirmSafetyCheck,
    cancelSafetyCheck,
    closeOnboarding,
    closeBpModal,
    addBpRow,
    saveBpReadings,
    closeLabModal,
    clearLabInputs,
    addLabsToOExtra,
    closePsychModal,
    clearPsychInputs,
    addPsychToOExtra,
    closeCopyModal,
    closeCopyModalOverlay,
    closeAdmissionNoteViewModal,
    closeAdmissionOrdersViewModal,
    applyDateSelection,
    filterMedsChangeList,
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

// Initialize placeholders on page load
document.addEventListener('DOMContentLoaded', () => {
    // Add expandable placeholder for inputS only
    setExpandablePlaceholder('inputS', 'อาการ...', 'อาการที่คนไข้บอกขณะนี้ หรือ Notify Ward เช่นรู้สึกตัวดี, บ่นปวดแผล');
    initAutoResizeTextarea('inputS');
    initAutoResizeTextarea('inputO_Extra');
    initAutoResizeTextarea('inputAP');
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
            if (SENSITIVE_FIELDS.includes(id)) {
                data.values[id + '_hash'] = simpleHash(readFormValue(el));
                data.values[id] = '[REDACTED]';
            } else {
                data.values[id] = readFormValue(el);
            }
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
                const value = data.values[id];
                if (value !== '[REDACTED]') {
                    writeFormValue(el, value);
                }
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
    const medsLineMatch = source.match(/^\s*💊\s*(?:ยาปัจจุบัน|ยาที่ใช้ปัจจุบัน|ยาที่ใช้ที่ใช้ปัจจุบัน).*$/m);
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

// Common medication patterns for auto-complete
const COMMON_MEDICATIONS = [
    'Amlodipine 5mg 1x1',
    'Metformin 500mg 1x3',
    'Omeprazole 20mg 1x1',
    'Aspirin 81mg 1x1',
    'Losartan 50mg 1x1',
    'Atorvastatin 20mg 1x1',
    'Furosemide 40mg 1x1',
    'Carvedilol 6.25mg 1x2',
    'Insulin glargine 10u 1x1',
    'Clopidogrel 75mg 1x1'
];

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

    if (!warnings || warnings.length === 0) return;

    const warningDiv = document.createElement('div');
    warningDiv.id = 'medsValidationWarning';
    warningDiv.className = 'mt-2 bg-amber-50 border border-amber-200 border-l-4 border-l-amber-600 text-amber-900 rounded-lg px-3 py-2 text-sm';
    warningDiv.innerHTML = `
        <div class="flex items-start gap-2">
            <i class="fas fa-exclamation-triangle mt-0.5"></i>
            <div>
                <p class="font-bold">คำเตือน:</p>
                <ul class="list-disc list-inside mt-1">
                    ${warnings.map(w => `<li>${w}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;

    // Warning div removed - no longer needed
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

function parseCurrentMedsLines(sourceText) {
    const raw = normalizeLineBreaks(typeof sourceText === 'string' ? sourceText : getMedsContent());
    return raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/^[•\-]\s*/, '').trim())
        .filter((line) => line && line !== '...' && !line.includes('ยังไม่มีรายการยา'));
}

function normalizeMedsDisplayText(text) {
    const lines = normalizeLineBreaks(String(text || '').replace(/\u00a0/g, ' '))
        .split('\n');
    const normalized = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        if (trimmed === '...' || trimmed.includes('ยังไม่มีรายการยา')) return trimmed;
        if (/^[•\-]\s*/.test(trimmed)) {
            const rest = trimmed.replace(/^[•\-]\s*/, '').trim();
            return rest ? `• ${rest}` : '•';
        }
        return `• ${trimmed}`;
    });
    return normalized.join('\n');
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
    const cleaned = (line || '').replace(/^[\s•\-\*]+/g, '').trim();
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
        if (!/^\s*•\s*ปรับยา:/i.test(line)) return true;
        return !removeSet.has(normalized);
    });
    plan.value = filtered.join('\n').trimEnd();
    resizeTextareaToContent(plan);
}

function applyMedsChangesToPlan(edits, previousEdits) {
    const plan = document.getElementById('inputAP');
    if (!plan) return;
    
    // Remove ALL "ปรับยา:" lines from plan first
    const baseLines = (plan.value || '')
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => line.trim() !== '')
        .filter((line) => !/^\s*•\s*ปรับยา:/i.test(line));
    
    // Add new medication changes
    const additions = (edits || [])
        .map((item) => normalizeMedsChangedLine(item.updated))
        .filter(Boolean)
        .map((line) => `• ปรับยา: ${line}`);
    
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
        const normalized = trimmed.replace(/^[•\-]\s*/, '').trim();
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
        const prefixMatch = originalLine.match(/^(\s*[•\-]\s*)/);
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

function updateMedsEditRowState(row, input, status) {
    const original = row.dataset.medOriginal || '';
    const current = (input.value || '').trim();
    const isChanged = current && current !== original;
    row.classList.toggle('meds-edit-changed', isChanged);
    if (status) status.classList.toggle('hidden', !isChanged);
}

function enableMedsEdit(row, input) {
    if (!row || !input || !input.readOnly) return;
    input.readOnly = false;
    row.classList.add('meds-edit-active');
    input.focus();
    if (typeof input.select === 'function') input.select();
}

function createMedsEditRow({ index, value, originalValue, labelText, isNew = false }) {
    const row = document.createElement('div');
    row.className = 'meds-edit-row';
    row.dataset.medIndex = String(index);
    row.dataset.medOriginal = originalValue;
    if (isNew) row.dataset.medNew = 'true';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'meds-edit-input';
    input.value = value;
    input.readOnly = true;
    input.setAttribute('aria-label', isNew ? 'เพิ่มยาใหม่' : `แก้ไขยา: ${labelText || value}`);

    const status = document.createElement('span');
    status.className = 'meds-edit-status hidden';
    status.textContent = isNew ? 'ยาใหม่' : 'แก้แล้ว';

    // Action buttons container
    const actions = document.createElement('div');
    actions.className = 'meds-edit-actions flex gap-1 mr-2';

    // Increase button (↑)
    const increaseBtn = document.createElement('button');
    increaseBtn.type = 'button';
    increaseBtn.className = 'meds-action-btn meds-action-increase w-8 h-8 rounded flex items-center justify-center bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100';
    increaseBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    increaseBtn.title = 'เพิ่มขนาดยา';
    increaseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyMedsAction(row, 'increase');
    });

    // Decrease button (↓)
    const decreaseBtn = document.createElement('button');
    decreaseBtn.type = 'button';
    decreaseBtn.className = 'meds-action-btn meds-action-decrease w-8 h-8 rounded flex items-center justify-center bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100';
    decreaseBtn.innerHTML = '<i class="fas fa-arrow-down"></i>';
    decreaseBtn.title = 'ลดขนาดยา';
    decreaseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyMedsAction(row, 'decrease');
    });

    // Stop button (X)
    const stopBtn = document.createElement('button');
    stopBtn.type = 'button';
    stopBtn.className = 'meds-action-btn meds-action-stop w-8 h-8 rounded flex items-center justify-center bg-red-50 text-red-800 border border-red-200 hover:bg-red-100';
    stopBtn.innerHTML = '<i class="fas fa-times"></i>';
    stopBtn.title = 'หยุดยา';
    stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyMedsAction(row, 'stop');
    });

    // Change button (🔄)
    const changeBtn = document.createElement('button');
    changeBtn.type = 'button';
    changeBtn.className = 'meds-action-btn meds-action-change w-8 h-8 rounded flex items-center justify-center bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100';
    changeBtn.innerHTML = '<i class="fas fa-exchange-alt"></i>';
    changeBtn.title = 'เปลี่ยนยา';
    changeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        enableMedsEdit(row, input);
    });

    actions.appendChild(increaseBtn);
    actions.appendChild(decreaseBtn);
    actions.appendChild(stopBtn);
    actions.appendChild(changeBtn);

    row.appendChild(actions);
    row.appendChild(input);
    row.appendChild(status);

    row.addEventListener('click', () => enableMedsEdit(row, input));
    input.addEventListener('click', (event) => {
        if (input.readOnly) {
            event.preventDefault();
            enableMedsEdit(row, input);
        }
    });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && input.readOnly) {
            event.preventDefault();
            enableMedsEdit(row, input);
        }
    });
    input.addEventListener('input', () => {
        const detectedAction = detectActionFromText(input.value);
        const status = row.querySelector('.meds-edit-status');
        
        if (detectedAction) {
            status.classList.remove('hidden');
            status.textContent = getActionLabel(detectedAction);
        }
        
        updateMedsEditRowState(row, input, status);
    });
    input.addEventListener('blur', () => {
        const trimmed = input.value.trim();
        if (!trimmed) {
            if (row.dataset.medNew === 'true') {
                row.remove();
                return;
            }
            input.value = originalValue;
        }
        row.classList.remove('meds-edit-active');
        updateMedsEditRowState(row, input, status);
    });

    updateMedsEditRowState(row, input, status);
    return row;
}

function switchMedsTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.meds-tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Remove active state from all buttons
    document.querySelectorAll('.meds-tab-btn').forEach(btn => {
        btn.classList.remove('text-amber-600', 'border-amber-600', 'bg-amber-50');
        btn.classList.add('text-gray-600', 'border-transparent');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(`medsTab-${tabName}`);
    if (selectedTab) {
        selectedTab.classList.remove('hidden');
    }
    
    // Set active state on selected button
    const selectedBtn = document.querySelector(`.meds-tab-btn[data-tab="${tabName}"]`);
    if (selectedBtn) {
        selectedBtn.classList.remove('text-gray-600', 'border-transparent');
        selectedBtn.classList.add('text-amber-600', 'border-amber-600', 'bg-amber-50');
    }
    
    // Populate tab content
    if (tabName === 'history') {
        renderMedsHistoryTab();
    } else if (tabName === 'active') {
        renderMedsActiveTab();
    }
}

function renderMedsHistoryTab() {
    const historyList = document.getElementById('medsHistoryList');
    const emptyMsg = document.getElementById('medsHistoryEmpty');
    if (!historyList) return;
    
    historyList.innerHTML = '';
    
    const allHistory = loadMedsHistoryLog();
    if (!allHistory || allHistory.length === 0) {
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        return;
    }
    
    if (emptyMsg) emptyMsg.classList.add('hidden');
    
    // Group by medication
    const grouped = {};
    allHistory.forEach(entry => {
        const medKey = extractMedKey(entry.medName);
        const groupKey = medKey || (entry.medName || 'unknown');
        if (!grouped[groupKey]) {
            grouped[groupKey] = {
                label: formatMedLabel(entry.medName) || entry.medName || groupKey,
                entries: [],
            };
        }
        grouped[groupKey].entries.push(entry);
    });
    
    // Render each medication's history
    Object.keys(grouped).forEach(groupKey => {
        const group = grouped[groupKey];
        const history = group.entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        const medCard = document.createElement('div');
        medCard.className = 'p-3 bg-gray-50 rounded-lg border border-gray-200';
        
        const medHeader = document.createElement('div');
        medHeader.className = 'font-bold text-gray-800 mb-2';
        medHeader.textContent = group.label || groupKey;
        medCard.appendChild(medHeader);
        
        const historyItems = document.createElement('div');
        historyItems.className = 'space-y-1';
        
        history.slice(0, 10).forEach(entry => {
            const item = document.createElement('div');
            item.className = 'text-xs text-gray-700 flex items-start gap-2';
            
            const date = new Date(entry.timestamp);
            const dateStr = date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' });
            const timeStr = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            
            const actionLabel = getActionLabel(entry.action);
            item.innerHTML = `
                <span class="text-gray-500 whitespace-nowrap">${dateStr} ${timeStr}</span>
                <span class="font-bold text-amber-600">${actionLabel}</span>
                <span>${entry.details}</span>
            `;
            
            historyItems.appendChild(item);
        });
        
        medCard.appendChild(historyItems);
        historyList.appendChild(medCard);
    });
}

function renderMedsActiveTab() {
    const activeList = document.getElementById('medsActiveList');
    const emptyMsg = document.getElementById('medsActiveEmpty');
    if (!activeList) return;
    
    activeList.innerHTML = '';
    
    loadMedsHistoryLog();
    
    // Get all medications and check if they're stopped
    const meds = parseCurrentMedsLines();
    const activeMeds = meds.filter(med => !isMedicationStopped(med));
    
    if (activeMeds.length === 0) {
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        return;
    }
    
    if (emptyMsg) emptyMsg.classList.add('hidden');
    
    activeMeds.forEach(med => {
        const medCard = document.createElement('div');
        medCard.className = 'p-3 bg-green-50 rounded-lg border border-green-200';
        
        const medName = document.createElement('div');
        medName.className = 'font-bold text-gray-800';
        medName.textContent = med;
        medCard.appendChild(medName);
        
        const status = document.createElement('div');
        status.className = 'text-xs text-green-700 mt-1';
        status.innerHTML = '<i class="fas fa-check-circle"></i> ใช้อยู่';
        medCard.appendChild(status);
        
        activeList.appendChild(medCard);
    });
}

function renderMedsHistoryRow(medText) {
    return null; // History now shown in separate tab
}

function applyMedsAction(row, action) {
    const input = row.querySelector('.meds-edit-input');
    const originalValue = row.dataset.medOriginal;
    
    // Check for conflicts: warn if medication is already stopped
    if (action !== 'stop' && isMedicationStopped(originalValue)) {
        showToast(`⚠️ ยานี้ถูกหยุดแล้ว ตรวจสอบประวัติด้านล่าง`, 'warning');
        return;
    }
    
    let newValue = input.value;

    switch (action) {
        case 'increase':
            newValue = `${originalValue} เพิ่ม`;
            break;
        case 'decrease':
            newValue = `${originalValue} ลด`;
            break;
        case 'stop':
            newValue = `${originalValue} หยุด`;
            break;
        case 'change':
            enableMedsEdit(row, input);
            return;
    }

    input.value = newValue;
    input.readOnly = false;
    
    const status = row.querySelector('.meds-edit-status');
    status.classList.remove('hidden');
    status.textContent = getActionLabel(action);
    
    updateMedsEditRowState(row, input, status);
    saveMedsEditToHistory();
}

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
    const cleaned = String(medText || '').replace(/^[•\-\s]+/, '').trim();
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
    const cleaned = String(medText || '').replace(/^[•\-\s]+/, '').trim();
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
    const lowerText = (text || '').toLowerCase();
    
    if (/หยุด|stop|discontinue|dc/i.test(lowerText)) {
        return 'stop';
    } else if (/เพิ่ม|increase|inc|up|↑/i.test(lowerText)) {
        return 'increase';
    } else if (/ลด|decrease|dec|down|↓/i.test(lowerText)) {
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

function buildMedsChangeList() {
    const list = document.getElementById('medsChangeList');
    const empty = document.getElementById('medsChangeEmpty');
    if (!list) return;
    list.innerHTML = '';
    const meds = parseCurrentMedsLines();
    if (!meds.length) {
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');

    const stored = parseMedsChangedData(document.getElementById('medsChangedList')?.value || '');
    const editsByIndex = new Map(stored.map((item) => [item.index, item]));

    meds.forEach((line, index) => {
        const edit = editsByIndex.get(index);
        const value = edit?.updated ? edit.updated : line;
        const originalValue = edit?.original ? edit.original : line;
        const row = createMedsEditRow({
            index,
            value,
            originalValue,
            labelText: line,
            isNew: false,
        });
        list.appendChild(row);
    });
}

function addMedsNewRow() {
    const list = document.getElementById('medsChangeList');
    if (!list) return;
    const meds = parseCurrentMedsLines();
    if (!meds.length) {
        showToast('กรุณากรอกรายการยาในช่อง "รายการยาที่ใช้อยู่" ก่อนดำเนินการ', 'warning');
        return;
    }
    const existingNewRows = list.querySelectorAll('.meds-edit-row[data-med-new="true"]').length;
    const nextIndex = meds.length + existingNewRows;
    const row = createMedsEditRow({
        index: nextIndex,
        value: '',
        originalValue: '',
        labelText: '',
        isNew: true,
    });
    list.appendChild(row);
    const input = row.querySelector('input');
    if (input) enableMedsEdit(row, input);
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function collectMedsChangedEdits() {
    const list = document.getElementById('medsChangeList');
    if (!list) return [];
    const rows = list.querySelectorAll('.meds-edit-row');
    const edits = [];
    rows.forEach((row) => {
        const input = row.querySelector('input');
        const original = row.dataset.medOriginal || '';
        const medIndex = row.dataset.medIndex;
        const index = Number.isFinite(Number(medIndex)) ? Number(medIndex) : null;
        const value = (input?.value || '').trim();
        if (value && value !== original && index !== null) {
            edits.push({ index, original, updated: value });
        }
    });
    return edits;
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
        const normalized = trimmed.replace(/^[•\-]\s*/, '').trim();
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
        const prefixMatch = line.match(/^(\s*[•\-]\s*)/);
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
    const modal = document.getElementById('medsChangeModal');
    if (!modal) return;
    
    // Set modal to review mode
    setMedsModalMode(false);
    
    // Build medication list
    buildMedsChangeList();
    
    // Switch to history tab
    switchMedsTab('history');
    
    // Show modal
    openModal('medsChangeModal', { focusSelector: null });
}

function openMedsChangeModal() {
    const input = document.getElementById('medsChangedList');
    const checkbox = document.getElementById('medsChanged');
    
    if (!input) return;
    
    const meds = parseCurrentMedsLines();
    if (!meds.length) {
        if (checkbox) checkbox.checked = false;
        showToast('กรุณากรอกรายการยาในช่อง "รายการยาที่ใช้อยู่" ก่อนดำเนินการ', 'warning');
        saveFormState();
        return;
    }
    
    // Set modal to edit mode
    setMedsModalMode(true);
    
    medsChangedDraft = input.value || '';
    medsChangedWasChecked = parseMedsChangedData(medsChangedDraft).length > 0;
    buildMedsChangeList();
    
    // Reset to list tab
    switchMedsTab('list');
    
    openModal('medsChangeModal', { focusSelector: '.meds-edit-input' });
}

let medsModalEditMode = false;

function setMedsModalMode(isEditMode) {
    medsModalEditMode = isEditMode;
    
    // Update modal title
    const modalTitle = document.querySelector('#medsChangeModal h2');
    if (modalTitle) {
        modalTitle.innerHTML = isEditMode 
            ? '<i class="fas fa-notes-medical text-amber-600 mr-2"></i>ปรับยา'
            : '<i class="fas fa-eye text-blue-600 mr-2"></i>ประวัติการปรับยา';
    }
    
    // Show/hide tab navigation
    const tabNavigation = document.querySelector('#medsChangeModal .flex.border-b');
    if (tabNavigation) {
        if (isEditMode) {
            tabNavigation.classList.remove('hidden');
        } else {
            tabNavigation.classList.add('hidden');
        }
    }
    
    // Show/hide action buttons and save button
    const actionButtons = document.querySelectorAll('.meds-action-btn');
    const saveButton = document.getElementById('medsSaveButton');
    const batchActions = document.querySelector('#medsChangeModal .flex.flex-wrap.gap-2.mb-3');
    
    if (isEditMode) {
        actionButtons.forEach(btn => btn.classList.remove('hidden'));
        if (saveButton) saveButton.classList.remove('hidden');
        if (batchActions) batchActions.classList.remove('hidden');
    } else {
        actionButtons.forEach(btn => btn.classList.add('hidden'));
        if (saveButton) saveButton.classList.add('hidden');
        if (batchActions) batchActions.classList.add('hidden');
    }
    
    // Make inputs read-only in review mode
    const inputs = document.querySelectorAll('.meds-edit-input');
    inputs.forEach(input => {
        input.readOnly = !isEditMode;
    });
}

function closeMedsChangeModal({ discard = false, resetCheckbox = false } = {}) {
    const input = document.getElementById('medsChangedList');
    const checkbox = document.getElementById('medsChanged');
    if (!input) return;
    if (resetCheckbox && checkbox) {
        if (discard) {
            removeMedsChangesFromPlan(parseMedsChangedData(medsChangedDraft));
        }
        input.value = '';
        checkbox.checked = false;
        markDirty();
        saveFormState();
    } else if (discard) {
        input.value = medsChangedDraft;
        if (checkbox) checkbox.checked = medsChangedWasChecked;
    }
    closeModal('medsChangeModal');
}

function closeMedsChangeModalDiscard() {
    closeMedsChangeModal({ discard: true });
}

// Undo/Redo history for medication changes
let medsEditHistory = [];
let medsEditHistoryIndex = -1;

function saveMedsEditToHistory() {
    const currentEdits = parseMedsChangedData(document.getElementById('medsChangedList')?.value || '');
    medsEditHistory = medsEditHistory.slice(0, medsEditHistoryIndex + 1);
    medsEditHistory.push(JSON.stringify(currentEdits));
    medsEditHistoryIndex = medsEditHistory.length - 1;
}

function undoMedsChanges() {
    if (medsEditHistoryIndex <= 0) {
        showToast('ไม่มีสิ่งที่จะ Undo', 'warning');
        return;
    }
    medsEditHistoryIndex--;
    const previousEdits = JSON.parse(medsEditHistory[medsEditHistoryIndex]);
    const input = document.getElementById('medsChangedList');
    if (input) input.value = JSON.stringify(previousEdits);
    buildMedsChangeList();
    showToast('Undo สำเร็จ', 'info');
}

function redoMedsChanges() {
    if (medsEditHistoryIndex >= medsEditHistory.length - 1) {
        showToast('ไม่มีสิ่งที่จะ Redo', 'warning');
        return;
    }
    medsEditHistoryIndex++;
    const nextEdits = JSON.parse(medsEditHistory[medsEditHistoryIndex]);
    const input = document.getElementById('medsChangedList');
    if (input) input.value = JSON.stringify(nextEdits);
    buildMedsChangeList();
    showToast('Redo สำเร็จ', 'info');
}

function filterMedsChangeList() {
    const searchInput = document.getElementById('medsModalSearchInput');
    const searchTerm = (searchInput?.value || '').toLowerCase();
    const rows = document.querySelectorAll('.meds-edit-row');
    
    rows.forEach(row => {
        const labelText = row.querySelector('.meds-edit-label')?.textContent || '';
        const inputValue = row.querySelector('input')?.value || '';
        const text = `${labelText} ${inputValue}`.toLowerCase();
        
        if (searchTerm && !text.includes(searchTerm)) {
            row.classList.add('hidden');
        } else {
            row.classList.remove('hidden');
        }
    });
}

function saveMedsChanges() {
    const edits = collectMedsChangedEdits();
    const previousEdits = parseMedsChangedData(medsChangedDraft);
    setMedsChangedData(edits);
    const checkbox = document.getElementById('medsChanged');
    if (checkbox) checkbox.checked = edits.length > 0;
    applyMedsChangesToCurrentList(edits, previousEdits);
    applyMedsChangesToPlan(edits, previousEdits);
    const medsVerified = document.getElementById('medsVerified');
    if (medsVerified) medsVerified.checked = false;
    
    // Log medication changes to history (batch)
    if (edits.length > 0) {
        logMedsChangeToHistory(edits);
        
        // Log individual medication actions for tracking
        edits.forEach(edit => {
            const action = detectActionFromText(edit.updated);
            if (action) {
                saveMedsActionToLog(edit.original, action, edit.updated);
            }
        });
    }
    
    closeMedsChangeModal();
    markDirty();
    renderMedsInlineChanges();
    saveFormState();
    if (!edits.length) showToast('ยังไม่มีการปรับยา', 'info');
}

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
    // updateMedsStepIndicator(); // Removed
}

function updateMedsStepIndicator() {
    // Step indicator removed in new UI design
    // This function is kept for compatibility but does nothing
}

const IMPORT_PRIMARY_LABEL_PASTE = 'วางจากคลิปบอร์ด';
const IMPORT_PRIMARY_LABEL_CONFIRM = 'ตกลงนำเข้าข้อมูล';
let importModalInitialized = false;

function openImportModal() {
    const input = document.getElementById('importText');
    if (input) input.value = '';
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
    processImport();
}

function closeImportModal() { closeModal('importModal'); }

function openImportExistingCase() {
    startExistingCase({ skipImportPrompt: true });
    openImportModal();
}

function processImport() {
    const text = normalizeLineBreaks(document.getElementById('importText').value);
    if (!text.trim()) return;
    resetCaseForImport();
    handleFullTextImport(text);
    closeImportModal();
    switchHeaderView('form');
    const historyText = document.getElementById('historyPart')?.value || '';
    applyParsedMedsHistory(parseMedsChangesFromHistoryText(historyText));
    syncMedsStoreFromUI({ source: 'import', rawText: text });
    setHeaderSectionHidden(true, { scroll: true });
    document.getElementById('medsVerified').checked = false;
    updateMedsStatus();
    showToast("นำเข้าข้อมูลเรียบร้อย! กรุณาตรวจสอบยาอีกครั้ง", "warning");
    markDirty();
    saveFormState();
}

function handleFullTextImport(text) {
    const normalizedText = normalizeLineBreaks(text || '');
    const markerRegex = /\n={10,}\n\(ส่วนที่ 2: บันทึกอาการรายวัน\)\n?/m;
    const match = normalizedText.match(markerRegex);

    let newHeader = "";
    let newHistory = "";
    if (match && typeof match.index === 'number') {
        newHeader = normalizedText.slice(0, match.index).trim();
        newHistory = normalizedText.slice(match.index + match[0].length).trim();
    } else {
        const separators = [...normalizedText.matchAll(/^={10,}\s*$/gm)];
        if (separators.length > 1) {
            let chosen = null;
            let fallback = null;
            for (let i = separators.length - 1; i >= 0; i--) {
                const match = separators[i];
                const sepIndex = match.index ?? -1;
                if (sepIndex === -1) continue;
                const after = normalizedText.slice(sepIndex + match[0].length).trim();
                if (!after) continue;
                if (!fallback) fallback = match;
                if (/^\s*🔻/m.test(after)) {
                    chosen = match;
                    break;
                }
            }
            const selected = chosen || fallback;
            if (selected && typeof selected.index === 'number') {
                newHeader = normalizedText.slice(0, selected.index).trim();
                newHistory = normalizedText.slice(selected.index + selected[0].length).trim();
            } else {
                newHeader = normalizedText.trim();
            }
        } else {
            newHeader = normalizedText.trim();
        }
    }

    // AUTOMATIC ALLERGY DETECTION
    // Look for "Allergy" or "แพ้ยา" patterns in the FULL text, not just header
    const allergyMatch = normalizedText.match(/(?:แพ้ยา|Allergy)[\s:]*([^\n]+)/i);
    if (allergyMatch && allergyMatch[1]) {
        const detectedAllergy = allergyMatch[1].trim();
        // Update form field directly to ensure it sticks
        const allergyInput = document.getElementById('pAllergy');
        // Only update if current field is empty or contains "..." (placeholder)
        if (!allergyInput.value || allergyInput.value.includes("...")) {
            allergyInput.value = detectedAllergy;
        }
    }

    document.getElementById('headerPart').value = newHeader;
    const medsDate = extractMedsUpdateDateFromText(newHeader);
    if (medsDate) setMedsUpdateDate(medsDate, { persist: false });
    if (newHistory) document.getElementById('historyPart').value = newHistory;
    const planInput = document.getElementById('inputPlanMx_Admit');
    if (planInput) {
        const importedPlan = extractAdmitPlanFromHistory(newHistory);
        planInput.value = importedPlan || '';
    }
    const admitOrders = extractAdmissionOrdersFromHistory(newHistory);
    const oneDayInput = document.getElementById('inputOneDay_Admit');
    const contInput = document.getElementById('inputCont_Admit');
    if (oneDayInput && admitOrders.oneDay) oneDayInput.value = admitOrders.oneDay;
    if (contInput && admitOrders.continuous) contInput.value = admitOrders.continuous;
    updateAdmissionSummary();
    saveData();
    switchHeaderView('text');
    checkHistoryVisibility();
    saveFormState();
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

    const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const mIndex = parseInt(month) - 1;
    targetInput.value = `${parseInt(day)} ${months[mIndex]} ${yearBE}`;

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
        if (input.tagName === 'SELECT') {
            input.value = '';
        } else {
            input.value = '';
        }
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
    const copyAdmitMedsBtn = document.getElementById('btnCopyAdmitMeds');

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
        if (copyAdmitMedsBtn) copyAdmitMedsBtn.classList.remove('hidden');
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
        if (copyAdmitMedsBtn) copyAdmitMedsBtn.classList.add('hidden');
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
    const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const monthShort = months[today.getMonth()];
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
    
    if (savedHeader === '[REDACTED]' || savedHistory === '[REDACTED]') {
        document.getElementById('headerPart').value = defaultHeader;
        document.getElementById('historyPart').value = defaultHistory;
    } else {
        const normalizedHeader = normalizeHeaderLines(savedHeader);
        document.getElementById('headerPart').value = normalizedHeader;
        if (normalizedHeader !== savedHeader) {
            safeLocalStorageSetItem('patientLog_header', normalizedHeader);
        }
        document.getElementById('historyPart').value = savedHistory;
    }
    checkHistoryVisibility();
}

function saveData() {
    const headerValue = document.getElementById('headerPart').value;
    const historyValue = document.getElementById('historyPart').value;
    
    const headerHash = simpleHash(headerValue);
    const historyHash = simpleHash(historyValue);
    
    safeLocalStorageSetItem('patientLog_header_hash', headerHash);
    safeLocalStorageSetItem('patientLog_history_hash', historyHash);
    safeLocalStorageSetItem('patientLog_header', '[REDACTED]');
    safeLocalStorageSetItem('patientLog_history', '[REDACTED]');
}

function restoreTemplate() {
    if (confirm("ต้องการวางโครงร่างมาตรฐานทับข้อความปัจจุบันหรือไม่?")) {
        document.getElementById('headerPart').value = blankTemplate;
        markDirty();
        saveFormState();
    }
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

    const medsHeaderRegex = /^\s*(?:[•-]\s*)?(?:💊|💉)?\s*(?:ยาปัจจุบัน|ยาที่ใช้ปัจจุบัน|ยาที่ใช้ที่ใช้ปัจจุบัน)/i;
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
        for (let i = 3; i < lines.length; i++) { if (lines[i].startsWith('•') || lines[i].startsWith('-')) { startMedsIndex = i; break; } }
        if (startMedsIndex !== -1) medsText = lines.slice(startMedsIndex).join('\n');
    }
    if (medsText) {
        medsText = medsText
            .split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.includes('อัปเดต') && !l.includes('Update'))
            .filter(l => !/ปรับยาล่าสุด|วันที่ปรับยา/i.test(l))
            .map(l => l.replace(/^[•-]\s*/, ''))
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
    let medsBlock = `💊 ยาปัจจุบัน (ปรับยาล่าสุด ${medsDateLabel})`;
    if (medsCont) {
        const lines = medsCont.split('\n');
        lines.forEach(line => { const cleanLine = line.trim(); if (cleanLine) medsBlock += `\n${cleanLine.startsWith('•') ? cleanLine : '• ' + cleanLine}`; });
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
        if (line.startsWith('🔻 ')) break;
        if (/^\s*(One Day Order|Continuous Order):/i.test(line)) break;
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
    const lines = text.split('\n');
    const entries = [];
    let current = [];
    lines.forEach((line) => {
        if (line.startsWith('🔻 ')) {
            if (current.length) entries.push(current);
            current = [line];
        } else if (current.length) {
            current.push(line);
        }
    });
    if (current.length) entries.push(current);
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

function extractOrderBlockFromEntry(entryLines, label) {
    if (!Array.isArray(entryLines) || !entryLines.length) return '';
    const labelRegex = new RegExp(`^\\s*${label}:\\s*$`, 'i');
    const stopRegex = /^\s*(S|O|A|P):\s*/;
    const stopOrderRegex = /^\s*(One Day Order|Continuous Order):\s*/i;
    let capture = false;
    const lines = [];
    for (let i = 1; i < entryLines.length; i++) {
        const line = entryLines[i];
        if (!capture) {
            if (labelRegex.test(line)) capture = true;
            continue;
        }
        if (stopRegex.test(line) || stopOrderRegex.test(line) || /^\s*🔻\s*/.test(line)) break;
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

    const findBlock = (label) => {
        for (const entry of orderedEntries) {
            const block = extractOrderBlockFromEntry(entry, label);
            if (block) return block;
        }
        return '';
    };

    return {
        oneDay: findBlock('One Day Order'),
        continuous: findBlock('Continuous Order'),
    };
}

function parseHistoryEntryHeader(headerLine) {
    const raw = (headerLine || '').replace(/^🔻\s*/, '').trim();
    const cleaned = raw.replace(/\(แรกรับ\)/g, '').trim();
    const timeMatch = cleaned.match(/(\d{1,2}:\d{2})\s*$/);
    let dateText = cleaned;
    let timeText = '';
    if (timeMatch) {
        timeText = timeMatch[1];
        dateText = cleaned.slice(0, timeMatch.index).trim();
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

function parseMedsChangesFromHistoryText(historyText) {
    const text = normalizeLineBreaks(historyText || '').trim();
    if (!text) return { changes: [], log: [] };
    let entries = splitHistoryEntries(text);
    if (!entries.length) entries = [['', ...text.split('\n')]];

    const changeLineRegex = /^\s*(?:P:\s*)?(?:[•\-]\s*)?ปรับยา[:：]\s*(.+)$/i;
    const patientName = document.getElementById('pFName')?.value || 'Unknown';
    const changes = [];
    const log = [];

    entries.forEach((entry) => {
        const headerLine = entry[0] || '';
        const { dateText, timeText, timestamp } = parseHistoryEntryHeader(headerLine);
        const bodyLines = entry.slice(1);
        const changeLines = bodyLines
            .map((line) => line.replace(/^\s*P:\s*/i, '').trim())
            .map((line) => {
                const match = line.match(changeLineRegex);
                return match ? match[1].trim() : '';
            })
            .filter(Boolean);
        if (!changeLines.length) return;

        const edits = changeLines.map((line, index) => ({
            index,
            original: '',
            updated: line,
        }));
        changes.push({
            timestamp,
            date: dateText || '',
            time: timeText || '',
            edits,
            patientName,
        });
        changeLines.forEach((line) => {
            const action = detectActionFromText(line) || 'change';
            log.push({
                timestamp,
                medName: line,
                action,
                details: line,
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
        'ม.ค.': 0, 'ม.ค': 0,
        'ก.พ.': 1, 'ก.พ': 1,
        'มี.ค.': 2, 'มี.ค': 2,
        'เม.ย.': 3, 'เม.ย': 3,
        'พ.ค.': 4, 'พ.ค': 4,
        'มิ.ย.': 5, 'มิ.ย': 5,
        'ก.ค.': 6, 'ก.ค': 6,
        'ส.ค.': 7, 'ส.ค': 7,
        'ก.ย.': 8, 'ก.ย': 8,
        'ต.ค.': 9, 'ต.ค': 9,
        'พ.ย.': 10, 'พ.ย': 10,
        'ธ.ค.': 11, 'ธ.ค': 11,
    };
    let day;
    let monthIdx;
    let yearToken;
    let match = trimmed.match(/^(\d{1,2})\s+([^\s]+)\s+(\d{2,4})$/);
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
        showHistorySection({ scroll });
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
    
    modal.classList.remove('hidden');
}

function closeAdmissionNoteViewModal() {
    const modal = document.getElementById('admissionNoteViewModal');
    if (modal) modal.classList.add('hidden');
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
    
    modal.classList.remove('hidden');
}

function closeAdmissionOrdersViewModal() {
    const modal = document.getElementById('admissionOrdersViewModal');
    if (modal) modal.classList.add('hidden');
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
    // Open header form and scroll to it
    setHeaderSectionHidden(false, { scroll: true, focusEdit: true });
    showToast('เปิดส่วนแก้ไขข้อมูลคนไข้แล้ว - แก้ไขเสร็จแล้วกด "บันทึกและซ่อน"', 'info');
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
    // Save admission orders and hide the container
    updateAdmissionSummary();
    const admitPlan = document.getElementById('admitPlan_container');
    if (admitPlan) admitPlan.classList.add('hidden');
    
    // Hide admitSection in existing case mode
    const admitSection = document.getElementById('admitSection');
    if (admitSection) admitSection.classList.add('hidden');
    
    showToast('บันทึก Admission Orders เรียบร้อยแล้ว', 'success');
    saveFormState();
}

function checkHistoryVisibility() {
    const history = document.getElementById('historyPart').value.trim();
    const container = document.getElementById('historyContainer');
    const showBtn = document.getElementById('showHistoryBtn');
    if (history === "") { container.classList.add('hidden'); showBtn.classList.remove('hidden'); }
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

function splitHistoryEntries(historyText) {
    const lines = normalizeLineBreaks(historyText || '').split('\n');
    const entries = [];
    let current = [];
    lines.forEach((line) => {
        if (line.startsWith('🔻')) {
            if (current.length) entries.push(current);
            current = [line];
            return;
        }
        if (current.length) current.push(line);
    });
    if (current.length) entries.push(current);
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
        if (/^\s*🔻\s*/.test(line)) break;
        if (/^\s*(={5,}|-{5,})\s*$/.test(line)) break;
        if (!line.trim()) continue;
        sectionLines.push(line.trim());
    }

    return sectionLines.join('\n');
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

    const safe = (value) => (value && value.trim() ? value.trim() : '...');

    return [
        'รายงานสรุปจากประวัติอาการเดิม',
        `ผู้ป่วย: ${safe(nameDisplay)}`,
        `Dx: ${safe(dxCombined)}`,
        `Admit: ${safe(admitRaw)}`,
        `Allergy: ${safe(allergyRaw)}`,
        '',
        `บันทึกล่าสุด: ${safe(headerLine)}`,
        formatReportBlock('S', s),
        formatReportBlock('O', o),
        formatReportBlock('A', a),
        formatReportBlock('P', p),
    ].join('\n');
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
    const match = clean.match(/^(\d{1,2}\s+[^\s]+\s+\d{2,4})(?:\s+(\d{1,2}:\d{2}))?/);
    return {
        headerText: clean,
        dateText: match ? match[1] : '',
        timeText: match ? (match[2] || '') : '',
    };
}

function extractNumericValue(text, pattern) {
    if (!text) return null;
    const match = text.match(pattern);
    if (!match || match[1] === undefined) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
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

    const bt = extractNumericValue(textInline, /\bBT\s*=\s*([0-9]+(?:\.[0-9])?)/i);
    const pr = extractNumericValue(textInline, /\bPR\s*=\s*([0-9]+)/i);
    const rr = extractNumericValue(textInline, /\bRR\s*=\s*([0-9]+)/i);

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

    return {
        bt,
        pr,
        rr,
        bpDisplay,
        bpSys: bpParsed?.sys ?? null,
        bpDia: bpParsed?.dia ?? null,
        spo2,
        dtxRaw,
        dtxValue,
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

function renderSparkline(container, values, color) {
    if (!container) return;
    container.innerHTML = '';
    const width = 120;
    const height = 36;
    const padding = 3;

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

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

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

    const lastPoint = points[points.length - 1];
    if (lastPoint) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(lastPoint.x));
        circle.setAttribute('cy', String(lastPoint.y));
        circle.setAttribute('r', '2.5');
        circle.setAttribute('fill', color);
        svg.appendChild(circle);
    }

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

    metrics.forEach((metric) => {
        const series = timeline
            .map((entry) => entry[metric.valueKey])
            .filter(isFiniteNumber)
            .map((value) => Number(value));
        const lastEntry = findLatestEntry(timeline, (entry) => {
            const displayVal = metric.displayKey ? entry[metric.displayKey] : entry[metric.valueKey];
            return displayVal !== null && displayVal !== undefined && displayVal !== '';
        });
        const lastDisplay = lastEntry
            ? (metric.displayKey ? lastEntry[metric.displayKey] : formatMetricValue(lastEntry[metric.valueKey], metric.key))
            : '-';

        let bpSeries = null;
        let bpDiaSeries = null;
        if (metric.key === 'bp') {
            const bpEntries = timeline.filter((entry) =>
                isFiniteNumber(entry.bpSys) && isFiniteNumber(entry.bpDia)
            );
            bpSeries = bpEntries.map((entry) => Number(entry.bpSys));
            bpDiaSeries = bpEntries.map((entry) => Number(entry.bpDia));
        }

        const card = document.createElement('div');
        card.className = 'report-card';

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between text-xs font-bold';
        header.style.color = metric.color;
        header.innerHTML = `<span>${metric.label}</span><span>${metric.unit}</span>`;

        const value = document.createElement('div');
        value.className = 'text-lg font-bold text-gray-900';
        value.textContent = String(lastDisplay || '-');

        const sparkline = document.createElement('div');
        sparkline.className = 'report-sparkline';
        if (metric.key === 'bp') {
            renderSparklineDual(sparkline, bpSeries, bpDiaSeries, metric.color, '#a5b4fc');
        } else {
            renderSparkline(sparkline, series, metric.color);
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
        card.appendChild(value);
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
    const modal = document.getElementById('reportModal');
    if (output) output.value = report;
    renderReportSummary(timeline);
    renderReportTable(timeline);
    setReportView(timeline.length ? 'summary' : 'text');
    if (modal) modal.classList.remove('hidden');
    setTimeout(() => {
        if (output) output.focus();
    }, 50);
}

function closeReportModal() {
    const modal = document.getElementById('reportModal');
    if (modal) modal.classList.add('hidden');
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

// --- HELPER: Copy Admit Meds to Header ---
function copyAdmitMedsToHeader() {
    const admitMeds = document.getElementById('inputCont_Admit').value.trim();
    if (!admitMeds) {
        showToast("ไม่มีข้อมูลในช่อง Continuous Order ให้คัดลอก กรุณากรอกข้อมูลก่อน", "warning");
        return;
    }

    // Clear old text and set new text immediately (No confirmation)
    setMedsContent(admitMeds, { source: 'admit', rawText: admitMeds });

    // Trigger update to render text view
    updateHeaderFromForm();

    // Reset verification status since meds changed
    document.getElementById('medsVerified').checked = false;
    updateMedsStatus();
    markMedsDirty();

    showToast("อัปเดตรายการยาปัจจุบันเรียบร้อย!");
    markDirty();
    saveFormState();
}

// --- NEW CONFIRMATION SYSTEM (Replaces blocked window.confirm) ---
function openResetConfirmation() {
    document.getElementById('newCaseModal').classList.remove('hidden');
}

function openClearFormConfirmation() {
    document.getElementById('clearFormModal').classList.remove('hidden');
}

function closeConfirmation() {
    document.getElementById('newCaseModal').classList.add('hidden');
    document.getElementById('clearFormModal').classList.add('hidden');
    document.getElementById('safetyCheckModal').classList.add('hidden');
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
        const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        const monthShort = months[today.getMonth()];
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
    
    // Show history container for existing case
    const historyContainer = document.getElementById('historyContainer');
    if (historyContainer) historyContainer.classList.remove('hidden');
    
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
        document.getElementById('safetyCheckModal').classList.remove('hidden');
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
    document.getElementById('safetyCheckModal').classList.add('hidden');
    executeGenerateLog();
}

function cancelSafetyCheck() {
    document.getElementById('safetyCheckModal').classList.add('hidden');
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
    const medsChangedLines = getMedsChangedLines();

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
        const rawP = document.getElementById('inputAP').value.trim();
        const combinedP = [rawP, medsChangedLines.join('\n')].filter(Boolean).join('\n');
        if (combinedP) pFinal = formatPBlock(combinedP);
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
            modal.classList.remove('hidden');
            // Auto close fallback
            setTimeout(() => { if (!modal.classList.contains('hidden')) { /* Optional auto close? No, let them feel successful. */ } }, 3000);
        } else {
            showToast("คัดลอกเรียบร้อย!");
        }
    };

    try { document.execCommand('copy'); onSuccess(); }
    catch (err) { navigator.clipboard.writeText(copyText.value).then(onSuccess); }
}

function closeCopyModal() {
    const modal = document.getElementById('copySuccessModal');
    if (modal) modal.classList.add('hidden');
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
let tipsModeState = 'existing';
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
        headerModeText.textContent = isNew ? 'เคสใหม่' : 'เคสเดิม';
        
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
    const modal = document.getElementById('onboardingModal');
    if (modal) modal.classList.remove('hidden');
}

function closeOnboarding() {
    const modal = document.getElementById('onboardingModal');
    const dontShow = document.getElementById('dontShowOnboarding');
    if (modal) modal.classList.add('hidden');
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
        headerModeText.textContent = isNew ? 'เคสใหม่' : 'เคสเดิม';
        
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
        if (inputOneDay_Admit) inputOneDay_Admit.value = 'Admit ward 5A';
        
        const inputPlanMx_Admit = document.getElementById('inputPlanMx_Admit');
        if (inputPlanMx_Admit) inputPlanMx_Admit.value = '- Admit ward 5A\n- วัดความดัน 4 ครั้ง/วัน\n- วัดน้ำตาลก่อนอาหารและก่อนนอน\n- ดูแลแผลติดเชื้อ\n- ปรึกษาแพทย์หากมีไข้';
        
        // Current Medications
        const medsText = 'Metformin 500 mg 1 tab หลังอาหารเช้า-เย็น\nGliclazide 80 mg 1 tab หลังอาหารเช้า-เย็น\nAmlodipine 5 mg 1 tab เช้า\nEnalapril 5 mg 1 tab เช้า\nAtorvastatin 20 mg 1 tab ก่อนนอน';
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
            inputO_Extra.value = '- HbA1c: 11.2%\n- BUN/Cr: 25/1.2\n- Na/K: 138/4.2\n- WBC: 8,500\n- Hb: 12.5';
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
            inputAP.value = '- ตรวจ HbA1c อีกครั้งใน 3 เดือน\n- คุมน้ำตาลให้อยู่ในเป้า\n- ดูแลแผลติดเชื้อต่อไป\n- นัดตรวจซ้ำพรุ่งนี้เช้า';
            resizeTextareaToContent(inputAP);
        }
        
        // Add medication changes
        const medsChangedData = [
            { original: 'Metformin 500 mg 1 tab หลังอาหารเช้า-เย็น', action: 'increase', new: 'Metformin 500 mg 1 tab หลังอาหารเช้า-เย็น เพิ่ม' },
            { original: 'Gliclazide 80 mg 1 tab หลังอาหารเช้า-เย็น', action: 'decrease', new: 'Gliclazide 80 mg 1 tab หลังอาหารเช้า-เย็น ลด' }
        ];
        const medsChangedList = document.getElementById('medsChangedList');
        if (medsChangedList) medsChangedList.value = JSON.stringify(medsChangedData);
        
        const medsChanged = document.getElementById('medsChanged');
        if (medsChanged) medsChanged.checked = true;
        
        // Add history data
        const historyPart = document.getElementById('historyPart');
        if (historyPart) historyPart.value = '17 ธ.ค. 68 08:00\nS: คนไข้มาพบแพทย์เพราะน้ำตาลสูง หายใจเหนื่อย มีปวดท้อง\nO: T 37.5 P 92 R 22 BP 140/90 O2 98% DTX 180\nA: DM คุมไม่ดี ต้องปรับยา\nP: เพิ่ม Dose insulin ยาคุมน้ำตาล\n\n18 ธ.ค. 68 08:30\nS: อาการดีขึ้น หายใจเหนื่อยน้อยลง\nO: T 36.8 P 88 R 20 BP 135/85 O2 98% DTX 165\nA: อาการดีขึ้น\nP: คุมน้ำตาลต่อไป';
        
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
        if (headerModeText && headerModeText.textContent !== 'เคสเดิม') {
            console.warn('UI Test Failed: headerModeText should show "เคสเดิม"');
            showToast('⚠️ UI Test Failed: Toggle button ควรแสดง "เคสเดิม"', 'warning');
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
