#!/bin/bash
# 🎯 Aegis Migration Factory - Quick Setup Script
# This script helps you set up AWS credentials and validate the setup

set -e

echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                    AEGIS MIGRATION FACTORY - SETUP                         ║"
echo "║              Enterprise-Grade GCP-to-AWS Migration Pipeline                ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "   Creating .env from .env.example..."
    cp .env.example .env
    echo -e "${GREEN}✅ Created .env${NC}"
fi

echo ""
echo "📋 Environment Files:"
echo "────────────────────────────────────────────────────────────────────────────"
echo -e "  .env               ${GREEN}✓${NC} Your credentials (gitignored)"
echo -e "  .env.example       ${GREEN}✓${NC} Template for team"
echo -e "  .gitignore         ${GREEN}✓${NC} Protects .env"
echo ""

# Check Python
echo "📦 Python Dependencies:"
echo "────────────────────────────────────────────────────────────────────────────"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 not found!${NC}"
    echo "   Install Python 3.10+: https://www.python.org/downloads/"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo -e "  Python ${PYTHON_VERSION}          ${GREEN}✓${NC}"

# Install/check requirements
echo -e "  Installing dependencies..."
pip3 install -q -r requirements.txt 2>/dev/null
echo -e "  Requirements            ${GREEN}✓${NC}"
echo ""

# Run validation
echo "🔐 Validating Credentials:"
echo "────────────────────────────────────────────────────────────────────────────"
python3 validate_credentials.py

echo ""
echo "🚀 Next Steps:"
echo "────────────────────────────────────────────────────────────────────────────"
echo ""
echo "1️⃣  ADD YOUR AWS CREDENTIALS:"
echo "   nano .env"
echo "   (Add your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY)"
echo ""
echo "2️⃣  VALIDATE SETUP:"
echo "   python3 validate_credentials.py"
echo ""
echo "3️⃣  START BACKEND:"
echo "   python3 main.py"
echo ""
echo "4️⃣  TEST IN BROWSER:"
echo "   Backend: http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "📖 For detailed instructions, see: AWS_SETUP.md"
echo ""
