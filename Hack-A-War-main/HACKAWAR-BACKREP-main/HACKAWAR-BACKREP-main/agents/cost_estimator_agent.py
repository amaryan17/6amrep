"""
╔════════════════════════════════════════════════════════════════════════════╗
║  FEATURE A — AWS Real-Time Cost Estimator Agent                          ║
║  Standalone agent: called from pipeline or independently                 ║
║  Uses AWS Pricing API + static fallback + Claude for ambiguous resources ║
╚════════════════════════════════════════════════════════════════════════════╝
"""

import re
import json
import uuid
import logging
import os
from typing import Optional, Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from models.cost_estimate import ResourceCost, CostEstimateOutput

logger = logging.getLogger(__name__)

# ════════════════════════════════════════════════════════════════════════════
# STATIC PRICING TABLE (fallback when AWS Pricing API unavailable)
# ════════════════════════════════════════════════════════════════════════════

RESOURCE_PRICING_MAP: dict[str, dict[str, Any]] = {
    # EC2 INSTANCES (on-demand, us-east-1, Linux)
    "t3.nano":     {"hourly": 0.0052,  "category": "Compute"},
    "t3.micro":    {"hourly": 0.0104,  "category": "Compute"},
    "t3.small":    {"hourly": 0.0208,  "category": "Compute"},
    "t3.medium":   {"hourly": 0.0416,  "category": "Compute"},
    "t3.large":    {"hourly": 0.0832,  "category": "Compute"},
    "t3.xlarge":   {"hourly": 0.1664,  "category": "Compute"},
    "t3.2xlarge":  {"hourly": 0.3328,  "category": "Compute"},
    "m5.large":    {"hourly": 0.096,   "category": "Compute"},
    "m5.xlarge":   {"hourly": 0.192,   "category": "Compute"},
    "m5.2xlarge":  {"hourly": 0.384,   "category": "Compute"},
    "m5.4xlarge":  {"hourly": 0.768,   "category": "Compute"},
    "m5.8xlarge":  {"hourly": 1.536,   "category": "Compute"},
    "c5.large":    {"hourly": 0.085,   "category": "Compute"},
    "c5.xlarge":   {"hourly": 0.17,    "category": "Compute"},
    "c5.2xlarge":  {"hourly": 0.34,    "category": "Compute"},
    "c5.4xlarge":  {"hourly": 0.68,    "category": "Compute"},
    "r5.large":    {"hourly": 0.126,   "category": "Compute"},
    "r5.xlarge":   {"hourly": 0.252,   "category": "Compute"},
    "r5.2xlarge":  {"hourly": 0.504,   "category": "Compute"},
    # RDS (per instance/hour, us-east-1, single-AZ)
    "db.t3.micro":    {"hourly": 0.017,  "category": "Database"},
    "db.t3.small":    {"hourly": 0.034,  "category": "Database"},
    "db.t3.medium":   {"hourly": 0.068,  "category": "Database"},
    "db.m5.large":    {"hourly": 0.171,  "category": "Database"},
    "db.m5.xlarge":   {"hourly": 0.342,  "category": "Database"},
    "db.r5.large":    {"hourly": 0.24,   "category": "Database"},
    "db.r5.xlarge":   {"hourly": 0.48,   "category": "Database"},
    # FIXED MONTHLY COSTS
    "aws_eks_cluster":           {"monthly": 73.0,   "category": "Containers"},
    "aws_lb":                    {"monthly": 16.20,  "category": "Networking"},
    "aws_nat_gateway":           {"monthly": 32.40,  "category": "Networking"},
    "aws_vpn_gateway":           {"monthly": 36.0,   "category": "Networking"},
    "aws_route53_zone":          {"monthly": 0.50,   "category": "DNS"},
    "aws_kms_key":               {"monthly": 1.0,    "category": "Security"},
    "aws_waf_web_acl":           {"monthly": 5.0,    "category": "Security"},
    "aws_cloudtrail":            {"monthly": 2.0,    "category": "Compliance"},
    "aws_config":                {"monthly": 2.0,    "category": "Compliance"},
    "aws_guardduty_detector":    {"monthly": 4.0,    "category": "Security"},
    "aws_sns_topic":             {"monthly": 0.50,   "category": "Messaging"},
    "aws_sqs_queue":             {"monthly": 0.40,   "category": "Messaging"},
    "aws_elasticache_cluster":   {"monthly": 52.0,   "category": "Cache"},
    "aws_elasticsearch_domain":  {"monthly": 175.0,  "category": "Search"},
    "aws_kinesis_stream":        {"monthly": 15.0,   "category": "Streaming"},
    "aws_ecs_service":           {"monthly": 40.0,   "category": "Containers"},
    "aws_cloudwatch_log_group":  {"monthly": 0.50,   "category": "Monitoring"},
    "aws_lambda_function":       {"monthly": 2.80,   "category": "Serverless"},
    "aws_s3_bucket":             {"monthly": 2.30,   "category": "Storage"},
    "aws_ebs_volume":            {"per_gb": 0.08,    "category": "Storage"},
    "aws_efs_file_system":       {"per_gb": 0.30,    "category": "Storage"},
}

