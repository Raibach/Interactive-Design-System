> **SUPERSEDED — read `figma-ingest-plugin.md` instead.** This was the original
> design. Three things in it are not what was built: ingest writes nothing (drafts
> only, approval is the one write), commit takes a jobId rather than code and a
> file path from the browser, and the component is built by the application's own
> assembly model from both Figma channels, not by a queue of template mappers.

Figma Ingest Pipeline — Implementation Plan (Queue-Based)

Overview
Build a queue-based "Paste Figma URLs → Get Lit Components" feature. User pastes multiple URLs rapidly (Enter to add), each fires independently to backend, status dots show progress in real-time.

What Happens When User Hits Add

User pastes URL + notes → hits Enter
         ↓
IngestQueue adds item to local queue (status: "queued")
         ↓
Fire-and-forget POST /api/figma/ingest { jobId, fileKey, nodeId, notes }
         ↓
Backend processes in order:
  1. GET figma.com/api/v1/files/{fileKey}/nodes?ids={nodeId}
     → raw JSON node tree (geometry, fills, strokes, layout, annotations)
  2. CALL Figma MCP (if available) → get_design_context
     → rendered reference code + annotations (richer behavioral spec)
  3. MERGE MCP + REST data
     → complete design spec: geometry + annotations + reference code
  4. Runs mapFigmaNodeToLit(node, mcpContext)
     → produces .ts file contents string
  5. Writes to src/components/lit/f-1234-5678.ts
     → file exists on disk
  6. Runs npx cem analyze
     → custom-elements.json updates
  7. Updates job status = "done", result = { tag: "f-1234-5678" }
         ↓
Frontend polls GET /api/figma/ingest/:jobId every 2s
         ↓
Status dot: gray → blue(pulse) → green (with tag code)
         ↓
Done. Component exists in catalog, importable.

Frontend (Steps 1–4) — Ready to Execute
1. IngestQueue Component (REPLACES IngestModal)
File: frontend/src/components/IngestQueue.tsx (NEW)

Single URL input + "Add" button + optional notes field
Enter key = add to queue (no form submit)
Queue list below with status dots: queued(gray) → processing(blue pulse) → green(done, shows tag) → red(error)
Footer shows counts: "3 done · 2 in progress"
Polls GET /api/figma/ingest/:jobId every 2s for active items
Esc/backdrop closes, queue persists in component state
2. Figma URL Parser Utility
File: frontend/src/utils/figmaUrl.ts (NEW)

typescript
parseFigmaUrl(url: string): { fileKey: string; nodeId?: string }
Extracts file key from /file/:key or /design/:key
Converts hyphen→colon in node-id for API (1234-5678 → 1234:5678)
3. Add Menu Item to LeftVerticalMenu
File: frontend/src/components/LeftVerticalMenu.tsx (MODIFY existing)

Location: Add to menuItems array (around line 220-248)
Add "Ingest Design" with import/download icon
Add ingestOpen state + render <IngestQueue />
Uses existing apiFetch helper (line 97-108) with X-User-ID header
4. Queue Item Submission
Inside IngestQueue component:

typescript
const addToQueue = async () => {
  const item: QueueItem = { id: crypto.randomUUID(), url, notes, status: "queued" };
  setQueue(prev => [...prev, item]);
  setUrl(""); setNotes(""); // immediately ready for next

  const { fileKey, nodeId } = parseFigmaUrl(url);
  await apiFetch("/api/figma/ingest", {
    method: "POST",
    body: JSON.stringify({ jobId: item.id, fileKey, nodeId, notes })
  });
  setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "processing" } : q));
};
Backend (Steps 5–9) — Implementation with MCP + REST Hybrid
5. Fix Mapper (Tag Naming) — ALIGN TO CODEBASE
File: backend/mapper/figma-to-lit.ts (NEW — drop provided mapper here)

Critical change: Replace toKebab(name) with idToTag(nodeId) → f-1234-5678
Rule: f-${id.replace(":", "-")} — satisfies HTML custom element constraints
Accept optional mcpContext parameter for enriched mapping
Import in worker: import { mapFigmaNodeToLit, litComponentToTs } from './mapper/figma-to-lit'
6. POST /api/figma/ingest Endpoint
File: backend/routes/figma.py (extend existing)

python
@app.post("/api/figma/ingest")
async def create_ingest_job(jobId: str, fileKey: str, nodeId: str, notes: str):
    # Store job in memory/DB with status "processing"
    jobs[jobId] = { 
        "status": "processing", 
        "fileKey": fileKey, 
        "nodeId": nodeId,
        "mcp_status": "pending",
        "rest_status": "pending"
    }
    
    # Process synchronously (sequential queue)
    result = await process_figma_node(jobId, fileKey, nodeId)
    
    # Update job status
    jobs[jobId] = { "status": "done", "result": { "tag": result.tag } }
    return { "ok": true, "jobId" }
7. Background Worker (Hybrid MCP + REST Pipeline)
Worker function:

