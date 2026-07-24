#!/usr/bin/env bash
# Empty the SAM CLI managed source bucket after a successful deploy.
# These objects are only packaging artifacts (Lambda zips / templates), not app data.
set -euo pipefail

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
STACK="${SAM_SOURCE_STACK:-aws-sam-cli-managed-default}"

bucket="$(
  aws cloudformation describe-stack-resources \
    --stack-name "$STACK" \
    --region "$REGION" \
    --query "StackResources[?ResourceType=='AWS::S3::Bucket'].PhysicalResourceId | [0]" \
    --output text 2>/dev/null || true
)"

if [[ -z "${bucket:-}" || "$bucket" == "None" ]]; then
  bucket="$(
    aws s3api list-buckets \
      --query "Buckets[?starts_with(Name, 'aws-sam-cli-managed-default-samclisourcebucket')].Name | [0]" \
      --output text 2>/dev/null || true
  )"
fi

if [[ -z "${bucket:-}" || "$bucket" == "None" ]]; then
  echo "No SAM CLI source bucket found — nothing to clean."
  exit 0
fi

echo "Cleaning SAM source bucket: s3://${bucket}"

# Safety net if a future deploy skips this step.
aws s3api put-bucket-lifecycle-configuration \
  --bucket "$bucket" \
  --lifecycle-configuration '{
    "Rules": [
      {
        "ID": "ExpireSamDeployArtifacts",
        "Status": "Enabled",
        "Filter": { "Prefix": "" },
        "Expiration": { "Days": 1 },
        "NoncurrentVersionExpiration": { "NoncurrentDays": 1 },
        "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
      }
    ]
  }' \
  --region "$REGION"

aws s3 rm "s3://${bucket}" --recursive --region "$REGION"
echo "SAM source bucket emptied."
