// Safe localStorage wrapper — Edge Tracking Prevention can block storage access
const ls = {
    get: (k, def='') => { try { return localStorage.getItem(k) ?? def; } catch { return def; } },
    json: (k, def=[]) => { try { const v = JSON.parse(ls.get(k)); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : def; } catch { return def; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }
};

let currentPath = '';
let ws = null;
let pendingPasteFile = null;
let draggedItem = null;
let allFiles = [];
let filterQuery = '';
let sortMode = ls.get('sortMode', 'name');
let filterType = ls.get('filterType', 'all');
let viewMode = ls.get('viewMode', 'grid');
let listSortCol = ls.get('listSortCol', 'name');
let listSortDir = ls.get('listSortDir', 'asc');
let selectedFiles = new Set();
let lastSelectedIndex = -1;
let focusedIndex = -1;
let currentEditPath = '';
let uploadQueue = Promise.resolve();
let multiSelectMode = false;
let itemScale = Math.max(80, Math.min(200, parseInt(ls.get('itemScale', '160')) || 160));
let expandedFolderPaths = new Set();
let expandedFolderContents = {};
let colFilters = {};
let colTextFilters = {};
let sidebarShowFiles = ls.get('sidebarShowFiles') === '1';
let sidebarFileChildren = {};
let lightboxImages = [];
let lightboxIndex = 0;
// In-app clipboard for copy/cut/paste — { paths: [...], mode: 'copy'|'cut' }
let clipboard = { paths: [], mode: null };
// Kinetic motion state: diff-based re-render animation + one-shot staggers
let lastRenderPath = null;
let prevRenderPaths = new Set();
let prevRenderMods = new Map();
let restaggerNext = false;
let sidebarAnimated = false;
let lastBreadcrumbPath = null;

// Theme
function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    ls.set('theme', isDark ? 'light' : 'dark');
    updateThemeIcon();
}

function updateThemeIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.getElementById('themeIcon').innerHTML = isDark
        ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
        : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
}

// Initialize theme — dark-mode-first: default to dark unless the user chose light.
const savedTheme = ls.get('theme', 'dark');
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeIcon();

// File type icons
function getFileIcon(name, isDir) {
    if (isDir) {
        return `<svg class="icon-folder" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/>
        </svg>`;
    }

    const ext = name.split('.').pop().toLowerCase();
    const icons = {
        // Images
        png: { icon: 'image', class: 'icon-image' },
        jpg: { icon: 'image', class: 'icon-image' },
        jpeg: { icon: 'image', class: 'icon-image' },
        gif: { icon: 'image', class: 'icon-image' },
        svg: { icon: 'image', class: 'icon-image' },
        webp: { icon: 'image', class: 'icon-image' },
        ico: { icon: 'image', class: 'icon-image' },
        bmp: { icon: 'image', class: 'icon-image' },
        // PDF
        pdf: { icon: 'pdf', class: 'icon-pdf' },
        // Documents
        doc: { icon: 'doc', class: 'icon-doc' },
        docx: { icon: 'doc', class: 'icon-doc' },
        txt: { icon: 'doc', class: 'icon-doc' },
        rtf: { icon: 'doc', class: 'icon-doc' },
        odt: { icon: 'doc', class: 'icon-doc' },
        // Spreadsheets
        xls: { icon: 'sheet', class: 'icon-sheet' },
        xlsx: { icon: 'sheet', class: 'icon-sheet' },
        csv: { icon: 'sheet', class: 'icon-sheet' },
        // Code
        js: { icon: 'code', class: 'icon-code' },
        ts: { icon: 'code', class: 'icon-code' },
        jsx: { icon: 'code', class: 'icon-code' },
        tsx: { icon: 'code', class: 'icon-code' },
        html: { icon: 'code', class: 'icon-code' },
        css: { icon: 'code', class: 'icon-code' },
        json: { icon: 'code', class: 'icon-code' },
        py: { icon: 'code', class: 'icon-code' },
        rs: { icon: 'code', class: 'icon-code' },
        go: { icon: 'code', class: 'icon-code' },
        java: { icon: 'code', class: 'icon-code' },
        c: { icon: 'code', class: 'icon-code' },
        cpp: { icon: 'code', class: 'icon-code' },
        h: { icon: 'code', class: 'icon-code' },
        php: { icon: 'code', class: 'icon-code' },
        rb: { icon: 'code', class: 'icon-code' },
        sh: { icon: 'code', class: 'icon-code' },
        yml: { icon: 'code', class: 'icon-code' },
        yaml: { icon: 'code', class: 'icon-code' },
        xml: { icon: 'code', class: 'icon-code' },
        sql: { icon: 'code', class: 'icon-code' },
        md: { icon: 'code', class: 'icon-code' },
        // Video
        mp4: { icon: 'video', class: 'icon-video' },
        mov: { icon: 'video', class: 'icon-video' },
        avi: { icon: 'video', class: 'icon-video' },
        mkv: { icon: 'video', class: 'icon-video' },
        webm: { icon: 'video', class: 'icon-video' },
        wmv: { icon: 'video', class: 'icon-video' },
        // Audio
        mp3: { icon: 'audio', class: 'icon-audio' },
        wav: { icon: 'audio', class: 'icon-audio' },
        flac: { icon: 'audio', class: 'icon-audio' },
        aac: { icon: 'audio', class: 'icon-audio' },
        ogg: { icon: 'audio', class: 'icon-audio' },
        m4a: { icon: 'audio', class: 'icon-audio' },
        // Archives
        zip: { icon: 'archive', class: 'icon-archive' },
        rar: { icon: 'archive', class: 'icon-archive' },
        '7z': { icon: 'archive', class: 'icon-archive' },
        tar: { icon: 'archive', class: 'icon-archive' },
        gz: { icon: 'archive', class: 'icon-archive' },
    };

    const iconData = icons[ext] || { icon: 'file', class: 'icon-file' };
    const showExt = !icons[ext] && ext.length <= 5;

    const svgPaths = {
        image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
        pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
        doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
        sheet: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="12" y1="9" x2="12" y2="21"/>',
        code: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 12 8 14 10 16"/><polyline points="14 12 16 14 14 16"/>',
        video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
        audio: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
        archive: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
        file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'
    };

    return `<svg class="${iconData.class}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        ${svgPaths[iconData.icon]}
    </svg>${showExt ? `<span class="file-icon-ext">${escapeHtml(ext)}</span>` : ''}`;
}

// Reconnect banner: reflects WS state + browser online/offline, without
// touching the WS reconnect/backoff logic itself.
function showReconnectBanner() {
    document.getElementById('reconnectBanner')?.classList.add('show');
}
function hideReconnectBanner() {
    document.getElementById('reconnectBanner')?.classList.remove('show');
}

// WebSocket
let wsRetry = 0;
let wsHasConnected = false;
const STRUCTURE_ACTIONS = ['folder', 'move', 'delete', 'upload', 'rename', 'copy'];
function connectWS() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}/ws`);

    ws.onopen = () => {
        wsRetry = 0;
        document.getElementById('statusDot').classList.add('connected');
        document.getElementById('statusText').textContent = 'Live';
        hideReconnectBanner();
        if (wsHasConnected) refreshWorkspace();
        wsHasConnected = true;
    };

    ws.onclose = () => {
        
        document.getElementById('statusDot').classList.remove('connected');
        document.getElementById('statusText').textContent = 'Reconnecting...';
        showReconnectBanner();
        // Exponential backoff with jitter (1s → ~30s cap) avoids thundering-herd on restart.
        const delay = Math.min(30000, 1000 * Math.pow(2, wsRetry++)) + Math.random() * 1000;
        setTimeout(connectWS, delay);
    };

    ws.onmessage = (e) => {
        let data;
        try { data = JSON.parse(e.data); } catch { return; }
        scheduleLiveRefresh();
        // Folder structure may have changed — refresh the sidebar tree from the server.
        if (STRUCTURE_ACTIONS.includes(data.action)) scheduleTreeRefresh();
        debouncedLoadSidebarStats();
        const actions = { delete: 'Deleted', upload: 'Added', folder: 'Created', rename: 'Renamed', move: 'Moved', edit: 'Edited', copy: 'Copied' };
        showToast(`${actions[data.action] || 'Updated'}: ${String(data.path).split('/').pop()}`,
                  data.action === 'delete' ? 'error' : 'success');
    };
}

let fileLoadController = null;
let fileLoadVersion = 0;
const scheduleLiveRefresh = debounce(() => {
    if (document.hidden) { needsLiveRefresh = true; return; }
    expandedFolderContents = {};
    sidebarFileChildren = {};
    loadFiles();
}, 180);
const scheduleTreeRefresh = debounce(() => {
    if (document.hidden) { needsLiveRefresh = true; return; }
    loadSidebarTree();
}, 500);
let needsLiveRefresh = false;
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && needsLiveRefresh) { needsLiveRefresh = false; refreshWorkspace(); }
});

async function loadFiles() {
    fileLoadController?.abort();
    const controller = fileLoadController = new AbortController();
    const version = ++fileLoadVersion;
    const path = currentPath;
    const grid = document.getElementById('fileGrid');
    grid.setAttribute('aria-busy', 'true');
    if (lastRenderPath !== path) showSkeleton();
    try {
        const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`, { signal: controller.signal });
        if (!res.ok) throw new Error((await res.text()) || 'Could not load files');
        const files = await res.json();
        if (version !== fileLoadVersion || path !== currentPath) return;
        const unchanged = lastRenderPath === path && files.length === allFiles.length && files.every((f, i) => {
            const previous = allFiles[i];
            return f.name === previous.name && f.is_dir === previous.is_dir && f.size === previous.size && f.modified === previous.modified && f.version === previous.version;
        });
        allFiles = files;
        if (!unchanged) focusedIndex = -1;
        const existing = new Set(files.map(f => path ? path + '/' + f.name : f.name));
        selectedFiles = new Set([...selectedFiles].filter(p => existing.has(p) || document.querySelector(`.file-item--inline-child[data-path="${CSS.escape(p)}"]`)));
        if (!unchanged) renderFiles(allFiles);
        updateBreadcrumb();
        renderSidebar();
        updateWorkspaceHeading();
    } catch (err) {
        if (err.name === 'AbortError' || version !== fileLoadVersion) return;
        if (lastRenderPath !== path) {
            grid.innerHTML = '';
            document.getElementById('emptyState').style.display = 'block';
            document.getElementById('emptyTitle').textContent = 'Unable to load this folder';
            document.getElementById('emptyHint').textContent = 'Use Refresh to try again.';
        }
        showToast(err.message || 'Could not load files', 'error');
    } finally {
        if (version === fileLoadVersion) grid.setAttribute('aria-busy', 'false');
    }
}

function buildInlineChildren(folderPath, depth) {
    const children = expandedFolderContents[folderPath] || [];
    if (!children.length) return '';
    return children.map(child => {
        const childPath = folderPath + '/' + child.name;
        const childEscaped = escapeAttr(childPath);
        const childIsExpanded = child.is_dir && expandedFolderPaths.has(childPath);
        const childDatePart = child.modified ? formatDatePart(child.modified) : '';
        const childTimePart = child.modified ? formatTimePart(child.modified) : '';
        const childFileType = getFileType(child.name, child.is_dir);
        const expandBtn = child.is_dir
            ? `<div class="folder-expand-indicator ${childIsExpanded ? 'open' : ''}" onclick="event.stopPropagation(); toggleFolderInlineExpand('${childEscaped}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>`
            : `<div class="folder-expand-indicator" style="visibility:hidden"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>`;
        let html = `<div class="file-item file-item--inline-child${childIsExpanded ? ' folder-expanded' : ''}" style="--inline-depth:${depth}"
                         data-path="${htmlAttr(childPath)}" data-name="${htmlAttr(child.name)}" data-is-dir="${child.is_dir}" data-mod="${child.modified || 0}"
                         ondblclick="handleItemDblClick(event,'${childEscaped}',${child.is_dir})"
                         onclick="handleItemClick(event,'${childEscaped}',${child.is_dir})"
                         oncontextmenu="showContextMenu(event,'${childEscaped}','${escapeAttr(child.name)}',${child.is_dir})">
                        <div class="file-item-content">
                            <div class="file-icon">${getFileIconHtml(child.name, child.is_dir, childPath)}</div>
                            ${expandBtn}
                            <div class="file-name">${escapeHtml(child.name)}</div>
                            <div class="file-type">${childFileType}</div>
                            <div class="file-meta">${child.is_dir ? '—' : formatSize(child.size)}</div>
                            <div class="file-date-part">${childDatePart}</div>
                            <div class="file-time-part">${childTimePart}</div>
                        </div>
                    </div>`;
        if (child.is_dir && childIsExpanded) {
            html += buildInlineChildren(childPath, depth + 1);
        }
        return html;
    }).join('');
}

