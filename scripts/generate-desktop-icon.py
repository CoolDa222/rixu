from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "app-icon.png"
OUTPUT = ROOT / "electron" / "build" / "icon.ico"

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with Image.open(SOURCE) as image:
    icon = image.convert("RGBA")
    icon.save(
        OUTPUT,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

print(f"Wrote {OUTPUT}")
