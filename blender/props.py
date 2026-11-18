"""Stylised low-poly props and rooms for The Estimator game.

  Blender --background --python blender/props.py -- apartment

Everything is built from chunky bevelled primitives with flat colours; the game applies toon shading and outlines.
Units are metres, Z up, the room is viewed from -Y.
"""
import bpy, bmesh, math, os, sys, random
from mathutils import Matrix, Vector, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

_mats = {}


def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def mat(hexcol, emit=0.0, alpha=1.0):
    key = (hexcol, emit, alpha)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new("c_" + hexcol.lstrip("#") + ("_e" if emit else "") + ("_a" if alpha < 1 else ""))
    m.use_nodes = True
    h = hexcol.lstrip("#")
    rgb = [_lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)]
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = 0.9
    if emit:
        b.inputs["Emission Color"].default_value = (*rgb, 1)
        b.inputs["Emission Strength"].default_value = emit
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND"
    _mats[key] = m
    return m


class Build:
    """Collects bevelled primitives into one mesh object with a material per colour."""

    def __init__(self, name, smooth=False):
        self.name = name
        self.smooth = smooth
        self.bm = bmesh.new()
        self.mats = []

    def _slot(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def _merge(self, tmp, col, emit=0.0, alpha=1.0, smooth=None):
        smooth = self.smooth if smooth is None else smooth
        idx = self._slot(mat(col, emit, alpha))
        for f in tmp.faces:
            f.material_index = idx
            f.smooth = smooth
        me = bpy.data.meshes.new("tmp")
        tmp.to_mesh(me)
        tmp.free()
        self.bm.from_mesh(me)
        bpy.data.meshes.remove(me)

    @staticmethod
    def _xf(center, rot):
        return Matrix.Translation(Vector(center)) @ Euler([math.radians(a) for a in rot]).to_matrix().to_4x4()

    def box(self, center, size, col, bevel=0.02, rot=(0, 0, 0), seg=2, **kw):
        t = bmesh.new()
        bmesh.ops.create_cube(t, size=1.0)
        for v in t.verts:
            v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
        b = min(bevel, min(size) * 0.45)
        if b > 0:
            bmesh.ops.bevel(t, geom=t.edges[:], offset=b, segments=seg, profile=0.6, affect="EDGES")
        bmesh.ops.transform(t, matrix=self._xf(center, rot), verts=t.verts)
        self._merge(t, col, **kw)
        return self

    def cyl(self, center, r, h, col, r2=None, seg=14, bevel=0.0, rot=(0, 0, 0), **kw):
        t = bmesh.new()
        bmesh.ops.create_cone(t, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
        if bevel > 0:
            caps = [e for e in t.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6]
            bmesh.ops.bevel(t, geom=caps, offset=min(bevel, h * 0.45), segments=2, profile=0.6, affect="EDGES")
        bmesh.ops.transform(t, matrix=self._xf(center, rot), verts=t.verts)
        self._merge(t, col, **kw)
        return self

    def ball(self, center, radii, col, seg=10, rings=7, rot=(0, 0, 0), **kw):
        t = bmesh.new()
        bmesh.ops.create_uvsphere(t, u_segments=seg, v_segments=rings, radius=1.0)
        for v in t.verts:
            v.co = Vector((v.co.x * radii[0], v.co.y * radii[1], v.co.z * radii[2]))
        bmesh.ops.transform(t, matrix=self._xf(center, rot), verts=t.verts)
        self._merge(t, col, **kw)
        return self

    def prism(self, pts, z0, z1, col, **kw):
        """Extrude a flat outline (list of (x, y)) from z0 to z1."""
        t = bmesh.new()
        lo = [t.verts.new((x, y, z0)) for x, y in pts]
        hi = [t.verts.new((x, y, z1)) for x, y in pts]
        t.faces.new(list(reversed(lo)))
        t.faces.new(hi)
        n = len(pts)
        for i in range(n):
            t.faces.new([lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i]])
        self._merge(t, col, **kw)
        return self

    def done(self, origin=(0, 0, 0)):
        bmesh.ops.translate(self.bm, verts=self.bm.verts, vec=-Vector(origin))
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        o = bpy.data.objects.new(self.name, me)
        o.location = origin
        bpy.context.scene.collection.objects.link(o)
        return o


# ---------- palette ----------
WALL, WALL2, TRIM = "#f3e6c9", "#ecdcb9", "#fbf6ea"
WOOD, WOOD_D, WOOD_L = "#b9824f", "#8a5a34", "#d3a06a"
COUCH, COUCH_D = "#3f8f8a", "#2f6f6c"
DARK, METAL, GLASS = "#2f2b2e", "#9aa3ad", "#bfe3ee"


# ---------- props ----------
def vacuum(name, at, body, accent="#f2c230", yaw=0.0, lean=12.0, scale=1.0):
    x, y, z = at
    b = Build(name)
    b.box((0, -0.06, 0.07), (0.36, 0.30, 0.12), body, bevel=0.04)                        # floor head
    b.box((0, -0.20, 0.045), (0.32, 0.05, 0.05), DARK, bevel=0.015)                      # bumper
    b.box((0, -0.215, 0.085), (0.10, 0.02, 0.035), "#fff3b0", bevel=0.006, emit=1.5)     # headlight
    for sx in (-1, 1):
        b.cyl((sx * 0.19, 0.08, 0.085), 0.085, 0.05, DARK, rot=(0, 90, 0), seg=14)       # wheels
        b.cyl((sx * 0.217, 0.08, 0.085), 0.04, 0.01, METAL, rot=(0, 90, 0), seg=10)      # hubcaps
    b.box((0, 0.07, 0.50), (0.25, 0.18, 0.66), body, bevel=0.07, rot=(-lean, 0, 0), smooth=True)   # body
    b.cyl((0, -0.04, 0.42), 0.096, 0.34, GLASS, rot=(-lean, 0, 0), bevel=0.03, alpha=0.55, seg=16)  # dust canister
    b.cyl((0, -0.04, 0.35), 0.074, 0.15, accent, rot=(-lean, 0, 0), seg=14)              # dust inside
    b.box((0, 0.02, 0.75), (0.20, 0.03, 0.11), accent, bevel=0.012, rot=(-lean, 0, 0))   # badge
    b.box((0, 0.012, 0.75), (0.13, 0.02, 0.035), DARK, bevel=0.006, rot=(-lean, 0, 0))   # logo strip
    b.box((0, 0.09, 0.84), (0.27, 0.20, 0.03), DARK, bevel=0.01, rot=(-lean, 0, 0))      # seam band
    b.cyl((0, 0.20, 0.98), 0.022, 0.42, METAL, rot=(-lean, 0, 0), seg=8)                 # handle tube
    b.box((0, 0.26, 1.20), (0.055, 0.055, 0.17), DARK, bevel=0.022, rot=(-lean - 25, 0, 0))  # grip
    for k in range(7):                                                                    # coiled cord on the back
        b.cyl((0.0, 0.185, 0.50 + k * 0.03), 0.05, 0.016, DARK, rot=(90 - lean, 0, 0), seg=10)
    o = b.done((0, 0, 0))
    o.location = (x, y, z)
    o.scale = (scale, scale, scale)
    o.rotation_euler = (0, 0, math.radians(yaw))
    return o


def light_pool(b, r, col, z=0.026):
    b.cyl((0, 0, z), r, 0.004, col, seg=32, alpha=0.16, emit=0.4)
    b.cyl((0, 0, z + 0.003), r * 0.6, 0.004, col, seg=32, alpha=0.16, emit=0.4)


def floor_lamp(name, at, height=1.5, shade="#f4e3a8", pole=METAL):
    b = Build(name)
    b.cyl((0, 0, 0.02), 0.17, 0.04, DARK, bevel=0.012, seg=18)
    b.cyl((0, 0, height / 2), 0.016, height, pole, seg=8)
    b.cyl((0, 0, height + 0.11), 0.20, 0.27, shade, r2=0.115, seg=18, emit=2.2)
    b.cyl((0, 0, height - 0.03), 0.205, 0.02, TRIM, seg=18)
    light_pool(b, 0.62, shade)
    o = b.done()
    o.location = at
    return o


def table_lamp(name, at, shade="#e58b4a", base="#3f7f86"):
    b = Build(name)
    b.cyl((0, 0, 0.015), 0.07, 0.03, DARK, seg=12)
    b.ball((0, 0, 0.11), (0.06, 0.06, 0.09), base, smooth=True)
    b.cyl((0, 0, 0.29), 0.115, 0.16, shade, r2=0.065, seg=16, emit=2.2)
    o = b.done()
    o.location = at
    return o


def couch(name, at):
    """The brown sectional from the film: a three-seater with a chaise coming forward on the right."""
    b = Build(name, smooth=True)
    C, CD, CL = "#6b4a3a", "#573b2e", "#7b5846"
    b.box((0, 0, 0.20), (2.10, 0.90, 0.26), CD, bevel=0.07, seg=3)                      # base
    b.box((0, 0.36, 0.56), (2.10, 0.24, 0.62), C, bevel=0.10, seg=3)                    # back
    b.box((-0.98, 0, 0.42), (0.26, 0.92, 0.50), C, bevel=0.10, seg=3)                   # left arm
    for i in (-1, 0, 1):
        b.box((i * 0.57, -0.07, 0.40), (0.55, 0.66, 0.18), CL, bevel=0.075, seg=3)      # seat cushions
        b.box((i * 0.57, 0.22, 0.66), (0.54, 0.16, 0.40), CL, bevel=0.075, seg=3, rot=(-8, 0, 0))
    b.box((1.48, -0.55, 0.20), (0.86, 2.0, 0.26), CD, bevel=0.07, seg=3)                # the chaise
    b.box((1.48, -0.62, 0.40), (0.80, 1.80, 0.18), CL, bevel=0.075, seg=3)
    b.box((1.86, -0.55, 0.50), (0.22, 2.0, 0.56), C, bevel=0.10, seg=3)                 # its outer back
    b.box((1.48, 0.36, 0.56), (0.86, 0.24, 0.62), C, bevel=0.10, seg=3)
    b.box((-0.62, 0.02, 0.60), (0.36, 0.14, 0.34), "#c9503b", bevel=0.065, seg=3, rot=(-18, 0, 12))   # the red cushion
    b.box((1.50, 0.10, 0.62), (0.36, 0.14, 0.34), "#8a6a52", bevel=0.065, seg=3, rot=(-18, 0, -10))
    o = b.done()
    o.location = at
    return o


def coffee_table(name, at):
    """Round wooden coffee table, as in the film."""
    b = Build(name)
    b.cyl((0, 0, 0.40), 0.66, 0.07, WOOD_L, seg=36, bevel=0.02)
    b.cyl((0, 0, 0.36), 0.60, 0.03, WOOD, seg=36)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        b.cyl((math.cos(a) * 0.44, math.sin(a) * 0.44, 0.18), 0.04, 0.36, WOOD_D, seg=8)
    b.cyl((0, 0, 0.12), 0.46, 0.03, WOOD, seg=28)
    for k, c in enumerate(["#d9463b", "#f4f1ea", "#3b82c4", "#f2c230"]):               # a stack of Estimation Weekly underneath
        b.box((-0.12 + k * 0.012, 0.02 - k * 0.01, 0.145 + k * 0.014), (0.24, 0.31, 0.012), c, bevel=0.003, rot=(0, 0, k * 7 - 8), seg=1)
    o = b.done()
    o.location = at
    return o


def giant_cookie(name, at):
    """A cookie a foot across, with a bite taken out."""
    random.seed(11)
    b = Build(name)
    R, bite_a, bite_r = 0.152, math.radians(-35), 0.062
    bx, by = math.cos(bite_a) * R, math.sin(bite_a) * R
    pts = []
    for i in range(40):
        a = 2 * math.pi * i / 40
        x, y = math.cos(a) * R * (1 + 0.025 * math.sin(a * 7)), math.sin(a) * R * (1 + 0.025 * math.sin(a * 7))
        d = math.hypot(x - bx, y - by)
        if d < bite_r:                                   # push the outline in around the bite
            k = bite_r / max(d, 1e-4)
            x, y = bx + (x - bx) * k * 0.0 + (x - bx), by + (y - by)
            x, y = bx + (x - bx) / max(d, 1e-4) * bite_r - math.cos(bite_a) * bite_r * 0.9, by + (y - by) / max(d, 1e-4) * bite_r - math.sin(bite_a) * bite_r * 0.9
        pts.append((x, y))
    b.prism(pts, 0.0, 0.046, "#cf9450")
    b.prism([(x * 0.93, y * 0.93) for x, y in pts], 0.046, 0.054, "#dba561")
    n = 0
    while n < 8:
        a, r = random.uniform(0, 6.28), random.uniform(0.02, 0.12)
        x, y = math.cos(a) * r, math.sin(a) * r
        if math.hypot(x - bx, y - by) < bite_r + 0.035:
            continue
        b.ball((x, y, 0.056), (0.026, 0.026, 0.013), "#4a2c1c", seg=7, rings=4)
        n += 1
    for k in range(6):                                   # crumbs by the bite
        b.ball((bx + random.uniform(0.0, 0.07), by + random.uniform(-0.07, 0.03), 0.006), (0.008, 0.008, 0.006), "#cf9450", seg=5, rings=3)
    o = b.done()
    o.location = at
    return o


def shot_glass(name, at):
    b = Build(name)
    b.cyl((0, 0, 0.030), 0.019, 0.056, "#ffffff", r2=0.025, seg=12, emit=0.25)       # milk, nearly to the brim
    b.cyl((0, 0, 0.034), 0.022, 0.068, GLASS, r2=0.029, seg=12, alpha=0.38)           # glass
    b.cyl((0, 0, 0.004), 0.023, 0.008, GLASS, seg=12, alpha=0.7)
    o = b.done()
    o.location = at
    return o


def jelly_bean_jar(name, at, scale=1.0):
    random.seed(4)
    b = Build(name)
    cols = ["#e5484d", "#f5a623", "#f7d94c", "#4cae4f", "#3b82c4", "#8e5bd0", "#f08fb4", "#ff7a1a", "#19b5a5"]
    b.cyl((0, 0, 0.115), 0.086, 0.23, GLASS, bevel=0.02, seg=18, alpha=0.22)     # jar
    b.cyl((0, 0, 0.245), 0.075, 0.035, "#c9482f", bevel=0.01, seg=18)            # lid
    b.ball((0, 0, 0.275), (0.022, 0.022, 0.018), "#c9482f", seg=8, rings=5)
    o = b.done()
    o.location = at
    o.scale = (scale, scale, scale)
    return o


def tiny_tv(name, at, yaw=0.0):
    """The pine entertainment centre from the film, with a very small television in it."""
    b = Build(name)
    P, PD = "#d9a765", "#b9824f"
    b.box((0, 0.05, 0.30), (1.50, 0.50, 0.60), P, bevel=0.02)                     # cupboard base
    for sx in (-0.37, 0.37):
        b.box((sx, -0.205, 0.30), (0.66, 0.02, 0.48), PD, bevel=0.01)
        b.ball((sx - 0.25 * (1 if sx > 0 else -1), -0.225, 0.34), (0.02, 0.02, 0.02), DARK, seg=8, rings=5)
    for sx in (-0.72, 0.72):
        b.box((sx, 0.05, 1.10), (0.06, 0.50, 1.00), P, bevel=0.01)                # uprights
    b.box((0, 0.05, 1.62), (1.56, 0.54, 0.07), P, bevel=0.02)                     # top
    b.box((0, 0.29, 1.10), (1.44, 0.03, 1.00), PD, bevel=0.0)                     # back panel
    b.box((0, 0.05, 1.18), (1.40, 0.48, 0.03), P, bevel=0.0)                      # a shelf
    for k, c in enumerate(["#d9463b", "#3b82c4", "#f2c230", "#4cae4f", "#f4f1ea", "#8e5bd0"]):   # video tapes
        b.box((-0.55 + k * 0.075, 0.0, 1.31), (0.06, 0.26, 0.22), c, bevel=0.006, seg=1)
    b.box((0, -0.02, 0.705), (0.24, 0.20, 0.18), "#d9463b", bevel=0.035, smooth=True)          # the tiny set
    b.box((-0.025, -0.122, 0.71), (0.14, 0.012, 0.115), "#bfeeff", bevel=0.004, emit=2.5)      # screen
    b.cyl((0.075, -0.124, 0.74), 0.012, 0.012, "#f4f1ea", rot=(90, 0, 0), seg=8)
    b.cyl((0.075, -0.124, 0.70), 0.012, 0.012, "#f4f1ea", rot=(90, 0, 0), seg=8)
    b.cyl((-0.05, 0.0, 0.86), 0.004, 0.15, METAL, seg=6, rot=(0, -25, 0))
    b.cyl((0.05, 0.0, 0.86), 0.004, 0.15, METAL, seg=6, rot=(0, 25, 0))
    o = b.done()
    o.location = at
    o.rotation_euler = (0, 0, math.radians(yaw))
    return o


def side_table(name, at):
    b = Build(name)
    b.cyl((0, 0, 0.52), 0.26, 0.045, WOOD, bevel=0.012, seg=20)
    b.cyl((0, 0, 0.26), 0.035, 0.50, WOOD_D, seg=8)
    b.cyl((0, 0, 0.02), 0.16, 0.04, WOOD_D, bevel=0.012, seg=14)
    o = b.done()
    o.location = at
    return o


def plant(name, at):
    random.seed(8)
    b = Build(name)
    b.cyl((0, 0, 0.16), 0.17, 0.32, "#c9643b", r2=0.21, seg=14, bevel=0.012)
    b.cyl((0, 0, 0.315), 0.185, 0.02, "#4a3326", seg=14)
    for i in range(9):
        a = i * 2.4 + random.uniform(-0.2, 0.2)
        tilt = random.uniform(18, 48)
        L = random.uniform(0.45, 0.8)
        cx, cy = math.cos(a) * math.sin(math.radians(tilt)) * L / 2, math.sin(a) * math.sin(math.radians(tilt)) * L / 2
        b.ball((cx, cy, 0.32 + math.cos(math.radians(tilt)) * L / 2), (0.075, 0.022, L / 2), random.choice(["#4cae4f", "#3d9a55", "#62bd5b"]),
               seg=8, rings=6, rot=(0, tilt, math.degrees(a)), smooth=True)
    o = b.done()
    o.location = at
    return o


def bookshelf(name, at, yaw=0.0):
    random.seed(21)
    b = Build(name)
    W, D, Hh = 1.0, 0.30, 1.25
    b.box((0, 0.13, Hh / 2), (W, 0.03, Hh), WOOD_D, bevel=0.0)
    for sx in (-1, 1):
        b.box((sx * (W / 2 - 0.02), 0, Hh / 2), (0.04, D, Hh), WOOD, bevel=0.008)
    for k in range(4):
        z = 0.04 + k * 0.40
        b.box((0, 0, z), (W, D, 0.04), WOOD, bevel=0.008)
        if k < 3:
            x = -W / 2 + 0.07
            while x < W / 2 - 0.12:
                w_, h_ = random.uniform(0.035, 0.07), random.uniform(0.22, 0.33)
                b.box((x + w_ / 2, -0.01, z + 0.02 + h_ / 2), (w_, 0.20, h_), random.choice(["#d9463b", "#3b82c4", "#f2c230", "#4cae4f", "#8e5bd0", "#f4f1ea", "#e2793b"]),
                      bevel=0.004, seg=1, rot=(0, random.choice([0, 0, 0, 6]), 0))
                x += w_ + 0.004
                if random.random() < 0.12:
                    x += 0.12
    o = b.done()
    o.location = at
    o.rotation_euler = (0, 0, math.radians(yaw))
    return o


def room(name, w=6.0, d=5.0, h=2.7, x1=8.0):
    """Mark's home as in the film: cream walls, beige carpet. The living room is x -3..3; the dining area runs on to x1."""
    b = Build(name)
    random.seed(2)
    W2 = x1 + w / 2
    cx = (x1 - w / 2) / 2
    b.box((cx, 0, -0.03), (W2, d, 0.06), "#d8c8ac", bevel=0.0)                    # carpet
    for i in range(60):
        b.box((random.uniform(-w / 2 + 0.3, x1 - 0.3), random.uniform(-d / 2 + 0.2, d / 2 - 0.2), 0.001), (random.uniform(0.2, 0.7), random.uniform(0.1, 0.3), 0.003),
              random.choice(["#d1c0a2", "#dfd0b6"]), bevel=0.0, rot=(0, 0, random.uniform(0, 180)))
    b.box((cx, d / 2 + 0.06, h / 2), (W2 + 0.24, 0.12, h), WALL, bevel=0.0)       # back wall
    b.box((-w / 2 - 0.06, 0, h / 2), (0.12, d, h), WALL2, bevel=0.0)              # left wall
    b.box((cx, d / 2 - 0.012, 0.07), (W2, 0.03, 0.14), TRIM, bevel=0.008)         # skirting
    b.box((-w / 2 + 0.012, 0, 0.07), (0.03, d, 0.14), TRIM, bevel=0.008)
    # dining area: a window with green curtains, a wall shelf, the stair rail
    gx = 6.0
    b.box((gx, d / 2 - 0.005, 1.55), (1.30, 0.03, 1.20), "#bfeaff", bevel=0.0, emit=1.6)
    for dx_ in (-0.67, 0.0, 0.67):
        b.box((gx + dx_, d / 2 - 0.03, 1.55), (0.07, 0.06, 1.30), TRIM, bevel=0.012)
    for dz in (-0.62, 0.0, 0.62):
        b.box((gx, d / 2 - 0.03, 1.55 + dz), (1.40, 0.06, 0.07), TRIM, bevel=0.012)
    b.cyl((gx, d / 2 - 0.09, 2.30), 0.015, 2.0, WOOD_D, rot=(0, 90, 0), seg=8)
    for sx in (-1, 1):
        for k in range(4):
            b.box((gx + sx * (0.74 + k * 0.07), d / 2 - 0.10, 1.50), (0.075, 0.05, 1.60), "#3f6b4f" if k % 2 else "#4a7d5c", bevel=0.02)
    b.box((4.5, d / 2 - 0.09, 1.75), (0.9, 0.18, 0.04), "#d9a765", bevel=0.01)    # wall shelf with trophies
    for k, c in enumerate(["#f2c230", "#c9c5bb", "#f2c230"]):
        b.cyl((4.25 + k * 0.25, d / 2 - 0.09, 1.85), 0.045, 0.16, c, r2=0.07, seg=10)
    for k in range(7):                                                            # stair rail at the far end
        b.cyl((x1 - 0.15, -1.9 + k * 0.3, 0.5), 0.02, 1.0, TRIM, seg=6)
    b.box((x1 - 0.15, -1.0, 1.02), (0.07, 2.1, 0.06), "#b9824f", bevel=0.015)
    # window on the left wall, with curtains
    wy = -0.4
    b.box((-w / 2 + 0.005, wy, 1.55), (0.03, 1.30, 1.20), "#bfeaff", bevel=0.0, emit=1.6)
    for dy in (-0.67, 0.0, 0.67):
        b.box((-w / 2 + 0.03, wy + dy, 1.55), (0.06, 0.07, 1.30), TRIM, bevel=0.012)
    for dz in (-0.62, 0.0, 0.62):
        b.box((-w / 2 + 0.03, wy, 1.55 + dz), (0.06, 1.40, 0.07), TRIM, bevel=0.012)
    b.box((-w / 2 + 0.07, wy, 0.90), (0.14, 1.50, 0.05), TRIM, bevel=0.015)       # sill
    b.cyl((-w / 2 + 0.09, wy, 2.30), 0.015, 1.9, WOOD_D, rot=(90, 0, 0), seg=8)   # curtain rod
    for sy in (-1, 1):
        for k in range(4):
            b.box((-w / 2 + 0.10, wy + sy * (0.72 + k * 0.07), 1.55), (0.05, 0.075, 1.50), "#f1dccb" if k % 2 else "#e9cdb8", bevel=0.02)
            for j in range(5):                                                    # flowers on the curtains
                b.ball((-w / 2 + 0.135, wy + sy * (0.72 + k * 0.07), 0.95 + j * 0.3 + (k % 2) * 0.15), (0.012, 0.03, 0.03), "#c9503b" if (j + k) % 2 else "#6f9a5a", seg=8, rings=5)
    # sun patch on the floor from the window
    b.prism([(-w / 2 + 0.35, wy - 0.75), (-w / 2 + 2.3, wy - 1.35), (-w / 2 + 2.3, wy + 0.05), (-w / 2 + 0.35, wy + 0.65)], 0.001, 0.004,
            "#fff2c2", alpha=0.30, emit=0.8)
    # pictures on the back wall
    b.box((-0.9, d / 2 - 0.02, 1.75), (0.80, 0.04, 0.56), WOOD_D, bevel=0.012)
    b.box((-0.9, d / 2 - 0.045, 1.75), (0.66, 0.02, 0.42), "#6ec3d6", bevel=0.0)
    b.box((-0.9, d / 2 - 0.05, 1.63), (0.66, 0.02, 0.18), "#4cae4f", bevel=0.0)
    b.cyl((-0.72, d / 2 - 0.055, 1.83), 0.06, 0.012, "#f7d94c", rot=(90, 0, 0), seg=12)
    b.box((0.35, d / 2 - 0.02, 1.80), (0.34, 0.04, 0.44), DARK, bevel=0.012)
    b.box((0.35, d / 2 - 0.045, 1.80), (0.24, 0.02, 0.34), "#f08fb4", bevel=0.0)
    # door on the back wall
    dx = 2.75
    b.box((dx, d / 2 - 0.015, 1.03), (0.92, 0.05, 2.06), TRIM, bevel=0.01)
    b.box((dx, d / 2 - 0.045, 1.02), (0.78, 0.03, 1.96), "#c9643b", bevel=0.012)
    for dz in (0.55, 1.45):
        b.box((dx, d / 2 - 0.065, dz), (0.56, 0.015, 0.66), "#b5552f", bevel=0.01)
    b.ball((dx - 0.30, d / 2 - 0.09, 1.02), (0.035, 0.035, 0.035), "#f2c230", seg=8, rings=6, smooth=True)
    # wall socket and light switch
    b.box((-1.9, d / 2 - 0.012, 0.32), (0.09, 0.02, 0.12), TRIM, bevel=0.006)
    b.box((2.12, d / 2 - 0.012, 1.25), (0.08, 0.02, 0.12), TRIM, bevel=0.006)
    return b.done()


def rug(name, at, r=1.25):
    b = Build(name)
    b.cyl((0, 0, 0.008), r, 0.016, "#3f8f8a", seg=72)
    b.cyl((0, 0, 0.012), r * 0.82, 0.018, "#f3e6c9", seg=72)
    b.cyl((0, 0, 0.016), r * 0.66, 0.02, "#e2793b", seg=72)
    for i in range(48):                                                           # fringe
        a = 2 * math.pi * i / 48
        b.box((math.cos(a) * (r + 0.035), math.sin(a) * (r + 0.035), 0.006), (0.09, 0.03, 0.01), "#f3e6c9", bevel=0.0,
              rot=(0, 0, math.degrees(a)))
    o = b.done()
    o.location = at
    return o


def paper_lamp(name, at, h=1.6):
    """The tall paper column lamp from the film."""
    b = Build(name)
    b.cyl((0, 0, 0.02), 0.16, 0.04, DARK, seg=16)
    b.cyl((0, 0, h / 2 + 0.04), 0.14, h, "#fff3cf", seg=14, emit=2.0)
    for k in range(5):
        b.cyl((0, 0, 0.2 + k * (h - 0.3) / 4), 0.146, 0.012, "#d9c79a", seg=14)
    light_pool(b, 0.6, "#fff3cf")
    o = b.done()
    o.location = at
    return o


def dining_chair(name, at, yaw):
    b = Build(name)
    P = "#c9965a"
    b.box((0, 0, 0.45), (0.44, 0.44, 0.05), P, bevel=0.015)
    for sx in (-0.19, 0.19):
        b.box((sx, -0.19, 0.22), (0.045, 0.045, 0.44), P, bevel=0.008)
        b.box((sx, 0.19, 0.48), (0.045, 0.045, 0.96), P, bevel=0.008)
    b.box((0, 0.19, 0.93), (0.42, 0.04, 0.07), P, bevel=0.01)
    b.box((0, 0.19, 0.60), (0.42, 0.04, 0.05), P, bevel=0.01)
    for r in (40, -40):                                                           # the cross back
        b.box((0, 0.19, 0.765), (0.03, 0.03, 0.48), P, bevel=0.0, rot=(0, r, 0))
    o = b.done()
    o.location = at
    o.rotation_euler = (0, 0, math.radians(yaw))
    return o


def dining_table(name, at):
    """The pine kitchen table where Bill tests Mark. Top surface is at z = 0.76."""
    b = Build(name)
    b.box((0, 0, 0.73), (1.9, 1.0, 0.06), "#d9a765", bevel=0.015)
    for k in range(5):
        b.box((0, -0.4 + k * 0.2, 0.761), (1.88, 0.006, 0.002), "#c08f52", bevel=0.0)
    b.box((0, 0, 0.64), (1.6, 0.8, 0.10), "#c9965a", bevel=0.01)
    for sx in (-0.82, 0.82):
        for sy in (-0.40, 0.40):
            b.box((sx, sy, 0.35), (0.08, 0.08, 0.70), "#c9965a", bevel=0.012)
    o = b.done()
    o.location = at
    return o


def chip_case(name, at, yaw=0.0):
    """The aluminium poker-chip case that sits on the table through the training scenes."""
    b = Build(name)
    b.box((0, 0, 0.035), (0.52, 0.26, 0.07), "#aab2ba", bevel=0.012)
    b.box((0, 0, 0.066), (0.48, 0.22, 0.012), "#2f6b4f", bevel=0.0)
    for r in range(2):
        for k in range(10):
            b.cyl((-0.21 + k * 0.046, -0.055 + r * 0.11, 0.085), 0.02, 0.09, ["#d9463b", "#f4f1ea", "#3b82c4", "#2f2b2e", "#4cae4f"][(k + r) % 5], seg=10, rot=(90, 0, 0))
    b.box((0, 0.15, 0.15), (0.52, 0.03, 0.26), "#aab2ba", bevel=0.012, rot=(-15, 0, 0))     # the open lid
    o = b.done()
    o.location = at
    o.rotation_euler = (0, 0, math.radians(yaw))
    return o


def apartment():
    """Mark's home, after the film: brown sectional, round coffee table, pine TV unit, and far too much of everything."""
    room("room")
    couch("couch", (0.3, 1.95, 0))
    coffee_table("coffee_table", (0.3, 0.75, 0))
    giant_cookie("giant_cookie", (0.10, 0.72, 0.435))
    shot_glass("shot_glass", (0.50, 0.50, 0.435))
    side_table("side_table", (2.45, -1.95, 0))
    jelly_bean_jar("jelly_bean_jar", (2.45, -1.95, 0.545), scale=1.5)
    cols = [("#e5484d", "#f7d94c"), ("#3b9be0", "#f4f1ea"), ("#56c25a", "#f7d94c"), ("#a56be0", "#f4f1ea"), ("#ff9330", "#2f2b2e"), ("#19b5a5", "#f4f1ea"), ("#f08fb4", "#2f2b2e")]
    sizes = [1.0, 1.12, 0.92, 1.05, 0.97, 1.1, 0.9]
    spots = [(-2.6, 2.05), (-2.6, 1.4), (-2.6, 0.75), (-1.9, 1.75), (-1.9, 1.1), (-2.6, -0.6), (-1.9, 0.45)]
    for i, (c, a) in enumerate(cols):
        vacuum(f"vacuum_{i + 1}", (spots[i][0], spots[i][1], 0), c, a, yaw=-90 + (i - 3) * 13, scale=sizes[i])
    paper_lamp("lamp_1", (-1.25, 2.2, 0), 1.6)
    floor_lamp("lamp_2", (-0.35, -2.0, 0), 1.45, "#ffc27a")
    floor_lamp("lamp_3", (5.3, 2.15, 0), 1.85, "#fff0d0")
    floor_lamp("lamp_4", (3.0, -0.9, 0), 1.30, "#e9a25a")
    table_lamp("lamp_5", (-2.86, 0.18, 0.925), "#e58b4a")
    table_lamp("lamp_6", (0.72, 1.0, 0.435), "#3a3336", base="#b9824f")
    tiny_tv("tiny_tv", (-1.7, -2.05, 0), yaw=180)
    plant("plant", (-0.75, 2.25, 0))
    bookshelf("bookshelf", (-1.9, 2.33, 0))
    dining_table("dining_table", (5.6, 0.2, 0))
    for k, (x, y, yaw) in enumerate(((5.0, 1.0, 0), (6.2, 1.0, 0), (5.0, -0.6, 180), (6.2, -0.6, 180))):
        dining_chair(f"chair_{k + 1}", (x, y, 0), yaw)
    chip_case("chip_case", (6.25, 0.42, 0.76), yaw=8)
    random.seed(5)
    rims = ["#d9463b", "#3b82c4", "#f2c230", "#4cae4f", "#8e5bd0", "#2f2b2e", "#e2793b", "#19b5a5", "#f08fb4", "#d9a765", "#6f7780", "#a56be0", "#56c25a"]
    spots = [(0.85, 2.38), (1.22, 2.42), (1.62, 2.36), (0.98, 2.02), (1.42, 2.06), (1.78, 1.98), (0.84, 1.66), (1.2, 1.7), (1.6, 1.64),
             (3.95, 2.4), (4.3, 2.38), (4.62, 2.42), (3.55, 2.25)]
    for k, (x, z) in enumerate(spots):                      # clocks all over the wall, none of them agreeing
        clock(f"clock_{k + 1}", (x, 2.47, z), random.uniform(0.11, 0.17), rims[k], random.uniform(0, 6.28), random.uniform(0, 6.28))
    for i in range(23):                                     # a tower of pizza boxes
        pizza_box(f"pizza_{i + 1}", (3.55 + random.uniform(-0.03, 0.03), -1.75 + random.uniform(-0.03, 0.03), i * 0.047),
                  random.uniform(-14, 14))


def clock(name, at, r, rim, a_hour, a_min):
    b = Build(name)
    b.cyl((0, 0, 0), r, 0.05, rim, rot=(90, 0, 0), seg=20)
    b.cyl((0, -0.006, 0), r * 0.84, 0.05, "#fbf6ea", rot=(90, 0, 0), seg=20)
    for a, L, wd in ((a_hour, r * 0.45, 0.022), (a_min, r * 0.7, 0.014)):
        b.box((math.sin(a) * L / 2, -0.036, math.cos(a) * L / 2), (wd, 0.008, L), DARK, bevel=0.0, rot=(0, math.degrees(a), 0))
    b.cyl((0, -0.038, 0), 0.012, 0.012, "#d9463b", rot=(90, 0, 0), seg=8)
    o = b.done()
    o.location = at
    return o


def pizza_box(name, at, yaw):
    b = Build(name)
    b.box((0, 0, 0.022), (0.44, 0.44, 0.042), "#e8d9b5", bevel=0.006, seg=1)
    b.box((0, 0, 0.0445), (0.30, 0.30, 0.004), "#d9463b", bevel=0.0)
    b.cyl((0, 0, 0.0475), 0.09, 0.004, "#fbf6ea", seg=14)
    o = b.done()
    o.location = at
    o.rotation_euler = (0, 0, math.radians(yaw))
    return o


def tree(name, at, h=2.4, col="#3d9a55"):
    b = Build(name)
    b.cyl((0, 0, h * 0.14), h * 0.045, h * 0.28, WOOD_D, seg=8)
    for k, (zz, rr) in enumerate(((0.38, 0.30), (0.60, 0.23), (0.80, 0.15))):
        b.cyl((0, 0, h * zz), h * rr, h * 0.34, col if k % 2 == 0 else "#4cae4f", r2=h * rr * 0.25, seg=9)
    o = b.done()
    o.location = at
    return o


def wood_tree(name, at, h):
    """A thin woodland trunk with a light spring canopy high up, like the Sourlands in the film."""
    b = Build(name)
    b.cyl((0, 0, h * 0.42), 0.07 + h * 0.008, h * 0.84, random.choice(["#6b5a4a", "#7a6a58", "#5c4d40"]), seg=7)
    for k in range(4):
        a = k * 1.7 + random.uniform(0, 1)
        r = random.uniform(0.8, 1.5)
        b.ball((math.cos(a) * 0.8, math.sin(a) * 0.8, h * random.uniform(0.78, 0.98)), (r, r, r * 0.7),
               random.choice(["#8fd05a", "#7cc24e", "#a3dc6a", "#6fb552"]), seg=9, rings=6, smooth=True)
    o = b.done()
    o.location = at
    return o


def cliff():
    """The rocks in the Sourlands where it all went wrong: dark boulders in spring woods. Top at z=0, face at x=2, forest floor at z=-6."""
    random.seed(3)
    greys = ["#77736f", "#8d8884", "#5f5b5a", "#6e6a69"]
    b = Build("plateau")
    b.box((-9, 1, -3.1), (22, 22, 6.2), "#7a7672", bevel=0.3, seg=2)               # the rock mass
    b.box((-9.3, 1, 0.02), (21.0, 21.6, 0.10), "#8a6a45", bevel=0.04)              # leaf litter on top
    for i in range(90):                                                             # undergrowth and fallen leaves
        b.box((random.uniform(-18, 0.6), random.uniform(-9, 11), 0.075), (random.uniform(0.5, 1.6), random.uniform(0.3, 0.9), 0.012),
              random.choice(["#6fb552", "#7cc24e", "#9a7850", "#7b5c3a"]), bevel=0.0, rot=(0, 0, random.uniform(0, 180)))
    b.box((1.5, 1, 0.03), (1.0, 15.4, 0.10), "#8d8884", bevel=0.04)                # bare rock along the edge
    for i in range(60):                                                             # the face is a pile of boulders, not a slab
        yy, zz = random.uniform(-9.5, 11.5), random.uniform(-5.9, -0.3)
        if abs(yy) < 1.7 and -5.2 < zz < -1.2:
            continue
        sz = random.uniform(0.7, 1.9)
        b.box((2.0 + random.uniform(0.0, 0.25), yy, zz), (0.7, sz, sz * random.uniform(0.5, 0.9)), random.choice(greys), bevel=0.16,
              rot=(random.uniform(-14, 14), random.uniform(-8, 8), 0))
    for i in range(26):                                                             # pale lichen
        yy, zz = random.uniform(-6.5, 8.5), random.uniform(-5.6, -0.4)
        b.box((2.39, yy, zz), (0.02, random.uniform(0.15, 0.45), random.uniform(0.1, 0.3)), "#b9c2a8", bevel=0.0, rot=(random.uniform(-30, 30), 0, 0))
    b.box((2.35, 0.0, -2.35), (0.8, 1.5, 0.30), "#8d8884", bevel=0.08)             # the ledge Jack clings to
    b.box((2.25, 0.0, -2.75), (0.6, 1.1, 0.6), "#77736f", bevel=0.1)
    b.done()
    v = Build("valley")                                                            # the forest floor below
    v.box((10, 1, -6.2), (44, 60, 0.4), "#7d6040", bevel=0.0)
    for i in range(60):
        v.box((random.uniform(2.6, 26), random.uniform(-20, 24), -5.995), (random.uniform(0.6, 2.2), random.uniform(0.4, 1.2), 0.012),
              random.choice(["#6fb552", "#7cc24e", "#9a7850", "#6b5236", "#8fd05a"]), bevel=0.0, rot=(0, 0, random.uniform(0, 180)))
    v.done()
    r = Build("rocks")
    r.box((3.5, 0.0, -5.75), (2.2, 1.6, 0.55), "#8d8884", bevel=0.18, rot=(0, 4, 12))   # the flat rock Jack lands on
    for i in range(16):
        x, y, sz = random.uniform(2.6, 9), random.uniform(-9, 9), random.uniform(0.4, 1.3)
        if abs(y) < 1.8 and x < 5.5:
            continue
        r.box((x, y, -6.0 + sz * 0.35), (sz * 1.3, sz, sz * 0.8), random.choice(greys), bevel=sz * 0.2, rot=(8, 6, random.uniform(0, 90)))
    for x, y, sz in [(0.9, 2.1, 0.5), (-0.3, -1.9, 0.38), (1.3, -2.6, 0.3), (1.6, 3.4, 0.36)]:
        r.box((x, y, sz * 0.4), (sz * 1.3, sz, sz * 0.8), "#8d8884", bevel=sz * 0.2, rot=(8, 6, random.uniform(0, 90)))
    r.cyl((7.5, 4.6, -5.8), 0.22, 4.5, "#6b5a4a", seg=8, rot=(90, 0, 25))          # a fallen log
    r.done()
    k = 0
    for (x, y) in [(-1.5, 3.2), (-3.2, 1.2), (-2.4, -2.2), (-0.6, 4.8), (-4.6, 3.6), (-0.2, -3.6), (-5.5, -0.8), (-3.6, 6.0), (-6.5, 2.4), (-2.0, -5.0),
                   (-7.0, 5.5), (-4.8, -3.8), (-8.2, 0.6), (-1.2, 7.2)]:
        k += 1
        wood_tree(f"tree_{k}", (x, y, 0.05), random.uniform(4.2, 5.6))
    for i in range(34):                                                             # deeper woods behind
        k += 1
        wood_tree(f"tree_{k}", (random.uniform(-16, -2.5), random.uniform(-9, 12), 0.05), random.uniform(4.5, 7.5))
    for i in range(34):                                                             # woods on the forest floor, kept out of the camera's line to the rock
        x, y = random.uniform(3.5, 26), random.uniform(-16, 22)
        if y < 2.6 and y > -12 and x < 14:
            continue
        k += 1
        wood_tree(f"tree_{k}", (x, y, -6.0), random.uniform(8, 12))


# ---------- the playground (Level 2), after the training montage in the film ----------
PLAY_GREEN, PLAY_GREEN_L = "#2f8a55", "#49b06c"


def _spring(b):
    b.cyl((0, 0, 0.02), 0.13, 0.04, DARK, seg=12)
    b.cyl((0, 0, 0.16), 0.045, 0.28, "#55595f", seg=8)
    for k in range(4):
        b.cyl((0, 0, 0.07 + k * 0.06), 0.085, 0.025, "#3b3e44", seg=12)


def rider(name, at, kind):
    """A spring rider facing -Y. Its origin is on the ground under the spring so the game can rock it."""
    b = Build(name)
    _spring(b)
    if kind == "horse":
        b.box((0, 0.02, 0.42), (0.24, 0.66, 0.26), "#c08a52", bevel=0.07)
        b.box((0, -0.34, 0.52), (0.18, 0.22, 0.30), "#c08a52", bevel=0.06, rot=(-25, 0, 0))
        b.box((0, -0.45, 0.47), (0.15, 0.16, 0.13), "#5c3620", bevel=0.04)
        b.box((0, 0.04, 0.565), (0.26, 0.30, 0.06), "#d9463b", bevel=0.025)
        for sx in (-1, 1):
            b.box((sx * 0.06, -0.30, 0.67), (0.045, 0.05, 0.08), "#5c3620", bevel=0.015)
            b.ball((sx * 0.092, -0.38, 0.56), (0.02, 0.03, 0.03), "#fbf6ea", seg=8, rings=5)
        b.cyl((0, -0.22, 0.60), 0.016, 0.34, DARK, seg=6, rot=(0, 90, 0))
    elif kind in ("duck", "duck_green"):
        body, wing = ("#f2c230", "#e0a91c") if kind == "duck" else ("#49b06c", "#f2c230")
        b.ball((0, 0.04, 0.44), (0.15, 0.32, 0.15), body, seg=12, rings=8)
        b.ball((0, -0.22, 0.58), (0.11, 0.12, 0.11), body, seg=12, rings=8)
        b.box((0, -0.36, 0.56), (0.11, 0.12, 0.035), "#e2793b", bevel=0.015)
        b.box((0, 0.34, 0.50), (0.12, 0.12, 0.10), body, bevel=0.03, rot=(35, 0, 0))
        for sx in (-1, 1):
            b.ball((sx * 0.145, 0.06, 0.45), (0.03, 0.16, 0.08), wing, seg=8, rings=6)
            b.ball((sx * 0.085, -0.29, 0.61), (0.02, 0.025, 0.025), DARK, seg=8, rings=5)
        b.cyl((0, -0.12, 0.60), 0.016, 0.34, DARK, seg=6, rot=(0, 90, 0))
    else:                                                                     # aeroplane
        b.ball((0, 0, 0.44), (0.12, 0.38, 0.12), "#fbf6ea", seg=12, rings=8)
        b.box((0, 0.0, 0.42), (0.74, 0.20, 0.035), "#3b82c4", bevel=0.015)
        b.box((0, 0.33, 0.52), (0.035, 0.14, 0.17), "#3b82c4", bevel=0.012)
        b.box((0, 0.33, 0.46), (0.30, 0.10, 0.03), "#3b82c4", bevel=0.012)
        b.ball((0, -0.37, 0.44), (0.06, 0.05, 0.06), "#d9463b", seg=8, rings=6)
        b.cyl((0, -0.06, 0.585), 0.016, 0.30, DARK, seg=6, rot=(0, 90, 0))
    o = b.done()
    o.location = at
    return o


def whale(name, at, yaw=0.0):
    """The big green whale from the film."""
    b = Build(name, smooth=True)
    b.ball((0, 0, 0.48), (1.05, 0.52, 0.46), PLAY_GREEN_L, seg=16, rings=10)
    b.ball((0.55, 0, 0.42), (0.62, 0.50, 0.40), PLAY_GREEN_L, seg=14, rings=9)
    b.box((-1.05, 0, 0.62), (0.55, 0.16, 0.22), PLAY_GREEN_L, bevel=0.07, rot=(0, -28, 0))
    b.box((-1.32, 0, 0.82), (0.16, 0.74, 0.30), PLAY_GREEN_L, bevel=0.06, rot=(0, -20, 0))
    b.box((0.75, 0, 0.20), (0.75, 0.86, 0.10), PLAY_GREEN, bevel=0.04)                         # the mouth line
    for sy in (-1, 1):
        b.ball((0.62, sy * 0.44, 0.56), (0.15, 0.06, 0.15), "#fbf6ea", seg=12, rings=8)
        b.ball((0.66, sy * 0.48, 0.55), (0.08, 0.04, 0.08), DARK, seg=10, rings=6)
        b.box((0.0, sy * 0.52, 0.30), (0.45, 0.10, 0.16), PLAY_GREEN, bevel=0.05, rot=(sy * 25, 0, 0))
    for sx in (-0.25, 0.15):                                                                   # grab handles on its back
        b.cyl((sx, 0, 0.98), 0.03, 0.56, PLAY_GREEN, seg=8, rot=(90, 0, 0), smooth=False)
        for sy in (-1, 1):
            b.cyl((sx, sy * 0.27, 0.90), 0.03, 0.2, PLAY_GREEN, seg=8, smooth=False)
    o = b.done()
    o.location = at
    o.rotation_euler = (0, 0, math.radians(yaw))
    return o


def toy_car(name, at, yaw=0.0):
    """The little pedal car Bill squeezes into."""
    b = Build(name)
    b.box((0, 0, 0.30), (1.25, 0.66, 0.34), "#f3e9c6", bevel=0.09)
    b.box((0.36, 0, 0.47), (0.50, 0.60, 0.12), "#f3e9c6", bevel=0.05)                          # bonnet
    b.box((-0.50, 0, 0.50), (0.22, 0.60, 0.14), "#f3e9c6", bevel=0.05)                         # boot
    b.box((-0.08, 0, 0.44), (0.50, 0.46, 0.10), "#5a4a3c", bevel=0.02)                         # the seat well
    b.box((0, -0.335, 0.30), (0.9, 0.012, 0.09), "#f2c230", bevel=0.0)                         # side stripes
    b.box((0, 0.335, 0.30), (0.9, 0.012, 0.09), "#f2c230", bevel=0.0)
    b.box((0.635, 0, 0.30), (0.03, 0.44, 0.10), DARK, bevel=0.01)                              # grille
    for sy in (-1, 1):
        b.ball((0.63, sy * 0.24, 0.36), (0.03, 0.07, 0.07), "#fff3b0", seg=8, rings=6)
        for sx in (-0.4, 0.4):
            b.cyl((sx, sy * 0.35, 0.16), 0.16, 0.10, DARK, seg=14, rot=(90, 0, 0), bevel=0.02)
            b.cyl((sx, sy * 0.405, 0.16), 0.07, 0.02, "#d9463b", seg=10, rot=(90, 0, 0))
    b.cyl((0.20, 0, 0.60), 0.012, 0.22, DARK, seg=6, rot=(0, -35, 0))                          # steering column
    b.cyl((0.14, 0, 0.69), 0.10, 0.025, DARK, seg=12, rot=(0, 55, 0))
    b.cyl((-0.52, 0.2, 0.66), 0.05, 0.10, "#d9463b", seg=10)                                   # a light on the back
    o = b.done()
    o.location = at
    o.rotation_euler = (0, 0, math.radians(yaw))
    return o


def crawl_tube(name, x0, x1, y, r=0.9):
    """A green tube to run through, lying along X."""
    b = Build(name, smooth=True)
    L, cx = x1 - x0, (x0 + x1) / 2
    b.cyl((cx, y, r), r, L, PLAY_GREEN_L, seg=24, rot=(0, 90, 0))
    for k in range(6):
        b.cyl((x0 + L * (k + 0.5) / 6, y, r), r + 0.035, 0.12, PLAY_GREEN, seg=24, rot=(0, 90, 0))
    for xe in (x0, x1):
        b.cyl((xe, y, r), r + 0.07, 0.16, PLAY_GREEN, seg=24, rot=(0, 90, 0))
        b.cyl((xe + (0.085 if xe == x1 else -0.085), y, r), r - 0.07, 0.012, "#16301f", seg=24, rot=(0, 90, 0), smooth=False)
    for k in range(4):                                                                         # portholes
        b.cyl((x0 + L * (k + 0.5) / 4, y - r + 0.01, r + 0.2), 0.14, 0.05, "#bfe3ee", seg=12, rot=(90, 0, 0), smooth=False)
        b.cyl((x0 + L * (k + 0.5) / 4, y - r + 0.03, r + 0.2), 0.17, 0.04, PLAY_GREEN, seg=12, rot=(90, 0, 0), smooth=False)
    for xe in (x0 + 0.5, x1 - 0.5):
        b.box((xe, y, 0.06), (0.3, 2 * r + 0.3, 0.12), PLAY_GREEN, bevel=0.03, smooth=False)
    return b.done()


def swing_frame(name, x, y0, y1, h=2.45):
    """Swing set whose top bar runs along Y; the swings move along X. The game adds the moving swing."""
    b = Build(name)
    col = "#2f6b4f"
    b.cyl((x, (y0 + y1) / 2, h), 0.06, y1 - y0 + 0.2, col, seg=10, rot=(90, 0, 0))
    for yy in ((y0 + y1) / 2 + 0.05, y1):                                    # upright posts, so nothing crosses the swing's path when seen side-on
        b.cyl((x, yy, h / 2), 0.07, h, col, seg=10)
        b.cyl((x, yy, 0.03), 0.14, 0.06, DARK, seg=10)
        b.cyl((x, yy, h), 0.09, 0.09, col, seg=10)
    return b.done()


def hanging_swing(name, x, y, h=2.45, L=1.95):
    b = Build(name)
    for sy in (-1, 1):
        b.cyl((x, y + sy * 0.22, h - L / 2), 0.014, L, "#55595f", seg=6)
    b.box((x, y, h - L), (0.20, 0.52, 0.05), "#6f7780", bevel=0.02)
    return b.done()


def house(name, at, w, col, roof):
    b = Build(name)
    b.box((0, 0, 1.6), (w, 5, 3.2), col, bevel=0.05)
    b.prism([(-w / 2 - 0.3, -2.8), (w / 2 + 0.3, -2.8), (w / 2 + 0.3, 2.8), (-w / 2 - 0.3, 2.8)], 3.2, 3.35, roof)
    b.box((0, 0, 3.9), (w + 0.2, 3.6, 1.1), roof, bevel=0.3)
    for k in range(int(w // 2)):
        b.box((-w / 2 + 1.1 + k * 2, -2.52, 2.0), (0.8, 0.05, 0.9), "#bfe3ee", bevel=0.01)
    o = b.done()
    o.location = at
    return o


def conifer(name, at, h, col):
    b = Build(name)
    if int(at[0] * 7 + at[1] * 3) % 3 == 0:                 # every third tree is a round leafy one, as in the film's hedge line
        b.cyl((0, 0, h * 0.2), h * 0.05, h * 0.4, WOOD_D, seg=8)
        for (dx, dy, zz, rr) in ((0, 0, 0.62, 0.30), (0.2, 0.05, 0.48, 0.24), (-0.2, -0.05, 0.5, 0.25), (0.05, 0.1, 0.8, 0.2)):
            b.ball((dx * h, dy * h, zz * h), (rr * h, rr * h, rr * h * 0.85), "#4cae4f" if rr > 0.24 else "#5ab85a", seg=10, rings=7, smooth=True)
        o = b.done()
        o.location = at
        return o
    b.cyl((0, 0, h * 0.08), h * 0.04, h * 0.16, WOOD_D, seg=8)
    for k, (zz, rr) in enumerate(((0.30, 0.30), (0.50, 0.24), (0.68, 0.18), (0.86, 0.11))):
        b.cyl((0, 0, h * zz), h * rr, h * 0.30, col if k % 2 == 0 else "#3c8f58", r2=h * rr * 0.2, seg=9)
    o = b.done()
    o.location = at
    return o


def playground():
    random.seed(11)
    g = Build("grass")
    g.box((0, 6, -0.05), (120, 90, 0.1), "#86c95e", bevel=0.0)
    for i in range(40):                                                         # darker tufts so the lawn is not one flat colour
        g.box((random.uniform(-30, 30), random.uniform(-12, 22), 0.004), (random.uniform(0.8, 2.6), random.uniform(0.5, 1.4), 0.006),
              "#79bd53", bevel=0.0, rot=(0, 0, random.uniform(0, 180)))
    g.box((0, -9.5, 0.006), (120, 1.6, 0.008), "#cfc6b4", bevel=0.0)             # a footpath in front
    g.done()
    p = Build("pad")                                                            # the gravel pad everything stands on; top at z = 0.04
    p.box((0, 0.5, 0.0), (20, 12, 0.08), "#d8ccb0", bevel=0.0)
    for i in range(70):
        p.box((random.uniform(-9.6, 9.6), random.uniform(-5.1, 6.1), 0.041), (random.uniform(0.25, 0.9), random.uniform(0.15, 0.5), 0.004),
              random.choice(["#cbbd9d", "#e2d8c0", "#c4b592"]), bevel=0.0, rot=(0, 0, random.uniform(0, 180)))
    for (cx, cy, sx, sy) in ((0, -5.55, 20.3, 0.16), (0, 6.55, 20.3, 0.16), (-10.07, 0.5, 0.16, 12.2), (10.07, 0.5, 0.16, 12.2)):
        p.box((cx, cy, 0.07), (sx, sy, 0.16), WOOD_D, bevel=0.03)
    p.done()

    swing_frame("swing_frame", -6.0, -0.3, 3.3)
    hanging_swing("swing_spare", -6.0, 2.3)
    rider("rider_1", (0.5, -2.2, 0.04), "horse")
    rider("rider_2", (3.4, -2.2, 0.04), "duck")
    rider("rider_3", (6.0, -2.2, 0.04), "plane")
    rider("rider_green", (9.1, 5.4, 0.04), "duck_green").rotation_euler = (0, 0, math.radians(-30))
    whale("whale", (-1.6, 4.6, 0.04), yaw=205)
    crawl_tube("tube", 4.0, 8.2, 2.6)
    toy_car("toy_car", (1.7, 4.7, 0.04), yaw=-100)

    for k, (x, y) in enumerate(((-8.6, 5.6), (-3.8, 6.0))):                      # low benches
        b = Build(f"bench_{k + 1}")
        b.box((0, 0, 0.42), (1.6, 0.34, 0.06), "#3b3e44", bevel=0.02)
        for sx in (-0.65, 0.65):
            b.box((sx, 0, 0.21), (0.07, 0.3, 0.42), "#3b3e44", bevel=0.02)
        b.done().location = (x, y, 0.04)

    c = Build("court")                                                          # the tennis court off to the right
    c.box((19, 7, 0.01), (13, 22, 0.04), "#4f9d6b", bevel=0.0)
    c.box((19, 7, 0.02), (9.5, 18, 0.04), "#4a9ad4", bevel=0.0)
    for (cx, cy, sx, sy) in ((19, -2, 9.5, 0.1), (19, 16, 9.5, 0.1), (14.25, 7, 0.1, 18), (23.75, 7, 0.1, 18), (19, 7, 0.08, 12), (19, 1, 7.4, 0.08), (19, 13, 7.4, 0.08)):
        c.box((cx, cy, 0.045), (sx, sy, 0.01), "#fbf6ea", bevel=0.0)
    c.box((19, 7, 0.5), (10.4, 0.04, 0.9), "#e9eef0", bevel=0.0, alpha=0.55)
    for sx in (13.8, 24.2):
        c.cyl((sx, 7, 0.55), 0.05, 1.1, DARK, seg=8)
    for yy in range(-4, 19, 3):                                                  # fence posts and rails
        c.cyl((12.4, yy, 1.5), 0.05, 3.0, "#4a5560", seg=8)
    c.box((12.4, 7, 2.95), (0.06, 22, 0.06), "#4a5560", bevel=0.0)
    c.box((12.4, 7, 1.5), (0.06, 22, 0.05), "#4a5560", bevel=0.0)
    c.box((12.4, 7, 1.5), (0.02, 22, 2.9), "#8fa0a8", bevel=0.0, alpha=0.25)
    c.done()

    greens = ["#2f7d4a", "#35875a", "#2a6f45"]
    k = 0
    for x in range(-30, 12, 3):                                                  # a wall of trees along the back
        for row in range(2):
            k += 1
            conifer(f"tree_{k}", (x + random.uniform(-0.8, 0.8) + row * 1.4, 10.5 + row * 3.2 + random.uniform(-0.8, 0.8), 0), random.uniform(4.6, 7.2), random.choice(greens))
    for (x, y, h) in ((-13.5, 5, 5.5), (-14.5, 0.5, 6.2), (-13.2, -4, 4.8), (-17, 3, 6.5), (11.4, 9.2, 4.2), (27, 2, 5.5), (28, 9, 6.0), (27.5, 15, 5.2)):
        k += 1
        conifer(f"tree_{k}", (x, y, 0), h, random.choice(greens))
    bsh = Build("bushes", smooth=True)
    for i in range(16):
        bsh.ball((random.uniform(-26, 11), random.uniform(8.2, 9.4), 0.5), (random.uniform(0.9, 1.6), random.uniform(0.7, 1.0), random.uniform(0.6, 1.0)),
                 random.choice(["#4cae4f", "#3d9a55", "#5ab85a"]), seg=10, rings=7)
    bsh.done()
    for i, (x, w, col) in enumerate(((-22, 9, "#e9dcc0"), (-9, 8, "#d9c7a8"), (3, 10, "#e6d3b8"), (16, 8, "#d5c2a2"), (27, 9, "#e9dcc0"))):
        house(f"house_{i + 1}", (x, 24 + (i % 2) * 2, 0), w, col, "#6a6f7a")


def folding_chair(name, at, yaw):
    b = Build(name)
    c = "#cfd3d6"
    b.box((0, 0, 0.45), (0.42, 0.40, 0.04), c, bevel=0.015)
    b.box((0, 0.2, 0.78), (0.42, 0.04, 0.3), c, bevel=0.015)
    for sx in (-0.19, 0.19):
        b.cyl((sx, 0.2, 0.45), 0.015, 0.9, "#8d949b", seg=6)
        b.cyl((sx, -0.17, 0.225), 0.015, 0.45, "#8d949b", seg=6)
    o = b.done()
    o.location = at
    o.rotation_euler = (0, 0, math.radians(yaw))
    return o


def big_pine(name, at, h):
    b = Build(name)
    b.cyl((0, 0, h * 0.2), 0.16 + h * 0.012, h * 0.4, "#6b4a36", seg=9)
    n = 7
    for k in range(n):
        u = k / (n - 1)
        zz = h * (0.2 + 0.74 * u)
        rr = h * (0.26 - 0.19 * u)
        b.cyl((0, 0, zz), rr, h * 0.2, "#2f6f4a" if k % 2 == 0 else "#3a8257", r2=rr * 0.25, seg=10)
    o = b.done()
    o.location = at
    return o


def backyard():
    """The competition: a suburban back garden, as in the film (folding table, hedge, fence, shed, paddling pool, patio)."""
    random.seed(23)
    g = Build("grass")
    g.box((0, 0, -0.05), (90, 80, 0.1), "#86c95e", bevel=0.0)
    for i in range(60):
        g.box((random.uniform(-12, 12), random.uniform(-12, 10), 0.004), (random.uniform(0.8, 2.6), random.uniform(0.5, 1.4), 0.006),
              "#79bd53", bevel=0.0, rot=(0, 0, random.uniform(0, 180)))
    g.done()

    t = Build("table")                                                           # white folding table, top at z = 0.74
    t.box((0, 0, 0.72), (1.83, 0.76, 0.045), "#f4f4f0", bevel=0.015)
    for sx in (-0.75, 0.75):
        for sy in (-0.3, 0.3):
            t.cyl((sx, sy, 0.35), 0.018, 0.7, "#8d949b", seg=6)
        t.cyl((sx, 0, 0.12), 0.015, 0.6, "#8d949b", seg=6, rot=(90, 0, 0))
    t.done()
    folding_chair("chair_official", (0, 0.72, 0), 0)
    folding_chair("chair_mark", (-0.5, -0.72, 0), 180)
    folding_chair("chair_lester", (0.5, -0.72, 0), 180)

    h = Build("hedge", smooth=True)                                              # tall hedge along the back
    h.box((0, 11.2, 1.2), (30, 1.4, 2.4), "#3d8f4d", bevel=0.2, smooth=False)
    for i in range(70):
        h.ball((random.uniform(-14.5, 14.5), 10.6 + random.uniform(-0.2, 0.5), random.uniform(0.4, 2.5)),
               (random.uniform(0.6, 1.1), random.uniform(0.5, 0.8), random.uniform(0.5, 0.9)), random.choice(["#4cae4f", "#3d9a55", "#5ab85a", "#348a48"]), seg=9, rings=6)
    h.done()

    N, pitch, x, y0 = 43, 0.3, -11.5, -5.4                                       # up to 43 pickets along the left side, one object each
    for i in range(N):
        f = Build(f"picket_{i + 1}")
        y = y0 + i * pitch
        col = "#8a6f52" if i % 2 == 0 else "#967a5c"
        f.box((x, y, 0.8), (0.04, 0.2, 1.6), col, bevel=0.0)
        f.box((x, y, 1.66), (0.04, 0.13, 0.12), col, bevel=0.0, rot=(45, 0, 0))
        for zz in (0.45, 1.25):
            f.box((x - 0.04, y, zz), (0.05, pitch + 0.01, 0.1), "#6f5840", bevel=0.0)
        f.done()
    f = Build("fence_post")
    f.box((x - 0.02, y0 - 0.2, 0.9), (0.14, 0.14, 1.8), "#6f5840", bevel=0.02)
    f.done()
    lh = Build("left_hedge", smooth=True)                                        # shrubs where the fence stops
    for i in range(18):
        lh.ball((-11.6 + random.uniform(-0.3, 0.3), random.uniform(-14, -6.6), random.uniform(0.5, 1.6)),
                (random.uniform(0.7, 1.1), random.uniform(0.7, 1.1), random.uniform(0.6, 1.0)), random.choice(["#4cae4f", "#3d9a55", "#5ab85a"]), seg=9, rings=6)
    lh.done()

    sh = Build("shed")                                                           # white shed, dark roof, door facing the lawn
    sh.box((0, 0, 1.1), (3.2, 2.4, 2.2), "#f1efe8", bevel=0.03)
    for k in range(7):
        sh.box((0, -1.21, 0.25 + k * 0.3), (3.2, 0.02, 0.02), "#d5d2c8", bevel=0.0)
    sh.prism([(-1.8, -1.4), (1.8, -1.4), (1.8, 1.4), (-1.8, 1.4)], 2.2, 2.3, "#4a4f5c")
    sh.box((0, 0, 2.62), (3.5, 1.5, 0.75), "#4a4f5c", bevel=0.3)
    sh.box((0, -1.22, 0.95), (1.3, 0.05, 1.9), "#e3e0d6", bevel=0.01)
    sh.box((0, -1.25, 0.95), (0.03, 0.03, 1.9), "#9a968c", bevel=0.0)
    for sx in (-1.15, 1.15):
        sh.box((sx, -1.22, 1.35), (0.5, 0.05, 0.6), "#bfe3ee", bevel=0.01)
        for dx in (-0.31, 0.31):
            sh.box((sx + dx, -1.24, 1.35), (0.1, 0.04, 0.66), "#7a3a36", bevel=0.0)
    sh.done().location = (-9.0, 8.7, 0)

    pl = Build("pool", smooth=True)                                              # paddling pool, 58 inches across
    R = 0.7366
    pl.cyl((0, 0, 0.13), R, 0.26, "#3f8fd6", seg=28)
    pl.cyl((0, 0, 0.262), R - 0.07, 0.01, "#9fd8f0", seg=28, smooth=False)
    for k in range(3):
        pl.cyl((0, 0, 0.05 + k * 0.08), R + 0.012, 0.03, "#2f77bb", seg=28)
    pl.done().location = (-4.6, 4.6, 0)
    lid = Build("pool_lid", smooth=True)
    lid.cyl((0, 0, 0.5), 0.55, 0.06, "#8a6fc9", seg=20, rot=(72, 0, 25))
    lid.done().location = (-7.3, 7.2, 0)
    folding_chair("lawn_chair", (-6.4, 8.4, 0), 20)

    big_pine("pine_1", (3.6, 8.2, 0), 11.58)                                     # 38 feet
    big_pine("pine_2", (-2.2, 9.0, 0), 8.6)
    big_pine("pine_3", (8.2, 9.2, 0), 9.6)

    ho = Build("house")                                                          # the house on the right, patio in front of it
    ho.box((17, 1, 2.9), (8, 24, 5.8), "#8fa3b0", bevel=0.05)
    for k in range(17):
        ho.box((12.99, 1, 0.3 + k * 0.33), (0.02, 24, 0.02), "#7c909d", bevel=0.0)
    ho.prism([(12.5, -11.4), (21.4, -11.4), (21.4, 13.4), (12.5, 13.4)], 5.8, 5.95, "#4a4f5c")
    ho.box((17, 1, 6.6), (7, 24.6, 1.4), "#4a4f5c", bevel=0.5)
    ho.box((12.97, 4.0, 1.1), (0.06, 2.6, 2.2), "#bfe3ee", bevel=0.01)             # sliding door behind the patio
    ho.box((12.95, 4.0, 1.1), (0.08, 0.06, 2.2), "#f4f4f0", bevel=0.0)
    ho.box((12.95, 4.0, 2.22), (0.1, 2.8, 0.1), "#f4f4f0", bevel=0.0)
    for yy in (-1.0, 8.5):
        ho.box((12.97, yy, 1.7), (0.06, 1.3, 1.1), "#bfe3ee", bevel=0.01)
        ho.box((12.95, yy, 1.7), (0.08, 0.05, 1.1), "#f4f4f0", bevel=0.0)
    for yy in (-1.0, 4.0, 8.5):
        ho.box((12.97, yy, 4.2), (0.06, 1.3, 1.0), "#bfe3ee", bevel=0.01)
    ho.box((12.9, -6.0, 1.05), (0.1, 1.0, 2.1), "#f4f4f0", bevel=0.02)             # the door Jess answers
    for a in (-0.22, 0.22):
        for zz in (1.25, 1.65):
            ho.box((12.84, -6.0 + a, zz), (0.03, 0.34, 0.32), "#bfe3ee", bevel=0.0)
    ho.cyl((12.82, -5.62, 1.0), 0.04, 0.05, "#c9b25a", seg=8, rot=(0, 90, 0))
    ho.box((12.5, -6.0, 0.08), (1.0, 1.6, 0.16), "#a8553f", bevel=0.02)            # brick step
    ho.box((12.7, -9.5, 0.45), (0.6, 0.8, 0.9), "#9aa3ad", bevel=0.04)             # air conditioner
    ho.box((12.6, -8.2, 0.5), (0.6, 0.6, 1.0), "#3f77c9", bevel=0.05)              # recycling bin
    ho.done()
    pa = Build("patio")
    pa.box((10.7, 4.0, 0.02), (4.6, 6.0, 0.06), "#b9b3a6", bevel=0.01)
    for k in range(1, 5):
        pa.box((8.4 + k * 0.92, 4.0, 0.052), (0.03, 6.0, 0.004), "#a39d90", bevel=0.0)
    for k in range(1, 6):
        pa.box((10.7, 1.0 + k * 1.0, 0.052), (4.6, 0.03, 0.004), "#a39d90", bevel=0.0)
    pa.done()
    pt = Build("patio_table")                                                     # glass-topped table, top at z = 0.74
    pt.box((0, 0, 0.72), (1.7, 1.0, 0.04), "#3b3e44", bevel=0.015)
    pt.box((0, 0, 0.742), (1.56, 0.86, 0.006), "#a9c9c4", bevel=0.0)
    for sx in (-0.75, 0.75):
        for sy in (-0.4, 0.4):
            pt.cyl((sx, sy, 0.35), 0.025, 0.7, "#3b3e44", seg=6)
    pt.box((0.15, -0.05, 0.755), (0.4, 0.28, 0.02), "#c9cdd2", bevel=0.005)        # laptop
    pt.box((0.15, 0.1, 0.89), (0.4, 0.02, 0.27), "#c9cdd2", bevel=0.005, rot=(-14, 0, 0))
    pt.box((0.15, 0.085, 0.89), (0.35, 0.01, 0.22), "#6fb8e8", bevel=0.0, rot=(-14, 0, 0), emit=0.3)
    pt.box((-0.45, -0.1, 0.775), (0.36, 0.26, 0.06), "#d9463b", bevel=0.01, rot=(0, 0, 12))   # almanac
    for k, c in enumerate(("#3f6fb0", "#e0c040", "#4f9d6b", "#8a5a34")):
        pt.box((-0.45, 0.25, 0.765 + k * 0.045), (0.3, 0.22, 0.04), c, bevel=0.008, rot=(0, 0, k * 9 - 10))
    pt.cyl((0.62, 0.25, 0.86), 0.07, 0.24, "#55595f", seg=10)                      # lantern
    pt.cyl((0.62, 0.25, 0.86), 0.055, 0.14, "#ffe9a8", seg=10, emit=0.4)
    pt.done().location = (10.6, 3.4, 0.05)
    um = Build("umbrella")
    um.cyl((0, 0, 1.2), 0.03, 2.4, "#55595f", seg=8)
    um.cyl((0, 0, 1.75), 0.17, 1.3, "#e6d3b8", r2=0.05, seg=10)
    um.cyl((0, 0, 0.06), 0.25, 0.12, "#3b3e44", seg=12)
    um.done().location = (11.9, 4.6, 0.05)
    for i, (x, y, yaw) in enumerate(((10.6, 4.25, 0), (9.4, 3.4, -90), (10.6, 2.5, 180), (11.9, 2.9, 60))):
        c = Build(f"patio_chair_{i + 1}")
        c.box((0, 0, 0.45), (0.5, 0.48, 0.05), "#d8c9a8", bevel=0.02)
        c.box((0, 0.24, 0.85), (0.5, 0.05, 0.6), "#d8c9a8", bevel=0.02)
        for sx in (-0.23, 0.23):
            for sy in (-0.2, 0.22):
                c.cyl((sx, sy, 0.22), 0.02, 0.45, "#3b3e44", seg=6)
            c.box((sx, 0.02, 0.66), (0.04, 0.46, 0.03), "#3b3e44", bevel=0.0)
        o = c.done()
        o.location = (x, y, 0.05)
        o.rotation_euler = (0, 0, math.radians(yaw))
    bsh = Build("bushes", smooth=True)
    for i in range(14):
        bsh.ball((12.3 + random.uniform(-0.3, 0.2), random.choice([random.uniform(-4.6, 0.6), random.uniform(7.2, 10)]), 0.45),
                 (random.uniform(0.5, 0.8), random.uniform(0.5, 0.9), random.uniform(0.45, 0.8)), random.choice(["#4cae4f", "#3d9a55", "#5ab85a"]), seg=9, rings=6)
    for i in range(8):
        bsh.ball((random.uniform(8.3, 9.0), random.uniform(6.6, 9.6), 0.5), (0.7, 0.7, random.uniform(0.5, 0.9)), random.choice(["#4cae4f", "#3d9a55"]), seg=9, rings=6)
    bsh.done()

    rc = Build("rope_circle", smooth=True)                                        # the freestyle ring: 31 feet round
    Rr, n = 1.5, 40
    for i in range(n):
        a = 2 * math.pi * (i + 0.5) / n
        rc.cyl((Rr * math.cos(a), Rr * math.sin(a), 0.03), 0.028, 2 * math.pi * Rr / n + 0.02, "#e8d36a" if i % 2 else "#d9c050", seg=6,
               rot=(90, 0, math.degrees(a)))
    rc.done().location = (3.5, -3.5, 0)

    d = Build("bailey", smooth=True)                                              # Bailey: small, white, fluffy. Faces -Y.
    w, w2 = "#f6f2e8", "#e6e0d0"
    d.ball((0, 0, 0.26), (0.15, 0.24, 0.15), w)
    d.ball((0, -0.24, 0.38), (0.13, 0.13, 0.13), w)
    d.ball((0, -0.36, 0.35), (0.06, 0.07, 0.05), w2)
    d.ball((0, -0.425, 0.365), (0.022, 0.02, 0.02), "#2a2326")
    for sx in (-1, 1):
        d.ball((sx * 0.11, -0.2, 0.42), (0.04, 0.06, 0.09), "#d9c9a8")
        d.ball((sx * 0.05, -0.335, 0.41), (0.016, 0.012, 0.018), "#2a2326")
        for sy in (-0.14, 0.14):
            d.cyl((sx * 0.08, sy, 0.07), 0.035, 0.14, w2, seg=8)
    d.ball((0, 0.26, 0.36), (0.04, 0.06, 0.09), w, rot=(-30, 0, 0))
    d.box((0, -0.14, 0.33), (0.2, 0.03, 0.03), "#7a4fc9", bevel=0.01)             # purple collar
    d.done()

    greens = ["#2f7d4a", "#35875a", "#2a6f45"]
    k = 0
    for x in range(-28, 30, 4):
        k += 1
        conifer(f"tree_{k}", (x + random.uniform(-1, 1), 14.5 + random.uniform(-1, 2.5), 0), random.uniform(5.5, 8.5), random.choice(greens))
    for (x, y, hh) in ((-25, 6, 6.5), (-27, -3, 7.0), (-26, -12, 5.5), (-23, 13, 7.5)):
        k += 1
        conifer(f"tree_{k}", (x, y, 0), hh, random.choice(greens))
    for i, (x, y, w_, col) in enumerate(((-24, 2, 8, "#e9dcc0"), (-6, 27, 9, "#d9c7a8"), (9, 28, 9, "#e6d3b8"))):
        house(f"house_{i + 1}", (x, y, 0), w_, col, "#6a6f7a")


def jackhome():
    """Jack and Amy's living room, for the ending: pale blue walls, the striped couch, the bookshelf niche, the wooden door."""
    random.seed(31)
    r = Build("jh_room")
    r.box((0, 0, -0.05), (9, 6, 0.1), "#b98a5a", bevel=0.0)
    for k in range(9):
        r.box((0, -2.7 + k * 0.62, 0.002), (9, 0.02, 0.004), "#a67848", bevel=0.0)
    WALLC = "#a9bcc6"
    r.box((0, 3.05, 1.4), (9.2, 0.2, 2.8), WALLC, bevel=0.0)
    r.box((-4.55, 0, 1.4), (0.2, 6.2, 2.8), "#9db0bb", bevel=0.0)
    r.box((4.55, 0, 1.4), (0.2, 6.2, 2.8), "#9db0bb", bevel=0.0)
    r.box((0, 2.94, 0.07), (9, 0.04, 0.14), "#f4f1ea", bevel=0.0)
    r.box((-1.3, 2.9, 1.75), (1.5, 0.14, 0.75), "#8a5a34", bevel=0.02)             # bookshelf niche
    r.box((-1.3, 2.84, 1.75), (1.36, 0.06, 0.62), "#4a3626", bevel=0.0)
    cols = ["#d9463b", "#3b82c4", "#f2c230", "#4cae4f", "#e8d9b5", "#8e5bd0", "#f4f1ea"]
    for row, zz in enumerate((1.55, 1.86)):
        xx = -1.92
        while xx < -0.72:
            w = random.uniform(0.04, 0.08)
            r.box((xx + w / 2, 2.8, zz + 0.02), (w, 0.08, random.uniform(0.2, 0.27)), random.choice(cols), bevel=0.004)
            xx += w + 0.006
    r.box((-1.3, 2.82, 1.71), (1.36, 0.1, 0.03), "#8a5a34", bevel=0.0)
    for sx in (0.9, 1.5):                                                         # two wall lamps
        r.cyl((sx, 2.88, 2.05), 0.09, 0.16, "#fff0d0", r2=0.05, seg=10, emit=0.5)
        r.box((sx, 2.92, 1.95), (0.04, 0.06, 0.2), "#3b3e44", bevel=0.0)
    r.box((3.0, 2.93, 1.05), (1.0, 0.08, 2.1), "#8a4a2a", bevel=0.01)              # the wooden door, with its Z brace
    r.box((3.0, 2.88, 1.05), (0.07, 0.03, 2.0), "#6b3a22", bevel=0.0, rot=(0, 25, 0))
    for zz in (0.25, 1.85):
        r.box((3.0, 2.88, zz), (0.9, 0.03, 0.08), "#6b3a22", bevel=0.0)
    r.box((3.0, 2.86, 1.45), (0.5, 0.03, 0.5), "#bfe3ee", bevel=0.0)
    r.cyl((2.6, 2.86, 1.0), 0.035, 0.05, "#c9b25a", seg=8, rot=(90, 0, 0))
    r.box((0, 0.3, 0.004), (3.4, 2.2, 0.008), "#c9b9a0", bevel=0.0)                # rug
    r.done()
    c = Build("jh_couch")                                                         # striped couch; seat top at z = 0.45
    base, st = "#93a3b8", "#c9d2de"
    c.box((0, 0, 0.24), (2.9, 0.95, 0.42), base, bevel=0.06)
    c.box((0, 0.36, 0.72), (2.9, 0.26, 0.62), base, bevel=0.08)
    for sx in (-1.5, 1.5):
        c.box((sx, 0, 0.42), (0.26, 0.98, 0.72), base, bevel=0.08)
    for k in range(3):
        c.box((-0.92 + k * 0.92, -0.06, 0.47), (0.88, 0.72, 0.1), "#9eaec2", bevel=0.04)
    for k in range(13):
        c.box((-1.3 + k * 0.216, 0.22, 0.74), (0.035, 0.02, 0.5), st, bevel=0.0)
        c.box((-1.3 + k * 0.216, -0.06, 0.523), (0.035, 0.68, 0.006), st, bevel=0.0)
    c.box((0, 0.5, 1.04), (2.7, 0.06, 0.06), "#8a4a2a", bevel=0.02)                # wooden trim along the top
    c.done().location = (0, 2.3, 0)
    bl = Build("jh_blanket", smooth=True)
    bl.ball((0, 0, 0), (0.45, 0.5, 0.14), "#8d949b", seg=12, rings=8)
    bl.ball((0.05, -0.3, -0.2), (0.4, 0.25, 0.3), "#7f868d", seg=10, rings=7)
    bl.done().location = (0.3, 1.78, 0.56)
    t = Build("jh_side")
    t.box((0, 0, 0.5), (0.5, 0.5, 0.05), "#8a5a34", bevel=0.01)
    for sx in (-0.2, 0.2):
        for sy in (-0.2, 0.2):
            t.cyl((sx, sy, 0.25), 0.02, 0.5, "#6b4a2e", seg=6)
    t.box((0, 0, 0.56), (0.1, 0.22, 0.08), "#f4f1ea", bevel=0.02)                  # the cordless phone
    t.done().location = (-2.1, 2.3, 0)
    ct = Build("jh_table")
    ct.box((0, 0, 0.38), (1.2, 0.6, 0.05), "#8a5a34", bevel=0.015)
    for sx in (-0.5, 0.5):
        for sy in (-0.22, 0.22):
            ct.cyl((sx, sy, 0.19), 0.025, 0.38, "#6b4a2e", seg=6)
    ct.done().location = (-2.4, 0.6, 0)
    cr = Build("jh_crutches")
    for dx in (0, 0.12):
        cr.cyl((dx, 0, 0.62), 0.018, 1.25, "#c9cdd2", seg=6, rot=(14, 0, 0))
        cr.box((dx, -0.15, 1.24), (0.05, 0.16, 0.05), "#3b3e44", bevel=0.01)
    cr.done().location = (-1.75, 2.0, 0)


SCENES = {"apartment": apartment, "cliff": cliff, "playground": playground, "backyard": backyard, "jackhome": jackhome}

if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["apartment"]
    for n in args:
        for o in list(bpy.data.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        SCENES[n]()
        out = os.path.join(ROOT, "game", "assets", n + ".glb")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_apply=True)
        tris = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
        print("EXPORTED", out, "objects", len(bpy.data.objects), "faces", tris)
