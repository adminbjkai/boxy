---
description: Frontend patterns for Boxy - CSS variables, animations, vanilla JS
globs: static/**/*
alwaysApply: false
---

# Boxy UI Patterns

## Tech Stack
- Vanilla JavaScript (no frameworks)
- CSS variables for theming
- CSS in `static/app.css` (embedded in the binary)
- JS lives in `static/app.js`

## CSS Architecture

### Theme Variables
The app is **dark-mode-first**: JavaScript chooses dark by default. `:root` holds the light palette and
`[data-theme="dark"]` overrides it.

```css
:root { --bg: #f4f3ed; --text: #202e2e; --accent: #23786b; }
[data-theme="dark"] { --bg: #11191c; --text: #e5eeea; --accent: #80cdb5; }
```
Also defined as tokens (use these instead of hardcoded values):
`--radius-{sm,md,lg,xl}`, motion (`--ease`, `--motion`, `--motion-fast`),
priority accents (`--priority-{high,medium,low}`), layout (`--sidebar-width`, `--z-menu`).

### Theme: dark-mode-first
Default to dark when no preference is stored:
```javascript
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
// toggleTheme() flips data-theme and persists to localStorage('theme')
```

### Resource discipline
- Keep `backdrop-filter` to the header/nav only.
- Always ship a `@media (prefers-reduced-motion: reduce)` block that zeroes animations/transitions.

### Components added in the overhaul
- **Sidebar tree** (`.files-sidebar` / `.sb-item`), **context menu** (`.context-menu`),
  **inline rename** (`.inline-rename`), **toast variants** (`.toast.success/.error/.info`),
  **skeleton loaders** (`.skeleton` + `@keyframes shimmer`).
- `showToast(msg, type)` builds an icon + sets the text via `textContent` (XSS-safe).

## Animation Patterns

### Staggered Entry
```css
@keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}

.file-item {
    animation: fadeUp 0.2s ease forwards;
}
```

```javascript
// Stagger in JS
items.forEach((item, i) => {
    item.style.animationDelay = `${i * 20}ms`;
});
```

### Toast Notifications
```javascript
// type: 'success' | 'error' | 'info'
function showToast(msg, type) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;          // XSS-safe (textContent, not innerHTML)
    toast.className = `toast show ${type ?? 'info'}`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}
```

## State Management

### Module-Level State
```javascript
let currentPath = '';      // Navigation context
let ws = null;             // WebSocket connection
let allFiles = [];         // Full file list
let filterQuery = '';      // Search filter
let sortMode = 'name';     // Sort criterion
let draggedItem = null;    // Drag context
let selectedFiles = new Set();  // Multi-select
let focusedIndex = -1;     // Keyboard navigation
```

### WebSocket Handler
```javascript
function connectWS() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}/ws`);

    ws.onmessage = async (e) => {
        const { action, path } = JSON.parse(e.data);
        // actions: upload | folder | rename | move | delete | edit | copy
        loadFiles();  // Refresh files
        showToast(`${action}: ${path}`);
    };

    ws.onclose = () => {
        setTimeout(connectWS, 2000);  // Auto-reconnect
    };
}
```

## Security (CRITICAL)

### XSS Sinks (Never use with unescaped user data)
- `innerHTML` — only escaped content or constant strings
- `insertAdjacentHTML` — only escaped content or constant strings
- `outerHTML` — only escaped content or constant strings

### XSS Prevention
```javascript
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    return str
        .replace(/\\/g, '\\\\')   // Escape backslashes first
        .replace(/'/g, "\\'")     // Escape single quotes for JS
        .replace(/"/g, '&quot;'); // Escape double quotes for HTML
}

// Always escape user content in templates
`<div title="${escapeAttr(file.name)}">${escapeHtml(file.name)}</div>`
```

## Rendering Pattern

### Template Literal Grid
```javascript
function renderFiles() {
    const html = files.map((file, i) => `
        <div class="file-item"
             style="animation-delay: ${i * 20}ms"
             data-path="${escapeAttr(file.path)}"
             onclick="handleClick(this)">
            ${getIcon(file)}
            <span>${escapeHtml(file.name)}</span>
        </div>
    `).join('');

    container.innerHTML = html;
}
```

## Modal Pattern
```javascript
function showModal(id) {
    document.getElementById(id).classList.add('active');
}

function hideModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove('active');
    modal.querySelector('input')?.value = '';
}
```

## File Icons
```javascript
const iconMap = {
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
    pdf: ['pdf'],
    doc: ['doc', 'docx', 'txt', 'rtf'],
    code: ['js', 'ts', 'rs', 'py', 'html', 'css', 'json'],
    video: ['mp4', 'mov', 'avi', 'mkv'],
    audio: ['mp3', 'wav', 'flac', 'ogg'],
    archive: ['zip', 'tar', 'gz', 'rar'],
};
```

## Rules
1. No JS frameworks; only the vendored libs under `static/vendor/` (Prism.js, marked.js) — don't add more
2. Use CSS variables for all colors (defined in `static/app.css`)
3. Always escape user content (XSS)
4. Auto-reconnect WebSocket on disconnect
5. Stagger animations for visual polish
6. **Use grep before reading** — `rg 'pattern' static/`, then `sed -n` for targeted ranges

## Pre-Change Checklist
- [ ] `escapeHtml()` used for all user content in innerHTML
- [ ] `escapeAttr()` used for all user content in attributes
- [ ] WS reconnect logic preserved (max 30s backoff)
- [ ] No inline styles overriding CSS variables
