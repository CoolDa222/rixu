from __future__ import annotations

import math
import os
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "branding" / "vangogh"
OUT.mkdir(parents=True, exist_ok=True)
WINDOWS_FONTS = Path(os.environ.get("WINDIR", os.environ.get("SystemRoot", ""))) / "Fonts"

SIZE = 2048
INK = (7, 24, 42, 255)
TEAL = (18, 59, 72, 255)
TEAL_LIGHT = (42, 113, 119, 255)
GOLD_DARK = (157, 111, 35, 255)
GOLD = (226, 178, 62, 255)
GOLD_LIGHT = (249, 218, 118, 255)
CREAM = (246, 234, 185, 255)


def mix(a, b, t):
    return tuple(int(a[index] + (b[index] - a[index]) * t) for index in range(4))


def bezier(p0, p1, p2, p3, steps=90):
    points = []
    for index in range(steps):
        t = index / (steps - 1)
        mt = 1 - t
        x = (
            mt**3 * p0[0]
            + 3 * mt**2 * t * p1[0]
            + 3 * mt * t**2 * p2[0]
            + t**3 * p3[0]
        )
        y = (
            mt**3 * p0[1]
            + 3 * mt**2 * t * p1[1]
            + 3 * mt * t**2 * p2[1]
            + t**3 * p3[1]
        )
        points.append((x, y))
    return points


