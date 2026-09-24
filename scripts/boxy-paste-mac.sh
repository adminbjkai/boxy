#!/usr/bin/env bash
#
# boxy-paste-mac.sh — upload files/folders copied in Finder to Boxy.
#
# Browsers cannot read Finder-copied files: macOS puts a file *reference*
# (public.file-url) on the pasteboard, not the bytes, and browsers refuse to
# expose that to web pages. So Cmd+V inside Boxy can never upload a Finder file.
# This script closes that gap from the OS side instead.
#
# Usage:
#   boxy-paste-mac.sh [remote-folder]
#
#   remote-folder   Folder inside Boxy to upload into (default: root).
#                   Example: boxy-paste-mac.sh 0804
#
# Source of files (first match wins):
#   1. Files copied in Finder (Cmd+C)
#   2. The current Finder selection
#
# Configure the target server with BOXY_URL (default https://boxy.bjk.ai).
#
# Bind to a hotkey: Automator > Quick Action > Run Shell Script, or Raycast/Alfred.

set -uo pipefail

BOXY_URL="${BOXY_URL:-https://boxy.bjk.ai}"
REMOTE_DIR="${1:-}"

# --- collect source paths (macOS only) ---------------------------------------
collect_paths() {
    # Files copied in Finder. Returns one POSIX path per line.
    osascript <<'APPLESCRIPT' 2>/dev/null
set out to ""
try
    set clipItems to the clipboard as «class furl»
    if class of clipItems is not list then set clipItems to {clipItems}
    repeat with anItem in clipItems
        set out to out & POSIX path of (anItem as alias) & linefeed
    end repeat
end try
if out is "" then
    try
        tell application "Finder" to set sel to selection as alias list
        repeat with anItem in sel
            set out to out & POSIX path of anItem & linefeed
        end repeat
    end try
end if
return out
APPLESCRIPT
}

# --- upload one path (file or directory) -------------------------------------
# Directories are walked so relative structure is preserved server-side; Boxy
# creates parent folders from the filename field.
upload_path() {
    local src="$1"
    src="${src%/}"
    local base
    base="$(basename "$src")"

    local url="$BOXY_URL/api/upload"
    [ -n "$REMOTE_DIR" ] && url="$url?path=$(printf %s "$REMOTE_DIR" | sed 's/ /%20/g')"

    if [ -f "$src" ]; then
        if [ -t 1 ]; then
            curl --progress-bar --fail-with-body -F "file=@$src;filename=$base" "$url" >/dev/null || return 1
        else
            curl -s --fail-with-body -F "file=@$src;filename=$base" "$url" >/dev/null || return 1
        fi
        echo "  uploaded  $base"
        return 0
    fi

    if [ -d "$src" ]; then
        local parent count=0
        parent="$(dirname "$src")"
        while IFS= read -r f; do
            local rel="${f#"$parent"/}"
            if [ -t 1 ]; then
                curl --progress-bar --fail-with-body -F "file=@$f;filename=$rel" "$url" >/dev/null || return 1
            else
                curl -s --fail-with-body -F "file=@$f;filename=$rel" "$url" >/dev/null || return 1
            fi
            count=$((count + 1))
        done < <(find "$src" -type f)
        echo "  uploaded  $base/ ($count files)"
        return 0
    fi

    echo "  skipped   $src (not found)" >&2
    return 1
}

# --- main --------------------------------------------------------------------
main() {
    if [ "$(uname)" != "Darwin" ]; then
        echo "Error: boxy-paste-mac.sh requires macOS (Finder clipboard integration)." >&2
        exit 1
    fi

    local paths
    paths="$(collect_paths)"

    if [ -z "${paths//[$'\n\r\t ']/}" ]; then
        echo "Nothing to upload: copy a file in Finder (Cmd+C) or select one first." >&2
        osascript -e 'display notification "Copy a file in Finder first" with title "Boxy"' 2>/dev/null
        return 1
    fi

    local ok=0 fail=0
    while IFS= read -r p; do
        [ -z "$p" ] && continue
        if upload_path "$p"; then ok=$((ok + 1)); else fail=$((fail + 1)); fi
    done <<< "$paths"

    local msg="Uploaded $ok item(s) to Boxy"
    [ "$fail" -gt 0 ] && msg="$msg — $fail failed"
    echo "$msg"
    osascript -e "display notification \"$msg\" with title \"Boxy\"" 2>/dev/null
    [ "$fail" -eq 0 ]
}

main
