"""Composites the PetPal showreel (MP4 + GIF) from the Blender renders.

  python frontend/scripts/reel/build_showreel.py <render_dir> <out_dir> [font.ttf]

Every frame is computed from the timeline below with easing curves and
damped springs (the same motion language as the in-app reel), then encoded
with ffmpeg: H.264 MP4 for sharing, palette-optimised GIF for embedding.
"""

import math
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
PREVIEW = "--preview" in sys.argv
RENDERS = Path(ARGS[0])
OUT = Path(ARGS[1])
FONT_PATH = ARGS[2] if len(ARGS) > 2 else "C:/Windows/Fonts/SegUIVar.ttf"
W, H, FPS = 720, 1280, 24
SCENES = [
    ("spark", 3.2),
    ("words", 3.8),
    ("match", 4.0),
    ("foster", 4.5),
    ("community", 3.0),
    ("lockup", 3.5),
]
TOTAL = sum(d for _, d in SCENES)
FADE = 0.3

INK, CREAM, SUN, CLAY, SAGE = (
    (30, 42, 35),
    (246, 242, 234),
    (241, 196, 106),
    (196, 111, 78),
    (159, 192, 168),
)
GREEN, GREEN_DARK, MUTED = (47, 93, 70), (20, 42, 31), (102, 113, 106)


def font(size, weight="Bold Display"):
    f = ImageFont.truetype(FONT_PATH, size)
    try:
        f.set_variation_by_name(weight)
    except (OSError, ValueError):
        pass
    return f


def fit(s, size, weight, max_width):
    """The largest font up to `size` that keeps `s` within `max_width` (any language)."""
    f = font(size, weight)
    while f.getlength(s) > max_width and size > 12:
        size -= 2
        f = font(size, weight)
    return f


# Easing ------------------------------------------------------------------
def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def progress(t, start, duration):
    return clamp((t - start) / duration)


def ease_out_cubic(p):
    return 1 - (1 - p) ** 3


def ease_in_out(p):
    return 4 * p**3 if p < 0.5 else 1 - (-2 * p + 2) ** 3 / 2


def spring(t, start, stiffness=180.0, damping=14.0):
    """Damped spring from 0 to 1 (can overshoot), like framer-motion."""
    x = t - start
    if x <= 0:
        return 0.0
    omega = math.sqrt(stiffness)
    zeta = damping / (2 * omega)
    if zeta >= 1:
        return 1 - math.exp(-omega * x) * (1 + omega * x)
    wd = omega * math.sqrt(1 - zeta**2)
    return 1 - math.exp(-zeta * omega * x) * (
        math.cos(wd * x) + zeta * omega / wd * math.sin(wd * x)
    )


def lerp(a, b, p):
    return a + (b - a) * p


# Assets ------------------------------------------------------------------
def sequence(name):
    return [
        Image.open(f).convert("RGBA") for f in sorted((RENDERS / name).glob("*.png"))
    ]


ART = {name: sequence(name) for name in ("paw", "house", "dog", "cat", "heart")}


def art_frame(name, t, start):
    frames = ART[name]
    index = int(max(0.0, t - start) * FPS)
    return frames[min(index, len(frames) - 1)]


def paste(canvas, image, cx, cy, scale=1.0, rotate=0.0, alpha=1.0):
    if alpha <= 0 or scale <= 0.01:
        return
    img = image
    if scale != 1.0:
        img = img.resize(
            (max(1, int(img.width * scale)), max(1, int(img.height * scale))),
            Image.LANCZOS,
        )
    if rotate:
        img = img.rotate(rotate, resample=Image.BICUBIC, expand=True)
    if alpha < 1:
        img = img.copy()
        img.putalpha(img.getchannel("A").point(lambda a: int(a * alpha)))
    canvas.alpha_composite(img, (int(cx - img.width / 2), int(cy - img.height / 2)))


