"""
╔════════════════════════════════════════════════════════════════════════════╗
║  FEATURE C — Architecture Diagram Auto-Generator Agent                   ║
║  Generates React Flow graph JSON + Mermaid.js fallback from Terraform    ║
╚════════════════════════════════════════════════════════════════════════════╝
"""

import re
import json
import logging
import os
from typing import Optional

import boto3

from models.diagram_output import DiagramNode, DiagramEdge, DiagramOutput

logger = logging.getLogger(__name__)

# ════════════════════════════════════════════════════════════════════════════
# NODE STYLING — Neon-Cyan Cyberpunk Theme
# ════════════════════════════════════════════════════════════════════════════

SERVICE_STYLES: dict[str, dict] = {
    "ec2":          {"background": "#0f172a", "border": "#06b6d4", "color": "#22d3ee", "icon": "🖥️"},
    "lambda":       {"background": "#0f172a", "border": "#f59e0b", "color": "#fbbf24", "icon": "⚡"},
    "s3":           {"background": "#0f172a", "border": "#10b981", "color": "#34d399", "icon": "📦"},
    "rds":          {"background": "#0f172a", "border": "#6366f1", "color": "#818cf8", "icon": "🗄️"},
    "dynamodb":     {"background": "#0f172a", "border": "#6366f1", "color": "#818cf8", "icon": "⚡"},
    "vpc":          {"background": "rgba(6,182,212,0.05)", "border": "#164e63", "color": "#67e8f9", "icon": "🔲"},
    "subnet":       {"background": "rgba(6,182,212,0.03)", "border": "#1e3a5f", "color": "#7dd3fc", "icon": "📡"},
    "alb":          {"background": "#0f172a", "border": "#a855f7", "color": "#c084fc", "icon": "⚖️"},
    "nlb":          {"background": "#0f172a", "border": "#a855f7", "color": "#c084fc", "icon": "⚖️"},
    "ecs":          {"background": "#0f172a", "border": "#f97316", "color": "#fb923c", "icon": "🐳"},
    "eks":          {"background": "#0f172a", "border": "#f97316", "color": "#fb923c", "icon": "☸️"},
    "sqs":          {"background": "#0f172a", "border": "#ec4899", "color": "#f472b6", "icon": "📨"},
    "sns":          {"background": "#0f172a", "border": "#ec4899", "color": "#f472b6", "icon": "📢"},
    "cloudwatch":   {"background": "#0f172a", "border": "#ef4444", "color": "#f87171", "icon": "📊"},
    "kms":          {"background": "#0f172a", "border": "#eab308", "color": "#facc15", "icon": "🔑"},
    "iam":          {"background": "#0f172a", "border": "#eab308", "color": "#facc15", "icon": "🛡️"},
    "elasticache":  {"background": "#0f172a", "border": "#14b8a6", "color": "#2dd4bf", "icon": "💾"},
    "route53":      {"background": "#0f172a", "border": "#06b6d4", "color": "#22d3ee", "icon": "🌐"},
    "cloudfront":   {"background": "#0f172a", "border": "#06b6d4", "color": "#22d3ee", "icon": "🌐"},
    "waf":          {"background": "#0f172a", "border": "#ef4444", "color": "#f87171", "icon": "🔥"},
    "nat_gateway":  {"background": "#0f172a", "border": "#8b5cf6", "color": "#a78bfa", "icon": "🔀"},
    "default":      {"background": "#0f172a", "border": "#475569", "color": "#94a3b8", "icon": "☁️"},
}

# Resource type to layer mapping
LAYER_MAP: dict[str, int] = {
    "aws_route53_zone": 0, "aws_route53_record": 0, "aws_cloudfront_distribution": 0, "aws_waf_web_acl": 0,
    "aws_lb": 1, "aws_alb": 1, "aws_nlb": 1, "aws_lb_target_group": 1,
    "aws_instance": 2, "aws_ecs_service": 2, "aws_ecs_task_definition": 2, "aws_eks_cluster": 2,
    "aws_lambda_function": 2, "aws_autoscaling_group": 2, "aws_launch_template": 2,
    "aws_ec2_spot_fleet_request": 2,
    "aws_db_instance": 3, "aws_rds_cluster": 3, "aws_dynamodb_table": 3,
    "aws_s3_bucket": 3, "aws_efs_file_system": 3, "aws_ebs_volume": 3,
    "aws_elasticache_cluster": 3, "aws_elasticsearch_domain": 3,
    "aws_sns_topic": 4, "aws_sqs_queue": 4, "aws_kinesis_stream": 4,
    "aws_cloudwatch_log_group": 4, "aws_cloudwatch_metric_alarm": 4,
    "aws_vpc": 5, "aws_subnet": 5, "aws_security_group": 5, "aws_iam_role": 5,
    "aws_iam_policy": 5, "aws_kms_key": 5, "aws_nat_gateway": 5,
}

