const notepadEditor = document.getElementById('notepad-editor');
const notepadStatus = document.getElementById('notepad-status');
const notepadMetrics = document.getElementById('notepad-metrics');
const fontFamilySelect = document.getElementById('fontFamily');
const fontSizeSelect = document.getElementById('fontSize');
const lineSpacingSelect = document.getElementById('lineSpacing');
const textColorInput = document.getElementById('textColor');
const highlightColorInput = document.getElementById('highlightColor');
const insertImageButton = document.getElementById('insertImageBtn');
const insertImageInput = document.getElementById('insertImageInput');
const undoButton = document.getElementById('undoBtn');
const redoButton = document.getElementById('redoBtn');
const exportFormatSelect = document.getElementById('exportFormat');
const exportButton = document.getElementById('exportBtn');
let notepadSaveTimeout;
let currentFontSize = 16;
let currentFontFamily = 'Source Serif 4';
let currentLineHeight = 1.6;
let savedSelectionRange = null;

const canvas = document.getElementById('whiteboardCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');
const brushSizeValue = document.getElementById('brushSizeValue');
const whiteboardStatus = document.getElementById('whiteboard-status');

const compilerLanguageSelect = document.getElementById('compilerLanguage');
const compilerFrame = document.getElementById('oneCompilerFrame');
const defaultCompilerLanguage = 'python';
const compilerLanguageMap = {
    javascript: 'javascript',
    python: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    csharp: 'csharp',
    ruby: 'ruby',
    go: 'go',
    php: 'php',
    kotlin: 'kotlin',
    swift: 'swift',
    bash: 'bash',
    html: 'html'
};

let isDrawing = false;
let isEraser = false;
let lastX = 0;
let lastY = 0;

function loadNotepad() {
    if (!notepadEditor) {
        return;
    }

    const savedContent = localStorage.getItem('notepad-content');
    const savedFontSize = localStorage.getItem('notepad-font-size');
    const savedFontFamily = localStorage.getItem('notepad-font-family');
    const savedLineHeight = localStorage.getItem('notepad-line-height');

    if (savedContent) {
        if (/<[a-z][\s\S]*>/i.test(savedContent)) {
            notepadEditor.innerHTML = savedContent;
        } else {
            notepadEditor.textContent = savedContent;
        }
    }

    if (savedFontSize) {
        const parsedSize = parseInt(savedFontSize, 10);
        if (!Number.isNaN(parsedSize)) {
            currentFontSize = parsedSize;
        }
    }

    if (savedFontFamily) {
        currentFontFamily = savedFontFamily;
    }

    if (savedLineHeight) {
        const parsedLineHeight = parseFloat(savedLineHeight);
        if (!Number.isNaN(parsedLineHeight)) {
            currentLineHeight = parsedLineHeight;
        }
    }

    applyEditorStyle();
    syncToolbarSelections();
    updateNotepadMetrics();
}

function saveNotepad() {
    if (!notepadEditor) {
        return;
    }

    localStorage.setItem('notepad-content', notepadEditor.innerHTML);
    localStorage.setItem('notepad-font-size', currentFontSize);
    localStorage.setItem('notepad-font-family', currentFontFamily);
    localStorage.setItem('notepad-line-height', currentLineHeight);

    if (notepadStatus) {
        notepadStatus.textContent = 'Saved ✓';
        notepadStatus.classList.add('saved');

        setTimeout(() => {
            if (!notepadStatus) {
                return;
            }
            notepadStatus.textContent = 'Auto-save enabled';
            notepadStatus.classList.remove('saved');
        }, 2000);
    }
}

if (notepadEditor) {
    notepadEditor.addEventListener('input', () => {
        if (notepadStatus) {
            notepadStatus.textContent = 'Saving...';
            notepadStatus.classList.remove('saved');
        }

        normalizeNotepadImages();
        updateNotepadMetrics();

        clearTimeout(notepadSaveTimeout);
        notepadSaveTimeout = setTimeout(() => {
            saveNotepad();
        }, 1000);
    });

    ['mouseup', 'keyup', 'mouseleave'].forEach(eventName => {
        notepadEditor.addEventListener(eventName, () => {
            saveSelection();
        });
    });

    notepadEditor.addEventListener('paste', () => {
        setTimeout(() => {
            normalizeNotepadImages();
            updateNotepadMetrics();
        }, 0);
    });
}

function clearNotepad() {
    if (!notepadEditor) {
        return;
    }

    if (confirm('Are you sure you want to clear all notes?')) {
        notepadEditor.innerHTML = '';
        updateNotepadMetrics();
        saveNotepad();
    }
}