function renderFiles(files) {
    const grid = document.getElementById('fileGrid');
    const empty = document.getElementById('emptyState');
    const meta = document.getElementById('navMeta');

    const visible = applyFilters(files);
    meta.textContent = `${visible.length} item${visible.length === 1 ? '' : 's'}`;
    const filtering = filterQuery || filterType !== 'all' || Object.values(colFilters).some(v => v?.size) || Object.values(colTextFilters).some(Boolean);
    document.getElementById('filterSummary').hidden = !filtering;
    document.getElementById('filterSummaryText').textContent = `Showing ${visible.length} of ${files.length} items`;
    document.getElementById('emptyTitle').textContent = filtering ? 'No matching files' : 'This folder is empty';
    document.getElementById('emptyHint').textContent = filtering ? 'Clear filters to see everything in this folder.' : 'Drop files anywhere on the page to fill it up';

    if (visible.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        prevRenderPaths = new Set();
        prevRenderMods = new Map();
        lastRenderPath = currentPath;
        updateSelectionUI();
        return;
    }

    empty.style.display = 'none';

    const sortArrow = `<svg class="sort-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>`;

    const colClass = (col) => `col col-${col}${listSortCol === col ? ' sorted' : ''}${listSortCol === col && listSortDir === 'desc' ? ' desc' : ''}`;

    const filterBtn = (col) => `<button class="col-filter-btn${(colFilters[col] || colTextFilters[col]) ? ' active' : ''}" onclick="event.stopPropagation(); showColFilter(event,'${col}')" title="Filter column" data-tip="Filter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg></button>`;

    const tableHeader = viewMode === 'list' ? `
        <div class="file-table-header">
            <div class="col-icon"></div>
            <div class="${colClass('name')}" onclick="sortByColumn('name')">Name ${sortArrow}${filterBtn('name')}</div>
            <div class="${colClass('type')}" onclick="sortByColumn('type')">Type ${sortArrow}${filterBtn('type')}</div>
            <div class="${colClass('size')}" onclick="sortByColumn('size')">Size ${sortArrow}</div>
            <div class="${colClass('modified')} col-date-part" onclick="sortByColumn('modified')">Date ${sortArrow}${filterBtn('modified')}</div>
            <div class="col col-time-part${listSortCol === 'modified' ? ' sorted' : ''}" onclick="sortByColumn('modified')">Time ${sortArrow}</div>
            <div class="col-actions"></div>
        </div>
        <div class="file-table-body">
    ` : '';

    const tableFooter = viewMode === 'list' ? '</div>' : '';

    grid.className = viewMode === 'list' ? 'file-table' : 'file-grid';
    if (viewMode === 'grid') grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${itemScale}px, 1fr))`;
    else grid.style.gridTemplateColumns = '';

    const rows = visible.map((f, index) => {
        const fullPath = currentPath ? currentPath + '/' + f.name : f.name;
        const escapedPath = escapeAttr(fullPath);
        const escapedName = escapeAttr(f.name);
        const hasThumb = viewMode === 'grid' && !f.is_dir && isImageFile(f.name);
        const fileType = getFileType(f.name, f.is_dir);
        const typeColumn = viewMode === 'list' ? `<div class="file-type">${fileType}</div>` : '';
        const datePart = f.modified ? formatDatePart(f.modified) : '';
        const timePart = f.modified ? formatTimePart(f.modified) : '';
        const dateColumn = viewMode === 'list' ? `<div class="file-date-part">${datePart}</div><div class="file-time-part">${timePart}</div>` : '';

        const expandIndicator = (viewMode === 'list' && f.is_dir) ?
            `<div class="folder-expand-indicator ${expandedFolderPaths.has(fullPath) ? 'open' : ''}" onclick="event.stopPropagation(); toggleFolderInlineExpand('${escapedPath}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>` : '';

        const rowHtml = `
        <div class="file-item${expandedFolderPaths.has(fullPath) ? ' folder-expanded' : ''}"
             data-path="${htmlAttr(fullPath)}"
             data-name="${htmlAttr(f.name)}"
             data-is-dir="${f.is_dir}"
             data-mod="${f.modified || 0}"
             style="animation-delay: ${Math.min(index * 20, 300)}ms"
             draggable="true"
             oncontextmenu="showContextMenu(event, '${escapedPath}', '${escapedName}', ${f.is_dir})"
             ondragstart="handleDragStart(event)"
             ondragend="handleDragEnd(event)"
             ondragover="handleDragOver(event)"
             ondragleave="handleDragLeave(event)"
             ondrop="handleDrop(event)">
            <div class="file-item-content" onclick="handleItemClick(event, '${escapedPath}', ${f.is_dir})" ondblclick="handleItemDblClick(event, '${escapedPath}', ${f.is_dir})">
                <div class="file-icon${hasThumb ? ' has-thumb' : ''}">${getFileIconHtml(f.name, f.is_dir, fullPath, f.version || f.modified, f.size)}</div>
                ${expandIndicator}
                <div class="file-name">${escapeHtml(f.name)}</div>
                ${typeColumn}
                <div class="file-meta">${f.is_dir ? '—' : formatSize(f.size)}</div>
                ${dateColumn}
            </div>
            <div class="file-actions">
                ${f.is_dir ? `
                <button class="file-action-btn" onclick="event.stopPropagation(); downloadZip('${escapedPath}')" data-tip="Download as ZIP" title="Download as ZIP">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                </button>
                ` : ''}
                ${!f.is_dir ? `
                <button class="file-action-btn" onclick="event.stopPropagation(); copyFileUrl('${escapedPath}')" data-tip="Copy link" title="Copy link">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                </button>
                <button class="file-action-btn" onclick="event.stopPropagation(); downloadFile('${escapedPath}')" data-tip="Download" title="Download">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                </button>
                ${isEditableFile(f.name) ? `
                <button class="file-action-btn" onclick="event.stopPropagation(); showEditModal('${escapedPath}')" data-tip="Edit file" title="Edit file">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                </button>
                ` : ''}
                ` : ''}
                <button class="file-action-btn" onclick="event.stopPropagation(); showMoveModal('${escapedPath}')" data-tip="Move" title="Move">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                </button>
                <button class="file-action-btn" onclick="event.stopPropagation(); triggerRename('${escapedPath}', '${escapedName}')" data-tip="Rename" title="Rename">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="file-action-btn delete" onclick="event.stopPropagation(); deleteItem('${escapedPath}')" data-tip="Delete" title="Delete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </div>
    `;

        let result = rowHtml;
        if (viewMode === 'list' && f.is_dir && expandedFolderPaths.has(fullPath)) {
            result += buildInlineChildren(fullPath, 1);
        }
        return result;
    }).join('');

    grid.innerHTML = tableHeader + rows + tableFooter;

    // Diff-based re-render motion: when the same folder re-renders (WS event,
    // upload, rename...), animate only what changed instead of re-staggering all.
    const samePath = lastRenderPath === currentPath && prevRenderPaths.size > 0 && !restaggerNext;
    restaggerNext = false;
    const renderedItems = grid.querySelectorAll('.file-item');
    if (samePath) {
        renderedItems.forEach(el => {
            const p = el.dataset.path;
            if (!prevRenderPaths.has(p)) {
                el.style.animationDelay = '0ms';
                el.classList.add('item-new');       // scale/fade in + accent glow
            } else {
                el.style.animation = 'none';        // no hard-repaint replay
                const prevMod = prevRenderMods.get(p);
                if (prevMod !== undefined && String(prevMod) !== String(el.dataset.mod)) {
                    el.style.animation = '';
                    el.style.animationDelay = '0ms';
                    el.classList.add('item-flash'); // soft highlight for edited items
                }
            }
        });
    }
    prevRenderPaths = new Set();
    prevRenderMods = new Map();
    renderedItems.forEach(el => {
        prevRenderPaths.add(el.dataset.path);
        prevRenderMods.set(el.dataset.path, el.dataset.mod || '');
    });
    lastRenderPath = currentPath;

    // Maintain visual selection state after re-render
    updateSelectionUI();
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'bmp'];
const PDF_EXTENSIONS = ['pdf'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'm4a', 'flac'];
const EDITABLE_EXTENSIONS = ['txt', 'csv', 'py', 'json', 'md', 'rs', 'js', 'ts', 'html', 'css', 'toml', 'yaml', 'yml', 'sql', 'm3u', 'sh', 'go', 'rb', 'php', 'xml'];

function isImageFile(name) {
    const ext = name.split('.').pop().toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
}

function isPdfFile(name) {
    const ext = name.split('.').pop().toLowerCase();
    return PDF_EXTENSIONS.includes(ext);
}

function isVideoFile(name) {
    const ext = name.split('.').pop().toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
}

function isAudioFile(name) {
    const ext = name.split('.').pop().toLowerCase();
    return AUDIO_EXTENSIONS.includes(ext);
}

function isEditableFile(name) {
    const ext = name.split('.').pop().toLowerCase();
    return EDITABLE_EXTENSIONS.includes(ext);
}

// Raster formats the backend can generate a real thumbnail for; everything
// else (SVG, AVIF) keeps loading the full asset via /api/download.
const RASTER_THUMB_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

function getFileIconHtml(name, isDir, fullPath, modified = 0, size = 0) {
    if (!isDir && viewMode === 'grid' && isImageFile(name)) {
        const ext = name.split('.').pop().toLowerCase();
        const thumbUrl = RASTER_THUMB_EXTENSIONS.includes(ext)
            ? `/api/thumb?path=${encodeURIComponent(fullPath)}&v=${modified}-${size}`
            : `/api/download?path=${encodeURIComponent(fullPath)}`;
        const fallbackIcon = getFileIcon(name, false).replace(/"/g, '&quot;');
        return `<img class="file-thumb" src="${thumbUrl}" loading="lazy" decoding="async" alt="" onload="this.classList.add('loaded')" onerror="handleThumbError(this, '${fallbackIcon}')">`;
    }
    return getFileIcon(name, isDir);
}

function handleThumbError(img, fallbackIcon) {
    const container = img.parentElement;
    container.classList.remove('has-thumb');
    container.innerHTML = decodeHtmlEntities(fallbackIcon);
}

function decodeHtmlEntities(str) {
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
}

function getFileCategory(name) {
    const ext = name.split('.').pop().toLowerCase();
    const images = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
    const documents = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'csv', 'ppt', 'pptx'];
    const code = ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'php', 'rb', 'sh', 'yml', 'yaml', 'xml', 'sql', 'md'];
    const media = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];

    if (images.includes(ext)) return 'images';
    if (documents.includes(ext)) return 'documents';
    if (code.includes(ext)) return 'code';
    if (media.includes(ext)) return 'media';
    return 'other';
}

function getFileType(name, isDir) {
    if (isDir) return 'Folder';
    const ext = name.split('.').pop().toLowerCase();
    if (ext === name.toLowerCase()) return 'File';
    return ext.toUpperCase();
}

function applyFilters(files) {
    let filtered = files;
    if (filterQuery) {
        const q = filterQuery.toLowerCase();
        filtered = filtered.filter(f => f.name.toLowerCase().includes(q));
    }

    if (filterType !== 'all') {
        filtered = filtered.filter(f => f.is_dir || getFileCategory(f.name) === filterType);
    }

    // Apply per-column checkbox filters
    Object.entries(colFilters).forEach(([col, vals]) => {
        if (!vals || vals.size === 0) return;
        filtered = filtered.filter(f => {
            let v = '';
            if (col === 'name') v = f.name;
            else if (col === 'type') v = getFileType(f.name, f.is_dir);
            else if (col === 'modified') v = f.modified ? formatDatePart(f.modified) : '';
            return vals.has(v);
        });
    });
    // Apply per-column text (contains) filters
    Object.entries(colTextFilters).forEach(([col, text]) => {
        if (!text) return;
        const lc = text.toLowerCase();
        filtered = filtered.filter(f => {
            let v = '';
            if (col === 'name') v = f.name;
            else if (col === 'type') v = getFileType(f.name, f.is_dir);
            else if (col === 'modified') v = f.modified ? formatDatePart(f.modified) : '';
            return v.toLowerCase().includes(lc);
        });
    });

    const compare = (a, b) => {
        // Folders always first
        if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;

        // Use list sort settings when in list view
        if (viewMode === 'list') {
            const dir = listSortDir === 'asc' ? 1 : -1;
            let result = 0;

            switch (listSortCol) {
                case 'name':
                    result = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
                    break;
                case 'type':
                    result = getFileType(a.name, a.is_dir).localeCompare(getFileType(b.name, b.is_dir));
                    break;
                case 'size':
                    result = (a.size || 0) - (b.size || 0);
                    break;
                case 'modified':
                    result = (a.modified || 0) - (b.modified || 0);
                    break;
            }
            return result * dir;
        }

        // Grid view uses toolbar sort
        if (sortMode === 'size') return (b.size || 0) - (a.size || 0);
        if (sortMode === 'modified') return (b.modified || 0) - (a.modified || 0);
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    };

    return filtered.slice().sort(compare);
}

function sortByColumn(col) {
    if (listSortCol === col) {
        listSortDir = listSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        listSortCol = col;
        listSortDir = 'asc';
    }
    ls.set('listSortCol', listSortCol);
    ls.set('listSortDir', listSortDir);
    restaggerNext = true;
    renderFiles(allFiles);
}

// Selection functions
function updateSelectionUI() {
    const count = selectedFiles.size;
    const bar = document.getElementById('selectionBar');
    const countEl = document.getElementById('selectionCount');

    countEl.textContent = `${count} file${count === 1 ? '' : 's'} selected`;

    if (count > 0) {
        bar.classList.add('show');
    } else {
        bar.classList.remove('show');
    }

    // Update visual selection state on items
    document.querySelectorAll('.file-item').forEach(item => {
        if (selectedFiles.has(item.dataset.path)) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
        if (clipboard.mode === 'cut' && clipboard.paths.includes(item.dataset.path)) {
            item.classList.add('cut-item');
        } else {
            item.classList.remove('cut-item');
        }
    });
}

function clearSelection() {
    selectedFiles.clear();
    lastSelectedIndex = -1;
    updateSelectionUI();
}

function toggleSelection(path) {
    if (selectedFiles.has(path)) {
        selectedFiles.delete(path);
    } else {
        selectedFiles.add(path);
    }
    updateSelectionUI();
}

function selectRange(startIndex, endIndex) {
    const items = document.querySelectorAll('.file-item');
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);

    for (let i = start; i <= end; i++) {
        if (items[i]) {
            selectedFiles.add(items[i].dataset.path);
        }
    }
    updateSelectionUI();
}

function getItemIndex(path) {
    const items = document.querySelectorAll('.file-item');
    for (let i = 0; i < items.length; i++) {
        if (items[i].dataset.path === path) return i;
    }
    return -1;
}

function handleItemClick(e, path, isDir) {
    const isMeta = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;
    const index = getItemIndex(path);

    if (isShift && lastSelectedIndex >= 0) {
        selectRange(lastSelectedIndex, index);
    } else if (isMeta || multiSelectMode) {
        toggleSelection(path);
        lastSelectedIndex = index;
    } else if (isDir && viewMode === 'list' && !multiSelectMode) {
        toggleFolderInlineExpand(path);
    } else if (!isDir) {
        selectedFiles.clear();
        selectedFiles.add(path);
        lastSelectedIndex = index;
        updateSelectionUI();
    }
}

