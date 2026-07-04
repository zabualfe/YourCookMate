#!/usr/bin/env bash
# Verify GitHub OIDC deploy role matches zabualfe/YourCookMate CI tokens.
set -euo pipefail

ROLE_NAME="${ROLE_NAME:-yourcookmate-github-deploy-zabualfe}"
EXPECTED_SUB_ENV="repo:zabualfe/YourCookMate:environment:production-aws"
EXPECTED_SUB_BRANCH="repo:zabualfe/YourCookMate:ref:refs/heads/main"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
OIDC_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

echo "AWS account: $ACCOUNT_ID"
echo "Expected AWS_ROLE_ARN secret: $ROLE_ARN"
echo ""

echo "==> OIDC provider"
if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" >/dev/null 2>&1; then
  echo "OK  $OIDC_ARN"
else
  echo "MISSING — run: ./aws/bootstrap/setup-oidc.sh"
  exit 1
fi

echo ""
echo "==> IAM role trust policy"
if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "MISSING role $ROLE_NAME — run: ./aws/bootstrap/setup-oidc.sh"
  exit 1
fi

TRUST="$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.AssumeRolePolicyDocument' --output json)"
echo "$TRUST" | jq .

PRINCIPAL="$(echo "$TRUST" | jq -r '.Statement[0].Principal.Federated // empty')"
if [[ "$PRINCIPAL" != "$OIDC_ARN" ]]; then
  echo ""
  echo "WARN Principal.Federated = $PRINCIPAL"
  echo "     Expected           = $OIDC_ARN"
  echo "     Run ./aws/bootstrap/fix-trust-policy.sh"
fi

SUBS="$(echo "$TRUST" | jq -r '.. | ."token.actions.githubusercontent.com:sub"? // empty' | sort -u)"
echo ""
echo "Allowed sub patterns in trust policy:"
echo "$SUBS"

if echo "$SUBS" | grep -qF "$EXPECTED_SUB_ENV" || echo "$SUBS" | grep -q 'repo:zabualfe/YourCookMate:\*'; then
  echo "OK  includes production-aws environment pattern"
else
  echo "FAIL missing $EXPECTED_SUB_ENV"
  echo "     Run: ./aws/bootstrap/fix-trust-policy.sh"
  exit 1
fi

echo ""
echo "==> GitHub secrets checklist"
echo "  AWS_ROLE_ARN must be exactly: $ROLE_ARN"
echo "  AWS_REGION must match where you deploy (e.g. us-east-1)"
echo "  If using environment 'production-aws', check:"
echo "    GitHub → Settings → Environments → production-aws → Environment secrets"
echo "  Environment secrets override repository secrets with the same name."
