# ⚡ QUICK START: Agent 5 Visual Architecture Deployment

**Goal:** Deploy autonomous architecture diagram generation to Notion  
**Time Needed:** 5 minutes  
**Difficulty:** ⭐ Easy (just restart backend)

---

## 🚀 3-Step Deployment

### Step 1: Verify Code Changes (1 minute)

```bash
cd /Users/sarthakraj/finalee

# Verify syntax is valid
python3 -m py_compile main.py
# Expected: ✅ (no output = success)

# Verify new field is present
grep -c "mermaid_architecture_diagram" main.py
# Expected: 5
```

### Step 2: Restart Backend (1 minute)

```bash
# Kill existing process
pkill -f "python main.py"
sleep 1

# Start fresh instance
python3 main.py
```

**Expected Output:**
```
════════════════════════════════════════════════════════════════
🔵 Aegis Migration Factory - Enterprise Backend v3.2.0
════════════════════════════════════════════════════════════════
📊 Model: anthropic.claude-3-5-sonnet-20241022-v2:0
🔑 AWS Region: us-east-1
✅ Notion Integration: ENABLED (Agent 5 visual diagrams active)
🚀 FastAPI server running on http://0.0.0.0:8000
════════════════════════════════════════════════════════════════
```

✅ If you see **"Agent 5 visual diagrams active"** → Success!

### Step 3: Test with Sample Config (3 minutes)

```bash
# Option A: Upload via Dashboard
# 1. Open http://localhost:3000
# 2. Click upload area
# 3. Select test_real_bedrock.yaml
# 4. Watch SSE stream for Agent 5 event

# Option B: Upload via curl
curl -X POST http://localhost:8000/api/v1/migrate \
  -F "file=@test_real_bedrock.yaml" --no-buffer

# Watch for:
# - "status": "agent_5"
# - "message": "Publishing ADR to Notion workspace..."
```

**Expected Behavior:**
```
status: agent_1 → Analyzing tech debt...
status: agent_2 → Translating infrastructure...
status: agent_3 → Designing architecture...
status: agent_4 → Calculating cost arbitrage...
status: agent_5 → Publishing ADR to Notion... ← NEW!
status: complete → Migration analysis complete!
```

---

## 📋 Verify Notion Update

1. **Open Notion Workspace**
   ```
   URL: https://notion.so/[your-page-id]
   Page ID: <YOUR_PAGE_ID>
   ```

2. **Look for New Section**
   Scroll down and find:
   ```
   "System Architecture Visualization (User → Edge → Compute → Data):"
   ```

3. **See the Diagram!**
   Below that section, you should see:
   ```
   [Beautiful interactive Mermaid flowchart showing]
   User → CloudFront → API Gateway → [Compute Layer] → [Data Layer]
   ```

4. **Interactive Features**
   - 🔍 Click to zoom in/out
   - 📍 Drag to pan
   - 🖥️ Click expand button for full-screen view
   - 🎨 Colored nodes (blue=network, green=compute, orange=storage)

---

## 🎯 What's New?

### Before (v3.1.0)
```
Architecture Strategy
├── Migration Approach: Bottom-Up Topological DAG...
├── Data Gravity Protocol: AWS DMS...
├── Architecture Diagram (Mermaid): [comparison view]
└── [No visual system architecture]
```

### After (v3.2.0) ✨
```
Architecture Strategy
├── Migration Approach: Bottom-Up Topological DAG...
├── Data Gravity Protocol: AWS DMS...
├── Architecture Diagram (Mermaid): [comparison view]
└── System Architecture Visualization: [NEW VISUAL DIAGRAM!]
    └── User → Edge → Compute → Data layers shown visually
```

---

## 🔍 Troubleshooting

### Issue: "Notion Integration: DISABLED"
**Cause:** Missing NOTION_API_KEY or NOTION_PAGE_ID  
**Fix:**
```bash
# Check .env file
cat .env | grep NOTION

# Should see:
# NOTION_API_KEY=ntn_145395058275...
# NOTION_PAGE_ID=c849987baca3...

# If missing, add them:
echo "NOTION_API_KEY=<YOUR_NOTION_TOKEN_HERE>" >> .env
echo "NOTION_PAGE_ID=<YOUR_NOTION_PAGE_ID_HERE>" >> .env
```

