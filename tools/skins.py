"""Paint character skins for the Kenney "Animated Characters" base model (CC0).

  tools/.venv/bin/python tools/skins.py [name ...]     -> game/assets/characters/skins/<name>.png

The 1024x1024 skin wraps the body like this (pixels, y down):
  head            x 0-640,   y 0-490   face front centred on x=322, eyes near y=215; hair is the dark surround
  torso + arms    x 0-640,   y 490-1024  back runs up from y=730 to 498; front runs down from y=760 to 1005;
                                          arms are the horizontal band y 644-829 (hands at x=31 and x=610)
  shoes           x 640-824, y 0-523
  hands           x 824-1024, y 130-765
  legs            x 613-1024, y 765-1024  (fronts on the left pair, backs on the right pair)
"""
import sys, os, cv2, numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets-src", "kenney-animated")
OUT = os.path.join(ROOT, "game", "assets", "characters", "skins")
CX = 322


def rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[4:6], 16), int(h[2:4], 16), int(h[0:2], 16)], np.float32)   # BGR


def fill(img, pts, col):
    cv2.fillPoly(img, [np.array(pts, np.int32)], [float(c) for c in rgb(col)], cv2.LINE_AA)


def rect(img, x0, y0, x1, y1, col):
    img[y0:y1, x0:x1] = rgb(col)


def head_from(base, hair, skin=None):
    """Take the head of an existing skin, recolouring its hair (and optionally its skin)."""
    src = cv2.resize(cv2.imread(os.path.join(SRC, base)), (1024, 1024), interpolation=cv2.INTER_AREA).astype(np.float32)
    head = src[:490, :640].copy()
    hair_src = src[20, 320]                                    # top centre is always hair
    d = np.linalg.norm(head - hair_src, axis=2)
    m = np.clip((70 - d) / 30, 0, 1)[..., None]
    head = head * (1 - m) + rgb(hair) * m
    return src, head


def face(img, s):
    """Even out the lower face, then draw this character's brows, facial hair and mouth."""
    skin = img[250, CX - 62].copy()                     # cheek colour
    sk = [float(c) for c in skin]
    hair = rgb(s["hair"])
    # the base skins shade the chin and jaw differently, which reads as a skin-coloured beard: flatten it
    reg = img[236:470, 205:440]
    not_hair = np.linalg.norm(reg - hair, axis=2) > 60
    reg[not_hair] = skin
    img[246:330, 268:376] = skin                        # the base mouth, whatever colour it was painted
    ink = [float(c) for c in rgb(s.get("ink", "#3a1c14"))]
    if s.get("brows"):                                  # replace the base brows with clean ones
        br = img[176:208, 250:395]
        nh = np.linalg.norm(br - hair, axis=2) > 60
        br[nh] = skin
        img[185:209, 262:384] = skin                    # base brows are hair-coloured, so clear them outright
        bc = [float(c) for c in rgb(s.get("brow_color", "#5a341c"))]
        tilt = {"soft": 0, "stern": 9, "worried": -9}[s["brows"]]
        for sx in (-1, 1):
            cv2.ellipse(img, (CX + sx * 35, 197), (19, 6), sx * tilt, 0, 360, bc, -1, cv2.LINE_AA)
    fh = [float(c) for c in rgb(s.get("facial_hair_color", s["hair"]))]
    for kind in s.get("facial_hair", ()):
        if kind == "goatee" or kind == "thin_goatee":   # a beard patch around the mouth with the lips left clear
            ro, hole = ((31, 33), (17, 9)) if kind == "goatee" else ((25, 27), (17, 11))
            cv2.ellipse(img, (CX, 280), ro, 0, 0, 360, fh, -1, cv2.LINE_AA)
            cv2.ellipse(img, (CX, 270), hole, 0, 0, 360, sk, -1, cv2.LINE_AA)
        if kind == "moustache":
            cv2.ellipse(img, (CX - 13, 256), (16, 7), -12, 0, 360, fh, -1, cv2.LINE_AA)
            cv2.ellipse(img, (CX + 13, 256), (16, 7), 12, 0, 360, fh, -1, cv2.LINE_AA)
    mouth = s.get("mouth", "smile")
    my = 268 if any(k.endswith("goatee") for k in s.get("facial_hair", ())) else 262
    if mouth == "smile":
        cv2.ellipse(img, (CX, my - 6), (17, 11), 0, 20, 160, ink, 4, cv2.LINE_AA)
    elif mouth == "flat":
        cv2.line(img, (CX - 11, my + 2), (CX + 11, my + 2), ink, 4, cv2.LINE_AA)
    elif mouth == "smirk":
        cv2.ellipse(img, (CX + 3, my - 5), (14, 9), 0, 15, 120, ink, 4, cv2.LINE_AA)
    if s.get("glasses"):                                # clear round glasses
        k = [30.0, 26.0, 28.0]
        for ex in (CX - 36, CX + 36):
            cv2.ellipse(img, (ex, 218), (27, 19), 0, 0, 360, k, 4, cv2.LINE_AA)
        cv2.line(img, (CX - 10, 214), (CX + 10, 214), k, 4, cv2.LINE_AA)
        cv2.line(img, (CX - 62, 214), (CX - 150, 226), k, 4, cv2.LINE_AA)
        cv2.line(img, (CX + 62, 214), (CX + 150, 226), k, 4, cv2.LINE_AA)
    if s.get("sunglasses"):
        k = [20.0, 16.0, 18.0]
        for ex in (CX - 36, CX + 36):
            cv2.ellipse(img, (ex, 218), (27, 17), 0, 0, 360, k, -1, cv2.LINE_AA)
        cv2.line(img, (CX - 12, 214), (CX + 12, 214), k, 5, cv2.LINE_AA)
        cv2.line(img, (CX - 62, 214), (CX - 150, 226), k, 5, cv2.LINE_AA)
        cv2.line(img, (CX + 62, 214), (CX + 150, 226), k, 5, cv2.LINE_AA)