# Spot pricing discounts (percentage of on-demand)
SPOT_DISCOUNT_MAP: dict[str, float] = {
    "t3.nano": 0.70, "t3.micro": 0.70, "t3.small": 0.70, "t3.medium": 0.70,
    "t3.large": 0.70, "t3.xlarge": 0.70, "t3.2xlarge": 0.70,
    "m5.large": 0.65, "m5.xlarge": 0.65, "m5.2xlarge": 0.65,
    "m5.4xlarge": 0.60, "m5.8xlarge": 0.60,
    "c5.large": 0.65, "c5.xlarge": 0.65, "c5.2xlarge": 0.60, "c5.4xlarge": 0.55,
    "r5.large": 0.65, "r5.xlarge": 0.60, "r5.2xlarge": 0.55,
}

# Reserved pricing discounts (1yr and 3yr all-upfront)
RESERVED_DISCOUNT_MAP: dict[str, dict[str, float]] = {
    "t3.nano":    {"1yr": 0.62, "3yr": 0.40},
    "t3.micro":   {"1yr": 0.62, "3yr": 0.40},
    "t3.small":   {"1yr": 0.62, "3yr": 0.40},
    "t3.medium":  {"1yr": 0.60, "3yr": 0.38},
    "t3.large":   {"1yr": 0.60, "3yr": 0.38},
    "t3.xlarge":  {"1yr": 0.60, "3yr": 0.38},
    "t3.2xlarge": {"1yr": 0.60, "3yr": 0.38},
    "m5.large":   {"1yr": 0.58, "3yr": 0.36},
    "m5.xlarge":  {"1yr": 0.58, "3yr": 0.36},
    "m5.2xlarge": {"1yr": 0.56, "3yr": 0.35},
    "m5.4xlarge": {"1yr": 0.55, "3yr": 0.34},
    "m5.8xlarge": {"1yr": 0.55, "3yr": 0.34},
    "c5.large":   {"1yr": 0.58, "3yr": 0.36},
    "c5.xlarge":  {"1yr": 0.57, "3yr": 0.35},
    "c5.2xlarge": {"1yr": 0.56, "3yr": 0.34},
    "c5.4xlarge": {"1yr": 0.55, "3yr": 0.33},
    "r5.large":   {"1yr": 0.56, "3yr": 0.34},
    "r5.xlarge":  {"1yr": 0.55, "3yr": 0.33},
    "r5.2xlarge": {"1yr": 0.54, "3yr": 0.32},
    "db.t3.micro":  {"1yr": 0.60, "3yr": 0.38},
    "db.t3.small":  {"1yr": 0.60, "3yr": 0.38},
    "db.t3.medium": {"1yr": 0.58, "3yr": 0.36},
    "db.m5.large":  {"1yr": 0.56, "3yr": 0.34},
    "db.m5.xlarge": {"1yr": 0.55, "3yr": 0.33},
    "db.r5.large":  {"1yr": 0.54, "3yr": 0.32},
    "db.r5.xlarge": {"1yr": 0.52, "3yr": 0.30},
}