python
async def process_figma_node(job_id: str, file_key: str, node_id: str):
    # ── Step 1: Fetch via REST API (always available on server) ──
    try:
        rest_response = await fetch_figma_rest(file_key, node_id)
        jobs[job_id]["rest_status"] = "success"
    except Exception as e:
        jobs[job_id]["rest_status"] = f"error: {e}"
        raise
    
    # ── Step 2: Fetch via MCP (desktop only, may fail on server) ──
    mcp_context = None
    try:
        mcp_context = await fetch_figma_mcp(file_key, node_id)
        jobs[job_id]["mcp_status"] = "success"
    except Exception as e:
        jobs[job_id]["mcp_status"] = f"unavailable: {e}"
        # MCP is optional on server — continue with REST only
    
    # ── Step 3: Merge data ──
    merged = merge_mcp_rest(mcp_context, rest_response)
    
    # ── Step 4: Pass 1 — Components (from restResponse.components) ──
    for component_id, meta in rest_response.get("components", {}).items():
        node = rest_response["nodes"][component_id]["document"]
        component = mapFigmaNodeToLit(node, mcp_context)
        write_ts_file(f"src/components/lit/f-{component_id.replace(':', '-')}.ts", component)
    
    # ── Step 5: Pass 2 — Target Frame ──
    frame_node = rest_response["nodes"][node_id]["document"]
    component = mapFigmaNodeToLit(frame_node, mcp_context)
    write_ts_file(f"src/components/lit/f-{node_id.replace(':', '-')}.ts", component)
    
    # ── Step 6: Run npx cem analyze ──
    subprocess.run(["npx", "cem", "analyze"], cwd="frontend", check=True)
    
    return { "tag": f"f-{node_id.replace(':', '-')}" }

Helper functions:
- fetch_figma_rest(file_key, node_id): GET /v1/files/{key}/nodes?ids={id} with FIGMA_TOKEN
- fetch_figma_mcp(file_key, node_id): JSON-RPC to MCP server (initialize → tools/call get_design_context)
- merge_mcp_rest(mcp_context, rest_response): Combine MCP's reference code + REST's geometry
8. GET /api/figma/ingest/:jobId Status Endpoint

python
@app.get("/api/figma/ingest/{job_id}")
async def get_job_status(job_id: str):
    job = jobs.get(job_id, { "status": "not_found" })
    return {
        "jobId": job_id,
        "status": job.get("status"),
        "mcp_status": job.get("mcp_status"),
        "rest_status": job.get("rest_status"),
        "result": job.get("result"),
        "error": job.get("error"),
    }
9. Breaking Change Detection

typescript
const currentIds = Object.keys(restResponse.components);
const cachedIds = loadCachedComponentIds();
const removed = cachedIds.filter(id => !currentIds.includes(id));
if (removed.length) warn("Components deleted — manual re-link needed:", removed);

Codebase Alignment References
Component	Existing Code Reference
Auth header	LeftVerticalMenu.tsx:97-108 — apiFetch with X-User-ID
Menu structure	LeftVerticalMenu.tsx:220-248 — menuItems array
Modal pattern	LeftVerticalMenu.tsx:580-580 — mobile drawer modal
Figma config	LeftVerticalMenu.tsx:168-182 — fetches /figma/config, /figma/file
Event dispatch	LeftVerticalMenu.tsx:412-416 — prompt-session-loaded pattern
Toast/notify	App.tsx:31-45 — Sonner toaster configured
Figma MCP	figma_mcp.py — call_design_context(), run_tool_calls()
Figma REST	figma_service.py — get_node(), get_cached_spec(), extract_node_spec()

Key Constraints (Non-Negotiable)
Rule	Value
Tag format	f-{figmaIdWithColonAsHyphen} (e.g., f-1234-5678)
No semantic names	Tag = ID transform only
Shared components	One .ts per componentId, instances reference tag
Updates	Re-pull → overwrite file → cem analyze
Breaking	Delete+recreate = new ID → warn, don't crash
MCP fallback	Server deployment: MCP unavailable → REST only (no failure)
MCP priority	If both succeed, MCP annotations + reference code enrich mapping

Execution Order
Phase A (Frontend — COMPLETED):
- Write frontend/src/components/IngestQueue.tsx ✅
- Write frontend/src/utils/figmaUrl.ts ✅
- Modify frontend/src/components/LeftVerticalMenu.tsx (menu item + queue modal) ✅

Phase B (Backend — IN PROGRESS):
4. Add backend/mapper/figma-to-lit.ts (with tag fix) ✅
5. Add POST /api/figma/ingest + GET /api/figma/ingest/:jobId endpoints ✅
6. Implement processing logic (REST-only two-pass + cem analyze) ✅
7. Add job status storage (in-memory dict) ✅

Phase C (MCP Integration — NEXT):
8. Add MCP client to backend (fetch_figma_mcp using figma_mcp.py patterns)
9. Update _process_ingest_job to call both MCP + REST
10. Implement merge_mcp_rest(mcp_context, rest_response)
11. Update mapper to accept optional mcpContext
12. Update job status tracking (mcp_status, rest_status)
13. Update frontend polling to show combined status