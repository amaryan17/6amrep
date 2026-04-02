"""
╔════════════════════════════════════════════════════════════════════════════╗
║  FEATURE B — Autonomous File-Processing Agent                            ║
║  Agentic Claude loop with sandboxed tool_use for autonomous analysis     ║
╚════════════════════════════════════════════════════════════════════════════╝
"""

import json
import uuid
import shutil
import logging
import os
import re
import subprocess
import tempfile
import zipfile
import io
import glob as glob_module
from pathlib import Path
from typing import Optional, Callable, Awaitable, Any
from datetime import datetime

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from models.workspace_report import WorkspaceReport

logger = logging.getLogger(__name__)

# ════════════════════════════════════════════════════════════════════════════
# EXCEPTIONS
# ════════════════════════════════════════════════════════════════════════════


class TaskCompleteSignal(Exception):
    """Raised when the autonomous agent calls task_complete."""
    def __init__(self, data: dict):
        self.data = data
        super().__init__(str(data))


# ════════════════════════════════════════════════════════════════════════════
# TOOL DEFINITIONS (passed to Claude via tools=[...])
# ════════════════════════════════════════════════════════════════════════════

TOOL_DEFINITIONS = [
    {
        "name": "read_file",
        "description": "Read the contents of any file in the workspace. Returns file content as text.",
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string", "description": "Relative path within the workspace"}
            },
            "required": ["file_path"]
        }
    },
    {
        "name": "list_files",
        "description": "List all files in a directory or the entire workspace. Returns sorted list of relative paths.",
        "input_schema": {
            "type": "object",
            "properties": {
                "directory": {"type": "string", "description": "Subdirectory to list (default: root)", "default": "."},
                "pattern": {"type": "string", "description": "Glob pattern filter (e.g., *.tf, *.yaml)"}
            }
        }
    },
    {
        "name": "search_files",
        "description": "Search for a text pattern across all files in the workspace. Returns matched lines with file paths.",
        "input_schema": {
            "type": "object",
            "properties": {
                "pattern": {"type": "string", "description": "Text pattern to search for"},
                "file_extension": {"type": "string", "description": "Filter by file extension (e.g., .tf, .yaml)"}
            },
            "required": ["pattern"]
        }
    },
    {
        "name": "write_file",
        "description": "Write or overwrite a file in the workspace output directory. Creates parent directories automatically.",
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string", "description": "Relative path for output file"},
                "content": {"type": "string", "description": "File content to write"}
            },
            "required": ["file_path", "content"]
        }
    },
    {
        "name": "run_command",
        "description": "Run a safe, sandboxed shell command in the workspace. Only whitelisted commands are allowed.",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Shell command to run"},
                "timeout_seconds": {"type": "integer", "description": "Max seconds to wait", "default": 10}
            },
            "required": ["command"]
        }
    },
    {
        "name": "infer_architecture",
        "description": "Analyze discovered resources and produce an architecture summary with relationships.",
        "input_schema": {
            "type": "object",
            "properties": {
                "resources": {"type": "array", "description": "List of discovered resource objects"},
                "relationships": {"type": "array", "description": "List of resource relationships"}
            },
            "required": ["resources"]
        }
    },
    {
        "name": "save_artifact",
        "description": "Save a final processed artifact (report, diagram, config) to the output directory.",
        "input_schema": {
            "type": "object",
            "properties": {
                "artifact_name": {"type": "string", "description": "Name of the artifact file"},
                "artifact_type": {"type": "string", "description": "Type: report | diagram | config | inventory | summary"},
                "content": {"type": "string", "description": "Artifact content"}
            },
            "required": ["artifact_name", "artifact_type", "content"]
        }
    },
    {
        "name": "task_complete",
        "description": "Signal that the autonomous agent has finished all tasks. Call this when done.",
        "input_schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string", "description": "Summary of work done"},
                "files_processed": {"type": "integer", "description": "Number of files processed"},
                "artifacts_saved": {"type": "integer", "description": "Number of artifacts saved"}
            },
            "required": ["summary"]
        }
    },
]

