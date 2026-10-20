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

  // ---------- answer matching ----------
  const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
  const NAMES = {};
  for (const k of KEYS) NAMES[k] = [...new Set([Q[k].n, ...Q[k].a].map(norm))];
  function check(k, guess) {
    const g = norm(guess);
    if (!g) return { ok: false, empty: true };
    if (NAMES[k].includes(g)) return { ok: true };
    return { ok: false };
  }

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
    .on("zoom", e => { world.attr("transform", e.transform); K = e.transform.k; rescale(); placePop(); });
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
  window.addEventListener("resize", () => { rescale(); placePop(); });
  document.getElementById("zIn").onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1.8);
  document.getElementById("zOut").onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.8);
  document.getElementById("zReset").onclick = () => svg.transition().duration(350).call(zoom.transform, d3.zoomIdentity);
  rescale();

  // ---------- painting ----------
  function paint(k) {
    const st = S.s[k], o = byKey[k];
    const all = o.marker ? [...o.els, o.marker] : o.els;
    for (const el of all) {
      el.classList.toggle("found", st === "f");
      el.classList.toggle("sel", k === selKey);
      if (st === "f") el.style.setProperty("--cf", `var(${CVAR[Q[k].c]})`);
    }
  }

  // ---------- naming card ----------
  const pop = document.getElementById("pop");
  let selKey = null;
  svg.on("click", e => {
    const k = e.target.dataset && e.target.dataset.k;
    if (k) open(k); else close();
  });
  function open(k) {
    const prev = selKey; selKey = k;
    if (prev) paint(prev);
    paint(k);
    render();
    pop.hidden = false;
    placePop();
    const inp = pop.querySelector("input");
    if (inp && matchMedia("(pointer: fine)").matches) inp.focus();
  }
  function close() {
    if (!selKey) return;
    const k = selKey; selKey = null; paint(k); pop.hidden = true;
  }
  function render() {
    const k = selKey, q = Q[k], st = S.s[k];
    const cont = `<div class="eyebrow"><span>${st ? q.c : "Name this country"}</span><button class="close" aria-label="Close">✕</button></div>`;
    if (st) {
      pop.innerHTML = cont + `<div class="answer">${q.n}</div><div class="fb">You named this one.</div>`;
    } else {
      pop.innerHTML = cont + `
        <form autocomplete="off"><input id="guess" type="text" placeholder="Type the country name" spellcheck="false" autocapitalize="words" enterkeyhint="go"><button class="go" type="submit">Name</button></form>
        <div class="fb" id="fb"></div>
        `;
      pop.querySelector("form").onsubmit = ev => { ev.preventDefault(); submit(); };
    }
    pop.querySelector(".close").onclick = close;
  }
  function submit() {
    const k = selKey, inp = pop.querySelector("input"), fb = pop.querySelector("#fb");
    const r = check(k, inp.value);
    if (r.empty) { inp.focus(); return; }
    if (r.ok) { setState(k, "f"); return; }
    fb.className = "fb bad";
    fb.textContent = "Not quite. Try again.";
    inp.select();
  }
  function setState(k, st) {
    S.s[k] = st;
    paint(k);
    close();
  }
  // float the card beside the country (phones get a bottom sheet instead)
  function placePop() {
    if (!selKey || pop.hidden) return;
    const o = byKey[selKey];
    const t = d3.zoomTransform(svg.node());
    const [x, y] = t.apply(o.anchor);
    const svgR = svg.node().getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    const u = Math.min(svgR.width / W, svgR.height / H) || 1;
    const offX = (svgR.width - W * u) / 2 + (svgR.left - wr.left), offY = (svgR.height - H * u) / 2 + (svgR.top - wr.top);
    let px = offX + x * u + 18, py = offY + y * u - 30;
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    if (px + pw > wr.width - 12) px = offX + x * u - pw - 18;
    px = Math.max(12, Math.min(px, wr.width - pw - 12));
    py = Math.max(12, Math.min(py, wr.height - ph - 12));
    pop.style.left = px + "px"; pop.style.top = py + "px";
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });

  KEYS.forEach(paint);
})();
