"""COMPARE WHAT WAS RENDERED WITH WHAT FIGMA DREW — the difference, measured.

The gate's third part, and the one that decides. Two images of the same node at the same scale:
Figma's own rendering of the design, and a browser's rendering of the component written from that
design's measurements. This says how far apart they are, in pixels, and WHERE — because "does not
match" without a location is not something anyone can act on.

TOLERANCE IS FOR ANTI-ALIASING, NOT FOR DIFFERENCE. Two renderers disagree by a pixel or two along
every edge no matter how correct both are, so a strict zero-difference rule would refuse every
component. The tolerance is small and it is on the DIFFERENCE RATIO, not on the shape of the
difference: a missing border, a wrong colour, a shifted box and a dropped icon all change far more
pixels than anti-aliasing does.

Every answer carries its numbers and the images. A comparison that could not be made — an image
missing, sizes that do not correspond — is reported as `could not compare`, never as agreement.
"""

from __future__ import annotations

import io
import os
import tempfile
from typing import Any, Optional

try:
    from PIL import Image, ImageChops
except Exception:  # pragma: no cover - PIL is present in this environment
    Image = None  # type: ignore

# The share of differing pixels above which the render is not accepted. Anti-aliasing along edges
# moves a few tenths of a percent on a design like these; a missing 1px border on a 40px icon is
# several percent of that icon's own box, which the per-layer crops catch.
# PROVISIONAL: THIS NUMBER IS A GUESS, NOT A MEASUREMENT. It was picked by eye as "small enough
# to catch a missing border, large enough to absorb anti-aliasing" and has never been calibrated
# against a pair of images known to agree. The real designs measured so far sit at 0.6% — just
# over it — so this single number currently decides what passes. Calibrate it from evidence before
# trusting any verdict it produces.
DEFAULT_TOLERANCE = 0.005
# Per channel, what counts as the same pixel. Two renderers round differently; this absorbs the
# rounding without absorbing a different colour.
CHANNEL_TOLERANCE = 12


def _open(data: bytes) -> Optional[Image.Image]:
    if Image is None or not data:
        return None
    try:
        image = Image.open(io.BytesIO(data)).convert("RGBA")
        return image
    except Exception:
        return None