def text(canvas, s, x, y, f, color, alpha=1.0, anchor="la"):
    if alpha <= 0:
        return
    layer = Image.new("RGBA", canvas.size)
    ImageDraw.Draw(layer).text(
        (x, y), s, font=f, fill=(*color, int(255 * alpha)), anchor=anchor
    )
    canvas.alpha_composite(layer)


def radial_bg(inner, outer, cx=0.5, cy=0.0, radius=1.25):
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt(((xx / W - cx) * (W / H)) ** 2 + (yy / H - cy) ** 2) / radius
    d = np.clip(d, 0, 1)[..., None]
    arr = (np.array(inner) * (1 - d) + np.array(outer) * d).astype(np.uint8)
    return Image.fromarray(np.dstack([arr, np.full((H, W), 255, np.uint8)]), "RGBA")


DARK_BG = radial_bg(GREEN, GREEN_DARK)
CREAM_BG = Image.new("RGBA", (W, H), (*CREAM, 255))


def glow(canvas, cx, cy, radius, color, strength):
    layer = Image.new("RGBA", (radius * 2, radius * 2))
    yy, xx = np.mgrid[0 : radius * 2, 0 : radius * 2]
    d = np.clip(np.sqrt((xx - radius) ** 2 + (yy - radius) ** 2) / radius, 0, 1)
    a = ((1 - d) ** 2 * 255 * strength).astype(np.uint8)
    layer = Image.fromarray(
        np.dstack(
            [
                np.full_like(a, color[0]),
                np.full_like(a, color[1]),
                np.full_like(a, color[2]),
                a,
            ]
        ),
        "RGBA",
    )
    canvas.alpha_composite(layer, (int(cx - radius), int(cy - radius)))


