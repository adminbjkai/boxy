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
    --bg: #f8fafc;
    --text: #1e293b;
    --accent: #3b82f6;
    --border: #e2e8f0;
    --hover: #f1f5f9;
    --shadow: 0 1px 3px rgba(0,0,0,0.1);
}

[data-theme="dark"] {
    --bg: #0f172a;
    --text: #f1f5f9;
    /* ... */
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
```

### WebSocket Handler
```javascript
function connectWebSocket() {
    ws = new WebSocket(`ws://${location.host}/ws`);

    ws.onmessage = (e) => {
        const { action, path } = JSON.parse(e.data);
        loadFiles();  // Refresh
        showToast(`${action}: ${path}`);
    };

    ws.onclose = () => {
        setTimeout(connectWebSocket, 2000);  // Auto-reconnect
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
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
