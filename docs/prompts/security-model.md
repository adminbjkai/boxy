# Boxy Security Model Prompt

**Target**: AI image generation (g3img / DALL-E / Midjourney)
**Style**: Clean flat vector diagram, light background, 16:9 aspect ratio

---

## Prompt

Create a technical security diagram titled "Boxy Security Model" showing the defense layers:

**Layout**: Concentric rings or layered horizontal bands

**Layer 1: Input Validation** (outermost)
- Box: "Path Sanitizer"
- Functions: `resolve_path_safe()`, `clean_relative_path()`
- Defense: "Blocks `../` traversal, symlink escapes"

**Layer 2: Resource Limits** (middle)
- Box: "Rate & Size Controls"
- Items:
  - "Payload limit: 200MB (`BOX_MAX_UPLOAD_BYTES`)"
  - "Search cap: 100 results (`MAX_SEARCH_RESULTS`)"
- Defense: "Prevents DoS via large uploads or runaway traversal"

**Layer 3: Output Encoding** (inner)
- Box: "XSS Prevention"
- Functions: `escapeHtml()`, `escapeAttr()`
- Defense: "All user content escaped before innerHTML"

**Attack Vectors Blocked** (callout arrows pointing to relevant layers):
- "Path traversal (`../../../etc/passwd`)" → Layer 1
- "Symlink escape" → Layer 1
- "Memory exhaustion (large file)" → Layer 2
- "Search DoS (recursive)" → Layer 2
- "XSS via filename" → Layer 3

**Visual Style**:
- Shield or castle metaphor optional
- Color: Green (allowed), Red (blocked)
- Arrows showing attack attempts being stopped
- Clean sans-serif labels

---

## Filename Convention
`boxy-security-model-YYYYMMDD.png`
