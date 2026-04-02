"""
╔════════════════════════════════════════════════════════════════════════════╗
║  FEATURE D — Agent Execution Runner — Data Models                        ║
╚════════════════════════════════════════════════════════════════════════════╝
"""

from typing import Optional
from pydantic import BaseModel, Field


class TokenUsage(BaseModel):
    """Token usage tracking for a runner session."""
    input_tokens: int = Field(default=0, description="Total input tokens consumed")
    output_tokens: int = Field(default=0, description="Total output tokens generated")
    total_tokens: int = Field(default=0, description="Total tokens (input + output)")
    estimated_cost_usd: float = Field(default=0.0, description="Estimated cost in USD")


class ToolCallRecord(BaseModel):
    """Record of a single tool call within a runner session."""
    iteration: int = Field(..., description="Loop iteration number")
    tool_name: str = Field(..., description="Name of the tool called")
    tool_input: dict = Field(default_factory=dict, description="Input parameters")
    tool_result: str = Field(default="", description="Truncated result")
    duration_ms: int = Field(default=0, description="Execution time in milliseconds")
    status: str = Field(default="success", description="success | error")
    timestamp: str = Field(default="", description="ISO timestamp")


class ConversationMessage(BaseModel):
    """A single message in the runner conversation history."""
    role: str = Field(..., description="user | assistant | tool")
    content: str = Field(default="", description="Message content")
    tool_calls: list[ToolCallRecord] = Field(
        default_factory=list,
        description="Tool calls made in this turn (assistant only)"
    )
    timestamp: str = Field(default="", description="ISO timestamp")


class RunnerOutput(BaseModel):
    """Complete output for an agent runner session."""
    session_id: str = Field(..., description="Unique session identifier")
    status: str = Field(
        default="COMPLETE",
        description="Session status: COMPLETE | RUNNING | MAX_ITER_REACHED | FAILED"
    )
    final_response: str = Field(default="", description="Final assistant response text")
    conversation_history: list[ConversationMessage] = Field(
        default_factory=list,
        description="Full conversation history"
    )
    tool_calls: list[ToolCallRecord] = Field(
        default_factory=list,
        description="All tool calls made during session"
    )
    artifacts_generated: list[str] = Field(
        default_factory=list,
        description="Files generated during the session"
    )
    token_usage: TokenUsage = Field(
        default_factory=TokenUsage,
        description="Token usage statistics"
    )
    total_iterations: int = Field(default=0, description="Agentic loop iterations")
    error_message: Optional[str] = Field(None, description="Error details if failed")