function handleItemDblClick(e, path, isDir) {
    if (isDir) {
        navigate(path);
    } else if (isImageFile(path.split('/').pop())) {
        openLightbox(path);
    } else if (isPdfFile(path.split('/').pop()) || isVideoFile(path.split('/').pop()) || isAudioFile(path.split('/').pop())) {
        openMediaPreview(path);
    } else {
        const url = `/api/download?path=${encodeURIComponent(path)}`;
        const link = document.createElement('a');
        link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }
}

// Drag and drop to folders
function handleDragStart(e) {
    draggedItem = e.target.closest('.file-item');
    draggedItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedItem.dataset.path);
}

function handleDragEnd(e) {
    if (draggedItem) {
        draggedItem.classList.remove('dragging');
        draggedItem = null;
    }
    document.querySelectorAll('.file-item.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDragOver(e) {
    e.preventDefault();
    const target = e.target.closest('.file-item');
    if (target && target.dataset.isDir === 'true' && target !== draggedItem) {
        target.classList.add('drag-over');
        e.dataTransfer.dropEffect = 'move';
    }
}

function handleDragLeave(e) {
    const target = e.target.closest('.file-item');
    if (target) target.classList.remove('drag-over');
}

async function handleDrop(e) {
    e.preventDefault();
    const target = e.target.closest('.file-item');
    if (!target) return;
    target.classList.remove('drag-over');

    if (target.dataset.isDir !== 'true') return;

    const sourcePath = e.dataTransfer.getData('text/plain');
    if (!sourcePath || sourcePath === target.dataset.path) return;

    const destDir = target.dataset.path;

    // If dragged item is part of selection, move all selected files
    if (selectedFiles.has(sourcePath) && selectedFiles.size > 1) {
        let successCount = 0;
        for (const path of selectedFiles) {
            // Don't move target folder into itself
            if (path === destDir) continue;
            const res = await fetch('/api/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, dest_dir: destDir })
            });
            if (res.ok) successCount++;
        }
        clearSelection();
        loadFiles();
        showToast(`Moved ${successCount} item${successCount === 1 ? '' : 's'} to ${target.dataset.name}`);
    } else {
        // Move single file
        const res = await fetch('/api/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: sourcePath, dest_dir: destDir })
        });

        if (res.ok) {
            clearSelection();
            loadFiles();
            showToast(`Moved to ${target.dataset.name}`);
        } else {
            await apiErrorToast(res, 'Move failed');
        }
    }
}

function navigate(path) {
    currentPath = path;
    history.pushState(null, '', '#' + (encodeURIComponent(path) || '/'));
    expandedFolderContents = {};
    expandedFolderPaths.clear();
    document.getElementById('filesSidebar').classList.remove('mobile-open');
    document.getElementById('mobileFoldersBtn').setAttribute('aria-expanded', 'false');
    updateWorkspaceHeading();
    clearSelection();
    loadFiles();
    updateBreadcrumb();
}

async function toggleFolderInlineExpand(path) {
    if (expandedFolderPaths.has(path)) {
        expandedFolderPaths.delete(path);
    } else {
        expandedFolderPaths.add(path);
        if (!expandedFolderContents.hasOwnProperty(path)) {
            try {
                const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
                if (res.ok) expandedFolderContents[path] = await res.json();
                else expandedFolderContents[path] = [];
            } catch { expandedFolderContents[path] = []; }
        }
    }
    renderFiles(allFiles);
}

function updateBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    const parts = currentPath ? currentPath.split('/') : [];

    let html = `<a href="#/" class="breadcrumb-item ${parts.length === 0 ? 'active' : ''}" onclick="event.preventDefault(); navigate('')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        Home
    </a>`;

    let path = '';
    for (let i = 0; i < parts.length; i++) {
        path += (i > 0 ? '/' : '') + parts[i];
        const p = path;
        const isLast = i === parts.length - 1;
        html += `<span class="breadcrumb-sep">/</span>
            <a href="#${encodeURIComponent(p)}" class="breadcrumb-item ${isLast ? 'active' : ''}" onclick="event.preventDefault(); navigate('${escapeAttr(p)}')">${escapeHtml(parts[i])}</a>`;
    }

    bc.innerHTML = html;
    // Animate segments in when the path actually changed (subtle slide-in stagger)
    if (lastBreadcrumbPath !== currentPath) {
        bc.querySelectorAll('.breadcrumb-item').forEach((el, i) => {
            el.classList.add('bc-in');
            el.style.animationDelay = `${Math.min(i * 30, 150)}ms`;
        });
        lastBreadcrumbPath = currentPath;
    }
    updatePathBar();
}

function updatePathBar() {
    const bar = document.getElementById('pathBar');
    if (bar && document.activeElement !== bar) {
        bar.value = currentPath ? currentPath : '';
    }
}

// Folder upload utilities using webkitGetAsEntry API
async function readEntryAsFile(entry) {
    return new Promise((resolve, reject) => {
        entry.file(resolve, reject);
    });
}

async function readDirectoryEntries(dirEntry) {
    return new Promise((resolve, reject) => {
        const reader = dirEntry.createReader();
        const entries = [];

        function readBatch() {
            reader.readEntries((batch) => {
                if (batch.length === 0) {
                    resolve(entries);
                } else {
                    entries.push(...batch);
                    readBatch(); // Continue reading (directories may have >100 entries)
                }
            }, reject);
        }
        readBatch();
    });
}

async function collectFilesFromEntry(entry, basePath = '') {
    const files = [];
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isFile) {
        try {
            const file = await readEntryAsFile(entry);
            // Create new File with relative path as name
            const fileWithPath = new File([file], relativePath, {
                type: file.type,
                lastModified: file.lastModified
            });
            files.push(fileWithPath);
        } catch (e) {
            console.warn('Could not read file:', relativePath, e);
        }
    } else if (entry.isDirectory) {
        const entries = await readDirectoryEntries(entry);
        for (const childEntry of entries) {
            const childFiles = await collectFilesFromEntry(childEntry, relativePath);
            files.push(...childFiles);
        }
    }
    return files;
}

async function processDataTransferItems(items) {
    const files = [];
    const dirEntries = [];

    // Must inspect items synchronously before they expire (esp. on paste).
    for (const item of items) {
        if (item.kind !== 'file') continue;

        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;

        // Folders can only be walked via the entry API.
        if (entry && entry.isDirectory) {
            dirEntries.push(entry);
            continue;
        }

        // Single files: getAsFile() is the direct, reliable path — reading
        // through a FileSystemFileEntry (entry.file()) is a drag-and-drop-era
        // API that's flaky for paste events (e.g. Finder copy -> Cmd+V) and
        // can fail silently, so only fall back to it if getAsFile() is unavailable.
        const file = item.getAsFile();
        if (file) {
            files.push(file);
        } else if (entry && entry.isFile) {
            try {
                files.push(await readEntryAsFile(entry));
            } catch (e) {
                console.warn('Could not read pasted file:', entry.name, e);
            }
        }
    }

    for (const dirEntry of dirEntries) {
        const entryFiles = await collectFilesFromEntry(dirEntry);
        files.push(...entryFiles);
    }

    return files;
}

function uploadFiles(files) {
    if (files.length === 0) return;
    uploadQueue = uploadQueue
        .then(() => runUpload(files))
        .catch(() => {});
}

function dismissUploadProgress() {
    const progress = document.getElementById('uploadProgress');
    const fill = document.getElementById('progressFill');
    const list = document.getElementById('uploadProgressList');
    const meta = document.getElementById('uploadProgressMeta');
    const closeBtn = document.getElementById('uploadProgressClose');
    progress.classList.remove('show', 'show-close');
    fill.style.width = '0%';
    list.innerHTML = '';
    meta.textContent = '';
    closeBtn.setAttribute('aria-hidden', 'true');
}

function initUploadUI(files) {
    const progress = document.getElementById('uploadProgress');
    const list = document.getElementById('uploadProgressList');
    const meta = document.getElementById('uploadProgressMeta');
    const title = document.getElementById('uploadProgressTitle');
    const closeBtn = document.getElementById('uploadProgressClose');

    progress.classList.add('show');
    progress.classList.remove('show-close');
    closeBtn.setAttribute('aria-hidden', 'true');
    title.textContent = `Uploading ${files.length} file${files.length === 1 ? '' : 's'}...`;
    meta.textContent = 'Starting...';

    list.innerHTML = files.map(item => `
        <div class="upload-progress-item" data-upload-id="${item.id}">
            <div class="upload-progress-row">
                <div class="upload-progress-name">${escapeHtml(item.name)}</div>
                <div class="upload-progress-status">Queued</div>
            </div>
            <div class="upload-progress-bar">
                <div class="upload-progress-bar-fill"></div>
            </div>
            <div class="upload-progress-error"></div>
        </div>
    `).join('');
}

function updateUploadItem(item) {
    const row = document.querySelector(`.upload-progress-item[data-upload-id="${item.id}"]`);
    if (!row) return;
    const statusEl = row.querySelector('.upload-progress-status');
    const fill = row.querySelector('.upload-progress-bar-fill');
    const errorEl = row.querySelector('.upload-progress-error');
    const pct = item.total > 0 ? Math.min(100, Math.round((item.loaded / item.total) * 100)) : 0;

    row.classList.toggle('error', item.status === 'error');

    if (item.status === 'done') {
        // Constant markup only — no user content (XSS-safe)
        statusEl.innerHTML = '<svg class="upload-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-label="Done"><polyline points="20 6 9 17 4 12"/></svg>';
        fill.style.width = '100%';
    } else if (item.status === 'error') {
        statusEl.textContent = 'Failed';
        fill.style.width = '100%';
        errorEl.textContent = item.error || 'Upload failed';
    } else if (item.status === 'uploading') {
        const loadedStr = formatSize(item.loaded);
        const totalStr = formatSize(item.total || item.size);
        statusEl.textContent = `Uploading ${pct}% (${loadedStr} / ${totalStr})`;
        fill.style.width = `${pct}%`;
    } else {
        statusEl.textContent = 'Queued';
    }
}

function formatETA(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '';
    seconds = Math.round(seconds);
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const remSecs = seconds % 60;
    if (mins < 60) return `${mins}m ${remSecs}s`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
}

function updateOverallUploadProgress(state) {
    const fill = document.getElementById('progressFill');
    const meta = document.getElementById('uploadProgressMeta');

    const totalBytes = state.totalBytes || 1;
    const loadedBytes = state.files.reduce((sum, item) => {
        if (item.status === 'done' || item.status === 'error') {
            return sum + item.size;
        }
        return sum + Math.min(item.loaded || 0, item.size);
    }, 0);

    const percent = Math.min(100, Math.round((loadedBytes / totalBytes) * 100));
    const completed = state.files.filter(item => item.status === 'done').length;

    fill.style.width = `${percent}%`;

    const now = performance.now();
    const elapsed = (now - (state.startTime || now)) / 1000;
    let speedText = '';
    let etaText = '';

    if (elapsed > 0.4 && loadedBytes > 0) {
        const speed = loadedBytes / elapsed;
        speedText = `${formatSize(speed)}/s`;
        const remainingBytes = Math.max(0, totalBytes - loadedBytes);
        if (speed > 0 && percent < 100) {
            const eta = remainingBytes / speed;
            etaText = formatETA(eta);
        }
    }

    if (percent < 100 && speedText) {
        const speedPart = etaText ? ` · ${speedText} (${etaText} left)` : ` · ${speedText}`;
        meta.textContent = `${percent}% · ${formatSize(loadedBytes)} / ${formatSize(totalBytes)}${speedPart} · ${completed}/${state.files.length} uploaded`;
    } else {
        meta.textContent = `${percent}% · ${completed}/${state.files.length} uploaded`;
    }
}

function getUploadErrorText(xhr) {
    if (xhr.status === 413) {
        return 'File too large (exceeds server limit)';
    }
    if (xhr.status === 504 || xhr.status === 408) {
        return 'Upload timed out';
    }
    const raw = xhr.responseText || '';
    try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.error) {
            return parsed.error;
        }
    } catch (err) {}
    if (raw) {
        if (raw.includes('<title>')) {
            const match = raw.match(/<title>(.*?)<\/title>/i);
            if (match && match[1]) return match[1].replace(/^\d+\s*/, '');
        }
        return raw.length > 80 ? `Error (${xhr.status})` : raw;
    }
    return `Upload failed (${xhr.status || 'network error'})`;
}

function uploadSingleFile(fileItem, state, url) {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                fileItem.total = e.total || fileItem.size;
                fileItem.loaded = e.loaded;
                updateUploadItem(fileItem);
                updateOverallUploadProgress(state);
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                fileItem.status = 'done';
            } else {
                fileItem.status = 'error';
                fileItem.error = getUploadErrorText(xhr);
            }
            fileItem.loaded = fileItem.total || fileItem.size;
            updateUploadItem(fileItem);
            updateOverallUploadProgress(state);
            resolve();
        };

        xhr.onerror = () => {
            fileItem.status = 'error';
            fileItem.error = 'Upload failed';
            fileItem.loaded = fileItem.total || fileItem.size;
            updateUploadItem(fileItem);
            updateOverallUploadProgress(state);
            resolve();
        };

        const mtimes = {};
        if (fileItem.file.lastModified) {
            mtimes[fileItem.file.name] = fileItem.file.lastModified;
        }
        const formData = new FormData();
        formData.append('mtimes', new Blob([JSON.stringify(mtimes)], { type: 'application/json' }));
        formData.append('original_name', fileItem.file.name);
        formData.append('files', fileItem.file, fileItem.file.name);

        xhr.open('POST', url);
        xhr.send(formData);
    });
}

