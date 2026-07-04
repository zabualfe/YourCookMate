#!/usr/bin/env bash
# Force-update IAM trust policy to match GitHub OIDC token from CI logs.
set -euo pipefail

ROLE_NAME="${ROLE_NAME:-yourcookmate-github-deploy-zabualfe}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
OIDC_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

TRUST_FILE="$(mktemp)"
trap 'rm -f "$TRUST_FILE"' EXIT

cat > "$TRUST_FILE" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "${OIDC_ARN}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:zabualfe/YourCookMate:*"
        }
      }
    }
  ]
}
EOF

echo "Updating trust policy on role: $ROLE_NAME"
echo "Allows sub: repo:zabualfe/YourCookMate:*"
aws iam update-assume-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-document "file://${TRUST_FILE}"

echo ""
echo "Done. Set GitHub secret AWS_ROLE_ARN to:"
echo "  arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
