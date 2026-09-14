"""Auto-extracted route module from main.py — zero behavior change."""
import asyncio
import json
import os
import sys
import time
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Header, HTTPException, Query, Request, UploadFile
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

import services as state
from deps import (
    DEFAULT_USER_ID, REASONING_TRACE_PATH, A2UI_CATALOG_ID,
    a2ui_catalog, validate_a2ui_components, user_is_admin,
    get_user_id_from_header,
)
from grace_gui import (
    evaluate_source, query_llm, retrieve_memory_context, search_news,
    summarize_pdfs, milvus_save_version, milvus_get_versions,
)
from agent_rpc_handler import AgentRpcHandler
from figma_service import (
    get_file, get_file_versions, get_component, get_node,
    get_dev_resources, search_file,
)
from milvus_rest import MilvusREST
# The write a repair performs, and the read that makes it possible. Kept in its
# own small module because it is the only code in this project that overwrites
# source, and because /api/files/write below cannot do it: that endpoint allows
# only .md/.mdx under three documentation directories, so no component could ever
# be corrected by any path in the app (see repair_apply's docstring).
from repair_apply import Refused, apply_repair, read_source, rerun_catalog_check

router = APIRouter()

# ── Where "the project" is, for the paths in this module ───────────────────────
#
# These handlers were extracted out of main.py, which sat at backend/ — and every
# path in them was written relative to THAT: os.path.join(dirname(__file__), "..").
# Here dirname(__file__) is backend/routes, so ".." is backend/, and every path
# resolved one level too deep: 'frontend/src/prompts' became
# backend/frontend/src/prompts. The read and write handlers therefore could only
# ever see files under backend/ — every request for a real document was a 403 or a
# 404, and a write would have created a stray file inside backend/. One constant
# fixes all eight of them, and names the thing they all meant.
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# Secrets are not documents. With the base above corrected, these handlers reach
# the whole project — which is what they were written for — and `path=.env` would
# return the API keys to anyone who can reach the port (this route carries no
# authentication; it only reads an X-User-ID header). Nothing legitimate asks for a
# dotfile or a key through a documentation endpoint, so they are refused outright.
_SECRET_SUFFIXES = (".pem", ".key", ".p12", ".pfx", ".crt")


def _is_not_a_document(rel_path: str) -> bool:
    """True for anything that is configuration or a credential, not a document."""
    parts = rel_path.replace("\\", "/").split("/")
    return (
        any(p.startswith(".") and p not in (".", "..") for p in parts)
        or any(p.endswith(_SECRET_SUFFIXES) for p in parts)
    )

# ============================================
# FILE OPERATIONS ENDPOINTS (for DocumentationQueryTool)
# ============================================

class FileReadRequest(BaseModel):
    path: str

class FileWriteRequest(BaseModel):
    path: str
    content: str

@router.get("/api/files/read")
async def read_file(
    path: str = Query(..., description="File path to read"),
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """Read a documentation file - restricted to specific directories"""
    try:
        if _is_not_a_document(path):
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: '{path}' is configuration or a credential, not a document",
            )
        # Security: Only allow reading from specific directories
        allowed_dirs = [
            "frontend/src/storybook",
            "frontend/src/prompts",
            "phases-markdown",
            ".",  # Root level markdown files
        ]

        # Check if the path is within allowed directories
        is_allowed = False
        for allowed_dir in allowed_dirs:
            full_allowed_path = os.path.abspath(os.path.join(_REPO_ROOT, allowed_dir))
            full_requested_path = os.path.abspath(os.path.join(_REPO_ROOT, path))
            if full_requested_path.startswith(full_allowed_path):
                is_allowed = True
                break

        if not is_allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: Path '{path}' is not in allowed directories"
            )

        # Construct the full path
        file_path = os.path.join(_REPO_ROOT, path)

        # Check if file exists
        if not os.path.isfile(file_path):
            raise HTTPException(
                status_code=404,
                detail=f"File not found: {path}"
            )

        # Read the file
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        print(f"✅ [File API] Read file: {path} ({len(content)} bytes)")

        return {
            "path": path,
            "content": content,
            "size": len(content),
            "exists": True
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [File API] Error reading file: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error reading file: {str(e)}"
        )

