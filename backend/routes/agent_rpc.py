"""Auto-extracted route module from main.py — zero behavior change."""
import sys
import traceback
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

import services as state
from agent_rpc_handler import AgentRpcHandler
from deps import (
    DEFAULT_USER_ID,
)

router = APIRouter()

# ── JSON-RPC 2.0 Agent Integration ─────────────────────────────────────
# Enables AI agents to create projects, fetch data, etc. via standardized RPC calls.

@router.post("/api/agent/rpc")
async def agent_rpc(
    request_body: dict,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
):
    """
    JSON-RPC 2.0 endpoint for agent method calls.
    
    Supported methods:
    - create_project: Create a new project with name and description
    - get_project: Retrieve a project by ID
    - list_projects: Get all projects for the user
    
    Example request:
    {
      "jsonrpc": "2.0",
      "method": "create_project",
      "params": {
        "name": "My Project",
        "description": "Project description"
      },
      "id": "request-123"
    }
    """
    try:
        # Get or validate user ID
        user_id = x_user_id or DEFAULT_USER_ID
        
        # Validate UUID format
        import re
        uuid_regex = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        if not re.match(uuid_regex, user_id, re.IGNORECASE):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid user ID format: {user_id}"
            )
        
        # Initialize RPC handler with projects API
        rpc_handler = AgentRpcHandler(projects_api=state.projects_api)
        
        # Process the RPC request
        response = rpc_handler.handle_request(request_body, user_id)
        
        return response
        
    except ValueError as e:
        print(f"❌ [Agent RPC] Validation error: {e!s}", file=sys.stderr)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ [Agent RPC] Error: {e!s}", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        raise HTTPException(status_code=500, detail=str(e))


