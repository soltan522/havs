"""Prepares a DXF for LibreDWG's dxf2dwg, which reads a narrower subset of DXF than CAD programs:
dimensions are exploded to plain geometry, MTEXT becomes TEXT, dimension blocks are purged and the file
is saved as AutoCAD 2000 (the DWG version LibreDWG writes).

    python3 scripts/package/dxf_for_dwg.py in.dxf out.dxf
"""
import sys

import ezdxf


def main(src, dst):
    doc = ezdxf.readfile(src)
    for layout in doc.layouts:
        for dim in list(layout.query("DIMENSION")):
            dim.explode()
        for mt in list(layout.query("MTEXT")):
            text = layout.add_text(mt.plain_text(), height=mt.dxf.char_height, dxfattribs={"layer": mt.dxf.layer, "style": mt.dxf.get("style", "HAVS")})
            text.set_placement(mt.dxf.insert)
            layout.delete_entity(mt)
    for name in [b.name for b in doc.blocks if b.name.upper().startswith("*D")]:
        doc.blocks.delete_block(name, safe=False)
    doc.dxfversion = "AC1015"
    doc.saveas(dst)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
