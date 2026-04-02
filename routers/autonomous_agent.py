"""
╔════════════════════════════════════════════════════════════════════════════╗
║  FEATURE B — Autonomous Agent API Routes                                 ║
╚════════════════════════════════════════════════════════════════════════════╝
"""

import json
import uuid
import asyncio
import logging
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel

from agents.autonomous_agent import AutonomousAgent
from models.workspace_report import WorkspaceReport

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Autonomous Agent"])

# Session data store
_agent_sessions: dict[str, dict] = {}


class AgentRunRequest(BaseModel):
    github_url: Optional[str] = None


@router.post("/agent/run")
async def run_autonomous_agent(file: Optional[UploadFile] = File(None)):
    """
    Start an autonomous agent session.
    Accepts a file upload (ZIP or single file).
    Returns SSE stream of agent actions + final WorkspaceReport.
    """
    if not file:
        raise HTTPException(status_code=400, detail="Upload a file (ZIP or single config)")

    session_id = str(uuid.uuid4())
    content = await file.read()
    filename = file.filename or "upload.txt"

    agent = AutonomousAgent()

    async def event_stream():
        try:
            workspace = await agent.setup_workspace(content, filename, session_id)

            async def send_update(data: dict):
                data["session_id"] = session_id
                yield_data = f"data: {json.dumps(data)}\n\n"
                return yield_data

            updates: list[dict] = []

            async def collect_update(data: dict):
                data["session_id"] = session_id
                updates.append(data)

            report = await agent.run(workspace, session_id, on_update=collect_update)

            # Stream collected updates
            for update in updates:
                yield f"data: {json.dumps(update)}\n\n"
                await asyncio.sleep(0.05)

            # Store session
            _agent_sessions[session_id] = {
                "report": report.model_dump(),
                "workspace": str(workspace),
            }

            # Stream final report
            yield f"data: {json.dumps({'type': 'report', 'session_id': session_id, 'report': report.model_dump()})}\n\n"

        except Exception as e:
            logger.error(f"Autonomous agent error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-Id": session_id,
        },
    )


@router.get("/agent/{session_id}/outputs")
async def get_agent_outputs(session_id: str):
    """List all output files from an autonomous agent session."""
    session = _agent_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")

    workspace = Path(session["workspace"])
    output_dir = workspace / "output"

    if not output_dir.exists():
        return {"session_id": session_id, "files": []}

    files = []
    for f in output_dir.rglob("*"):
        if f.is_file():
            files.append({
                "path": str(f.relative_to(output_dir)),
                "size_bytes": f.stat().st_size,
            })

    return {"session_id": session_id, "files": files}


@router.get("/agent/{session_id}/download")
async def download_agent_outputs(session_id: str):
    """Download ZIP of all output artifacts from an agent session."""
    session = _agent_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")

    report = session.get("report", {})
    zip_path = report.get("output_zip_path", "")

    if zip_path and Path(zip_path).exists():
        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename=f"aegis_output_{session_id[:8]}.zip",
        )

    # Create zip on the fly
    import zipfile
    import io

    workspace = Path(session["workspace"])
    output_dir = workspace / "output"

    if not output_dir.exists():
        raise HTTPException(status_code=404, detail="No output files found")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in output_dir.rglob("*"):
            if f.is_file():
                zf.write(f, f.relative_to(output_dir))

    zip_buffer.seek(0)

    from fastapi.responses import Response
    return Response(
        content=zip_buffer.read(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="aegis_output_{session_id[:8]}.zip"'
        },
    )
