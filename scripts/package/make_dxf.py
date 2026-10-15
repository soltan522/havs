"""Writes a layered DXF drawing from the CAD model exported by scripts/drawings.mjs (cadModel).

    python3 scripts/package/make_dxf.py model.json out.dxf

Model space holds every floor plan at 1:1 in metres (levels side by side). One A3 paper-space layout
per level frames it at a standard scale with an ISO title block, ready to plot.
Layer names follow the AIA/NCS convention used by most architecture offices (A-WALL, A-DOOR, A-GLAZ …).
"""
import json
import math
import sys
from datetime import date

import ezdxf
from ezdxf import colors, units
from ezdxf.enums import TextEntityAlignment

LAYERS = {
    # name: (ACI colour, lineweight in 1/100 mm, linetype, description)
    "A-WALL": (7, 50, "Continuous", "Walls - cut outline"),
    "A-WALL-PATT": (8, 0, "Continuous", "Walls - poche fill"),
    "A-GLAZ": (4, 25, "Continuous", "Windows and glazing"),
    "A-DOOR": (3, 25, "Continuous", "Doors and swings"),
    "A-FURN": (9, 13, "Continuous", "Furniture and fixtures"),
    "A-AREA-IDEN": (7, 18, "Continuous", "Room names and areas"),
    "A-GRID": (8, 13, "CENTER", "Structural grid"),
    "A-GRID-IDEN": (7, 18, "Continuous", "Grid bubbles"),
    "A-ANNO-DIMS": (1, 13, "Continuous", "Dimensions"),
    "A-ANNO-TEXT": (7, 18, "Continuous", "Annotation"),
    "A-ROOF-OTLN": (6, 18, "DASHED", "Roof / slab above"),
    "A-COLS": (7, 35, "Continuous", "Columns and posts"),
    "A-BALC": (5, 25, "Continuous", "Balconies"),
    "A-LITE": (2, 18, "Continuous", "Lighting layout (reflected ceiling)"),
    "L-PAVE": (33, 13, "Continuous", "Hard landscape"),
    "L-POOL": (140, 25, "Continuous", "Pool"),
    "L-PLNT": (94, 13, "Continuous", "Planting, hedges, vineyard rows"),
    "A-BLDG": (7, 35, "Continuous", "Building footprints (masterplan)"),
    "C-ROAD": (8, 18, "Continuous", "Roads and footways"),
    "C-PROP": (1, 35, "PHANTOM", "Plot boundary"),
    "G-ANNO-TTLB": (7, 35, "Continuous", "Title block"),
    "G-ANNO-VPRT": (8, 0, "Continuous", "Viewports (no plot)"),
}

A3 = (420.0, 297.0)
SCALES = [50, 75, 100, 125, 150, 200, 250, 500, 1000]


def setup(doc):
    doc.units = units.M
    doc.header["$INSUNITS"] = 6  # metres
    doc.header["$MEASUREMENT"] = 1  # metric
    doc.header["$LUNITS"] = 2
    doc.header["$LUPREC"] = 3
    for name, (aci, lw, lt, desc) in LAYERS.items():
        layer = doc.layers.add(name, color=aci, linetype=lt)
        layer.dxf.lineweight = lw
        layer.description = desc
    doc.layers.get("G-ANNO-VPRT").dxf.plot = 0
    doc.styles.add("HAVS", font="DejaVuSans.ttf")
    # dimensions in millimetres, architectural ticks, 2.5 mm text at 1:100
    doc.dimstyles.new(
        "HAVS_MM",
        dxfattribs={
            "dimtxsty": "HAVS",
            "dimtxt": 0.22,
            "dimasz": 0.12,
            "dimtsz": 0.10,
            "dimexe": 0.12,
            "dimexo": 0.08,
            "dimgap": 0.06,
            "dimdli": 0.7,
            "dimlfac": 1000,
            "dimdec": 0,
            "dimtad": 1,
            "dimtih": 0,
            "dimtoh": 0,
            "dimclrd": 1,
            "dimclre": 1,
            "dimclrt": 7,
            "dimzin": 8,
        },
    )


