"""
╔════════════════════════════════════════════════════════════════════════════╗
║  FEATURE D — Agent Execution Runner                                      ║
║  General-purpose multi-turn agent with extended tool set                 ║
║  In-memory session store with TTL (Redis-compatible interface)           ║
╚════════════════════════════════════════════════════════════════════════════╝
"""

import json
import uuid
import time
import logging
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, Callable, Awaitable, Any
from datetime import datetime, timedelta

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from models.runner_output import RunnerOutput, ToolCallRecord, ConversationMessage, TokenUsage

logger = logging.getLogger(__name__)

# ════════════════════════════════════════════════════════════════════════════
# IN-MEMORY SESSION STORE (Redis-compatible interface)
# ════════════════════════════════════════════════════════════════════════════

_session_store: dict[str, dict] = {}
SESSION_TTL_HOURS = 24
MAX_HISTORY_PAIRS = 50


def _cleanup_expired_sessions() -> None:
    """Remove sessions older than TTL."""
    now = time.time()
    expired = [
        sid for sid, data in _session_store.items()
        if now - data.get("created_at", 0) > SESSION_TTL_HOURS * 3600
    ]
    for sid in expired:
        del _session_store[sid]


def get_session(session_id: str) -> Optional[dict]:
    """Get session data, returns None if expired or not found."""
    _cleanup_expired_sessions()
    return _session_store.get(session_id)


def save_session(session_id: str, data: dict) -> None:
    """Save session data with timestamp."""
    if "created_at" not in data:
        data["created_at"] = time.time()
    data["updated_at"] = time.time()

    # Trim history if too long
    messages = data.get("messages", [])
    if len(messages) > MAX_HISTORY_PAIRS * 2:
        # Keep system context + last N pairs
        data["messages"] = messages[:1] + messages[-(MAX_HISTORY_PAIRS * 2):]

    _session_store[session_id] = data


def delete_session(session_id: str) -> bool:
    """Delete a session. Returns True if existed."""
    return _session_store.pop(session_id, None) is not None


def list_sessions() -> list[str]:
    """List active session IDs."""
    _cleanup_expired_sessions()
    return list(_session_store.keys())


# ════════════════════════════════════════════════════════════════════════════
# GCP ↔ AWS MAPPING TABLE
# ════════════════════════════════════════════════════════════════════════════

GCP_AWS_MAP: dict[str, dict] = {
    "compute_instance":       {"aws": "aws_instance", "service": "EC2", "notes": "Direct VM mapping"},
    "cloud_sql":             {"aws": "aws_db_instance", "service": "RDS", "notes": "Managed database"},
    "cloud_storage":         {"aws": "aws_s3_bucket", "service": "S3", "notes": "Object storage"},
    "cloud_function":        {"aws": "aws_lambda_function", "service": "Lambda", "notes": "Serverless function"},
    "cloud_run":             {"aws": "aws_ecs_service", "service": "ECS Fargate", "notes": "Containerized service"},
    "gke_cluster":           {"aws": "aws_eks_cluster", "service": "EKS", "notes": "Kubernetes cluster"},
    "cloud_pub_sub":         {"aws": "aws_sns_topic + aws_sqs_queue", "service": "SNS/SQS", "notes": "Pub/Sub messaging"},
    "cloud_memorystore":     {"aws": "aws_elasticache_cluster", "service": "ElastiCache", "notes": "In-memory cache"},
    "cloud_cdn":             {"aws": "aws_cloudfront_distribution", "service": "CloudFront", "notes": "CDN"},
    "cloud_dns":             {"aws": "aws_route53_zone", "service": "Route 53", "notes": "DNS management"},
    "cloud_armor":           {"aws": "aws_waf_web_acl", "service": "WAF", "notes": "Web application firewall"},
    "cloud_kms":             {"aws": "aws_kms_key", "service": "KMS", "notes": "Key management"},
    "cloud_iam":             {"aws": "aws_iam_role", "service": "IAM", "notes": "Identity management"},
    "vpc_network":           {"aws": "aws_vpc", "service": "VPC", "notes": "Virtual private cloud"},
    "cloud_nat":             {"aws": "aws_nat_gateway", "service": "NAT Gateway", "notes": "NAT gateway"},
    "cloud_load_balancing":  {"aws": "aws_lb", "service": "ALB/NLB", "notes": "Load balancer"},
    "cloud_spanner":         {"aws": "aws_rds_cluster (Aurora)", "service": "Aurora", "notes": "Globally distributed DB"},
    "bigquery":              {"aws": "aws_athena + aws_redshift", "service": "Athena/Redshift", "notes": "Data warehouse"},
    "dataflow":              {"aws": "aws_kinesis_stream", "service": "Kinesis", "notes": "Stream processing"},
    "cloud_logging":         {"aws": "aws_cloudwatch_log_group", "service": "CloudWatch Logs", "notes": "Logging"},
    "cloud_monitoring":      {"aws": "aws_cloudwatch_metric_alarm", "service": "CloudWatch", "notes": "Monitoring"},
}