# Resource type to diagram node type mapping
TYPE_MAP: dict[str, str] = {
    "aws_instance": "ec2", "aws_launch_template": "ec2", "aws_autoscaling_group": "ec2",
    "aws_ec2_spot_fleet_request": "ec2",
    "aws_lambda_function": "lambda",
    "aws_s3_bucket": "s3", "aws_ebs_volume": "s3", "aws_efs_file_system": "s3",
    "aws_db_instance": "rds", "aws_rds_cluster": "rds",
    "aws_dynamodb_table": "dynamodb",
    "aws_vpc": "vpc", "aws_subnet": "subnet",
    "aws_lb": "alb", "aws_alb": "alb", "aws_nlb": "alb",
    "aws_ecs_service": "ecs", "aws_ecs_task_definition": "ecs",
    "aws_eks_cluster": "eks",
    "aws_sqs_queue": "sqs", "aws_sns_topic": "sns",
    "aws_cloudwatch_log_group": "cloudwatch", "aws_cloudwatch_metric_alarm": "cloudwatch",
    "aws_kms_key": "kms",
    "aws_iam_role": "iam", "aws_iam_policy": "iam",
    "aws_elasticache_cluster": "elasticache",
    "aws_route53_zone": "route53", "aws_route53_record": "route53",
    "aws_cloudfront_distribution": "cloudfront",
    "aws_waf_web_acl": "waf",
    "aws_nat_gateway": "nat_gateway",
    "aws_security_group": "iam",
}

# Edge type mappings
EDGE_TYPE_MAP: dict[tuple[str, str], str] = {
    ("alb", "ec2"): "traffic", ("alb", "ecs"): "traffic", ("alb", "lambda"): "traffic",
    ("alb", "eks"): "traffic", ("cloudfront", "alb"): "traffic", ("route53", "cloudfront"): "traffic",
    ("route53", "alb"): "traffic",
    ("ec2", "rds"): "db", ("ecs", "rds"): "db", ("lambda", "rds"): "db",
    ("ec2", "dynamodb"): "db", ("lambda", "dynamodb"): "db",
    ("ecs", "dynamodb"): "db", ("ec2", "elasticache"): "db", ("lambda", "elasticache"): "db",
    ("ec2", "s3"): "traffic", ("lambda", "s3"): "traffic", ("ecs", "s3"): "traffic",
    ("sns", "sqs"): "event", ("sns", "lambda"): "event", ("sqs", "lambda"): "event",
    ("cloudwatch", "sns"): "event",
    ("iam", "ec2"): "iam", ("iam", "lambda"): "iam", ("iam", "ecs"): "iam",
}

EDGE_STYLES: dict[str, dict] = {
    "traffic":  {"stroke": "#22d3ee", "strokeWidth": 2},
    "db":       {"stroke": "#818cf8", "strokeWidth": 2},
    "event":    {"stroke": "#facc15", "strokeWidth": 1.5, "strokeDasharray": "6 3"},
    "iam":      {"stroke": "#fb923c", "strokeWidth": 1, "strokeDasharray": "3 3"},
    "contains": {"stroke": "#334155", "strokeWidth": 1},
}


