# G3IMG: Image Generation System & Style Registry

## 1. Tool Overview
You have a local CLI tool for generating high-fidelity AI images (using Gemini 3 Pro/Nano Banana).
**Command:** `g3img "<prompt>" [output_dir]`

## 2. Operational Rules (The SOP)
When the user asks for *any* visual (diagram, UI mock, chart, icon):

1.  **Select a Style:** Choose the best fit from the **Style Registry** below. (Do not use generic prompts).
2.  **Construct Prompt:** Combine the User's Topic + The Style Template.
    * *Critical:* Pass the prompt as a **single line** (no newlines).
3.  **Execute:** `g3img "<final_prompt>"`
4.  **Verify & Save:**
    * Check if output exists.
    * Move to: `docs/assets/images/` (or `static/img/`).
    * Naming convention: `project-<type>-<slug>-<date>.png` (e.g., `boxy-arch-diagram-20260205.png`).
5.  **Document:** Add a reference to the image in the relevant `README.md` or documentation file.

---

## 3. 🎨 Style Registry (The "Nano Banana" Best Practices)
*Choose one of these presets based on the user's request.*

### A. The "Bento Grid" Infographic (Default for Explanations)
**Use for:** Summaries, "How it works", Educational content.
**Prompt Template:**
> Create a clean, educational infographic titled "[TOPIC]". Layout: 'Bento Box' grid with rounded corners and clear sections. Visual Style: Flat vector art, minimal shading, Google Material Design colors (pastels + dark grey text). Content to render: 1) Header: [TOPIC]. 2) Section A: [KEY POINT 1] with an icon. 3) Section B: [KEY POINT 2] with a diagram. 4) Section C: [KEY POINT 3]. text must be legible and sans-serif.

### B. The "Technical Sketch" Overlay (Best for Architecture/Hardware)
**Use for:** Deep dives, hardware explanations, "Under the hood".
**Prompt Template:**
> Create a technical infographic of [TOPIC], combining a photorealistic render with technical annotation overlays. Style: Black ink-style line drawings (architectural sketch look) on a pure white studio background. Include: key component labels, internal cutaway outlines, and arrows indicating data flow. The real object remains visible beneath annotations. Aesthetic: Engineering manual, museum exhibit, ultra-crisp, 8K resolution.

### C. The "Surreal Brand" Visual (Best for Marketing/Hero Images)
**Use for:** Readme headers, Social media announcements, "Hype" images.
**Prompt Template:**
> Ultra-high-end surreal visual of [TOPIC]. Composition: Centered, hyper-realistic 3D render transformed into a whimsical architectural structure. A tiny realistic human figure interacts with the [TOPIC] to show scale. Background: Clean studio [BRAND COLOR] with subtle grain. Lighting: Soft global illumination. Mood: Playful, premium, imaginative. No text overlays, just the object.

### D. The "UI Mockup" (Best for App Ideas)
**Use for:** Showing off a feature before it's built.
**Prompt Template:**
> Photorealistic high-fidelity UI mockup of a [APP TYPE] application. Screen shows: [SPECIFIC SCREEN CONTENT]. Style: Clean modern aesthetic, soft shadows, rounded corners, whitespace-heavy. Perspective: Tilted 3D floating glass slab on a blurred abstract background. High resolution, clear text.

---

## 4. Prompt Engineering Checklist
Before running the command, ask yourself:
1.  **Did I include the style keywords?** (e.g., "flat vector", "bento grid", "architectural sketch")
2.  **Is there context?** (Don't just say "Draw the app". Say "Draw the app showing the Settings screen with a dark mode toggle".)
3.  **Is it a single line?** (Ensure JSON compatibility).

## 5. Troubleshooting
* **Text is gibberish?** Re-run adding: "Ensure all text labels are perfectly legible and spell-checked."
* **Too cluttered?** Re-run adding: "Increase white space, simplify layout, reduce element count."
