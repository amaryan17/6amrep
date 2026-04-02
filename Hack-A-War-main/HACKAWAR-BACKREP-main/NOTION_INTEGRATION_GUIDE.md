# 🔗 Notion API Integration - Agent 5 ADR Publisher

## Overview

The Aegis Migration Factory now includes **Agent 5: Notion ADR Publisher** - an asynchronous, non-blocking integration that automatically publishes Architecture Decision Records (ADRs) to Notion as part of the migration analysis pipeline.

## Features

✅ **Automatic ADR Generation**
- Transforms Bedrock JSON output into beautiful Notion blocks
- Zero-Trust security policies presented as formatted Notion pages
- Cost arbitrage details with visual formatting

✅ **Non-Blocking Error Handling**
- If Notion API fails, times out, or rate-limits → does NOT crash the pipeline
- Migration analysis completes and returns to user regardless of Notion status
- All errors are logged but isolated from main flow

✅ **Structured Content**
- Heading 1: "🏗️ Aegis Auto-Generated ADR: GCP to AWS Migration"
- Heading 2 sections for: Architecture, FinOps, Security, Tech Debt, Terraform
- Code blocks for IAM policies and Terraform configuration
- Bullet points for issues fixed and migration details

---

## Setup Instructions

### Step 1: Get Notion API Credentials

1. **Create Notion Integration:**
   - Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
   - Click "Create new integration"
   - Name: "Aegis Migration Factory"
   - Select workspace
   - Click "Submit"
   - Copy the **Internal Integration Token** (this is your NOTION_API_KEY)

2. **Create Notion Page/Database:**
   - In Notion, create a page where ADRs will be stored
   - Example: "Cloud Migrations / Aegis ADR Library"
   - Get the page ID from the URL:
     ```
     https://www.notion.so/12a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7?v=abc
     Page ID: 12a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7
     ```

3. **Grant Integration Access:**
   - In your Notion page, click "Share"
   - Search for your integration name ("Aegis Migration Factory")
   - Grant "Edit" permissions
   - Copy the **Page ID** (this is your NOTION_PAGE_ID)

### Step 2: Update `.env` File

```bash
# Notion API Configuration
NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_PAGE_ID=12a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7
```

### Step 3: Verify Installation

```bash
# Check backend logs for Notion integration status
cd /Users/sarthakraj/finalee
python main.py

# You should see in logs:
# "Notion Integration: ✅ ENABLED"
```

---

## What Gets Published

### 1. Architecture Strategy Section
- **Migration Approach** (N-Tier DAG, Lift-and-Shift, etc.)
- **Data Gravity Protocol** (AWS DMS details)
- **Architecture Diagram** (Mermaid syntax in code block)

### 2. FinOps Arbitrage Section
- **Cost Comparison** (GCP vs AWS monthly/annual)
- **Savings Percentage** (in green, bold)
- **Compute Arbitrage Action** (specific VM-to-AWS mappings)
- **Carbon Impact** (CO₂ reduction per month)

### 3. Zero-Trust Security Section
- **Security Framework** (Zero-Trust + SOC-2)
- **IAM Policy** (Complete JSON policy in code block)

### 4. Code Health Section
- **Health Score** (0-100)
- **Issues Fixed** (bulleted list of deprecated patterns)

### 5. Infrastructure-as-Code Section
- **Translation Summary** (lines converted)
- **Terraform Code** (first 2000 characters in code block)
- **Note** (full code available in dashboard)

---

## Data Flow

```
1. User uploads GCP infrastructure file
        ↓
2. FastAPI /api/v1/migrate endpoint receives file
        ↓
3. SSE streaming begins:
   - Agent 1-4 events streamed to frontend
   - Bedrock processes file
   - Result validated with Pydantic
   - Result cached
        ↓
4. BEFORE returning complete event:
   - Agent 5 SSE event: "Publishing ADR to Notion..."
   - publish_to_notion() runs asynchronously (non-blocking)
   - If success: ADR created in Notion, logged
   - If failure: Error logged, but DOES NOT block response
        ↓
5. Final "complete" event with full JSON sent to frontend
        ↓
6. Frontend displays all results + migration analysis
```

---

## Example ADR Output in Notion

