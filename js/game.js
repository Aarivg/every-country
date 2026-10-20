// Every Country — click a country on the world map, then name it.
(() => {
  const DATA = window.WORLD_DATA;
  const Q = DATA.quiz; // key -> {n, c, a}
  const KEYS = Object.keys(Q);
  const TOTAL = KEYS.length;
  const CONT = [
    ["Africa", "--af"], ["Asia", "--as"], ["Europe", "--eu"],
    ["North America", "--na"], ["South America", "--sa"], ["Oceania", "--oc"],
  ];
  const CVAR = Object.fromEntries(CONT);

  // ---------- state ----------
  let S = { s: {} };

  // ---------- map ----------
  const W = 1000, H = 520;
  const topo = DATA.topo;
  const feats = topojson.feature(topo, topo.objects.countries).features;
  feats.push(DATA.tuvalu);
  const proj = d3.geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], { type: "FeatureCollection", features: feats });
  const path = d3.geoPath(proj);
  const svg = d3.select("#map");
  const world = d3.select("#world");
  const wrap = document.getElementById("wrap");
  world.append("path").attr("class", "graticule").attr("d", path(d3.geoGraticule10()));
  const gC = world.append("g"), gM = world.append("g");

  const byKey = {}; // k -> {els:[], marker, anchor}
  for (const f of feats) {
    const p = f.properties || {};
    const el = gC.append("path").attr("d", path(f)).attr("class", "c " + (p.k ? "q" : "t")).node();
    if (p.k) {
      el.dataset.k = p.k;
      (byKey[p.k] = byKey[p.k] || { els: [], areaKm: 0, polys: [] }).els.push(el);
      byKey[p.k].areaKm += d3.geoArea(f) * 6371 * 6371;
      const g = f.geometry;
      const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      for (const c of polys) byKey[p.k].polys.push({ type: "Polygon", coordinates: c });
    }
  }
  // anchor = centroid of each country's largest polygon
  for (const k of KEYS) {
    const o = byKey[k];
    let best = null, ba = -1;
    for (const pg of o.polys) { const a = path.area(pg); if (a > ba) { ba = a; best = pg; } }
    o.anchor = path.centroid(best);
    // tiny countries get a dot marker so they can be clicked
    o.small = o.areaKm < 12000;
    if (o.small) {
      const c = gM.append("circle").attr("class", "mk").attr("cx", o.anchor[0]).attr("cy", o.anchor[1]).attr("r", 3).node();
      c.dataset.k = k; o.marker = c;
    }
  }

  // ---------- zoom ----------
  let K = 1;
  const zoom = d3.zoom().scaleExtent([1, 80]).translateExtent([[-40, -40], [W + 40, H + 40]])
    .on("zoom", e => { world.attr("transform", e.transform); K = e.transform.k; rescale(); });
  svg.call(zoom).on("dblclick.zoom", null);
  const pxPerUnit = () => { const r = svg.node().getBoundingClientRect(); return Math.min(r.width / W, r.height / H) || 1; };
  // keep dots, labels and hatching the same size on screen at every zoom level
  function rescale() {
    const u = pxPerUnit() * K;
    const rr = 5 / u;
    for (const k of KEYS) {
      const o = byKey[k];
      if (o.marker) o.marker.setAttribute("r", rr);
    }
  }
  window.addEventListener("resize", () => { rescale(); });
  document.getElementById("zIn").onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1.8);
  document.getElementById("zOut").onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.8);
  document.getElementById("zReset").onclick = () => svg.transition().duration(350).call(zoom.transform, d3.zoomIdentity);
  rescale();

})();
