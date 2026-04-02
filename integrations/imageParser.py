"""
╔════════════════════════════════════════════════════════════════╗
║         INTEGRATION: Image Parser                            ║
║         Converts uploaded architecture images to Base64       ║
║         for NVIDIA Vision model consumption                   ║
╚════════════════════════════════════════════════════════════════╝
"""

import os
import uuid
import base64
import logging
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import UploadFile

logger = logging.getLogger(__name__)

# Temp directory for image storage
TEMP_DIR = Path(tempfile.gettempdir()) / "aegis_omni"
TEMP_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp"}
MAX_IMAGE_SIZE_MB = 20


async def save_temp_image(upload_file: UploadFile) -> str:
    """
    Securely save uploaded architecture image to a temporary path.
    
    Returns:
        str: Absolute path to the saved temporary image file.
    
    Raises:
        ValueError: If the file extension is not allowed or file is too large.
    """
    filename = upload_file.filename or "unknown.png"
    ext = Path(filename).suffix.lower()

    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValueError(
            f"Unsupported image type '{ext}'. "
            f"Allowed: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
        )

    # Generate a unique filename to prevent collisions
    unique_name = f"aegis_arch_{uuid.uuid4().hex[:12]}{ext}"
    temp_path = str(TEMP_DIR / unique_name)

    # Read and validate size
    content = await upload_file.read()
    size_mb = len(content) / (1024 * 1024)

    if size_mb > MAX_IMAGE_SIZE_MB:
        raise ValueError(
            f"Image too large ({size_mb:.1f} MB). Maximum: {MAX_IMAGE_SIZE_MB} MB."
        )

    # Write to disk
    with open(temp_path, "wb") as f:
        f.write(content)

    logger.info(f"✅ Saved temp image: {unique_name} ({size_mb:.2f} MB)")
    return temp_path


def image_to_base64(image_path: str) -> str:
    """
    Read an image file and convert it to a Base64 data URI string
    suitable for the NVIDIA Vision API.
    
    Returns:
        str: Base64 data URI (e.g. "data:image/png;base64,iVBOR...")
    """
    ext = Path(image_path).suffix.lower()
    mime_map = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".bmp": "image/bmp",
        ".svg": "image/svg+xml",
    }
    mime_type = mime_map.get(ext, "image/png")

    with open(image_path, "rb") as f:
        raw_bytes = f.read()

    b64_str = base64.b64encode(raw_bytes).decode("utf-8")
    data_uri = f"data:{mime_type};base64,{b64_str}"

    logger.info(f"✅ Encoded image to Base64 ({len(b64_str)} chars, MIME: {mime_type})")
    return data_uri


def cleanup(file_path: Optional[str]) -> None:
    """
    Permanently delete a temporary file. Safe to call with None.
    """
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
            logger.info(f"🗑️  Cleaned up temp file: {Path(file_path).name}")
        except OSError as e:
            logger.warning(f"⚠️  Failed to cleanup {file_path}: {e}")
