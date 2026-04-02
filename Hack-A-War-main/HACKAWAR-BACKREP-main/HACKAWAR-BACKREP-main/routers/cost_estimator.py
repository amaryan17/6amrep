"""
╔════════════════════════════════════════════════════════════════════════════╗
║  FEATURE A — Cost Estimator API Routes                                   ║
╚════════════════════════════════════════════════════════════════════════════╝
"""

import json
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from agents.cost_estimator_agent import CostEstimatorAgent
from models.cost_estimate import CostEstimateOutput

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Cost Estimator"])

# In-memory cache for cost estimates by job_id
_cost_cache: dict[str, dict] = {}


class CostEstimateRequest(BaseModel):
    terraform_hcl: str
    job_id: Optional[str] = None


@router.post("/cost-estimate")
async def estimate_cost(request: CostEstimateRequest):
    """
    Estimate AWS infrastructure costs from Terraform HCL (JSON body).
    """
    terraform_hcl = request.terraform_hcl
    job_id = request.job_id

    if not terraform_hcl.strip():
        raise HTTPException(status_code=400, detail="Empty Terraform content")

    try:
        agent = CostEstimatorAgent()
        result = await agent.estimate_from_hcl(terraform_hcl, job_id=job_id)

        # Cache result
        _cost_cache[result.job_id] = result.model_dump()

        return result
    except Exception as e:
        logger.error(f"Cost estimation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cost-estimate/upload")
async def estimate_cost_from_file(file: UploadFile = File(...)):
    """
    Estimate AWS infrastructure costs from uploaded .tf or .zip file.
    """
    content = await file.read()
    terraform_hcl = ""

    if file.filename and file.filename.endswith('.zip'):
        import zipfile
        import io
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                parts = []
                for name in zf.namelist():
                    if name.endswith('.tf') and not name.endswith('/'):
                        try:
                            parts.append(zf.read(name).decode('utf-8'))
                        except (UnicodeDecodeError, KeyError):
                            pass
                terraform_hcl = "\n\n".join(parts)
        except zipfile.BadZipFile:
            terraform_hcl = content.decode('utf-8', errors='replace')
    else:
        terraform_hcl = content.decode('utf-8', errors='replace')

    if not terraform_hcl.strip():
        raise HTTPException(status_code=400, detail="Empty Terraform content")

    try:
        agent = CostEstimatorAgent()
        result = await agent.estimate_from_hcl(terraform_hcl)

        # Cache result
        _cost_cache[result.job_id] = result.model_dump()

        return result
    except Exception as e:
        logger.error(f"Cost estimation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cost-estimate/{job_id}", response_model=CostEstimateOutput)
async def get_cached_estimate(job_id: str):
    """Retrieve a cached cost estimate by job ID."""
    if job_id not in _cost_cache:
        raise HTTPException(status_code=404, detail=f"No cached estimate for job_id: {job_id}")
    return _cost_cache[job_id]
