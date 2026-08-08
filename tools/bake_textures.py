"""
Bakes tileable PBR textures for the CosmoChute site into public/textures/.

All noise is synthesized in the Fourier domain (spectral synthesis with a
1/f^beta falloff), which makes every map perfectly periodic — no visible
tiling seams. Normal maps are derived from the same height fields.

Run once:  python tools/bake_textures.py
"""
import numpy as np
from PIL import Image
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "textures")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(42)


def spectral_noise(n, beta=1.8, seed=None):
    """Periodic fractal noise in [0,1], power spectrum ~ 1/f^beta."""
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


def normal_from_height(h, strength=2.0):
    """Tangent-space normal map (OpenGL convention) from height in [0,1]."""
    gx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * strength
    gy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * strength
    nz = np.ones_like(h)
    length = np.sqrt(gx * gx + gy * gy + nz * nz)
    n = np.stack([-gx / length, gy / length, nz / length], axis=-1)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)


def save_rgb(arr, name, quality=88):
    Image.fromarray(arr, "RGB").save(os.path.join(OUT, name), quality=quality)
    print(f"  {name}  {arr.shape[1]}x{arr.shape[0]}")


def tint(gray, rgb):
    """gray HxW in [0,1] -> HxWx3 uint8 tinted by rgb (0-255 baseline)."""
    out = np.stack([gray * rgb[0], gray * rgb[1], gray * rgb[2]], axis=-1)
    return np.clip(out, 0, 255).astype(np.uint8)


# ============================================================
# 1. REGOLITH — granular powder, sharp craterlets, pebbles, grain
# ============================================================
print("regolith…")
N = 2048
# multi-band height: macro undulation -> granular micro-texture
h = spectral_noise(N, 2.2, 1) * 0.34 + spectral_noise(N, 1.6, 2) * 0.28 \
    + spectral_noise(N, 0.9, 3) * 0.22 + spectral_noise(N, 0.45, 4) * 0.16

# stamp craterlets with periodic wrap-around (sharper bowls + crisp rims)
yy, xx = np.mgrid[0:N, 0:N]
crater_shadow = np.zeros((N, N))
for i in range(420):
    cx, cy = rng.integers(0, N, 2)
    r = float(rng.uniform(4, 70))
    dx = np.minimum(np.abs(xx - cx), N - np.abs(xx - cx))
    dy = np.minimum(np.abs(yy - cy), N - np.abs(yy - cy))
    d = np.sqrt(dx * dx + dy * dy)
    t = np.clip(d / r, 0, 1)
    depth = 0.16 * (r / 70) ** 0.8
    bowl = (np.cos(t * np.pi) * 0.5 + 0.5) ** 1.4 * depth
    rim = np.exp(-((t - 0.98) * 11) ** 2) * depth * 0.45
    h = h - bowl + rim
    crater_shadow += np.where(t < 0.85, (0.85 - t) * depth * 2.2, 0)

# pebbles: thousands of small rounded bumps half-buried in the dust
pebble_mask = np.zeros((N, N))
for i in range(3600):
    cx, cy = rng.integers(0, N, 2)
    r = float(rng.uniform(1.5, 6.5))
    x0, x1 = int(cx - 8), int(cx + 9)
    y0, y1 = int(cy - 8), int(cy + 9)
    gx = (np.arange(x0, x1) % N)
    gy = (np.arange(y0, y1) % N)
    dxp = np.minimum(np.abs(np.arange(x0, x1) - cx), N - np.abs(np.arange(x0, x1) - cx))[None, :]
    dyp = np.minimum(np.abs(np.arange(y0, y1) - cy), N - np.abs(np.arange(y0, y1) - cy))[:, None]
    dd = np.sqrt(dxp * dxp + dyp * dyp)
    bump = np.clip(1 - (dd / r) ** 2, 0, 1) * 0.10
    h[np.ix_(gy, gx)] += bump
    pebble_mask[np.ix_(gy, gx)] = np.maximum(pebble_mask[np.ix_(gy, gx)], np.clip(1 - dd / r, 0, 1))

h -= h.min(); h /= h.max()

# albedo: grey powder, darker crater floors, brighter pebbles,
# per-pixel salt-and-pepper grain like real close-up regolith
macro = spectral_noise(N, 2.4, 5)
grain = rng.normal(0, 1, (N, N)) * 0.05 + spectral_noise(N, 0.25, 7) * 0.10
g = 0.40 + h * 0.30 + (macro - 0.5) * 0.14 + grain \
    - np.clip(crater_shadow, 0, 0.5) * 0.35 + pebble_mask * 0.12
