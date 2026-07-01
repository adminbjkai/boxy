import datetime
import pathlib
import subprocess
import time
import json


def main() -> int:
    repo_root = pathlib.Path(__file__).resolve().parents[2]
    pres_dir = pathlib.Path(__file__).resolve().parent
    prompts_dir = pres_dir / "prompts"

    today = datetime.date.today().strftime("%Y%m%d")

    slides = [
        ("01-title", "01-title.png"),
        ("02-overview", "02-overview.png"),
        ("03-stack", "03-stack.png"),
        ("04-frontend", "04-frontend.png"),
        ("05-backend", "05-backend.png"),
        ("06-api", "06-api.png"),
        ("07-realtime", "07-realtime.png"),
        ("08-file-features", "08-file-features.png"),
        ("09-productivity", "09-productivity.png"),
        ("10-security", "10-security.png"),
        ("11-testing", "11-testing.png"),
        ("12-deployment", "12-deployment.png"),
    ]

    for slug, out_name in slides:
        prompt_path = prompts_dir / f"{slug}.md"
        prompt = prompt_path.read_text(encoding="utf-8").strip()
        prompt = " ".join(prompt.split())  # single-line friendly

        out_path = pres_dir / out_name
        if out_path.exists():
            print(f"SKIP exists: {out_path}")
            continue

        print(f"Generating {out_name}…")

        # Direct output into this folder to keep g3img artifacts scoped.
        # g3img will write to <output_dir>/_ai_images/ and print the generated image path.
        max_attempts = 6
        last = None
        for attempt in range(1, max_attempts + 1):
            result = subprocess.run(
                ["g3img", prompt, str(pres_dir)],
                text=True,
                capture_output=True,
            )
            last = result
            if result.returncode == 0:
                break

            # g3img prints Vertex errors as JSON to stdout; retry 429 with backoff.
            is_429 = False
            try:
                payload = json.loads((result.stdout or "").strip() or "{}")
                is_429 = payload.get("code") == 429
            except Exception:
                is_429 = False

            if is_429 and attempt < max_attempts:
                sleep_s = min(60, 5 * (2 ** (attempt - 1)))
                print(f"Rate limited (429). Retry {attempt}/{max_attempts} in {sleep_s}s…")
                time.sleep(sleep_s)
                continue

            print(result.stdout)
            print(result.stderr)
            raise SystemExit(f"g3img failed for {slug}")

        if last is None or last.returncode != 0:
            raise SystemExit(f"g3img failed for {slug}")

        generated = last.stdout.strip().splitlines()[-1].strip()
        generated_path = pathlib.Path(generated)
        if not generated_path.exists() or generated_path.stat().st_size == 0:
            raise SystemExit(f"Generated image missing/empty: {generated_path}")

        generated_path.replace(out_path)

        # If g3img produced a sibling text, keep it near the slide for reproducibility.
        txt_in = generated_path.with_suffix(".txt")
        if txt_in.exists():
            txt_out = pres_dir / f"{slug}-{today}.txt"
            txt_in.replace(txt_out)

        print(f"Wrote {out_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