def draw_texture_background() -> Image.Image:
    base = Image.new("RGBA", (SIZE, SIZE), INK)
    draw = ImageDraw.Draw(base)
    for y in range(SIZE):
        ratio = y / SIZE
        if ratio < 0.58:
            color = mix(INK, (12, 48, 62, 255), ratio / 0.58)
        else:
            color = mix((12, 48, 62, 255), (17, 69, 70, 255), (ratio - 0.58) / 0.42)
        draw.line((0, y, SIZE, y), fill=color)

    rng = random.Random(21)
    swirl = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(swirl)

    def curved_band(
        cx,
        cy,
        rx,
        ry,
        start,
        end,
        thickness,
        color,
        bend,
    ):
        points = []
        for index in range(120):
            t = index / 119
            angle = start + (end - start) * t
            wobble = math.sin(t * math.pi * 3.2) * bend
            points.append(
                (
                    cx + math.cos(angle) * (rx + wobble),
                    cy + math.sin(angle) * (ry + wobble * 0.62),
                )
            )
        for offset in (-0.55, 0, 0.55):
            shifted = [(x + offset * thickness * 0.18, y - offset * thickness * 0.15) for x, y in points]
            sdraw.line(shifted, fill=color, width=max(2, int(thickness * (1 - abs(offset) * 0.33))), joint="curve")

    for index in range(19):
        radius = 330 + index * 30
        curved_band(
            SIZE * 0.18,
            SIZE * 0.16,
            radius,
            radius * 0.66,
            -0.3,
            math.pi * 1.55,
            12 + rng.random() * 16,
            (48, 127, 132, 90 if index % 3 else 138),
            22 + rng.random() * 24,
        )

    for index in range(18):
        radius = 360 + index * 26
        curved_band(
            SIZE * 0.9,
            SIZE * 0.88,
            radius,
            radius * 0.58,
            math.pi * 0.7,
            math.pi * 2.18,
            12 + rng.random() * 17,
            (23, 84, 100, 85 if index % 4 else 135),
            18 + rng.random() * 26,
        )

    for index in range(10):
        curved_band(
            SIZE * 0.54,
            SIZE * 0.43,
            620 + index * 20,
            500 + index * 17,
            math.pi * 0.55,
            math.pi * 1.88,
            10 + rng.random() * 12,
            (229, 181, 65, 22 if index % 2 else 38),
            14 + rng.random() * 16,
        )

    base = Image.alpha_composite(base, swirl)

    stars = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    star_draw = ImageDraw.Draw(stars)
    for x, y, radius, alpha in [
        (338, 390, 34, 110),
        (1580, 290, 26, 95),
        (1705, 650, 18, 90),
        (330, 1520, 16, 76),
        (1460, 1480, 22, 85),
    ]:
        for ring in range(5, 0, -1):
            r = radius + ring * 11
            star_draw.ellipse(
                (x - r, y - r, x + r, y + r),
                fill=(249, 218, 118, max(4, alpha // (ring * 2))),
            )
        star_draw.ellipse(
            (x - radius, y - radius, x + radius, y + radius),
            fill=(249, 218, 118, 220),
        )
    base = Image.alpha_composite(base, stars.filter(ImageFilter.GaussianBlur(1.2)))

    noise = np.random.default_rng(7).normal(0, 5.5, (SIZE, SIZE, 1))
    array = np.asarray(base).astype(np.int16)
    array[:, :, :3] = np.clip(array[:, :, :3] + noise, 0, 255)
    return Image.fromarray(array.astype(np.uint8), "RGBA")


def glyph_mask(char: str, font_size: int, center: tuple[int, int]) -> Image.Image:
    font = ImageFont.truetype(str(WINDOWS_FONTS / "STKAITI.TTF"), font_size)
    mask = Image.new("L", (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(mask)
    bbox = draw.textbbox((0, 0), char, font=font, stroke_width=8)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    x = center[0] - width / 2 - bbox[0]
    y = center[1] - height / 2 - bbox[1]
    draw.text((x, y), char, font=font, fill=255, stroke_width=8, stroke_fill=255)
    return mask


def make_glyph_texture() -> Image.Image:
    texture = Image.new("RGBA", (SIZE, SIZE), CREAM)
    draw = ImageDraw.Draw(texture)
    rng = random.Random(91)
    for index in range(180):
        x = rng.randint(320, 1740)
        y = rng.randint(260, 1700)
        length = rng.randint(45, 230)
        angle = rng.uniform(-0.9, 0.9)
        dx = math.cos(angle) * length
        dy = math.sin(angle) * length
        color = GOLD_LIGHT if index % 4 else (255, 248, 213, 255)
        draw.line((x, y, x + dx, y + dy), fill=color, width=rng.randint(4, 13))
    return texture


def draw_brush_frame(layer: Image.Image):
    draw = ImageDraw.Draw(layer)
    box = (320, 235, 1720, 1790)
    for offset, color, width in [
        (0, (249, 218, 118, 250), 88),
        (-10, (226, 178, 62, 235), 64),
        (12, (157, 111, 35, 190), 38),
    ]:
        draw.rounded_rectangle(
            tuple(value + offset for value in box),
            radius=175 + offset,
            outline=color,
            width=width,
        )

    midpoint = 1018
    points = []
    for index in range(90):
        t = index / 89
        x = 355 + (1685 - 355) * t
        y = midpoint + math.sin(t * math.pi * 3.5) * 13
        points.append((x, y))
    for offset, width, color in [
        (-18, 36, (157, 111, 35, 160)),
        (0, 72, (226, 178, 62, 245)),
        (17, 26, (249, 218, 118, 230)),
    ]:
        draw.line(
            [(x, y + offset) for x, y in points],
            fill=color,
            width=width,
            joint="curve",
        )


def create_icon() -> Image.Image:
    base = draw_texture_background()

    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.rounded_rectangle(
        (300, 215, 1740, 1810),
        radius=190,
        outline=(249, 218, 118, 70),
        width=80,
    )
    base = Image.alpha_composite(base, glow.filter(ImageFilter.GaussianBlur(30)))

    frame = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw_brush_frame(frame)
    base = Image.alpha_composite(base, frame)

    glyph = glyph_mask("序", 1240, (1035, 1045))
    shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    shadow.putalpha(glyph.filter(ImageFilter.GaussianBlur(28)).point(lambda value: value * 0.55))
    shadow = Image.composite(
        Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 150)),
        Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0)),
        shadow.getchannel("A"),
    )
    base = Image.alpha_composite(base, shadow)

    texture = make_glyph_texture()
    glyph_layer = Image.composite(
        texture,
        Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0)),
        glyph,
    )
    base = Image.alpha_composite(base, glyph_layer)

    accents = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    adraw = ImageDraw.Draw(accents)
    adraw.arc(
        (230, 1240, 1010, 1990),
        205,
        326,
        fill=(249, 218, 118, 220),
        width=27,
    )
    adraw.arc(
        (1040, 1260, 1890, 2030),
        172,
        302,
        fill=(42, 113, 119, 180),
        width=19,
    )
    for x, y, r, color in [
        (1722, 1716, 38, (215, 244, 93, 255)),
        (295, 310, 16, (249, 218, 118, 235)),
        (1740, 390, 12, (246, 234, 185, 210)),
    ]:
        adraw.ellipse((x - r, y - r, x + r, y + r), fill=color)
    base = Image.alpha_composite(base, accents)

    grain = np.random.default_rng(12).normal(0, 3.2, (SIZE, SIZE, 1))
    array = np.asarray(base).astype(np.int16)
    array[:, :, :3] = np.clip(array[:, :, :3] + grain, 0, 255)
    base = Image.fromarray(array.astype(np.uint8), "RGBA")

    return base.resize((1024, 1024), Image.Resampling.LANCZOS)


