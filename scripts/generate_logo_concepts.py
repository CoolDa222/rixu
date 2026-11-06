from __future__ import annotations

import html
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "branding"
OUT.mkdir(exist_ok=True)

INK = "#151816"
INK_SOFT = "#242823"
PAPER = "#F1EFE6"
IVORY = "#F2F0E7"
LIME = "#D7F45D"
MUTED = "#788074"

FONT_PATHS = [
    Path("C:/Windows/Fonts/STKAITI.TTF"),
    Path("C:/Windows/Fonts/FZSTK.TTF"),
    Path("C:/Windows/Fonts/simkai.ttf"),
]


def load_font() -> tuple[TTFont, object, dict[int, str]]:
    for font_path in FONT_PATHS:
        if font_path.exists():
            font = TTFont(font_path)
            return font, font.getGlyphSet(), font.getBestCmap()
    raise RuntimeError("No Chinese calligraphy font was found.")


FONT, GLYPHS, CMAP = load_font()


def glyph_data(char: str):
    glyph_name = CMAP[ord(char)]
    glyph = GLYPHS[glyph_name]
    pen = SVGPathPen(GLYPHS)
    glyph.draw(pen)
    bounds_pen = BoundsPen(GLYPHS)
    glyph.draw(bounds_pen)
    if bounds_pen.bounds is None:
        raise RuntimeError(f"Glyph has no bounds: {char}")
    return pen.getCommands(), bounds_pen.bounds


def glyph_group(
    char: str,
    x: float,
    y: float,
    width: float,
    height: float,
    fill: str,
    opacity: float = 1.0,
) -> str:
    path, bounds = glyph_data(char)
    x_min, y_min, x_max, y_max = bounds
    source_w = x_max - x_min
    source_h = y_max - y_min
    scale = min(width / source_w, height / source_h)
    tx = x - x_min * scale
    ty = y + y_max * scale
    return (
        f'<g transform="translate({tx:.3f} {ty:.3f}) scale({scale:.5f} {-scale:.5f})" '
        f'fill="{fill}" opacity="{opacity}">'
        f'<path d="{path}"/></g>'
    )


def svg_document(content: str, size: int = 1024, transparent: bool = False) -> str:
    background = "" if transparent else f'<rect width="{size}" height="{size}" fill="{INK}"/>'
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">
{background}
{content}
</svg>"""


def concept_frame() -> str:
    content = f"""
<rect x="58" y="58" width="908" height="908" rx="220" fill="{INK}"/>
<rect x="82" y="82" width="860" height="860" rx="198" fill="none" stroke="{INK_SOFT}" stroke-width="5"/>
<path d="M 285 242
         C 260 242 242 260 242 285
         L 242 742
         C 242 767 260 785 285 785
         L 739 785
         C 764 785 782 767 782 742
         L 782 285
         C 782 260 764 242 739 242
         Z"
      fill="none" stroke="{IVORY}" stroke-width="62" stroke-linecap="round"/>
<rect x="278" y="489" width="470" height="48" rx="24" fill="{IVORY}"/>
{glyph_group("序", 315, 285, 410, 390, LIME, 0.96)}
<circle cx="803" cy="793" r="29" fill="{LIME}"/>
"""
    return svg_document(content)


def concept_stack() -> str:
    content = f"""
<rect x="58" y="58" width="908" height="908" rx="220" fill="{PAPER}"/>
<circle cx="512" cy="512" r="386" fill="none" stroke="{INK}" stroke-width="5" opacity="0.18"/>
{glyph_group("日", 292, 136, 440, 360, INK)}
<rect x="286" y="492" width="452" height="30" rx="15" fill="{LIME}"/>
{glyph_group("序", 236, 382, 552, 510, INK)}
<circle cx="788" cy="236" r="31" fill="{INK}"/>
"""
    return svg_document(content)


def concept_brush() -> str:
    content = f"""
