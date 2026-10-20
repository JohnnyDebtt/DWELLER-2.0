# Dweller

A dark side-scroller set in The Seeker universe. You are a small hooded figure hiding in shadow:
light burns, shadow heals. Six levels descend from ice-cold caves to a strange beating heart, and
each one ends with a sliver of a broken crystal. Gather all six and the crystal becomes whole, and
the door to the final depth opens.

- **Play:** open `dist/dweller.html` in any browser. It is one self-contained file: code, art and
  procedurally generated music are all inside.
- **Controls:** A/D or arrows move · Space jump · S roll/crawl · E send the SEEKER (once found) ·
  Esc pause (N new descent, Q map) · M mute · F fullscreen. Touch and gamepads work too.

## The levels

| | Level | Theme | Route |
|---|---|---|---|
| I | The Descent | ice-blue caves | long halls left to right: lamps, walking lights, eyes, beams |
| II | The Mycelium | fungal teal | up a gill ladder, bounce across the canopy, swing on hyphae, a high or low road, under or over the eyed caps, down the spore shafts, a cap bridge over tar, down a root tangle, through the spore cloud and up the mycelial web, the gill run, the spore stair, caps that throw you over fallen stems |
| III | The Glass Garden | violet crystal | a switchback that doubles back, a prism well, hush stones, a glass stair, a turning orrery, a mirror hall of crossing beams, a crystal tree, light raining upward, a shard field, a frost bridge, a glass orchard, down four tiers of a lens |
| IV | The Foundry | rust and copper | ride hot-air vents up a stack, drop through gantry grates, pull the boiler lever and race the fire, hammers in the forge, a scrapyard, pipeworks, a smelter of sprung plates, an oiled conveyor, a crane yard, climb the bellows |
| V | Ember Deep | crimson | climb out past a buried sun on ash vents, stepping stones and geysers over tar, three suns and three stones, a walking sun, an obsidian stair, a turning sun, magma locks, ash falls, a magma river, the slag heaps, the kiln |
| VI | The Heart | bone and magenta | a loop through the atrium, a rib cage climb, weave between two beating ventricles, a maze of vessels, tendons, the aorta, the lungs, a nerve to crawl, the marrow, synapses, a valve chain, the pulse, two valves to still the heart |
| VII | The Core | void and white | behind the door of six slivers: set them in the Guardian's six alcoves while its gaze turns; each sliver changes it (it turns faster, the room breathes, its gaze splits, it keeps the beat, it flares like a sun, its heart stumbles); then it shatters and the light floods down the shaft after you. Needs the SEEKER |

New pieces along the way: one-way shelves you can drop through, bounce caps, slick glass, vines to climb,
hot-air vents, and hush stones that put nearby lights to sleep for a few beats.

Each level is unlocked by beating the one before. The map shows an orb for every level, lit in the
colour of its sliver once beaten.

**The SEEKER.** Somewhere in level II a wall is not stone. Behind it sleeps a SEEKER. Wake it
and it follows you; press E and it flies to the nearest light and covers it for a few beats (an
eclipse), then needs a moment to recharge. Every level can be beaten without it.

## Source

- `src/` — the game: `sim.js` (deterministic 96 Hz simulation, also runs in Node), `render.js`,
  `audio.js` (Web Audio, Seeker 48 Hz tuning), `main.js` (map, menus, input).
- `tools/` — `level1.py` … `level6.py` build the levels with `levelkit.py`; `bot.js` is a search bot
  that proves every level can be beaten; `build.py` bundles everything into `dist/dweller.html`.
- `test/` — browser checks with Playwright (replays of the bot's solutions, map flow, the companion).

Build: `python3 tools/levelN.py` for each level (writes `build/levelN.json`), then
`python3 tools/build.py`. The build first runs `node tools/bake_levels.cjs`, which bakes every level's terrain
tiles with The Seeker's ice-biome tiling (`tools/bake_terrain.cjs`, from the community-games port) into
`build/terrainN.png`. The tiling rules live in `tools/ice_tiling.json`; regenerate them from a checkout of
The Seeker with `python3 tools/extract_ice_tiling.py path/to/the-seeker tools/ice_tiling.json`. Verify a level: `node tools/bot.js build/level3.json build/solution3.json`.

## Credits and licence

Code is MIT. Includes or adapts assets from The Seeker by The Seeker contributors, licensed CC BY 4.0
(https://github.com/TheSeekerGame/the-seeker). The companion is drawn from SEEKER NET #1895
(https://github.com/TheSeekerGame/collections). Changes were made where applicable.
