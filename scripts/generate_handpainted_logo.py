from __future__ import annotations

import math
import os
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "branding" / "handpainted"
OUT.mkdir(parents=True, exist_ok=True)
WINDOWS_FONTS = Path(os.environ.get("WINDIR", os.environ.get("SystemRoot", ""))) / "Fonts"

SIZE = 2048
RADIUS = 330

DEEP = (8, 37, 34, 255)
TEAL = (15, 55, 49, 255)
TEAL_LIGHT = (30, 80, 69, 255)
INK_LINE = (5, 22, 21, 255)
GOLD_DARK = (151, 103, 37, 255)
GOLD = (224, 171, 55, 255)
GOLD_LIGHT = (250, 222, 137, 255)
CORAL_DARK = (157, 51, 42, 255)
CORAL = (228, 83, 66, 255)
CORAL_LIGHT = (252, 122, 93, 255)
CREAM = (248, 226, 164, 255)


def rounded_mask(size=SIZE, radius=RADIUS):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (16, 16, size - 17, size - 17),
        radius=radius,
        fill=255,
    )
    return mask


def create_background(mask: Image.Image):
    background = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    gradient = Image.new("RGBA", (SIZE, SIZE), DEEP)
    draw = ImageDraw.Draw(gradient)
    for y in range(SIZE):
        ratio = y / SIZE
        if ratio < 0.62:
            color = (
                int(7 + 8 * ratio),
                int(35 + 21 * ratio),
                int(32 + 17 * ratio),
                255,
            )
        else:
            color = (
                int(15 - 3 * (ratio - 0.62)),
                int(56 - 8 * (ratio - 0.62)),
                int(49 - 9 * (ratio - 0.62)),
                255,
            )
        draw.line((0, y, SIZE, y), fill=color)

    waves = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    wdraw = ImageDraw.Draw(waves)
    rng = random.Random(20261106)
    for _ in range(2600):
        y = rng.randint(25, SIZE - 30)
        x = rng.randint(-100, SIZE - 20)
        length = rng.randint(28, 185)
        amplitude = rng.uniform(1.0, 5.0)
        phase = rng.uniform(0, math.tau)
        points = []
        for step in range(10):
            ratio = step / 9
            xx = x + length * ratio
            yy = y + math.sin(phase + ratio * math.tau * 0.8) * amplitude
            points.append((xx, yy))
        if rng.random() < 0.08:
            color = (91, 104, 73, rng.randint(25, 52))
        elif rng.random() < 0.3:
            color = (44, 92, 78, rng.randint(20, 50))
        else:
            color = (6, 27, 25, rng.randint(30, 70))
        wdraw.line(points, fill=color, width=rng.choice((2, 2, 3, 4)), joint="curve")

    for points, width, color in [
        (((80, 1510), (340, 1690), (490, 1710)), 10, (57, 91, 72, 75)),
        (((1270, 210), (1570, 250), (1920, 400)), 10, (75, 104, 77, 60)),
        (((1300, 1780), (1570, 1700), (1940, 1510)), 12, (58, 97, 85, 55)),
    ]:
        wdraw.line(points, fill=color, width=width, joint="curve")

    gradient = Image.alpha_composite(gradient, waves.filter(ImageFilter.GaussianBlur(0.45)))
    background.paste(gradient, (0, 0), mask)

    aura = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    adraw = ImageDraw.Draw(aura)
    adraw.ellipse((1240, 330, 1725, 915), fill=(214, 173, 67, 34))
    adraw.ellipse((1310, 390, 1655, 830), fill=(236, 198, 91, 45))
    aura = aura.filter(ImageFilter.GaussianBlur(38))
    background = Image.alpha_composite(background, aura)

    noise = np.random.default_rng(9).normal(0, 4.2, (SIZE, SIZE, 1))
    array = np.asarray(background).astype(np.int16)
    array[:, :, :3] = np.clip(array[:, :, :3] + noise, 0, 255)
    return Image.fromarray(array.astype(np.uint8), "RGBA")