# ════════════════════════════════════════════════════════════════════════════
# EXTENDED TOOL DEFINITIONS
# ════════════════════════════════════════════════════════════════════════════

RUNNER_TOOLS = [
    {
        "name": "read_file",
        "description": "Read a file from the session workspace",
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string", "description": "Relative path to file"}
            },
            "required": ["file_path"]
        }
    },
    {
        "name": "write_file",
        "description": "Write content to a file in the session workspace output",
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string", "description": "Relative output path"},
                "content": {"type": "string", "description": "File content"}
            },
            "required": ["file_path", "content"]
        }
    },
    {
        "name": "search_files",
        "description": "Search for a text pattern across workspace files",
        "input_schema": {
            "type": "object",
            "properties": {
                "pattern": {"type": "string"},
                "file_extension": {"type": "string"}
            },
            "required": ["pattern"]
        }
    },
    {
        "name": "fetch_aws_docs",
        "description": "Fetch AWS documentation summary for a specific service or topic. Returns a concise reference.",
        "input_schema": {
            "type": "object",
            "properties": {
                "service": {"type": "string", "description": "AWS service name (e.g., ec2, rds, iam, lambda)"},
                "topic": {"type": "string", "description": "Specific topic (e.g., pricing, limits, api, best-practices)"}
            },
            "required": ["service"]
        }
    },
    {
        "name": "validate_terraform",
        "description": "Validate Terraform HCL syntax. Returns any errors found.",
        "input_schema": {
            "type": "object",
            "properties": {
                "hcl_content": {"type": "string", "description": "Terraform HCL code to validate"}
            },
            "required": ["hcl_content"]
        }
    },
    {
        "name": "estimate_cost",
        "description": "Get a quick cost estimate for a specific AWS resource type and configuration.",
        "input_schema": {
            "type": "object",
            "properties": {
                "resource_type": {"type": "string", "description": "AWS resource type (e.g., aws_instance, aws_db_instance)"},
                "config": {"type": "object", "description": "Configuration details (instance_type, storage_gb, etc.)"}
            },
            "required": ["resource_type", "config"]
        }
    },
    {
        "name": "lookup_gcp_aws_mapping",
        "description": "Look up the AWS equivalent of a GCP resource type. Returns AWS service, resource type, and migration notes.",
        "input_schema": {
            "type": "object",
            "properties": {
                "gcp_resource_type": {"type": "string", "description": "GCP resource type (e.g., compute_instance, cloud_sql)"}
            },
            "required": ["gcp_resource_type"]
        }
    },
    {
        "name": "generate_iam_policy",
        "description": "Generate a minimal least-privilege IAM policy for a given AWS resource and use case.",
        "input_schema": {
            "type": "object",
            "properties": {
                "resource_type": {"type": "string", "description": "AWS resource type"},
                "actions_needed": {"type": "array", "items": {"type": "string"}, "description": "List of required actions"},
                "resource_arn": {"type": "string", "description": "Resource ARN (or * for all)"}
            },
            "required": ["resource_type"]
        }
    },
    {
        "name": "check_compliance",
        "description": "Check if a Terraform resource block meets a compliance standard (SOC2, HIPAA, CIS, PCI).",
        "input_schema": {
            "type": "object",
            "properties": {
                "resource_block": {"type": "string", "description": "Terraform resource block code"},
                "standard": {"type": "string", "description": "Compliance standard: SOC2 | HIPAA | CIS | PCI"}
            },
            "required": ["resource_block"]
        }
    },
    {
        "name": "web_search",
        "description": "Search for current AWS pricing, announcements, or best practices. Returns a summary.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"}
            },
            "required": ["query"]
        }
    },
]


