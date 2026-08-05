const fs = require('fs');
const path = require('path');

const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.trim() + '\n');
}

write('tests/package.json', `
{
  "name": "yourcaptions-tests",
  "version": "1.0.0",
  "scripts": {
    "test": "bash scripts/pre-deploy.sh",
    "test:unit": "jest tests/unit --forceExit",
    "test:integration": "jest tests/integration --runInBand --forceExit",
    "test:e2e": "playwright test tests/e2e",
    "test:e2e:headed": "playwright test tests/e2e --headed",
    "test:e2e:debug": "playwright test tests/e2e --debug",
    "test:mobile": "playwright test tests/e2e/12.mobile.spec.ts",
    "test:admin": "playwright test tests/e2e/09.admin.spec.ts",
    "test:payments": "playwright test tests/e2e/08.payments.spec.ts",
    "test:credits": "playwright test tests/e2e/07.credits.spec.ts",
    "test:editor": "playwright test tests/e2e/04.editor.spec.ts",
    "test:report": "playwright show-report tests/reports/playwright",
    "setup": "ts-node scripts/setup-test-data.ts",
    "cleanup": "ts-node scripts/cleanup-test-data.ts"
  },
  "dependencies": {
    "@playwright/test": "^1.45.0",
    "@supabase/supabase-js": "^2.45.0",
    "@aws-sdk/client-s3": "^3.600.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.0",
    "typescript": "^5.5.0",
    "dotenv": "^16.4.0",
    "jest-html-reporter": "^3.10.0"
  }
}
`);

write('tests/.env.test.example', `
# Test environment — NEVER commit real values

# App URLs
BASE_URL=https://yourcaptions.com
API_URL=https://api.yourcaptions.com

# Supabase (service role for test setup/teardown)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Test user credentials
ADMIN_PASSWORD=your_admin_password_here

# Razorpay test mode keys
RAZORPAY_TEST_KEY_ID=rzp_test_xxxxx
RAZORPAY_TEST_KEY_SECRET=xxxxx
RAZORPAY_TEST_WEBHOOK_SECRET=xxxxx

# Stripe test mode keys
STRIPE_TEST_SECRET_KEY=sk_test_xxxxx
STRIPE_TEST_WEBHOOK_SECRET=whsec_xxxxx

# R2 (for cleanup)
R2_ACCOUNT_ID=xxxxx
R2_ACCESS_KEY_ID=xxxxx
R2_SECRET_ACCESS_KEY=xxxxx
R2_BUCKET_NAME=yourcaptions-test

# Sentry (optional for tests)
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
`);

write('.github/workflows/test.yml', `
name: QA Pre-Deploy Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    
    defaults:
      run:
        working-directory: ./tests

    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20.x'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Install Playwright Browsers
      run: npx playwright install --with-deps
      
    - name: Run Test Suite
      run: npm test
      env:
        BASE_URL: \${{ secrets.BASE_URL }}
        API_URL: \${{ secrets.API_URL }}
        SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
        SUPABASE_SERVICE_ROLE_KEY: \${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        ADMIN_PASSWORD: \${{ secrets.ADMIN_PASSWORD }}
        
    - name: Upload Test Report
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: playwright-report
        path: tests/reports/playwright/
        retention-days: 30
`);

write('DATA_TEST_IDS.md', `
# UI Elements \`data-testid\` Requirements

## Authentication
- \`login-email-input\`
- \`login-password-input\`
- \`login-submit-btn\`
- \`signup-name-input\`
- \`signup-email-input\`
- \`signup-password-input\`
- \`signup-submit-btn\`
- \`user-menu\`
- \`logout-btn\`

## Dashboard
- \`new-project-btn\`
- \`project-card\`
- \`project-options-menu\`
- \`project-delete-btn\`

## Editor
- \`editor-canvas\`
- \`timeline-track\`
- \`play-pause-btn\`
- \`export-btn\`
- \`transcribe-btn\`
- \`caption-list-item\`
- \`caption-text-input\`
- \`apply-template-btn\`

## Billing & Credits
- \`credit-balance-display\`
- \`upgrade-plan-btn\`
- \`buy-credits-btn\`

## Admin
- \`admin-users-table\`
- \`admin-search-input\`
- \`admin-user-row\`
- \`admin-change-plan-dropdown\`
- \`admin-suspend-user-btn\`
`);

