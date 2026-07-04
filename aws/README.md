# YourCookMate AWS (SAM)

API Gateway + SQS + Lambda for async ingest. Supabase stays the database; Bedrock Nova and Firebase auth come in follow-up steps.

## What gets deployed

| Resource | Purpose |
|----------|---------|
| HTTP API | `GET /health`, `POST /ingest/link`, `GET /jobs/{job_id}` |
| SQS `yourcookmate-ingest-prod` | Ingest job queue |
| SQS DLQ | Failed jobs after 3 retries |
| `enqueue-ingest` Lambda | Validates request → SQS message → `202` + `job_id` |
| `ingest-worker` Lambda | SQS consumer (stub today; Nova + Supabase next) |

Render + Vercel keep running in parallel until the AWS API is fully wired.

## One-time AWS setup (OIDC for GitHub Actions)

1. Install [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) and log in.
2. Deploy the bootstrap stack (replace your GitHub username):

```bash
aws cloudformation deploy \
  --stack-name yourcookmate-github-oidc \
  --template-file aws/bootstrap/github-oidc.yaml \
  --parameter-overrides GitHubOrg=YOUR_GITHUB_USER GitHubRepo=YourCookMate \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

3. Copy outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name yourcookmate-github-oidc \
  --query "Stacks[0].Outputs" \
  --region us-east-1
```

4. In GitHub → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|--------|--------|
| `AWS_ROLE_ARN` | `DeployRoleArn` from bootstrap output |
| `AWS_REGION` | e.g. `us-east-1` |
| `AWS_DATABASE_URL` | Supabase session pooler URL (same as Render `DATABASE_URL`) |
| `AWS_FRONTEND_URL` | Vercel URL for CORS, e.g. `https://your-cook-mate.vercel.app` |

5. In GitHub → **Settings → Environments**, create **production-aws** (optional approval gate).

6. Enable **Bedrock model access** in AWS Console → Bedrock → Model access → enable **Amazon Nova Lite** (for the worker step).

## CI deploy

On push to `main`, after backend tests pass, the `deploy-aws` job runs:

```bash
sam validate --lint
sam build
sam deploy
```

Stack name: `yourcookmate` (see `samconfig.toml`).

## Local deploy (optional)

```bash
cd aws
sam validate --lint
sam build
sam deploy --guided
```

First run creates an S3 bucket for deployment artifacts automatically (`resolve_s3 = true`).

## Test the deployed API

```bash
API=https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod

curl -s "$API/health"

curl -s -X POST "$API/ingest/link" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

curl -s "$API/jobs/JOB_ID_FROM_ABOVE"
```

Check worker logs in CloudWatch → `/aws/lambda/yourcookmate-IngestWorkerFunction-*`.

## Next integration steps

1. `jobs` table in Supabase + worker writes status/result
2. Bedrock Nova in `ingest_worker` (replace OpenAI parse)
3. Supabase Storage for step images / icons
4. Firebase JWT authorizer on API Gateway
5. Point `VITE_API_URL` (or a separate `VITE_AWS_API_URL`) at the AWS API when ready
