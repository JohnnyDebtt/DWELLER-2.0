import os
from PIL import Image
C = {
 'K': (12,11,16), 'W': (236,232,214), 'H': (70,62,70), 'h': (48,42,50),
 'a': (185,168,123), 'A': (138,124,92),     # sand
 'b': (122,124,130), 'B': (86,88,96),       # ash
 'c': (96,124,84),  'C': (64,88,60),        # moss
 'd': (124,96,150), 'D': (86,64,108),       # violet
 'e': (164,104,62), 'E': (116,72,44),       # copper
 'f': (180,80,58),  'F': (120,48,40),       # ember
 'g': (46,40,50),   'G': (30,26,34),        # vein
 'n': (206,212,218), 't': (214,192,140), 's': (128,94,62), 'S': (90,64,42), 'r': (226,120,80),
}
BODY = [
 "..........HHh.........",
 ".........HHHhh........",
 "........HHHHhhh.......",
 ".......HHKKKKKhh......",
 ".......HKKKKKKKh......",
 "......HHKWKKKWKhh.....",
 "......HHKKKKKKKhh.....",
 ".....aaHHKKKKKhhBB....",
 "....aaaaAHHhhhhbbbB...",
 "....aaaaAccccCddddB...",
 "...aaaaaAccccCddddDB..",
 "...eeeeeEccccCddddDB..",
 "...eeeeeEffffFgggGcC..",
 "..eeeeeeEffffFgggGccC.",
 "..eeeeeeEffffFgggGccC.",
 "..aaaaaaAbbbbbBddddDC.",
 "..aaaaaaAbbbbbBddddDD.",
 ".ffffffFeeeeeeEcccccC.",
 ".ffffffFeeeeeeEcccccCC",
 ".GGGGGGGGGGGGGGGGGGGGG",
 ".....KK.......KK......",
]
def frame(k):
    im = Image.new('RGBA', (48, 48), (0,0,0,0)); px = im.load()
    ox, oy = 13, 30 - len(BODY)
    breath = 1 if (k // 6) % 2 else 0
    for y, row in enumerate(BODY):
        for x, ch in enumerate(row):
            if ch == '.': continue
            yy = oy + y + (breath if y < 9 else 0)
            px[ox + x, yy] = C[ch] + (255,)
    # seams: a stitched line across the patchwork
    for x in range(3, 21, 2):
        y = oy + 15
        if px[ox + x, y][3]: px[ox + x, y] = C['t'] + (255,)
    # the spool on his back
    for y in range(oy + 6, oy + 11):
        for x in range(ox + 18, ox + 21): px[x, y] = (C['s'] if x < ox + 20 else C['S']) + (255,)
    for x in range(ox + 17, ox + 22): px[x, oy + 6] = C['S'] + (255,); px[x, oy + 10] = C['S'] + (255,)
    for y in range(oy + 7, oy + 10): px[ox + 19, y] = C['r'] + (255,)
    # the needle: it sews, up and down
    ph = [0, 1, 2, 3, 2, 1][(k // 2) % 6]
    hx, hy = ox + 3, oy + 11 - ph
    for i in range(6): px[hx - 1 - i // 2, hy - i] = C['n'] + (255,)
    px[hx, hy] = C['a'] + (255,); px[hx + 1, hy] = C['A'] + (255,)
    # the thread from the needle down to the hem, swaying
    tx0, ty0 = hx - 3, hy - 5
    for i in range(1, 14):
        x = tx0 - 1 + round(((i / 13) ** 1.5) * 2 * (1 if (k // 8) % 2 else -1) * 0.5)
        y = ty0 + i
        if 0 <= y < 48 and not px[x, y][3]: px[x, y] = C['t'] + (200,)
    return im
sheet = Image.new('RGBA', (48 * 24, 48))
for k in range(24): sheet.paste(frame(k), (k * 48, 0))
sheet.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'animations', 'weaver', 'Idle__r1c24__48x48.png'))



