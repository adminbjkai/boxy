# Boxy Code Audit Report

**Date:** January 16, 2026
**Files Reviewed:** `src/main.rs`, `static/index.html`
**Auditor:** Claude Code Audit

---

## Executive Summary

Boxy is a file sharing and task management web application built with Actix-web (Rust) for the backend and vanilla JavaScript for the frontend. The codebase is generally well-structured, but this audit identified several security concerns, potential bugs, and areas for improvement.

**Finding Summary:**
- **High Priority:** 3 issues
- **Medium Priority:** 7 issues
- **Low Priority:** 6 issues

---

## High Priority Issues

### 1. Path Traversal Protection Incomplete
**File:** `src/main.rs` (lines 117-131)
**Severity:** HIGH

**Description:**
The `clean_relative_path` function strips `..` and `.` components, which is good. However, the protection could be bypassed in edge cases:

```rust
fn clean_relative_path(path: &str) -> PathBuf {
    let mut clean = PathBuf::new();
    for segment in path.split('/') {
        if segment.is_empty() || segment == "." || segment == ".." {
            continue;
        }
        clean.push(segment);
    }
    clean
}
```

**Issue:**
- Does not handle Windows-style backslashes (`\`) in paths, which could be used on Windows deployments
- Does not validate that the resolved path is actually within the upload directory after path resolution
- Symbolic link traversal is not addressed

**Recommendation:**
Add canonicalization check to ensure the resolved path starts with the base directory:

```rust
fn resolve_path_safe(base: &Path, path: Option<&String>) -> Option<PathBuf> {
    let resolved = path.map(|p| base.join(clean_relative_path(p)))
        .unwrap_or_else(|| base.to_path_buf());
    let canonical = resolved.canonicalize().ok()?;
    let base_canonical = base.canonicalize().ok()?;
    if canonical.starts_with(&base_canonical) {
        Some(resolved)
    } else {
        None
    }
}
```

---

### 2. No Upload Size Enforcement Per-Request
**File:** `src/main.rs` (lines 172-242)
**Severity:** HIGH

**Description:**
While `max_upload_bytes` is configured in `AppState` and set via `PayloadConfig`, the upload handler does not verify individual file sizes or total upload size during streaming.

**Issue:**
- A malicious client could potentially bypass the payload limit depending on how Actix handles multipart streams
- No validation of `mtimes` field size before parsing (DoS via large JSON)
- The `get_unique_filepath` loop (lines 256-267) has no upper bound - could loop indefinitely if counter overflows

**Recommendation:**
- Add explicit size tracking during file write
- Limit the size of the `mtimes` metadata field
- Add a maximum counter to `get_unique_filepath`

---

### 3. XSS Vulnerability in Error Messages
**File:** `static/index.html` (lines 3317, 3555-3566)
**Severity:** HIGH

**Description:**
Error messages from the server are displayed directly without sanitization:

```javascript
showToast(`Created ${escapeHtml(filename)}`);  // This is good
// BUT:
showToast(err.message);  // Line 3321 - NOT escaped!
document.getElementById('editStatus').textContent = err.message;  // Line 3564
```

**Issue:**
While `textContent` is safe, `showToast` sets `toast.textContent`, which IS safe. However, if error messages contain user-controlled data reflected from the server, and if the toast rendering ever changes to innerHTML, this becomes an XSS vector.

**Recommendation:**
Always escape error messages for defense-in-depth, even when using textContent.

---

## Medium Priority Issues

### 4. Missing Rate Limiting
**File:** `src/main.rs`
**Severity:** MEDIUM

**Description:**
The API has no rate limiting on any endpoints. An attacker could:
- Flood the upload endpoint to exhaust disk space
- Flood the search endpoint to cause CPU exhaustion
- Rapidly create/delete files to cause I/O issues

**Recommendation:**
Add rate limiting middleware, e.g., `actix-ratelimit` or similar.

---

### 5. Broadcast Channel Silently Drops Messages
**File:** `src/main.rs` (lines 67-74)
**Severity:** MEDIUM

**Description:**
```rust
let _ = tx.send(msg);
```

The result of `send()` is ignored. If the broadcast channel is full (buffer size 100), messages are dropped silently.

**Issue:**
- Clients may not receive real-time updates if many operations happen quickly
- No logging or monitoring of dropped messages

**Recommendation:**
At minimum, log when messages are dropped:
```rust
if tx.send(msg).is_err() {
    log::warn!("Broadcast buffer full, message dropped");
}
```

---

### 6. Delete Confirmation Only on Client Side
**File:** `static/index.html` (lines 3188-3197, 3200-3217)
**Severity:** MEDIUM

**Description:**
Delete operations have confirmation dialogs in JavaScript, but the server accepts delete requests without any verification. A CSRF attack or malicious script could delete files.

**Recommendation:**
- Consider adding CSRF tokens
- Add server-side soft-delete or trash functionality

---

### 7. Infinite Recursion Risk in Folder Operations
**File:** `src/main.rs` (lines 375-393, 437-479)
**Severity:** MEDIUM

**Description:**
The `collect_folders` and `collect_search_results` functions use async recursion with no depth limit. A deeply nested folder structure or circular symlinks could cause:
- Stack overflow
- Memory exhaustion
- Long response times

**Recommendation:**
Add a maximum depth parameter (e.g., 50 levels).

---

### 8. localStorage Task Data Injection
**File:** `static/index.html` (lines 4070-4071)
**Severity:** MEDIUM

**Description:**
```javascript
let tasks = JSON.parse(localStorage.getItem('boxy_tasks') || '[]');
let columns = JSON.parse(localStorage.getItem('boxy_columns') || JSON.stringify(DEFAULT_COLUMNS));
```

**Issue:**
If another script on the same origin or a malicious browser extension modifies localStorage, it could inject:
- Very large data causing memory issues
- Malformed data causing JavaScript errors
- Data containing script tags (though escapeHtml is used in rendering)

**Recommendation:**
Add validation of localStorage data structure and size limits.

---

### 9. WebSocket Reconnection Lacks Exponential Backoff
**File:** `static/index.html` (lines 2587-2589)
**Severity:** MEDIUM

**Description:**
```javascript
ws.onclose = () => {
    setTimeout(connectWS, 2000);
};
```

**Issue:**
Fixed 2-second retry interval could cause:
- Thundering herd problem if server restarts with many clients
- Unnecessary network traffic if server is down for extended period

**Recommendation:**
Implement exponential backoff with jitter.

---

### 10. No CORS Configuration
**File:** `src/main.rs`
**Severity:** MEDIUM

**Description:**
The server has no CORS configuration. By default, browsers will block cross-origin requests, but the server doesn't explicitly define allowed origins.

**Issue:**
If deployed behind a reverse proxy or accessed from a different domain, CORS errors will occur. Also, lack of explicit CORS policy means you're relying on browser defaults.

**Recommendation:**
Add explicit CORS middleware with defined allowed origins.

---

## Low Priority Issues

### 11. Unused `max_upload_bytes` Field
**File:** `src/main.rs` (line 40)
**Severity:** LOW (Dead Code)

**Description:**
The `AppState` struct contains `max_upload_bytes`, but it's only used to configure `PayloadConfig`. The value is never accessed from `AppState` at runtime.

```rust
struct AppState {
    broadcaster: Broadcaster,
    upload_dir: PathBuf,
    max_upload_bytes: usize,  // Only used in setup, not needed in state
}
```

**Recommendation:**
Remove from `AppState` if not needed at runtime, or use it in the upload handler for custom validation.

---

### 12. Hardcoded Magic Numbers
**File:** `src/main.rs`
**Severity:** LOW (Code Quality)

**Description:**
Several magic numbers are used without constants:
- `100` - broadcast channel buffer size (line 706)
- Various HTTP response statuses are handled implicitly

**Recommendation:**
Extract to named constants for clarity.

---

### 13. No Input Length Validation
**File:** `src/main.rs` (multiple locations)
**Severity:** LOW

**Description:**
No maximum length validation for:
- Folder names (`CreateFolderReq.name`)
- File names (`RenameReq.new_name`)
- Search queries (`SearchQuery.q`)

**Issue:**
Very long strings could cause performance issues or filesystem errors.

**Recommendation:**
Add reasonable length limits (e.g., 255 characters for names).

---

### 14. Console Logging in Production
**File:** `static/index.html` (lines 3088, 3943)
**Severity:** LOW (Code Quality)

**Description:**
```javascript
console.warn('Could not read file:', relativePath, e);
console.error('Search failed:', err);
```

**Issue:**
Console logging exposes internal details in production.

**Recommendation:**
Use a configurable logging system or remove debug logs for production.

---

### 15. Task ID Generation Not Cryptographically Secure
**File:** `static/index.html` (line 4091)
**Severity:** LOW

**Description:**
```javascript
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
```

**Issue:**
Uses `Math.random()` which is not cryptographically secure. While task IDs don't require security, this pattern shouldn't be copied for security-sensitive use cases.

**Recommendation:**
Consider using `crypto.randomUUID()` for better uniqueness and as a better pattern.

---

### 16. Missing Error Boundary in UI
**File:** `static/index.html`
**Severity:** LOW

**Description:**
If JavaScript errors occur (e.g., from localStorage parsing), the entire UI could become unresponsive with no user feedback.

**Recommendation:**
Add a global error handler:
```javascript
window.onerror = function(msg, url, line) {
    showToast('An error occurred. Please refresh the page.');
    console.error(msg, url, line);
    return true;
};
```

---

## Positive Observations

1. **Good HTML Escaping:** The `escapeHtml()` and `escapeAttr()` functions are used consistently for user-generated content.

2. **Path Sanitization:** The `clean_relative_path` function handles basic path traversal attempts.

3. **Filename Sanitization:** Folder and file names have dangerous characters (`/`, `\`, `\0`) replaced.

4. **Async Operations:** Good use of async/await for non-blocking I/O.

5. **Content-Type Sniffing Prevention:** The `X-Content-Type-Options: nosniff` header is set on downloads.

6. **UTF-8 Validation:** File reading checks for valid UTF-8 before allowing edits.

---

## Recommendations Summary

### Immediate Actions (High Priority)
1. Add canonicalization check to path resolution
2. Implement upload size validation during streaming
3. Review all error message handling for XSS

### Short-term Actions (Medium Priority)
4. Add rate limiting
5. Implement CSRF protection
6. Add depth limits to recursive operations
7. Configure CORS explicitly
8. Add exponential backoff for WebSocket reconnection

### Long-term Improvements (Low Priority)
9. Clean up dead code
10. Add input validation for string lengths
11. Implement comprehensive error boundaries
12. Set up proper logging infrastructure

---

## Appendix: Files Reviewed

| File | Lines | Language |
|------|-------|----------|
| src/main.rs | 745 | Rust |
| static/index.html | 4865 | HTML/CSS/JS |

---

*This audit was conducted on the code as of the review date. Regular security reviews are recommended as the codebase evolves.*