async function runUpload(files) {
    const url = currentPath ? `/api/upload?path=${encodeURIComponent(currentPath)}` : '/api/upload';
    const items = files.map((file, index) => ({
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: file.name,
        size: file.size || 0,
        loaded: 0,
        total: file.size || 0,
        status: 'queued',
        error: ''
    }));

    const state = {
        files: items,
        totalBytes: items.reduce((sum, item) => sum + (item.size || 0), 0),
        startTime: performance.now()
    };

    initUploadUI(items);
    updateOverallUploadProgress(state);

    for (const item of items) {
        item.status = 'uploading';
        updateUploadItem(item);
        updateOverallUploadProgress(state);
        await uploadSingleFile(item, state, url);
    }

    const successCount = items.filter(item => item.status === 'done').length;
    const errorCount = items.filter(item => item.status === 'error').length;
    const title = document.getElementById('uploadProgressTitle');
    const progress = document.getElementById('uploadProgress');
    const closeBtn = document.getElementById('uploadProgressClose');

    if (successCount > 0) {
        loadFiles();
    }

    if (errorCount > 0) {
        title.textContent = `Upload finished with ${errorCount} error${errorCount === 1 ? '' : 's'}`;
        progress.classList.add('show-close');
        closeBtn.setAttribute('aria-hidden', 'false');
    } else {
        title.textContent = 'Upload complete';
        progress.classList.add('show-close');
        closeBtn.setAttribute('aria-hidden', 'false');
        setTimeout(() => dismissUploadProgress(), 2000);
    }

    if (successCount > 0 && errorCount > 0) {
        showToast(`Uploaded ${successCount} file${successCount === 1 ? '' : 's'}, ${errorCount} failed`);
    } else if (successCount > 0) {
        showToast(`Uploaded ${successCount} file${successCount === 1 ? '' : 's'}`);
    } else {
        showToast(`Upload failed (${errorCount} file${errorCount === 1 ? '' : 's'})`);
    }
}

function downloadFile(path) {
    window.location.href = `/api/download?path=${encodeURIComponent(path)}&download=1`;
}

function openLightbox(path) {
    const images = allFiles
        .filter(f => !f.is_dir && isImageFile(f.name))
        .map(f => ({ path: currentPath ? currentPath + '/' + f.name : f.name, name: f.name }));
    lightboxImages = images;
    lightboxIndex = images.findIndex(img => img.path === path);
    if (lightboxIndex < 0) lightboxIndex = 0;
    showLightboxImage();
    document.getElementById('lightbox').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function showLightboxImage() {
    const img = lightboxImages[lightboxIndex];
    if (!img) return;
    document.getElementById('lightboxImg').src = `/api/download?path=${encodeURIComponent(img.path)}`;
    document.getElementById('lightboxCaption').textContent = img.name + ` (${lightboxIndex + 1}/${lightboxImages.length})`;
}

function closeLightbox(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('lightbox').classList.remove('show');
    document.body.style.overflow = '';
}

function lightboxNav(dir) {
    lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
    showLightboxImage();
}

// PDF / video / audio preview modal (browser-native players, no extra libs)
function openMediaPreview(path) {
    const name = path.split('/').pop();
    const url = `/api/download?path=${encodeURIComponent(path)}`;
    const body = document.getElementById('mediaPreviewBody');
    if (isPdfFile(name)) {
        body.innerHTML = `<iframe class="pdf-preview-frame" src="${htmlAttr(url)}" title="${htmlAttr(name)}"></iframe>`;
    } else if (isVideoFile(name)) {
        body.innerHTML = `<video class="media-preview-video" controls preload="metadata" src="${htmlAttr(url)}"></video>`;
    } else if (isAudioFile(name)) {
        body.innerHTML = `<audio class="media-preview-audio" controls preload="metadata" src="${htmlAttr(url)}"></audio>`;
    } else {
        return;
    }
    document.getElementById('mediaPreviewName').textContent = name;
    document.getElementById('mediaPreviewModal').classList.add('active');
}

function closeMediaPreview() {
    document.getElementById('mediaPreviewModal').classList.remove('active');
    document.getElementById('mediaPreviewBody').innerHTML = '';
}

// Keyboard Shortcuts Modal
function showShortcutsModal() {
    document.getElementById('shortcutsModal').classList.add('active');
}

function closeShortcutsModal() {
    document.getElementById('shortcutsModal').classList.remove('active');
}

async function downloadSelectedZip() {
    const paths = Array.from(selectedFiles);
    if (paths.length === 0) return;
    const res = await fetch('/api/download-zip-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths })
    });
    if (!res.ok) { await apiErrorToast(res, 'ZIP download failed'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'selection.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadZip(path) {
    window.location.href = `/api/download-zip?path=${encodeURIComponent(path)}`;
}

function copyFileUrl(path) {
    const url = `${window.location.origin}/api/download?path=${encodeURIComponent(path)}`;
    navigator.clipboard.writeText(url).then(() => {
        showToast('URL copied to clipboard');
    }).catch(() => {
        showToast('Failed to copy URL');
    });
}

async function deleteItem(path) {
    if (!confirm(`Delete "${path.split('/').pop()}"?`)) return;

    const res = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
    });
    if (!res.ok) { await apiErrorToast(res, 'Delete failed'); return; }
    loadFiles();
}

async function duplicateItem(path) {
    const res = await fetch('/api/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
    });
    if (res.ok) {
        loadFiles();
        showToast('Duplicated', 'success');
    } else {
        await apiErrorToast(res, 'Duplicate failed');
    }
}

// Bulk operations
async function bulkDelete() {
    const count = selectedFiles.size;
    if (count === 0) return;

    if (!confirm(`Delete ${count} selected item${count === 1 ? '' : 's'}?`)) return;

    await runBulkMutation('/api/delete', path => ({ path }), 'Deleted');
}

function showBulkMoveModal() {
    if (selectedFiles.size === 0) return;

    document.getElementById('moveModal').classList.add('active');
    document.getElementById('movePath').value = '__bulk__';
    document.getElementById('moveDestination').value = '';
    updateSelectedPathDisplay('');

    fetch('/api/folders')
        .then(res => res.json())
        .then(folders => {
            folderTreeData = buildFolderTree(folders);
            expandedFolders = new Set();
            folderTreeData.forEach(f => expandedFolders.add(f.path));
            renderFolderTree();
        });
}

async function bulkMove(destDir) {
    const count = selectedFiles.size;
    if (count === 0) return;

    await runBulkMutation('/api/move', path => ({ path, dest_dir: destDir || null }), 'Moved');
}

async function runBulkMutation(endpoint, bodyFor, verb) {
    const paths = [...selectedFiles];
    const failed = new Set();
    for (const path of paths) {
        try {
            const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyFor(path)) });
            if (!res.ok) failed.add(path);
        } catch { failed.add(path); }
    }
    await loadFiles();
    selectedFiles = failed;
    updateSelectionUI();
    const completed = paths.length - failed.size;
    showToast(`${verb} ${completed} of ${paths.length} items${failed.size ? ` · ${failed.size} failed; selected for retry` : ''}`, failed.size ? 'error' : 'success');
}

// ============================================
// CLIPBOARD (copy / cut / paste)
// ============================================

// Resolves which paths a copy/cut action should act on: an explicit path
// (e.g. from a context menu click) expands to the full selection if that
// path is part of a multi-selection, otherwise falls back to the current
// selection, then the keyboard-focused item.
function clipboardSourcePaths(explicitPath) {
    if (explicitPath) {
        if (selectedFiles.has(explicitPath) && selectedFiles.size > 1) return [...selectedFiles];
        return [explicitPath];
    }
    if (selectedFiles.size > 0) return [...selectedFiles];
    if (focusedIndex >= 0) {
        const items = document.querySelectorAll('.file-item');
        if (items[focusedIndex]) return [items[focusedIndex].dataset.path];
    }
    return [];
}

function copyToClipboard(mode, explicitPath) {
    const paths = clipboardSourcePaths(explicitPath);
    if (paths.length === 0) return;
    clipboard = { paths, mode };
    updateSelectionUI();
    showToast(`${paths.length} item${paths.length === 1 ? '' : 's'} ${mode === 'cut' ? 'cut' : 'copied'}`);
}

function clearClipboard() {
    if (clipboard.paths.length === 0) return;
    clipboard = { paths: [], mode: null };
    updateSelectionUI();
}

async function pasteClipboard() {
    if (clipboard.paths.length === 0) return;
    const { paths, mode } = clipboard;
    let ok = 0;
    for (const path of paths) {
        try {
            if (mode === 'copy') {
                const res = await fetch('/api/copy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path, destination: currentPath })
                });
                if (res.ok) ok++; else await apiErrorToast(res, 'Copy failed');
            } else {
                const res = await fetch('/api/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path, dest_dir: currentPath || null })
                });
                if (res.ok) ok++; else await apiErrorToast(res, 'Move failed');
            }
        } catch {
            showToast(mode === 'copy' ? 'Copy failed' : 'Move failed', 'error');
        }
    }
    if (mode === 'cut') clipboard = { paths: [], mode: null };
    updateSelectionUI();
    if (ok > 0) showToast(`Pasted ${ok} item${ok === 1 ? '' : 's'}`);
    loadFiles();
}

// Folder Modal
function showNewFolderModal() {
    document.getElementById('folderModal').classList.add('active');
    document.getElementById('folderName').value = '';
    setTimeout(() => document.getElementById('folderName').focus(), 100);
}

function closeFolderModal() {
    document.getElementById('folderModal').classList.remove('active');
}

async function createFolder() {
    const name = document.getElementById('folderName').value.trim();
    if (!name) return;

    const res = await fetch('/api/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, path: currentPath || null })
    });

    if (!res.ok) { await apiErrorToast(res, 'Could not create folder'); return; }
    closeFolderModal();
    loadFiles();
}

// New File Modal
function showNewFileModal() {
    document.getElementById('newFileModal').classList.add('active');
    document.getElementById('newFileName').value = '';
    document.getElementById('newFileExt').value = '.txt';
    setTimeout(() => document.getElementById('newFileName').focus(), 100);
}

function closeNewFileModal() {
    document.getElementById('newFileModal').classList.remove('active');
}

async function createNewFile() {
    const name = document.getElementById('newFileName').value.trim();
    const ext = document.getElementById('newFileExt').value;

    if (!name) {
        showToast('Please enter a filename');
        return;
    }

    const filename = name + ext;

    try {
        const res = await fetch('/api/newfile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, path: currentPath || null })
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(error || 'Failed to create file');
        }

        const data = await res.json();
        closeNewFileModal();
        loadFiles();
        showToast(`Created ${filename}`);

        // Auto-open edit modal for the new file
        setTimeout(() => showEditModal(data.path), 300);
    } catch (err) {
        showToast(err.message);
    }
}

// Rename Modal
function triggerRename(path, currentName) {
    const itemEl = document.querySelector(`.file-item[data-path="${CSS.escape(path)}"]`);
    if (itemEl) {
        startInlineRename(itemEl);
    } else {
        showRenameModal(path, currentName);
    }
}

function showRenameModal(path, currentName) {
    document.getElementById('renameModal').classList.add('active');
    document.getElementById('renamePath').value = path;
    document.getElementById('renameName').value = currentName;
    setTimeout(() => {
        const input = document.getElementById('renameName');
        input.focus();
        input.select();
    }, 100);
}

function closeRenameModal() {
    document.getElementById('renameModal').classList.remove('active');
}


function getRenamedPath(path, newName) {
    const parts = path.split('/');
    parts[parts.length - 1] = newName;
    return parts.join('/');
}

async function renamePath(path, newName) {
    const res = await fetch('/api/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, new_name: newName })
    });

    if (res.ok) {
        const data = await res.json();
        const newPath = getRenamedPath(path, data.new_name || newName);
        remapPinnedFolders(path, newPath);
        if (selectedFiles.has(path)) {
            selectedFiles.delete(path);
            selectedFiles.add(newPath);
        }
        loadFiles();
        return true;
    }

    await apiErrorToast(res, 'Rename failed');
    return false;
}

async function renameItem() {
    const path = document.getElementById('renamePath').value;
    const newName = document.getElementById('renameName').value.trim();
    if (!newName) return;
    const success = await renamePath(path, newName);
    if (success) {
        closeRenameModal();
    }
}

// Move Modal with Tree View
let folderTreeData = [];
let expandedFolders = new Set();

async function showMoveModal(path) {
    document.getElementById('moveModal').classList.add('active');
    document.getElementById('movePath').value = path;
    document.getElementById('moveDestination').value = '';
    updateSelectedPathDisplay('');

    const res = await fetch('/api/folders');
    const folders = await res.json();
    folderTreeData = buildFolderTree(folders);
    expandedFolders = new Set();
    // Auto-expand first level
    folderTreeData.forEach(f => expandedFolders.add(f.path));
    renderFolderTree();
}

function buildFolderTree(folders) {
    const tree = [];
    const map = {};

    // Sort folders by path
    folders.sort((a, b) => a.localeCompare(b));

    folders.forEach(path => {
        if (path === '/') {
            return; // Root is shown separately
        }

        const parts = path.split('/');
        const name = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join('/');

        const node = { name, path, children: [], depth: parts.length - 1 };
        map[path] = node;

        if (parentPath && map[parentPath]) {
            map[parentPath].children.push(node);
        } else {
            tree.push(node);
        }
    });

    return tree;
}

function renderFolderTree() {
    const container = document.getElementById('folderTree');
    const selectedPath = document.getElementById('moveDestination').value;

    let html = `
        <div class="tree-item ${selectedPath === '' ? 'selected' : ''}" onclick="selectMoveDestination('')">
            <div class="tree-toggle empty"></div>
            <svg class="tree-folder-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22" fill="none" stroke="currentColor" stroke-width="2"/>
            </svg>
            <span class="tree-folder-name">Root</span>
            <span class="tree-path">/</span>
        </div>
    `;

    html += renderTreeNodes(folderTreeData, selectedPath, 0);
    container.innerHTML = html;
}