# ════════════════════════════════════════════════════════════════════════════
# TOOL EXECUTION
# ════════════════════════════════════════════════════════════════════════════

# Import the cost estimator pricing map for quick estimates
from agents.cost_estimator_agent import RESOURCE_PRICING_MAP


async def execute_runner_tool(tool_name: str, tool_input: dict, workspace: Path) -> str:
    """Execute a runner tool and return the result string."""

    if tool_name == "read_file":
        file_path = tool_input.get("file_path", "")
        path = workspace / file_path
        try:
            resolved = path.resolve()
            if not str(resolved).startswith(str(workspace.resolve())):
                return "ERROR: Path outside workspace"
            if not path.exists():
                return f"ERROR: File not found: {file_path}"
            content = path.read_text(errors="replace")
            return content[:50000] if len(content) > 50000 else content
        except Exception as e:
            return f"ERROR: {str(e)}"

    elif tool_name == "write_file":
        file_path = tool_input.get("file_path", "")
        content = tool_input.get("content", "")
        out_path = workspace / "output" / file_path
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(content)
        return f"Written: output/{file_path} ({len(content)} chars)"

    elif tool_name == "search_files":
        pattern = tool_input.get("pattern", "")
        file_ext = tool_input.get("file_extension", None)
        results = []
        glob_pat = f"*{file_ext}" if file_ext else "*"
        for fp in workspace.rglob(glob_pat):
            if not fp.is_file():
                continue
            try:
                text = fp.read_text(errors="replace")
                for ln, line in enumerate(text.splitlines(), 1):
                    if pattern.lower() in line.lower():
                        rel = fp.relative_to(workspace)
                        results.append(f"{rel}:{ln}: {line.strip()}")
                        if len(results) >= 50:
                            break
            except Exception:
                continue
            if len(results) >= 50:
                break
        return "\n".join(results) if results else f"No matches for: {pattern}"

    elif tool_name == "fetch_aws_docs":
        service = tool_input.get("service", "").lower()
        topic = tool_input.get("topic", "overview").lower()
        # Return structured reference (no live HTTP needed)
        docs = {
            "ec2": {"overview": "Amazon EC2 provides scalable compute capacity. Instance families: General Purpose (t3, m5), Compute Optimized (c5), Memory Optimized (r5). Pricing: On-Demand, Reserved (1yr/3yr), Spot (up to 90% off). Key features: Auto Scaling, Placement Groups, Elastic IPs.",
                    "pricing": "On-Demand: pay per second. Reserved: up to 72% savings (1yr/3yr). Spot: up to 90% savings. Savings Plans: flexible commitment-based pricing. Data transfer: $0.09/GB outbound.",
                    "limits": "Default: 20 On-Demand instances per region. Max 5 Elastic IPs. 5000 security groups per VPC. 60 rules per security group."},
            "rds": {"overview": "Amazon RDS manages relational databases: MySQL, PostgreSQL, MariaDB, Oracle, SQL Server, Aurora. Features: Multi-AZ, Read Replicas, automated backups, encryption.",
                    "pricing": "Instance hours + storage (gp3: $0.08/GB). Multi-AZ: 2x instance cost. Aurora: Serverless v2 from $0.12/ACU-hour. Reserved: up to 69% savings.",
                    "limits": "40 DB instances per account. Max 16TB storage (Aurora 128TB). 5 Read Replicas per instance. 30-day backup retention max."},
            "lambda": {"overview": "AWS Lambda runs code without provisioning servers. Supports Python, Node.js, Java, Go, .NET. Max 15min timeout, 10GB memory, 10GB /tmp storage.",
                       "pricing": "$0.20 per 1M requests + $0.0000166667 per GB-second. Free tier: 1M requests, 400,000 GB-seconds/month.",
                       "limits": "1000 concurrent executions (default). 75GB deployment package. 10GB memory. 15min timeout."},
            "s3": {"overview": "Amazon S3 provides object storage with 99.999999999% durability. Storage classes: Standard, IA, Glacier, Deep Archive.",
                   "pricing": "Standard: $0.023/GB. IA: $0.0125/GB. Glacier: $0.004/GB. Requests: $0.005 per 1000 PUT, $0.0004 per 1000 GET.",
                   "limits": "Unlimited objects. Max object size: 5TB. 100 buckets per account (adjustable). 3500 PUT/s, 5500 GET/s per prefix."},
            "iam": {"overview": "AWS IAM manages access to AWS services. Features: Users, Groups, Roles, Policies. Supports MFA, federation, service-linked roles.",
                    "best-practices": "Use least privilege. Enable MFA on root. Use roles instead of long-term keys. Require MFA for sensitive operations. Rotate credentials regularly.",
                    "limits": "5000 IAM users per account. 300 groups. 1000 roles. 10 managed policies per user. 6144 chars per policy."},
        }
        service_docs = docs.get(service, {"overview": f"AWS {service.upper()} documentation. Use the AWS documentation website for detailed reference: https://docs.aws.amazon.com/{service}/"})
        return service_docs.get(topic, service_docs.get("overview", f"No documentation found for {service}/{topic}"))

    elif tool_name == "validate_terraform":
        hcl = tool_input.get("hcl_content", "")
        # Basic syntax checking without terraform binary
        issues = []
        # Check for balanced braces
        open_braces = hcl.count("{")
        close_braces = hcl.count("}")
        if open_braces != close_braces:
            issues.append(f"Unbalanced braces: {open_braces} open, {close_braces} close")
        # Check for resource blocks
        resources = re.findall(r'resource\s+"([^"]+)"\s+"([^"]+)"', hcl)
        if not resources:
            issues.append("No resource blocks found")
        # Check for required fields
        if "aws_instance" in hcl and "ami" not in hcl:
            issues.append("aws_instance missing 'ami' field")
        if "aws_instance" in hcl and "instance_type" not in hcl:
            issues.append("aws_instance missing 'instance_type' field")
        if not issues:
            return f"Validation passed. Found {len(resources)} resource blocks: {', '.join(f'{t}.{n}' for t, n in resources)}"
        return "Validation issues:\n" + "\n".join(f"- {i}" for i in issues)

    elif tool_name == "estimate_cost":
        resource_type = tool_input.get("resource_type", "")
        config = tool_input.get("config", {})
        instance_type = config.get("instance_type", "")

        monthly = 0.0
        source = "STATIC_MAP"

        if instance_type and instance_type in RESOURCE_PRICING_MAP:
            info = RESOURCE_PRICING_MAP[instance_type]
            if "hourly" in info:
                monthly = info["hourly"] * 730
            elif "monthly" in info:
                monthly = info["monthly"]
        elif resource_type in RESOURCE_PRICING_MAP:
            info = RESOURCE_PRICING_MAP[resource_type]
            monthly = info.get("monthly", 0)
            if "per_gb" in info:
                gb = config.get("storage_gb", 100)
                monthly = info["per_gb"] * gb
        else:
            monthly = 5.0
            source = "ESTIMATE"

        return json.dumps({
            "resource_type": resource_type,
            "instance_type": instance_type or "N/A",
            "monthly_usd": round(monthly, 2),
            "annual_usd": round(monthly * 12, 2),
            "source": source,
        })

    elif tool_name == "lookup_gcp_aws_mapping":
        gcp_type = tool_input.get("gcp_resource_type", "").lower().replace("-", "_").replace("google_", "").replace("cloud_", "cloud_")
        # Try exact match first
        mapping = GCP_AWS_MAP.get(gcp_type)
        if not mapping:
            # Try partial match
            for key, val in GCP_AWS_MAP.items():
                if key in gcp_type or gcp_type in key:
                    mapping = val
                    break
        if mapping:
            return json.dumps(mapping, indent=2)
        return f"No direct mapping found for GCP resource: {gcp_type}. Consider manual migration planning."

    elif tool_name == "generate_iam_policy":
        resource_type = tool_input.get("resource_type", "")
        actions = tool_input.get("actions_needed", [])
        resource_arn = tool_input.get("resource_arn", "*")

        # Generate service prefix
        service_prefix = resource_type.replace("aws_", "").split("_")[0]
        service_map = {
            "instance": "ec2", "db": "rds", "s3": "s3", "lambda": "lambda",
            "ecs": "ecs", "eks": "eks", "dynamodb": "dynamodb", "sqs": "sqs",
            "sns": "sns", "kms": "kms", "cloudwatch": "logs",
        }
        svc = service_map.get(service_prefix, service_prefix)

        if not actions:
            action_map = {
                "ec2": ["ec2:DescribeInstances", "ec2:StartInstances", "ec2:StopInstances"],
                "rds": ["rds:DescribeDBInstances", "rds-db:connect"],
                "s3": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
                "lambda": ["lambda:InvokeFunction", "lambda:GetFunction"],
                "ecs": ["ecs:DescribeServices", "ecs:UpdateService"],
                "dynamodb": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query"],
            }
            actions = action_map.get(svc, [f"{svc}:Describe*"])

        policy = {
            "Version": "2012-10-17",
            "Statement": [{
                "Sid": f"{svc.title()}LeastPrivilege",
                "Effect": "Allow",
                "Action": actions,
                "Resource": resource_arn,
                "Condition": {
                    "StringEquals": {
                        "aws:RequestedRegion": "us-east-1"
                    }
                }
            }]
        }
        return json.dumps(policy, indent=2)

    elif tool_name == "check_compliance":
        resource_block = tool_input.get("resource_block", "")
        standard = tool_input.get("standard", "SOC2").upper()

        checks = {
            "SOC2": [
                ("encryption", "storage_encrypted|kms_key|encrypt", "Data encryption required"),
                ("logging", "logging|cloudtrail|access_log", "Audit logging required"),
                ("access_control", "security_group|iam|policy", "Access controls required"),
                ("backup", "backup|snapshot|retention", "Backup policy required"),
            ],
            "HIPAA": [
                ("encryption_at_rest", "storage_encrypted|kms_key", "PHI encryption at rest"),
                ("encryption_in_transit", "ssl|tls|https", "PHI encryption in transit"),
                ("audit_logging", "cloudtrail|access_log", "Audit trail for PHI access"),
                ("access_control", "iam|mfa|role", "Role-based access for PHI"),
            ],
            "CIS": [
                ("no_public_access", "publicly_accessible.*false|public.*false", "No public access"),
                ("encryption", "encrypted|kms", "Encryption enabled"),
                ("logging", "logging|monitor", "Monitoring enabled"),
                ("mfa", "mfa|multi_factor", "MFA enabled"),
            ],
            "PCI": [
                ("firewall", "security_group|waf|firewall", "Firewall configuration"),
                ("encryption", "encrypt|kms|ssl", "Strong encryption"),
                ("access_control", "iam|role|policy", "Access restrictions"),
                ("logging", "cloudtrail|log|audit", "Comprehensive logging"),
            ],
        }

        standard_checks = checks.get(standard, checks["SOC2"])
        results = []
        for check_name, pattern, description in standard_checks:
            if re.search(pattern, resource_block, re.IGNORECASE):
                results.append(f"✅ {check_name}: PASS — {description}")
            else:
                results.append(f"❌ {check_name}: FAIL — {description} (not found in resource block)")

        passed = sum(1 for r in results if "PASS" in r)
        total = len(results)
        return f"{standard} Compliance Check: {passed}/{total} passed\n\n" + "\n".join(results)

    elif tool_name == "web_search":
        query = tool_input.get("query", "")
        # Provide helpful static responses for common queries
        return f"[Search results for: {query}]\nNote: Live web search is not available in this environment. Use the fetch_aws_docs tool for AWS-specific information, or consult https://aws.amazon.com/pricing/ for current pricing."

    return f"ERROR: Unknown tool: {tool_name}"


