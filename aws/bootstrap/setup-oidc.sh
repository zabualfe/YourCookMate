#!/usr/bin/env bash
# One-time GitHub OIDC + deploy role setup for zabualfe/YourCookMate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REGION="${AWS_REGION:-us-east-1}"
GITHUB_ORG="${GITHUB_ORG:-zabualfe}"
GITHUB_REPO="${GITHUB_REPO:-YourCookMate}"
STACK_NAME="${STACK_NAME:-yourcookmate-github-oidc}"

echo "==> Region: $REGION"
echo "==> Repo: $GITHUB_ORG/$GITHUB_REPO"

echo "==> Ensuring GitHub OIDC provider exists in this AWS account..."
if aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):oidc-provider/token.actions.githubusercontent.com" \
  --region "$REGION" >/dev/null 2>&1; then
  echo "    OIDC provider already exists (OK)"
else
  aws iam create-open-id-connect-provider \
    --url "https://token.actions.githubusercontent.com" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "6938fd4d98bab03faad8791377124e47b9e575b3" \
    --region "$REGION"
  echo "    Created OIDC provider"
fi

echo "==> Deploying IAM deploy role stack..."
aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file "$ROOT/aws/bootstrap/github-oidc.yaml" \
  --parameter-overrides \
    "GitHubOrg=$GITHUB_ORG" \
    "GitHubRepo=$GITHUB_REPO" \
    "GitHubEnvironment=production-aws" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$REGION"

ROLE_ARN="$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DeployRoleArn'].OutputValue" \
  --output text \
  --region "$REGION")"

echo ""
echo "==> Done. Add this GitHub secret:"
echo "    AWS_ROLE_ARN = $ROLE_ARN"
echo "    AWS_REGION   = $REGION"
echo ""
echo "Trust policy allows:"
echo "  repo:$GITHUB_ORG/$GITHUB_REPO:ref:refs/heads/main"
echo "  repo:$GITHUB_ORG/$GITHUB_REPO:environment:production-aws"
