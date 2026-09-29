"""Auto-extracted route module from main.py — zero behavior change."""

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

import services as state
from deps import (
    get_user_id_from_header,
)

router = APIRouter()

# ============================================
# PROJECTS ENDPOINTS
# ============================================


class CreateProjectRequest(BaseModel):
    name: str
    description: str | None = None


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    is_archived: bool | None = None


@router.get("/api/projects")
async def get_projects(
    include_archived: bool = Query(False),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Get all projects for a user"""
    if not state.projects_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        projects = state.projects_api.get_all_projects(uid, include_archived=include_archived)
        return {"projects": projects}
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = f"Error loading projects: {e!s}\n{traceback.format_exc()}"
        print(f"❌ Projects API error: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Error loading projects: {e!s}")


@router.get("/api/projects/{project_id}")
async def get_project(
    project_id: str, x_user_id: str | None = Header(None, alias="X-User-ID")
):
    """Get a specific project by ID"""
    if not state.projects_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        project = state.projects_api.get_project(project_id, uid)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = f"Error loading project: {e!s}\n{traceback.format_exc()}"
        print(f"❌ Project API error: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Error loading project: {e!s}")


@router.post("/api/projects")
async def create_project(
    request: CreateProjectRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Create a new project"""
    if not state.projects_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        project_id = state.projects_api.create_project(
            uid, name=request.name, description=request.description
        )
        return {"id": project_id, "success": True}
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = f"Error creating project: {e!s}\n{traceback.format_exc()}"
        print(f"❌ Create project error: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Error creating project: {e!s}")


@router.put("/api/projects/{project_id}")
async def update_project(
    project_id: str,
    request: UpdateProjectRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Update a project"""
    if not state.projects_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        success = state.projects_api.update_project(
            project_id,
            uid,
            name=request.name,
            description=request.description,
            is_archived=request.is_archived,
        )
        if not success:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"success": True}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = f"Error updating project: {e!s}\n{traceback.format_exc()}"
        print(f"❌ Update project error: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Error updating project: {e!s}")


@router.delete("/api/projects/{project_id}")
async def delete_project(
    project_id: str, x_user_id: str | None = Header(None, alias="X-User-ID")
):
    """Delete a project (soft delete by archiving)"""
    if not state.projects_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        success = state.projects_api.delete_project(project_id, uid)
        if not success:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"success": True}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = f"Error deleting project: {e!s}\n{traceback.format_exc()}"
        print(f"❌ Delete project error: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Error deleting project: {e!s}")


