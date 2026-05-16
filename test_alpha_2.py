import urllib.request
from PIL import Image
import io

url = "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/b8fb0ce87f39e3e3d250593fd8d421956a39da330ab4f9783ef97f9a9ee7e0ec.png"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as response:
    im = Image.open(io.BytesIO(response.read())).convert("RGBA")
    print(im.getpixel((0,0)))
