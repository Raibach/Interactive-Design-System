"""figma-intake — paste a Figma link, the file goes to the local model untouched.

WHY THIS EXISTS, in the owner's words, 2026-09-20: "an interface to give the model Figma —
maybe just a little text box with a submit button just so I can hand the model the Figma file
and it can compile it then hand it to [me]."

THE POINT IS WHAT THIS FILE DOES NOT DO. Every earlier route through this repository put an
agent between the designer and the model: the agent chose which node to send, decided which
fields to keep, wrote the prompt, and then read the reply — so the model's answer was an
answer about the agent's summary, and the `line-height: auto` it produced was traced back to
a token the agent had failed to resolve. The designer's question was the right one: "is there
any way for me to get past you and send the file directly to the model?"

So here: the URL is the designer's, the node comes back from Figma whole, and it is posted to
the seat verbatim. Nothing is filtered, renamed, summarised or re-shaped. The prompt is read
from governance/SEAT.json rather than written here, so a person can read a minute of config
and see that nothing is being added. The reply is stored on its way past and handed on as-is.

Three routes:
    POST /api/governance/figma-intake   { url }        → the model's spec + the run record
    GET  /api/governance/figma-intake                  → the little text box
    GET  /api/governance/figma-intake/runs             → what has been handed over so far
"""
import json
import os
import re
import time
import urllib.request
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel

try:
    from figma_service import get_node
except Exception:  # pragma: no cover - import surface differs in some boots
    get_node = None

router = APIRouter()

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SEAT_PATH = os.path.join(REPO, "governance", "SEAT.json")
RUNS_DIR = os.path.join(REPO, "governance", "figma-intake")


def _seat():
    """The seat is declared in governance/SEAT.json — never guessed, never defaulted here."""
    try:
        with open(SEAT_PATH, "r", encoding="utf-8") as fh:
            seat = json.load(fh).get("seat") or {}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"governance/SEAT.json is unreadable: {exc}")
    if not seat.get("model"):
        raise HTTPException(status_code=503, detail="governance/SEAT.json declares no seat model")
    return seat


def _split_figma_url(url):
    """A Figma design link → (file_key, node_id). The designer pastes the link as Figma gives it."""
    m = re.search(r"figma\.com/(?:design|file)/([A-Za-z0-9]+)", url or "")
    if not m:
        raise HTTPException(status_code=400, detail="that is not a Figma design link")
    file_key = m.group(1)
    n = re.search(r"node-id=([0-9]+[-:][0-9]+)", url or "")
    if not n:
        raise HTTPException(status_code=400, detail="the link carries no node-id — open the layer in Figma and copy the link again")
    node_id = n.group(1).replace("-", ":")
    return file_key, node_id


def _ask_seat(node_document, seat):
    """Post the node to the seat's own server. The document goes as it came back from Figma."""
    base = (seat.get("url") or "").rstrip("/")
    if base.endswith("/v1"):
        base = base[:-3]
    body = json.dumps({
        "model": seat["model"],
        "system_prompt": seat["prompt"],
        "input": json.dumps(node_document),
        "max_output_tokens": int(seat.get("maxOutputTokens") or 8192),
    }).encode("utf-8")
    req = urllib.request.Request(
        base + "/api/v1/chat",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=1800) as res:
        return json.loads(res.read().decode("utf-8"))


class IntakeRequest(BaseModel):
    url: str


