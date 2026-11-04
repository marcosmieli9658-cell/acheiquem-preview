"""Check optimized assets without modifying their originals.

Run with the existing local Python 3.14 environment:
    py -3.14 scripts/check-assets.py

Requires Pillow, fontTools and Brotli. This measures file sizes and compares
decoded pixels and font data; it does not measure browser or network speed.
"""

from __future__ import annotations

import hashlib
import json
import struct
from io import BytesIO
from pathlib import Path

from PIL import Image
from fontTools.misc.xmlWriter import XMLWriter
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "dist" / "assets"


def file_report(source: Path, optimized: Path) -> dict:
    original_bytes = source.stat().st_size
    optimized_bytes = optimized.stat().st_size
    return {
        "source": source.relative_to(ROOT).as_posix(),
        "optimized": optimized.relative_to(ROOT).as_posix(),
        "originalBytes": original_bytes,
        "optimizedBytes": optimized_bytes,
        "savedBytes": original_bytes - optimized_bytes,
        "savedPercent": round((1 - optimized_bytes / original_bytes) * 100, 2),
        "sourceSHA256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "optimizedSHA256": hashlib.sha256(optimized.read_bytes()).hexdigest(),
    }


def png_chunks(source: Path) -> list[str]:
    data = source.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", source
    position = 8
    chunks = []
    while position < len(data):
        length = struct.unpack_from(">I", data, position)[0]
        kind = data[position + 4:position + 8].decode("ascii")
        if kind not in chunks:
            chunks.append(kind)
        position += 12 + length
    return chunks


def image_report(name: str) -> dict:
    source = ASSETS / f"{name}.png"
    optimized = ASSETS / f"{name}.webp"
    with Image.open(source) as original, Image.open(optimized) as converted:
        assert original.size == converted.size, f"Changed dimensions: {name}"
        assert converted.n_frames == 1, f"Unexpected animation: {name}"
        assert original.convert("RGBA").tobytes() == converted.convert("RGBA").tobytes(), f"Changed pixels: {name}"
        metadata_keys = ("icc_profile", "exif", "xmp")
        for key in metadata_keys:
            assert original.info.get(key) == converted.info.get(key), f"Changed {key}: {name}"
        chunks = png_chunks(source)
        return {
            **file_report(source, optimized),
            "dimensions": list(original.size),
            "sourceMode": original.mode,
            "optimizedMode": converted.mode,
            "pixelsIdentical": True,
            "colorAndExifMetadataEqual": True,
            "sourcePNGChunks": chunks,
            "provenance": "caBX remains in the untouched original PNG" if "caBX" in chunks else "No PNG provenance chunk",
        }


def table_xml(font: TTFont, tag: str) -> bytes:
    output = BytesIO()
    font[tag].toXML(XMLWriter(output), font)
    return output.getvalue()


def font_report(name: str) -> dict:
    source = ASSETS / "fonts" / f"{name}.ttf"
    optimized = source.with_suffix(".woff2")
    with TTFont(source, recalcTimestamp=False) as original, TTFont(optimized, recalcTimestamp=False) as converted:
        assert set(original.keys()) == set(converted.keys()), f"Changed tables: {name}"
        assert original.getGlyphOrder() == converted.getGlyphOrder(), f"Changed glyph order: {name}"
        assert original.getBestCmap() == converted.getBestCmap(), f"Changed cmap: {name}"
        compared_tables = []
        # loca stores offsets in the encoded glyf table. WOFF2 reconstructs them;
        # the complete outlines and variable deltas are compared below instead.
        for tag in original.keys():
            if tag in ("GlyphOrder", "head", "loca"):
                continue
            assert table_xml(original, tag) == table_xml(converted, tag), f"Changed {tag}: {name}"
            compared_tables.append(tag)
        head_changes = {}
        for key, value in original["head"].__dict__.items():
            converted_value = getattr(converted["head"], key)
            if value != converted_value:
                assert key in ("checkSumAdjustment", "flags"), f"Changed head.{key}: {name}"
                if key == "flags":
                    assert (value ^ converted_value) & ~(1 << 11) == 0, f"Changed head flags: {name}"
                head_changes[key] = [value, converted_value]
        axes = [
            {"tag": axis.axisTag, "min": axis.minValue, "default": axis.defaultValue, "max": axis.maxValue}
            for axis in original["fvar"].axes
        ]
        return {
            **file_report(source, optimized),
            "glyphCount": len(original.getGlyphOrder()),
            "glyphOrderAndCmapEqual": True,
            "comparedTablesEqual": compared_tables,
            "variableAxes": axes,
            "containerHeadChanges": head_changes,
        }


def main() -> None:
    reports = [image_report("brand-reference"), image_report("professionals"), font_report("nunito-sans"), font_report("lora")]
    original_bytes = sum(report["originalBytes"] for report in reports)
    optimized_bytes = sum(report["optimizedBytes"] for report in reports)
    print(json.dumps({
        "assets": reports,
        "total": {
            "originalBytes": original_bytes,
            "optimizedBytes": optimized_bytes,
            "savedBytes": original_bytes - optimized_bytes,
            "savedPercent": round((1 - optimized_bytes / original_bytes) * 100, 2),
        },
        "scope": "Resource bytes and fidelity only; originals retained; no CWV or Lighthouse measurement.",
    }, indent=2))


if __name__ == "__main__":
    main()
