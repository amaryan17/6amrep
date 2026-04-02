"""
╔════════════════════════════════════════════════════════════════════════════╗
║  FEATURE A — AWS Real-Time Cost Estimator — Data Models                  ║
╚════════════════════════════════════════════════════════════════════════════╝
"""

from typing import Optional
from pydantic import BaseModel, Field


class ResourceCost(BaseModel):
    """Cost breakdown for a single AWS resource."""
    resource_name: str = Field(..., description="Terraform resource identifier")
    resource_type: str = Field(..., description="AWS resource type (e.g., aws_instance)")
    instance_type: Optional[str] = Field(None, description="Instance type if applicable")
    monthly_usd: float = Field(..., ge=0, description="Monthly cost in USD")
    annual_usd: float = Field(..., ge=0, description="Annual cost in USD")
    category: str = Field(..., description="Cost category (Compute, Storage, Database, etc.)")
    pricing_source: str = Field(
        ...,
        description="Source of pricing data: AWS_API | STATIC_MAP | CLAUDE_ESTIMATE"
    )
    confidence: str = Field(
        ...,
        description="Confidence level: HIGH | MEDIUM | LOW"
    )
    spot_monthly: Optional[float] = Field(None, ge=0, description="Monthly cost with Spot pricing")
    reserved_1yr: Optional[float] = Field(None, ge=0, description="Monthly cost with 1-year reserved")
    reserved_3yr: Optional[float] = Field(None, ge=0, description="Monthly cost with 3-year reserved")
    optimization_tip: Optional[str] = Field(None, description="Rightsizing or optimization suggestion")


class CostEstimateOutput(BaseModel):
    """Complete cost estimate for a Terraform configuration."""
    job_id: str = Field(..., description="Unique job identifier")
    total_monthly_usd: float = Field(..., ge=0, description="Total monthly cost")
    total_annual_usd: float = Field(..., ge=0, description="Total annual cost")
    gcp_monthly_usd: float = Field(..., ge=0, description="Estimated original GCP monthly cost")
    savings_monthly_usd: float = Field(..., description="Monthly savings (GCP - AWS)")
    savings_pct: float = Field(..., description="Savings percentage")
    resources: list[ResourceCost] = Field(default_factory=list, description="Per-resource cost breakdown")
    by_category: dict[str, float] = Field(
        default_factory=dict,
        description="Total cost grouped by category"
    )
    top_cost_drivers: list[str] = Field(
        default_factory=list,
        description="Top 3 most expensive resources"
    )
    optimization_summary: str = Field(
        default="",
        description="Claude-generated savings narrative"
    )
    spot_eligible: list[str] = Field(
        default_factory=list,
        description="Resource names eligible for Spot pricing"
    )
    reserved_recommendation: str = Field(
        default="ON_DEMAND",
        description="Reserved instance recommendation: 1yr | 3yr | ON_DEMAND"
    )
    rightsizing_suggestions: list[dict] = Field(
        default_factory=list,
        description="List of rightsizing suggestions with current/recommended/savings"
    )