function renderTreeNodes(nodes, selectedPath, depth) {
    let html = '';

    nodes.forEach(node => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedFolders.has(node.path);
        const isSelected = selectedPath === node.path;

        html += `
            <div class="tree-item ${isSelected ? 'selected' : ''}"
                 style="padding-left: ${12 + depth * 20}px"
                 onclick="selectMoveDestination('${escapeAttr(node.path)}')">
                <div class="tree-toggle ${hasChildren ? (isExpanded ? 'expanded' : '') : 'empty'}"
                     onclick="event.stopPropagation(); toggleFolderExpand('${escapeAttr(node.path)}')">
                    ${hasChildren ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>` : ''}
                </div>
                <svg class="tree-folder-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/>
                </svg>
                <span class="tree-folder-name">${escapeHtml(node.name)}</span>
            </div>
        `;

        if (hasChildren && isExpanded) {
            html += renderTreeNodes(node.children, selectedPath, depth + 1);
        }
    });

    return html;
}

function toggleFolderExpand(path) {
    if (expandedFolders.has(path)) {
        expandedFolders.delete(path);
    } else {
        expandedFolders.add(path);
    }
    renderFolderTree();
}

function selectMoveDestination(path) {
    document.getElementById('moveDestination').value = path;
    updateSelectedPathDisplay(path);
    renderFolderTree();
}

function updateSelectedPathDisplay(path) {
    const display = document.getElementById('selectedPathDisplay');
    const displayPath = path === '' ? '/ (Root)' : '/' + path;
    display.querySelector('span').textContent = displayPath;
}

function closeMoveModal() {
    document.getElementById('moveModal').classList.remove('active');
}

async function moveItem() {
    const path = document.getElementById('movePath').value;
    const destDir = document.getElementById('moveDestination').value;

    // Check if this is a bulk move
    if (path === '__bulk__') {
        closeMoveModal();
        await bulkMove(destDir);
        return;
    }

    const res = await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, dest_dir: destDir || null })
    });

    if (res.ok) {
        closeMoveModal();
        loadFiles();
    } else {
        await apiErrorToast(res, 'Move failed');
    }
}

// Paste Modal
function showPasteModal(file) {
    pendingPasteFile = file;
    const isText = file.type.startsWith('text/');
    const stamp = new Date().toISOString().slice(0,19).replace(/[T:]/g, '-');
    const defaultName = isText
        ? `pasted-text-${stamp}.txt`
        : `image_${stamp}.${file.type.split('/')[1] || 'png'}`;

    document.getElementById('pasteModal').classList.add('active');
    document.getElementById('pasteName').value = defaultName;
    setTimeout(() => {
        const input = document.getElementById('pasteName');
        input.focus();
        input.select();
    }, 100);
}

function closePasteModal() {
    document.getElementById('pasteModal').classList.remove('active');
    pendingPasteFile = null;
}

function confirmPaste() {
    const name = document.getElementById('pasteName').value.trim();
    if (!name || !pendingPasteFile) return;

    const newFile = new File([pendingPasteFile], name, { type: pendingPasteFile.type });
    uploadFiles([newFile]);
    closePasteModal();
}

// Edit Modal
async function showEditModal(path) {
    if (currentEditPath && !(await closeEditModal())) return;
    clearTimeout(window._autosaveTimer);
    const epoch = ++editorEpoch;
    currentEditPath = path;
    editorSavedContent = null;
    const filename = path.split('/').pop();
    document.getElementById('editFileName').textContent = filename;
    document.getElementById('editPath').value = path;
    document.getElementById('editContent').value = '';
    document.getElementById('editStatus').textContent = 'Loading...';
    document.getElementById('editStatus').className = 'edit-status';
    document.getElementById('editSaveBtn').disabled = true;
    document.getElementById('editModal').classList.add('active');
    setEditMode('edit');

    try {
        const res = await fetch(`/api/content?path=${encodeURIComponent(path)}`);
        if (!res.ok) {
            const error = await res.text();
            throw new Error(error || 'Failed to load file');
        }
        const content = await res.text();
        if (epoch !== editorEpoch || currentEditPath !== path) return;
        editorSavedContent = content;
        document.getElementById('editContent').value = content;
        document.getElementById('editStatus').textContent = '';
        document.getElementById('editSaveBtn').disabled = false;
        document.getElementById('editContent').focus();
    } catch (err) {
        if (epoch !== editorEpoch) return;
        document.getElementById('editStatus').textContent = err.message;
        document.getElementById('editStatus').className = 'edit-status error';
    }

    if (epoch !== editorEpoch) return;
    document.getElementById('editContent').oninput = () => {
        document.getElementById('editStatus').textContent = 'Unsaved changes';
        clearTimeout(window._autosaveTimer);
        window._autosaveTimer = setTimeout(() => persistEditor(), 2000);
    };
}


function setEditMode(mode) {
    const ta = document.getElementById('editContent');
    const preview = document.getElementById('syntaxPreview');
    const mdPreview = document.getElementById('markdownPreview');
    const editBtn = document.getElementById('editModeBtn');
    const viewBtn = document.getElementById('viewModeBtn');
    const ext = (currentEditPath || '').split('.').pop().toLowerCase();

    if (mode === 'view') {
        const langMap = { py: 'python', js: 'javascript', ts: 'typescript', rs: 'rust',
            sql: 'sql', html: 'markup', css: 'css', json: 'json', md: 'markdown',
            sh: 'bash', yaml: 'yaml', yml: 'yaml', toml: 'toml', xml: 'markup',
            go: 'go', rb: 'ruby', php: 'php', txt: 'none', m3u: 'none' };

        if (ext === 'md' && window.marked) {
            mdPreview.innerHTML = DOMPurify.sanitize(marked.parse(ta.value), { USE_PROFILES: { html: true } });
            mdPreview.classList.add('active');
            preview.classList.remove('active');
        } else {
            const lang = langMap[ext] || 'none';
            const code = document.getElementById('syntaxCode');
            code.textContent = ta.value;
            code.className = lang !== 'none' ? `language-${lang}` : '';
            if (window.Prism && lang !== 'none') Prism.highlightElement(code);
            preview.classList.add('active');
            mdPreview.classList.remove('active');
        }
        ta.classList.add('hidden');
        editBtn.classList.remove('active');
        viewBtn.classList.add('active');
    } else {
        preview.classList.remove('active');
        mdPreview.classList.remove('active');
        ta.classList.remove('hidden');
        editBtn.classList.add('active');
        viewBtn.classList.remove('active');
    }
}

let editorEpoch = 0;
let editorSavedContent = null;
let editorSaveQueue = Promise.resolve();

function persistEditor() {
    clearTimeout(window._autosaveTimer);
    const path = currentEditPath;
    const content = document.getElementById('editContent').value;
    const epoch = editorEpoch;
    const status = document.getElementById('editStatus');
    if (!path || editorSavedContent === null) return Promise.resolve(true);
    const save = async () => {
        if (content === editorSavedContent && epoch === editorEpoch) return true;
        if (epoch === editorEpoch) { status.textContent = 'Saving…'; status.className = 'edit-status saving'; }
        try {
            const res = await fetch('/api/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, content }) });
            if (!res.ok) throw new Error((await res.text()) || 'Could not save file');
            if (epoch === editorEpoch) {
                editorSavedContent = content;
                status.textContent = document.getElementById('editContent').value === content ? 'Saved' : 'Unsaved changes';
                status.className = 'edit-status';
            }
            return true;
        } catch (err) {
            if (epoch === editorEpoch) { status.textContent = err.message; status.className = 'edit-status error'; }
            return false;
        }
    };
    editorSaveQueue = editorSaveQueue.then(save, save);
    return editorSaveQueue;
}

async function closeEditModal() {
    clearTimeout(window._autosaveTimer);
    const epoch = editorEpoch;
    if (!(await persistEditor())) return false;
    if (epoch !== editorEpoch) return false;
    // If typing continued during a save, persist the latest content before closing.
    if (editorSavedContent !== null && document.getElementById('editContent').value !== editorSavedContent) return closeEditModal();
    ++editorEpoch;
    currentEditPath = '';
    editorSavedContent = null;
    document.getElementById('editModal').classList.remove('active');
    document.getElementById('editContent').value = '';
    document.getElementById('editPath').value = '';
    document.getElementById('editStatus').textContent = '';
    return true;
}

async function saveEditContent() {
    const btn = document.getElementById('editSaveBtn');
    btn.disabled = true;
    if (await closeEditModal()) showToast('File saved successfully', 'success');
    btn.disabled = false;
}

window.addEventListener('beforeunload', e => {
    if (currentEditPath && editorSavedContent !== null && document.getElementById('editContent').value !== editorSavedContent) {
        e.preventDefault(); e.returnValue = '';
    }
});

let toastTimer = null;
const TOAST_ICONS = {
    success: '<polyline points="20 6 9 17 4 12"/>',
    error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
};
const TOAST_DURATION = 3000;
let toastHideAt = 0;
let toastRemaining = TOAST_DURATION;
function hideToast() {
    document.getElementById('toast').classList.remove('show');
}
function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<svg class="toast-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${TOAST_ICONS[type] || TOAST_ICONS.info}</svg><span></span><i class="toast-progress"></i>`;
    toast.querySelector('span').textContent = msg; // textContent keeps this XSS-safe
    requestAnimationFrame(() => toast.classList.add('show'));
    clearTimeout(toastTimer);
    toastRemaining = TOAST_DURATION;
    toastHideAt = Date.now() + TOAST_DURATION;
    toastTimer = setTimeout(hideToast, TOAST_DURATION);
}
// Shared helper for non-2xx API responses: the server sends a plain-text
// error body, so surface it (truncated) instead of a generic message.
// toast() renders via textContent, so no separate escaping is needed here.
async function apiErrorToast(res, fallback) {
    let detail = '';
    try { detail = (await res.text()).trim(); } catch {}
    if (detail.length > 120) detail = detail.slice(0, 120) + '…';
    showToast(detail ? `${fallback}: ${detail}` : fallback, 'error');
}
// Hovering the toast pauses auto-dismiss (the CSS progress bar pauses via :hover)
(() => {
    const toastEl = document.getElementById('toast');
    toastEl.addEventListener('mouseenter', () => {
        toastRemaining = Math.max(0, toastHideAt - Date.now());
        clearTimeout(toastTimer);
    });
    toastEl.addEventListener('mouseleave', () => {
        if (!toastEl.classList.contains('show')) return;
        const wait = Math.max(toastRemaining, 400);
        toastHideAt = Date.now() + wait;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(hideToast, wait);
    });
})();

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDatePart(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp * 1000);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
}