def torso(img, s):
    top = s["top"]
    rect(img, 0, 490, 640, 1024, top)
    sh = s.get("top_shade")
    if sh:                                                      # darker underside of the arms
        rect(img, 0, 644, 215, 668, sh)
        rect(img, 430, 644, 640, 668, sh)
    cuff = s.get("cuff")
    if cuff:
        rect(img, 0, 630, 62, 840, cuff)
        rect(img, 580, 630, 640, 840, cuff)
    if s.get("short_sleeves"):
        skin = "#f5936f"
        rect(img, 0, 630, 150, 840, skin)
        rect(img, 492, 630, 640, 840, skin)
    belt = s.get("belt", "#2a2326")
    rect(img, 150, 490, 495, 512, belt)                         # back waist
    rect(img, 150, 992, 495, 1024, belt)                        # front waist
    skin = [float(c) for c in img[300, CX]]
    if s.get("jacket"):
        j, lapel = s["jacket"], s.get("lapel", s["jacket"])
        rect(img, 0, 490, 640, 1024, j)
        fill(img, [(CX - 34, 742), (CX + 34, 742), (CX + 16, 905), (CX - 16, 905)], s["shirt"])          # shirt front
        fill(img, [(CX - 34, 742), (CX - 62, 760), (CX - 16, 905)], lapel)
        fill(img, [(CX + 34, 742), (CX + 62, 760), (CX + 16, 905)], lapel)
        cv2.line(img, (CX - 34, 742), (CX - 16, 905), [float(c) for c in rgb(s.get("seam", "#1b2238"))], 3, cv2.LINE_AA)
        cv2.line(img, (CX + 34, 742), (CX + 16, 905), [float(c) for c in rgb(s.get("seam", "#1b2238"))], 3, cv2.LINE_AA)
        cv2.line(img, (CX, 905), (CX, 1000), [float(c) for c in rgb(s.get("seam", "#1b2238"))], 3, cv2.LINE_AA)
        for by in (930, 965):
            cv2.circle(img, (CX + 9, by), 5, [float(c) for c in rgb(s.get("seam", "#1b2238"))], -1, cv2.LINE_AA)
        if cuff:
            rect(img, 0, 630, 44, 840, cuff)
            rect(img, 596, 630, 640, 840, cuff)
    # neck opening and collar
    cv2.ellipse(img, (CX, 748), (26, 20), 0, 0, 360, skin, -1, cv2.LINE_AA)
    collar = s.get("collar")
    if collar:
        fill(img, [(CX - 40, 735), (CX - 4, 770), (CX - 30, 792), (CX - 52, 752)], collar)
        fill(img, [(CX + 40, 735), (CX + 4, 770), (CX + 30, 792), (CX + 52, 752)], collar)
        cv2.polylines(img, [np.array([(CX - 40, 735), (CX - 4, 770), (CX - 30, 792)], np.int32)], False, [float(c) for c in rgb(s.get("collar_line", "#6f97c9"))], 2, cv2.LINE_AA)
        cv2.polylines(img, [np.array([(CX + 40, 735), (CX + 4, 770), (CX + 30, 792)], np.int32)], False, [float(c) for c in rgb(s.get("collar_line", "#6f97c9"))], 2, cv2.LINE_AA)
    tie = s.get("tie")
    if tie:
        bottom = 985 if not s.get("jacket") else 900
        shape = np.array([(CX - 11, 782), (CX + 11, 782), (CX + 21, bottom - 22), (CX, bottom), (CX - 21, bottom - 22)], np.int32)
        cv2.fillPoly(img, [shape], [float(c) for c in rgb(tie)], cv2.LINE_AA)
        if s.get("tie_stripe"):
            mask = np.zeros(img.shape[:2], np.uint8)
            cv2.fillPoly(mask, [shape], 255)
            stripes = np.zeros_like(mask)
            for y in range(790, bottom + 40, 26):
                cv2.line(stripes, (CX - 40, y + 22), (CX + 40, y - 22), 255, 7, cv2.LINE_AA)
            m = ((mask > 0) & (stripes > 0))
            img[m] = rgb(s["tie_stripe"])
        fill(img, [(CX - 13, 766), (CX + 13, 766), (CX + 10, 786), (CX - 10, 786)], s.get("knot", tie))       # knot
    camo = s.get("camo")
    if camo:                                                    # camouflage blobs over the plain shirt colour
        reg = img[490:1024, 0:640]
        keep = np.all(np.abs(reg - rgb(top)) < 2, axis=2)
        ov = reg.copy()
        rng = np.random.default_rng(7)
        for i in range(150):
            c = [float(v) for v in rgb(camo[i % len(camo)])]
            cv2.ellipse(ov, (int(rng.integers(0, 640)), int(rng.integers(0, 534))), (int(rng.integers(16, 46)), int(rng.integers(9, 22))),
                        float(rng.integers(0, 180)), 0, 360, c, -1, cv2.LINE_AA)
        reg[keep] = ov[keep]
    plaid = s.get("plaid")
    if plaid:
        reg = img[490:1024, 0:640]
        keep = np.all(np.abs(reg - rgb(top)) < 2, axis=2)
        ov = reg.copy()
        for x in range(8, 640, 46):
            ov[:, x:x + 12] = ov[:, x:x + 12] * 0.45 + rgb(plaid) * 0.55
        for y in range(8, 534, 46):
            ov[y:y + 12, :] = ov[y:y + 12, :] * 0.45 + rgb(plaid) * 0.55
        reg[keep] = ov[keep]


