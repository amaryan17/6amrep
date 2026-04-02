#!/usr/bin/env python3
"""
🔐 Aegis Migration Factory - AWS Credentials Validator
Validates that AWS credentials are properly configured without exposing them.
"""

import os
import sys
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def check_env_variable(var_name: str, required: bool = True) -> bool:
    """Check if environment variable is set."""
    value = os.getenv(var_name)
    
    if not value:
        if required:
            print(f"❌ {var_name}: MISSING (required)")
            return False
        else:
            print(f"⚠️  {var_name}: not set (using default)")
            return True
    
    # Don't print the actual value for security
    masked_value = value[:4] + "***" + value[-4:] if len(value) > 8 else "***"
    print(f"✅ {var_name}: configured ({masked_value})")
    return True

def validate_aws_credentials() -> bool:
    """Validate AWS credentials are accessible."""
    print("\n" + "=" * 80)
    print("🔐 AEGIS MIGRATION FACTORY - CREDENTIALS VALIDATOR")
    print("=" * 80 + "\n")
    
    all_valid = True
    
    # Check required credentials
    print("📋 Required Environment Variables:")
    print("-" * 80)
    
    all_valid &= check_env_variable('AWS_ACCESS_KEY_ID', required=True)
    all_valid &= check_env_variable('AWS_SECRET_ACCESS_KEY', required=True)
    
    # Check optional configuration
    print("\n📋 Optional Configuration:")
    print("-" * 80)
    
    all_valid &= check_env_variable('AWS_DEFAULT_REGION', required=False)
    all_valid &= check_env_variable('BEDROCK_MODEL_ID', required=False)
    all_valid &= check_env_variable('MAX_RETRIES', required=False)
    all_valid &= check_env_variable('CACHE_ENABLED', required=False)
    
    print("\n")
    
    # Try importing boto3
    print("📦 Testing Python Dependencies:")
    print("-" * 80)
    
    try:
        import boto3
        print("✅ boto3: installed")
    except ImportError:
        print("❌ boto3: NOT installed (run 'pip install -r requirements.txt')")
        all_valid = False
    
    try:
        from dotenv import load_dotenv
        print("✅ python-dotenv: installed")
    except ImportError:
        print("❌ python-dotenv: NOT installed (run 'pip install -r requirements.txt')")
        all_valid = False
    
    try:
        from pydantic import BaseModel
        print("✅ pydantic: installed")
    except ImportError:
        print("❌ pydantic: NOT installed (run 'pip install -r requirements.txt')")
        all_valid = False
    
    try:
        from fastapi import FastAPI
        print("✅ fastapi: installed")
    except ImportError:
        print("❌ fastapi: NOT installed (run 'pip install -r requirements.txt')")
        all_valid = False
    
    try:
        from tenacity import retry
        print("✅ tenacity: installed")
    except ImportError:
        print("❌ tenacity: NOT installed (run 'pip install -r requirements.txt')")
        all_valid = False
    
    # Test AWS credentials if available
    if os.getenv('AWS_ACCESS_KEY_ID') and os.getenv('AWS_SECRET_ACCESS_KEY'):
        print("\n🌐 Testing AWS Credentials:")
        print("-" * 80)
        
        try:
            import boto3
            from botocore.exceptions import BotoCoreError, ClientError
            
            # Test STS to verify credentials work
            sts = boto3.client('sts', region_name=os.getenv('AWS_DEFAULT_REGION', 'us-east-1'))
            identity = sts.get_caller_identity()
            
            print(f"✅ AWS Credentials: valid")
            print(f"   Account: {identity['Account']}")
            print(f"   User/Role: {identity['Arn'].split('/')[-1]}")
            
            # Test Bedrock access
            try:
                bedrock = boto3.client('bedrock-runtime', region_name=os.getenv('AWS_DEFAULT_REGION', 'us-east-1'))
                print(f"✅ Bedrock Client: initialized")
                print(f"   Region: {os.getenv('AWS_DEFAULT_REGION', 'us-east-1')}")
                print(f"   Model: {os.getenv('BEDROCK_MODEL_ID', 'anthropic.claude-3-5-sonnet-20240620-v1:0')}")
            except Exception as e:
                print(f"⚠️  Bedrock Client: {str(e)[:100]}")
        
        except (BotoCoreError, ClientError) as e:
            print(f"❌ AWS Credentials: INVALID")
            print(f"   Error: {str(e)[:100]}")
            all_valid = False
        except Exception as e:
            print(f"⚠️  AWS Test: {str(e)[:100]}")
    
    else:
        print("\n⚠️  AWS Credentials: not configured")
        print("   Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to .env")
    
    # Summary
    print("\n" + "=" * 80)
    if all_valid:
        print("✅ All checks passed! Ready to launch Aegis Migration Factory")
    else:
        print("❌ Some checks failed. Please review the errors above.")
        print("\n📖 For setup instructions, see: AWS_SETUP.md")
    print("=" * 80 + "\n")
    
    return all_valid

if __name__ == "__main__":
    valid = validate_aws_credentials()
    sys.exit(0 if valid else 1)
