# Boxy Security Model (Defense in Depth)

**Target**: AI image generation (g3img / DALL-E / Midjourney)
**Style**: Clean flat vector diagram, light background, 16:9 aspect ratio
**Purpose**: Illustrate layered security architecture and threat mitigation

---

## Prompt

Create a technical security diagram titled "Boxy Security Model" showing defense-in-depth layers:

**Layout**: Concentric defense rings OR horizontal layered bands (castle/fortress metaphor acceptable)

### Layer 1: Input Validation (Outermost)
- Label: "Path Sanitization"
- Color: Orange (#F59E0B)
- Components:
  - `resolve_path_safe()` - Canonicalizes paths, validates within base
  - `clean_relative_path()` - Normalizes path separators
- Defense mechanisms:
  - "Blocks `../` directory traversal"
  - "Prevents symlink escape attacks"
  - "Rejects paths outside ./uploads"

### Layer 2: Resource Limits (Middle)
- Label: "Rate & Size Controls"
- Color: Blue (#3B82F6)
- Components:
  - "Payload Limit: 200MB" (`BOX_MAX_UPLOAD_BYTES`)
  - "Search Cap: 100 results" (`MAX_SEARCH_RESULTS`)
- Defense mechanisms:
  - "Prevents memory exhaustion from large uploads"
  - "Prevents DoS via recursive search traversal"

### Layer 3: Output Encoding (Innermost)
- Label: "XSS Prevention"
- Color: Green (#10B981)
- Components:
  - `escapeHtml()` - Escapes < > & " '
  - `escapeAttr()` - Additional escaping for backtick ` and $
- Defense mechanisms:
  - "All user content escaped before innerHTML"
  - "Template literal injection prevented"

### Attack Vectors (Arrows blocked at appropriate layers)
Show RED arrows attempting to penetrate, blocked at each layer:

1. "Path Traversal (`../../../etc/passwd`)" → BLOCKED at Layer 1
2. "Symlink Escape (`uploads → /etc`)" → BLOCKED at Layer 1
3. "Memory Exhaustion (500MB upload)" → BLOCKED at Layer 2
4. "Search DoS (million files)" → BLOCKED at Layer 2
5. "XSS via filename (`<script>`)" → BLOCKED at Layer 3
6. "Template Injection (`` `${alert()}` ``)" → BLOCKED at Layer 3

### Protected Core (Center)
- Box: "User Data & System Integrity"
- Shield icon
- Label: "Protected"

**Visual Style**:
- Concentric rings or horizontal bands
- Red arrows (attacks) with X marks where blocked
- Green checkmarks at defense points
- Shield or fortress visual metaphor
- Color gradient from outer (warm) to inner (cool)
- Clean typography with monospace for code
- Light background
- High contrast for accessibility

**Legend Box**:
- Attack vector (red arrow)
- Defense layer (colored band)
- Blocked (X mark)
- Protected (shield)

---

## Filename Convention
`boxy-security-model-YYYYMMDD.png`

Example: `boxy-security-model-20260118.png`
