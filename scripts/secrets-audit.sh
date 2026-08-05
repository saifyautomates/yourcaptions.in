#!/bin/bash
echo "Starting Secrets Audit..."

# Check for secrets in code
MATCHES=$(grep -rnw --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude=secrets-audit.sh --exclude="*.sql" "sk_live_\|rzp_live_\|service_role\|eyJhbGciOiJIUzI1" .)

if [ -n "$MATCHES" ]; then
  echo "❌ SECRETS EXPOSED IN SOURCE CODE!"
  echo "$MATCHES"
  exit 1
fi

echo "✅ No hardcoded secrets found in source code."
exit 0