<circle cx="512" cy="512" r="464" fill="{INK}"/>
<circle cx="512" cy="512" r="420" fill="none" stroke="{INK_SOFT}" stroke-width="5"/>
<path d="M 128 246 C 270 193 345 220 393 310" fill="none" stroke="{LIME}" stroke-width="15" stroke-linecap="round" opacity="0.9"/>
<path d="M 621 800 C 727 764 810 788 893 849" fill="none" stroke="{LIME}" stroke-width="15" stroke-linecap="round" opacity="0.65"/>
{glyph_group("日", 214, 198, 348, 390, IVORY)}
{glyph_group("序", 414, 385, 490, 470, IVORY)}
<path d="M 246 760 C 416 704 606 702 794 746" fill="none" stroke="{LIME}" stroke-width="25" stroke-linecap="round"/>
"""
    return svg_document(content)


def lockup_svg(mark_svg: str) -> str:
    inner = mark_svg.split(">", 1)[1].rsplit("</svg>", 1)[0]
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1560" height="560" viewBox="0 0 1560 560">
<rect width="1560" height="560" rx="62" fill="{PAPER}"/>
<svg x="56" y="56" width="448" height="448" viewBox="0 0 1024 1024">{inner}</svg>
<text x="568" y="250" font-family="'STKaiti', 'KaiTi', serif" font-size="170" fill="{INK}">日序</text>
<text x="574" y="326" font-family="'Segoe UI', 'Microsoft YaHei UI', sans-serif" font-size="28" font-weight="650" fill="{MUTED}" letter-spacing="8">RIXU · LOCAL WORK / LIFE</text>
<rect x="574" y="368" width="650" height="2" fill="{INK}" opacity="0.15"/>
<circle cx="594" cy="414" r="11" fill="{LIME}"/>
<text x="622" y="424" font-family="'Segoe UI', 'Microsoft YaHei UI', sans-serif" font-size="27" fill="{INK}">把每天，安放有序</text>
</svg>"""


def main() -> None:
    concepts = {
        "a-frame": concept_frame(),
        "b-stack": concept_stack(),
        "c-brush": concept_brush(),
    }
    for name, svg in concepts.items():
        (OUT / f"concept-{name}.svg").write_text(svg, encoding="utf-8")

    primary = concepts["a-frame"]
    (OUT / "rixu-logo-primary.svg").write_text(primary, encoding="utf-8")
    (OUT / "rixu-logo-lockup.svg").write_text(lockup_svg(primary), encoding="utf-8")

    cards = []
    titles = {
        "a-frame": ("A · 日框序心", "以“日”为日历外框，把“序”收进其中"),
        "b-stack": ("B · 上下合印", "两字上下咬合，像一枚现代印章"),
        "c-brush": ("C · 笔画连章", "保留书法笔势，以一笔连接两字"),
    }
    for name, svg in concepts.items():
        title, subtitle = titles[name]
        cards.append(
            f"""<article>
  <div class="art">{svg}</div>
  <h2>{html.escape(title)}</h2>
  <p>{html.escape(subtitle)}</p>
</article>"""
        )

    contact = f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; padding: 42px; background: #e9e8e1; font-family: 'Microsoft YaHei UI', sans-serif; color: #171917; }}
  header {{ display: flex; align-items: end; justify-content: space-between; margin-bottom: 28px; }}
  h1 {{ margin: 0; font-size: 34px; }}
  header p {{ margin: 0; color: #777c75; font-size: 14px; }}
  .grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }}
  article {{ padding: 20px; background: #f8f7f1; border: 1px solid #d9d8d0; border-radius: 14px; }}
  .art {{ aspect-ratio: 1; overflow: hidden; border-radius: 12px; background: #e3e2da; }}
  .art svg {{ display: block; width: 100%; height: 100%; }}
  h2 {{ margin: 17px 0 6px; font-size: 18px; }}
  p {{ margin: 0; color: #737770; font-size: 13px; }}
</style>
</head>
<body>
<header><h1>日序 · 软件图案方向</h1><p>深墨 / 暖纸 / 荧光绿 · 1024px</p></header>
<main class="grid">{''.join(cards)}</main>
</body>
</html>"""
    (OUT / "logo-concepts.html").write_text(contact, encoding="utf-8")
    print(f"Wrote logo assets to {OUT}")


if __name__ == "__main__":
    main()
