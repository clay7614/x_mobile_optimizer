import os
import asyncio
from playwright.async_api import async_playwright
from PIL import Image

async def convert_svg_to_icons(svg_path, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    svg_abs_path = os.path.abspath(svg_path)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # SVGをHTMLとして読み込む
        with open(svg_abs_path, 'r', encoding='utf-8') as f:
            svg_content = f.read()
        
        await page.set_content(f"""
            <html>
            <body style="margin:0; padding:0; overflow:hidden; background:transparent; display:flex; align-items:center; justify-content:center; width:100vw; height:100vh;">
                <div id="container" style="width:80%; height:80%; display:flex; align-items:center; justify-content:center;">
                    {svg_content}
                </div>
            </body>
            </html>
        """)

        # Container要素を取得
        container_element = await page.query_selector("#container")
        svg_element = await page.query_selector("svg")
        
        # Ensure SVG fills the container
        await page.evaluate("""() => {
            const svg = document.querySelector('svg');
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
        }""")

        sizes = [
            (16, 16, "icon_16.png"),
            (48, 48, "icon_48.png"),
            (128, 128, "icon_128.png"),
            (192, 192, "pwa_icon_192.png"),
            (512, 512, "pwa_icon_512.png")
        ]

        for w, h, name in sizes:
            output_path = os.path.join(output_dir, name)
            print(f"Generating {output_path} ({w}x{h})...")
            
            # ページ全体のサイズをアイコンサイズに変更
            await page.set_viewport_size({"width": w, "height": h})
            
            # スクリーンショットを撮る
            await page.screenshot(path=output_path, omit_background=True)

        await browser.close()

    # ICOファイルの作成
    ico_path = os.path.join(os.path.dirname(output_dir), "favicon.ico")
    print(f"Generating {ico_path}...")
    img = Image.open(os.path.join(output_dir, "icon_128.png"))
    img.save(ico_path, format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128)])

if __name__ == "__main__":
    SVG_SRC = "1492693505-1-twitter_83571.svg"
    ASSETS_DIR = "assets"
    
    if os.path.exists(SVG_SRC):
        asyncio.run(convert_svg_to_icons(SVG_SRC, ASSETS_DIR))
        print("Conversion completed successfully.")
    else:
        print(f"Error: {SVG_SRC} not found.")