def crop_top(img):
    """A shirt several sizes too small: bare midriff front and back."""
    skin = img[250, CX - 62].copy()
    img[930:1024, 150:495] = skin
    img[490:566, 150:495] = skin
    img[922:930, 150:495] = rgb("#8f2a2e")             # a hard hem so the bare midriff reads as deliberate
    img[566:574, 150:495] = rgb("#8f2a2e")


def legs(img, s):
    rect(img, 613, 765, 1024, 1024, s["trousers"])
    rect(img, 613, 783, 1024, 803, s.get("belt", "#2a2326"))
    if s.get("shorts"):
        rect(img, 613, 900, 1024, 1024, "#f5936f")
    if s.get("socks"):
        rect(img, 613, 975, 1024, 1024, s["socks"])
    if s.get("buckle"):
        for bx in (721, 728):
            rect(img, bx - 6, 785, bx + 12, 801, s["buckle"])


def shoes(img, s):
    rect(img, 640, 0, 824, 523, s.get("sole", "#1d1a1c"))
    up = [float(c) for c in rgb(s["shoes"])]
    for y0 in (150, 325):
        cv2.fillPoly(img, [np.array([(660, y0), (805, y0), (780, y0 + 150), (685, y0 + 150)], np.int32)], up, cv2.LINE_AA)