```
═════════════════════════════════════════════════════════════════

🏗️ Aegis Auto-Generated ADR: GCP to AWS Migration

Generated: 2026-04-01T14:32:15.123456 | Status: APPROVED

─────────────────────────────────────────────────────────────────

🏛️ ARCHITECTURE STRATEGY

  Migration Approach: Bottom-Up Topological DAG for 3-Tier: 
  Stateful (RDS) → Network (VPC) → Stateless (Compute/Lambda) → 
  Security (IAM)

  Data Gravity Protocol: AWS DMS Private Tunnel with continuous 
  replication (zero-downtime cutover)

  Architecture Diagram (Mermaid):
  ┌──────────────────────────────────────────────┐
  │ graph TD                                     │
  │   subgraph GCP                               │
  │     A["8x n1-standard-8 VMs"]                │
  │     B["Cloud SQL"]                           │
  │   end                                        │
  │   subgraph "AWS 3-Tier"                      │
  │     D["RDS Multi-AZ"]                        │
  │     E["Spot/Lambda"]                         │
  │   end                                        │
  │   A -->|Refactor| E                          │
  │   B -->|DMS| D                               │
  └──────────────────────────────────────────────┘

─────────────────────────────────────────────────────────────────

💰 FINOPS ARBITRAGE & COST OPTIMIZATION

  GCP Monthly Cost: $4,230.50 → AWS Monthly Cost: $925.75 
  (78.1% savings)

  Compute Arbitrage Action: Refactored 8x n1-standard-8 VMs 
  ($2,840/month) → AWS Spot instances + Lambda cluster with 75% 
  compute discount ($710/month). Total arbitrage: $1,920/month 
  savings via serverless refactoring and spot fleet optimization.

  Environmental Impact: 89.4 kg CO₂ reduction per month

─────────────────────────────────────────────────────────────────

🔐 ZERO-TRUST SECURITY & COMPLIANCE

  Security Framework: Zero-Trust + Protected Assets + SOC-2 Audit Ready

  Least-Privilege IAM Policy:
  ┌──────────────────────────────────────────────┐
  │ {                                            │
  │   "Version": "2012-10-17",                   │
  │   "Statement": [                             │
  │     {                                        │
  │       "Sid": "RDSAccess-Least-Privilege",   │
  │       "Effect": "Allow",                     │
  │       "Action": ["rds-db:connect"],          │
  │       "Resource": "arn:aws:rds:...",         │
  │       "Condition": {                         │
  │         "StringEquals": {                    │
  │           "aws:SourceIp": ["10.0.0.0/16"]  │
  │         }                                    │
  │       }                                      │
  │     }                                        │
  │   ]                                          │
  │ }                                            │
  └──────────────────────────────────────────────┘

─────────────────────────────────────────────────────────────────

🔍 CODE HEALTH & TECH DEBT

  Code Health Score: 74/100

  Issues Fixed:
    • Deprecated google.cloud.compute API (v1beta1) → boto3 EC2
    • Legacy GCP Deployment Manager YAML → Terraform HCL2
    • gcloud CLI commands → AWS CLI v2 with IAM role-based auth
    • Unencrypted Cloud Storage buckets → S3 with KMS encryption

═════════════════════════════════════════════════════════════════
```

---

## Error Handling

### Notion API Failures (Non-Blocking)

| Scenario | Behavior | Logging |
|----------|----------|---------|
| Invalid API Key | ADR not created, warning logged | ⚠️ |
| Invalid Page ID | ADR not created, warning logged | ⚠️ |
| Rate Limited (429) | Retry not attempted, warning logged | ⚠️ |
| Timeout (>10s) | Request cancelled, warning logged | ⚠️ |
| Network Error | Connection error logged, continues | ⚠️ |
| Missing Config | Notion disabled, migration continues | 🔕 |
| **Result** | **Migration completes normally** | **✅** |

### Example Log Output

```
2026-04-01 14:32:15 | aegis_factory | INFO | 📝 Agent 5: Publishing Architecture Decision Record to Notion...
2026-04-01 14:32:16 | aegis_factory | INFO | ✅ Successfully published ADR to Notion (47 blocks)
2026-04-01 14:32:17 | aegis_factory | INFO | 🎉 Enterprise migration analysis complete...
```