# Whitelisted commands for sandboxed execution
ALLOWED_COMMANDS = [
    "terraform", "terraform fmt", "terraform validate",
    "cat", "ls", "find", "grep", "wc", "head", "tail",
    "python3 -c", "python3 --version", "python --version",
    "jq", "yq", "tree", "du", "file",
]


# ════════════════════════════════════════════════════════════════════════════
# PATH VALIDATION
# ════════════════════════════════════════════════════════════════════════════

def _validate_path(requested: Path, workspace: Path) -> None:
    """Ensure the resolved path stays inside the workspace. Raises ValueError if not."""
    resolved = requested.resolve()
    workspace_resolved = workspace.resolve()
    if not str(resolved).startswith(str(workspace_resolved)):
        raise ValueError(f"Path traversal blocked: {requested} resolves outside workspace")


# ════════════════════════════════════════════════════════════════════════════
# TOOL EXECUTION
# ════════════════════════════════════════════════════════════════════════════

async def execute_tool(tool_name: str, tool_input: dict, workspace: Path) -> str:
    """
    Route tool calls to their implementations.
    All file operations are sandboxed to workspace directory.
    """

    if tool_name == "read_file":
        file_path = tool_input.get("file_path", "")
        path = workspace / file_path
        _validate_path(path, workspace)
        if not path.exists():
            return f"ERROR: File not found: {file_path}"
        if not path.is_file():
            return f"ERROR: Not a file: {file_path}"
        try:
            content = path.read_text(errors="replace")
            if len(content) > 50000:
                content = content[:50000] + "\n... [TRUNCATED at 50KB]"
            return content
        except Exception as e:
            return f"ERROR reading file: {str(e)}"

    elif tool_name == "list_files":
        directory = tool_input.get("directory", ".")
        pattern = tool_input.get("pattern", None)
        target = workspace / directory
        _validate_path(target, workspace)

        if not target.exists():
            return f"ERROR: Directory not found: {directory}"

        results = []
        if pattern:
            for match in target.rglob(pattern):
                if match.is_file():
                    rel = match.relative_to(workspace)
                    results.append(str(rel))
        else:
            for match in target.rglob("*"):
                if match.is_file():
                    rel = match.relative_to(workspace)
                    results.append(str(rel))

        results.sort()
        if len(results) > 500:
            results = results[:500]
            results.append(f"... [TRUNCATED: {len(results)} total files]")

        return "\n".join(results) if results else "No files found."

    elif tool_name == "search_files":
        search_pattern = tool_input.get("pattern", "")
        file_ext = tool_input.get("file_extension", None)
        results = []

        glob_pattern = f"*{file_ext}" if file_ext else "*"
        for file_path in workspace.rglob(glob_pattern):
            if not file_path.is_file():
                continue
            if "/output/" in str(file_path):
                continue
            try:
                content = file_path.read_text(errors="replace")
                for line_num, line in enumerate(content.splitlines(), 1):
                    if search_pattern.lower() in line.lower():
                        rel = file_path.relative_to(workspace)
                        results.append(f"{rel}:{line_num}: {line.strip()}")
                        if len(results) >= 100:
                            break
            except Exception:
                continue
            if len(results) >= 100:
                break

        if not results:
            return f"No matches found for pattern: {search_pattern}"
        return "\n".join(results)

    elif tool_name == "write_file":
        file_path = tool_input.get("file_path", "")
        content = tool_input.get("content", "")
        out_path = workspace / "output" / file_path
        _validate_path(out_path, workspace)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(content)
        return f"Written: output/{file_path} ({len(content)} chars)"

    elif tool_name == "run_command":
        cmd = tool_input.get("command", "")
        timeout = tool_input.get("timeout_seconds", 10)

        # Validate against allowlist
        if not any(cmd.strip().startswith(a) for a in ALLOWED_COMMANDS):
            return f"ERROR: Command not in allowlist. Allowed: {', '.join(ALLOWED_COMMANDS[:5])}..."

        try:
            result = subprocess.run(
                cmd, shell=True, capture_output=True, text=True,
                cwd=str(workspace), timeout=min(timeout, 30)
            )
            output = (result.stdout + result.stderr).strip()
            if len(output) > 10000:
                output = output[:10000] + "\n... [TRUNCATED]"
            return output if output else "(no output)"
        except subprocess.TimeoutExpired:
            return f"ERROR: Command timed out after {timeout}s"
        except Exception as e:
            return f"ERROR: {str(e)}"

    elif tool_name == "infer_architecture":
        resources_list = tool_input.get("resources", [])
        relationships = tool_input.get("relationships", [])

        summary = {
            "total_resources": len(resources_list),
            "resource_types": {},
            "relationships_count": len(relationships),
            "inferred_architecture": "N-Tier" if len(resources_list) > 5 else "Simple",
        }

        for res in resources_list:
            rtype = res.get("type", "unknown")
            summary["resource_types"][rtype] = summary["resource_types"].get(rtype, 0) + 1

        return json.dumps(summary, indent=2)

    elif tool_name == "save_artifact":
        artifact_name = tool_input.get("artifact_name", "artifact.txt")
        artifact_type = tool_input.get("artifact_type", "report")
        content = tool_input.get("content", "")

        out_dir = workspace / "output" / "artifacts"
        out_dir.mkdir(parents=True, exist_ok=True)
        artifact_path = out_dir / artifact_name
        _validate_path(artifact_path, workspace)
        artifact_path.write_text(content)
        return f"Artifact saved: output/artifacts/{artifact_name} ({artifact_type}, {len(content)} chars)"

    elif tool_name == "task_complete":
        raise TaskCompleteSignal(tool_input)

    else:
        return f"ERROR: Unknown tool: {tool_name}"