def writer(msp, ox):
    """Entity writer for one level: plan coordinates (y toward the front) -> DXF (y up), shifted by ox."""

    def P(x, y):
        return (x + ox, -y)

    def write(e):
        layer = e["layer"]
        t = e["t"]
        attrs = {"layer": layer}
        if e.get("dashed") and layer not in ("A-GRID",):
            attrs["linetype"] = "DASHED"
            attrs["ltscale"] = 0.02
        if t == "line":
            msp.add_line(P(e["x1"], e["y1"]), P(e["x2"], e["y2"]), dxfattribs=attrs)
        elif t == "rect":
            x, y, w, h = e["x"], e["y"], e["w"], e["h"]
            msp.add_lwpolyline([P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)], close=True, dxfattribs=attrs)
        elif t == "poly":
            pts = [P(*p) for p in e["pts"]]
            if e.get("fill"):
                hatch = msp.add_hatch(dxfattribs={"layer": layer})
                hatch.paths.add_polyline_path(pts, is_closed=True)
                hatch.set_solid_fill(color=8 if layer == "A-WALL-PATT" else 7)
            else:
                msp.add_lwpolyline(pts, close=bool(e.get("closed")), dxfattribs=attrs)
        elif t == "circle":
            c = msp.add_circle(P(e["cx"], e["cy"]), e["r"], dxfattribs=attrs)
            if e.get("filled"):
                hatch = msp.add_hatch(dxfattribs={"layer": layer})
                hatch.paths.add_edge_path().add_arc(P(e["cx"], e["cy"]), e["r"], 0, 360)
                hatch.set_solid_fill(color=7)
        elif t == "ellipse":
            cx, cy = P(e["cx"], e["cy"])
            rx, ry = e["rx"], e["ry"]
            if rx >= ry:
                msp.add_ellipse((cx, cy), major_axis=(rx, 0), ratio=ry / rx, dxfattribs=attrs)
            else:
                msp.add_ellipse((cx, cy), major_axis=(0, ry), ratio=rx / ry, dxfattribs=attrs)
        elif t == "arc":
            cx, cy = P(e["cx"], e["cy"])
            a1 = math.degrees(math.atan2(-e["y1"] - cy, e["x1"] + ox - cx)) % 360
            a2 = math.degrees(math.atan2(-e["y2"] - cy, e["x2"] + ox - cx)) % 360
            # door swings are quarter circles: pick the 90-degree sweep between the two ends
            if round((a2 - a1) % 360) != 90:
                a1, a2 = a2, a1
            msp.add_arc((cx, cy), e["r"], a1, a2, dxfattribs=attrs)
        elif t == "solid":
            x, y, w, h = e["x"], e["y"], e["w"], e["h"]
            hatch = msp.add_hatch(dxfattribs={"layer": layer})
            hatch.paths.add_polyline_path([P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)], is_closed=True)
            if e.get("water"):
                hatch.set_solid_fill(color=254, rgb=(198, 225, 228))
            else:
                hatch.set_solid_fill(color=8 if layer == "A-WALL-PATT" else 7)
        elif t == "text":
            text = msp.add_text(e["text"], height=e["h"], dxfattribs={"layer": layer, "style": "HAVS"})
            text.set_placement(P(e["x"], e["y"]), align=TextEntityAlignment.MIDDLE_CENTER)
        elif t == "dim":
            pts = e["points"]
            at = e["at"]
            for a, b in zip(pts, pts[1:]):
                if b - a < 0.05:
                    continue
                if e["axis"] == "x":
                    p1, p2, base, angle = P(a, 0), P(b, 0), P(a, at), 0
                else:
                    p1, p2, base, angle = P(0, a), P(0, b), P(at, a), 90
                dim = msp.add_linear_dim(base=base, p1=p1, p2=p2, angle=angle, dimstyle="HAVS_MM", dxfattribs={"layer": layer})
                dim.render()

    return write