function downloadNotepad(format = 'html') {
    if (!notepadEditor) {
        return;
    }

    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === 'txt') {
        const text = buildPlainTextExport();
        triggerDownload(new Blob([text], { type: 'text/plain' }), `notepad_${timestamp}.txt`);
        return;
    }

    if (format === 'rtf') {
        const rtf = buildRtfExport(notepadEditor.innerText);
        triggerDownload(new Blob([rtf], { type: 'application/rtf' }), `notepad_${timestamp}.rtf`);
        return;
    }

    if (format === 'pdf') {
        openPrintWindow(buildNotepadExport());
        return;
    }

    const html = buildNotepadExport();
    triggerDownload(new Blob([html], { type: 'text/html' }), `notepad_${timestamp}.html`);
}

function copyNotepad() {
    if (!notepadEditor) {
        return;
    }

    const text = notepadEditor.innerText;

    const onSuccess = () => {
        if (notepadStatus) {
            notepadStatus.textContent = 'Copied to clipboard ✓';
            notepadStatus.classList.add('saved');
            setTimeout(() => {
                if (!notepadStatus) {
                    return;
                }
                notepadStatus.textContent = 'Auto-save enabled';
                notepadStatus.classList.remove('saved');
            }, 2000);
        }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
            fallbackCopy(text);
            onSuccess();
        });
    } else {
        fallbackCopy(text);
        onSuccess();
    }
}

function applyEditorStyle() {
    if (!notepadEditor) {
        return;
    }

    notepadEditor.style.fontSize = currentFontSize + 'px';
    notepadEditor.style.fontFamily = currentFontFamily;
    notepadEditor.style.lineHeight = currentLineHeight;
}

function syncToolbarSelections() {
    if (fontFamilySelect) {
        fontFamilySelect.value = currentFontFamily;
    }
    if (fontSizeSelect) {
        fontSizeSelect.value = String(currentFontSize);
    }
    if (lineSpacingSelect) {
        lineSpacingSelect.value = String(currentLineHeight);
    }
}

function updateNotepadMetrics() {
    if (!notepadEditor || !notepadMetrics) {
        return;
    }

    const text = notepadEditor.innerText.trim();
    const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const charCount = text.replace(/\s/g, '').length;
    const pageCount = Math.max(1, Math.ceil(wordCount / 500));

    notepadMetrics.textContent = `Words: ${wordCount} | Characters: ${charCount} | Page ${pageCount}`;
}

function saveSelection() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        savedSelectionRange = selection.getRangeAt(0);
    }
}

function restoreSelection() {
    const selection = window.getSelection();
    if (!selection || !savedSelectionRange) {
        return;
    }
    selection.removeAllRanges();
    selection.addRange(savedSelectionRange);
}

function runEditorCommand(command, value = null) {
    if (!notepadEditor) {
        return;
    }
    notepadEditor.focus();
    restoreSelection();
    document.execCommand(command, false, value);
    saveSelection();
    updateNotepadMetrics();
}

function applyHighlight(color) {
    try {
        runEditorCommand('hiliteColor', color);
    } catch (error) {
        runEditorCommand('backColor', color);
    }
}

function bindNotepadToolbar() {
    if (!notepadEditor) {
        return;
    }

    document.execCommand('styleWithCSS', false, true);

    document.querySelectorAll('.notepad-toolbar [data-command]').forEach(button => {
        button.addEventListener('click', () => {
            runEditorCommand(button.dataset.command);
        });
    });

    if (fontFamilySelect) {
        fontFamilySelect.addEventListener('change', () => {
            currentFontFamily = fontFamilySelect.value;
            applyEditorStyle();
            saveNotepad();
        });
    }

    if (fontSizeSelect) {
        fontSizeSelect.addEventListener('change', () => {
            const nextSize = parseInt(fontSizeSelect.value, 10);
            if (!Number.isNaN(nextSize)) {
                currentFontSize = nextSize;
                applyEditorStyle();
                saveNotepad();
            }
        });
    }

    if (lineSpacingSelect) {
        lineSpacingSelect.addEventListener('change', () => {
            const nextLineHeight = parseFloat(lineSpacingSelect.value);
            if (!Number.isNaN(nextLineHeight)) {
                currentLineHeight = nextLineHeight;
                applyEditorStyle();
                saveNotepad();
            }
        });
    }

    if (textColorInput) {
        textColorInput.addEventListener('input', () => {
            runEditorCommand('foreColor', textColorInput.value);
        });
    }

    if (highlightColorInput) {
        highlightColorInput.addEventListener('input', () => {
            applyHighlight(highlightColorInput.value);
        });
    }

    if (undoButton) {
        undoButton.addEventListener('click', () => {
            runEditorCommand('undo');
        });
    }

    if (redoButton) {
        redoButton.addEventListener('click', () => {
            runEditorCommand('redo');
        });
    }

    if (insertImageButton && insertImageInput) {
        insertImageButton.addEventListener('click', () => {
            insertImageInput.click();
        });

        insertImageInput.addEventListener('change', (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) {
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                runEditorCommand('insertImage', reader.result);
                setTimeout(() => {
                    normalizeNotepadImages();
                }, 0);
                insertImageInput.value = '';
            };
            reader.readAsDataURL(file);
        });
    }

    if (exportButton) {
        exportButton.addEventListener('click', () => {
            const format = exportFormatSelect ? exportFormatSelect.value : 'html';
            downloadNotepad(format);
        });
    }
}

