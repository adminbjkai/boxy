# Vendored browser assets

These assets are embedded in the binary and require no runtime CDN.

- DOMPurify 3.4.16: `purify.min.js`, from https://github.com/cure53/DOMPurify; license in `DOMPurify-LICENSE`. Sanitizes Markdown previews.
- Existing Prism and marked distributions: syntax highlighting and Markdown parsing.
- Existing Space Grotesk and Fraunces Latin fonts: see `fonts.css`.

App CSS/JS use versioned URLs with revalidation. Rebuild the binary after changing any asset.
