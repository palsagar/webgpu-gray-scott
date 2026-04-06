"""Generate a 256x1 colormap PNG (no external dependencies)."""

import struct
import zlib


def _interpolate_colormap(
    control_points: list[tuple[int, int, int, int]],
) -> list[tuple[int, int, int]]:
    """Linearly interpolate RGB between control points to fill 256 entries.

    Parameters
    ----------
    control_points : list[tuple[int, int, int, int]]
        Each entry is ``(position, r, g, b)`` where position is 0-255.

    Returns
    -------
    list[tuple[int, int, int]]
        256 RGB tuples.
    """
    result: list[tuple[int, int, int]] = []
    for i in range(256):
        # Find the surrounding control points
        lo = control_points[0]
        hi = control_points[-1]
        for j in range(len(control_points) - 1):
            if control_points[j][0] <= i <= control_points[j + 1][0]:
                lo = control_points[j]
                hi = control_points[j + 1]
                break

        span = hi[0] - lo[0]
        t = (i - lo[0]) / span if span > 0 else 0.0
        r = int(lo[1] + t * (hi[1] - lo[1]) + 0.5)
        g = int(lo[2] + t * (hi[2] - lo[2]) + 0.5)
        b = int(lo[3] + t * (hi[3] - lo[3]) + 0.5)
        result.append((r, g, b))

    return result


# Reference colormap from pmneila/grayscott
# Tight green->yellow at 0.20-0.21 creates vivid bright edges
COLORMAP = _interpolate_colormap([
    (  0,   0,   0,   0),  # black
    ( 51,   0, 255,   0),  # pure green
    ( 54, 255, 255,   0),  # yellow
    (102, 255,   0,   0),  # red
    (153, 255, 255, 255),  # white
    (255, 255, 255, 255),  # white (constant)
])

assert len(COLORMAP) == 256, f"Expected 256 entries, got {len(COLORMAP)}"


def make_png(pixels: list[tuple[int, int, int]], width: int, height: int) -> bytes:
    """Create a minimal RGB PNG from pixel data."""

    def chunk(tag: bytes, data: bytes) -> bytes:
        c = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", c)

    sig = b"\x89PNG\r\n\x1a\n"

    # IHDR: width, height, bit depth 8, color type 2 (RGB)
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))

    # IDAT: raw image data with filter byte 0 per row
    raw = b"\x00"  # filter: none (single row)
    for r, g, b in pixels:
        raw += struct.pack("BBB", r, g, b)
    idat = chunk(b"IDAT", zlib.compress(raw))

    iend = chunk(b"IEND", b"")

    return sig + ihdr + idat + iend


if __name__ == "__main__":
    import os

    out_dir = os.path.join(os.path.dirname(__file__), "..", "static", "colormaps")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "viridis.png")

    png_bytes = make_png(COLORMAP, 256, 1)
    with open(out_path, "wb") as f:
        f.write(png_bytes)
    print(f"Wrote {out_path} ({len(png_bytes)} bytes)")
