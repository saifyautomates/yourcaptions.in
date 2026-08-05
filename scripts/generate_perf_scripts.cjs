const fs = require('fs');
const path = require('path');

const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.trim() + '\n');
}

write('tests/performance/loadTest.ts', `
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // ramp up
    { duration: '1m', target: 100 }, // sustained load
    { duration: '30s', target: 0 },  // ramp down
  ],
};

export default function () {
  const res = http.get('https://yourcaptions.com');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
`);

write('tests/performance/lighthouse.ts', `
// Lighthouse tests can be integrated with Playwright or run separately.
// For now, this is a placeholder.
`);

write('tests/scripts/pre-deploy.sh', `#!/bin/bash
# Pre-deploy hook — runs before every production deploy
# Fails deploy if any test fails

set -e  # exit on any error

echo "🧪 yourcaptions pre-deploy test suite starting..."
echo "📍 Target: https://yourcaptions.com"
echo "⏰ \\$(date)"

# Load env
if [ -f tests/.env.test ]; then
  source tests/.env.test
fi

# Step 1: Setup test data
echo -e "\\n📦 Setting up test data..."
npx ts-node tests/scripts/setup-test-data.ts

# Step 2: Unit tests (fastest)
echo -e "\\n⚡ Running unit tests..."
npx jest tests/unit --passWithNoTests --forceExit
UNIT_RESULT=$?

# Step 3: Integration tests
echo -e "\\n🔗 Running integration tests..."
npx jest tests/integration --passWithNoTests --forceExit --runInBand
INTEGRATION_RESULT=$?

# Step 4: E2E tests (Playwright)
echo -e "\\n🎭 Running E2E tests..."
npx playwright test tests/e2e --reporter=html,json
E2E_RESULT=$?

# Step 5: Cleanup test data
echo -e "\\n🧹 Cleaning up test data..."
npx ts-node tests/scripts/cleanup-test-data.ts

# Check results
if [ $UNIT_RESULT -ne 0 ] || [ $INTEGRATION_RESULT -ne 0 ] || [ $E2E_RESULT -ne 0 ]; then
  echo -e "\\n❌ TESTS FAILED — Deploy blocked!"
  exit 1
fi

echo -e "\\n✅ ALL TESTS PASSED — Deploy proceeding!"
exit 0
`);

write('tests/scripts/setup-test-data.ts', `
import { AuthHelper } from '../helpers/auth.helper';

async function setup() {
  console.log('Setting up test data...');
  await AuthHelper.createTestUsers();
  console.log('✅ Test data ready — users created');
}

setup().catch(console.error);
`);

write('tests/scripts/cleanup-test-data.ts', `
import { AuthHelper } from '../helpers/auth.helper';
import { DBHelper } from '../helpers/db.helper';

async function cleanup() {
  console.log('Cleaning up test data...');
  // await AuthHelper.deleteTestUsers();
  const db = new DBHelper();
  await db.cleanupTestData();
  console.log('✅ Cleanup complete — test data removed');
}

cleanup().catch(console.error);
`);

write('tests/scripts/global-setup.ts', `
module.exports = async () => {
  // Global Jest setup logic
};
`);

write('tests/scripts/global-teardown.ts', `
module.exports = async () => {
  // Global Jest teardown logic
};
`);

// Add execute permission to bash script
fs.chmodSync('tests/scripts/pre-deploy.sh', '755');
