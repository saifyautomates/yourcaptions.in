#!/usr/bin/env python3
"""
Screenshot regression for the Index (/) route across mobile / tablet / desktop.

Usage:
  python3 scripts/screenshot-diff.py             # compare against baselines
  python3 scripts/screenshot-diff.py --update    # (re)generate baselines
  python3 scripts/screenshot-diff.py --url http://localhost:8080

Baselines live in e2e/baselines/index-<viewport>.png.
Actuals + diff artifacts go to e2e/artifacts/.
Exits non-zero when any breakpoint's pixel diff ratio exceeds --threshold
(default 0.01 = 1% of pixels differ beyond per-pixel tolerance).
"""
from __future__ import annotations
import argparse, asyncio, os, sys
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
BASELINE_DIR = ROOT / "e2e" / "baselines"
ARTIFACT_DIR = ROOT / "e2e" / "artifacts"

BREAKPOINTS = [
    ("mobile", 390, 1400),
    ("tablet", 834, 1600),
    ("desktop", 1440, 1800),
]

async def capture(url: str, out_dir: Path) -> dict[str, Path]:
    from playwright.async_api import async_playwright
    out_dir.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            for name, w, h in BREAKPOINTS:
                ctx = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
                page = await ctx.new_page()
                await page.goto(url, wait_until="networkidle")
                # Freeze animations so diffs aren't dominated by rotating rings.
                await page.add_style_tag(content="""
                    *, *::before, *::after {
                        animation: none !important;
                        transition: none !important;
                    }
                """)
                await page.wait_for_timeout(400)
                dest = out_dir / f"index-{name}.png"
                await page.screenshot(path=str(dest))
                paths[name] = dest
                await ctx.close()
        finally:
            await browser.close()
    return paths

def diff_ratio(a: Path, b: Path, out: Path, per_pixel_tolerance: int = 12) -> float:
    ia = Image.open(a).convert("RGB")
    ib = Image.open(b).convert("RGB")
    if ia.size != ib.size:
        # Normalize by cropping/padding to the smaller size before diffing.
        w = min(ia.size[0], ib.size[0])
        h = min(ia.size[1], ib.size[1])
        ia = ia.crop((0, 0, w, h))
        ib = ib.crop((0, 0, w, h))
    d = ImageChops.difference(ia, ib)
    # Per-pixel: consider changed only if any channel exceeds tolerance.
    bands = d.split()
    mask = None
    for band in bands:
        m = band.point(lambda v: 255 if v > per_pixel_tolerance else 0)
        mask = m if mask is None else ImageChops.lighter(mask, m)
    changed = sum(1 for px in mask.getdata() if px > 0)
    total = mask.size[0] * mask.size[1]
    out.parent.mkdir(parents=True, exist_ok=True)
    # Save a visual diff (amplified) for inspection.
    amp = d.point(lambda v: min(255, v * 6))
    amp.save(out)
    return changed / total

async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=os.environ.get("PREVIEW_URL", "http://localhost:8080"))
    ap.add_argument("--update", action="store_true", help="Regenerate baselines instead of diffing.")
    ap.add_argument("--threshold", type=float, default=0.01, help="Max allowed changed-pixel ratio.")
    args = ap.parse_args()

    target_dir = BASELINE_DIR if args.update else ARTIFACT_DIR
    captured = await capture(args.url, target_dir)

    if args.update:
        for name, path in captured.items():
            print(f"baseline updated: {name} -> {path.relative_to(ROOT)}")
        return 0

    failures: list[str] = []
    for name, actual in captured.items():
        baseline = BASELINE_DIR / f"index-{name}.png"
        if not baseline.exists():
            failures.append(f"{name}: no baseline at {baseline.relative_to(ROOT)} (run with --update)")
            continue
        diff_out = ARTIFACT_DIR / f"index-{name}.diff.png"
        ratio = diff_ratio(baseline, actual, diff_out)
        status = "PASS" if ratio <= args.threshold else "FAIL"
        print(f"{status} {name:8s} diff={ratio*100:6.3f}%  (threshold {args.threshold*100:.2f}%)  diff -> {diff_out.relative_to(ROOT)}")
        if ratio > args.threshold:
            failures.append(f"{name}: {ratio*100:.3f}% > {args.threshold*100:.2f}%")

    if failures:
        print("\nScreenshot diff failed:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("\nAll breakpoints match baselines.")
    return 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