function formatTimePart(timestamp) {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toggleView() {
    viewMode = viewMode === 'grid' ? 'list' : 'grid';
    ls.set('viewMode', viewMode);
    updateViewIcon();
    restaggerNext = true;
    renderFiles(allFiles);
}

function toggleMultiSelectMode() {
    multiSelectMode = !multiSelectMode;
    const btn = document.getElementById('multiSelectBtn');
    if (btn) btn.classList.toggle('active', multiSelectMode);
}

function setItemScale(val) {
    itemScale = parseInt(val);
    ls.set('itemScale', itemScale);
    const grid = document.querySelector('.file-grid');
    if (grid && viewMode === 'grid') {
        grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${itemScale}px, 1fr))`;
    }
    document.querySelectorAll('.file-table .file-item:not(.file-item--inline-child)').forEach(el => {
        const pad = Math.round(6 + (itemScale - 80) * 0.04);
        el.style.paddingTop = pad + 'px';
        el.style.paddingBottom = pad + 'px';
    });
}

function updateViewIcon() {
    const icon = document.getElementById('viewIcon');
    if (viewMode === 'grid') {
        // Show grid icon (current view is grid, clicking will switch to list)
        icon.innerHTML = '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>';
    } else {
        // Show list icon (current view is list, clicking will switch to grid)
        icon.innerHTML = '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>';
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function htmlAttr(str) {
    return escapeHtml(String(str)).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(str) {
    // Encode a JS single-quoted string, then its enclosing HTML attribute.
    return htmlAttr(JSON.stringify(String(str)).slice(1, -1).replace(/'/g, "\\'"));
}

// Drag & Drop zone
const dropZone = document.getElementById('dropZone');

['dragenter', 'dragover'].forEach(e => {
    dropZone.addEventListener(e, (ev) => {
        ev.preventDefault();
        dropZone.classList.add('dragover');
    });
});

['dragleave', 'drop'].forEach(e => {
    dropZone.addEventListener(e, (ev) => {
        ev.preventDefault();
        dropZone.classList.remove('dragover');
    });
});

dropZone.addEventListener('drop', async (e) => {
    // Use webkitGetAsEntry for folder support
    const files = await processDataTransferItems(e.dataTransfer.items);
    if (files.length > 0) uploadFiles(files);
});

// Full-viewport drop overlay: visual layer for OS file drags anywhere on the page.
// Internal file-item drags (draggedItem set) never trigger it.
(() => {
    const overlay = document.getElementById('dropOverlay');
    let dragDepth = 0;
    const isExternalFileDrag = (e) =>
        !draggedItem && e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    const showOverlay = () => {
        document.getElementById('dropOverlaySub').textContent =
            currentPath ? `Files land in /${currentPath}` : 'Files land in the current folder';
        overlay.classList.add('show');
    };
    const hideOverlay = () => { dragDepth = 0; overlay.classList.remove('show'); };

    window.addEventListener('dragenter', (e) => {
        if (!isExternalFileDrag(e)) return;
        e.preventDefault();
        dragDepth++;
        showOverlay();
    });
    window.addEventListener('dragover', (e) => {
        if (isExternalFileDrag(e)) e.preventDefault();
    });
    window.addEventListener('dragleave', (e) => {
        if (!isExternalFileDrag(e)) return;
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) overlay.classList.remove('show');
    });
    window.addEventListener('drop', async (e) => {
        if (!isExternalFileDrag(e)) return;
        e.preventDefault();
        hideOverlay();
        // The legacy #dropZone element has its own drop handler — avoid double upload.
        if (e.target.closest && e.target.closest('#dropZone')) return;
        const files = await processDataTransferItems(e.dataTransfer.items);
        if (files.length > 0) uploadFiles(files);
    });
    window.addEventListener('dragend', hideOverlay);
})();

// Modal / global-search exit animation: when .active is removed, keep the element
// visible for one short "closing" animation. No call sites change.
(() => {
    const closeObserver = new MutationObserver((muts) => {
        muts.forEach(m => {
            const el = m.target;
            const wasActive = (m.oldValue || '').split(/\s+/).includes('active');
            if (wasActive && !el.classList.contains('active') && !el.classList.contains('closing')) {
                el.classList.add('closing');
                setTimeout(() => el.classList.remove('closing'), 160);
            }
        });
    });
    document.querySelectorAll('.modal, .global-search').forEach(el =>
        closeObserver.observe(el, { attributes: true, attributeFilter: ['class'], attributeOldValue: true }));
})();

// File input
document.getElementById('fileInput').addEventListener('change', (e) => {
    const fileList = e.target.files;
    // Convert to array and preserve webkitRelativePath for folder uploads
    const files = Array.from(fileList).map(file => {
        if (file.webkitRelativePath) {
            return new File([file], file.webkitRelativePath, {
                type: file.type,
                lastModified: file.lastModified
            });
        }
        return file;
    });
    uploadFiles(files);
    e.target.value = '';
});

function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

document.getElementById('searchInput').addEventListener('input', debounce((e) => {
    filterQuery = e.target.value.trim();
    restaggerNext = true;
    renderFiles(allFiles);
}, 120));

document.getElementById('sortSelect').addEventListener('change', (e) => {
    sortMode = e.target.value;
    ls.set('sortMode', sortMode);
    if (viewMode === 'list') { listSortCol = sortMode; listSortDir = sortMode === 'name' ? 'asc' : 'desc'; ls.set('listSortCol', listSortCol); ls.set('listSortDir', listSortDir); }
    restaggerNext = true;
    renderFiles(allFiles);
});

document.getElementById('filterSelect').addEventListener('change', (e) => {
    filterType = e.target.value;
    ls.set('filterType', filterType);
    restaggerNext = true;
    renderFiles(allFiles);
});

// Paste from clipboard (supports files/dirs via webkitGetAsEntry, plus plain text)
function isEditableTarget(el) {
    return !!(el && el.closest && el.closest('input, textarea, [contenteditable="true"]'));
}

// Diagnostic overlay: load Boxy with ?pastedebug=1 and paste to see exactly what
// the browser handed us. Makes "paste did nothing" reportable instead of guesswork.
function showPasteDebug(report, files) {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:auto 16px 16px 16px;max-height:60vh;overflow:auto;' +
        'z-index:99999;background:var(--bg-elevated,#1c1c1e);color:var(--text-primary,#fff);' +
        'border:1px solid var(--accent,#0a84ff);border-radius:12px;padding:16px;' +
        'font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap;box-shadow:0 8px 40px rgba(0,0,0,.5)';
    box.textContent = 'PASTE DEBUG (tap to dismiss)\n\n' +
        'files recovered: ' + files.length + '\n' +
        (files.length ? files.map(f => `  - ${f.name} (${f.type || 'no type'}, ${f.size}b)\n`).join('') : '') +
        '\ntypes: ' + JSON.stringify(report.types) +
        '\nitems: ' + JSON.stringify(report.items, null, 1) +
        '\nuri-list: ' + (report.uriList || '(empty)') +
        '\ntext: ' + (report.plainText || '(empty)');
    box.onclick = () => box.remove();
    document.body.appendChild(box);
}

// Explicit clipboard read. Unlike the paste event this is driven by a click, so
// it never depends on where focus happens to be — the reliable path when Ctrl/Cmd+V
// appears to do nothing.
document.getElementById('pasteClipboardBtn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;

    if (!navigator.clipboard || !navigator.clipboard.read) {
        showToast('Clipboard access not supported here — use Ctrl/⌘+V or drag files in', 'error');
        return;
    }

    btn.disabled = true;
    try {
        const clipboardItems = await navigator.clipboard.read();
        const files = [];

        for (const item of clipboardItems) {
            // Prefer real binary payloads; text is handled separately below.
            const type = item.types.find(t => t !== 'text/plain' && t !== 'text/html');
            if (!type) continue;
            const blob = await item.getType(type);
            const ext = type.split('/')[1] || 'bin';
            files.push(new File([blob], `clipboard-${Date.now()}.${ext}`, { type }));
        }

        if (files.length) {
            if (files.length === 1 && files[0].type.startsWith('image/')) {
                showPasteModal(files[0]);
            } else {
                uploadFiles(files);
            }
            return;
        }

        const text = await navigator.clipboard.readText();
        if (text) {
            showPasteModal(new File([text], 'pasted-text.txt', { type: 'text/plain' }));
            return;
        }

        showToast('Nothing usable on the clipboard', 'error');
    } catch (err) {
        showToast('Clipboard read blocked by the browser — drag the file in instead', 'error');
    } finally {
        btn.disabled = false;
    }
});

document.addEventListener('paste', async (e) => {
    const items = e.clipboardData.items;
    const hadFileItems = Array.from(items).some(item => item.kind === 'file');

    // Always record what the clipboard actually carried. Paste behaviour varies
    // sharply by OS/browser, so this inventory is the only reliable way to tell
    // why a paste did nothing. Visible via console or the ?pastedebug=1 overlay.
    const clipboardReport = {
        types: Array.from(e.clipboardData.types || []),
        items: Array.from(items).map(i => ({ kind: i.kind, type: i.type })),
        uriList: e.clipboardData.getData('text/uri-list') || '',
        plainText: (e.clipboardData.getData('text/plain') || '').slice(0, 200)
    };
    console.log('[Boxy paste] clipboard contents:', clipboardReport);
    window.__boxyLastPaste = clipboardReport;

    // Use webkitGetAsEntry to detect folders
    const files = await processDataTransferItems(items);

    if (new URLSearchParams(location.search).has('pastedebug')) {
        showPasteDebug(clipboardReport, files);
    }

    if (files.length > 0) {
        // Single image without path (not from folder): show naming modal
        if (files.length === 1 && files[0].type.startsWith('image/') && !files[0].name.includes('/')) {
            showPasteModal(files[0]);
        } else {
            // Multiple files, folder contents, or non-image: upload directly
            uploadFiles(files);
        }
        return;
    }

    if (hadFileItems) {
        // The clipboard had file data but we couldn't read any of it — surface this
        // instead of failing silently (some browsers don't expose OS-copied files to paste).
        showToast("Couldn't read the pasted file — try dragging it in instead", 'error');
        return;
    }

    // A file-manager copy (Finder/Explorer) puts a file reference here rather than
    // bytes. Browsers refuse to hand those to a page, so say so explicitly instead
    // of looking broken.
    if (clipboardReport.uriList.startsWith('file://')) {
        const name = decodeURIComponent(clipboardReport.uriList.split('\n')[0].split('/').pop());
        showToast(`Your browser won't share "${name}" with a web page — drag it in instead`, 'error');
        return;
    }

    // No files on the clipboard: don't hijack normal text paste into real
    // editable fields (the hidden catcher doesn't count — it exists for us).
    if (isEditableTarget(e.target)) return;

    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    e.preventDefault();
    const textFile = new File([text], 'pasted-text.txt', { type: 'text/plain' });
    showPasteModal(textFile);
});

// Modal keyboard handling
document.querySelectorAll('.modal input').forEach(input => {
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const modal = e.target.closest('.modal');
            modal.querySelector('.btn-primary').click();
        }
        if (e.key === 'Escape') {
            const modal = e.target.closest('.modal');
            if (modal.id === 'editModal') closeEditModal();
                else modal.classList.remove('active');
        }
    });
});

// Edit modal keyboard shortcuts
document.getElementById('editContent').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeEditModal();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (!document.getElementById('editSaveBtn').disabled) {
            saveEditContent();
        }
    }
});

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            if (modal.id === 'editModal') closeEditModal();
            else modal.classList.remove('active');
        }
    });
});

// Click on empty space to deselect
document.querySelector('.main').addEventListener('click', (e) => {
    // Only deselect if clicking directly on main, file-grid, file-table, or empty areas
    const target = e.target;
    const isEmptyArea = target.classList.contains('main') ||
                        target.classList.contains('file-grid') ||
                        target.classList.contains('file-table') ||
                        target.classList.contains('file-table-body') ||
                        target.classList.contains('drop-zone') ||
                        target.classList.contains('empty-state');

    if (isEmptyArea && selectedFiles.size > 0) {
        clearSelection();
    }
});

// Keyboard Navigation
function updateFocusUI() {
    document.querySelectorAll('.file-item.focused').forEach(el => el.classList.remove('focused'));
    const items = document.querySelectorAll('.file-item');
    if (focusedIndex >= 0 && focusedIndex < items.length) {
        items[focusedIndex].classList.add('focused');
        items[focusedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function getGridColumns() {
    const grid = document.getElementById('fileGrid');
    if (viewMode === 'list') return 1;
    const gridStyle = getComputedStyle(grid);
    const columns = gridStyle.gridTemplateColumns.split(' ').length;
    return columns || 1;
}

function moveFocus(delta) {
    const items = document.querySelectorAll('.file-item');
    if (items.length === 0) return;

    if (focusedIndex < 0) {
        focusedIndex = 0;
    } else {
        focusedIndex = Math.max(0, Math.min(items.length - 1, focusedIndex + delta));
    }
    updateFocusUI();
}

function handleKeyboardNav(e) {
    // Skip if in input/modal
    if (e.target.matches('input, textarea, select') ||
        document.querySelector('.modal.active') ||
        document.getElementById('globalSearch').classList.contains('active')) {
        return;
    }

    const items = document.querySelectorAll('.file-item');
    const cols = getGridColumns();

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            moveFocus(viewMode === 'list' ? 1 : cols);
            break;
        case 'ArrowUp':
            e.preventDefault();
            moveFocus(viewMode === 'list' ? -1 : -cols);
            break;
        case 'ArrowRight':
            if (viewMode === 'grid') {
                e.preventDefault();
                moveFocus(1);
            }
            break;
        case 'ArrowLeft':
            if (viewMode === 'grid') {
                e.preventDefault();
                moveFocus(-1);
            }
            break;
        case ' ':
            e.preventDefault();
            if (focusedIndex >= 0 && focusedIndex < items.length) {
                const path = items[focusedIndex].dataset.path;
                toggleSelection(path);
                lastSelectedIndex = focusedIndex;
            }
            break;
        case 'Enter':
            e.preventDefault();
            if (focusedIndex >= 0 && focusedIndex < items.length) {
                const item = items[focusedIndex];
                const path = item.dataset.path;
                const isDir = item.dataset.isDir === 'true';
                handleItemDblClick(e, path, isDir);
            }
            break;
        case 'Backspace':
            e.preventDefault();
            if (currentPath) {
                const parts = currentPath.split('/');
                parts.pop();
                navigate(parts.join('/'));
            }
            break;
        case 'Escape':
            e.preventDefault();
            clearSelection();
            clearClipboard();
            focusedIndex = -1;
            updateFocusUI();
            break;
        case 'a':
            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                items.forEach(item => selectedFiles.add(item.dataset.path));
                updateSelectionUI();
            }
            break;
        case 'c':
            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                copyToClipboard('copy');
            }
            break;
        case 'x':
            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                copyToClipboard('cut');
            }
            break;
        case 'v':
            // Only claim Ctrl/Cmd+V when files are staged in Boxy's own clipboard.
            // Otherwise fall through without preventDefault so the browser still
            // fires its native paste event and OS-clipboard content (images,
            // files, text) reaches the paste handler below.
            if ((e.metaKey || e.ctrlKey) && clipboard.paths.length > 0) {
                e.preventDefault();
                pasteClipboard();
            }
            break;
        case '?':
            e.preventDefault();
            showShortcutsModal();
            break;
        case '/':
        case 'f':
            if (e.key === '/' || (e.key === 'f' && (e.metaKey || e.ctrlKey))) {
                e.preventDefault();
                openGlobalSearch();
            }
            break;
        case '0':
            if (selectedFiles.size > 0) {
                e.preventDefault();
                bulkDelete();
            }
            break;
    }
}

document.addEventListener('keydown', handleKeyboardNav);

// Global Search
let globalSearchResults = [];
let globalSearchFocusIndex = -1;
let searchDebounceTimer = null;

function openGlobalSearch() {
    document.getElementById('globalSearch').classList.add('active');
    document.getElementById('globalSearchInput').value = '';
    document.getElementById('globalSearchResults').innerHTML = '';
    globalSearchResults = [];
    globalSearchFocusIndex = -1;
    setTimeout(() => document.getElementById('globalSearchInput').focus(), 50);
}

function closeGlobalSearch() {
    clearTimeout(searchDebounceTimer);
    globalSearchController?.abort();
    ++globalSearchVersion;
    document.getElementById('globalSearch').classList.remove('active');
    document.getElementById('globalSearchInput').value = '';
}

let globalSearchController = null;
let globalSearchVersion = 0;
async function performGlobalSearch(query) {
    globalSearchController?.abort();
    const version = ++globalSearchVersion;
    const controller = globalSearchController = new AbortController();
    if (!query.trim()) {
        document.getElementById('globalSearchResults').innerHTML = '';
        globalSearchResults = []; globalSearchFocusIndex = -1; return;
    }
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!res.ok) throw new Error('Search failed');
        const results = await res.json();
        if (version !== globalSearchVersion) return;
        globalSearchResults = results; globalSearchFocusIndex = -1;
        renderGlobalSearchResults();
    } catch (err) {
        if (err.name !== 'AbortError') showToast('Search failed. Try again.', 'error');
    }
}