### Issue: "agent_5" event doesn't appear
**Cause:** Backend not restarted or old version running  
**Fix:**
```bash
# Kill all Python processes
pkill -9 python3

# Wait 2 seconds
sleep 2

# Check no processes remain
ps aux | grep python | grep -v grep

# Restart backend
python3 main.py
```

### Issue: Diagram not appearing in Notion
**Cause:** API rate limit or invalid Notion credentials  
**Fix:**
```bash
# Check backend logs for errors
tail -50 /tmp/aegis.log

# Verify Notion API key
curl -H "Authorization: Bearer ntn_145395058275..." \
  https://api.notion.com/v1/pages

# If 401: Invalid API key - regenerate from Notion workspace
# If 429: Rate limited - wait 60 seconds and try again
```

---

## 📊 Diagram Structure

The generated diagram shows:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  👤 User/Client (Top)                                           │
│         ↓                                                        │
│  🌐 CloudFront CDN  ← Edge (public internet)                    │
│         ↓                                                        │
│  🔗 API Gateway    ← Ingress (serverless)                       │
│         ↓                                                        │
│  ⚖️ ALB            ← Load balancer                              │
│         ↓                                                        │
│  ┌──────────────────────────────┐                               │
│  │   COMPUTE LAYER              │                               │
│  │  🚀 Lambda Functions         │                               │
│  │  📦 ECS Fargate              │  ← Processing                 │
│  │  💰 EC2 Spot Instances       │                               │
│  └──────────────────────────────┘                               │
│         ↓                                                        │
│  ┌──────────────────────────────┐                               │
│  │   DATA LAYER                 │                               │
│  │  🗄️ RDS PostgreSQL Multi-AZ │                               │
│  │  ⚡ DynamoDB NoSQL           │  ← Persistence               │
│  │  📦 S3 + KMS Encrypted       │                               │
│  └──────────────────────────────┘                               │
│         ↓                                                        │
│  🔐 VPC Endpoints & Security Groups                             │
│  🔑 IAM Roles (Zero-Trust SigV4)                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📚 Documentation Files

After deployment, refer to these for details:

| File | Purpose | Time |
|------|---------|------|
| `AGENT_5_ARCHITECTURE_DIAGRAM_UPGRADE.md` | Complete technical overview | 10 min |
| `AGENT_5_VALIDATION_COMPLETE.md` | Validation report & checklist | 5 min |
| `AGENT_5_CODE_CHANGES_REFERENCE.md` | Side-by-side code changes | 15 min |
| `AGENT_5_QUICK_SETUP.md` | Installation guide | 5 min |
| `START_HERE.md` | Project entry point | 2 min |

---

## ✅ Success Indicators

After deployment, you should see:

- [x] Backend startup: "✅ Notion Integration: ENABLED"
- [x] SSE stream: "agent_5" event during migration
- [x] Notion workspace: New "System Architecture Visualization" section
- [x] Diagram renders: Interactive flowchart with colors and styling
- [x] No errors: All 14 existing tests still passing

---

## 🎉 You're Done!

Agent 5 is now live. Your Notion workspace will automatically receive beautiful architecture diagrams for every GCP→AWS migration analysis!

**Next Time You Upload:**
```
1. Upload GCP config
2. Watch agents analyze (5-8 seconds)
3. ADR auto-publishes to Notion
4. Team sees diagram immediately
5. No manual documentation needed!
```

---

## 🔗 Quick Links

- **Dashboard:** http://localhost:3000
- **API:** http://localhost:8000/docs
- **Notion Workspace:** [page-id-here]
- **Backend Logs:** Run with `-v` flag for verbose

---

**Questions?** Check the comprehensive docs above or review code changes in `main.py` lines 96, 176, 212, 439, 786.

**Status:** ✅ **READY TO USE**

*Deployed: April 1, 2026*  
*Version: 3.2.0*  
*Agent 5: Visual Architecture Diagram Generation ✅*
