# Boxy Presentation 3.0

This folder contains a g3img-generated presentation deck for the current state of Boxy.

## Contents

- Slide PNGs: `01-*.png` … `12-*.png`
- PDF deck: `boxy-presentation-3.0.pdf`
- Reproducible prompts: `prompts/*.md`

## Regenerating

1. Ensure `g3img` works in this repo (see `docs/g3img.md`).
2. Run:
   ```bash
   python3 docs/presentation3.0/generate.py
   ```
3. Assemble the PDF:
   ```bash
   python3 docs/presentation3.0/build_pdf.py
   ```

Notes:
- Prompts are intentionally single-line friendly for CLI usage.
- Images are written to `docs/presentation3.0/` (not `docs/assets/images/`).