# ════════════════════════════════════════════════════════════════════════════
# AGENT RUNNER
# ════════════════════════════════════════════════════════════════════════════

class AgentRunner:
    """
    General-purpose multi-turn agent runner with extended tool set.
    Maintains persistent conversation history per session.
    """

    MAX_ITERATIONS = 30

    SYSTEM_PROMPT = """You are Aegis Agent Runner, an expert cloud migration and infrastructure assistant.
You have access to a comprehensive set of tools for analyzing, validating, estimating costs,
checking compliance, and generating IAM policies for AWS infrastructure.

You can:
- Read and search files in the workspace
- Fetch AWS documentation for any service
- Validate Terraform syntax
- Estimate costs for AWS resources
- Look up GCP-to-AWS resource mappings
- Generate least-privilege IAM policies
- Check compliance against SOC2, HIPAA, CIS, PCI standards
- Write output files with your analysis

Be thorough, precise, and actionable. When the user asks a question,
use your tools to provide data-backed answers. Always explain your reasoning."""

    def __init__(self) -> None:
        self._bedrock_client = None

    def _get_bedrock_client(self):
        if self._bedrock_client is None:
            self._bedrock_client = boto3.client(
                'bedrock-runtime',
                region_name=os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
            )
        return self._bedrock_client

    async def run_task(
        self,
        session_id: str,
        task: str,
        file_context: Optional[str] = None,
        on_update: Optional[Callable[[dict], Awaitable[None]]] = None,
    ) -> RunnerOutput:
        """
        Run an agentic task. Loads existing history, appends new message,
        runs agentic loop, saves updated history.
        """
        # Load or create session
        session = get_session(session_id)
        if session is None:
            session = {
                "messages": [],
                "tool_calls": [],
                "artifacts": [],
                "token_usage": {"input": 0, "output": 0},
            }
            # Create workspace
            workspace = Path(tempfile.gettempdir()) / "aegis_runner" / session_id
            workspace.mkdir(parents=True, exist_ok=True)
            (workspace / "output").mkdir(exist_ok=True)
            session["workspace"] = str(workspace)

        workspace = Path(session.get("workspace", tempfile.gettempdir()))
        if not workspace.exists():
            workspace.mkdir(parents=True, exist_ok=True)

        # Build user message
        user_content = task
        if file_context:
            user_content = f"{task}\n\n---\nFile Context:\n```\n{file_context[:10000]}\n```"

        session["messages"].append({
            "role": "user",
            "content": user_content,
            "timestamp": datetime.utcnow().isoformat(),
        })

        # Build Bedrock messages from session history
        bedrock_messages = []
        for msg in session["messages"]:
            if msg["role"] in ("user", "assistant"):
                bedrock_messages.append({
                    "role": msg["role"],
                    "content": [{"text": msg.get("content", "")}] if isinstance(msg.get("content"), str) else msg["content"],
                })

        # Convert tools for Bedrock Converse API
        bedrock_tools = []
        for tool in RUNNER_TOOLS:
            bedrock_tools.append({
                "toolSpec": {
                    "name": tool["name"],
                    "description": tool["description"],
                    "inputSchema": {
                        "json": tool["input_schema"]
                    }
                }
            })

        try:
            client = self._get_bedrock_client()
        except Exception as e:
            return RunnerOutput(
                session_id=session_id,
                status="FAILED",
                error_message=f"Bedrock client error: {str(e)}",
            )

        all_tool_calls: list[ToolCallRecord] = list(session.get("tool_calls_records", []))
        iteration = 0
        final_response = ""
        total_input_tokens = session["token_usage"].get("input", 0)
        total_output_tokens = session["token_usage"].get("output", 0)

        while iteration < self.MAX_ITERATIONS:
            iteration += 1
            ts = datetime.utcnow().isoformat()

            if on_update:
                await on_update({
                    "type": "iteration_start",
                    "iteration": iteration,
                    "session_id": session_id,
                })

            try:
                response = client.converse(
                    modelId=os.getenv('BEDROCK_MODEL_ID', 'anthropic.claude-3-5-sonnet-20241022-v2:0'),
                    system=[{"text": self.SYSTEM_PROMPT}],
                    messages=bedrock_messages,
                    toolConfig={"tools": bedrock_tools},
                )
            except Exception as e:
                logger.error(f"Runner Bedrock call failed: {e}")
                final_response = f"Error communicating with AI model: {str(e)}"
                break

            # Track token usage
            usage = response.get("usage", {})
            total_input_tokens += usage.get("inputTokens", 0)
            total_output_tokens += usage.get("outputTokens", 0)

            stop_reason = response.get("stopReason", "end_turn")
            output_message = response.get("output", {}).get("message", {})
            content_blocks = output_message.get("content", [])

            bedrock_messages.append({"role": "assistant", "content": content_blocks})

            tool_results = []
            has_tool_use = False

            for block in content_blocks:
                if "text" in block:
                    final_response = block["text"]
                    if on_update:
                        await on_update({
                            "type": "text",
                            "content": block["text"],
                            "iteration": iteration,
                        })

                elif "toolUse" in block:
                    has_tool_use = True
                    tool_use = block["toolUse"]
                    tool_name = tool_use["name"]
                    tool_input_data = tool_use.get("input", {})
                    tool_use_id = tool_use["toolUseId"]

                    start_time = time.time()

                    if on_update:
                        await on_update({
                            "type": "tool_call",
                            "tool": tool_name,
                            "input": {k: str(v)[:200] for k, v in tool_input_data.items()},
                            "iteration": iteration,
                        })

                    try:
                        result = await execute_runner_tool(tool_name, tool_input_data, workspace)
                    except Exception as ex:
                        result = f"ERROR: {str(ex)}"

                    duration_ms = int((time.time() - start_time) * 1000)

                    tool_record = ToolCallRecord(
                        iteration=iteration,
                        tool_name=tool_name,
                        tool_input={k: str(v)[:200] for k, v in tool_input_data.items()},
                        tool_result=str(result)[:2000],
                        duration_ms=duration_ms,
                        status="success" if not result.startswith("ERROR") else "error",
                        timestamp=ts,
                    )
                    all_tool_calls.append(tool_record)

                    if on_update:
                        await on_update({
                            "type": "tool_result",
                            "tool": tool_name,
                            "result": str(result)[:500],
                            "duration_ms": duration_ms,
                            "iteration": iteration,
                        })

                    tool_results.append({
                        "toolResult": {
                            "toolUseId": tool_use_id,
                            "content": [{"text": str(result)[:10000]}]
                        }
                    })

            if tool_results:
                bedrock_messages.append({"role": "user", "content": tool_results})
            elif stop_reason == "end_turn":
                break

        # Save assistant response to session
        session["messages"].append({
            "role": "assistant",
            "content": final_response,
            "timestamp": datetime.utcnow().isoformat(),
        })

        # Update session
        session["token_usage"] = {"input": total_input_tokens, "output": total_output_tokens}
        session["tool_calls_records"] = [tc.model_dump() if hasattr(tc, 'model_dump') else tc for tc in all_tool_calls[-100:]]
        save_session(session_id, session)

        # Estimate cost ($3/M input, $15/M output for Claude 3.5 Sonnet)
        estimated_cost = (total_input_tokens * 3.0 / 1_000_000) + (total_output_tokens * 15.0 / 1_000_000)

        # Build conversation history
        conv_history = []
        for msg in session["messages"]:
            conv_history.append(ConversationMessage(
                role=msg["role"],
                content=msg.get("content", "") if isinstance(msg.get("content"), str) else str(msg.get("content", "")),
                timestamp=msg.get("timestamp", ""),
            ))

        # Check for artifacts
        artifacts = []
        output_dir = workspace / "output"
        if output_dir.exists():
            for f in output_dir.rglob("*"):
                if f.is_file():
                    artifacts.append(str(f.relative_to(output_dir)))

        status = "COMPLETE"
        if iteration >= self.MAX_ITERATIONS:
            status = "MAX_ITER_REACHED"

        return RunnerOutput(
            session_id=session_id,
            status=status,
            final_response=final_response,
            conversation_history=conv_history,
            tool_calls=[tc if isinstance(tc, ToolCallRecord) else ToolCallRecord(**tc) for tc in all_tool_calls[-50:]],
            artifacts_generated=artifacts,
            token_usage=TokenUsage(
                input_tokens=total_input_tokens,
                output_tokens=total_output_tokens,
                total_tokens=total_input_tokens + total_output_tokens,
                estimated_cost_usd=round(estimated_cost, 4),
            ),
            total_iterations=iteration,
        )
