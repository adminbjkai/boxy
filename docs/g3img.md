You have a local image generator command available:

  g3img "<prompt>" [output_dir]

Behavior:
- If run inside a git repo, g3img saves to <repo_root>/_ai_images/ and prints the absolute filepath to the generated image.
- If output_dir is provided, it saves to <output_dir>/_ai_images/ instead.
- g3img may also create a sibling .txt file with any returned text.

IMAGE / VISUAL STANDARD OPERATING PROCEDURE (SOP)
When the user asks for any image / visual / infographic / diagram / UI mock / architecture graphic:

1) Clarify the deliverable *internally* (do not ask user unless ambiguous):
   - Purpose: README doc, UI screenshot-style, architecture diagram, marketing graphic, test asset, etc.
   - Aspect: prefer 16:9 for architecture/infographics, 1:1 for icons/logos unless user says otherwise.
   - Style: clean, modern, minimal labels, readable at 1000–1600px width.

2) Compose a highly specific g3img prompt:
   - Always include: subject, layout, labels, key components, style cues, and “no copyrighted logos”.
   - For Nano Banana Pro / Gemini 3 Pro Image, it helps to specify: subject + composition + action + location + style (and any exact on-image text in quotes).
   - If it’s for docs/README: use clear headings, callouts, arrows, and short labels.
   - If it’s for UI: include screen frame, cards, buttons, and simple icons (generic).
   - For multi-image decks (presentations), repeat a short “style block” in every prompt (background color, typography, accent color, icon style) to keep consistency.

3) Run g3img:
   - Execute: g3img "<final prompt>"
   - Capture the returned filepath.

4) Review the generated visual:
   - Open/inspect the file (use any available method) OR at minimum check it exists and size > 0 bytes.
   - If it’s obviously wrong (missing key elements / unreadable labels / wrong style), re-run g3img with a refined prompt (max 2 retries) focusing on the deficiencies.
   - If text is garbled: reduce the amount of text, increase font size, or switch to fewer/larger callouts.

5) Standardize naming + placement in the repo:
   - Determine the best destination folder:
     - If the repo has docs/ or assets/ or static/ => place under that (prefer docs/assets/images or static/images).
     - Otherwise create: ./docs/assets/images/
   - Rename file to: <project>-<type>-<short_slug>-<YYYYMMDD>.png
     Examples:
       boxy-architecture-request-flow-20260112.png
       boxy-ui-upload-panel-20260112.png
       boxy-infographic-features-20260112.png
   - Move the image into the chosen folder.
   - If a .txt companion file exists, rename/move it similarly.

6) Update the project references:
   - If for README/docs, add a Markdown reference with a relative path.
   - If relevant, add a short caption and 1–3 bullets explaining what the visual shows.

7) Git hygiene (if repo is git):
   - git status
   - git add the new/changed files
   - Provide a suggested commit message like:
     "docs: add <visual type> for <topic>"

Operational rules:
- Never overwrite existing images unless user explicitly asks.
- Keep generated visuals small and maintainable; prefer one clear graphic per request.
- Always return: final filepath(s), where you placed it in the repo, and the README/doc snippet if you updated docs.

Now acknowledge these rules and wait for my first image request.

Style registry (prompt templates)
- Bento grid infographic (default for explanations):
  Create a clean, educational infographic titled "[TOPIC]". Layout: bento grid with rounded corners and clear sections. Visual style: flat vector art, minimal shading, pastel palette + dark gray text. Content: header + 3 concise sections with icons/diagrams. Text must be legible and sans-serif.
- Technical sketch overlay (architecture/hardware):
  Create a technical infographic of [TOPIC], combining a photorealistic render with ink-style annotation overlays on a white background. Include labels, cutaway outlines, and arrows indicating data flow. Engineering manual aesthetic.
- Surreal brand visual (marketing/hero):
  Ultra-high-end surreal visual of [TOPIC]. Centered, hyper-realistic 3D render in a clean studio backdrop. Soft global illumination. No text overlays, no logos.
- UI mockup (feature previews):
  High-fidelity UI mockup of a [APP TYPE] screen showing [SPECIFIC CONTENT]. Clean modern aesthetic, rounded corners, soft shadows, large readable text. No copied UI.

For deeper prompt best practices, see `docs/g3img_guide.md`.
