"""
╔════════════════════════════════════════════════════════════════════════════╗
║  FEATURE B — Autonomous File-Processing Agent — Data Models              ║
╚════════════════════════════════════════════════════════════════════════════╝
"""

from typing import Optional
from pydantic import BaseModel, Field


class WorkspaceReport(BaseModel):
    """Complete report from an autonomous agent workspace session."""
    session_id: str = Field(..., description="Unique session identifier")
    files_discovered: list[str] = Field(
        default_factory=list,
        description="List of all files found in workspace"
    )
    files_processed: int = Field(default=0, description="Number of files read/analyzed")
    artifacts_saved: list[str] = Field(
        default_factory=list,
        description="List of artifacts saved to output directory"
    )
    resource_inventory: dict = Field(
        default_factory=dict,
        description="Discovered resources grouped by type: {resource_type: count}"
    )
    architecture_summary: str = Field(
        default="",
        description="Claude-generated architecture summary"
    )
    inferred_stack: list[str] = Field(
        default_factory=list,
        description="Inferred technology stack (e.g., GCP, Kubernetes, PostgreSQL)"
    )
    output_zip_path: str = Field(
        default="",
        description="Path to downloadable ZIP of all outputs"
    )
    execution_log: list[dict] = Field(
        default_factory=list,
        description="Chronological log of agent actions: [{iteration, tool, input, result, ts}]"
    )
    total_iterations: int = Field(default=0, description="Total agentic loop iterations executed")
    status: str = Field(
        default="COMPLETE",
        description="Final status: COMPLETE | MAX_ITER_REACHED | FAILED"
    )
    error_message: Optional[str] = Field(None, description="Error details if status is FAILED")
