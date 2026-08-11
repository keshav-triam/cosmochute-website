"""
Composites real photographic PBR textures (ambientCG, CC0) with the
procedural lunar character layers (craterlets, pebbles, grain) into the
final terrain/rock maps. Photo micro-detail + baked macro features,
merged offline into single map pairs — no shader changes needed.

Inputs (pass the source dir as argv[1]):
  <src>/ground/Ground054_2K-JPG_Color.jpg + _NormalGL.jpg + _AmbientOcclusion.jpg
  <src>/rock/Rock035_2K-JPG_Color.jpg + _NormalGL.jpg + _AmbientOcclusion.jpg

Outputs (overwrites): public/textures/regolith_albedo.jpg,
  regolith_normal.jpg, rock_albedo.jpg, rock_normal.jpg
"""
import sys, os
import numpy as np
from PIL import Image

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "textures")
rng = np.random.default_rng(42)
N = 2048


def spectral_noise(n, beta=1.8, seed=None):
    r = np.random.default_rng(seed)
    white = r.normal(size=(n, n))
    f = np.fft.fft2(white)
    fx = np.fft.fftfreq(n)[None, :]
    fy = np.fft.fftfreq(n)[:, None]
    freq = np.sqrt(fx * fx + fy * fy)
    freq[0, 0] = 1.0
    f *= freq ** (-beta)
    f[0, 0] = 0
    out = np.real(np.fft.ifft2(f))
    out -= out.min()
    out /= out.max()
    return out


def load_img(path, size=N):
    img = Image.open(path).convert("RGB").resize((size, size), Image.LANCZOS)
    return np.asarray(img).astype(np.float64) / 255.0


def save_rgb(arr01, name, quality=90):
    Image.fromarray(np.clip(arr01 * 255, 0, 255).astype(np.uint8), "RGB").save(
        os.path.join(OUT, name), quality=quality)
    print(" ", name)


def blend_normals(n1, n2, w2=1.0):
    """Whiteout blend of two [0,1]-encoded tangent normal maps."""
    a = n1 * 2 - 1
    b = n2 * 2 - 1
    out = np.empty_like(a)
    out[..., 0] = a[..., 0] + b[..., 0] * w2
    out[..., 1] = a[..., 1] + b[..., 1] * w2
    out[..., 2] = np.maximum(a[..., 2] * np.abs(b[..., 2]), 0.05)
    ln = np.sqrt((out ** 2).sum(-1, keepdims=True))
    return (out / ln) * 0.5 + 0.5


# ---------- procedural lunar macro layers (same recipe as the bake) ----------
def lunar_layers():
    h = np.zeros((N, N))
    shading = np.ones((N, N))
    yy, xx = np.mgrid[0:N, 0:N]
    for i in range(420):
        cx, cy = rng.integers(0, N, 2)
        r = float(rng.uniform(4, 70))
        dx = np.minimum(np.abs(xx - cx), N - np.abs(xx - cx))
        dy = np.minimum(np.abs(yy - cy), N - np.abs(yy - cy))
        d = np.sqrt(dx * dx + dy * dy)
        t = np.clip(d / r, 0, 1)
        depth = 0.16 * (r / 70) ** 0.8
        h -= (np.cos(t * np.pi) * 0.5 + 0.5) ** 1.4 * depth
        h += np.exp(-((t - 0.98) * 11) ** 2) * depth * 0.45
        shading -= np.where(t < 0.85, (0.85 - t) * depth * 1.6, 0)
    pebble = np.zeros((N, N))
    for i in range(3600):
        cx, cy = rng.integers(0, N, 2)
        r = float(rng.uniform(1.5, 6.5))
        gx = (np.arange(int(cx - 8), int(cx + 9)) % N)
        gy = (np.arange(int(cy - 8), int(cy + 9)) % N)
        dxp = np.minimum(np.abs(np.arange(int(cx - 8), int(cx + 9)) - cx),
                         N - np.abs(np.arange(int(cx - 8), int(cx + 9)) - cx))[None, :]
        dyp = np.minimum(np.abs(np.arange(int(cy - 8), int(cy + 9)) - cy),
                         N - np.abs(np.arange(int(cy - 8), int(cy + 9)) - cy))[:, None]
        dd = np.sqrt(dxp * dxp + dyp * dyp)
        h[np.ix_(gy, gx)] += np.clip(1 - (dd / r) ** 2, 0, 1) * 0.10
        pebble[np.ix_(gy, gx)] = np.maximum(pebble[np.ix_(gy, gx)], np.clip(1 - dd / r, 0, 1))
    macro = spectral_noise(N, 2.4, 5)
    return h, np.clip(shading, 0.45, 1.0), pebble, macro


def normal_from_height(h, strength):
    gx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * strength
    gy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * strength
    nz = np.ones_like(h)
    ln = np.sqrt(gx * gx + gy * gy + nz * nz)
    return np.stack([-gx / ln, gy / ln, nz / ln], -1) * 0.5 + 0.5


print("compositing regolith…")
gc = load_img(f"{SRC}/ground/Ground054_2K-JPG_Color.jpg")
gn = load_img(f"{SRC}/ground/Ground054_2K-JPG_NormalGL.jpg")
gao = load_img(f"{SRC}/ground/Ground054_2K-JPG_AmbientOcclusion.jpg")[..., 0]

h, shading, pebble, macro = lunar_layers()

# desaturate the photo (regolith is colourless grey) and pull to lunar albedo
gray = gc.mean(-1, keepdims=True)
desat = gc * 0.18 + gray * 0.82
desat = desat / max(desat.mean(), 1e-6) * 0.30           # mean albedo ~0.30
lit = (shading + pebble * 0.14 + (macro[..., None].squeeze() - 0.5) * 0.1)
alb = desat * lit[..., None] * (0.55 + gao[..., None] * 0.55)
# faint warm-grey tint like mare soil
alb *= np.array([1.03, 1.0, 0.95])
save_rgb(alb, "regolith_albedo.jpg")

cratN = normal_from_height(h, 8.0)
save_rgb(blend_normals(gn, cratN, 1.0), "regolith_normal.jpg", 92)

print("compositing rock…")
rc = load_img(f"{SRC}/rock/Rock035_2K-JPG_Color.jpg", 1024)
rn = load_img(f"{SRC}/rock/Rock035_2K-JPG_NormalGL.jpg", 1024)
rao = load_img(f"{SRC}/rock/Rock035_2K-JPG_AmbientOcclusion.jpg", 1024)[..., 0]
rgray = rc.mean(-1, keepdims=True)
rdesat = rc * 0.3 + rgray * 0.7
rdesat = rdesat / max(rdesat.mean(), 1e-6) * 0.26
ralb = rdesat * (0.5 + rao[..., None] * 0.6) * np.array([1.02, 1.0, 0.96])
save_rgb(ralb, "rock_albedo.jpg")
save_rgb(rn, "rock_normal.jpg", 92)

print("done ->", os.path.abspath(OUT))