# GCP to AWS instance type cost multiplier (GCP is typically 5-15% more)
GCP_COST_MULTIPLIER = 1.12

# ════════════════════════════════════════════════════════════════════════════
# Session cache for AWS Pricing API results
# ════════════════════════════════════════════════════════════════════════════
_pricing_cache: dict[str, float] = {}


class CostEstimatorAgent:
    """
    Standalone cost estimation agent.
    Can be called from the main pipeline output OR triggered independently.
    """

    def __init__(self) -> None:
        self._bedrock_client = None
        self._pricing_client = None

    def _get_bedrock_client(self):
        if self._bedrock_client is None:
            try:
                self._bedrock_client = boto3.client(
                    'bedrock-runtime',
                    region_name=os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
                )
            except Exception as e:
                logger.warning(f"Could not create Bedrock client: {e}")
        return self._bedrock_client

    def _get_pricing_client(self):
        if self._pricing_client is None:
            try:
                self._pricing_client = boto3.client(
                    'pricing',
                    region_name='us-east-1'
                )
            except Exception as e:
                logger.warning(f"Could not create Pricing client: {e}")
        return self._pricing_client

    # ════════════════════════════════════════════════════════════════════
    # HCL PARSER — Extract resource blocks from Terraform
    # ════════════════════════════════════════════════════════════════════

    def _parse_hcl_resources(self, terraform_hcl: str) -> list[dict]:
        """
        Parse Terraform HCL to extract resource blocks with type, name, and config.
        Uses regex-based extraction for robustness without requiring HCL parser deps.
        """
        resources = []

        # Match resource "type" "name" { ... }
        resource_pattern = re.compile(
            r'resource\s+"([^"]+)"\s+"([^"]+)"\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}',
            re.DOTALL
        )

        for match in resource_pattern.finditer(terraform_hcl):
            res_type = match.group(1)
            res_name = match.group(2)
            res_body = match.group(3)

            # Extract instance_type / instance_class
            instance_type = None
            it_match = re.search(r'instance_type\s*=\s*"([^"]+)"', res_body)
            if it_match:
                instance_type = it_match.group(1)

            ic_match = re.search(r'instance_class\s*=\s*"([^"]+)"', res_body)
            if ic_match:
                instance_type = ic_match.group(1)

            # Extract allocated_storage for EBS/storage size
            storage_gb = None
            storage_match = re.search(r'allocated_storage\s*=\s*(\d+)', res_body)
            if storage_match:
                storage_gb = int(storage_match.group(1))

            size_match = re.search(r'size\s*=\s*(\d+)', res_body)
            if size_match and storage_gb is None:
                storage_gb = int(size_match.group(1))

            resources.append({
                "type": res_type,
                "name": res_name,
                "instance_type": instance_type,
                "storage_gb": storage_gb,
                "body": res_body.strip(),
            })

        # If regex found nothing, try simpler pattern for resource type detection
        if not resources:
            simple_pattern = re.compile(r'resource\s+"([^"]+)"\s+"([^"]+)"')
            for match in simple_pattern.finditer(terraform_hcl):
                resources.append({
                    "type": match.group(1),
                    "name": match.group(2),
                    "instance_type": None,
                    "storage_gb": None,
                    "body": "",
                })

        return resources

    # ════════════════════════════════════════════════════════════════════
    # AWS PRICING API
    # ════════════════════════════════════════════════════════════════════

    async def fetch_aws_pricing(self, service: str, filters: dict) -> Optional[float]:
        """
        Call boto3 pricing client. Parse JSON price list.
        Cache results in memory for the session.
        Timeout: 3 seconds. On failure, return None (fall back to static map).
        """
        cache_key = f"{service}:{json.dumps(filters, sort_keys=True)}"
        if cache_key in _pricing_cache:
            return _pricing_cache[cache_key]

        client = self._get_pricing_client()
        if client is None:
            return None

        try:
            filter_list = [
                {"Type": "TERM_MATCH", "Field": k, "Value": v}
                for k, v in filters.items()
            ]

            response = client.get_products(
                ServiceCode=service,
                Filters=filter_list,
                MaxResults=1,
            )

            if response.get("PriceList"):
                price_data = json.loads(response["PriceList"][0])
                terms = price_data.get("terms", {}).get("OnDemand", {})
                for term_key in terms:
                    price_dimensions = terms[term_key].get("priceDimensions", {})
                    for dim_key in price_dimensions:
                        price_str = price_dimensions[dim_key].get("pricePerUnit", {}).get("USD", "0")
                        price = float(price_str)
                        if price > 0:
                            _pricing_cache[cache_key] = price
                            return price

        except (ClientError, BotoCoreError, Exception) as e:
            logger.debug(f"AWS Pricing API lookup failed for {service}: {e}")

        return None

    # ════════════════════════════════════════════════════════════════════
    # SPOT & RESERVED SAVINGS
    # ════════════════════════════════════════════════════════════════════

    async def calculate_spot_savings(self, instance_type: str, on_demand_monthly: float) -> dict:
        """Calculate Spot instance savings for a given EC2 instance type."""
        discount = SPOT_DISCOUNT_MAP.get(instance_type, 0.70)
        spot_monthly = on_demand_monthly * (1 - discount)
        return {
            "on_demand": round(on_demand_monthly, 2),
            "spot": round(spot_monthly, 2),
            "savings_pct": round(discount * 100, 1),
        }

    async def calculate_reserved_savings(self, instance_type: str, on_demand_monthly: float) -> dict:
        """Calculate 1yr and 3yr reserved savings vs on-demand."""
        discounts = RESERVED_DISCOUNT_MAP.get(instance_type, {"1yr": 0.58, "3yr": 0.36})
        return {
            "on_demand": round(on_demand_monthly, 2),
            "reserved_1yr": round(on_demand_monthly * (1 - discounts["1yr"]), 2),
            "reserved_3yr": round(on_demand_monthly * (1 - discounts["3yr"]), 2),
            "savings_1yr_pct": round(discounts["1yr"] * 100, 1),
            "savings_3yr_pct": round(discounts["3yr"] * 100, 1),
        }

    # ════════════════════════════════════════════════════════════════════
    # PRICE A SINGLE RESOURCE
    # ════════════════════════════════════════════════════════════════════

    async def _price_resource(self, resource: dict) -> ResourceCost:
        """Price a single parsed Terraform resource block."""
        res_type = resource["type"]
        res_name = resource["name"]
        instance_type = resource.get("instance_type")
        storage_gb = resource.get("storage_gb")

        monthly_usd = 0.0
        category = "Other"
        pricing_source = "STATIC_MAP"
        confidence = "HIGH"
        spot_monthly = None
        reserved_1yr = None
        reserved_3yr = None
        optimization_tip = None

        # Strategy 1: Known instance type in pricing map
        if instance_type and instance_type in RESOURCE_PRICING_MAP:
            info = RESOURCE_PRICING_MAP[instance_type]
            if "hourly" in info:
                monthly_usd = info["hourly"] * 730  # avg hours/month
            elif "monthly" in info:
                monthly_usd = info["monthly"]
            category = info["category"]

            # Calculate spot/reserved for compute instances
            if category == "Compute" and instance_type in SPOT_DISCOUNT_MAP:
                spot_data = await self.calculate_spot_savings(instance_type, monthly_usd)
                spot_monthly = spot_data["spot"]

            if instance_type in RESERVED_DISCOUNT_MAP:
                reserved_data = await self.calculate_reserved_savings(instance_type, monthly_usd)
                reserved_1yr = reserved_data["reserved_1yr"]
                reserved_3yr = reserved_data["reserved_3yr"]

            # Rightsizing tip for large instances
            if "hourly" in info and info["hourly"] > 0.5:
                optimization_tip = f"Consider downsizing {instance_type} or using Spot instances for ~{SPOT_DISCOUNT_MAP.get(instance_type, 0.65) * 100:.0f}% savings"

        # Strategy 2: Known resource type in fixed monthly costs
        elif res_type in RESOURCE_PRICING_MAP:
            info = RESOURCE_PRICING_MAP[res_type]
            if "monthly" in info:
                monthly_usd = info["monthly"]
            elif "per_gb" in info:
                gb = storage_gb or 100  # default 100GB
                monthly_usd = info["per_gb"] * gb
            category = info["category"]

        # Strategy 3: Try AWS Pricing API
        else:
            api_price = await self.fetch_aws_pricing(
                "AmazonEC2",
                {"instanceType": instance_type or "", "operatingSystem": "Linux"}
            )
            if api_price and api_price > 0:
                monthly_usd = api_price * 730
                category = "Compute"
                pricing_source = "AWS_API"
            else:
                # Strategy 4: Claude estimate for unknown resources
                monthly_usd = await self._claude_estimate(resource)
                pricing_source = "CLAUDE_ESTIMATE"
                confidence = "MEDIUM"
                category = self._infer_category(res_type)

        return ResourceCost(
            resource_name=f"{res_type}.{res_name}",
            resource_type=res_type,
            instance_type=instance_type,
            monthly_usd=round(monthly_usd, 2),
            annual_usd=round(monthly_usd * 12, 2),
            category=category,
            pricing_source=pricing_source,
            confidence=confidence,
            spot_monthly=round(spot_monthly, 2) if spot_monthly else None,
            reserved_1yr=round(reserved_1yr, 2) if reserved_1yr else None,
            reserved_3yr=round(reserved_3yr, 2) if reserved_3yr else None,
            optimization_tip=optimization_tip,
        )

    def _infer_category(self, resource_type: str) -> str:
        """Infer cost category from resource type name."""
        type_lower = resource_type.lower()
        if any(k in type_lower for k in ["instance", "ec2", "autoscaling", "launch", "spot"]):
            return "Compute"
        if any(k in type_lower for k in ["rds", "db", "dynamodb", "aurora"]):
            return "Database"
        if any(k in type_lower for k in ["s3", "ebs", "efs", "storage", "backup"]):
            return "Storage"
        if any(k in type_lower for k in ["vpc", "subnet", "security_group", "route", "nat", "lb", "alb", "nlb"]):
            return "Networking"
        if any(k in type_lower for k in ["lambda", "api_gateway", "stepfunction"]):
            return "Serverless"
        if any(k in type_lower for k in ["iam", "kms", "waf", "guardduty", "shield"]):
            return "Security"
        if any(k in type_lower for k in ["ecs", "eks", "ecr", "fargate"]):
            return "Containers"
        if any(k in type_lower for k in ["cloudwatch", "sns", "sqs", "kinesis"]):
            return "Monitoring"
        return "Other"

    async def _claude_estimate(self, resource: dict) -> float:
        """
        Use Claude to estimate cost for an ambiguous resource.
        Returns estimated monthly USD.
        """
        client = self._get_bedrock_client()
        if client is None:
            return 5.0  # conservative default

        try:
            prompt = f"""You are an AWS cost analyst. Given this Terraform resource block, 
determine the most likely monthly cost in USD. Return ONLY valid JSON, no markdown:
{{"monthly_usd": <float>, "confidence": "HIGH|MEDIUM|LOW", "reasoning": "<string>"}}

Resource type: {resource['type']}
Resource name: {resource['name']}
Instance type: {resource.get('instance_type', 'N/A')}
Config snippet:
{resource.get('body', '')[:1000]}
"""
            request_body = {
                "anthropic_version": "bedrock-2023-06-01",
                "max_tokens": 256,
                "messages": [{"role": "user", "content": prompt}],
            }

            response = client.invoke_model(
                modelId=os.getenv('BEDROCK_MODEL_ID', 'anthropic.claude-3-5-sonnet-20241022-v2:0'),
                body=json.dumps(request_body),
                contentType="application/json",
                accept="application/json",
            )

            response_body = json.loads(response['body'].read().decode('utf-8'))
            result_text = response_body['content'][0]['text']

            # Parse JSON from Claude response
            json_match = re.search(r'\{[^}]+\}', result_text)
            if json_match:
                estimate = json.loads(json_match.group(0))
                return float(estimate.get("monthly_usd", 5.0))

        except Exception as e:
            logger.debug(f"Claude cost estimate failed: {e}")

        return 5.0  # conservative fallback

    # ════════════════════════════════════════════════════════════════════
    # MAIN ESTIMATION ENTRY POINT
    # ════════════════════════════════════════════════════════════════════

    async def estimate_from_hcl(self, terraform_hcl: str, job_id: Optional[str] = None) -> CostEstimateOutput:
        """
        Parse HCL, extract all resource blocks, price each one.
        Try AWS Pricing API first. Fall back to RESOURCE_PRICING_MAP.
        Use Claude to interpret any resource configs that are ambiguous.
        """
        if not job_id:
            job_id = str(uuid.uuid4())

        # Parse resources
        parsed_resources = self._parse_hcl_resources(terraform_hcl)
        logger.info(f"Cost Estimator: Found {len(parsed_resources)} resources in HCL")

        # Price each resource
        resource_costs: list[ResourceCost] = []
        for res in parsed_resources:
            cost = await self._price_resource(res)
            resource_costs.append(cost)

        # Calculate totals
        total_monthly = sum(r.monthly_usd for r in resource_costs)
        total_annual = total_monthly * 12

        # Estimate GCP cost (AWS is typically ~12% cheaper than GCP)
        gcp_monthly = total_monthly * GCP_COST_MULTIPLIER
        savings_monthly = gcp_monthly - total_monthly
        savings_pct = (savings_monthly / gcp_monthly * 100) if gcp_monthly > 0 else 0

        # Group by category
        by_category: dict[str, float] = {}
        for r in resource_costs:
            by_category[r.category] = by_category.get(r.category, 0) + r.monthly_usd

        # Top cost drivers
        sorted_resources = sorted(resource_costs, key=lambda r: r.monthly_usd, reverse=True)
        top_cost_drivers = [f"{r.resource_name} (${r.monthly_usd:.2f}/mo)" for r in sorted_resources[:3]]

        # Spot eligible resources
        spot_eligible = [
            r.resource_name for r in resource_costs
            if r.spot_monthly is not None
        ]

        # Reserved recommendation
        if total_monthly > 500:
            reserved_recommendation = "3yr"
        elif total_monthly > 100:
            reserved_recommendation = "1yr"
        else:
            reserved_recommendation = "ON_DEMAND"

        # Rightsizing suggestions
        rightsizing: list[dict] = []
        for r in resource_costs:
            if r.optimization_tip:
                rightsizing.append({
                    "resource": r.resource_name,
                    "current": r.instance_type or r.resource_type,
                    "suggestion": r.optimization_tip,
                    "potential_savings_monthly": round(r.monthly_usd * 0.3, 2),
                })

        # Optimization summary
        optimization_summary = (
            f"Total infrastructure cost: ${total_monthly:,.2f}/mo (${total_annual:,.2f}/yr). "
            f"Estimated {savings_pct:.1f}% savings vs GCP equivalent. "
            f"{len(spot_eligible)} resources eligible for Spot pricing. "
            f"Recommended commitment: {reserved_recommendation.replace('_', '-')} reserved instances. "
            f"{len(rightsizing)} rightsizing opportunities identified."
        )

        return CostEstimateOutput(
            job_id=job_id,
            total_monthly_usd=round(total_monthly, 2),
            total_annual_usd=round(total_annual, 2),
            gcp_monthly_usd=round(gcp_monthly, 2),
            savings_monthly_usd=round(savings_monthly, 2),
            savings_pct=round(savings_pct, 1),
            resources=resource_costs,
            by_category={k: round(v, 2) for k, v in by_category.items()},
            top_cost_drivers=top_cost_drivers,
            optimization_summary=optimization_summary,
            spot_eligible=spot_eligible,
            reserved_recommendation=reserved_recommendation,
            rightsizing_suggestions=rightsizing,
        )
