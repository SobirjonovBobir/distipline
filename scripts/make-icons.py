from pathlib import Path
import subprocess
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "-q"])
    from PIL import Image, ImageDraw, ImageFont

out = Path(r"C:\Users\Bobir\OneDrive\Desktop\distipline-app\public")
icons = out / "icons"
icons.mkdir(parents=True, exist_ok=True)


def make_icon(size: int, path: Path, radius_ratio: float = 0.22) -> None:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    bg = (13, 59, 44, 255)
    r = int(size * radius_ratio)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=bg)
    cx, cy = size * 0.5, size * 0.52
    leaf = [
        (cx, cy - size * 0.28),
        (cx + size * 0.22, cy - size * 0.05),
        (cx + size * 0.08, cy + size * 0.22),
        (cx - size * 0.18, cy + size * 0.05),
    ]
    d.polygon(leaf, fill=(143, 214, 176, 255))
    d.line(
        [(cx - size * 0.02, cy + size * 0.2), (cx - size * 0.02, cy + size * 0.32)],
        fill=(232, 240, 234, 230),
        width=max(2, size // 48),
    )
    try:
        font = ImageFont.truetype("arial.ttf", int(size * 0.34))
    except Exception:
        font = ImageFont.load_default()
    text = "D"
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - tw) / 2, (size - th) / 2 - size * 0.04), text, fill=(247, 250, 248, 255), font=font)
    img.save(path)


def make_splash(w: int, h: int, path: Path) -> None:
    img = Image.new("RGB", (w, h), (232, 240, 234))
    d = ImageDraw.Draw(img)
    for i in range(h):
        t = i / h
        rr = int(232 - 20 * t)
        gg = int(240 - 10 * t)
        bb = int(234 - 8 * t)
        d.line([(0, i), (w, i)], fill=(rr, gg, bb))
    s = min(w, h) // 3
    tmp = icons / "_tmp.png"
    make_icon(s, tmp)
    icon = Image.open(tmp).convert("RGBA")
    img.paste(icon, ((w - s) // 2, int(h * 0.32)), icon)
    try:
        font = ImageFont.truetype("arial.ttf", max(28, w // 14))
        sub = ImageFont.truetype("arial.ttf", max(16, w // 28))
    except Exception:
        font = ImageFont.load_default()
        sub = font
    title = "Discipline"
    bbox = d.textbbox((0, 0), title, font=font)
    tw = bbox[2] - bbox[0]
    d.text(((w - tw) / 2, int(h * 0.32) + s + 24), title, fill=(13, 59, 44), font=font)
    st = "Kunlik intizom"
    bbox = d.textbbox((0, 0), st, font=sub)
    tw = bbox[2] - bbox[0]
    d.text(((w - tw) / 2, int(h * 0.32) + s + 24 + max(36, w // 18)), st, fill=(74, 99, 86), font=sub)
    img.save(path)
    if tmp.exists():
        tmp.unlink()


make_icon(192, icons / "icon-192.png")
make_icon(512, icons / "icon-512.png")
make_icon(180, icons / "apple-touch-icon.png")
make_splash(1280, 720, out / "splash-desktop.png")
make_splash(1170, 2532, out / "splash-mobile.png")
print("icons+splash ok")
