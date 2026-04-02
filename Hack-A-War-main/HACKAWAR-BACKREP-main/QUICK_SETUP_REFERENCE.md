# 🚀 QUICK REFERENCE - Aegis Migration Factory

## ⚡ One-Minute Setup Recap

**Status**: ✅ Complete and Running

```bash
# Your AWS credentials are now in .env and loaded
# Backend is running on port 8000
# Ready for real Bedrock invocations
```

---

## 🎯 Key Files

| File | What It Does |
|------|-------------|
| `.env` | Your AWS credentials (DO NOT COMMIT) |
| `main.py` | Backend with real Bedrock integration |
| `validate_credentials.py` | Verify setup is correct |
| `CREDENTIALS_CONFIGURED.md` | Detailed status report |

---

## 🔥 Quick Commands

```bash
# Check credentials are loaded
python3 validate_credentials.py

# Test health endpoint
curl http://localhost:8000/api/v1/health

# Test migration (real Bedrock)
curl -X POST http://localhost:8000/api/v1/migrate \
  -F "file=@test_real_bedrock.yaml"

# Check backend logs
tail -f /tmp/backend.log

# Restart backend
lsof -ti:8000 | xargs kill -9
python3 main.py &
```

---

## 🏗️ Architecture

```
Frontend (React/Next.js)
        ↓
Backend (FastAPI) → AWS Bedrock (Claude 3.5 Sonnet)
        ↓
Real Bedrock Analysis (GCP → AWS Migration)
```

---

## 📊 What's Working

✅ Real AWS Bedrock invocations (not demo mode)
✅ Exponential backoff retry (3 attempts, 2-10s wait)
✅ Pydantic V2 strict validation
✅ File hashing & caching
✅ SSE streaming
✅ Multi-agent orchestration

---

## ⚠️ Remember

- `.env` is gitignored ✅
- Credentials are never in logs ✅
- Use `.env.example` for team ✅
- Deploy with IAM roles (not credentials) ✅

---

## 🎓 Your Credentials

```
AWS_ACCESS_KEY_ID:     AKIAYPUT7W6QA6YEQYLV
AWS_SECRET_ACCESS_KEY: [HIDDEN - check .env]
AWS_DEFAULT_REGION:    us-east-1
BEDROCK_MODEL:         anthropic.claude-3-5-sonnet-20241022-v2:0
```

---

## 🚀 Next Steps

1. Test with frontend at `http://localhost:3000`
2. Upload GCP configs and verify real migration analysis
3. Check cache works (same file = instant response)
4. Prepare for hackathon judges
5. Deploy with IAM roles

---

**Status**: ✅ READY FOR HACK'A'WAR 2026
**Backend**: Running on port 8000
**Bedrock**: Connected with real credentials
**Next**: Test frontend integration