@router.post("/api/files/write")
async def write_file(
    request: FileWriteRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """Write/update a documentation file - restricted to specific directories"""
    try:
        if _is_not_a_document(request.path):
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Access denied: '{request.path}' is configuration or a credential, "
                    "not a document"
                ),
            )
        # Security: Only allow writing to specific directories
        allowed_dirs = [
            "frontend/src/storybook",
            "frontend/src/prompts",
            "phases-markdown",
            ".",  # Root level markdown files (only .md files)
        ]

        # Check if the path is within allowed directories
        is_allowed = False
        for allowed_dir in allowed_dirs:
            full_allowed_path = os.path.abspath(os.path.join(_REPO_ROOT, allowed_dir))
            full_requested_path = os.path.abspath(os.path.join(_REPO_ROOT, request.path))
            if full_requested_path.startswith(full_allowed_path):
                # Additional check: only allow .md, .mdx, and .stories.mdx files
                if request.path.endswith(('.md', '.mdx', '.stories.mdx')):
                    is_allowed = True
                break

        if not is_allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: Cannot write to '{request.path}'"
            )

        # Construct the full path
        file_path = os.path.join(_REPO_ROOT, request.path)

        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(file_path), exist_ok=True)

        # Backup existing file if it exists
        backup_path = None
        if os.path.isfile(file_path):
            backup_path = f"{file_path}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            with open(file_path, 'r', encoding='utf-8') as f:
                backup_content = f.read()
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(backup_content)

        # Write the new content
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(request.content)

        print(f"✅ [File API] Wrote file: {request.path} ({len(request.content)} bytes)")
        if backup_path:
            print(f"   Backup saved to: {os.path.basename(backup_path)}")

        return {
            "path": request.path,
            "success": True,
            "size": len(request.content),
            "backup": os.path.basename(backup_path) if backup_path else None
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [File API] Error writing file: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error writing file: {str(e)}"
        )

@router.get("/api/files/list")
async def list_files(
    directory: str = Query(".", description="Directory to list files from"),
    pattern: str = Query("*.md", description="File pattern to match"),
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """List documentation files in allowed directories"""
    try:
        import glob

        # Security: Only allow listing from specific directories
        allowed_dirs = [
            "frontend/src/storybook",
            "frontend/src/prompts",
            "phases-markdown",
            ".",  # Root level markdown files
        ]

        files = []
        for allowed_dir in allowed_dirs:
            dir_path = os.path.join(_REPO_ROOT, allowed_dir)
            if os.path.isdir(dir_path):
                # Find all matching files
                search_pattern = os.path.join(dir_path, "**", pattern)
                matched_files = glob.glob(search_pattern, recursive=True)

                # Convert to relative paths
                for file_path in matched_files:
                    rel_path = os.path.relpath(file_path, _REPO_ROOT)
                    files.append(rel_path)

        print(f"✅ [File API] Listed {len(files)} files matching '{pattern}'")

        return {
            "files": sorted(files),
            "count": len(files),
            "pattern": pattern
        }

    except Exception as e:
        print(f"❌ [File API] Error listing files: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error listing files: {str(e)}"
        )


# ============================================
# REPAIR ENDPOINTS — the write a repair performs
# ============================================
#
# A repair used to be a description: the run answered with text saying what to
# change, and nothing in the app could put that text into a file — the only tool a
# run may execute is a Figma read, and /api/files/write allows only documentation
# files. So a component could not be corrected anywhere in this codebase, and an
# answer that said "Correction applied" was describing a write that never
# happened. These two endpoints are that missing half:
#
#   GET  /api/repair/read   the file as it is now, so the prompt can carry it and
#                           the model can hand back the whole corrected file;
#   POST /api/repair/apply  writes that file back, with a backup, refusing
#                           anything that does not look like a complete file.
#
# Both are restricted to the app's own source by repair_apply.target_path, which
# is the only place that decides what a repair may touch.

class RepairApplyRequest(BaseModel):
    path: str
    content: str


@router.get("/api/repair/read")
async def repair_read(
    path: str = Query(..., description="The app source file a repair is about"),
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """The file a repair is about, as it is now. Read half of the apply pair."""
    try:
        return read_source(path)
    except Refused as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        print(f"❌ [Repair] Error reading {path}: {e}")
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")


@router.post("/api/repair/apply")
async def repair_apply_endpoint(
    request: RepairApplyRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """Write a corrected file over its current version, keeping a backup.

    Returns what happened (path, size, backup, line counts) so the caller can SAY
    it in the chat rather than assert it. Anything that cannot be applied comes
    back as 403 with `detail` written as a sentence a person can read — that
    sentence is what the chat shows, so a refusal costs a sentence, never a file.

    The check is re-run BEFORE the response, on purpose: the report the app reads
    is a file the checker writes, so without this the verdict after a repair is
    read off a report that predates the change (see rerun_catalog_check).
    """
    try:
        result = apply_repair(request.path, request.content)
        print(
            f"✅ [Repair] Applied to {result['path']}: "
            f"{result['lines_before']} -> {result['lines_after']} lines "
            f"(backup {result['backup']})"
        )
        check = await asyncio.to_thread(rerun_catalog_check)
        if check.get("ran"):
            print(f"🔎 [Repair] re-checked: {check.get('verdict')}")
        else:
            print(f"⚠️  [Repair] the check did not run: {check.get('why')}")
        return {"ok": True, **result, "check": check}
    except Refused as e:
        print(f"⚠️  [Repair] Not applied to {request.path}: {e}")
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        print(f"❌ [Repair] Error applying to {request.path}: {e}")
        raise HTTPException(status_code=500, detail=f"Error applying the change: {str(e)}")



