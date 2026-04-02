"""
╔════════════════════════════════════════════════════════════════════════════╗
║  FEATURE C — Architecture Diagram API Routes                             ║
╚════════════════════════════════════════════════════════════════════════════╝
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from agents.diagram_agent import DiagramAgent
from models.diagram_output import DiagramOutput

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Architecture Diagram"])


class DiagramRequest(BaseModel):
    terraform_hcl: Optional[str] = None
    job_id: Optional[str] = None


# Cache for generated diagrams
_diagram_cache: dict[str, dict] = {}


@router.post("/diagram/generate", response_model=DiagramOutput)
async def generate_diagram(request: DiagramRequest):
    """
    Generate an architecture diagram from Terraform HCL.
    Returns React Flow compatible graph JSON + Mermaid.js fallback.
    """
    if not request.terraform_hcl and not request.job_id:
        raise HTTPException(
            status_code=400,
            detail="Provide terraform_hcl or job_id in request body"
        )

    # Check cache for job_id
    if request.job_id and request.job_id in _diagram_cache:
        return _diagram_cache[request.job_id]

    terraform_hcl = request.terraform_hcl or ""

    if not terraform_hcl.strip():
        raise HTTPException(status_code=400, detail="Empty Terraform content")

    try:
        agent = DiagramAgent()
        result = await agent.generate(terraform_hcl=terraform_hcl)

        # Cache if job_id provided
        if request.job_id:
            _diagram_cache[request.job_id] = result.model_dump()

        return result
    except Exception as e:
        logger.error(f"Diagram generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