g = np.clip(g, 0.12, 0.98)
warm = spectral_noise(N, 2.2, 6)
alb = np.stack([
    g * (202 + warm * 12), g * (198 + warm * 6), g * (190 - warm * 8),
], axis=-1)
save_rgb(np.clip(alb, 0, 255).astype(np.uint8), "regolith_albedo.jpg")
save_rgb(normal_from_height(h, 7.5), "regolith_normal.jpg", 92)

# ============================================================
# 2. ROCK — fractured basalt
# ============================================================
print("rock…")
M = 1024
rh = spectral_noise(M, 1.5, 10) * 0.6 + spectral_noise(M, 0.8, 11) * 0.4
# fracture lines: threshold ridges of a low-freq field
frac = spectral_noise(M, 2.0, 12)
ridge = 1 - np.abs(frac - 0.5) * 2
rh -= np.where(ridge > 0.86, (ridge - 0.86) * 2.2, 0)
rh -= rh.min(); rh /= rh.max()
rg = 0.30 + rh * 0.42
rock_alb = tint(rg, (198, 192, 184))
save_rgb(rock_alb, "rock_albedo.jpg")
save_rgb(normal_from_height(rh, 6.0), "rock_normal.jpg", 92)

# ============================================================
# 3. MLI GOLD FOIL — crinkled multilayer insulation
# ============================================================
print("mli…")
K = 1024
# crinkle: max of several shifted low-freq fields -> creased facets
fields = [spectral_noise(K, 2.6, 20 + i) for i in range(4)]
mh = np.maximum.reduce(fields)
mh = mh * 0.7 + spectral_noise(K, 1.1, 30) * 0.3
mh -= mh.min(); mh /= mh.max()
# crease lines: gradient magnitude of the crinkle field, etched dark
gmx = np.roll(mh, -1, axis=1) - np.roll(mh, 1, axis=1)
gmy = np.roll(mh, -1, axis=0) - np.roll(mh, 1, axis=0)
crease = np.sqrt(gmx * gmx + gmy * gmy)
crease = np.clip(crease / np.percentile(crease, 97), 0, 1)
shade = 0.5 + mh * 0.62 - crease * 0.45
mli_alb = np.stack([
    np.clip(shade * 238, 0, 255),
    np.clip(shade * 176, 0, 255),
    np.clip(shade * 72, 0, 255),
], axis=-1).astype(np.uint8)
save_rgb(mli_alb, "mli_albedo.jpg")
save_rgb(normal_from_height(mh, 9.0), "mli_normal.jpg", 92)

# ============================================================
# 4. BRUSHED ALUMINIUM
# ============================================================
print("alu…")
A = 512
streak = spectral_noise(A, 1.0, 40)
# stretch horizontally for the brushed look
streak = np.repeat(streak[:, ::8], 8, axis=1)[:A, :A]
base = 0.62 + (streak - 0.5) * 0.25 + (spectral_noise(A, 2.5, 41) - 0.5) * 0.08
alu_alb = tint(np.clip(base, 0, 1), (188, 192, 200))
save_rgb(alu_alb, "alu_albedo.jpg")

# ============================================================
# 5. WHITE SPACECRAFT PAINT — subtle panel wear
# ============================================================
print("paint…")
P = 512
p = 0.88 + (spectral_noise(P, 2.2, 50) - 0.5) * 0.10 \
    + (spectral_noise(P, 0.9, 51) - 0.5) * 0.05
paint_alb = tint(np.clip(p, 0, 1), (238, 236, 230))
save_rgb(paint_alb, "paint_albedo.jpg")

# ============================================================
# 6. SOLAR CELLS — dark blue grid with busbars
# ============================================================
print("solar…")
S = 512
cell = 64
sy, sx = np.mgrid[0:S, 0:S]
gap = ((sx % cell) < 3) | ((sy % cell) < 3)
bus = ((sx % (cell // 2)) < 1)
iridesc = spectral_noise(S, 2.0, 60)
r = 22 + iridesc * 26
g2 = 34 + iridesc * 34
b = 74 + iridesc * 60
solar = np.stack([r, g2, b], axis=-1)
solar[gap] = (185, 182, 175)
solar[bus & ~gap] = (150, 150, 152)
save_rgb(np.clip(solar, 0, 255).astype(np.uint8), "solar_albedo.jpg")

print("done ->", os.path.abspath(OUT))
