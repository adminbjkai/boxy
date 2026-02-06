import pathlib
import subprocess


def main() -> int:
    pres_dir = pathlib.Path(__file__).resolve().parent
    pdf_path = pres_dir / "boxy-presentation-3.0.pdf"

    slides = sorted(pres_dir.glob("[0-9][0-9]-*.png"))
    if not slides:
        raise SystemExit("No slide PNGs found. Run generate.py first.")

    # ImageMagick is available in this environment; use it to assemble a PDF.
    cmd = ["magick", *[str(p) for p in slides], str(pdf_path)]
    subprocess.check_call(cmd)

    if not pdf_path.exists() or pdf_path.stat().st_size == 0:
        raise SystemExit(f"PDF missing/empty: {pdf_path}")

    print(f"Wrote {pdf_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

