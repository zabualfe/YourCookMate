# YourCookMate AWS (SAM)

**Single API** on API Gateway + Lambda: auth, recipes, collections, async ingest, Bedrock parse, email, and S3 uploads.

Supabase is the database; Vercel hosts the web app.

## What gets deployed

| Resource | Purpose |
|----------|---------|
| HTTP API | All routes — auth, CRUD, ingest, parse, email, health |
| `ApiFunction` | FastAPI via Mangum — auth, recipes, collections, admin |
| SQS + worker | Async video ingest (yt-dlp, Bedrock, Transcribe) |
| S3 `UploadsBucket` | Recipe icons and media (public read) |

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

The `deploy-aws` job uses GitHub environment **`production-api`**. The OIDC token `sub` claim is:

`repo:zabualfe/YourCookMate:environment:production-api`

Re-run bootstrap after changing trust rules:

```bash
./aws/bootstrap/setup-oidc.sh
```

If you see **`InvalidIdentityToken`**, update the GitHub OIDC provider thumbprints (GitHub rotated certs):

```bash
aws iam update-open-id-connect-provider-thumbprint \
  --open-id-connect-provider-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):oidc-provider/token.actions.githubusercontent.com" \
  --thumbprint-list 6938fd4d98bab03faad8791377124e47b9e575b3 1c58a3a8518e8759bf075b1264325b37bf061415
```

If you see **`AccessDenied`** on AssumeRole, the role trust policy `sub` does not match the job environment name — re-run bootstrap above.

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

When `VITE_API_URL` points at AWS:

```
All API calls → API Gateway
  Auth / recipes / collections → ApiFunction (Mangum + FastAPI)
  Import from link → enqueue Lambda → SQS → worker
  Parse text → ParseRecipeFunction (Bedrock Nova)
  Email verify → ApiFunction → Resend HTTPS API
  Icons → S3 UploadsBucket
```

### GitHub secrets (SAM deploy)

| Secret | Value |
|--------|--------|
| `AWS_ROLE_ARN`, `AWS_REGION` | OIDC deploy role |
| `AWS_DATABASE_URL` | Supabase pooler URL |
| `AWS_JWT_SECRET` | JWT signing (keep stable across deploys) |
| `AWS_FRONTEND_URL` | Primary frontend URL |
| `AWS_CORS_ORIGINS` | Comma-separated origins (prod + QA) |
| `AWS_RESEND_API_KEY` | Resend API key |
| `AWS_GOOGLE_CLIENT_ID`, `AWS_GOOGLE_CLIENT_SECRET`, `AWS_GOOGLE_IOS_CLIENT_ID` | Google OAuth |
| `AWS_APPLE_CLIENT_ID`, `AWS_APPLE_IOS_CLIENT_ID` | Apple Sign In (optional) |
| `AWS_YTDLP_COOKIES_B64` | Run `./aws/bootstrap/encode-cookies.sh` on `backend/cookies.social.txt` |

Get AWS URL after deploy:

```bash
aws cloudformation describe-stacks --stack-name yourcookmate \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text
```

Set that URL as `VITE_API_URL` on Vercel. `GET /health` should return `"runtime": "lambda"`.

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

1. Custom domain on API Gateway (e.g. `api.yourcookmate.com`)
2. Firebase JWT authorizer on API Gateway
3. CloudFront in front of S3 uploads
4. Provisioned concurrency on `ApiFunction` if cold starts matter