def _differing_ratio(a: Image.Image, b: Image.Image) -> tuple[float, Optional[Image.Image]]:
    """The share of pixels that differ by more than the channel tolerance, and where they are."""
    if a.size != b.size:
        return 1.0, None
    diff = ImageChops.difference(a, b)
    # A pixel counts as different only if some channel differs by more than anti-aliasing would.
    bands = diff.split()
    worst = bands[0]
    for band in bands[1:]:
        worst = ImageChops.lighter(worst, band)
    mask = worst.point(lambda v: 255 if v > CHANNEL_TOLERANCE else 0)
    histogram = mask.histogram()
    differing = histogram[255] if len(histogram) > 255 else 0
    total = a.size[0] * a.size[1]
    ratio = differing / total if total else 1.0
    # Encode the mask as a visible diff: the design in grey, the differences in magenta.
    canvas = a.convert("RGB").point(lambda v: v // 3)
    canvas.paste((255, 0, 200), mask=mask)
    return ratio, canvas


def _crop(image: Image.Image, box: tuple[float, float, float, float], scale: float) -> Optional[Image.Image]:
    """One layer's box, in image pixels."""
    try:
        left = max(0, int(round(box[0] * scale)))
        top = max(0, int(round(box[1] * scale)))
        right = min(image.size[0], int(round((box[0] + box[2]) * scale)))
        bottom = min(image.size[1], int(round((box[1] + box[3]) * scale)))
        if right - left < 2 or bottom - top < 2:
            return None
        return image.crop((left, top, right, bottom))
    except Exception:
        return None


def best_alignment(
    design: Image.Image,
    component: Image.Image,
    reach: int = 3,
) -> tuple[tuple[int, int], float]:
    """The offset at which the two images agree most, and the difference left there.

    A PIXEL DIFFERENCE AT ZERO OFFSET IS NOT A MEASURE OF WRONGNESS. One pixel of global shift —
    from a line-height, a border, a rounding — makes every text edge differ, so a row that is
    visually correct scores 20% and reads as a broken render. This reports what is actually true
    of the pair: how far apart they are, in whole pixels, and how much differs once they are
    aligned. "1px right, 0.1% residual" is a physical statement about the two images; a bare
    percentage is not.

    The reach is small on purpose: a shift larger than a few pixels is not a shift, it is a
    different layout, and pretending to align it would hide that.
    """
    best = ((0, 0), 1.0)
    for dy in range(-reach, reach + 1):
        for dx in range(-reach, reach + 1):
            shifted = Image.new("RGBA", component.size, (0, 0, 0, 0))
            shifted.paste(component, (dx, dy))
            ratio, _ = _differing_ratio(design, shifted)
            if ratio < best[1]:
                best = ((dx, dy), ratio)
    return best


def compare(
    design_png: bytes,
    component_png: bytes,
    node_size: tuple[float, float],
    scale: float = 2.0,
    layers: Optional[list[dict[str, Any]]] = None,
    tolerance: float = DEFAULT_TOLERANCE,
) -> dict[str, Any]:
    """Compare a rendered component with Figma's own rendering of the node.

    `layers` is the measured layer list — `{name, box: [x, y, w, h]}` in node coordinates relative
    to the node's origin — so a failure names the layer whose region differs, not just the design.
    """
    design = _open(design_png)
    component = _open(component_png)
    if design is None or component is None:
        return {
            "ok": False,
            "compared": False,
            "error": "one of the two images could not be read — nothing was compared",
        }

    # The two images must be of the same thing at the same scale. Figma renders the node at its own
    # size; if the component came out a different size, that IS the finding, and it is reported as
    # a size difference rather than as a pixel diff of two different pictures.
    if design.size != component.size:
        return {
            "ok": False,
            "compared": True,
            "reason": (
                f"the component rendered {component.size[0]}×{component.size[1]} where the design is "
                f"{design.size[0]}×{design.size[1]} pixels at scale {scale} — the boxes differ before "
                f"anything inside them is compared"
            ),
            "designSize": list(design.size),
            "componentSize": list(component.size),
            "difference": 1.0,
        }

    difference, diff_image = _differing_ratio(design, component)
    (offset_x, offset_y), aligned_difference = best_alignment(design, component)

    # Per-layer crops: the region each measured layer occupies, in both images. A layer that is
    # missing or wrong shows up here even when the whole-node difference is inside tolerance —
    # which is exactly the case a single global number would wave through.
    regions: list[dict[str, Any]] = []
    for layer in layers or []:
        box = layer.get("box")
        if not box or len(box) != 4:
            continue
        design_crop = _crop(design, tuple(box), scale)
        component_crop = _crop(component, tuple(box), scale)
        if design_crop is None or component_crop is None or design_crop.size != component_crop.size:
            continue
        layer_difference, _ = _differing_ratio(design_crop, component_crop)
        if layer_difference > tolerance:
            regions.append({
                "layer": layer.get("name") or "(unnamed layer)",
                "box": [round(float(v), 1) for v in box],
                "difference": round(layer_difference, 4),
            })

    ok = aligned_difference <= tolerance and not regions
    result: dict[str, Any] = {
        "ok": ok,
        "compared": True,
        "difference": round(difference, 5),
        # WHAT THE PAIR ACTUALLY SAYS: how far apart they are, and what differs once aligned.
        "offset": [offset_x, offset_y],
        "offsetScale": scale,
        "alignedDifference": round(aligned_difference, 5),
        "tolerance": tolerance,
        "designSize": list(design.size),
        "componentSize": list(component.size),
        "scale": scale,
        "regions": sorted(regions, key=lambda r: -r["difference"])[:12],
    }
    if not ok:
        if regions:
            worst = result["regions"][0]
            result["reason"] = (
                f"{len(result['regions'])} layer(s) differ from the design — worst: "
                f"{worst['layer']} ({round(worst['difference'] * 100, 2)}% of its box). "
                f"Whole node: {round(difference * 100, 3)}% of pixels (tolerance {round(tolerance * 100, 2)}%)."
            )
        else:
            result["reason"] = (
                f"{round(difference * 100, 3)}% of pixels differ from the design "
                f"(tolerance {round(tolerance * 100, 2)}%), spread across the node rather than in "
                f"one layer."
            )

    # The images travel with the verdict: a claim about pixels with no picture beside it is not
    # something anyone can check.
    workdir = tempfile.mkdtemp(prefix="render-diff-")
    result["designImage"] = os.path.join(workdir, "design.png")
    result["componentImage"] = os.path.join(workdir, "component.png")
    result["diffImage"] = os.path.join(workdir, "diff.png")
    with open(result["designImage"], "wb") as f:
        f.write(design_png)
    with open(result["componentImage"], "wb") as f:
        f.write(component_png)
    if diff_image is not None:
        diff_image.save(result["diffImage"])
    return result