class DiagramAgent:
    """
    Generates architecture diagram data from Terraform resources.
    Produces React Flow compatible graph JSON + Mermaid.js fallback.
    """

    SYSTEM_PROMPT = """You are an AWS architecture diagram specialist.
Given a list of AWS Terraform resources and their relationships,
generate a complete visual architecture diagram data structure.

Rules for graph layout:
- Use a left-to-right layered layout
- Layer 0 (leftmost): DNS, CDN, WAF (Route53, CloudFront, WAF)
- Layer 1: Load Balancers (ALB, NLB)
- Layer 2: Compute (EC2, ECS, EKS, Lambda)
- Layer 3: Data stores (RDS, DynamoDB, ElastiCache, S3)
- Layer 4: Supporting services (SNS, SQS, KMS, CloudWatch)
- Layer 5 (rightmost): VPC boundaries, IAM, Security Groups

CRITICAL: Respond ONLY with valid JSON containing "nodes" and "edges" arrays. No markdown."""

    def __init__(self) -> None:
        self._bedrock_client = None

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

    # ════════════════════════════════════════════════════════════════════
    # HCL RESOURCE PARSER
    # ════════════════════════════════════════════════════════════════════

    def _parse_resources(self, terraform_hcl: str) -> list[dict]:
        """Extract resource type/name pairs and references from HCL."""
        resources = []
        resource_pattern = re.compile(
            r'resource\s+"([^"]+)"\s+"([^"]+)"\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}',
            re.DOTALL
        )

        for match in resource_pattern.finditer(terraform_hcl):
            res_type = match.group(1)
            res_name = match.group(2)
            res_body = match.group(3)

            # Extract instance type
            instance_type = None
            it_match = re.search(r'instance_type\s*=\s*"([^"]+)"', res_body)
            if it_match:
                instance_type = it_match.group(1)
            ic_match = re.search(r'instance_class\s*=\s*"([^"]+)"', res_body)
            if ic_match:
                instance_type = ic_match.group(1)

            # Extract references to other resources (for edges)
            refs = re.findall(r'(aws_\w+)\.(\w+)\.(id|arn|name)', res_body)

            resources.append({
                "type": res_type,
                "name": res_name,
                "instance_type": instance_type,
                "refs": [(r[0], r[1]) for r in refs],
                "body": res_body.strip()[:500],
            })

        # Fallback: simpler pattern
        if not resources:
            simple_pattern = re.compile(r'resource\s+"([^"]+)"\s+"([^"]+)"')
            for match in simple_pattern.finditer(terraform_hcl):
                resources.append({
                    "type": match.group(1),
                    "name": match.group(2),
                    "instance_type": None,
                    "refs": [],
                    "body": "",
                })

        return resources

    # ════════════════════════════════════════════════════════════════════
    # GRAPH BUILDER
    # ════════════════════════════════════════════════════════════════════

    def _build_graph(self, resources: list[dict]) -> tuple[list[DiagramNode], list[DiagramEdge]]:
        """Build React Flow compatible nodes and edges from parsed resources."""
        nodes: list[DiagramNode] = []
        edges: list[DiagramEdge] = []
        node_lookup: dict[str, str] = {}  # "type.name" -> node_id

        # Layer spacing
        x_spacing = 280
        y_spacing = 120

        # Group resources by layer
        layer_items: dict[int, list] = {i: [] for i in range(6)}
        for res in resources:
            layer = LAYER_MAP.get(res["type"], 4)
            layer_items[layer].append(res)

        # Create nodes with positions
        for layer_idx in range(6):
            items = layer_items[layer_idx]
            for item_idx, res in enumerate(items):
                node_id = f"{res['type']}_{res['name']}"
                node_type = TYPE_MAP.get(res["type"], "default")
                style_info = SERVICE_STYLES.get(node_type, SERVICE_STYLES["default"])

                x = layer_idx * x_spacing + 50
                y = item_idx * y_spacing + 50

                label = f"{style_info['icon']} {res['name'].replace('_', ' ').title()}"

                node = DiagramNode(
                    id=node_id,
                    type=node_type,
                    label=label,
                    layer=layer_idx,
                    group=None,
                    position={"x": x, "y": y},
                    data={
                        "service": res["type"],
                        "instance_type": res.get("instance_type"),
                        "resource_name": res["name"],
                    },
                    style={
                        "background": style_info["background"],
                        "border": f"1px solid {style_info['border']}",
                        "color": style_info["color"],
                        "borderRadius": "8px",
                        "padding": "12px 16px",
                        "fontSize": "12px",
                        "boxShadow": f"0 0 12px {style_info['border']}40",
                    },
                )
                nodes.append(node)
                node_lookup[f"{res['type']}.{res['name']}"] = node_id

        # Create edges from resource references
        edge_counter = 0
        added_edges: set[tuple[str, str]] = set()

        for res in resources:
            source_id = node_lookup.get(f"{res['type']}.{res['name']}")
            if not source_id:
                continue

            source_type = TYPE_MAP.get(res["type"], "default")

            for ref_type, ref_name in res.get("refs", []):
                target_id = node_lookup.get(f"{ref_type}.{ref_name}")
                if not target_id or target_id == source_id:
                    continue

                edge_key = (source_id, target_id)
                if edge_key in added_edges or (target_id, source_id) in added_edges:
                    continue
                added_edges.add(edge_key)

                target_type = TYPE_MAP.get(ref_type, "default")

                # Determine edge type
                edge_type = EDGE_TYPE_MAP.get((source_type, target_type), None)
                if not edge_type:
                    edge_type = EDGE_TYPE_MAP.get((target_type, source_type), "traffic")
                    source_id, target_id = target_id, source_id

                style = EDGE_STYLES.get(edge_type, EDGE_STYLES["traffic"])

                edge = DiagramEdge(
                    id=f"edge_{edge_counter}",
                    source=source_id,
                    target=target_id,
                    label=edge_type.upper() if edge_type != "traffic" else None,
                    type=edge_type,
                    animated=edge_type in ("traffic", "event"),
                    style=style,
                )
                edges.append(edge)
                edge_counter += 1

        # Auto-generate logical edges if no refs found
        if not edges and len(nodes) > 1:
            sorted_nodes = sorted(nodes, key=lambda n: n.layer)
            for i in range(len(sorted_nodes) - 1):
                src = sorted_nodes[i]
                tgt = sorted_nodes[i + 1]
                if src.layer != tgt.layer:
                    edge_type_key = (src.type, tgt.type)
                    etype = EDGE_TYPE_MAP.get(edge_type_key, "traffic")
                    style = EDGE_STYLES.get(etype, EDGE_STYLES["traffic"])
                    edges.append(DiagramEdge(
                        id=f"edge_{edge_counter}",
                        source=src.id,
                        target=tgt.id,
                        type=etype,
                        animated=True,
                        style=style,
                    ))
                    edge_counter += 1

        return nodes, edges

    # ════════════════════════════════════════════════════════════════════
    # MERMAID GENERATOR
    # ════════════════════════════════════════════════════════════════════

    def _generate_mermaid(self, nodes: list[DiagramNode], edges: list[DiagramEdge]) -> str:
        """Generate Mermaid.js text from nodes and edges."""
        lines = ["graph LR"]

        # Node definitions
        for node in nodes:
            safe_label = node.label.replace('"', "'")
            node_id = node.id.replace(".", "_").replace("-", "_")
            if node.type == "vpc" or node.type == "subnet":
                lines.append(f'    {node_id}["{safe_label}"]')
            elif node.type == "lambda":
                lines.append(f'    {node_id}{{{{{safe_label}}}}}')
            elif node.type in ("s3", "rds", "dynamodb", "elasticache"):
                lines.append(f'    {node_id}[("{safe_label}")]')
            elif node.type in ("alb", "nlb"):
                lines.append(f'    {node_id}{{{safe_label}}}')
            else:
                lines.append(f'    {node_id}["{safe_label}"]')

        # Edge definitions
        for edge in edges:
            src = edge.source.replace(".", "_").replace("-", "_")
            tgt = edge.target.replace(".", "_").replace("-", "_")
            if edge.label:
                lines.append(f'    {src} -->|{edge.label}| {tgt}')
            else:
                lines.append(f'    {src} --> {tgt}')

        # Style definitions
        for node in nodes:
            node_id = node.id.replace(".", "_").replace("-", "_")
            style_info = SERVICE_STYLES.get(node.type, SERVICE_STYLES["default"])
            lines.append(f'    style {node_id} fill:{style_info["background"]},stroke:{style_info["border"]},color:{style_info["color"]}')

        return "\n".join(lines)

    # ════════════════════════════════════════════════════════════════════
    # MAIN GENERATION ENTRY POINT
    # ════════════════════════════════════════════════════════════════════

    async def generate(self, terraform_hcl: Optional[str] = None,
                       resources: Optional[list[dict]] = None,
                       relationships: Optional[list[dict]] = None) -> DiagramOutput:
        """
        Generate architecture diagram from Terraform HCL or pre-parsed resources.
        Returns React Flow compatible graph + Mermaid fallback.
        """
        if terraform_hcl:
            parsed = self._parse_resources(terraform_hcl)
        elif resources:
            parsed = resources
        else:
            parsed = []

        if not parsed:
            return DiagramOutput(
                nodes=[],
                edges=[],
                mermaid_source="graph LR\n    empty[No resources found]",
                aws_resource_count=0,
                complexity_score=1,
            )

        # Build graph
        nodes, edges = self._build_graph(parsed)

        # Generate mermaid fallback
        mermaid_source = self._generate_mermaid(nodes, edges)

        # Compute stats
        aws_resource_count = len(nodes)
        vpc_count = sum(1 for n in nodes if n.type == "vpc")
        has_multi_az = any("multi_az" in str(r.get("body", "")).lower() for r in parsed)
        has_load_balancer = any(n.type in ("alb", "nlb") for n in nodes)
        has_database = any(n.type in ("rds", "dynamodb") for n in nodes)

        # Complexity score
        complexity = min(10, max(1, (aws_resource_count + len(edges)) // 3))

        return DiagramOutput(
            nodes=nodes,
            edges=edges,
            mermaid_source=mermaid_source,
            aws_resource_count=aws_resource_count,
            vpc_count=vpc_count,
            has_multi_az=has_multi_az,
            has_load_balancer=has_load_balancer,
            has_database=has_database,
            complexity_score=complexity,
        )
