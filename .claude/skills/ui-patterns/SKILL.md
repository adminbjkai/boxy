---
description: Frontend patterns for Boxy - CSS variables, animations, vanilla JS
globs: static/**/*
alwaysApply: false
---

# Boxy UI Patterns

## Tech Stack
- Vanilla JavaScript (no frameworks)
- CSS variables for theming
- Embedded in single index.html

## CSS Architecture

### Theme Variables
```css
:root {
    --bg: #f3f1ed;
    --bg-secondary: #ffffff;
    --bg-tertiary: #ece9e3;
    --border: #d8d2c9;
    --text: #1a1a1a;
    --text-secondary: #6d6d6d;
    --accent: #2f6df6;
    --accent-hover: #2a61d9;
    --danger: #ff3b30;
    --success: #34c759;
    --shadow: rgba(0,0,0,0.08);
    --transition: 0.2s ease;
}

[data-theme="dark"] {
    --bg: #161719;
    --bg-secondary: #212327;
    --bg-tertiary: #2b2f35;
    --border: #343944;
    --text: #f4f2ee;
    --text-secondary: #a2a5ad;
}
```

### Theme Toggle Pattern
```javascript
function toggleTheme() {
    const current = document.documentElement.dataset.theme;
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
}
```

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
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
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

    ws.onmessage = (e) => {
        const { action, path } = JSON.parse(e.data);
        loadFiles();  // Refresh
        showToast(`${action}: ${path}`);
    };

    ws.onclose = () => {
        setTimeout(connectWS, 2000);  // Auto-reconnect
    };
}
```

## Security (CRITICAL)

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
1. No external JS dependencies
2. Use CSS variables for all colors
3. Always escape user content (XSS)
4. Auto-reconnect WebSocket on disconnect
5. Stagger animations for visual polish