def paint(name, s):
    src, head = head_from(s["base"], s["hair"])
    img = src.copy()
    img[:490, :640] = head
    skin = img[300, CX].copy()
    img[130:765, 824:1024] = skin                    # bare hands (some base skins wear gloves)
    img[523:765, 640:1024] = skin
    if s.get("skin"):                                  # a different skin tone: shift everything skin-coloured
        d = np.linalg.norm(img - skin, axis=2)
        m = np.clip((60 - d) / 25, 0, 1)[..., None]
        img[:] = img + (rgb(s["skin"]) - skin) * m
    face(img, s)
    if s.get("blindfold"):                             # a band right round the head, over the eyes
        rect(img, 0, 196, 640, 240, s["blindfold"])
    torso(img, s)
    if s.get("crop_top"):
        crop_top(img)
    legs(img, s)
    shoes(img, s)
    os.makedirs(OUT, exist_ok=True)
    cv2.imwrite(os.path.join(OUT, name + ".png"), np.clip(img, 0, 255).astype(np.uint8))
    return img


SKINS = {
    # Mark at the competition: light blue shirt, blue striped tie, grey trousers, brown side-swept hair
    "mark": dict(base="protagonists/Skins/skaterMaleA.png", hair="#7a4a2a", mouth="smile", brows="soft",
                 top="#a9cdf2", top_shade="#93bbe6", collar="#c4def8", tie="#2f62c0", tie_stripe="#9cc0f0", knot="#274f9e",
                 trousers="#50545f", belt="#2a2326", buckle="#c9b25a", shoes="#3a2a22"),
    # Bill in training: purple-grey plaid shirt, short brown hair, reddish goatee
    "bill": dict(base="survivors/Skins/survivorMaleB.png", hair="#5a3a22", mouth="flat", facial_hair=("goatee",),
                 facial_hair_color="#7a4424", top="#a79ab8", plaid="#5d5273", collar="#b9aecb", collar_line="#5d5273",
                 trousers="#3d4a66", belt="#3a2a22", shoes="#4a3626"),
    # Lester: all in black, dark hair, small sunglasses, thin goatee
    "lester": dict(base="protagonists/Skins/criminalMaleA.png", hair="#1c1516", mouth="flat", facial_hair=("thin_goatee",),
                   sunglasses=True, top="#232227", jacket="#232227", shirt="#5c5b63", lapel="#2f2e35", seam="#0c0b0d",
                   collar="#55545c", collar_line="#2a292e", tie="#0b0b0d", knot="#0b0b0d",
                   trousers="#1f1e23", belt="#0c0b0d", shoes="#111013"),
    # Mark at rock bottom: a shirt far too small and enormous shorts
"mark_rb": dict(base="protagonists/Skins/skaterMaleA.png", hair="#7a4a2a", mouth="flat", brows="stern",
                    top="#7a5a3c", jacket="#7a5a3c", shirt="#3a3336", lapel="#6b4d33", seam="#4a3524", cuff="#6b4d33",
                    trousers="#3b5fa8", belt="#3b5fa8", shorts=True, shoes="#f4f1ea", sole="#c9c5bb"),
    # Bill on the day he turns up at Mark's door: dark grey sweater over a white collar, jeans
    "bill_sweater": dict(base="survivors/Skins/survivorMaleB.png", hair="#5a3a22", mouth="flat", facial_hair=("goatee",),
                         facial_hair_color="#7a4424", top="#4d5059", top_shade="#43464e", collar="#f1efe8", collar_line="#c9c5bb",
                         trousers="#5b7fb0", belt="#3a2a22", shoes="#f4f1ea"),
    # The hike. Jack: white long-sleeved top, khaki shorts, dark hair, glasses
    "jack": dict(base="survivors/Skins/survivorMaleB.png", hair="#33261c", mouth="flat", brows="stern", brow_color="#33261c", glasses=True,
                 top="#f1efe8", top_shade="#dcd9cf", trousers="#9a8a62", belt="#5a4a36", shorts=True, shoes="#5a4a36"),
    "mark_hike": dict(base="protagonists/Skins/skaterMaleA.png", hair="#7a4a2a", mouth="smirk", brows="soft",
                      top="#26272e", top_shade="#1d1e24", trousers="#8a7a55", belt="#3a2a22", shoes="#4a3626"),
    "bill_hike": dict(base="survivors/Skins/survivorMaleB.png", hair="#5a3a22", mouth="flat", facial_hair=("goatee",),
                      facial_hair_color="#7a4424", top="#6f8fb8", top_shade="#5f7fa8", collar="#86a3c8", collar_line="#4f6f98",
                      trousers="#8a7a55", belt="#3a2a22", shoes="#4a3626"),
    "elliot": dict(base="protagonists/Skins/criminalMaleA.png", hair="#2b3a6b", mouth="flat", sunglasses=True,
                   top="#3a3d48", jacket="#3a3d48", shirt="#8a8f9c", lapel="#454956", seam="#0c0b0d",
                   trousers="#8a7a55", belt="#0c0b0d", shoes="#3a2a22"),
    # Mark in training: navy T-shirt, very short navy shorts, white socks and trainers
    "mark_tr": dict(base="protagonists/Skins/skaterMaleA.png", hair="#7a4a2a", mouth="smile", brows="soft",
                    top="#33437f", short_sleeves=True, trousers="#27335f", belt="#27335f", shorts=True, socks="#f4f1ea",
                    shoes="#f4f1ea", sole="#c9c5bb"),
    "mark_blind": dict(base="protagonists/Skins/skaterMaleA.png", hair="#7a4a2a", mouth="flat", brows="soft", blindfold="#d9463b",
                       top="#33437f", short_sleeves=True, trousers="#27335f", belt="#27335f", shorts=True, socks="#f4f1ea",
                       shoes="#f4f1ea", sole="#c9c5bb"),
    # Bill at the playground: camouflage T-shirt
    "bill_camo": dict(base="survivors/Skins/survivorMaleB.png", hair="#5a3a22", mouth="flat", facial_hair=("goatee",),
                      facial_hair_color="#7a4424", top="#5d6b3c", camo=("#39452a", "#8a7d55", "#232a1c"), short_sleeves=True,
                      trousers="#3d4a66", belt="#3a2a22", shoes="#4a3626"),
    # The competition. Everyone is in a suit.
    "mark_suit": dict(base="protagonists/Skins/skaterMaleA.png", hair="#7a4a2a", mouth="flat", brows="soft",
                      top="#3d4660", jacket="#3d4660", shirt="#a9cdf2", lapel="#48526e", seam="#1b2238",
                      collar="#c4def8", tie="#2f62c0", tie_stripe="#9cc0f0", knot="#274f9e",
                      trousers="#3d4660", belt="#1b2238", shoes="#1d1a1c"),
    "mark_r2": dict(base="protagonists/Skins/skaterMaleA.png", hair="#7a4a2a", mouth="flat", sunglasses=True,
                    top="#a9cdf2", top_shade="#93bbe6", collar="#c4def8", tie="#2f62c0", tie_stripe="#9cc0f0", knot="#274f9e",
                    trousers="#50545f", belt="#2a2326", buckle="#c9b25a", shoes="#3a2a22"),
    "mark_tie_blind": dict(base="protagonists/Skins/skaterMaleA.png", hair="#7a4a2a", mouth="flat", brows="soft", blindfold="#26262b",
                           top="#a9cdf2", top_shade="#93bbe6", collar="#c4def8", tie="#2f62c0", tie_stripe="#9cc0f0", knot="#274f9e",
                           trousers="#50545f", belt="#2a2326", buckle="#c9b25a", shoes="#3a2a22"),
    "bill_suit": dict(base="survivors/Skins/survivorMaleB.png", hair="#5a3a22", mouth="flat", facial_hair=("goatee",),
                      facial_hair_color="#7a4424", top="#2c3147", jacket="#2c3147", shirt="#f4f1ea", lapel="#363c56", seam="#141828",
                      collar="#ffffff", collar_line="#c9c5bb", tie="#a8323a", tie_stripe="#d98a8f", knot="#8a2830",
                      trousers="#2c3147", belt="#141828", shoes="#1d1a1c"),
    # The Official: dark suit, gold striped tie, sunglasses, clipboard (the game adds the clipboard)
    "official": dict(base="protagonists/Skins/criminalMaleA.png", hair="#15110f", skin="#a9683f", mouth="flat", sunglasses=True,
                     top="#23283c", jacket="#23283c", shirt="#f4f1ea", lapel="#2d3350", seam="#0e1120",
                     collar="#ffffff", collar_line="#c9c5bb", tie="#c9a84a", tie_stripe="#3a4a7a", knot="#b0903a",
                     trousers="#23283c", belt="#0e1120", shoes="#111013"),
    # Security Guyson: grey suit, sunglasses, a laptop he has no business having
    "guard": dict(base="survivors/Skins/survivorMaleB.png", hair="#8a7458", mouth="flat", sunglasses=True,
                  top="#9aa0ab", jacket="#9aa0ab", shirt="#f4f1ea", lapel="#a8aeb9", seam="#5a5f6b",
                  collar="#ffffff", collar_line="#c9c5bb", tie="#26262b", knot="#26262b",
                  trousers="#9aa0ab", belt="#26262b", shoes="#111013"),
    # Mr. Smith of the Underground: grey hair, moustache, grey suit
    "smith": dict(base="survivors/Skins/survivorMaleB.png", hair="#b4b4b8", mouth="flat", facial_hair=("moustache",), facial_hair_color="#8f8f94",
                  sunglasses=True, top="#6b7078", jacket="#6b7078", shirt="#cfe0f2", lapel="#787d86", seam="#3e4148",
                  collar="#e4eefa", collar_line="#9cb4d0", tie="#4a5568", tie_stripe="#aab4c4", knot="#3e4858",
                  trousers="#6b7078", belt="#26262b", shoes="#111013"),
    # the ending at Jack and Amy's
    "amy": dict(base="protagonists/Skins/skaterFemaleA.png", hair="#c8552a", mouth="smile",
                top="#26262b", top_shade="#1d1d22", trousers="#3d4a66", belt="#26262b", shoes="#3a2a22"),
    "jack_home": dict(base="survivors/Skins/survivorMaleB.png", hair="#33261c", mouth="smile", brows="soft", brow_color="#33261c", glasses=True,
                      top="#a8323a", top_shade="#8f2a31", trousers="#7f868d", belt="#7f868d", shoes="#f4f1ea"),
    "mark_casual": dict(base="protagonists/Skins/skaterMaleA.png", hair="#7a4a2a", mouth="smile", brows="soft",
                        top="#8d8a80", plaid="#b9b6aa", collar="#a8a59a", collar_line="#6f6c63",
                        trousers="#3d4a66", belt="#2a2326", shoes="#3a2a22"),
    "jess": dict(base="protagonists/Skins/skaterFemaleA.png", hair="#e8c66a", mouth="smile",
                 top="#3f7a5a", top_shade="#356a4d", trousers="#5b7fb0", belt="#3a2a22", shoes="#4a3626"),
}

if __name__ == "__main__":
    for n in (sys.argv[1:] or list(SKINS)):
        paint(n, SKINS[n])
        print("painted", n)
