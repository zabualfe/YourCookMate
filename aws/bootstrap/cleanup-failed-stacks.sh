#!/usr/bin/env bash
# Delete stuck SAM / app CloudFormation stacks so CI can redeploy cleanly.
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"

delete_stack() {
  local name="$1"
  if ! aws cloudformation describe-stacks --stack-name "$name" --region "$REGION" >/dev/null 2>&1; then
    echo "Skip $name (not found)"
    return
  fi
  local status
  status="$(aws cloudformation describe-stacks --stack-name "$name" --region "$REGION" \
    --query 'Stacks[0].StackStatus' --output text)"
  echo "Stack $name status: $status"
  if [[ "$status" == "ROLLBACK_FAILED" || "$status" == "UPDATE_ROLLBACK_FAILED" ]]; then
    echo "  Continuing rollback..."
    aws cloudformation continue-update-rollback --stack-name "$name" --region "$REGION" || true
    sleep 5
  fi
  echo "  Deleting..."
  aws cloudformation delete-stack --stack-name "$name" --region "$REGION"
  aws cloudformation wait stack-delete-complete --stack-name "$name" --region "$REGION"
  echo "  Deleted $name"
}

echo "Cleaning failed SAM stacks in $REGION ..."
delete_stack "yourcookmate"
delete_stack "aws-sam-cli-managed-default"

echo "Done. Push to main or re-run deploy-aws."
