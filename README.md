# Dweller

A dark side-scroller set in The Seeker universe. You are a small hooded figure hiding in shadow:
light burns, shadow heals. Six levels descend from ice-cold caves to a strange beating heart, and
each one ends with a sliver of a broken crystal. Gather all six and the crystal becomes whole, and
the door to the final depth opens.

- **Play:** open `dist/dweller.html` in any browser. It is one self-contained file: code, art and
  procedurally generated music are all inside.
- **Controls:** A/D or arrows move · Space jump · S roll/crawl · E send the SEEKER (once found) ·
  Esc pause (a menu: resume, return to tether, new descent, settings, back to town; or press R, N, O, Q) · O settings · M mute · F fullscreen. Touch and gamepads work too.
- **Settings** (O on the title or pause screen; the bottom line on touch; Select on a gamepad): music and sound
  volume, soft or full flashes, screen shake on or off.
- **Saves** live in the browser. Settings → COPY SAVE CODE gives your whole save as one line of text; keep it, or
  paste it with LOAD SAVE CODE on another device or browser to carry on there.
- **Door candles:** every level's door in town has two candles that burn blue. The left one lights when you
  beat the level without the light finding you; the right one when you beat it without sending the SEEKER.
- **The kept room:** light all twelve candles and, after the Core, the great arch at the foot of the Codex's
  right-hand tower wakes (its twelve candles burn as the town's do). Through it, a dark room over still water where
  the drops of light that fall from the crystals play the room's music, and SEEKER #0, kept for you: two more spare
  lives in every descent of The Deep, and quick soles.

## The levels

| | Level | Theme | Route |
|---|---|---|---|
| I | The Descent | ice-blue caves |
| II | The Mycelium | fungal teal | 
| III | The Glass Garden | violet crystal | 
| IV | The Foundry | rust and copper | 
| V | Ember Deep | crimson | 
| VI | The Heart | 
| VII | The Core | void and white - Needs the SEEKER |



The Deep is a run of eight rooms through four strata, two rooms each.
## Source

- `src/` — the game: `sim.js` (deterministic 96 Hz simulation, also runs in Node), `render.js`,
  `audio.js` (Web Audio, Seeker 48 Hz tuning), `main.js` (menus, input, flow), `town.js` (the town above the descent), `deep.js` (the rules of The Deep).
- `tools/` — `level1.py` … `level6.py` build the levels with `levelkit.py`; `bot.js` is a search bot
  that proves every level can be beaten; `build.py` bundles everything into `dist/dweller.html`;
  `seekernet.py` draws all 2,222 SEEKER NET seekers from the collection's layers into `assets/seeker/net.png`
  (with their traits in `net.json`, and in `net_lids.png` the pixels that change when each one shuts its eyes);
  `deep.py` builds The Deep's rooms, `deepcheck.js` proves every one of them with the bot at the gentlest and the
  harshest tier, and `vischeck.js` looks for things that would look wrong (lamps in rock, liquid with no banks,
  emitters hanging from nothing).
- `test/` — browser checks with Playwright (replays of the bot's solutions, the town, the companion, The Deep, the
  Codex's stat cards at five screen sizes). Each takes an optional folder for its screenshots; by default they go
  to `shots/`, which git ignores.

Build: `python3 tools/levelN.py` for each level (writes `build/levelN.json`), then
`python3 tools/build.py`. The build first runs `node tools/bake_levels.cjs`, which bakes every level's terrain
tiles with The Seeker's ice-biome tiling (`tools/bake_terrain.cjs`, from the community-games port) into
`build/terrainN.png`. The tiling rules live in `tools/ice_tiling.json`; regenerate them from a checkout of
The Seeker with `python3 tools/extract_ice_tiling.py path/to/the-seeker tools/ice_tiling.json`. Verify a level: `node tools/bot.js build/level3.json build/solution3.json`.

## Credits and licence

Code is MIT. Includes or adapts assets from The Seeker by The Seeker contributors, licensed CC BY 4.0
(https://github.com/TheSeekerGame/the-seeker). The companion is any SEEKER NET seeker, drawn from the collection's layers
(https://github.com/TheSeekerGame/collections). The town's residents are The Seeker's collector, exile and monk, and a weaver. The Prime in the Codex is drawn after
the Planetary Primes collection (https://ord.net/collection/planetaryprimes). Changes were made where applicable.
