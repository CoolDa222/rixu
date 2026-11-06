from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "branding" / "app-icon" / "rixu-app-icon-source.png"
PUBLIC = ROOT / "public"
RES = ROOT / "android" / "app" / "src" / "main" / "res"
PAPER = (244, 241, 233, 255)


def resize_icon(source: Image.Image, size: int) -> Image.Image:
    return source.resize((size, size), Image.Resampling.LANCZOS)


def circular_icon(source: Image.Image, size: int) -> Image.Image:
    icon = resize_icon(source, size)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    icon.putalpha(mask)
    return icon


def adaptive_foreground(source: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner_size = round(size * 0.78)
    icon = resize_icon(source, inner_size)
    position = ((size - inner_size) // 2, (size - inner_size) // 2)
    canvas.alpha_composite(icon, position)
    return canvas


def make_splash(source: Image.Image, path: Path) -> None:
    with Image.open(path) as image:
        width, height = image.size
    canvas = Image.new("RGBA", (width, height), PAPER)
    icon_size = round(min(width, height) * 0.36)
    icon = resize_icon(source, icon_size)
    x = (width - icon_size) // 2
    y = round((height - icon_size) / 2)
    canvas.alpha_composite(icon, (x, y))
    canvas.convert("RGB").save(path, quality=96)


def main() -> None:
    if not SOURCE.exists():
        raise RuntimeError(f"Missing source icon: {SOURCE}")

    source = Image.open(SOURCE).convert("RGBA")
    if source.size != (1024, 1024):
        source = source.resize((1024, 1024), Image.Resampling.LANCZOS)

    PUBLIC.mkdir(exist_ok=True)
    source.save(PUBLIC / "app-icon.png")
    resize_icon(source, 128).save(PUBLIC / "favicon.png")

    for density, size in {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }.items():
        directory = RES / f"mipmap-{density}"
        directory.mkdir(parents=True, exist_ok=True)
        resize_icon(source, size).save(directory / "ic_launcher.png")
        circular_icon(source, size).save(directory / "ic_launcher_round.png")

    for density, size in {
        "mdpi": 108,
        "hdpi": 162,
        "xhdpi": 216,
        "xxhdpi": 324,
        "xxxhdpi": 432,
    }.items():
        directory = RES / f"mipmap-{density}"
        adaptive_foreground(source, size).save(
            directory / "ic_launcher_foreground.png"
        )

    (RES / "values" / "ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        '    <color name="ic_launcher_background">#F4F1E9</color>\n'
        "</resources>\n",
        encoding="utf-8",
    )

    for splash in sorted(RES.glob("drawable*/splash.png")):
        make_splash(source, splash)

    shutil.copy2(SOURCE, ROOT / "branding" / "app-icon" / "rixu-app-icon-final.png")
    print("Applied app icon to web and Android resources.")


if __name__ == "__main__":
    main()
