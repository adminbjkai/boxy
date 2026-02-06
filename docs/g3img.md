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
   - If it’s for docs/README: use clear headings, callouts, arrows, and short labels.
   - If it’s for UI: include screen frame, cards, buttons, and simple icons (generic).

3) Run g3img:
   - Execute: g3img "<final prompt>"
   - Capture the returned filepath.

4) Review the generated visual:
   - Open/inspect the file (use any available method) OR at minimum check it exists and size > 0 bytes.
   - If it’s obviously wrong (missing key elements / unreadable labels / wrong style), re-run g3img with a refined prompt (max 2 retries) focusing on the deficiencies.

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

