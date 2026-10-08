"""RENDER THE COMPONENT, SO IT CAN BE COMPARED WITH THE DESIGN — headless, at its measured size.

The gate's second half. `design_renderer` writes the component; this draws it: the component's own
CSS and markup go into a standalone document, a headless browser screenshots it at exactly the
size Figma measured, and the pixels come back for comparison.

WHY A BROWSER AND NOT A MODEL OF ONE: the question being answered is "does this render like the
design", and the only honest answer to that is an actual rendering. Every approximation of a
browser (a hand-written layout calculator, a CSS analyser) would be a second thing to be wrong.

NO NEW DEPENDENCY: it uses the Chrome that is already on the machine, in headless mode, the same
way the manual probes in this repository have. If no browser is found, the answer is
`{"ok": False, "error": "could not render"}` — never a pass. A check that cannot look must not
report that it saw nothing wrong.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

# Where a browser may be, in the order worth trying. A path that does not exist is skipped; the
# list existing is what makes this runnable on a machine that is not this one.
_BROWSER_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "google-chrome",
    "chromium",
    "chromium-browser",
]


def find_browser() -> str | None:
    """The first browser that is actually present, or None — never a guess."""
    for candidate in _BROWSER_CANDIDATES:
        if os.path.isabs(candidate):
            if os.path.exists(candidate):
                return candidate
            continue
        found = shutil.which(candidate)
        if found:
            return found
    return None


# ── THE FONTS ARE THE APP'S OWN, READ FROM THIS DISK (owner, 2026-10-07) ─────────────────────
# This page used to link Google's font hosts for Inter, so every render of a component reached
# fonts.googleapis.com. The owner's rule for the product — "Use our fonts only - no API calls" —
# holds for the render too: a fidelity screenshot drawn in substitute faces is a FALSE verdict
# about the component (the comparison's whole value is that it shows what the component draws),
# so the page now carries the same sheet the app serves — frontend/public/fonts/fonts.css — with
# its /fonts/ urls resolved to the files on this disk.
FONTS_DIR = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "public", "fonts")
)


def _font_faces() -> str:
    """The app's font sheet, url('…') rewritten to file:// paths — or a REFUSED render.

    No fallback: if the sheet or any file it names is missing, the screenshot would draw faces
    the app never draws, and this module's own rule applies — a render that cannot be honest
    must not be used. The caller turns this into {"ok": False, "error": …} naming the path;
    it never becomes a silent system font.
    """
    sheet = os.path.join(FONTS_DIR, "fonts.css")
    if not os.path.exists(sheet):
        raise RuntimeError(
            f"the local fonts are missing: {sheet} does not exist — the render would draw "
            "substitute faces, so it is refused (the sheet lives in frontend/public/fonts/)"
        )
    with open(sheet, encoding="utf-8") as f:
        css = f.read()
    base = Path(FONTS_DIR).resolve().as_uri()  # file:///… — absolute, percent-encoded
    spelled = css.count("url('/fonts/")
    rewritten = css.replace("url('/fonts/", f"url('{base}/")
    if spelled == 0 or rewritten.count(base) != spelled:
        raise RuntimeError(
            f"{sheet} no longer spells its font urls as url('/fonts/…') — a file:// page "
            "cannot resolve them, so the render is refused rather than drawn in wrong faces"
        )
    for name in re.findall(re.escape(base) + r"/([^']+)", rewritten):
        font_file = os.path.join(FONTS_DIR, name)
        if not os.path.exists(font_file):
            raise RuntimeError(
                f"the local font file is missing: {font_file} — the render would draw a "
                "substitute face, so it is refused"
            )
    return rewritten


def document_for(
    code: str,
    tag: str,
    width: float,
    height: float,
    host_width: float | None = None,
    host_height: float | None = None,
) -> str:
    """The component's CSS and markup as a standalone page, at the measured size.

    The component's own `:host` rule becomes the wrapper's rule, because in the real application
    the element IS the host; the styles inside the `css` template and the markup inside the `html`
    template are lifted verbatim. Nothing is added that the component does not carry — no reset, no
    margin, no font-size — because the comparison's whole value is that it shows what the component
    draws, and a helpful stylesheet here would be a thumb on the scale.

    THE ONE THING THE PAGE SUPPLIES IS ITS FONTS, and it supplies the app's own (see
    `_font_faces` above): a component cannot provision faces by itself, and the Google link that
    stood here until 2026-10-07 was both an external call and a different set of bytes than the
    app serves.
    """
    styles = ""
    match = re.search(r"css`(.*?)`", code, re.DOTALL)
    if match:
        styles = match.group(1).replace(":host", f"#{tag}")

    markup = ""
    match = re.search(r"return html`(.*?)`;\s*\}", code, re.DOTALL)
    if match:
        markup = match.group(1).strip()

    return (
        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
        "<style>"
        f"{_font_faces()}"
        "html, body { margin: 0; padding: 0; background: transparent; }"
        f"body {{ width: {width}px; height: {height}px; }}"
        f"#{tag} {{ display: block; width: {host_width or width}px; height: {host_height or height}px; }}"
        f"{styles}"
        "</style></head><body>"
        f"<div id='{tag}'>{markup}</div>"
        "</body></html>"
    )


def render_component(
    code: str,
    tag: str,
    width: float,
    height: float,
    scale: float = 2.0,
    window_size: tuple[float, float] | None = None,
) -> dict[str, Any]:
    """A screenshot of the component, at the measured size, as PNG bytes.

    `scale` matches the scale the design's own image is fetched at, because two images of different
    sizes cannot be compared pixel for pixel. Chrome's device-scale-factor does that exactly.
    """
    browser = find_browser()
    if not browser:
        return {"ok": False, "error": "no headless browser found on this machine — the component could not be rendered"}
    if not code:
        return {"ok": False, "error": "there is no component source to render"}

    workdir = tempfile.mkdtemp(prefix="render-component-")
    page = os.path.join(workdir, "component.html")
    shot = os.path.join(workdir, "component.png")
    try:
        # THE WINDOW IS THE DESIGN'S BOUNDS, THE ELEMENT IS ITS MEASURED SIZE. A Figma export
        # includes anything that overflows the frame (this catalogue row is 40px tall with 43px
        # of text in it, and Figma draws all 43); a window cut to 40 would clip the difference
        # away and call it a pass. So the element keeps its measured box and the window is the
        # bigger of the two.
        win_w, win_h = window_size or (width, height)
        win_w, win_h = max(win_w, width), max(win_h, height)
        with open(page, "w", encoding="utf-8") as f:
            f.write(document_for(code, tag, win_w, win_h, host_width=width, host_height=height))
        device_scale = max(1.0, float(scale))
        command = [
            browser,
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--default-background-color=00000000",
            f"--force-device-scale-factor={device_scale}",
            f"--window-size={int(round(win_w))},{int(round(win_h))}",
            f"--screenshot={shot}",
            "file://" + page,
        ]
        completed = subprocess.run(command, capture_output=True, timeout=120)
        if not os.path.exists(shot):
            return {
                "ok": False,
                "error": "the browser produced no screenshot — "
                         + (completed.stderr.decode("utf-8", "replace")[:300] or "no reason given"),
            }
        with open(shot, "rb") as f:
            data = f.read()
        if not data:
            return {"ok": False, "error": "the browser produced an empty screenshot"}
        return {"ok": True, "data": data, "scale": device_scale, "width": win_w, "height": win_h}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "the browser did not finish rendering within 120s"}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