def create_presentation(icon: Image.Image):
    canvas = Image.new("RGB", (1640, 980), (232, 230, 220))
    draw = ImageDraw.Draw(canvas)
    title_font = ImageFont.truetype(str(WINDOWS_FONTS / "msyhbd.ttc"), 44)
    subtitle_font = ImageFont.truetype(str(WINDOWS_FONTS / "msyh.ttc"), 22)
    label_font = ImageFont.truetype(str(WINDOWS_FONTS / "msyhbd.ttc"), 28)
    draw.text((64, 52), "日序 · 夜间笔触", font=title_font, fill=(23, 25, 23))
    draw.text(
        (64, 112),
        "以“日”为窗，以“序”为光；漩涡、短笔触与金色点彩共同构成软件符号。",
        font=subtitle_font,
        fill=(102, 105, 98),
    )

    shadow = Image.new("RGBA", (760, 760), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (35, 45, 725, 735),
        radius=165,
        fill=(0, 0, 0, 65),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    canvas.paste(shadow, (104, 190), shadow)

    large = icon.resize((700, 700), Image.Resampling.LANCZOS)
    mask = Image.new("L", (700, 700), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 699, 699), radius=155, fill=255)
    canvas.paste(large, (132, 178), mask)

    draw.text((1000, 285), "主图标", font=label_font, fill=(23, 25, 23))
    icon_192 = icon.resize((192, 192), Image.Resampling.LANCZOS)
    canvas.paste(icon_192, (1000, 350))
    icon_48 = icon.resize((48, 48), Image.Resampling.LANCZOS)
    canvas.paste(icon_48, (1240, 420))
    draw.text((1000, 570), "1024 / 192 / 48 px", font=subtitle_font, fill=(103, 107, 100))

    swatches = [
        (1000, 650, (7, 24, 42), "午夜蓝"),
        (1132, 650, (42, 113, 119), "湖水绿"),
        (1264, 650, (226, 178, 62), "麦田金"),
        (1396, 650, (246, 234, 185), "奶油白"),
    ]
    for x, y, color, label in swatches:
        draw.rounded_rectangle((x, y, x + 76, y + 76), radius=18, fill=color)
        draw.text((x, y + 94), label, font=subtitle_font, fill=(84, 88, 81))

    canvas.save(OUT / "rixu-vangogh-presentation.png", quality=96)


def main():
    icon = create_icon()
    icon.save(OUT / "rixu-vangogh-primary-1024.png")
    for size in (512, 192, 48):
        icon.resize((size, size), Image.Resampling.LANCZOS).save(
            OUT / f"rixu-vangogh-primary-{size}.png"
        )
    create_presentation(icon)
    print(f"Wrote Van Gogh-inspired logo assets to {OUT}")


if __name__ == "__main__":
    main()