function renderGlobalSearchResults() {
    const container = document.getElementById('globalSearchResults');

    if (globalSearchResults.length === 0) {
        container.innerHTML = `
            <div class="search-no-results">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <p>No files found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = globalSearchResults.map((result, index) => {
        const icon = getFileIcon(result.name, result.is_dir);
        const parentPath = result.path.includes('/')
            ? '/' + result.path.substring(0, result.path.lastIndexOf('/'))
            : '/';
        const focusedClass = index === globalSearchFocusIndex ? 'focused' : '';

        return `
            <div class="search-result-item ${focusedClass}"
                 data-path="${htmlAttr(result.path)}"
                 data-is-dir="${result.is_dir}"
                 onclick="openSearchResult('${escapeAttr(result.path)}', ${result.is_dir})">
                <div class="search-result-icon">${icon}</div>
                <div class="search-result-info">
                    <div class="search-result-name">${escapeHtml(result.name)}</div>
                    <div class="search-result-path">${escapeHtml(parentPath)}</div>
                </div>
                <div class="search-result-meta">${result.is_dir ? 'Folder' : formatSize(result.size)}</div>
            </div>
        `;
    }).join('');
}

function openSearchResult(path, isDir) {
    closeGlobalSearch();
    if (isDir) {
        navigate(path);
    } else {
        // Navigate to parent folder and highlight file
        const parts = path.split('/');
        parts.pop();
        const parentPath = parts.join('/');
        currentPath = parentPath;
        history.pushState(null, '', '#' + (encodeURIComponent(parentPath) || '/'));
        loadFiles().then(() => {
            // Select and focus the file
            selectedFiles.clear();
            selectedFiles.add(path);
            updateSelectionUI();
            focusedIndex = getItemIndex(path);
            updateFocusUI();
        });
    }
}

function updateGlobalSearchFocus() {
    document.querySelectorAll('.search-result-item').forEach((el, i) => {
        el.classList.toggle('focused', i === globalSearchFocusIndex);
    });
    const focused = document.querySelector('.search-result-item.focused');
    if (focused) focused.scrollIntoView({ block: 'nearest' });
}

document.getElementById('globalSearchInput').addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        performGlobalSearch(e.target.value);
    }, 150);
});

document.getElementById('globalSearchInput').addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            if (globalSearchResults.length > 0) {
                globalSearchFocusIndex = Math.min(globalSearchFocusIndex + 1, globalSearchResults.length - 1);
                updateGlobalSearchFocus();
            }
            break;
        case 'ArrowUp':
            e.preventDefault();
            if (globalSearchResults.length > 0) {
                globalSearchFocusIndex = Math.max(globalSearchFocusIndex - 1, 0);
                updateGlobalSearchFocus();
            }
            break;
        case 'Enter':
            e.preventDefault();
            if (globalSearchFocusIndex >= 0 && globalSearchFocusIndex < globalSearchResults.length) {
                const result = globalSearchResults[globalSearchFocusIndex];
                openSearchResult(result.path, result.is_dir);
            }
            break;
        case 'Escape':
            e.preventDefault();
            closeGlobalSearch();
            break;
    }
});

document.getElementById('globalSearch').addEventListener('click', (e) => {
    if (e.target.id === 'globalSearch') {
        closeGlobalSearch();
    }
});

// ============================================
// SIDEBAR FOLDER TREE  (reuses buildFolderTree)
// ============================================
let sidebarTreeData = [];
let sidebarExpanded = new Set(ls.json('boxy_sidebar_expanded'));

async function loadSidebarTree() {
    try {
        const res = await fetch('/api/folders');
        if (!res.ok) return;
        sidebarTreeData = buildFolderTree(await res.json());
        renderSidebar();
    } catch { /* non-fatal: sidebar is an enhancement */ }
}

// Root storage totals shown as a compact footer under the folder tree.
// Silently hidden if the backend doesn't support /api/stats yet.
async function loadSidebarStats() {
    const footer = document.getElementById('sidebarStorageFooter');
    if (!footer) return;
    try {
        const res = await fetch('/api/stats?path=');
        if (!res.ok) { footer.style.display = 'none'; return; }
        const stats = await res.json();
        footer.textContent = `${stats.files} file${stats.files === 1 ? '' : 's'} · ${stats.folders} folder${stats.folders === 1 ? '' : 's'} · ${formatSize(stats.bytes)}`;
        footer.style.display = '';
    } catch {
        footer.style.display = 'none';
    }
}
const debouncedLoadSidebarStats = debounce(() => {
    if (document.hidden) needsLiveRefresh = true;
    else loadSidebarStats();
}, 2000);

function renderSidebar() {
    const tree = document.getElementById('sidebarTree');
    if (!tree) return;
    let html = `
        <div class="tree-item sb-item ${currentPath === '' ? 'active' : ''}" role="treeitem"
             onclick="navigate('')" data-dest=""
             ondragover="handleSidebarDragOver(event)" ondragleave="handleSidebarDragLeave(event)" ondrop="handleSidebarDrop(event, '')">
            <div class="tree-toggle empty"></div>
            <svg class="tree-folder-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            <span class="tree-folder-name">Home</span>
        </div>`;
    html += renderSidebarNodes(sidebarTreeData, 0);
    tree.innerHTML = html;
    // Kinetic scroll-in on first paint only
    if (!sidebarAnimated && sidebarTreeData.length > 0) {
        sidebarAnimated = true;
        tree.querySelectorAll('.sb-item').forEach((el, i) => {
            el.classList.add('sb-enter');
            el.style.animationDelay = `${Math.min(i * 30, 300)}ms`;
        });
    }
}

function renderSidebarNodes(nodes, depth) {
    let html = '';
    nodes.forEach(node => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = sidebarExpanded.has(node.path);
        const isActive = currentPath === node.path;
        const p = escapeAttr(node.path);
        html += `
            <div class="tree-item sb-item ${isActive ? 'active' : ''}" role="treeitem" style="padding-left:${8 + depth * 15}px"
                 onclick="navigate('${p}')" data-dest="${htmlAttr(node.path)}"
                 ondragover="handleSidebarDragOver(event)" ondragleave="handleSidebarDragLeave(event)" ondrop="handleSidebarDrop(event, '${p}')">
                <div class="tree-toggle ${hasChildren ? (isExpanded ? 'expanded' : '') : 'empty'}"
                     onclick="event.stopPropagation(); toggleSidebarExpand('${p}')">
                    ${hasChildren ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>' : ''}
                </div>
                <svg class="tree-folder-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>
                <span class="tree-folder-name">${escapeHtml(node.name)}</span>
            </div>`;
        if (hasChildren && isExpanded) html += renderSidebarNodes(node.children, depth + 1);
        if (sidebarShowFiles && isExpanded && sidebarFileChildren[node.path]) {
            sidebarFileChildren[node.path].forEach(file => {
                html += `<div class="tree-item sb-item sb-file" style="padding-left:${8 + (depth+1) * 15}px"
                              onclick="navigate('${escapeAttr(node.path)}')" title="${htmlAttr(file.name)}">
                            <div class="tree-toggle empty"></div>
                            ${getFileIcon(file.name, false)}
                            <span class="tree-folder-name">${escapeHtml(file.name)}</span>
                         </div>`;
            });
        }
    });
    return html;
}

async function toggleSidebarExpand(path) {
    if (sidebarExpanded.has(path)) {
        sidebarExpanded.delete(path);
    } else {
        sidebarExpanded.add(path);
        if (sidebarShowFiles && !sidebarFileChildren.hasOwnProperty(path)) {
            try {
                const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
                if (res.ok) {
                    const all = await res.json();
                    sidebarFileChildren[path] = all.filter(f => !f.is_dir);
                } else sidebarFileChildren[path] = [];
            } catch { sidebarFileChildren[path] = []; }
        }
    }
    ls.set('boxy_sidebar_expanded', JSON.stringify([...sidebarExpanded]));
    renderSidebar();
}

async function toggleSidebarShowFiles() {
    sidebarShowFiles = !sidebarShowFiles;
    ls.set('sidebarShowFiles', sidebarShowFiles ? '1' : '0');
    const btn = document.getElementById('sidebarFilesToggleBtn');
    if (btn) btn.classList.toggle('active', sidebarShowFiles);
    sidebarFileChildren = {};
    if (sidebarShowFiles && sidebarExpanded.size > 0) {
        await Promise.all([...sidebarExpanded].map(async path => {
            try {
                const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
                if (res.ok) {
                    const all = await res.json();
                    sidebarFileChildren[path] = all.filter(f => !f.is_dir);
                } else sidebarFileChildren[path] = [];
            } catch { sidebarFileChildren[path] = []; }
        }));
    }
    renderSidebar();
}

function collectAllSidebarPaths(nodes) {
    let paths = [];
    nodes.forEach(n => {
        paths.push(n.path);
        if (n.children && n.children.length) paths.push(...collectAllSidebarPaths(n.children));
    });
    return paths;
}

function sidebarExpandAll() {
    collectAllSidebarPaths(sidebarTreeData).forEach(p => sidebarExpanded.add(p));
    ls.set('boxy_sidebar_expanded', JSON.stringify([...sidebarExpanded]));
    renderSidebar();
}

function sidebarCollapseAll() {
    sidebarExpanded.clear();
    sidebarFileChildren = {};
    ls.set('boxy_sidebar_expanded', '[]');
    renderSidebar();
}

function toggleSidebar() {
    const sb = document.getElementById('filesSidebar');
    sb.classList.toggle('collapsed');
    ls.set('boxy_sidebar_collapsed', sb.classList.contains('collapsed') ? '1' : '0');
}

function handleSidebarDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drop-target'); }
function handleSidebarDragLeave(e) { e.currentTarget.classList.remove('drop-target'); }
async function handleSidebarDrop(e, dest) {
    e.preventDefault();
    e.currentTarget.classList.remove('drop-target');
    const dropped = e.dataTransfer.getData('text/plain');
    if (!dropped) return;
    const paths = (selectedFiles.has(dropped) && selectedFiles.size > 1) ? [...selectedFiles] : [dropped];
    let moved = 0;
    for (const p of paths) {
        if (p === dest) continue;
        const res = await fetch('/api/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: p, dest_dir: dest }) });
        if (res.ok) moved++;
    }
    clearSelection();
    loadFiles();
    showToast(`Moved ${moved} item${moved === 1 ? '' : 's'}`, moved ? 'success' : 'error');
}

// ============================================
// RIGHT-CLICK CONTEXT MENU
// ============================================
let ctxTarget = null;
const CM_ICON = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${p}</svg>`;
// SVG path snippets use double quotes so they sit safely inside single-quoted JS strings.
const CM_ICONS = {
    openFolder: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    preview: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    rename: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    move: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    duplicate: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/>',
    paste: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>'
};

function showContextMenu(e, path, name, isDir) {
    e.preventDefault();
    ctxTarget = e.currentTarget;
    const p = escapeAttr(path);
    const menu = document.getElementById('contextMenu');
    const items = [];
    if (isDir) {
        items.push(`<button class="context-menu-item" role="menuitem" onclick="closeContextMenu(); navigate('${p}')">${CM_ICON(CM_ICONS.openFolder)} Open folder</button>`);
        items.push(`<button class="context-menu-item" role="menuitem" onclick="closeContextMenu(); downloadZip('${p}')">${CM_ICON(CM_ICONS.download)} Download as ZIP</button>`);
        items.push(`<button class="context-menu-item" role="menuitem" onclick="closeContextMenu(); duplicateItem('${p}')">${CM_ICON(CM_ICONS.duplicate)} Duplicate</button>`);
    } else {
        items.push(`<button class="context-menu-item" role="menuitem" onclick="closeContextMenu(); window.open('/api/download?path=' + encodeURIComponent('${p}'), '_blank')">${CM_ICON(CM_ICONS.preview)} Preview</button>`);
        items.push(`<button class="context-menu-item" role="menuitem" onclick="closeContextMenu(); downloadFile('${p}')">${CM_ICON(CM_ICONS.download)} Download</button>`);
        items.push(`<button class="context-menu-item" role="menuitem" onclick="closeContextMenu(); duplicateItem('${p}')">${CM_ICON(CM_ICONS.duplicate)} Duplicate</button>`);
        items.push(`<button class="context-menu-item" role="menuitem" onclick="closeContextMenu(); copyFileUrl('${p}')">${CM_ICON(CM_ICONS.link)} Copy URL</button>`);
        if (isEditableFile(name)) {
            items.push(`<button class="context-menu-item" role="menuitem" onclick="closeContextMenu(); showEditModal('${p}')">${CM_ICON(CM_ICONS.edit)} Edit</button>`);
        }
    }
    items.push('<div class="context-menu-sep"></div>');
    items.push(`<button class="context-menu-item" role="menuitem" onclick="closeContextMenu(); inlineRenameFromCtx()">${CM_ICON(CM_ICONS.rename)} Rename</button>`);
    items.push(`<button class="context-menu-item" role="menuitem" onclick="closeContextMenu(); showMoveModal('${p}')">${CM_ICON(CM_ICONS.move)} Move…</button>`);
    items.push(`<button class="context-menu-item" role="menuitem" onclick="closeContextMenu(); copyToClipboard('copy', '${p}')">${CM_ICON(CM_ICONS.copy)} Copy</button>`);
    items.push(`<button class="context-menu-item" role="menuitem" onclick="closeContextMenu(); copyToClipboard('cut', '${p}')">${CM_ICON(CM_ICONS.cut)} Cut</button>`);
    if (clipboard.paths.length > 0) {
        items.push(`<button class="context-menu-item" role="menuitem" onclick="closeContextMenu(); pasteClipboard()">${CM_ICON(CM_ICONS.paste)} Paste (${clipboard.paths.length})</button>`);
    }
    items.push('<div class="context-menu-sep"></div>');
    items.push(`<button class="context-menu-item danger" role="menuitem" onclick="closeContextMenu(); deleteItem('${p}')">${CM_ICON(CM_ICONS.trash)} Delete</button>`);
    menu.classList.remove('show');
    menu.innerHTML = items.join('');
    void menu.offsetWidth; // restart the pop transition when re-opened on another item
    menu.classList.add('show');
    const r = menu.getBoundingClientRect();
    let x = e.clientX, y = e.clientY;
    if (x + r.width > window.innerWidth) x = window.innerWidth - r.width - 8;
    if (y + r.height > window.innerHeight) y = window.innerHeight - r.height - 8;
    const finalX = Math.max(8, x), finalY = Math.max(8, y);
    menu.style.left = finalX + 'px';
    menu.style.top = finalY + 'px';
    // Springy pop scales out from the cursor position
    menu.style.transformOrigin = `${e.clientX - finalX}px ${e.clientY - finalY}px`;
}

function closeContextMenu() { document.getElementById('contextMenu').classList.remove('show'); }
function inlineRenameFromCtx() { startInlineRename(ctxTarget); }

function showColFilter(event, col) {
    const colLabel = col === 'name' ? 'Name' : col === 'type' ? 'Type' : 'Date';
    const currentText = colTextFilters[col] || '';
    const current = colFilters[col] || new Set();

    const unique = [...new Set(allFiles.map(f => {
        if (col === 'name') return f.name;
        if (col === 'type') return getFileType(f.name, f.is_dir);
        if (col === 'modified') return f.modified ? formatDatePart(f.modified) : '';
        return '';
    }))].filter(Boolean).sort();

    const countFor = v => allFiles.filter(f => {
        if (col === 'name') return f.name === v;
        if (col === 'type') return getFileType(f.name, f.is_dir) === v;
        if (col === 'modified') return f.modified && formatDatePart(f.modified) === v;
        return false;
    }).length;

    const html = `
        <div class="col-filter-header">${colLabel}
            <button class="col-filter-clear-btn" onclick="clearColFilter('${col}')">Clear all</button>
        </div>
        <div class="col-filter-search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="colFilterSearch_${col}" class="col-filter-search" placeholder="Contains text…" value="${htmlAttr(currentText)}"
                oninput="setColTextFilter('${col}', this.value)"
                onkeydown="if(event.key==='Escape'){clearColFilter('${col}');}"
                onclick="event.stopPropagation()">
        </div>
        <div class="col-filter-divider"></div>
        ${unique.map(v =>
            `<label class="col-filter-item">
                <input type="checkbox" ${current.has(v) ? 'checked' : ''}
                    onchange="toggleColFilter('${col}','${escapeAttr(v)}',this.checked)">
                <span class="col-filter-label">${escapeHtml(v)}</span>
                <span class="col-filter-count">${countFor(v)}</span>
            </label>`
        ).join('')}`;

    const dd = document.getElementById('colFilterDropdown');
    dd.innerHTML = html;
    const rect = event.target.getBoundingClientRect();
    dd.style.top = (rect.bottom + 4) + 'px';
    dd.style.left = Math.min(rect.left, window.innerWidth - 240) + 'px';
    dd.classList.add('show');
    event.stopPropagation();
    // Auto-focus the search input
    setTimeout(() => { const inp = document.getElementById(`colFilterSearch_${col}`); if (inp) inp.focus(); }, 30);
}

function setColTextFilter(col, text) {
    if (text.trim()) colTextFilters[col] = text.trim();
    else delete colTextFilters[col];
    renderFiles(allFiles);
}

function toggleColFilter(col, val, checked) {
    if (!colFilters[col]) colFilters[col] = new Set();
    if (checked) colFilters[col].add(val); else colFilters[col].delete(val);
    if (colFilters[col].size === 0) delete colFilters[col];
    renderFiles(allFiles);
}

function clearColFilter(col) {
    delete colFilters[col];
    delete colTextFilters[col];
    document.getElementById('colFilterDropdown').classList.remove('show');
    renderFiles(allFiles);
}

// ============================================
// INLINE RENAME (no modal)
// ============================================
function startInlineRename(itemEl) {
    if (!itemEl) return;
    const nameEl = itemEl.querySelector('.file-name');
    if (!nameEl || itemEl.querySelector('.inline-rename')) return;
    const oldPath = itemEl.dataset.path;
    const current = nameEl.textContent;
    const input = document.createElement('input');
    input.className = 'inline-rename';
    input.value = current;
    nameEl.replaceWith(input);
    input.focus();
    const dot = current.lastIndexOf('.');
    input.setSelectionRange(0, dot > 0 ? dot : current.length);
    let done = false;
    const restore = () => { if (!done) { done = true; input.replaceWith(nameEl); } };
    const commit = async () => {
        if (done) return;
        const newName = input.value.trim();
        if (!newName || newName === current) { restore(); return; }
        done = true;
        try {
            if (await renamePath(oldPath, newName)) showToast('Renamed', 'success');
            else input.replaceWith(nameEl);
        } catch { showToast('Rename failed', 'error'); input.replaceWith(nameEl); }
    };
    input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'Escape') { e.preventDefault(); restore(); }
    });
    input.addEventListener('blur', commit);
}

