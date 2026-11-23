#!/usr/bin/env python3
"""Build a ready-to-host copy of the quotation tool for your team's phones.

    python3 tools/build_team.py "https://script.google.com/macros/s/.../exec" [out_dir]

The Google Sheet link is built in, so team members just open the web address.
Host the output folder anywhere static (Netlify Drop, GitHub Pages, your own server).
"""
import shutil, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
url = sys.argv[1].strip()
assert url.startswith("https://script.google.com/") and url.endswith("/exec"), "Expected the Apps Script /exec link"
out = Path(sys.argv[2]) if len(sys.argv) > 2 else root / "dist" / "corebath-team"
if out.exists():
    shutil.rmtree(out)
shutil.copytree(root / "assets", out / "assets")

html = (root / "index.html").read_text()
html = html.replace('data-mode="admin" data-brand="Jaquar" data-package="signature"',
                    'data-mode="admin" data-brand="Jaquar" data-package="signature" data-sheet-url="%s"' % url)
html = html.replace('<title>CoreBath Quotation Builder</title>', '''<title>CoreBath Quotation Builder</title>
  <meta name="theme-color" content="#0e4c52">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="CoreBath Quote">
  <meta name="robots" content="noindex, nofollow">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="icon" href="icon-192.png">
  <link rel="apple-touch-icon" href="icon-192.png">''')
assert 'data-sheet-url' in html
(out / "index.html").write_text(html)
(out / "manifest.webmanifest").write_text('''{
  "name": "CoreBath Quotation Builder",
  "short_name": "CoreBath Quote",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0e4c52",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
''')
(out / "robots.txt").write_text("User-agent: *\nDisallow: /\n")

def icon(size):
    im = Image.new("RGB", (size, size), "#0e4c52")
    d = ImageDraw.Draw(im)
    d.rectangle([0, int(size * .78), size, int(size * .80)], fill="#c49a54")
    try:
        f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(size * .42))
    except OSError:
        f = ImageFont.load_default()
    d.text((size / 2, size * .42), "CB", fill="white", font=f, anchor="mm")
    im.save(out / ("icon-%d.png" % size))
icon(192); icon(512)
print("Built", out)
