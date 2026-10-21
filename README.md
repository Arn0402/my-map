# Walking Map · Weimar

A 3D map of central Weimar that shows how far you can walk from any point in 5, 10 and 15 minutes, and about how many people live there.

- The buildings stand at their measured height, coloured by their main use, with a legend.
- Click on the ground and the map draws three nested areas along the streets you can reach on foot, and highlights the buildings they touch.
- A panel gives, for each time, the number of buildings reached and the approximate number of residents.
- Drag to orbit, right-drag to pan, scroll to zoom.
- A switch at the top turns the map into **Urban Explorer**, a small game (see below).

## Run it

```
npm install     install the packages
npm run dev     start the app at http://localhost:5173
```

On every push to `main`, GitHub Pages publishes it at `https://<user>.github.io/<repo>/` (Settings → Pages → Source: "GitHub Actions").

## Method

- **Start.** A click starts at the nearest node of the pedestrian network (`streets.graph.json`). If no walkable street lies within 100 m of the click, the map says so and draws nothing.
- **Walking.** The walk follows walkable edges in both directions, using each edge's `length` in metres, at 4.8 km/h, which is 80 m per minute. So 5, 10 and 15 minutes mean 400, 800 and 1200 m along the network.
- **Areas.** Each area is the street segments reached in that time, including the reachable part of the last segment, with a band of 25 m on each side, joined into one shape. It isn't a circle and isn't a convex hull.
- **Buildings.** A building counts as reached if its footprint touches the area. The 10- and 15-minute counts include the buildings of the smaller areas.
- **Residents.** These come from the Zensus 2022 100 m grid. For every cell that overlaps the area, the app takes the cell's population times the share of the cell's area that lies inside the area. It adds these up and rounds to the nearest 10.
- **Cells without a figure.** Cells where the census published no resident count (`population: null`) aren't zero. They are left out of the sum, and the panel shows how many such cells overlap the area.

## Limits

- The residents are an estimate. Everyone in a cell is assumed to be spread evenly over the cell, also over streets and courtyards. The census also changes small counts slightly at random to protect privacy, so single cells are approximate.
- One cell in the kit has no published resident count, so areas that overlap it undercount slightly.
- Everyone walks at the same speed. Slopes, steps, crossings and waiting at traffic lights aren't taken into account. The walk starts at the nearest network node, not at the exact point clicked.
- The 25 m band is drawn with rounded ends made of short straight pieces, so its edge may be up to about half a metre off the exact curve.
- The kit is cut at its edge, so walks near the boundary stop where the data stops.
- One building (id 17520) has no use in the data. It is shown in grey as "no use given".
- Urban Explorer, quests: a quest target counts by its main use only. A building that is mostly flats but has a café floor doesn't count as food.
- Urban Explorer, challenges: in the dense centre, food buildings can stand right next to each other. A trail can then be very short; two neighbours may even share the same access point (a 0 m leg).

## Urban Explorer

A virtual mini-game on the same map. It uses no GPS, and nothing is invented: every target is a real building from the kit, described only by its data.

In this mode the city is shown as a pastel miniature: a cream tile with pale paths, soft light and buildings in quiet pastel tints by use. The buildings keep their real footprints, heights and positions.

### Quests

1. **Start.** Click a starting point, with the same 100 m rule as the Walking Map.
2. **Quest.** Choose a quest. Targets are buildings whose main `use` fits it:
   - Culture Hunter: `culture` and `entertainment`, 77 buildings.
   - Food Explorer: `food_and_drink`, 65 buildings.
   - Knowledge Seeker: `education`, 67 buildings.

   Each quest shows how many targets lie within 5, 10 and 15 minutes from the start.
3. **Time.** Choose a 5, 10 or 15-minute limit. A limit with no targets is greyed out, so every quest you can pick can be finished.
4. **Targets.** Targets are the quest's buildings that the Walking Map's own calculation reaches in that time. They glow in the quest colour with a small floating gem; collected ones turn gold.
5. **Route and badge.** Clicking a target or its gem draws the shortest walk there along the network, as a glowing line with a small travelling light. The walk goes to the nearest point of the street network whose 25 m band touches the building, the same rule that counts the building as reached. A badge is collected only when you click "Collect badge".

### Challenges

One trail per quest: Food Trail, Culture Trail and Knowledge Trail. Visit three different buildings of that quest in one walk of at most 10 minutes (800 m at 80 m/min).

1. **Start and trail.** Set a start and pick a trail. The buildings you can still reach within 800 m glow.
2. **Stops.** Click three of them. The order you click them in is the order you walk them: start → 1 → 2 → 3, one way.
3. **Total.** The route is drawn along the network as you go. A meter shows the total distance and time; it turns red when the walk is over budget. Remove a stop with its gem or with × in the list.
4. **Finish.** "Complete trail" works only with three stops and a total of at most 800 m. You get stars by comparing your walk with the best possible one from the same start (★★★ within 10 % of it, ★★ within 30 %, otherwise ★), and the best total is then shown.

How a challenge walk is measured:
- Each stop is reached at its access point: the point of the network nearest to the building's footprint. It must lie within the 25 m band.
- Every leg is the shortest walk along the network between two access points (the first from the start node), using the edges' `length` in metres.
- When you pick a trail, the game searches all orders of three eligible buildings for the best total. If no three fit into 800 m from that start, it says so and the trail can't be played from there.

Checked on the data from 121 start points spread over the network, a trail fits in 10 minutes from:

| Trail | Starts |
| --- | --- |
| Food | 121 |
| Culture | 110 |
| Knowledge | 115 |

Badges (local storage key `urban-explorer-badges`) and trail trophies (`urban-explorer-achievements`) are kept in this browser only. "Reset badges" clears both after asking. Buildings have no names in the data, so a building is shown by its use, id, height, floors and estimated floor area.

## Data

Everything comes from the city kit in `public/data/`; nothing is fetched from the internet. See `public/data/SOURCES.md` for details.

| File | Used for | Source | Licence |
| --- | --- | --- | --- |
| `buildings.geojson` | footprints, heights, main use | 3D building models LoD2 of Thuringia (GDI-Th); uses: Egor Gaydukov | dl-de/by-2-0 |
| `streets.graph.json` | pedestrian network for walking and drawing | Egor Gaydukov, InfAU, Bauhaus-Universität Weimar | |
| `zensus.geojson` | residents per 100 m cell | Zensus 2022, Statistische Ämter des Bundes und der Länder | dl-de/by-2-0 |
| `kit.json` | centre and size of the kit area | the generator | |

Buildings: 3D building models LoD2 © GDI-Th (dl-de/by-2-0). Land use and pedestrian network: Egor Gaydukov, InfAU, Bauhaus-Universität Weimar. Census grid: Zensus 2022, © Statistische Ämter des Bundes und der Länder (dl-de/by-2-0).

## How this was made

1. Tools: Claude Code, with the model Claude Opus 5.5 (`claude-opus-5-5`).
2. I decided: I decided to transform the original Walking Map into an interactive 3D city exploration game with quests, collectible badges, and walking challenges.
3. The agent did: it read the kit and its sources, and wrote the React Three Fiber app, the walking, route and resident calculations, the Urban Explorer game with its pastel 3D look and trail challenges, and this README, testing them on the data in a browser.
4. I checked: I checked that both map modes work, that selecting buildings displays walking routes, and that badges can be collected successfully.