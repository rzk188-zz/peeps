import urllib.request
from PIL import Image
import io

urls = [
    "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/b8fb0ce87f39e3e3d250593fd8d421956a39da330ab4f9783ef97f9a9ee7e0ec.png",
    "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/d6c9d004d3b341f67c68268607caef19fbeeccb4f9f95cda2417c196cea2df44.png",
    "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/2fc54ccbe1fd3c524dfbc1018c0dd5aed917e78234aaa06b7a1ff5116a9b5741.png",
    "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/d8aecec0861f9bc96be156ccced53190e59eb7d90d72ec0715e8bf272771c3a0.png",
    "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/6d1085e9913bb66d73a14f0c758d98d43678a7fe2ce39413a63d34fcacb9ff65.png",
    "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/df45c17cd4eb09cf1485a8f889503890c092c971f61bdd6565265579969e751b.png",
    "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/47fea4ebeea11678ea51567dbf071e9d6fa43883068da4e660ccf522fa5191a9.png",
    "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/79dbca4e4897c7bda30d5e809b01b427e5df66c85da3d1708def721eea36ea9b.png",
    "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/d999eedbf23dbebe25068daf682f407a754957423c89fe462267b63e7cf09dfd.png",
    "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/6a924c94866910cf92ad17dc3544099586b1732dabd987065319e0c74a47180f.png",
    "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/721f278a836a849be8e5383e8b6e1748a579f3bd5c0ccff435a750dee3e776cf.png",
    "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/b80de2941b01a402033cfd24dee24fce192ad40dcd0bd408bdbdac6630523234.png",
    "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/b38731af8f52b568ae4ea68a1fa238bb05a0e269b11068fab116c25d1c420a43.png",
    "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/02ce46608a9849d785290eef44adf0153027b3b3f66289d85fa8e49d25a5585d.png",
    "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/2b20320c13d8e7008966776ae0fa01cf2d89db1b2df15b14eb765d361a469193.png",
    "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/cc59520121504553698730247afd433e0609a23f50e45269015738575027dc5d.png",
    "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/3c92b8bdbed8396cc0cfb8a951e817bd5f2a9eb41dc98d981ce3da1ae198d0ea.png",
    "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/483f13c8ef9a8f22f193ea156af685284ae2ecce2b6ceea64fa219a9083de296.png"
]

for url in urls:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        im = Image.open(io.BytesIO(response.read())).convert("RGBA")
        data = list(im.getdata())
        transparent_pct = sum(1 for p in data if p[3] < 30) / len(data)
        print(f"URL: {url[-15:]} | Transparent %: {transparent_pct:.2f}")