---

## API Limits & Best Practices

### Notion API Rate Limits
- **3 requests per second** (per integration)
- **100 blocks per request** (Aegis batches automatically)
- Typical ADR: 40-50 blocks = 1 request

### Recommendations
1. **Don't configure Notion keys in public repos**
   - Use `.env` file (already in `.gitignore`)
   - Use secrets management in production

2. **Monitor Notion Page Size**
   - Each ADR adds 40-50 blocks
   - Archive old ADRs periodically (monthly/quarterly)

3. **Use Notion Database View**
   - Create a "database" view to organize ADRs
   - Filter by date, architecture pattern, cost savings
   - Example: Properties = [Date, GCP Cost, AWS Cost, Savings %]

---

## Testing

### Test 1: Verify Configuration

```bash
# Check if Notion is enabled
curl http://localhost:8000/api/v1/health | jq '.notion_integration'

# Expected output:
# "ENABLED"
```

### Test 2: Trigger ADR Publication

```bash
# Upload a test GCP config file
curl -X POST http://localhost:8000/api/v1/migrate \
  -F "file=@test_config.yaml" \
  --no-buffer | grep -i "agent_5"

# Expected output:
# data: {"status": "agent_5", "message": "Publishing Architecture Decision Record to corporate Notion workspace..."}
```

### Test 3: Verify Notion Page

1. Go to your Notion page in browser
2. Refresh the page
3. You should see a new ADR with:
   - Title: "🏗️ Aegis Auto-Generated ADR: GCP to AWS Migration"
   - Timestamp: Current date/time
   - All sections populated with your migration data

---

## Troubleshooting

### "Notion Integration: 🔕 DISABLED"

**Cause:** `NOTION_API_KEY` or `NOTION_PAGE_ID` not set in `.env`

**Solution:**
```bash
# Check .env file
grep NOTION_ /Users/sarthakraj/finalee/.env

# Should output:
# NOTION_API_KEY=secret_xxx
# NOTION_PAGE_ID=12a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7

# If missing, add them and restart:
python main.py
```

### "⚠️ Notion API returned status 401"

**Cause:** Invalid API key

**Solution:**
1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click on "Aegis Migration Factory" integration
3. Copy the **INTERNAL INTEGRATION TOKEN** again
4. Update `.env` file
5. Restart backend

### "⚠️ Notion API returned status 404"

**Cause:** Invalid page ID or integration doesn't have access

**Solution:**
1. Verify page ID from URL (remove `/v=...` part)
2. Go to Notion page → Share → Check integration has "Edit" access
3. Update `.env` with correct page ID
4. Restart backend

### "⚠️ Notion API request timed out"

**Cause:** Network latency or Notion service slow

**Solution:**
- This is normal and non-blocking
- Migration analysis still completes and returns to user
- ADR may publish on next attempt
- No action needed - system is resilient

---

## Future Enhancements

💡 **Planned Features:**
- [ ] Batch multiple ADRs into a database view
- [ ] Add "Status" property (Draft, Approved, Rejected)
- [ ] Link to GitHub PR for approval workflow
- [ ] Export ADR as PDF from Notion
- [ ] Add review comments template
- [ ] Integration with Slack (notify when ADR published)
- [ ] Custom Notion template support

---

## Documentation Files

Related documentation:
- `ENTERPRISE_UPGRADE_SUMMARY.md` - Feature overview
- `ENTERPRISE_DEPLOYMENT_GUIDE.md` - Testing & deployment
- `ENTERPRISE_CODE_REFERENCE.md` - Code line references
- `UPGRADE_BEFORE_AFTER_COMPARISON.md` - Changes summary

---

## Support

For issues with Notion integration:
1. Check logs: `tail -f /tmp/aegis_backend.log`
2. Verify credentials in `.env`
3. Test Notion API directly: `curl -H "Authorization: Bearer YOUR_KEY" https://api.notion.com/v1/pages`
4. Check [Notion API docs](https://developers.notion.com/reference)

---

**Version:** 3.1.0-notion  
**Date:** April 1, 2026  
**Status:** ✅ PRODUCTION READY
