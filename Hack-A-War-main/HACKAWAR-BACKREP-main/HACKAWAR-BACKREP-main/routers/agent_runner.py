"""
╔════════════════════════════════════════════════════════════════════════════╗
║  FEATURE D — Agent Runner API Routes                                     ║
╚════════════════════════════════════════════════════════════════════════════╝
"""

import json
import uuid
import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agents.agent_runner import AgentRunner, get_session, delete_session, list_sessions
from models.runner_output import RunnerOutput

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Agent Runner"])


class RunnerTaskRequest(BaseModel):
    task: str
    file_context: Optional[str] = None


class RunnerContinueRequest(BaseModel):
    message: str


@router.post("/runner/session")
async def create_runner_session(request: RunnerTaskRequest):
    """
    Create a new agent runner session and execute the task.
    Returns SSE stream of agent actions + final RunnerOutput.
    """
    session_id = str(uuid.uuid4())

    runner = AgentRunner()

    async def event_stream():
        updates: list[dict] = []

        async def collect_update(data: dict):
            data["session_id"] = session_id
            updates.append(data)

        try:
            result = await runner.run_task(
                session_id=session_id,
                task=request.task,
                file_context=request.file_context,
                on_update=collect_update,
            )

            # Stream collected updates
            for update in updates:
                yield f"data: {json.dumps(update)}\n\n"
                await asyncio.sleep(0.02)

            # Stream final result
            yield f"data: {json.dumps({'type': 'result', 'session_id': session_id, 'result': result.model_dump()})}\n\n"

        except Exception as e:
            logger.error(f"Runner session error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'session_id': session_id, 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-Id": session_id,
        },
    )


@router.post("/runner/{session_id}/continue")
async def continue_runner_session(session_id: str, request: RunnerContinueRequest):
    """
    Continue an existing agent runner conversation.
    Returns SSE stream of agent actions + final RunnerOutput.
    """
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")

    runner = AgentRunner()

    async def event_stream():
        updates: list[dict] = []

        async def collect_update(data: dict):
            data["session_id"] = session_id
            updates.append(data)

        try:
            result = await runner.run_task(
                session_id=session_id,
                task=request.message,
                on_update=collect_update,
            )

            for update in updates:
                yield f"data: {json.dumps(update)}\n\n"
                await asyncio.sleep(0.02)

            yield f"data: {json.dumps({'type': 'result', 'session_id': session_id, 'result': result.model_dump()})}\n\n"

        except Exception as e:
            logger.error(f"Runner continue error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'session_id': session_id, 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.get("/runner/{session_id}/history")
async def get_runner_history(session_id: str):
    """Get full conversation history for a runner session."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")

    return {
        "session_id": session_id,
        "messages": session.get("messages", []),
        "token_usage": session.get("token_usage", {}),
    }


@router.delete("/runner/{session_id}")
async def delete_runner_session(session_id: str):
    """Delete a runner session and clear its history."""
    existed = delete_session(session_id)
    if not existed:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")
    return {"status": "deleted", "session_id": session_id}
