# Every Country

A world geography quiz in the browser. Click any country on the map, type its name, and it fills in with its continent's color. Name all 197 to finish.

## How to play

- **Click a country**, type its name, and press Enter.
- **Spelling doesn't have to be perfect.** Close misspellings count ("filipines", "kirgistan", "lichtenstien"), as long as the guess is closer to the country you clicked than to any other country. Typing a different real country (Niger for Nigeria) is still wrong.
- **Common alternate names work**: USA, UK, Ivory Coast, Czech Republic, Burma, DRC, Eswatini/Swaziland, and more.
- **Stuck?** *Hint* reveals the name one letter at a time. *Reveal answer* shows it, but the country won't count toward your score.
- **Show remaining** highlights every country you haven't named yet, without giving away the names.
- **Go to next unnamed** zooms straight to a country you still need, moving west to east.
- **Pause** stops the clock and hides the map. The game also pauses itself when you switch tabs.
- Scroll to zoom and drag to pan. Microstates and small islands appear as clickable dots.

Progress saves in your browser automatically, so you can close the page and come back later.

## Which countries are included

197 in total: the 193 UN member states, plus Vatican City, Palestine, Taiwan, and Kosovo. Dependent territories (Greenland, Puerto Rico, New Caledonia, etc.) are drawn in grey and aren't part of the quiz.

## Running it

It's a static site with no build step. Either open `index.html` in a browser, or serve the folder:

```bash
npm start            # or: python3 -m http.server
```

### Publishing with GitHub Pages

In the repository, go to **Settings → Pages**, set the source to **Deploy from a branch**, pick `main` and `/ (root)`, and save. The game will be live at `https://<your-username>.github.io/every-country/`.

## Project layout

```
index.html              page markup
css/style.css           styles (light and dark themes)
js/game.js              map rendering, answer matching, game state
data/world.js           country shapes and accepted names (generated)
scripts/build-data.js   regenerates data/world.js
```

### Editing country names or aliases

Accepted names live in the table at the top of `scripts/build-data.js`. After editing it, regenerate the data:

```bash
npm install
npm run build-data
```

## Credits

- Country shapes: [Natural Earth](https://www.naturalearthdata.com/) (public domain), via [world-atlas](https://github.com/topojson/world-atlas) (ISC). Tuvalu comes from the 1:10m set because it's missing from 1:50m.
- Rendering and zoom: [D3](https://d3js.org/) (ISC) and [TopoJSON](https://github.com/topojson/topojson) (ISC).

## License

MIT
