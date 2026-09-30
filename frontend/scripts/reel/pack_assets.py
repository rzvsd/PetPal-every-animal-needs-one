"""Packs Blender PNG sequences into animated WebP files for the in-app reel.

  python frontend/scripts/reel/pack_assets.py <render_dir> [<out_dir>]

WebP keeps full colour and smooth alpha (GIF would band the 3D shading and
give jagged edges) at a fraction of the size. Each file plays once and
rests on its last frame, so an entrance never replays.
"""

import sys
from pathlib import Path

from PIL import Image

RENDERS = Path(sys.argv[1])
OUT = (
    Path(sys.argv[2])
    if len(sys.argv) > 2
    else Path(__file__).resolve().parents[2] / "public" / "reel"
)
SIZE = 320
FPS = 24


def frames_of(name):
    files = sorted((RENDERS / name).glob("*.png"))
    if not files:
        raise SystemExit(f"No frames for {name} in {RENDERS / name}")
    return [
        Image.open(f).convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS) for f in files
    ]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name in ("paw", "house", "dog", "cat", "heart"):
        frames = frames_of(name)
        target = OUT / f"{name}.webp"
        frames[0].save(
            target,
            save_all=True,
            append_images=frames[1:],
            duration=round(1000 / FPS),
            loop=1,
            lossless=False,
            quality=80,
            method=6,
            alpha_quality=90,
        )
        print(
            f"{target.name}: {len(frames)} frames, {target.stat().st_size / 1024:.0f} KB"
        )


if __name__ == "__main__":
    main()