def title_block(layout, cad, level, sheet_no, scale):
    """ISO-style A3 title block in paper space (millimetres)."""
    W, H = A3
    lay = {"layer": "G-ANNO-TTLB"}
    layout.add_lwpolyline([(10, 10), (W - 10, 10), (W - 10, H - 10), (10, H - 10)], close=True, dxfattribs={**lay, "lineweight": 50})
    x0, y0 = W - 130, 10
    layout.add_lwpolyline([(x0, y0), (W - 10, y0), (W - 10, y0 + 62), (x0, y0 + 62)], close=True, dxfattribs=lay)
    rows = [
        ("PROJECT", cad["title"].upper()),
        ("DRAWING", level["name"]),
        ("SCALE", f"1:{scale} @ A3"),
        ("SHEET / REV", f"{sheet_no} / A"),
        ("DATE", date.today().strftime("%d.%m.%Y")),
    ]
    y = y0 + 62
    for label, value in rows:
        y -= 10
        layout.add_line((x0, y), (W - 10, y), dxfattribs=lay)
        layout.add_text(label, height=1.8, dxfattribs={**lay, "style": "HAVS"}).set_placement((x0 + 3, y + 6.5))
        layout.add_text(value, height=3.0, dxfattribs={**lay, "style": "HAVS"}).set_placement((x0 + 3, y + 1.8))
    layout.add_text("havs.dev  ·  ARCHITECTURE · VILLA DESIGN", height=2.6, dxfattribs={**lay, "style": "HAVS"}).set_placement((x0 + 3, y0 + 5.5))
    layout.add_text("CONCEPT DESIGN — NOT FOR CONSTRUCTION. DIMENSIONS IN MILLIMETRES, LEVELS IN METRES.", height=1.8, dxfattribs={**lay, "style": "HAVS"}).set_placement((x0 + 3, y0 + 1.8))
    layout.add_text(f"FFL +{level['ffl']:.3f}", height=2.4, dxfattribs={**lay, "style": "HAVS"}).set_placement((16, 14))


def main(src, dst):
    cad = json.load(open(src, encoding="utf-8"))
    doc = ezdxf.new("R2010", setup=True)
    setup(doc)
    msp = doc.modelspace()

    ox = 0.0
    placed = []
    for i, level in enumerate(cad["levels"]):
        ext = level["extents"]
        shift = ox - ext["x0"]
        write = writer(msp, shift)
        for e in level["entities"]:
            write(e)
        title = msp.add_text(f"{level['name']}  ·  {cad['title'].upper()}", height=0.45, dxfattribs={"layer": "A-ANNO-TEXT", "style": "HAVS"})
        title.set_placement((ext["x0"] + shift, -(ext["y1"]) - 0.6))
        placed.append((level, ext, shift))
        ox += (ext["x1"] - ext["x0"]) + 40.0

    # one A3 layout per level, viewport at the largest standard scale that fits
    for i, (level, ext, shift) in enumerate(placed):
        sheet_no = level.get("sheet", f"A-10{i + 1}")
        layout = doc.layouts.new(f"{sheet_no} {level['name']}")
        layout.page_setup(size=A3, margins=(0, 0, 0, 0), units="mm")
        w_m, h_m = ext["x1"] - ext["x0"], ext["y1"] - ext["y0"] + 1.5
        # drawing area: left of the title block (full height) or above it (full width)
        regions = [((15, 15), (A3[0] - 160, A3[1] - 30)), ((15, 80), (A3[0] - 30, A3[1] - 95))]
        scale, region = SCALES[-1], regions[0]
        for s in SCALES:
            fit = next((r for r in regions if w_m * 1000 / s <= r[1][0] and h_m * 1000 / s <= r[1][1]), None)
            if fit:
                scale, region = s, fit
                break
        (rx, ry), (rw, rh) = region
        vp_w, vp_h = min(rw, w_m * 1000 / scale + 8), min(rh, h_m * 1000 / scale + 8)
        cx_model = (ext["x0"] + ext["x1"]) / 2 + shift
        cy_model = -((ext["y0"] + ext["y1"]) / 2) - 0.6
        vp = layout.add_viewport(
            center=(rx + rw / 2, ry + rh / 2),
            size=(vp_w, vp_h),
            view_center_point=(cx_model, cy_model),
            view_height=vp_h * scale / 1000,
            dxfattribs={"layer": "G-ANNO-VPRT"},
        )
        vp.dxf.status = 2
        title_block(layout, cad, level, sheet_no, scale)

    if "Layout1" in doc.layouts:
        doc.layouts.delete("Layout1")
    doc.set_modelspace_vport(height=60, center=(ox / 2, -10))
    doc.saveas(dst)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
