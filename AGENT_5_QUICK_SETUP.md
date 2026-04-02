# ⚡ AGENT 5 QUICK SETUP (5 MINUTES)

## TL;DR - Get Agent 5 Running in 5 Steps

### Step 1: Get Notion API Key (2 min)
```bash
# Go to: https://www.notion.so/my-integrations
# Click: Create new integration
# Name: "Aegis Migration Factory"
# Select workspace, Submit
# COPY: Internal Integration Token (looks like: secret_xxxxx...)
```

### Step 2: Get Notion Page ID (1 min)
```bash
# In Notion, open the page where ADRs should go
# Look at the URL bar, example:
# https://www.notion.so/12a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7?v=xyz
# COPY: The ID part (12a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7)
```

### Step 3: Update .env (1 min)
```bash
cd /Users/sarthakraj/finalee

# Add these two lines to .env:
NOTION_API_KEY=secret_your_api_key_here
NOTION_PAGE_ID=your_page_id_here

# Example:
NOTION_API_KEY=secret_12a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7
NOTION_PAGE_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Step 4: Grant Notion Access (1 min)
```
In your Notion page:
1. Click "Share" (top right)
2. Search for "Aegis Migration Factory"
3. Click to select integration
4. Verify permissions show "Edit"
5. Done!
```

### Step 5: Verify It Works (Automatic)
```bash
# Restart backend
pkill -f "python main.py"
sleep 1

cd /Users/sarthakraj/finalee
python main.py

# Should show:
# ✅ Notion Integration: ENABLED

# Upload a GCP config file
curl -X POST http://localhost:8000/api/v1/migrate \
  -F "file=@your_gcp_config.yaml" \
  --no-buffer

# Look for in stream:
# data: {"status": "agent_5", "message": "Publishing..."}

# Check Notion page - new ADR should appear!
```

---

## What You'll See

### In Stream (SSE)
```
data: {"status": "agent_1", "message": "Analyzing technical debt..."}
data: {"status": "agent_2", "message": "Translating to Terraform..."}
data: {"status": "agent_3", "message": "Designing AWS architecture..."}
data: {"status": "agent_4", "message": "Calculating cost arbitrage..."}
data: {"status": "agent_5", "message": "Publishing Architecture Decision Record..."}
data: {"status": "complete", "result": {...}}
```

### In Notion (New ADR Page)
```
🏗️ Aegis Auto-Generated ADR: GCP to AWS Migration
Generated: 2026-04-01T14:32:15

🏛️ ARCHITECTURE STRATEGY
  [Migration approach, DMS config, Architecture diagram]

💰 FINOPS ARBITRAGE
  [Cost comparison, savings %, arbitrage details]

🔐 ZERO-TRUST SECURITY
  [IAM policy, compliance framework]

📊 CODE HEALTH
  [Health score, issues fixed]

🔧 TERRAFORM
  [IaC summary, code snippet]
```

---

## If Something Goes Wrong

### Notion Key Invalid?
```bash
# Go back to: https://www.notion.so/my-integrations
# Copy the token again (it might have changed)
# Update .env, restart: pkill -f "python main.py" && python main.py
```

### Page ID Wrong?
```bash
# Copy the ID from URL again (12a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7)
# Make sure integration has "Edit" access (Notion Share)
# Update .env, restart
```

### Integration Has No Access?
```bash
# In your Notion page, Share > find "Aegis Migration Factory"
# Make sure it shows "Edit" permissions
# If not there, click "Add" and search for it
```

### Still Not Working?
```bash
# Check logs:
tail -50 ~/.local/share/aegis/logs.txt | grep -i notion

# Test Notion API directly:
curl -X GET https://api.notion.com/v1/pages \
  -H "Authorization: Bearer secret_your_key" \
  -H "Notion-Version: 2022-06-28"

# If you get 401 → Invalid API key
# If you get 404 → Invalid page ID
# If you get 403 → No access, grant in Notion Share
```

---

## Optional: Disable Notion (If You Want)

If you don't have Notion or don't want ADR publishing:

```bash
# Just leave NOTION_API_KEY and NOTION_PAGE_ID blank in .env
# Restart backend

# Should show:
# 🔕 Notion Integration: DISABLED (Agent 5 publishing inactive)

# Migration analysis still works perfectly!
# Just no ADRs published to Notion
```

---

## System Already Working?

Agent 5 is **non-blocking**, so if Notion fails:
- ✅ Migration analysis still completes
- ✅ User gets results immediately
- ✅ Error is logged but doesn't crash system
- ✅ You can retry on next upload

No risk of breaking anything!

---

## More Details?

See the comprehensive guides:
- **Setup Details:** `NOTION_INTEGRATION_GUIDE.md`
- **Testing:** `AGENT_5_TESTING_GUIDE.md`
- **Troubleshooting:** `AGENT_5_DEPLOYMENT_COMPLETE.md`

---

## Verification Checklist

- [ ] NOTION_API_KEY added to .env
- [ ] NOTION_PAGE_ID added to .env
- [ ] Notion page shared with integration (Edit access)
- [ ] Backend restarted (`python main.py`)
- [ ] Backend shows "✅ Notion Integration: ENABLED"
- [ ] Test upload sent
- [ ] Agent 5 event seen in stream
- [ ] ADR appears in Notion page within 5 seconds
- [ ] ADR has all 7 sections (Architecture, FinOps, Security, Code Health, Terraform, Metadata, Diagram)

---

✅ **You're done! Agent 5 is ready to use.**

---

**Version:** 3.1.0  
**Setup Time:** ~5 minutes  
**Difficulty:** ⭐ Easy (just copy-paste credentials)  
**Risk Level:** 🟢 None (non-blocking, gracefully degrades)
