"""
╔════════════════════════════════════════════════════════════════════════════╗
║  FEATURE C — Architecture Diagram Auto-Generator — Data Models           ║
╚════════════════════════════════════════════════════════════════════════════╝
"""

from typing import Optional
from pydantic import BaseModel, Field


class DiagramNode(BaseModel):
    """A single node in the architecture diagram (React Flow compatible)."""
    id: str = Field(..., description="Unique node identifier")
    type: str = Field(
        ...,
        description="AWS service type: ec2 | rds | s3 | lambda | vpc | subnet | alb | ecs | eks | dynamodb | sqs | sns | cloudwatch | kms | iam | elasticache"
    )
    label: str = Field(..., description="Display label for the node")
    layer: int = Field(
        ..., ge=0, le=5,
        description="Layout layer: 0=DNS/CDN, 1=LB, 2=Compute, 3=Data, 4=Supporting, 5=Security"
    )
    group: Optional[str] = Field(None, description="Parent VPC/Subnet group ID")
    position: dict = Field(
        default_factory=lambda: {"x": 0, "y": 0},
        description="Absolute position {x, y} for React Flow"
    )
    data: dict = Field(
        default_factory=dict,
        description="Additional data: {service, instance_type, monthly_cost, ...}"
    )
    style: dict = Field(
        default_factory=dict,
        description="Visual style: {background, border, color} — neon-cyan theme"
    )


class DiagramEdge(BaseModel):
    """A connection between two nodes in the architecture diagram."""
    id: str = Field(..., description="Unique edge identifier")
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    label: Optional[str] = Field(None, description="Edge label text")
    type: str = Field(
        ...,
        description="Edge type: traffic | db | event | iam | contains"
    )
    animated: bool = Field(default=False, description="True for animated data flow edges")
    style: dict = Field(
        default_factory=dict,
        description="Visual style: {stroke, strokeDasharray} color-coded by type"
    )


class DiagramOutput(BaseModel):
    """Complete architecture diagram data structure."""
    nodes: list[DiagramNode] = Field(default_factory=list, description="All diagram nodes")
    edges: list[DiagramEdge] = Field(default_factory=list, description="All diagram edges")
    mermaid_source: str = Field(default="", description="Mermaid.js text fallback")
    aws_resource_count: int = Field(default=0, description="Total AWS resources")
    vpc_count: int = Field(default=0, description="Number of VPCs")
    has_multi_az: bool = Field(default=False, description="Multi-AZ detected")
    has_load_balancer: bool = Field(default=False, description="Load balancer present")
    has_database: bool = Field(default=False, description="Database present")
    complexity_score: int = Field(
        default=1, ge=1, le=10,
        description="Architecture complexity: 1 (simple) to 10 (complex)"
    )
