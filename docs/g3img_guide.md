# MASTER G3IMG Prompting Guide

This guide provides **best practices for crafting prompts** when generating images via Vertex AI models (especially *Gemini 3 Pro Image Preview*, *Imagen 4*, and other supported image models) using the `g3img` tool.

---

## 🧠 1. Prompt Foundations

High-quality results begin with a well-structured prompt. Your text prompt communicates exactly what you want the model to visualize.

**Best-practice prompt elements:**
1. **Intent / Purpose**  
   Start with a clear instruction like:
   > “Generate an image of…” or  
   > “Create a diagram showing…”

2. **Subject Detail**  
   Describe the main concept and elements required.

3. **Layout & Composition**  
   Specify aspect ratios, layout, and flow:
   > “Wide 16:9 architecture diagram…”

4. **Style & Tone**  
   Include stylistic cues:
   > “flat vector infographic”, “clean modern colors”, “minimalist”, “photorealistic”.

5. **Text & Labels**  
   When diagrams need readable text, ask for:
   > “legible labels”, “clear arrows”, “annotated components”.

6. **Constraints**  
   Helpful constraints include:
   > “no copyrighted logos”, “simple background only”.

Example high-level structure:

Generate a wide 16:9 technical diagram showing
<browsers → API → storage> flow with labeled arrows,
flat vector style, minimal colors, and text of each component legibly annotated.

yaml
Copy code

Reason: Vertex AI image models deeply parse text instructions. Being specific helps them adhere to your intent rather than guessing your meaning. :contentReference[oaicite:1]{index=1}

---

## 🧠 2. Model-Specific Prompting

### 🟡 Gemini 3 Pro Image Preview
- Best for **complex structured visuals**, brochures, labeled diagrams, and infographics.
- Stronger at **text in images** and real-world knowledge.
- Use prompts that specify both **content** and **structure**.

Example prompt:
Generate a 16:9 professional technical diagram titled "Boxy Architecture":
Left side: Browser UI components listed with arrows to the Actix Web backend API
(REST + WebSocket). Right side: uploads filesystem and Docker service.
Include clean labels, arrows, and minimal flat color palette,
no trademarked logos, readable text at >= 14pt equivalent.

markdown
Copy code

Tip: referencing *composition and hierarchy* (left­→, center, right) helps the model arrange information logically.

### 🔵 Imagen (e.g., Imagen 4)
- Ideal for **high-fidelity artistic visuals**, posters, or mockups.
- Works best when you emphasize **visual style** and **mood**.

Example prompt:
Create a photorealistic poster for Boxy UI mockup:
center the file list UI with soft lighting, subtle shadow,
clean modern aesthetic, bold text "Boxy Files" in header,
warm color palette, 16:9.

yaml
Copy code

---

## 🎨 3. Prompt Engineering Techniques

These practices improve accuracy and quality:

### 3.1 Be Specific & Structured
General prompts lead to vague images.  
Bad: “show architecture”
Better: “wide 16:9 technical diagram showing UI → backend → storage with labeled arrows…”

### 3.2 Avoid Line Breaks
Pass prompts as a **single line** when using CLI tools like `g3img`.  
Line breaks may be interpreted poorly during JSON construction.

### 3.3 Iterate & Refine
Rarely does the first output match the final vision perfectly.  
Evaluate the result and tweak:
- swap adjectives
- tighten descriptions
- add context (e.g., “include iconography for WebSocket”)

### 3.4 Use Visual Vocabulary
Words that influence layout and style:
- *diagram, flowchart, architecture*
- *flat vector, infographic*
- *photorealistic, poster, UI mockup*
- *labeled, annotated, arrows pointing from … to …*

This encourages the model to consider *purpose and format* of the image.

---

## 🛠 4. Prompt Patterns to Avoid

- **Vague generalities**: “make something cool”
- **Ambiguous references**: “show this backend thing”
- **Nested line breaks** in CLI JSON contexts
- **Incomplete constraints** (e.g., missing style or text requirements)

---

## 📏 5. Prompt Quality Checklist

Before running `g3img`, ensure your prompt:

| Question | Yes/No |
|----------|--------|
| Does it start with a clear invoke phrase? |        |
| Have all important elements (subject, layout, style) been included? |        |
| Is it one line (no accidental newlines)? |        |
| Are text labels or annotation instructions clear? |        |
| Is the desired style specified? |        |

---

## 💡 6. Iteration Examples

### Example: First pass
Generate an infographic of Boxy file sharing flow.

shell
Copy code

### Improved version
Generate a wide 16:9 labeled infographic of Boxy file sharing flow:
show Browser UI icons with arrows to Actix Web API boxes,
and arrows to filesystem storage. Use flat vector style and crisp readable labels.

yaml
Copy code

This increases clarity and reduces ambiguity, leading to stronger outputs. :contentReference[oaicite:2]{index=2}

---

## 📌 7. Advanced Tips

### Meta-Prompting
Ask an LLM to *generate or refine* your prompt before sending it to `g3img`.  
E.g., “Produce a concise CLI prompt for a wide diagram of X that includes elements A, B, C.”  
This leverages the model’s understanding to generate a superior prompt itself. :contentReference[oaicite:3]{index=3}

### Aspect Ratio & Resolution Control (via API)
When using REST or SDKs, you can explicitly set:
- `aspect_ratio`: e.g., `"16:9"`  
- `image_size`: e.g., `"2K"`  
See Vertex API docs for specifics. :contentReference[oaicite:4]{index=4}

---

## 📚 References & Further Reading

- Vertex AI image prompt design docs – explanation of attributes and examples. :contentReference[oaicite:5]{index=5}  
- Prompt design strategies for Vertex AI (structure, context, roles). :contentReference[oaicite:6]{index=6}  
- Vertex AI Gemini prompt engineering booklet. :contentReference[oaicite:7]{index=7}

---

## 🏁 Summary

To generate the best possible visuals with `g3img` and Vertex AI:

✔ Be explicit, structured, and detailed.  
✔ Always include layout, style, and text guidance.  
✔ Tailor language to the model you are targeting.  
✔ Iterate and refine the prompt for clarity.

Keep this guide as the **canonical reference** for crafting prompt inputs in your repo and refining as you learn from output results.