function normalizeNotepadImages() {
    if (!notepadEditor) {
        return;
    }

    const images = Array.from(notepadEditor.querySelectorAll('img'));
    images.forEach(img => {
        if (img.closest('.image-resize-box')) {
            return;
        }

        const wrapper = document.createElement('span');
        wrapper.className = 'image-resize-box';
        wrapper.contentEditable = 'false';

        const widthStyle = img.style.width || (img.getAttribute('width') ? `${img.getAttribute('width')}px` : null);
        wrapper.style.width = widthStyle || '320px';

        img.removeAttribute('width');
        img.removeAttribute('height');

        img.parentNode.insertBefore(wrapper, img);
        wrapper.appendChild(img);
    });
}

function buildNotepadExport() {
    const content = notepadEditor ? notepadEditor.innerHTML : '';
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Notepad Export</title>
</head>
<body style="font-family: ${currentFontFamily}; font-size: ${currentFontSize}px; line-height: ${currentLineHeight}; color: #111827;">
${content}
</body>
</html>`;
}

function buildPlainTextExport() {
    if (!notepadEditor) {
        return '';
    }

    const clone = notepadEditor.cloneNode(true);
    const rawText = serializeNodeToText(clone, 0);
    const normalized = rawText.replace(/\n{3,}/g, '\n\n').trim() + '\n';
    return normalized.replace(/\n/g, '\r\n');
}

function serializeNodeToText(node, depth) {
    if (!node) {
        return '';
    }

    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
    }

    const tag = node.tagName.toLowerCase();

    if (tag === 'br') {
        return '\n';
    }

    if (tag === 'ol' || tag === 'ul') {
        return '\n' + serializeListToText(node, depth, tag);
    }

    if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article') {
        const content = serializeChildrenToText(node, depth).trim();
        return content ? `${content}\n` : '';
    }

    return serializeChildrenToText(node, depth);
}

function serializeChildrenToText(node, depth) {
    return Array.from(node.childNodes)
        .map(child => serializeNodeToText(child, depth))
        .join('');
}

function needsLeadingNewline(node) {
    let sibling = node.previousSibling;
    while (sibling) {
        if (sibling.nodeType === Node.TEXT_NODE) {
            if ((sibling.textContent || '').trim().length > 0) {
                return true;
            }
        } else if (sibling.nodeType === Node.ELEMENT_NODE) {
            const tag = sibling.tagName.toLowerCase();
            if (tag !== 'br') {
                return true;
            }
        }
        sibling = sibling.previousSibling;
    }
    return false;
}

function serializeListToText(listNode, depth, tag) {
    const items = Array.from(listNode.children).filter(child => child.tagName && child.tagName.toLowerCase() === 'li');
    const lines = [];

    items.forEach((item, index) => {
        const prefix = tag === 'ol' ? `${index + 1}. ` : '- ';
        const lineText = serializeListItemText(item, depth).trim();
        const indent = '  '.repeat(depth);
        lines.push(`${indent}${prefix}${lineText}`.trimEnd());

        const nestedLists = Array.from(item.children).filter(child => {
            const childTag = child.tagName ? child.tagName.toLowerCase() : '';
            return childTag === 'ol' || childTag === 'ul';
        });

        nestedLists.forEach(nested => {
            lines.push(serializeListToText(nested, depth + 1, nested.tagName.toLowerCase()).trimEnd());
        });
    });

    return lines.filter(Boolean).join('\n') + '\n';
}

function serializeListItemText(item, depth) {
    const parts = Array.from(item.childNodes)
        .filter(child => {
            if (child.nodeType !== Node.ELEMENT_NODE) {
                return true;
            }
            const tag = child.tagName.toLowerCase();
            return tag !== 'ol' && tag !== 'ul';
        })
        .map(child => serializeNodeToText(child, depth))
        .join('');

    return parts.replace(/\s+/g, ' ').trim();
}

function buildRtfExport(text) {
    const sanitized = text
        .replace(/\\/g, '\\\\')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\r?\n/g, '\\par\n');

    return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 ${currentFontFamily};}}
\\fs${Math.round(currentFontSize * 2)}
${sanitized}
}`;
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

function openPrintWindow(html) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Popup blocked. Please allow popups to export PDF.');
        return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

function loadWhiteboard() {
    if (!ctx || !canvas) {
        return;
    }

    const savedCanvas = localStorage.getItem('whiteboard-canvas');
    if (savedCanvas) {
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = savedCanvas;
    }
}

function saveWhiteboard() {
    if (!ctx || !canvas) {
        return;
    }

    localStorage.setItem('whiteboard-canvas', canvas.toDataURL());

    if (whiteboardStatus) {
        whiteboardStatus.textContent = 'Saved ✓';
        whiteboardStatus.classList.add('saved');

        setTimeout(() => {
            if (!whiteboardStatus) {
                return;
            }
            whiteboardStatus.textContent = 'Auto-save enabled';
            whiteboardStatus.classList.remove('saved');
        }, 2000);
    }
}

if (brushSize && brushSizeValue) {
    brushSizeValue.textContent = brushSize.value;
    brushSize.addEventListener('input', () => {
        brushSizeValue.textContent = brushSize.value;
    });
}

function startDrawing(e) {
    if (!ctx || !canvas) {
        return;
    }

    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
    const clientY = e.clientY ?? (e.touches ? e.touches[0].clientY : 0);
    lastX = clientX - rect.left;
    lastY = clientY - rect.top;
}

function draw(e) {
    if (!isDrawing || !ctx || !canvas) {
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : lastX);
    const clientY = e.clientY ?? (e.touches ? e.touches[0].clientY : lastY);
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = isEraser ? '#ffffff' : (colorPicker ? colorPicker.value : '#000000');
    ctx.lineWidth = brushSize ? brushSize.value : 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastX = x;
    lastY = y;
}

function stopDrawing() {
    if (!isDrawing) {
        return;
    }

    isDrawing = false;
    saveWhiteboard();
}

if (canvas) {
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startDrawing(e);
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        draw(e);
    });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        stopDrawing();
    });
}

