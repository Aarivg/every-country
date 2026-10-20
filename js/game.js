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
  const STORE = "every-country-v1";

  // ---------- state ----------
  let S = { s: {}, m: 0, t: 0, order: [], labels: true, spot: false };
  try { const raw = localStorage.getItem(STORE); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch (e) {}
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} };
  window.addEventListener("pagehide", save);
  let running = false, paused = false, tick0 = 0;

  // ---------- answer matching ----------
  const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(/\bsaint\b/g, "st").replace(/\bst\./g, "st")
    .replace(/^\s*the\s+/, "")
    .replace(/[^a-z]/g, "");
  const NAMES = {};
  for (const k of KEYS) NAMES[k] = [...new Set([Q[k].n, ...Q[k].a].map(norm))];
  const exactOwner = {};
  for (const k of KEYS) for (const n of NAMES[k]) exactOwner[n] = exactOwner[n] || k;
  // Damerau (optimal string alignment) distance: swaps of neighbouring letters count as one edit
  function lev(a, b) {
    const m = a.length, n = b.length; if (Math.abs(m - n) > 5) return 99;
    const d = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[m][n];
  }
  // How many mistakes a name of this length can absorb
  const tolFor = len => len >= 14 ? 4 : len >= 9 ? 3 : len >= 6 ? 2 : len >= 4 ? 1 : 0;
  const nearest = (g, k) => Math.min(...NAMES[k].map(t => {
    const d = lev(g, t);
    return d <= tolFor(t.length) ? d : 99;
  }));
  function check(k, guess) {
    const g = norm(guess);
    if (!g) return { ok: false, empty: true };
    if (NAMES[k].includes(g)) return { ok: true };
    const other = exactOwner[g];
    if (other && other !== k) return { ok: false, other };
    // Close enough to this country, and closer to it than to any other country's name
    const mine = nearest(g, k);
    if (mine === 99) return { ok: false };
    for (const o of KEYS) if (o !== k && nearest(g, o) <= mine) return { ok: false };
    return { ok: true, typo: true };
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
  const hatch = document.getElementById("hatch");
  const gC = world.append("g"), gM = world.append("g"), gL = world.append("g").attr("class", "labels");

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
    o.label = gL.append("text").attr("class", "lbl").attr("x", o.anchor[0]).attr("y", o.anchor[1]).attr("dy", "0.35em").text(Q[k].n).node();
    o.label.style.display = "none";
    o.labelArea = path.area(best);
  }

  // ---------- zoom ----------
  let K = 1;
  const zoom = d3.zoom().scaleExtent([1, 80]).translateExtent([[-40, -40], [W + 40, H + 40]])
    .on("zoom", e => { world.attr("transform", e.transform); K = e.transform.k; rescale(); placePop(); hideTip(); });
  svg.call(zoom).on("dblclick.zoom", null);
  const pxPerUnit = () => { const r = svg.node().getBoundingClientRect(); return Math.min(r.width / W, r.height / H) || 1; };
  // keep dots, labels and hatching the same size on screen at every zoom level
  function rescale() {
    const u = pxPerUnit() * K;
    hatch.setAttribute("patternTransform", `rotate(45) scale(${1 / K})`);
    const rr = (S.spot ? 7 : 5) / u;
    for (const k of KEYS) {
      const o = byKey[k];
      if (o.marker) o.marker.setAttribute("r", rr);
      const show = S.labels && (S.s[k]) && (o.labelArea * u * u > 900 || (o.small && K >= 4) || (o.labelArea * u * u > 120 && K >= 3));
      o.label.style.display = show ? "" : "none";
      if (show) { o.label.style.fontSize = (11 / u) + "px"; o.label.style.strokeWidth = (3 / u) + "px"; o.label.setAttribute("y", o.anchor[1] + (o.small ? 12 / u : 0)); }
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
      el.classList.toggle("revealed", st === "r");
      el.classList.toggle("sel", k === selKey);
      if (st === "f") el.style.setProperty("--cf", `var(${CVAR[Q[k].c]})`);
    }
  }

  // ---------- tooltip for named countries ----------
  const tip = document.getElementById("tip");
  function hideTip() { tip.hidden = true; }
  svg.on("pointermove", e => {
    const k = e.target.dataset && e.target.dataset.k;
    if (k && S.s[k] && e.pointerType === "mouse") {
      const r = wrap.getBoundingClientRect();
      tip.textContent = Q[k].n; tip.hidden = false;
      tip.style.left = (e.clientX - r.left) + "px"; tip.style.top = (e.clientY - r.top) + "px";
    } else hideTip();
  }).on("pointerleave", hideTip);

  // ---------- naming card ----------
  const pop = document.getElementById("pop");
  let selKey = null, hintN = 0;
  svg.on("click", e => {
    const k = e.target.dataset && e.target.dataset.k;
    if (paused) return;
    if (k) open(k); else close();
  });
  function open(k) {
    const prev = selKey; selKey = k; hintN = 0;
    if (prev) paint(prev);
    paint(k);
    if (paused) return;
    if (!running && !allDone()) startClock();
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
  function pattern(name, n) {
    // reveal first n letters, keep spaces/punctuation visible
    let shown = 0;
    return [...name].map(ch => {
      if (!/\p{L}/u.test(ch)) return ch === " " ? " " : ch;
      shown++; return shown <= n ? ch.toUpperCase() : "_";
    }).join(" ");
  }
  function render() {
    const k = selKey, q = Q[k], st = S.s[k];
    const cont = `<div class="eyebrow"><span>${st ? q.c : "Name this country"}</span><button class="close" aria-label="Close">✕</button></div>`;
    if (st) {
      pop.innerHTML = cont + `<div class="answer">${q.n}</div><div class="fb">${st === "f" ? "You named this one." : "Revealed. It won't count toward your score."}</div>`;
    } else {
      pop.innerHTML = cont + `
        <form autocomplete="off"><input id="guess" type="text" placeholder="Type the country name" spellcheck="false" autocapitalize="words" enterkeyhint="go"><button class="go" type="submit">Name</button></form>
        ${hintN ? `<div class="pattern">${pattern(q.n, hintN)}</div>` : ""}
        <div class="fb" id="fb"></div>
        <div class="row"><button class="ghost" id="hintBtn" type="button">${hintN ? "Another letter" : "Hint"}</button><button class="ghost" id="revBtn" type="button">Reveal answer</button></div>
        `;
      pop.querySelector("form").onsubmit = ev => { ev.preventDefault(); submit(); };
      pop.querySelector("#hintBtn").onclick = () => { const v = pop.querySelector("input").value; hintN = Math.min(hintN + 1, q.n.replace(/[^\p{L}]/gu, "").length); render(); const i = pop.querySelector("input"); i.value = v; i.focus(); };
      pop.querySelector("#revBtn").onclick = () => { setState(k, "r"); };
    }
    pop.querySelector(".close").onclick = close;
  }
  function submit() {
    const k = selKey, inp = pop.querySelector("input"), fb = pop.querySelector("#fb");
    const r = check(k, inp.value);
    if (r.empty) { inp.focus(); return; }
    if (r.ok) { setState(k, "f"); return; }
    S.m++; save(); updateStats();
    fb.className = "fb bad";
    fb.textContent = r.other ? (S.s[r.other] === "f" ? `You've already named ${Q[r.other].n}. Try again.` : `${Q[r.other].n} is somewhere else. Try again.`) : "Not quite. Try again.";
    pop.classList.remove("shake"); void pop.offsetWidth; pop.classList.add("shake");
    inp.select();
  }
  function setState(k, st) {
    S.s[k] = st; S.order = S.order.filter(x => x !== k); S.order.push(k);
    save(); paint(k); updateStats(); rescale();
    if (st === "f") toast(`${Q[k].n} · ${namedCount()} of ${TOTAL}`);
    close();
    if (allDone()) finish();
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

  // ---------- toast ----------
  const toastEl = document.getElementById("toast"); let toastT;
  function toast(msg) { toastEl.textContent = "✓ " + msg; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => toastEl.hidden = true, 1600); }

  // ---------- stats ----------
  const namedCount = () => KEYS.filter(k => S.s[k] === "f").length;
  const revCount = () => KEYS.filter(k => S.s[k] === "r").length;
  const allDone = () => KEYS.every(k => S.s[k]);
  const fmt = ms => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };
  const contsEl = document.getElementById("conts");
  contsEl.innerHTML = CONT.map(([c, v]) => `<div class="cont" style="--cf:var(${v})"><span>${c}</span><b data-c="${c}"></b><div class="track"><div class="fill" data-cf="${c}"></div></div></div>`).join("");
  function updateStats() {
    document.getElementById("leftN").textContent = remaining().length;
    document.getElementById("sNamed").innerHTML = `${namedCount()}<small> / ${TOTAL}</small>`;
    document.getElementById("sRev").textContent = revCount();
    document.getElementById("sMiss").textContent = S.m;
    for (const [c] of CONT) {
      const ks = KEYS.filter(k => Q[k].c === c), n = ks.filter(k => S.s[k] === "f").length;
      contsEl.querySelector(`[data-c="${c}"]`).textContent = `${n} / ${ks.length}`;
      contsEl.querySelector(`[data-cf="${c}"]`).style.width = (100 * n / ks.length) + "%";
    }
    const rec = S.order.slice(-12).reverse();
    document.getElementById("recent").innerHTML = rec.length
      ? rec.map(k => `<li class="${S.s[k] === "r" ? "rv" : ""}" style="--cf:var(${CVAR[Q[k].c]})"><i></i>${Q[k].n}</li>`).join("")
      : `<li class="empty">Nothing yet. Click any country on the map to start.</li>`;
  }
  // ---------- timer ----------
  function startClock() { running = true; tick0 = Date.now() - S.t; }
  setInterval(() => {
    if (running) { S.t = Date.now() - tick0; if (S.t % 5000 < 1000) save(); }
    document.getElementById("sTime").textContent = fmt(S.t);
  }, 500);

  // ---------- pause ----------
  const pauseBtn = document.getElementById("pauseBtn"), pausedEl = document.getElementById("pausedEl");
  function setPaused(p) {
    if (p === paused) return;
    if (p && allDone()) return;
    paused = p;
    if (p) { if (running) S.t = Date.now() - tick0; running = false; close(); hideTip(); save(); }
    else if (S.t > 0 || Object.keys(S.s).length) startClock();
    pausedEl.hidden = !p;
    pauseBtn.innerHTML = p ? "▶ Resume" : "❚❚ Pause";
    if (!p) document.getElementById("sTime").textContent = fmt(S.t);
  }
  pauseBtn.onclick = () => setPaused(!paused);
  document.getElementById("resumeBtn").onclick = () => setPaused(false);
  // stop the clock when the tab is hidden
  document.addEventListener("visibilitychange", () => { if (document.hidden && running) setPaused(true); });

  // ---------- finding remaining countries ----------
  const spotBtn = document.getElementById("spotBtn");
  function syncSpot() {
    wrap.classList.toggle("spot", !!S.spot);
    spotBtn.setAttribute("aria-pressed", S.spot ? "true" : "false");
    rescale();
  }
  spotBtn.onclick = () => { S.spot = !S.spot; save(); syncSpot(); };
  const remaining = () => KEYS.filter(k => !S.s[k]);
  // ---------- completion ----------
  function finish() {
    running = false; save();
    pauseBtn.disabled = true;
    const box = document.getElementById("doneBox");
    const n = namedCount();
    box.hidden = false;
    box.innerHTML = `<div class="done"><strong>${n === TOTAL ? "Every country named." : "Map complete."}</strong>You named ${n} of ${TOTAL} in ${fmt(S.t)} with ${S.m} wrong guess${S.m === 1 ? "" : "es"}${revCount() ? ` and ${revCount()} revealed` : ""}.</div>`;
  }

  // ---------- options ----------
  const labelsBtn = document.getElementById("labelsBtn");
  function syncLabels() { labelsBtn.textContent = S.labels ? "Hide names on map" : "Show names on map"; rescale(); }
  labelsBtn.onclick = () => { S.labels = !S.labels; save(); syncLabels(); };
  // confirmation happens inline, in place of the button that was pressed
  function confirmIn(slotId, question, onYes) {
    const slot = document.getElementById(slotId), orig = slot.innerHTML;
    slot.innerHTML = `<div class="confirm"><span>${question}</span><button class="yes">Yes</button><button class="no">Cancel</button></div>`;
    slot.querySelector(".yes").onclick = () => { slot.innerHTML = orig; bindOpts(); onYes(); };
    slot.querySelector(".no").onclick = () => { slot.innerHTML = orig; bindOpts(); };
  }
  function bindOpts() {
    const rb = document.getElementById("resetBtn"), gb = document.getElementById("giveBtn");
    if (rb) rb.onclick = () => confirmIn("resetSlot", "Clear all progress?", () => {
      close(); S.s = {}; S.m = 0; S.t = 0; S.order = []; running = false; setPaused(false); pauseBtn.disabled = false; save();
      KEYS.forEach(paint); updateStats(); rescale(); document.getElementById("doneBox").hidden = true;
      svg.transition().duration(350).call(zoom.transform, d3.zoomIdentity);
    });
    if (gb) gb.onclick = () => confirmIn("giveSlot", "Reveal every remaining country?", () => {
      close(); KEYS.forEach(k => { if (!S.s[k]) { S.s[k] = "r"; S.order.push(k); } }); save();
      KEYS.forEach(paint); updateStats(); rescale(); finish();
    });
  }
  bindOpts();

  KEYS.forEach(paint); updateStats(); syncLabels(); syncSpot();
  if (allDone()) finish();
})();
