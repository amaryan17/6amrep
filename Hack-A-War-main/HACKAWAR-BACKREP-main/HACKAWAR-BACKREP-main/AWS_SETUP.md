# 🔐 AWS Credentials Setup Guide - Aegis Migration Factory

## Quick Setup

### 1. **Configure AWS Credentials**

Copy the example environment file and add your AWS credentials:

```bash
cp .env.example .env
```

Then edit `.env` and add your AWS credentials:

```bash
nano .env
```

Fill in the required fields:

```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=wJal...
AWS_DEFAULT_REGION=us-east-1
```

### 2. **Obtain AWS Credentials**

#### Option A: Using AWS IAM User (Recommended for Development)

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Click **Users** → Create a new user named `aegis-bedrock-user`
3. Attach the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0"
    }
  ]
}
```

4. Generate access keys and save them securely

#### Option B: Using AWS Temporary Credentials (STS)

For hackathon/temporary access, use AWS STS:

```bash
aws sts get-session-token --duration-seconds 3600
```

Then use the temporary credentials in `.env`:

```env
AWS_ACCESS_KEY_ID=ASIA...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...
```

#### Option C: Using AWS CLI Configuration

If you already have AWS CLI configured locally:

```bash
# AWS credentials are read from ~/.aws/credentials automatically
# Just ensure your .env has the region configured
AWS_DEFAULT_REGION=us-east-1
```

### 3. **Verify Setup**

Test the connection:

```bash
# Test AWS credentials
aws sts get-caller-identity

# Test Bedrock access
aws bedrock list-foundation-models --region us-east-1 | grep claude-3-5-sonnet
```

### 4. **Start the Backend**

```bash
python3 main.py
```

You should see:

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    AEGIS MIGRATION FACTORY - BACKEND                         ║
║              Enterprise-Grade GCP-to-AWS Migration Pipeline                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

📍 AWS Region: us-east-1
🤖 Bedrock Model: anthropic.claude-3-5-sonnet-20240620-v1:0
🔄 Retry Policy: Up to 3 attempts with exponential backoff
💾 Caching: ENABLED

✅ Bedrock client initialized
Starting Uvicorn ASGI server...
API Documentation: http://localhost:8000/docs
```

### 5. **Test Migration Endpoint**

```bash
curl -X POST http://localhost:8000/api/v1/migrate \
  -F "file=@sample_gcp_code.yaml"
```

Expected response (Server-Sent Events stream):

```json
data: {"status": "system", "message": "SHA-256 hash generated. Initializing Bedrock..."}

data: {"status": "agent_1", "message": "Pre-Flight: Scrubbing Tech Debt & Deprecated Libraries..."}

data: {"status": "agent_2", "message": "Translating GCP Primitives to AWS Terraform..."}

...

data: {"status": "complete", "result": {...}}
```

---

## 🔒 Security Best Practices

### ⚠️ DO NOT

- ❌ Commit `.env` file to version control (added to `.gitignore`)
- ❌ Share AWS credentials in chat/emails
- ❌ Use long-lived IAM user keys for production
- ❌ Store credentials in code or environment variables without encryption

### ✅ DO

- ✅ Use environment variables via `.env` file
- ✅ Restrict IAM policies to minimum required permissions
- ✅ Rotate credentials every 90 days
- ✅ Use AWS STS for temporary credentials
- ✅ Use AWS IAM roles when deployed to AWS (EC2, Lambda, ECS, etc.)
- ✅ Monitor API usage in CloudTrail
- ✅ Use AWS Secrets Manager for production deployments

---

## 📋 Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | ✅ Yes | - | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | ✅ Yes | - | AWS IAM secret key |
| `AWS_DEFAULT_REGION` | ❌ No | `us-east-1` | AWS region for Bedrock |
| `BEDROCK_MODEL_ID` | ❌ No | Claude 3.5 Sonnet | Bedrock model to use |
| `MAX_RETRIES` | ❌ No | `3` | Retry attempts with exponential backoff |
| `CACHE_ENABLED` | ❌ No | `true` | Enable migration result caching |
| `SERVER_HOST` | ❌ No | `0.0.0.0` | Backend server host |
| `SERVER_PORT` | ❌ No | `8000` | Backend server port |

---

## 🚀 Deployment Considerations

### Local Development
Use `.env` with AWS IAM user credentials (short-lived)

### Staging/Production on AWS
```bash
# Use IAM role instead of credentials
# The Bedrock client will automatically use the instance role

# No need to set AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY
# Just set the region:
export AWS_DEFAULT_REGION=us-east-1
```

### Docker Deployment
```dockerfile
# Dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY main.py .
CMD ["python", "main.py"]
```

```bash
# Run with environment variables
docker run \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  -e AWS_DEFAULT_REGION=us-east-1 \
  -p 8000:8000 \
  aegis-migration-factory
```

---

## 🐛 Troubleshooting

### Error: "InvalidSignatureException"
- AWS credentials are invalid or expired
- Verify credentials in `.env`
- Check AWS_DEFAULT_REGION is correct

### Error: "AccessDenied" on Bedrock
- IAM user doesn't have `bedrock:InvokeModel` permission
- Attach the policy mentioned in "Option A" above

### Error: "ModuleNotFoundError: No module named 'dotenv'"
- Install python-dotenv: `pip install python-dotenv`

### Backend not loading .env
- Ensure `.env` is in the same directory as `main.py`
- Check file permissions: `chmod 600 .env`

### Bedrock returning "Demo Mode" responses
- AWS credentials are not configured
- Follow steps 1-3 above to set up credentials
- Check: `python3 -c "import os; from dotenv import load_dotenv; load_dotenv(); print(os.getenv('AWS_ACCESS_KEY_ID'))"`

---

## 📞 Support

For AWS credential issues:
- [AWS IAM Documentation](https://docs.aws.amazon.com/iam/)
- [Bedrock API Documentation](https://docs.aws.amazon.com/bedrock/)
- [AWS CLI Configuration](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html)

---

**Last Updated**: April 2026  
**Built for**: HACK'A'WAR 2026 - Aegis Migration Factory