def draw_soft_line(draw: ImageDraw.ImageDraw, points, color, width):
    draw.line(points, fill=color, width=width, joint="curve")


def create_frame():
    frame = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    box = (370, 300, 1685, 1770)

    shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle(
        (box[0] + 22, box[1] + 34, box[2] + 26, box[3] + 38),
        radius=132,
        outline=(3, 15, 14, 145),
        width=118,
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(26))
    frame = Image.alpha_composite(frame, shadow)
    draw = ImageDraw.Draw(frame)

    for offset, width, color in [
        (0, 112, GOLD_DARK),
        (4, 88, GOLD),
        (-8, 46, (239, 190, 71, 255)),
        (12, 22, GOLD_LIGHT),
    ]:
        draw.rounded_rectangle(
            (box[0] + offset, box[1] + offset, box[2] - offset, box[3] - offset),
            radius=145 - offset,
            outline=color,
            width=width,
        )

    midpoint = 1050
    for offset, width, color in [
        (-22, 40, (132, 91, 33, 160)),
        (0, 82, GOLD),
        (9, 32, GOLD_LIGHT),
    ]:
        points = []
        for index in range(100):
            ratio = index / 99
            x = 390 + ratio * 1265
            y = midpoint + math.sin(ratio * math.pi * 3.4 + 0.4) * 12 + offset
            points.append((x, y))
        draw_soft_line(draw, points, color, width)

    return frame


def glyph_mask(char: str, font_size: int, center: tuple[int, int]):
    font = ImageFont.truetype(str(WINDOWS_FONTS / "STKAITI.TTF"), font_size)
    mask = Image.new("L", (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(mask)
    bbox = draw.textbbox((0, 0), char, font=font, stroke_width=28)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    x = center[0] - width / 2 - bbox[0]
    y = center[1] - height / 2 - bbox[1]
    draw.text(
        (x, y),
        char,
        font=font,
        fill=255,
        stroke_width=28,
        stroke_fill=255,
    )
    return mask


def create_coral_glyph():
    mask = glyph_mask("序", 1290, (1030, 1080))
    glyph = Image.new("RGBA", (SIZE, SIZE), CORAL)
    draw = ImageDraw.Draw(glyph)

    for y in range(220, 1880, 7):
        ratio = (y - 220) / 1660
        color = (
            int(CORAL[0] + 13 * math.sin(ratio * math.pi * 3)),
            int(CORAL[1] + 17 * math.sin(ratio * math.pi * 2.1)),
            int(CORAL[2] + 10 * math.cos(ratio * math.pi * 2.5)),
            255,
        )
        draw.line((210, y, 1880, y - 32), fill=color, width=8)

    rng = random.Random(66)
    for _ in range(240):
        x = rng.randint(300, 1770)
        y = rng.randint(260, 1820)
        length = rng.randint(34, 170)
        angle = rng.uniform(-0.35, 0.35)
        draw.line(
            (x, y, x + math.cos(angle) * length, y + math.sin(angle) * length),
            fill=CORAL_LIGHT if rng.random() < 0.35 else CORAL_DARK,
            width=rng.randint(3, 10),
        )

    glyph_layer = Image.composite(
        glyph,
        Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0)),
        mask,
    )

    outline = mask.filter(ImageFilter.MaxFilter(11))
    outline_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    outline_layer.putalpha(outline.point(lambda value: int(value * 0.75)))
    outline_layer = outline_layer.filter(ImageFilter.GaussianBlur(5))
    outline_layer = Image.composite(
        Image.new("RGBA", (SIZE, SIZE), (115, 38, 31, 120)),
        Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0)),
        outline_layer.getchannel("A"),
    )
    return glyph_layer, outline_layer