@router.post("/api/governance/figma-intake")
async def figma_intake(payload: IntakeRequest):
    """The designer's link in, the model's spec out. Nothing in between but the fetch."""
    if get_node is None:
        raise HTTPException(status_code=503, detail="the Figma service is not available in this process")
    seat = _seat()
    file_key, node_id = _split_figma_url(payload.url)

    # ── 1. THE FILE, WHOLE. The node comes back from Figma and is NOT filtered, renamed or
    #       re-shaped on its way to the model. Whatever the API returned is what is sent.
    try:
        node_document = get_node(file_key, node_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Figma did not return that node: {exc}")
    if not node_document:
        raise HTTPException(status_code=502, detail="Figma returned nothing for that node")

    # ── 2. THE MODEL, ASKED. The prompt lives in governance/SEAT.json so a person can read it
    #       and see that this route adds no requirement of its own.
    started = time.time()
    try:
        reply = _ask_seat(node_document, seat)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"the seat did not answer: {exc}")
    seconds = round(time.time() - started, 1)

    items = reply.get("output") or []
    messages = [o for o in items if isinstance(o, dict) and o.get("type") == "message" and o.get("content")]
    answer = "\n".join(str(o["content"]) for o in messages) if messages else None

    # ── 3. THE RECORD, ON ITS WAY PAST. What was handed over and what came back, kept so the
    #       handover can be read back later — and so a spec can be traced to the file it answered.
    os.makedirs(RUNS_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    record = {
        "at": datetime.now(timezone.utc).isoformat(),
        "url": payload.url,
        "fileKey": file_key,
        "nodeId": node_id,
        "model": seat["model"],
        "seconds": seconds,
        "answer": answer,
        "error": None if answer else "the model returned no message",
        "filenamesOfNothing": "the node is stored exactly as Figma returned it",
        "node": node_document,
    }
    out = os.path.join(RUNS_DIR, f"{node_id.replace(':', '-')}.{stamp}.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(record, fh, indent=1)

    return {
        "nodeId": node_id,
        "model": seat["model"],
        "seconds": seconds,
        "answer": answer,
        "record": os.path.relpath(out, REPO),
        "status": "REVIEWED" if answer else "NOT DONE",
    }


@router.post("/api/governance/figma-intake/node")
async def figma_intake_node(payload: IntakeRequest):
    """THE NODE, HANDED TO THE PAGE — so the PAGE can post it to the model itself.

    The owner, 2026-09-20: "I want the model injecting the content, not you."

    In this route's siblings the SERVER calls the model: my code builds the request, chooses the
    options, and reads the stream. This route exists so that none of that is true. It fetches the
    node from Figma and hands it to the browser as JSON. From there the browser posts it to the
    local model directly, and the model's tokens go straight into the page.

    What stays on this side, and why: THE FIGMA TOKEN. It is server config, and putting it in page
    JavaScript would expose it to anything that reads the page. So the fetch is here and the
    conversation is not — which is the split the page's own copy describes.
    """
    if get_node is None:
        raise HTTPException(status_code=503, detail="the Figma service is not available in this process")
    file_key, node_id = _split_figma_url(payload.url)
    try:
        node_document = get_node(file_key, node_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Figma did not return that node: {exc}")
    if not node_document:
        raise HTTPException(status_code=502, detail="Figma returned nothing for that node")
    text = json.dumps(node_document)
    return {
        "nodeId": node_id,
        "fileKey": file_key,
        "bytes": len(text),
        "node": text,
    }


@router.get("/api/governance/figma-intake/prompt")
async def figma_intake_prompt():
    """The seat's prompt, as a starting point for the page's box. The page is editable — this is
    only what the box is filled with on load, so the instruction is never a blank field."""
    return {"prompt": (_seat().get("prompt") or "")}


@router.get("/api/governance/seat")
async def governance_seat():
    """The seat as a page can read it: which model, and where. The prompt is NOT sent — the page
    carries its own box for that, so the instruction is the operator's and not this file's."""
    seat = _seat()
    base = (seat.get("url") or "").rstrip("/")
    return {
        "model": seat["model"],
        "chatUrl": base + "/api/v1/chat",
        "maxOutputTokens": int(seat.get("maxOutputTokens") or 8192),
        "promptLength": len(seat.get("prompt") or ""),
    }


@router.post("/api/governance/figma-intake/stream")
async def figma_intake_stream(payload: IntakeRequest):
    """THE HANDOVER, LIVE. The same call as /figma-intake, streamed as it happens.

    The owner, 2026-09-20: "wire up my page so that I can see the model's output at the exact
    moment you do — I want to print on this page everything it's handing you."

    So this route narrates the handover and does not end until the model has finished:
      · what was SENT — the prompt, and the node exactly as Figma returned it (whole, never
        summarised)
      · what CAME BACK — the model's own tokens, as they arrive, thinking kept apart from answer
      · what was STORED — the record path, on the way past
    Nothing here interprets anything. It is the pipe, made visible.
    """
    if get_node is None:
        raise HTTPException(status_code=503, detail="the Figma service is not available in this process")
    seat = _seat()
    file_key, node_id = _split_figma_url(payload.url)

    def line(obj):
        return f"data: {json.dumps(obj)}\n\n".encode("utf-8")

    async def pump():
        try:
            yield line({"phase": "figma", "text": f"reading node {node_id} from Figma…"})
            try:
                node_document = get_node(file_key, node_id)
            except Exception as exc:
                yield line({"phase": "error", "text": f"Figma did not return that node: {exc}"})
                return
            if not node_document:
                yield line({"phase": "error", "text": "Figma returned nothing for that node"})
                return

            node_text = json.dumps(node_document)
            yield line({
                "phase": "sent-node",
                "text": (f"node as Figma returned it — {len(node_text):,} bytes. Nothing filtered, "
                         f"renamed or summarised: this is what goes to the model."),
                "payload": node_text,
            })
            yield line({
                "phase": "sent-prompt",
                "text": f"the prompt, from governance/SEAT.json — {len(seat['prompt'])} characters",
                "payload": seat["prompt"],
            })
            base = (seat.get("url") or "").rstrip("/")
            if base.endswith("/v1"):
                base = base[:-3]
            yield line({"phase": "asking", "text": f"asking {seat['model']}… nothing to do but wait for it"})

            body = json.dumps({
                "model": seat["model"],
                "system_prompt": seat["prompt"],
                "input": node_text,
                "max_output_tokens": int(seat.get("maxOutputTokens") or 8192),
                "stream": True,
            }).encode("utf-8")
            req = urllib.request.Request(
                base + "/api/v1/chat", data=body,
                headers={"Content-Type": "application/json"}, method="POST",
            )
            started = time.time()
            answer_parts, think_parts, stream_error = [], [], None
            with urllib.request.urlopen(req, timeout=1800) as res:
                for raw in res:
                    if not raw.startswith(b"data:"):
                        continue
                    chunk = raw[5:].strip()
                    if not chunk or chunk == b"[DONE]":
                        continue
                    try:
                        ev = json.loads(chunk)
                    except Exception:
                        continue
                    if ev.get("error"):
                        stream_error = str(ev["error"])
                        break
                    for item in ev.get("content") or []:
                        if not isinstance(item, dict):
                            continue
                        if item.get("type") == "reasoning" and item.get("content"):
                            think_parts.append(str(item["content"]))
                            yield line({"phase": "thinking", "text": str(item["content"])})
                        elif item.get("type") == "message" and item.get("content"):
                            piece = str(item["content"])
                            answer_parts.append(piece)
                            yield line({"phase": "answer", "text": piece})
            seconds = round(time.time() - started, 1)
            answer = "".join(answer_parts) or None

            os.makedirs(RUNS_DIR, exist_ok=True)
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            record = {
                "at": datetime.now(timezone.utc).isoformat(),
                "url": payload.url, "fileKey": file_key, "nodeId": node_id,
                "model": seat["model"], "seconds": seconds,
                "answer": answer, "thinking": "".join(think_parts) or None,
                "error": stream_error or (None if answer else "the model returned no message"),
                "theNodeIsStoredVerbatim": True,
                "node": node_document,
            }
            out = os.path.join(RUNS_DIR, f"{node_id.replace(':', '-')}.{stamp}.json")
            with open(out, "w", encoding="utf-8") as fh:
                json.dump(record, fh, indent=1)

            yield line({
                "phase": "stored",
                "text": f"{seconds}s · stored at {os.path.relpath(out, REPO)}",
                "record": os.path.relpath(out, REPO), "seconds": seconds,
                "status": "REVIEWED" if answer else "NOT DONE", "error": stream_error,
            })
            yield line({"phase": "done"})
        except Exception as exc:
            yield line({"phase": "error", "text": f"the handover failed: {exc}"})

    return StreamingResponse(pump(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache", "X-Accel-Buffering": "no",
    })


@router.get("/api/governance/figma-intake/runs")
async def figma_intake_runs():
    """What has been handed over so far, newest first — the handover log."""
    if not os.path.isdir(RUNS_DIR):
        return {"runs": []}
    out = []
    for name in sorted(os.listdir(RUNS_DIR), reverse=True):
        if not name.endswith(".json"):
            continue
        try:
            with open(os.path.join(RUNS_DIR, name), "r", encoding="utf-8") as fh:
                r = json.load(fh)
            out.append({
                "record": f"governance/figma-intake/{name}",
                "at": r.get("at"),
                "nodeId": r.get("nodeId"),
                "url": r.get("url"),
                "model": r.get("model"),
                "seconds": r.get("seconds"),
                "status": "REVIEWED" if r.get("answer") else "NOT DONE",
            })
        except Exception:
            continue
    return {"runs": out}


@router.get("/api/governance/figma-intake", response_class=HTMLResponse)
async def figma_intake_page():
    """THE BOX, AND THE MODEL TALKING STRAIGHT TO YOU.

    The owner, 2026-09-20: "I need a page that the model runs, not you… I want the model
    injecting the content, not you."

    So this page does two things and neither of them is the model call:
      · it gets the Figma node from this server (the token stays server-side)
      · it posts that node to the local model FROM THE BROWSER, with a prompt you can see and
        edit in a box on the page, and prints the tokens back as they arrive

    THE CONVERSATION IS BETWEEN YOUR BROWSER AND THE MODEL. This server is not in it: it hands
    over the node and then it is done. What you read on the page is the model's own output,
    filling the page as it is produced.

    ONE THING ON THE MODEL SIDE: LM Studio must be started with CORS enabled, or a browser on
    this origin cannot call it —
        lms server stop && lms server start --cors
    The page tests the connection itself and says so if it is refused, rather than failing
    silently. The call is announced up front so a blocked origin is visible immediately.
    """
    try:
        seat = _seat()
        seat_line = f"{seat['model']} · declared in governance/SEAT.json"
    except HTTPException as exc:
        seat_line = f"NO SEAT — {exc.detail}"
    return HTMLResponse(f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Figma intake — the model's handoff</title>
<style>
  /* Inter only, the three weights this app has, nothing below 13px (AGENTS.md). */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&display=swap');
  :root {{ color-scheme: light; }}
  body {{ font-family: Inter, system-ui, sans-serif; font-weight: 500; font-size: 13px;
         margin: 0; padding: 32px; background: #F4F7F6; color: #3D515B; }}
  h1 {{ font-size: 15px; font-weight: 600; margin: 0 0 4px; }}
  .seat {{ color: #758E87; margin-bottom: 18px; }}
  .row {{ display: flex; gap: 8px; max-width: 980px; }}
  input[type=url] {{ flex: 1 1 auto; font: inherit; padding: 9px 12px; border: 1px solid #B5CCCE;
                     border-radius: 8px; background: #FFFFFF; color: #3D515B; }}
  button {{ font: inherit; font-weight: 600; padding: 9px 18px; border: 1px solid #758E87;
            border-radius: 8px; background: #CBE6E3; color: #3D515B; cursor: pointer; }}
  button[disabled] {{ opacity: .5; cursor: default; }}
  label {{ display: block; margin: 18px 0 6px; font-weight: 600; }}
  textarea {{ width: 100%; max-width: 980px; box-sizing: border-box; font: inherit;
              font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
              line-height: 1.5; padding: 12px; border: 1px solid #B5CCCE; border-radius: 8px;
              background: #FFFFFF; color: #3D515B; resize: vertical; }}
  .note {{ color: #758E87; margin: 14px 0 0; max-width: 980px; }}
  #log {{ margin-top: 22px; max-width: 980px; }}
  .step {{ border-top: 1px solid #DCE7E5; padding: 12px 0; }}
  .step:first-child {{ border-top: 0; }}
  .head {{ display: flex; gap: 10px; align-items: baseline; }}
  .phase {{ font-weight: 600; }}
  .t {{ color: #758E87; font-variant-numeric: tabular-nums; }}
  .body {{ margin-top: 8px; white-space: pre-wrap; word-break: break-word;
           font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
           line-height: 1.55; }}
  details > summary {{ cursor: pointer; font-family: Inter, sans-serif; }}
  pre {{ margin: 8px 0 0; padding: 12px; background: #FFFFFF; border: 1px solid #B5CCCE;
         border-radius: 8px; max-height: 40vh; overflow: auto;
         font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
         line-height: 1.5; white-space: pre-wrap; }}
  .sent .phase {{ color: #4E68D2; }}
  .thinking .phase {{ color: #9A8C5B; }}
  .answer .phase {{ color: #2E7D5B; }}
  .meta .phase {{ color: #3D515B; }}
  .error .phase {{ color: #933A45; }}
</style>
</head>
<body>
  <h1>Figma intake</h1>
  <div class="seat">{seat_line}</div>
  <div class="row">
    <input id="u" type="url" required
           placeholder="https://www.figma.com/design/…?node-id=40001119-6308" value="" />
    <button id="b">Hand it to the model</button>
  </div>
  <label for="p">The instruction — yours, not the server's. Edit it freely.</label>
  <textarea id="p" rows="9"></textarea>
  <p class="note">Your browser fetches the node from this server (the Figma token stays there)
     and posts it to the local model itself. This server is not in the conversation: what fills
     the page below is the model's own output.</p>
  <div id="log"></div>
<script>
  const u = document.getElementById('u'), b = document.getElementById('b');
  const p = document.getElementById('p'), log = document.getElementById('log');
  let seat = null, started = 0;
  const t0 = () => started ? ((performance.now() - started) / 1000).toFixed(1) + 's' : '';

  function step(phase, label, text, payload) {{
    const el = document.createElement('div');
    el.className = 'step ' + phase;
    const head = document.createElement('div');
    head.className = 'head';
    head.innerHTML = '<span class="phase"></span><span class="t"></span>';
    head.querySelector('.phase').textContent = label;
    head.querySelector('.t').textContent = t0();
    el.appendChild(head);
    if (payload !== undefined && payload !== null) {{
      const d = document.createElement('details');
      const s = document.createElement('summary'); s.textContent = text;
      const pre = document.createElement('pre'); pre.textContent = payload;
      d.appendChild(s); d.appendChild(pre); el.appendChild(d);
    }} else {{
      const body = document.createElement('div'); body.className = 'body'; body.textContent = text;
      el.appendChild(body);
    }}
    log.appendChild(el);
    window.scrollTo(0, document.body.scrollHeight);
    return el;
  }}

  // The seat, and its default instruction, come from the server so the box is never empty.
  (async () => {{
    try {{
      seat = await (await fetch('/api/governance/seat')).json();
      const prompt = await (await fetch('/api/governance/figma-intake/prompt')).json();
      p.value = prompt.prompt || '';
      step('meta', 'the seat', seat.model + ' · ' + seat.chatUrl);
      if (seat.promptLength && !prompt.prompt) step('meta', 'note', 'the seat declares a prompt but it could not be read');
    }} catch (e) {{ step('error', 'the seat could not be read', String(e)); }}
  }})();

  b.addEventListener('click', async () => {{
    if (!u.value) return;
    log.innerHTML = ''; b.disabled = true; started = performance.now();
    try {{
      // ── the node, from this server, so the Figma token stays server-side ──
      step('meta', 'fetching the node from Figma', '');
      const nr = await fetch('/api/governance/figma-intake/node', {{
        method: 'POST', headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify({{ url: u.value }}),
      }});
      const nj = await nr.json();
      if (!nr.ok) {{ step('error', 'Figma refused', nj.detail || nr.status); return; }}
      step('sent', 'the node as Figma returned it', nj.bytes.toLocaleString() + ' bytes · this is what goes to the model', nj.node);

      // ── THE MODEL CALL, FROM THE BROWSER. The server is not in it. ──
      if (!seat) {{ step('error', 'no seat', 'the seat could not be read from the server'); return; }}
      step('sent', 'the instruction', {{}}.toString() && p.value.length + ' characters', p.value);
      const ar = await fetch(seat.chatUrl, {{
        method: 'POST',
        headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify({{
          model: seat.model,
          system_prompt: p.value,
          input: nj.node,
          max_output_tokens: seat.maxOutputTokens,
          stream: true,
        }}),
      }});
      if (!ar.ok || !ar.body) {{
        step('error', 'the model refused the call', ar.status + ' — if this is a CORS refusal, restart LM Studio with: lms server stop && lms server start --cors');
        return;
      }}

      const reader = ar.body.getReader(), dec = new TextDecoder();
      let buf = '', answerEl = null, thinkEl = null;
      while (true) {{
        const {{ value, done }} = await reader.read();
        if (done) break;
        buf += dec.decode(value, {{ stream: true }});
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {{
          const raw = buf.slice(0, i); buf = buf.slice(i + 2);
          if (!raw.startsWith('data:')) continue;
          let ev; try {{ ev = JSON.parse(raw.slice(5).trim()); }} catch (x) {{ continue; }}
          for (const item of (ev.content || [])) {{
            if (!item || !item.content) continue;
            if (item.type === 'reasoning') {{
              if (!thinkEl) thinkEl = step('thinking', 'the model, thinking', '');
              thinkEl.querySelector('.body').textContent += item.content;
            }} else if (item.type === 'message') {{
              if (!answerEl) answerEl = step('answer', 'the model hands over', '');
              answerEl.querySelector('.body').textContent += item.content;
            }}
            window.scrollTo(0, document.body.scrollHeight);
          }}
        }}
      }}
      step('meta', 'done', t0());
    }} catch (err) {{
      step('error', 'failed', String(err) + ' — if this is a CORS refusal, restart LM Studio with: lms server stop && lms server start --cors');
    }} finally {{ b.disabled = false; }}
  }});
</script>
</body>
</html>""")


def as_page():
    """Left for a caller that wants the page without the router — debugging aid only."""
    return figma_intake_page
