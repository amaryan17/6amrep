# ✅ Aegis Migration Factory - Setup Checklist

## Pre-Launch Checklist

### 1. Environment Configuration
- [ ] Copy `.env.example` to `.env`
- [ ] Add `AWS_ACCESS_KEY_ID` to `.env`
- [ ] Add `AWS_SECRET_ACCESS_KEY` to `.env`
- [ ] Set `AWS_DEFAULT_REGION` in `.env` (default: `us-east-1`)
- [ ] Verify `.env` is in `.gitignore`
- [ ] Verify `.env` is NOT committed to git

### 2. AWS Credentials Setup
- [ ] Create AWS IAM user (or use existing credentials)
- [ ] Generate Access Key ID and Secret Access Key
- [ ] Attach Bedrock InvokeModel permission to IAM user
- [ ] Test AWS credentials: `aws sts get-caller-identity`
- [ ] Test Bedrock access: `aws bedrock list-foundation-models --region us-east-1`

### 3. Backend Setup
- [ ] Install Python 3.10+: `python3 --version`
- [ ] Install dependencies: `pip3 install -r requirements.txt`
- [ ] Verify `.env` loads correctly: `python3 -c "from dotenv import load_dotenv; load_dotenv()"`
- [ ] Start backend: `python3 main.py`
- [ ] Test health endpoint: `curl http://localhost:8000/api/v1/health`
- [ ] Verify Bedrock status: Should show "connected" if credentials are valid

### 4. Frontend Setup
- [ ] Install Node.js 18+: `node --version`
- [ ] Install npm packages: `npm install`
- [ ] Update Next.js config for API proxy (if needed)
- [ ] Start frontend: `npm run dev`
- [ ] Verify frontend loads: `http://localhost:3000`

### 5. Integration Testing
- [ ] Backend running on `http://localhost:8000`
- [ ] Frontend running on `http://localhost:3000`
- [ ] CORS enabled on backend (all origins allowed)
- [ ] Upload test GCP file via UI
- [ ] Verify SSE streaming works
- [ ] Check migration results appear in UI

### 6. Cache & Performance
- [ ] Cache enabled in `.env`: `CACHE_ENABLED=true`
- [ ] Test cache hit: Upload same file twice
- [ ] Verify second upload returns cached result
- [ ] Check `/api/v1/cache/stats` endpoint

### 7. Error Handling
- [ ] Test with invalid AWS credentials (should fallback to demo mode)
- [ ] Test with empty file (should return HTTP 400)
- [ ] Test with non-UTF8 file (should return HTTP 400)
- [ ] Test with very large file (should handle gracefully)

### 8. Security Review
- [ ] `.env` file NOT in version control
- [ ] AWS credentials are IAM user (not root account)
- [ ] IAM policy is restrictive (Bedrock InvokeModel only)
- [ ] No credentials in code or logs
- [ ] HTTPS ready for production (use reverse proxy like nginx)

### 9. Documentation
- [ ] `README.md` - Updated with setup instructions
- [ ] `AWS_SETUP.md` - Credentials configuration guide
- [ ] `.env.example` - Template with all variables
- [ ] Code comments - Enterprise-grade documentation

### 10. Deployment Ready
- [ ] Backend deployed to production server
- [ ] Frontend deployed to Vercel/Netlify
- [ ] DNS configured (custom domain)
- [ ] SSL/TLS certificate installed
- [ ] Environment variables set in production
- [ ] Monitoring/logging configured

---

## Quick Start Commands

```bash
# 1. Setup environment
cp .env.example .env
# Edit .env with your AWS credentials

# 2. Install dependencies
pip3 install -r requirements.txt

# 3. Start backend
python3 main.py

# 4. In another terminal, start frontend
cd /Users/sarthakraj/finalee
npm install
npm run dev

# 5. Access the application
# Backend: http://localhost:8000
# Frontend: http://localhost:3000
# API Docs: http://localhost:8000/docs
```

---

## Verify Everything Works

### Backend Health Check
```bash
curl http://localhost:8000/api/v1/health | jq .
```

Expected output:
```json
{
  "status": "healthy",
  "service": "Aegis Migration Factory",
  "version": "2.0.0",
  "bedrock": {
    "status": "connected",
    "message": "AWS Bedrock client initialized...",
    "model_id": "anthropic.claude-3-5-sonnet-20240620-v1:0"
  },
  "cache": {
    "enabled": true,
    "entries": 0
  }
}
```

### Test File Upload
```bash
# Create test file
cat > test.yaml << 'EOF'
resources:
- name: my-instance
  type: compute.v1.instance
  properties:
    zone: us-central1-a
    machineType: n1-standard-1
EOF

# Upload via API
curl -X POST http://localhost:8000/api/v1/migrate -F "file=@test.yaml"
```

### Frontend Access
Open browser: `http://localhost:3000`
- Drag & drop GCP file
- Watch real-time SSE events
- View Bedrock analysis results

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| `ModuleNotFoundError: boto3` | Run `pip3 install -r requirements.txt` |
| `InvalidSignatureException` from AWS | Check AWS credentials in `.env` |
| Backend starts but Bedrock shows "disconnected" | AWS credentials not configured - update `.env` |
| Frontend can't reach backend (CORS error) | Ensure backend CORS middleware is enabled |
| File upload hangs | Check if backend is processing (check logs) |
| Demo mode responses instead of real Bedrock | AWS credentials missing - add to `.env` |

---

## Next Steps

1. **Add your AWS credentials** to `.env`
2. **Start the backend**: `python3 main.py`
3. **Verify connection**: `curl http://localhost:8000/api/v1/health`
4. **Start frontend**: `npm run dev`
5. **Test upload** via the UI at `http://localhost:3000`

---

**Status**: ✅ Ready for Hackathon  
**Built for**: HACK'A'WAR 2026  
**Last Updated**: April 2026