def create_accent_dot():
    accent = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(accent)
    draw.ellipse((472, 350, 590, 492), fill=CORAL)
    draw.ellipse((484, 366, 565, 456), fill=CORAL_LIGHT)

    for x, y, radius, color in [
        (330, 478, 16, GOLD_LIGHT),
        (1765, 1190, 12, GOLD_LIGHT),
        (1570, 1460, 19, (215, 244, 93, 230)),
        (425, 1610, 9, CREAM),
    ]:
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)

    draw.arc(
        (1440, 900, 1860, 1250),
        200,
        315,
        fill=(249, 218, 118, 100),
        width=20,
    )
    draw.arc(
        (1430, 940, 1780, 1210),
        205,
        305,
        fill=(249, 218, 118, 125),
        width=4,
    )
    return accent


def create_icon():
    mask = rounded_mask()
    canvas = create_background(mask)
    canvas = Image.alpha_composite(canvas, create_frame())

    glyph, outline = create_coral_glyph()
    canvas = Image.alpha_composite(canvas, outline)
    canvas = Image.alpha_composite(canvas, glyph)
    canvas = Image.alpha_composite(canvas, create_accent_dot())

    border = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    bdraw = ImageDraw.Draw(border)
    bdraw.rounded_rectangle(
        (22, 22, SIZE - 23, SIZE - 23),
        radius=RADIUS - 8,
        outline=(2, 14, 13, 220),
        width=5,
    )
    canvas = Image.alpha_composite(canvas, border)
    return canvas.resize((1024, 1024), Image.Resampling.LANCZOS)


def create_presentation(icon: Image.Image):
    canvas = Image.new("RGB", (1660, 1020), (237, 235, 226))
    draw = ImageDraw.Draw(canvas)
    title_font = ImageFont.truetype(str(WINDOWS_FONTS / "msyhbd.ttc"), 44)
    subtitle_font = ImageFont.truetype(str(WINDOWS_FONTS / "msyh.ttc"), 22)
    label_font = ImageFont.truetype(str(WINDOWS_FONTS / "msyhbd.ttc"), 28)

    draw.text((64, 52), "日序 · 青金手绘", font=title_font, fill=(21, 31, 28))
    draw.text(
        (64, 112),
        "沿用模板的深绿纹理、奶油金框与珊瑚手绘笔画；外框为“日”，流动笔画写“序”。",
        font=subtitle_font,
        fill=(99, 108, 101),
    )

    shadow = Image.new("RGBA", (820, 820), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (55, 70, 765, 780), radius=190, fill=(0, 0, 0, 62)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(30))
    canvas.paste(shadow, (80, 180), shadow)

    large = icon.resize((760, 760), Image.Resampling.LANCZOS)
    canvas.paste(large, (110, 170), large)

    draw.text((1040, 290), "主图标", font=label_font, fill=(21, 31, 28))
    icon_192 = icon.resize((192, 192), Image.Resampling.LANCZOS)
    canvas.paste(icon_192, (1040, 350), icon_192)
    icon_48 = icon.resize((48, 48), Image.Resampling.LANCZOS)
    canvas.paste(icon_48, (1280, 420), icon_48)
    draw.text((1040, 585), "1024 / 192 / 48 px", font=subtitle_font, fill=(99, 108, 101))

    swatches = [
        (1040, 670, (8, 37, 34), "深墨绿"),
        (1170, 670, (30, 80, 69), "湖水绿"),
        (1300, 670, (224, 171, 55), "奶油金"),
        (1430, 670, (228, 83, 66), "珊瑚红"),
    ]
    for x, y, color, label in swatches:
        draw.rounded_rectangle((x, y, x + 84, y + 84), radius=18, fill=color)
        draw.text((x, y + 102), label, font=subtitle_font, fill=(79, 88, 81))

    canvas.save(OUT / "rixu-handpainted-presentation.png", quality=96)


def main():
    icon = create_icon()
    icon.save(OUT / "rixu-handpainted-primary-1024.png")
    for size in (512, 192, 48):
        icon.resize((size, size), Image.Resampling.LANCZOS).save(
            OUT / f"rixu-handpainted-primary-{size}.png"
        )
    create_presentation(icon)
    print(f"Wrote hand-painted logo assets to {OUT}")


if __name__ == "__main__":
    main()