# Scenes (t is seconds since the scene started) --------------------------
def scene_spark(t):
    c = DARK_BG.copy()
    glow(c, W // 2, H // 2, 420, SUN, 0.22 + 0.08 * math.sin(t * 2))
    ring = progress(t, 0.05, 1.3)
    if 0 < ring < 1:
        r = ease_out_cubic(ring) * 620
        d = ImageDraw.Draw(c)
        a = int(255 * (1 - ring))
        d.ellipse(
            (W / 2 - r, H / 2 - r, W / 2 + r, H / 2 + r), outline=(*SUN, a), width=4
        )
    move = ease_in_out(progress(t, 1.3, 0.8))
    paste(
        c,
        art_frame("paw", t, 0.3),
        lerp(W / 2, 170, move),
        H / 2 - 10,
        lerp(1.35, 0.72, move) * min(1, spring(t, 0.3, 220, 16) + 0.001),
    )
    f = font(118)
    x = 262
    for i, ch in enumerate("PetPal"):
        s = spring(t, 1.55 + i * 0.07, 200, 17)
        text(c, ch, x, H / 2 + lerp(50, 0, s), f, CREAM, clamp(s), "lm")
        x += f.getlength(ch)
    return c


def scene_words(t, words):
    c = DARK_BG.copy()
    sx = lerp(-120, W + 120, t / 3.8)
    glow(c, int(sx), 250, 200, SUN, 0.35)
    ImageDraw.Draw(c).ellipse((sx - 55, 195, sx + 55, 305), fill=(*SUN, 255))
    f = fit(
        max(words, key=lambda w: font(138).getlength(w)), 138, "Bold Display", W - 110
    )
    top = H / 2 - 2 * 150 + 20
    for i, word in enumerate(words):
        s = spring(t, 0.15 + i * 0.55, 150, 17)
        y = top + i * 150
        # Tall enough for ascenders; the line slides up from below its own mask.
        line = Image.new("RGBA", (W, 190))
        color = SUN if i == 1 else CREAM
        x = 64
        for j, ch in enumerate(word):
            wave = (
                -18 * math.sin(math.pi * progress(t, 1.5 + j * 0.06, 0.6))
                if i == 1
                else 0
            )
            ImageDraw.Draw(line).text(
                (x, 172 + lerp(190, 0, s) + wave),
                ch,
                font=f,
                fill=(*color, 255),
                anchor="ls",
            )
            x += f.getlength(ch)
        c.alpha_composite(line, (0, int(y)))
    return c


def scene_match(t, caption):
    c = DARK_BG.copy()
    glow(c, W // 2, H // 2 - 60, 380, SUN, 0.18)
    dog, cat = spring(t, 0.2, 120, 14), spring(t, 0.35, 120, 14)
    paste(
        c,
        art_frame("dog", t, 0.2),
        lerp(-260, W / 2 - 165, dog),
        lerp(H / 2 + 120, H / 2 - 30, dog),
        0.95,
        lerp(30, 0, dog),
    )
    paste(
        c,
        art_frame("cat", t, 0.35),
        lerp(W + 260, W / 2 + 165, cat),
        lerp(H / 2 - 180, H / 2 - 30, cat),
        0.95,
        lerp(-30, 0, cat),
    )
    heart_y = H / 2 - 290
    if t > 1.3:
        paste(c, art_frame("heart", t, 1.3), W / 2, heart_y, 0.7)
    burst = progress(t, 1.35, 0.9)
    if 0 < burst < 1:
        d = ImageDraw.Draw(c)
        for i in range(14):
            angle = i / 14 * math.tau
            r = ease_out_cubic(burst) * 170
            size = 10 * math.sin(math.pi * burst)
            x, y = W / 2 + math.cos(angle) * r, heart_y + math.sin(angle) * r
            d.ellipse(
                (x - size, y - size, x + size, y + size),
                fill=(*(SUN if i % 2 else CLAY), 255),
            )
    trail = progress(t, 1.8, 1.6)
    d = ImageDraw.Draw(c)
    for k in range(int(ease_in_out(trail) * 40)):
        u = k / 39
        x = lerp(70, W - 70, u)
        y = H / 2 + 240 + math.sin(u * math.pi * 2) * 40
        d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(*SUN, 220))
    for i in range(5):
        s = spring(t, 2.0 + i * 0.25, 260, 18)
        if s <= 0.01:
            continue
        u = (i + 0.5) / 5
        x, y = lerp(70, W - 70, u), H / 2 + 222 + math.sin(u * math.pi * 2) * 40
        r = 12 * s
        d.ellipse((x - r, y - r, x + r, y + r), fill=(*CREAM, 255))
        for dx in (-13, 0, 13):
            rr = 6 * s
            d.ellipse(
                (x + dx * s - rr, y - 20 * s - rr, x + dx * s + rr, y - 20 * s + rr),
                fill=(*CREAM, 255),
            )
    s = spring(t, 2.2, 140, 18)
    text(
        c,
        caption,
        W / 2,
        H - 230 + lerp(30, 0, s),
        fit(caption, 46, "Semibold Display", W - 70),
        CREAM,
        clamp(s),
        "mm",
    )
    return c


def scene_foster(t, caption, steps):
    c = DARK_BG.copy()
    glow(c, W // 2, 470, 360, SUN, 0.22 + 0.1 * clamp((t - 1.8) * 2))
    paste(c, art_frame("house", t, 0.0), W / 2, 470, 1.35)
    y = 830
    d = ImageDraw.Draw(c)
    left, right = 130, W - 130
    d.rounded_rectangle((left, y - 3, right, y + 3), 3, fill=(246, 242, 234, 60))
    fill = ease_in_out(progress(t, 2.2, 1.6))
    if fill > 0:
        d.rounded_rectangle(
            (left, y - 3, lerp(left, right, fill), y + 3), 3, fill=(*SUN, 255)
        )
    f = font(26, "Semibold Text")
    for i, step in enumerate(steps):
        x = lerp(left, right, i / (len(steps) - 1))
        s = spring(t, 2.3 + i * 0.4, 260, 16)
        r = lerp(7, 15, clamp(s))
        d.ellipse(
            (x - r, y - r, x + r, y + r),
            fill=(*SUN, 255) if s > 0.05 else (246, 242, 234, 80),
        )
        text(c, step, x, y + 46 + lerp(10, 0, clamp(s)), f, CREAM, clamp(s * 1.2), "mm")
    s = spring(t, 3.2, 140, 18)
    text(
        c,
        caption,
        W / 2,
        H - 230 + lerp(30, 0, s),
        fit(caption, 46, "Semibold Display", W - 70),
        CREAM,
        clamp(s),
        "mm",
    )
    return c


def scene_community(t, caption):
    c = DARK_BG.copy()
    colors = [SAGE, CLAY, SUN, CREAM, SAGE, CLAY, SUN, CREAM, SAGE]
    icons = ["paw", "heart", "house", None, "dog", None, "cat", "paw", "heart"]
    gather = ease_in_out(progress(t, 2.25, 0.7))
    tile, gap = 170, 22
    grid = Image.new("RGBA", (tile * 3 + gap * 2, tile * 3 + gap * 2))
    for i in range(9):
        row, col = divmod(i, 3)
        s = spring(t, 0.1 + (row + col) * 0.12, 240, 17)
        width = int(tile * clamp(s, 0, 1.2))
        if width < 2:
            continue
        cell = Image.new("RGBA", (tile, tile))
        ImageDraw.Draw(cell).rounded_rectangle(
            (0, 0, tile - 1, tile - 1), 44, fill=(*colors[i], 255)
        )
        if icons[i]:
            paste(cell, ART[icons[i]][-1], tile / 2, tile / 2, 0.42)
        cell = cell.resize((width, tile), Image.LANCZOS)
        grid.alpha_composite(
            cell, (col * (tile + gap) + (tile - width) // 2, row * (tile + gap))
        )
    paste(
        c,
        grid,
        W / 2,
        H / 2 - 40,
        lerp(1, 0.15, gather),
        lerp(0, 45, gather),
        1 - gather,
    )
    appear, leave = spring(t, 0.3, 140, 18), progress(t, 2.3, 0.5)
    text(
        c,
        caption,
        W / 2,
        H - 230,
        fit(caption, 46, "Semibold Display", W - 70),
        CREAM,
        clamp(appear) * (1 - leave),
        "mm",
    )
    return c


def scene_lockup(t, tagline):
    c = DARK_BG.copy()
    reveal = ease_in_out(progress(t, 0.0, 1.1))
    mask = Image.new("L", (W, H), 0)
    r = reveal * math.hypot(W, H) / 2 * 1.05
    ImageDraw.Draw(mask).ellipse((W / 2 - r, H / 2 - r, W / 2 + r, H / 2 + r), fill=255)
    c.paste(CREAM_BG, (0, 0), mask)
    s = spring(t, 0.7, 220, 15)
    if s > 0.01:
        badge = Image.new("RGBA", (220, 220))
        bd = ImageDraw.Draw(badge)
        bd.rounded_rectangle((0, 0, 219, 219), 66, fill=(*GREEN, 255))
        paste(badge, ART["heart"][-1], 110, 110, 0.5)
        paste(c, badge, W / 2, H / 2 - 150, s, lerp(-20, 0, clamp(s)))
        p = spring(t, 1.1, 260, 15)
        if p > 0.01:
            dot = Image.new("RGBA", (86, 86))
            ImageDraw.Draw(dot).ellipse((0, 0, 85, 85), fill=(*CREAM, 255))
            ImageDraw.Draw(dot).ellipse((8, 8, 77, 77), fill=(*SUN, 255))
            paste(dot, ART["paw"][-1], 43, 43, 0.2)
            paste(c, dot, W / 2 + 90, H / 2 - 60, p)
    w = spring(t, 1.1, 140, 18)
    f = font(120)
    spacing = lerp(40, 0, clamp(w))
    total = sum(f.getlength(ch) for ch in "PetPal") + spacing * 5
    x = W / 2 - total / 2
    for ch in "PetPal":
        text(c, ch, x, H / 2 + 60 + lerp(30, 0, clamp(w)), f, INK, clamp(w), "lm")
        x += f.getlength(ch) + spacing
    text(
        c,
        tagline,
        W / 2,
        H / 2 + 150,
        fit(tagline, 38, "Regular", W - 70),
        MUTED,
        clamp((t - 1.7) / 0.6),
        "mm",
    )
    return c


def render_frame(t, copy):
    starts, acc = [], 0.0
    for name, duration in SCENES:
        starts.append((name, acc, duration))
        acc += duration
    for index, (name, start, duration) in enumerate(starts):
        if t < start + duration or index == len(starts) - 1:
            local = t - start
            frame = draw(name, local, copy)
            if index > 0 and local < FADE:
                prev_name, prev_start, prev_duration = starts[index - 1]
                prev = draw(prev_name, prev_duration + local, copy)
                frame = Image.blend(prev, frame, local / FADE)
            return frame
    return draw(SCENES[-1][0], SCENES[-1][1], copy)


def draw(name, local, copy):
    if name == "spark":
        return scene_spark(local)
    if name == "words":
        return scene_words(local, copy["words"])
    if name == "match":
        return scene_match(local, copy["match"])
    if name == "foster":
        return scene_foster(local, copy["foster"], copy["steps"])
    if name == "community":
        return scene_community(local, copy["community"])
    return scene_lockup(local, copy["tagline"])


COPY = {
    "en": {
        "words": ["Every", "animal", "needs", "one."],
        "match": "Playdates and social walks",
        "foster": "A temporary home. Shared care.",
        "steps": ["Offered", "Agreed", "Arrived", "In care"],
        "community": "Kind people. Safe together.",
        "tagline": "Every animal needs one.",
    },
    "ro": {
        "words": ["Fiecare", "animal", "are nevoie", "de cineva."],
        "match": "Joacă și plimbări împreună",
        "foster": "O casă temporară. O grijă împărțită.",
        "steps": ["Ofertă", "Acord", "A ajuns", "În grijă"],
        "community": "Oameni buni. În siguranță, împreună.",
        "tagline": "Fiecare animal are nevoie de cineva.",
    },
}


def preview():
    """One key moment per scene on a contact sheet, for design review."""
    moments = [2.4, 5.8, 9.9, 15.0, 16.4, 21.4]
    thumb_w, thumb_h = W // 3, H // 3
    for lang, copy in COPY.items():
        sheet = Image.new("RGB", (thumb_w * len(moments), thumb_h), (0, 0, 0))
        for i, t in enumerate(moments):
            sheet.paste(
                render_frame(t, copy)
                .convert("RGB")
                .resize((thumb_w, thumb_h), Image.LANCZOS),
                (i * thumb_w, 0),
            )
        sheet.save(OUT / f"preview-{lang}.png")
        print(f"preview-{lang}.png")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if PREVIEW:
        preview()
        return
    ffmpeg = shutil.which("ffmpeg")
    for lang, copy in COPY.items():
        frames_dir = OUT / f"frames-{lang}"
        frames_dir.mkdir(exist_ok=True)
        count = int(TOTAL * FPS)
        for n in range(count):
            render_frame(n / FPS, copy).convert("RGB").save(frames_dir / f"{n:04d}.png")
            if n % 48 == 0:
                print(f"{lang}: frame {n}/{count}", flush=True)
        mp4, gif = (
            OUT / f"petpal-showreel-{lang}.mp4",
            OUT / f"petpal-showreel-{lang}.gif",
        )
        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-loglevel",
                "error",
                "-framerate",
                str(FPS),
                "-i",
                str(frames_dir / "%04d.png"),
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-crf",
                "18",
                "-preset",
                "slow",
                "-movflags",
                "+faststart",
                str(mp4),
            ],
            check=True,
        )
        palette_filter = "fps=15,scale=405:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle"
        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-loglevel",
                "error",
                "-framerate",
                str(FPS),
                "-i",
                str(frames_dir / "%04d.png"),
                "-filter_complex",
                palette_filter,
                "-loop",
                "0",
                str(gif),
            ],
            check=True,
        )
        for path in (mp4, gif):
            print(f"{path.name}: {path.stat().st_size / 1048576:.1f} MB")


if __name__ == "__main__":
    main()