# ════════════════════════════════════════════════════════════════════════════
# AUTONOMOUS AGENT
# ════════════════════════════════════════════════════════════════════════════

class AutonomousAgent:
    """
    Agentic Claude loop that autonomously analyzes infrastructure files
    in a sandboxed workspace using tool_use.
    """

    MAX_ITERATIONS = 25

    SYSTEM_PROMPT = """You are an autonomous infrastructure analysis agent.
You have been given access to a workspace containing uploaded infrastructure files.

Your mission:
1. Start by listing all files in the workspace to understand the project structure
2. Read key configuration files to understand the infrastructure (Terraform .tf, YAML, JSON, Dockerfiles, etc.)
3. Search for patterns to identify all cloud resources, services, and dependencies
4. Infer the complete system architecture from what you discover
5. Write processed outputs: cleaned configs, resource inventory, architecture summary
6. Save all artifacts to the output directory
7. When fully done, call task_complete with your summary

Be thorough. Read every relevant file. Save everything you discover.
Do not ask for permission. Do not wait for human input. Just work autonomously.
Focus on: GCP/AWS resources, Terraform configs, Docker services, database configs, networking."""

    def __init__(self) -> None:
        self._bedrock_client = None

    def _get_bedrock_client(self):
        if self._bedrock_client is None:
            self._bedrock_client = boto3.client(
                'bedrock-runtime',
                region_name=os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
            )
        return self._bedrock_client

    async def setup_workspace(self, file_content: bytes, filename: str, session_id: str) -> Path:
        """
        Set up an isolated workspace directory.
        Extracts ZIP files or saves single files.
        """
        workspace = Path(tempfile.gettempdir()) / "aegis_workspace" / session_id
        workspace.mkdir(parents=True, exist_ok=True)

        if filename.endswith('.zip'):
            try:
                with zipfile.ZipFile(io.BytesIO(file_content)) as zf:
                    zf.extractall(workspace)
                logger.info(f"Extracted ZIP to workspace: {workspace}")
            except zipfile.BadZipFile:
                # Save as single file
                (workspace / filename).write_bytes(file_content)
        else:
            (workspace / filename).write_bytes(file_content)

        # Create output directory
        (workspace / "output").mkdir(exist_ok=True)
        (workspace / "output" / "artifacts").mkdir(exist_ok=True)

        return workspace

    async def run(self, workspace: Path, session_id: str,
                  on_update: Optional[Callable[[dict], Awaitable[None]]] = None) -> WorkspaceReport:
        """
        Agentic loop: sends system prompt, processes tool_use calls,
        repeats until task_complete or MAX_ITERATIONS.
        """
        messages: list[dict] = [
            {"role": "user", "content": "Begin autonomous analysis. Workspace is ready. Start by listing all files."}
        ]

        execution_log: list[dict] = []
        artifacts_saved: list[str] = []
        files_discovered: list[str] = []
        files_processed = 0
        iteration = 0

        # Convert tool definitions for Bedrock Converse API format
        bedrock_tools = []
        for tool in TOOL_DEFINITIONS:
            bedrock_tools.append({
                "toolSpec": {
                    "name": tool["name"],
                    "description": tool["description"],
                    "inputSchema": {
                        "json": tool["input_schema"]
                    }
                }
            })

        try:
            client = self._get_bedrock_client()
        except Exception as e:
            return WorkspaceReport(
                session_id=session_id,
                status="FAILED",
                error_message=f"Could not initialize Bedrock client: {str(e)}",
            )

        while iteration < self.MAX_ITERATIONS:
            iteration += 1
            timestamp = datetime.utcnow().isoformat()

            if on_update:
                await on_update({
                    "type": "iteration_start",
                    "iteration": iteration,
                    "max_iterations": self.MAX_ITERATIONS,
                })

            try:
                response = client.converse(
                    modelId=os.getenv('BEDROCK_MODEL_ID', 'anthropic.claude-3-5-sonnet-20241022-v2:0'),
                    system=[{"text": self.SYSTEM_PROMPT}],
                    messages=messages,
                    toolConfig={"tools": bedrock_tools},
                )
            except (ClientError, BotoCoreError) as e:
                logger.error(f"Bedrock call failed at iteration {iteration}: {e}")
                if on_update:
                    await on_update({"type": "error", "message": str(e)})
                break
            except Exception as e:
                logger.error(f"Unexpected error at iteration {iteration}: {e}")
                break

            stop_reason = response.get("stopReason", "end_turn")
            output_message = response.get("output", {}).get("message", {})
            content_blocks = output_message.get("content", [])

            # Append assistant message to conversation
            messages.append({"role": "assistant", "content": content_blocks})

            tool_results = []

            for block in content_blocks:
                if "text" in block:
                    if on_update:
                        await on_update({
                            "type": "thought",
                            "content": block["text"][:2000],
                            "iteration": iteration,
                        })

                elif "toolUse" in block:
                    tool_use = block["toolUse"]
                    tool_name = tool_use["name"]
                    tool_input = tool_use.get("input", {})
                    tool_use_id = tool_use["toolUseId"]

                    if on_update:
                        await on_update({
                            "type": "tool_call",
                            "tool": tool_name,
                            "input": {k: str(v)[:200] for k, v in tool_input.items()},
                            "iteration": iteration,
                        })

                    try:
                        result = await execute_tool(tool_name, tool_input, workspace)

                        # Track file operations
                        if tool_name == "list_files":
                            for line in result.split("\n"):
                                line = line.strip()
                                if line and not line.startswith("...") and not line.startswith("No files"):
                                    files_discovered.append(line)
                        elif tool_name == "read_file":
                            files_processed += 1
                        elif tool_name == "save_artifact":
                            artifacts_saved.append(tool_input.get("artifact_name", "unknown"))

                    except TaskCompleteSignal as tcs:
                        if on_update:
                            await on_update({
                                "type": "complete",
                                "summary": tcs.data.get("summary", "Task complete"),
                                "iteration": iteration,
                            })

                        return self._build_report(
                            workspace, session_id, tcs.data,
                            files_discovered, files_processed,
                            artifacts_saved, execution_log, iteration
                        )
                    except Exception as ex:
                        result = f"ERROR: {str(ex)}"

                    truncated_result = str(result)[:2000]
                    if on_update:
                        await on_update({
                            "type": "tool_result",
                            "tool": tool_name,
                            "result": truncated_result[:500],
                            "iteration": iteration,
                        })

                    execution_log.append({
                        "iteration": iteration,
                        "tool": tool_name,
                        "input": {k: str(v)[:200] for k, v in tool_input.items()},
                        "result": truncated_result,
                        "ts": timestamp,
                    })

                    tool_results.append({
                        "toolResult": {
                            "toolUseId": tool_use_id,
                            "content": [{"text": str(result)[:10000]}]
                        }
                    })

            # If there were tool uses, send results back
            if tool_results:
                messages.append({"role": "user", "content": tool_results})
            elif stop_reason == "end_turn":
                # Agent finished without calling task_complete
                break

        # Build final report
        return self._build_report(
            workspace, session_id, {},
            files_discovered, files_processed,
            artifacts_saved, execution_log, iteration
        )

    def _build_report(self, workspace: Path, session_id: str,
                      completion_data: dict,
                      files_discovered: list[str], files_processed: int,
                      artifacts_saved: list[str], execution_log: list[dict],
                      total_iterations: int) -> WorkspaceReport:
        """Build the final WorkspaceReport."""

        # Detect resource types from discovered files
        resource_inventory: dict[str, int] = {}
        inferred_stack: list[str] = []

        ext_map = {
            ".tf": "Terraform", ".yaml": "YAML Config", ".yml": "YAML Config",
            ".json": "JSON Config", ".py": "Python", ".sh": "Shell Script",
            ".dockerfile": "Docker", ".env": "Environment", ".js": "JavaScript",
            ".ts": "TypeScript",
        }

        for f in files_discovered:
            for ext, label in ext_map.items():
                if f.lower().endswith(ext):
                    resource_inventory[label] = resource_inventory.get(label, 0) + 1
                    if label not in inferred_stack:
                        inferred_stack.append(label)

        # Check for specific files
        file_names_lower = [f.lower() for f in files_discovered]
        if any("docker" in f for f in file_names_lower):
            if "Docker" not in inferred_stack:
                inferred_stack.append("Docker")
        if any("kubernetes" in f or "k8s" in f for f in file_names_lower):
            inferred_stack.append("Kubernetes")
        if any("package.json" in f for f in file_names_lower):
            if "Node.js" not in inferred_stack:
                inferred_stack.append("Node.js")

        # Create ZIP of outputs
        output_zip_path = ""
        output_dir = workspace / "output"
        if output_dir.exists() and any(output_dir.rglob("*")):
            zip_path = workspace / f"aegis_output_{session_id[:8]}.zip"
            try:
                with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                    for file_path in output_dir.rglob("*"):
                        if file_path.is_file():
                            arcname = file_path.relative_to(output_dir)
                            zf.write(file_path, arcname)
                output_zip_path = str(zip_path)
            except Exception as e:
                logger.warning(f"Failed to create output ZIP: {e}")

        status = "COMPLETE"
        if total_iterations >= self.MAX_ITERATIONS:
            status = "MAX_ITER_REACHED"

        return WorkspaceReport(
            session_id=session_id,
            files_discovered=files_discovered[:500],
            files_processed=files_processed,
            artifacts_saved=artifacts_saved,
            resource_inventory=resource_inventory,
            architecture_summary=completion_data.get("summary", "Analysis complete"),
            inferred_stack=inferred_stack,
            output_zip_path=output_zip_path,
            execution_log=execution_log,
            total_iterations=total_iterations,
            status=status,
        )

    async def cleanup_workspace(self, session_id: str) -> None:
        """Remove workspace directory after download."""
        workspace = Path(tempfile.gettempdir()) / "aegis_workspace" / session_id
        if workspace.exists():
            shutil.rmtree(workspace, ignore_errors=True)
            logger.info(f"Cleaned up workspace: {session_id}")
