# YourCookMate AWS (SAM)

API Gateway + SQS + Lambda for async ingest. Supabase stays the database; Bedrock Nova and Firebase auth come in follow-up steps.

## What gets deployed

| Resource | Purpose |
|----------|---------|
| HTTP API | `GET /health`, `POST /ingest/link`, `GET /jobs/{job_id}`, `POST /recipes/parse` |
| SQS `yourcookmate-ingest-prod` | Ingest job queue |
| SQS DLQ | Failed jobs after 3 retries |
| `enqueue-ingest` Lambda | Validates request → SQS message → `202` + `job_id` |
| `parse-recipe` Lambda | Bedrock Nova — breaks raw text into structured steps |
| `ingest-worker` Lambda | SQS consumer — yt-dlp, Bedrock vision, Transcribe |

Render + Vercel keep running in parallel until the AWS API is fully wired.

## One-time AWS setup (OIDC for GitHub Actions)

Run the setup script from the repo root (creates the GitHub OIDC provider if missing, then deploys the IAM role):

```bash
./aws/bootstrap/setup-oidc.sh
```

Or manually:

```bash
# 1. Create GitHub OIDC provider (skip if it already exists in your account)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faad8791377124e47b9e575b3

# 2. Deploy deploy role
aws cloudformation deploy \
  --stack-name yourcookmate-github-oidc \
  --template-file aws/bootstrap/github-oidc.yaml \
  --parameter-overrides GitHubOrg=zabualfe GitHubRepo=YourCookMate GitHubEnvironment=production-aws \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

Copy the role ARN:

```bash
aws cloudformation describe-stacks \
  --stack-name yourcookmate-github-oidc \
  --query "Stacks[0].Outputs[?OutputKey=='DeployRoleArn'].OutputValue" \
  --output text \
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

### Troubleshooting OIDC

The `deploy-aws` job uses GitHub environment **`production-aws`**. That means the OIDC token `sub` claim is:

`repo:zabualfe/YourCookMate:environment:production-aws`

—not `repo:...:ref:refs/heads/main`. The bootstrap template must allow **both** (already fixed in-repo).

If CI fails with `Not authorized to perform sts:AssumeRoleWithWebIdentity`, re-run the bootstrap stack to update the role trust policy:

```bash
aws cloudformation deploy \
  --stack-name yourcookmate-github-oidc \
  --template-file aws/bootstrap/github-oidc.yaml \
  --parameter-overrides GitHubOrg=zabualfe GitHubRepo=YourCookMate GitHubEnvironment=production-aws \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

Also verify `AWS_ROLE_ARN` matches the `DeployRoleArn` output and the repo name casing is exactly `YourCookMate`.

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

## Wired ingest flow (production)

When `VITE_AWS_API_URL` or `AWS_API_URL` is set on Vercel:

```
Import from link → AWS API → SQS → Worker Lambda
  → yt-dlp (metadata + video)
  → Amazon Transcribe (speech)
  → Bedrock Nova (frame vision)
  → Supabase jobs table
  → client polls GET /jobs/{id}
```

**No Render** for ingestion. Render still serves auth, recipes, and `/recipes/parse`.

### GitHub secrets (SAM deploy)

| Secret | Value |
|--------|--------|
| `AWS_DATABASE_URL` | Supabase pooler URL |
| `AWS_FRONTEND_URL` | Vercel URL |
| `AWS_YTDLP_COOKIES_B64` | Run `./aws/bootstrap/encode-cookies.sh` on `backend/cookies.social.txt` |

Enable **Amazon Nova Lite** in Bedrock model access.

Get AWS URL after deploy:

```bash
aws cloudformation describe-stacks --stack-name yourcookmate \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text
```

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