function clearWhiteboard() {
    if (!ctx || !canvas) {
        return;
    }

    if (confirm('Are you sure you want to clear the canvas?')) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        saveWhiteboard();
    }
}

function downloadWhiteboard() {
    if (!canvas) {
        return;
    }

    const url = canvas.toDataURL('image/png');
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'whiteboard_' + new Date().toISOString().slice(0, 10) + '.png';
    anchor.click();
}

function toggleEraser() {
    if (!canvas) {
        return;
    }

    isEraser = !isEraser;
    const eraserText = document.getElementById('eraserText');

    if (isEraser) {
        if (eraserText) {
            eraserText.textContent = 'Pen';
        }
        canvas.style.cursor = 'grab';
    } else {
        if (eraserText) {
            eraserText.textContent = 'Eraser';
        }
        canvas.style.cursor = 'crosshair';
    }
}

function initCompilerEmbed() {
    if (!compilerFrame) {
        return;
    }

    const storedLanguage = localStorage.getItem('compiler-language');
    const initialLanguage = storedLanguage || defaultCompilerLanguage;

    if (compilerLanguageSelect) {
        const hasStored = Array.from(compilerLanguageSelect.options).some(option => option.value === initialLanguage);
        compilerLanguageSelect.value = hasStored ? initialLanguage : defaultCompilerLanguage;

        compilerLanguageSelect.addEventListener('change', () => {
            const newLanguage = compilerLanguageSelect.value;
            localStorage.setItem('compiler-language', newLanguage);
            updateCompilerEmbed(newLanguage);
        });
    }

    updateCompilerEmbed(compilerLanguageSelect ? compilerLanguageSelect.value : initialLanguage);
}

function updateCompilerEmbed(language) {
    if (!compilerFrame) {
        return;
    }

    const slug = compilerLanguageMap[language] || compilerLanguageMap[defaultCompilerLanguage];
    const params = new URLSearchParams({ theme: 'dark', hideTitle: 'true' });
    compilerFrame.src = 'https://onecompiler.com/embed/' + slug + '?' + params.toString();

}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
}

function switchTab(button, tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));

    if (button) {
        button.classList.add('active');
    }

    const panel = document.getElementById(tab + '-content');
    if (panel) {
        panel.classList.add('active');
    }

    if (tab === 'code' && compilerFrame && !compilerFrame.src) {
        const language = compilerLanguageSelect ? compilerLanguageSelect.value : defaultCompilerLanguage;
        updateCompilerEmbed(language);
    }
}

window.addEventListener('load', () => {
    loadNotepad();
    normalizeNotepadImages();
    bindNotepadToolbar();
    loadWhiteboard();
    initCompilerEmbed();
});

window.addEventListener('beforeunload', () => {
    saveNotepad();
    saveWhiteboard();
});
