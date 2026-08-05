# UI regression tests

Two spec files:

- `tests/e2e/layout-regression.spec.ts` — geometric invariants + visual snapshots
  for public pages, plus a strict "captions/video/panel = zero gap" check on the
  editor. Snapshots live under `tests/e2e/layout-regression.spec.ts-snapshots/`.
- `tests/e2e/routes-smoke.spec.ts` — route/status/console-error coverage.

## Run locally

```
npx playwright install chromium
BASE_URL=https://yourcaptions.com \
  npx playwright test tests/e2e/layout-regression.spec.ts
```

To exercise the authenticated editor gap checks:

```
TEST_EMAIL=... TEST_PASSWORD=... TEST_PROJECT_ID=<uuid> \
  npx playwright test tests/e2e/layout-regression.spec.ts
```

## Update visual baselines

Do this only when a design change is intentional:

```
npx playwright test tests/e2e/layout-regression.spec.ts --update-snapshots
```

Commit the resulting `*-snapshots/` PNGs so CI has a baseline.

## Wire into deploys

Recommended: run against a preview URL before every publish.

```
BASE_URL=https://id-preview--<project>yourcaptions.com \
  npx playwright test tests/e2e/layout-regression.spec.ts tests/e2e/routes-smoke.spec.ts
```

Any layout drift (horizontal overflow, header collapse, editor gap regressions)
or > 2% pixel diff on a public page fails the run.
