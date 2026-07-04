#!/usr/bin/env bash
# Attach expanded SAM deploy permissions to the GitHub OIDC deploy role.
set -euo pipefail

ROLE_NAME="${ROLE_NAME:-yourcookmate-github-deploy-zabualfe}"
POLICY_NAME="YourCookMateSamDeploy"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "Updating inline policy $POLICY_NAME on role $ROLE_NAME ..."
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document "file://${ROOT}/aws/bootstrap/sam-deploy-policy.json"

echo "Done. Re-run GitHub Actions deploy-aws job."
