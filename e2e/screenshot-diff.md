# Index (/) screenshot regression

Verifies the marketing hero on `/` renders identically to committed baselines at
mobile (390×1400), tablet (834×1600), and desktop (1440×1800).

## Requirements

- Dev server running (default `http://localhost:8080`, override with `--url` or `PREVIEW_URL`).
- Python 3 + Playwright + Pillow (already available in the Lovable sandbox).

## Commands

```bash
# Diff current preview against committed baselines
python3 scripts/screenshot-diff.py

# Regenerate baselines after an intentional design change
python3 scripts/screenshot-diff.py --update

# Custom URL / tighter tolerance
python3 scripts/screenshot-diff.py --url https://preview.example.com --threshold 0.005
```

## Layout

- `e2e/baselines/index-<viewport>.png` — committed reference frames.
- `e2e/artifacts/index-<viewport>.png` — latest captures (git-ignored).
- `e2e/artifacts/index-<viewport>.diff.png` — amplified pixel diff, useful when a run fails.

## How it works

For each breakpoint the script:

1. Opens `/` in headless Chromium at the target viewport.
2. Injects a stylesheet that disables `animation` and `transition` (the rotating
   rings and floating chips would otherwise dominate every diff).
3. Waits 400ms for layout to settle and captures a viewport screenshot.
4. Compares against the baseline pixel-by-pixel with a per-channel tolerance of
   12/255. A pixel counts as "changed" only if any channel exceeds that.
5. Fails when the changed-pixel ratio exceeds `--threshold` (default 1%).

When a breakpoint fails, open the corresponding `*.diff.png` to see exactly
which regions moved.