// Skeleton loader shown while a folder listing is in flight
function showSkeleton() {
    const grid = document.getElementById('fileGrid');
    if (!grid) return;
    const count = 8;
    if (viewMode === 'list') {
        grid.className = 'file-table';
        grid.innerHTML = Array.from({ length: count }, () => '<div class="skeleton skeleton-row"></div>').join('');
    } else {
        grid.className = 'file-grid';
        grid.innerHTML = Array.from({ length: count }, () => '<div class="skeleton"></div>').join('');
    }
}

// Close context menu on outside interaction; F2 renames the focused item.
document.addEventListener('click', (e) => {
    if (!e.target.closest('#contextMenu')) closeContextMenu();
    const cfdd = document.getElementById('colFilterDropdown');
    if (cfdd && !cfdd.contains(e.target)) cfdd.classList.remove('show');
});
// Dismiss on user scrolling, not scroll events caused by layout/animation updates.
window.addEventListener('wheel', closeContextMenu, { passive: true });
window.addEventListener('touchmove', closeContextMenu, { passive: true });
window.addEventListener('resize', closeContextMenu);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeContextMenu();
    if (e.key === 'F2' && focusedIndex >= 0) {
        const items = document.querySelectorAll('#fileGrid .file-item');
        if (items[focusedIndex]) { e.preventDefault(); startInlineRename(items[focusedIndex]); }
    }
});

// Global error boundary so a thrown exception never leaves a frozen UI silently.
window.addEventListener('error', () => showToast('Something went wrong', 'error'));
window.addEventListener('unhandledrejection', () => showToast('A request failed', 'error'));

// Browser-level connectivity — surfaces alongside WS state, doesn't replace it.
window.addEventListener('offline', showReconnectBanner);
window.addEventListener('online', hideReconnectBanner);

function decodeFolderHash() {
    try { return decodeURIComponent(location.hash.slice(1)); } catch { return location.hash.slice(1); }
}
let pinnedFolders = ls.json('boxy_pins').slice(0, 12);
function updateWorkspaceHeading() {
    document.getElementById('folderTitle').textContent = currentPath ? currentPath.split('/').pop() : 'All files';
    const files = allFiles.filter(f => !f.is_dir);
    document.getElementById('folderSummary').textContent = `${files.length} files · ${allFiles.length - files.length} folders · ${formatSize(files.reduce((n, f) => n + f.size, 0))} in this folder`;
    const pin = document.getElementById('pinFolderBtn');
    pin.disabled = !currentPath;
    pin.setAttribute('aria-pressed', String(pinnedFolders.includes(currentPath)));
    pin.textContent = pinnedFolders.includes(currentPath) ? 'Pinned ✓' : 'Pin folder';
    renderPinnedFolders();
}
function togglePinnedFolder(path = currentPath) {
    if (!path) return;
    if (pinnedFolders.includes(path)) pinnedFolders = pinnedFolders.filter(p => p !== path);
    else if (pinnedFolders.length < 12) pinnedFolders.push(path);
    else { showToast('You can pin up to 12 folders'); return; }
    ls.set('boxy_pins', JSON.stringify(pinnedFolders));
    updateWorkspaceHeading();
}
function remapPinnedFolders(oldPath, newPath) {
    pinnedFolders = pinnedFolders.map(path => path === oldPath ? newPath : path.startsWith(oldPath + '/') ? newPath + path.slice(oldPath.length) : path);
    ls.set('boxy_pins', JSON.stringify(pinnedFolders));
    updateWorkspaceHeading();
}
function renderPinnedFolders() {
    const container = document.getElementById('sidebarPins');
    container.replaceChildren();
    const heading = document.createElement('h2'); heading.textContent = 'QUICK ACCESS'; container.append(heading);
    if (!pinnedFolders.length) {
        const hint = document.createElement('p'); hint.className = 'pin-empty'; hint.textContent = 'Pin a folder to keep it close.'; container.append(hint);
    }
    pinnedFolders.forEach(path => {
        const row = document.createElement('div'); row.className = 'pin-entry';
        const link = document.createElement('button'); link.className = 'pin-link' + (currentPath === path ? ' active' : '');
        link.title = '/' + path; link.innerHTML = getFileIcon('', true);
        const label = document.createElement('span'); label.textContent = path.split('/').pop(); link.append(label);
        link.onclick = () => navigate(path);
        const remove = document.createElement('button'); remove.className = 'unpin-btn'; remove.textContent = '×'; remove.setAttribute('aria-label', `Unpin ${path}`); remove.onclick = () => togglePinnedFolder(path);
        row.append(link, remove); container.append(row);
    });
}
function toggleMobileFolders() {
    const sidebar = document.getElementById('filesSidebar'); sidebar.classList.remove('collapsed');
    const open = sidebar.classList.toggle('mobile-open');
    document.getElementById('mobileFoldersBtn').setAttribute('aria-expanded', String(open));
}
function clearAllFilters() {
    filterQuery = ''; filterType = 'all'; colFilters = {}; colTextFilters = {};
    document.getElementById('searchInput').value = '';
    document.getElementById('filterSelect').value = 'all'; ls.set('filterType', 'all');
    renderFiles(allFiles);
}
async function refreshWorkspace() {
    expandedFolderContents = {}; sidebarFileChildren = {};
    await Promise.allSettled([loadFiles(), loadSidebarTree(), loadSidebarStats()]);
}
window.addEventListener('storage', e => {
    if (e.key === 'boxy_pins') { pinnedFolders = ls.json('boxy_pins').slice(0, 12); updateWorkspaceHeading(); }
});
// Restore focus and constrain tabbing to the active dialog.
let dialogReturnFocus = null;
const dialogObserver = new MutationObserver(() => {
    const active = document.querySelector('.modal.active, .global-search.active');
    if (active && !dialogReturnFocus) dialogReturnFocus = document.activeElement;
    if (!active && dialogReturnFocus) { dialogReturnFocus.focus?.(); dialogReturnFocus = null; }
});
document.querySelectorAll('.modal, .global-search').forEach(dialog => {
    const heading = dialog.querySelector('h3');
    if (heading) { heading.id ||= dialog.id + 'Heading'; dialog.setAttribute('aria-labelledby', heading.id); }
    dialogObserver.observe(dialog, { attributes: true, attributeFilter: ['class'] });
});
document.addEventListener('keydown', e => {
    const active = document.querySelector('.modal.active, .global-search.active');
    if (!active) return;
    if (e.key === 'Escape') {
        e.preventDefault();
        if (active.id === 'editModal') closeEditModal();
        else if (active.id === 'globalSearch') closeGlobalSearch();
        else active.classList.remove('active');
        return;
    }
    if (e.key !== 'Tab') return;
    const elements = [...active.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
    if (!elements.length) return;
    const first = elements[0], last = elements[elements.length - 1];
    if (e.shiftKey && (document.activeElement === first || !active.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !active.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
});

// Init
document.getElementById('filterSelect').value = filterType;
document.getElementById('sortSelect').value = sortMode;
updateViewIcon();
if (ls.get('boxy_sidebar_collapsed') === '1') {
    document.getElementById('filesSidebar').classList.add('collapsed');
}
// URL hash routing
window.addEventListener('popstate', () => {
    const hash = decodeFolderHash();
    const path = (hash && hash !== '/') ? hash : '';
    currentPath = path;
    loadFiles();
    updateBreadcrumb();
});
// Restore path from URL hash on load
const initialHash = decodeFolderHash();
if (initialHash && initialHash !== '/') {
    currentPath = initialHash;
}

// Zoom slider init
const zoomSlider = document.getElementById('zoomSlider');
if (zoomSlider) {
    zoomSlider.value = itemScale;
    zoomSlider.addEventListener('input', e => setItemScale(e.target.value));
}

// Path bar keyboard nav
const pathBarEl = document.getElementById('pathBar');
if (pathBarEl) {
    pathBarEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            let val = pathBarEl.value.trim().replace(/^\/+/, '').replace(/\/+$/, '');
            navigate(val);
        }
        if (e.key === 'Escape') {
            updatePathBar();
            pathBarEl.blur();
        }
    });
    pathBarEl.addEventListener('blur', updatePathBar);
}

// Sidebar files toggle button state
const sftBtn = document.getElementById('sidebarFilesToggleBtn');
if (sftBtn) sftBtn.classList.toggle('active', sidebarShowFiles);

// Lightbox keyboard nav
document.addEventListener('keydown', e => {
    const lb = document.getElementById('lightbox');
    if (!lb || !lb.classList.contains('show')) return;
    if (e.key === 'ArrowLeft') lightboxNav(-1);
    if (e.key === 'ArrowRight') lightboxNav(1);
    if (e.key === 'Escape') { document.getElementById('lightbox').classList.remove('show'); document.body.style.overflow = ''; }
});

// Media preview modal keyboard close
document.addEventListener('keydown', e => {
    const mp = document.getElementById('mediaPreviewModal');
    if (mp && mp.classList.contains('active') && e.key === 'Escape') closeMediaPreview();
});

// Shortcuts modal keyboard close
document.addEventListener('keydown', e => {
    const sm = document.getElementById('shortcutsModal');
    if (sm && sm.classList.contains('active') && e.key === 'Escape') closeShortcutsModal();
});

updateWorkspaceHeading();
showSkeleton();
connectWS();
loadFiles();
loadSidebarTree();
loadSidebarStats();
