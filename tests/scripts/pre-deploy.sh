#!/bin/bash
# Pre-deploy hook — runs before every production deploy
# Fails deploy if any test fails

set -e  # exit on any error

echo "🧪 yourcaptions pre-deploy test suite starting..."
echo "📍 Target: https://yourcaptions.com"
echo "⏰ \$(date)"

# Load env
if [ -f tests/.env.test ]; then
  source tests/.env.test
fi

# Step 1: Setup test data
echo -e "\n📦 Setting up test data..."
npx ts-node tests/scripts/setup-test-data.ts

# Step 2: Unit tests (fastest)
echo -e "\n⚡ Running unit tests..."
npx jest tests/unit --passWithNoTests --forceExit
UNIT_RESULT=$?

# Step 3: Integration tests
echo -e "\n🔗 Running integration tests..."
npx jest tests/integration --passWithNoTests --forceExit --runInBand
INTEGRATION_RESULT=$?

# Step 4: E2E tests (Playwright)
echo -e "\n🎭 Running E2E tests..."
npx playwright test tests/e2e --reporter=html,json
E2E_RESULT=$?

# Step 5: Cleanup test data
echo -e "\n🧹 Cleaning up test data..."
npx ts-node tests/scripts/cleanup-test-data.ts

# Check results
if [ $UNIT_RESULT -ne 0 ] || [ $INTEGRATION_RESULT -ne 0 ] || [ $E2E_RESULT -ne 0 ]; then
  echo -e "\n❌ TESTS FAILED — Deploy blocked!"
  exit 1
fi

echo -e "\n✅ ALL TESTS PASSED — Deploy proceeding!"
exit 0
