from PIL import Image
import os

source_path = "assets/icon_original.png"
sizes = [16, 48, 128]

if not os.path.exists(source_path):
    print(f"Error: {source_path} not found.")
    exit(1)

img = Image.open(source_path)

for size in sizes:
    resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
    output_path = f"assets/icon_{size}.png"
    resized_img.save(output_path, "PNG")
    print(f"Created {output_path}")

print("Icon resizing complete.")
