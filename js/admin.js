/* =====================================================================
   ESPACE ADMINISTRATEUR
   Connexion · Rapport graphique · Réponses · Éditeur de questions · Paramètres
   ===================================================================== */
(function () {
  const S = window.MLCStore, CFG = window.MLC_CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const fmt = (n, d = 1) => (n == null || isNaN(n) ? "—" : n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }));
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const css = (v) => getComputedStyle(document.body).getPropertyValue(v).trim();
  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const TYPE_LABEL = { single: "Choix unique", multi: "Choix multiples", rating: "Note 1-5", nps: "NPS 0-10", matrix: "Grille de critères", text: "Texte court", longtext: "Commentaire" };

  let survey = null, responses = [], editSurvey = null, dirty = false, charts = [];

  function toast(msg) {
    const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }
  const allQuestions = (sv) => sv.sections.flatMap((s) => s.questions);
  const findRole = (role) => allQuestions(survey).find((q) => q.role === role);
  const findQ = (id) => allQuestions(survey).find((q) => q.id === id);

  /* =========================== CONNEXION =========================== */
  $("#modeNote").innerHTML = S.mode === "remote"
    ? "Connexion sécurisée : le mot de passe est vérifié par le serveur Google Apps Script."
    : "Mode démonstration (aucun serveur configuré). Identifiants par défaut : <b>admin</b> / <b>MLC@2026!</b> — à changer avant mise en ligne.";

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#lgBtn"); btn.disabled = true; btn.textContent = "Vérification…";
    $("#loginErr").classList.add("hidden");
    try { await S.login($("#lgUser").value.trim(), $("#lgPass").value); await enterApp(); }
    catch (err) { $("#loginErr").textContent = err.message || "Connexion refusée."; $("#loginErr").classList.remove("hidden"); }
    finally { btn.disabled = false; btn.textContent = "Se connecter"; }
  });
  $("#logout").addEventListener("click", () => { S.logout(); location.reload(); });

  async function enterApp() {
    $("#loginView").classList.add("hidden"); $("#appView").classList.remove("hidden");
    $("#modePill").textContent = S.mode === "remote" ? "Google Sheets connecté" : "Mode démo";
    $("#modePill").classList.toggle("ok", S.mode === "remote");
    await loadData();
    initFilters(); renderReport(); renderResponses(); loadEditor(); renderSettings();
  }
  async function loadData() {
    survey = await S.getSurvey();
    try { responses = await S.getResponses(); }
    catch (e) { toast("Impossible de charger les réponses : " + e.message); responses = []; }
    responses.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /* ============================== ONGLETS ============================== */
  $$(".tabs [data-tab]").forEach((b) => b.addEventListener("click", () => {
    if (dirty && b.dataset.tab !== "editor" && !confirm("Des modifications du questionnaire ne sont pas publiées. Quitter quand même cet onglet ?")) return;
    $$(".tabs [data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    $$("[role=tabpanel]").forEach((p) => p.classList.toggle("hidden", p.id !== "tab-" + b.dataset.tab));
    if (b.dataset.tab === "report") renderReport();
  }));
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ============================== FILTRES ============================== */
  function initFilters() {
    const sec = findQ("secteur"), srv = findRole("services");
    $("#fSector").innerHTML = '<option value="">Tous</option>' + (sec ? sec.options.map((o) => `<option>${esc(o)}</option>`).join("") : "");
    $("#fService").innerHTML = '<option value="">Toutes</option>' + (srv ? srv.options.map((o) => `<option>${esc(o)}</option>`).join("") : "");
    $("#fSector").parentElement.classList.toggle("hidden", !sec);
    $("#fService").parentElement.classList.toggle("hidden", !srv);
  }
  ["#fPeriod", "#fSector", "#fService", "#fFrom", "#fTo"].forEach((s) => $(s).addEventListener("change", () => {
    const custom = $("#fPeriod").value === "custom";
    $("#fFromL").classList.toggle("hidden", !custom); $("#fToL").classList.toggle("hidden", !custom);
    renderReport();
  }));
  $("#refresh").addEventListener("click", async () => { await loadData(); renderReport(); renderResponses(); toast("Données actualisées"); });
  $("#printBtn").addEventListener("click", () => {
    $("#printMeta").textContent = periodLabel() + " · " + filtered().length + " réponses · édité le " + new Date().toLocaleDateString("fr-FR");
    window.print();
  });

  function periodLabel() {
    const p = $("#fPeriod").value;
    const parts = [p === "all" ? "Toute la période" : p === "custom" ? `Du ${$("#fFrom").value || "…"} au ${$("#fTo").value || "…"}` : $("#fPeriod").selectedOptions[0].textContent];
    if ($("#fSector").value) parts.push($("#fSector").value);
    if ($("#fService").value) parts.push($("#fService").value);
    return parts.join(" · ");
  }
  function filtered() {
    const p = $("#fPeriod").value, now = Date.now();
    const sec = $("#fSector").value, srv = $("#fService").value, srvQ = findRole("services");
    let from = -Infinity, to = Infinity;
    if (p === "custom") { if ($("#fFrom").value) from = new Date($("#fFrom").value).getTime(); if ($("#fTo").value) to = new Date($("#fTo").value).getTime() + 864e5; }
    else if (p !== "all") from = now - +p * 864e5;
    return responses.filter((r) => {
      const t = new Date(r.date).getTime(); if (t < from || t > to) return false;
      if (sec && r.answers.secteur !== sec) return false;
      if (srv && srvQ && !(r.answers[srvQ.id] || []).includes(srv)) return false;
      return true;
    });
  }

  /* ============================== STATISTIQUES ============================== */
  const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  function numVals(list, qid) { return list.map((r) => r.answers[qid]).filter((v) => typeof v === "number"); }
  function npsOf(vals) {
    if (!vals.length) return null;
    const p = vals.filter((v) => v >= 9).length, d = vals.filter((v) => v <= 6).length;
    return { score: Math.round(((p - d) / vals.length) * 100), p, d, n: vals.length, pas: vals.length - p - d };
  }
  function matrixStats(list, q) {
    return (q.items || []).map((it) => {
      const vals = list.map((r) => r.answers[q.id] && r.answers[q.id][it]).filter((v) => typeof v === "number" && v > 0);
      const dist = [1, 2, 3, 4, 5].map((n) => vals.filter((v) => v === n).length);
      return { item: it, n: vals.length, avg: mean(vals), dist };
    });
  }
  function countOptions(list, q) {
    const counts = Object.fromEntries((q.options || []).map((o) => [o, 0]));
    let answered = 0;
    list.forEach((r) => {
      const v = r.answers[q.id]; if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) return;
      answered++;
      (Array.isArray(v) ? v : [v]).forEach((x) => { counts[x] = (counts[x] || 0) + 1; });
    });
    return { counts, answered };
  }

  /* ============================== GRAPHIQUES ============================== */
  function chartDefaults() {
    Chart.defaults.font.family = "Barlow, system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = css("--ink-2");
    Chart.defaults.borderColor = css("--grid");
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.plugins.tooltip.backgroundColor = css("--ink");
    Chart.defaults.plugins.tooltip.titleColor = css("--paper");
    Chart.defaults.plugins.tooltip.bodyColor = css("--paper");
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.animation.duration = 500;
  }
  const SERIES = () => [1, 2, 3, 4, 5, 6, 7, 8].map((i) => css("--series-" + i));
  const DIV = () => [1, 2, 3, 4, 5].map((i) => css("--div-" + i));
  const DIV_LABELS = ["1 · Très insatisfait", "2 · Insatisfait", "3 · Neutre", "4 · Satisfait", "5 · Très satisfait"];
  function mk(id, cfg) { const el = document.getElementById(id); if (!el) return; charts.push(new Chart(el, cfg)); }
  const axisGrid = () => ({ color: css("--grid") });
  const wrapLabel = (s, n = 28) => { const w = String(s).split(" "); const out = []; let line = ""; w.forEach((x) => { if ((line + " " + x).trim().length > n) { out.push(line.trim()); line = x; } else line += " " + x; }); out.push(line.trim()); return out; };

  function hBar(id, labels, values, opts = {}) {
    mk(id, { type: "bar", data: { labels: labels.map((l) => wrapLabel(l, opts.wrap || 30)), datasets: [{ data: values, backgroundColor: opts.colors || SERIES()[opts.slot || 0], borderRadius: 4, borderSkipped: "start", maxBarThickness: 26 }] },
      options: { indexAxis: "y", scales: { x: { beginAtZero: true, max: opts.max, grid: axisGrid(), ticks: { callback: opts.tick || ((v) => v) } }, y: { grid: { display: false } } },
        plugins: { tooltip: { callbacks: { label: opts.tip || ((c) => " " + c.formattedValue) } } } } });
  }
  function vBar(id, labels, values, opts = {}) {
    mk(id, { type: "bar", data: { labels, datasets: [{ data: values, backgroundColor: opts.colors || SERIES()[opts.slot || 0], borderRadius: 4, borderSkipped: "start", maxBarThickness: 46 }] },
      options: { scales: { y: { beginAtZero: true, grid: axisGrid(), ticks: { precision: 0 } }, x: { grid: { display: false } } },
        plugins: { tooltip: { callbacks: { label: opts.tip || ((c) => " " + c.formattedValue) } } } } });
  }
  function stacked100(id, stats) {
    const div = DIV(), surface = css("--card");
    mk(id, { type: "bar",
      data: { labels: stats.map((s) => wrapLabel(s.item, 34)), datasets: [0, 1, 2, 3, 4].map((k) => ({
        label: DIV_LABELS[k], data: stats.map((s) => (s.n ? (s.dist[k] / s.n) * 100 : 0)), raw: stats.map((s) => s.dist[k]),
        backgroundColor: div[k], borderColor: surface, borderWidth: { left: 1, right: 1 }, borderSkipped: false, maxBarThickness: 26 })) },
      options: { indexAxis: "y", scales: { x: { stacked: true, max: 100, grid: axisGrid(), ticks: { callback: (v) => v + " %" } }, y: { stacked: true, grid: { display: false } } },
        plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label} : ${Math.round(c.raw)} % (${c.dataset.raw[c.dataIndex]})`, footer: (items) => { const s = stats[items[0].dataIndex]; return `Moyenne ${fmt(s.avg)} / 5 · ${s.n} notes`; } } } } } });
  }
  const divLegend = () => `<div class="legend">${DIV_LABELS.map((l, k) => `<span><i style="background:var(--div-${k + 1})"></i>${l}</span>`).join("")}</div>`;

  /* ============================== RAPPORT ============================== */
  function renderReport() {
    if (!survey) return;
    charts.forEach((c) => c.destroy()); charts = [];
    chartDefaults();
    const list = filtered(), N = list.length, root = $("#report");
    if (!N) {
      root.innerHTML = `<div class="card empty"><h3>Aucune réponse ${responses.length ? "pour ces filtres" : "pour le moment"}</h3><p>${responses.length ? "Élargissez la période ou retirez un filtre." : "Partagez le lien du questionnaire à vos clients, ou générez des données de démonstration depuis l'onglet Paramètres pour prévisualiser le rapport."}</p></div>`;
      return;
    }
    const csatQ = findRole("csat"), npsQ = findRole("nps"), srvQ = findRole("services");
    const csat = csatQ ? numVals(list, csatQ.id) : [];
    const csatAvg = mean(csat), satisfied = csat.filter((v) => v >= 4).length;
    const nps = npsQ ? npsOf(numVals(list, npsQ.id)) : null;
    const incQ = findQ("incident");
    const inc = incQ ? list.filter((r) => r.answers.incident === "Oui").length : null;
    const incAnswered = incQ ? list.filter((r) => r.answers.incident).length : 0;

    // matrices → scores
    const matrices = allQuestions(survey).filter((q) => q.type === "matrix");
    const mStats = matrices.map((q) => ({ q, stats: matrixStats(list, q) }));
    mStats.forEach((m) => { const vals = []; m.stats.forEach((s) => s.dist.forEach((c, k) => { for (let i = 0; i < c; i++) vals.push(k + 1); })); m.avg = mean(vals); m.n = Math.max(0, ...m.stats.map((s) => s.n)); });
    const serviceM = mStats.filter((m) => m.q.showIf && srvQ && m.q.showIf.q === srvQ.id && m.n > 0).sort((a, b) => b.avg - a.avg);
    const otherM = mStats.filter((m) => !serviceM.includes(m) && m.n > 0);
    const allCriteria = mStats.flatMap((m) => m.stats.filter((s) => s.n >= Math.max(2, Math.round(N * .03))).map((s) => ({ ...s, group: m.q.label })));
    const best = [...allCriteria].sort((a, b) => b.avg - a.avg).slice(0, 5);
    const worst = [...allCriteria].sort((a, b) => a.avg - b.avg).slice(0, 5);

    // évolution mensuelle
    const byMonth = {};
    list.forEach((r) => { const d = new Date(r.date); const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); (byMonth[k] = byMonth[k] || []).push(r); });
    const months = Object.keys(byMonth).sort();
    const mLabels = months.map((k) => { const [y, m] = k.split("-"); return MONTHS[+m - 1] + " " + y.slice(2); });

    // priorités
    const prioQ = findQ("priorites");
    const prio = prioQ ? countOptions(list, prioQ) : null;
    const topPrio = prio ? Object.entries(prio.counts).sort((a, b) => b[1] - a[1])[0] : null;

    const npsCat = nps ? (nps.score >= 50 ? "excellent" : nps.score >= 30 ? "très bon" : nps.score >= 0 ? "correct, à consolider" : "préoccupant") : "";
    const shown = new Set([csatQ && csatQ.id, npsQ && npsQ.id, ...matrices.map((q) => q.id)]);

    let h = "";
    /* --- KPI --- */
    h += `<div class="kpis">
      <div class="card kpi"><div class="lab">Réponses</div><div class="val">${N}</div><div class="sub">${periodLabel()}</div></div>
      <div class="card kpi"><div class="lab">Satisfaction globale</div><div class="val">${fmt(csatAvg)}<small> / 5</small></div><div class="sub">${pct(satisfied, csat.length)} % de clients satisfaits (4-5)</div></div>
      <div class="card kpi"><div class="lab">Net Promoter Score</div><div class="val">${nps ? (nps.score > 0 ? "+" : "") + nps.score : "—"}</div><div class="sub">${nps ? `${pct(nps.p, nps.n)} % promoteurs · ${pct(nps.d, nps.n)} % détracteurs` : ""}</div></div>
      <div class="card kpi"><div class="lab">Score moyen des prestations</div><div class="val">${fmt(mean(serviceM.map((m) => m.avg)))}<small> / 5</small></div><div class="sub">${serviceM.length} prestations évaluées</div></div>
      <div class="card kpi"><div class="lab">Incidents signalés</div><div class="val">${inc == null ? "—" : pct(inc, incAnswered) + "<small> %</small>"}</div><div class="sub">${inc == null ? "" : inc + " client(s) sur " + incAnswered}</div></div>
    </div>`;

    /* --- synthèse --- */
    h += `<h2 class="section-h">Synthèse</h2><div class="insights">
      <div class="card panel summary-text">
        <h3 style="margin-bottom:10px">Ce qu'il faut retenir</h3>
        <p>Sur <b>${N}</b> réponse(s), la satisfaction globale atteint <b>${fmt(csatAvg)} / 5</b> et <b>${pct(satisfied, csat.length)} %</b> des clients se déclarent satisfaits ou très satisfaits.</p>
        ${nps ? `<p>Le NPS s'établit à <b>${nps.score > 0 ? "+" : ""}${nps.score}</b>, un niveau ${npsCat} (${nps.p} promoteurs, ${nps.pas} passifs, ${nps.d} détracteurs).</p>` : ""}
        ${serviceM.length ? `<p>Prestation la mieux notée : <b>${esc(serviceM[0].q.label)}</b> (${fmt(serviceM[0].avg)} / 5). Prestation à renforcer en priorité : <b>${esc(serviceM[serviceM.length - 1].q.label)}</b> (${fmt(serviceM[serviceM.length - 1].avg)} / 5).</p>` : ""}
        ${worst.length ? `<p>Critère le plus faible : <b>${esc(worst[0].item)}</b> (${esc(worst[0].group)}, ${fmt(worst[0].avg)} / 5).</p>` : ""}
        ${topPrio && topPrio[1] ? `<p>Priorité d'amélioration la plus citée : <b>${esc(topPrio[0])}</b> (${pct(topPrio[1], prio.answered)} % des répondants).</p>` : ""}
        ${inc != null ? `<p>${pct(inc, incAnswered)} % des clients ont signalé un incident au cours des 12 derniers mois.</p>` : ""}
      </div>
      <div class="card panel">
        <div class="grid2" style="gap:24px">
          <div><h3>Points forts</h3><p class="desc">Critères les mieux notés</p><ul>${best.map((b) => `<li><span>${esc(b.item)}<br><small style="color:var(--muted)">${esc(b.group)}</small></span><b style="color:var(--div-5)">${fmt(b.avg)}</b></li>`).join("")}</ul></div>
          <div><h3>Axes de progrès</h3><p class="desc">Critères les moins bien notés</p><ul>${worst.map((b) => `<li><span>${esc(b.item)}<br><small style="color:var(--muted)">${esc(b.group)}</small></span><b style="color:var(--div-1)">${fmt(b.avg)}</b></li>`).join("")}</ul></div>
        </div>
      </div>
    </div>`;

    /* --- évolution --- */
    h += `<h2 class="section-h">Évolution dans le temps</h2><div class="grid2">
      <div class="card panel"><h3>Réponses reçues par mois</h3><p class="desc">Nombre de questionnaires complétés</p><div class="chart-box"><canvas id="cMonthN"></canvas></div></div>
      <div class="card panel"><h3>Satisfaction globale moyenne par mois</h3><p class="desc">Note moyenne sur 5</p><div class="chart-box"><canvas id="cMonthCsat"></canvas></div></div>
    </div>`;

    /* --- satisfaction & NPS --- */
    h += `<h2 class="section-h">Satisfaction & recommandation</h2><div class="grid2">
      ${csatQ ? `<div class="card panel"><h3>${esc(csatQ.label)}</h3><p class="desc">Répartition des ${csat.length} notes</p><div class="chart-box"><canvas id="cCsat"></canvas></div></div>` : ""}
      ${nps ? `<div class="card panel"><h3>Recommandation (NPS ${nps.score > 0 ? "+" : ""}${nps.score})</h3><p class="desc">Répartition des notes de 0 à 10</p>
        <div class="legend"><span><i style="background:var(--div-1)"></i>Détracteurs 0-6 · ${pct(nps.d, nps.n)} %</span><span><i style="background:var(--div-3)"></i>Passifs 7-8 · ${pct(nps.pas, nps.n)} %</span><span><i style="background:var(--div-5)"></i>Promoteurs 9-10 · ${pct(nps.p, nps.n)} %</span></div>
        <div class="chart-box" style="height:250px"><canvas id="cNps"></canvas></div></div>` : ""}
    </div>`;

    /* --- prestations --- */
    if (serviceM.length || otherM.length) {
      h += `<h2 class="section-h">Performance par prestation</h2><div class="grid2">
        ${serviceM.length ? `<div class="card panel"><h3>Score moyen par prestation</h3><p class="desc">Moyenne de tous les critères, sur 5 · classement décroissant</p><div class="chart-box tall"><canvas id="cServices"></canvas></div></div>` : ""}
        ${otherM.map((m, i) => `<div class="card panel"><h3>${esc(m.q.label)}</h3><p class="desc">Moyenne par critère, sur 5 (diagramme radar)</p><div class="chart-box tall"><canvas id="cRadar${i}"></canvas></div></div>`).join("")}
      </div>`;
    }

    /* --- détail des critères --- */
    const mDetail = mStats.filter((m) => m.n > 0);
    if (mDetail.length) {
      h += `<h2 class="section-h">Détail des évaluations par critère</h2>${divLegend()}<div class="grid2">` +
        mDetail.map((m, i) => `<div class="card panel"><h3>${esc(m.q.label)}</h3><p class="desc">${m.n} client(s) · moyenne ${fmt(m.avg)} / 5</p><div class="chart-box" style="height:${70 + m.stats.length * 42}px"><canvas id="cM${i}"></canvas></div></div>`).join("") + `</div>`;
    }

    /* --- autres questions (générées automatiquement) --- */
    const others = allQuestions(survey).filter((q) => !shown.has(q.id) && ["single", "multi", "rating", "nps"].includes(q.type));
    if (others.length) {
      h += `<h2 class="section-h">Profil des clients & usages</h2><div class="grid2">` + others.map((q) => {
        const c = q.type === "single" || q.type === "multi" ? countOptions(list, q) : null;
        const n = c ? c.answered : numVals(list, q.id).length;
        const rows = q.options ? q.options.length : 5;
        const sub = q.type === "multi" ? `${n} répondants · plusieurs réponses possibles (% des répondants)` : q.type === "rating" ? `${n} notes · moyenne ${fmt(mean(numVals(list, q.id)))} / 5` : `${n} répondants`;
        const doughnut = q.type === "single" && rows <= 4;
        return `<div class="card panel"><h3>${esc(q.label)}</h3><p class="desc">${sub}</p><div class="chart-box" style="height:${doughnut ? 240 : q.type === "rating" || q.type === "nps" ? 240 : Math.max(180, 50 + rows * 36)}px"><canvas id="cQ_${esc(q.id)}"></canvas></div></div>`;
      }).join("") + `</div>`;
    }

    /* --- verbatims & contacts --- */
    const texts = allQuestions(survey).filter((q) => q.type === "longtext");
    const verb = [];
    list.forEach((r) => texts.forEach((q) => { const v = r.answers[q.id]; if (v && String(v).trim()) verb.push({ r, q, v }); }));
    verb.sort((a, b) => new Date(b.r.date) - new Date(a.r.date));
    const contacts = findQ("recontact") ? list.filter((r) => r.answers.recontact === "Oui") : [];
    h += `<h2 class="section-h">Verbatims clients</h2><div class="grid2">
      <div class="card panel"><h3>Commentaires (${verb.length})</h3><p class="desc">Du plus récent au plus ancien</p>
        <div class="comments">${verb.length ? verb.slice(0, 80).map(({ r, q, v }) => `<div class="comment"><div class="meta">${new Date(r.date).toLocaleDateString("fr-FR")} · ${esc(r.answers.entreprise || "Anonyme")}${csatQ && r.answers[csatQ.id] ? " · satisfaction " + r.answers[csatQ.id] + "/5" : ""} · <i>${esc(q.label)}</i></div>${esc(v)}</div>`).join("") : '<p class="desc">Aucun commentaire.</p>'}</div></div>
      <div class="card panel"><h3>Clients à recontacter (${contacts.length})</h3><p class="desc">Ont demandé à être rappelés par leur interlocuteur MLC</p>
        <div class="table-scroll" style="max-height:520px;overflow:auto"><table class="data"><thead><tr><th>Date</th><th>Entreprise</th><th>Contact</th><th>Satisf.</th></tr></thead><tbody>
        ${contacts.slice().reverse().map((r) => `<tr><td>${new Date(r.date).toLocaleDateString("fr-FR")}</td><td>${esc(r.answers.entreprise || "—")}</td><td>${esc(r.answers.email || "—")}</td><td>${csatQ ? (r.answers[csatQ.id] ?? "—") : "—"}</td></tr>`).join("") || '<tr><td colspan="4" class="desc">Aucune demande.</td></tr>'}
        </tbody></table></div></div>
    </div>`;

    root.innerHTML = h;

    /* --- dessin des graphiques --- */
    const s = SERIES(), div = DIV();
    vBar("cMonthN", mLabels, months.map((k) => byMonth[k].length), { slot: 0, tip: (c) => ` ${c.raw} réponse(s)` });
    if (csatQ) mk("cMonthCsat", { type: "line", data: { labels: mLabels, datasets: [{ data: months.map((k) => mean(numVals(byMonth[k], csatQ.id))), borderColor: s[1], backgroundColor: s[1], borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: .3, spanGaps: true }] },
      options: { interaction: { mode: "index", intersect: false }, scales: { y: { min: 1, max: 5, grid: axisGrid(), ticks: { stepSize: 1 } }, x: { grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: (c) => ` ${fmt(c.raw)} / 5 · ${byMonth[months[c.dataIndex]].length} réponses` } } } } });
    if (csatQ) vBar("cCsat", DIV_LABELS, [1, 2, 3, 4, 5].map((n) => csat.filter((v) => v === n).length), { colors: div, tip: (c) => ` ${c.raw} client(s) · ${pct(c.raw, csat.length)} %` });
    if (nps) { const nv = numVals(list, npsQ.id); vBar("cNps", Array.from({ length: 11 }, (_, i) => String(i)), Array.from({ length: 11 }, (_, i) => nv.filter((v) => v === i).length), { colors: Array.from({ length: 11 }, (_, i) => (i <= 6 ? div[0] : i <= 8 ? div[2] : div[4])), tip: (c) => ` ${c.raw} client(s)` }); }
    if (serviceM.length) hBar("cServices", serviceM.map((m) => m.q.label), serviceM.map((m) => +m.avg.toFixed(2)), { max: 5, slot: 0, wrap: 34, tip: (c) => ` ${fmt(c.raw)} / 5 · ${serviceM[c.dataIndex].n} client(s)` });
    otherM.forEach((m, i) => mk("cRadar" + i, { type: "radar", data: { labels: m.stats.map((x) => wrapLabel(x.item, 22)), datasets: [{ data: m.stats.map((x) => x.avg && +x.avg.toFixed(2)), borderColor: s[0], backgroundColor: s[0] + "33", borderWidth: 2, pointRadius: 4, pointBackgroundColor: s[0] }] },
      options: { scales: { r: { min: 0, max: 5, ticks: { stepSize: 1, backdropColor: "transparent" }, grid: { color: css("--grid") }, angleLines: { color: css("--grid") }, pointLabels: { font: { size: 12 } } } }, plugins: { tooltip: { callbacks: { label: (c) => ` ${fmt(c.raw)} / 5` } } } } }));
    mDetail.forEach((m, i) => stacked100("cM" + i, m.stats));
    others.forEach((q) => {
      const id = "cQ_" + q.id;
      if (q.type === "single" || q.type === "multi") {
        const c = countOptions(list, q); const entries = Object.entries(c.counts);
        if (q.type === "multi") entries.sort((a, b) => b[1] - a[1]);
        if (q.type === "single" && entries.length <= 4) {
          mk(id, { type: "doughnut", data: { labels: entries.map((e) => e[0]), datasets: [{ data: entries.map((e) => e[1]), backgroundColor: s.slice(0, entries.length), borderColor: css("--card"), borderWidth: 2 }] },
            options: { cutout: "62%", plugins: { legend: { display: true, position: "right", labels: { boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 3, color: css("--ink-2") } }, tooltip: { callbacks: { label: (x) => ` ${x.label} : ${x.raw} (${pct(x.raw, c.answered)} %)` } } } } });
        } else {
          hBar(id, entries.map((e) => e[0]), entries.map((e) => pct(e[1], c.answered)), { slot: 0, max: 100, tick: (v) => v + " %", tip: (x) => ` ${x.raw} % · ${entries[x.dataIndex][1]} client(s)` });
        }
      } else if (q.type === "rating") {
        const v = numVals(list, q.id); vBar(id, DIV_LABELS, [1, 2, 3, 4, 5].map((n) => v.filter((x) => x === n).length), { colors: div, tip: (c) => ` ${c.raw} · ${pct(c.raw, v.length)} %` });
      } else if (q.type === "nps") {
        const v = numVals(list, q.id); vBar(id, Array.from({ length: 11 }, (_, i) => String(i)), Array.from({ length: 11 }, (_, i) => v.filter((x) => x === i).length), { colors: Array.from({ length: 11 }, (_, i) => (i <= 6 ? div[0] : i <= 8 ? div[2] : div[4])) });
      }
    });
  }

  /* ============================== RÉPONSES ============================== */
  function renderResponses() {
    const q = ($("#search").value || "").toLowerCase();
    const csatQ = findRole("csat"), npsQ = findRole("nps"), srvQ = findRole("services");
    const rows = responses.slice().reverse().filter((r) => !q || JSON.stringify(r.answers).toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
    $("#respTable").innerHTML = `<thead><tr><th>Date</th><th>Référence</th><th>Entreprise</th><th>Secteur</th><th>Satisf.</th><th>NPS</th><th>Prestations</th><th></th></tr></thead><tbody>` +
      (rows.length ? rows.map((r) => `<tr>
        <td>${new Date(r.date).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
        <td><code>${esc(r.id)}</code></td>
        <td>${esc(r.answers.entreprise || "Anonyme")}</td>
        <td>${esc(r.answers.secteur || "—")}</td>
        <td>${csatQ && r.answers[csatQ.id] ? "★ " + r.answers[csatQ.id] : "—"}</td>
        <td>${npsQ && r.answers[npsQ.id] !== undefined ? r.answers[npsQ.id] : "—"}</td>
        <td>${srvQ && r.answers[srvQ.id] ? r.answers[srvQ.id].length : 0}</td>
        <td style="white-space:nowrap"><button class="icon-btn" data-view="${esc(r.id)}">Voir</button> <button class="icon-btn danger" data-del="${esc(r.id)}" aria-label="Supprimer">✕</button></td></tr>`).join("")
        : `<tr><td colspan="8" class="empty">Aucune réponse.</td></tr>`) + "</tbody>";
  }
  $("#search").addEventListener("input", renderResponses);
  $("#respTable").addEventListener("click", async (e) => {
    const v = e.target.closest("[data-view]"), d = e.target.closest("[data-del]");
    if (v) showResponse(responses.find((r) => r.id === v.dataset.view));
    if (d && confirm("Supprimer définitivement cette réponse ?")) {
      try { await S.deleteResponse(d.dataset.del); responses = responses.filter((r) => r.id !== d.dataset.del); renderResponses(); toast("Réponse supprimée"); }
      catch (err) { toast("Erreur : " + err.message); }
    }
  });
  function fmtAnswer(q, v) {
    if (v === undefined || v === null || v === "") return '<span style="color:var(--muted)">—</span>';
    if (q && q.type === "matrix") return "<ul style='margin:0;padding-left:18px'>" + Object.entries(v).map(([k, n]) => `<li>${esc(k)} : <b>${n === 0 ? "N/C" : n + "/5"}</b></li>`).join("") + "</ul>";
    if (Array.isArray(v)) return v.map(esc).join(" · ");
    if (q && q.type === "rating") return "★".repeat(v) + ` (${v}/5)`;
    return esc(v);
  }
  function showResponse(r) {
    const known = new Set();
    let h = `<p style="color:var(--muted);margin-top:0">${new Date(r.date).toLocaleString("fr-FR")} · <code>${esc(r.id)}</code></p><table class="data"><tbody>`;
    survey.sections.forEach((s) => s.questions.forEach((q) => { known.add(q.id); if (r.answers[q.id] !== undefined) h += `<tr><th style="white-space:normal;width:45%">${esc(q.label)}</th><td>${fmtAnswer(q, r.answers[q.id])}</td></tr>`; }));
    Object.keys(r.answers).filter((k) => !known.has(k)).forEach((k) => { h += `<tr><th>${esc(k)} <small>(question supprimée)</small></th><td>${fmtAnswer(null, r.answers[k])}</td></tr>`; });
    openDlg("Détail de la réponse", h + "</tbody></table>", `<button class="btn btn-dark btn-sm" data-close>Fermer</button>`);
  }

  /* ---------- exports ---------- */
  function download(name, content, type) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const stamp = () => new Date().toISOString().slice(0, 10);
  $("#expJson").addEventListener("click", () => download(`mlc-reponses-${stamp()}.json`, JSON.stringify(responses, null, 2), "application/json"));
  $("#expCsv").addEventListener("click", () => {
    const cols = [{ h: "Référence", f: (r) => r.id }, { h: "Date", f: (r) => new Date(r.date).toLocaleString("fr-FR") }];
    allQuestions(survey).forEach((q) => {
      if (q.type === "matrix") (q.items || []).forEach((it) => cols.push({ h: `${q.label} — ${it}`, f: (r) => { const v = r.answers[q.id] && r.answers[q.id][it]; return v === undefined ? "" : v === 0 ? "N/C" : v; } }));
      else cols.push({ h: q.label, f: (r) => { const v = r.answers[q.id]; return Array.isArray(v) ? v.join(" ; ") : v ?? ""; } });
    });
    const cell = (v) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = "﻿" + [cols.map((c) => cell(c.h)).join(";"), ...responses.map((r) => cols.map((c) => cell(c.f(r))).join(";"))].join("\r\n");
    download(`mlc-reponses-${stamp()}.csv`, csv, "text/csv;charset=utf-8");
  });

  /* ============================== DIALOGUE ============================== */
  const dlg = $("#dlg");
  function openDlg(title, body, foot) { $("#dlgTitle").textContent = title; $("#dlgBody").innerHTML = body; $("#dlgFoot").innerHTML = foot || ""; dlg.showModal(); }
  $("#dlgClose").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); });

  /* ============================== ÉDITEUR ============================== */
  function loadEditor() { editSurvey = clone(survey); setDirty(false); renderEditor(); }
  function setDirty(v) { dirty = v; $("#edMsg").textContent = v ? "Modifications non publiées." : "Aucune modification."; $("#edMsg").style.color = v ? "var(--red)" : ""; }

  function renderEditor() {
    $("#editor").innerHTML = editSurvey.sections.map((s, si) => `
      <div class="card ed-sec">
        <div class="ed-sec-head">
          <span class="type-badge">Étape ${si + 1}</span>
          <h3>${esc(s.title)}</h3>
          <div class="ed-actions">
            <button class="icon-btn" data-a="sec-up" data-s="${si}" ${si === 0 ? "disabled" : ""} aria-label="Monter l'étape">↑</button>
            <button class="icon-btn" data-a="sec-down" data-s="${si}" ${si === editSurvey.sections.length - 1 ? "disabled" : ""} aria-label="Descendre l'étape">↓</button>
            <button class="icon-btn" data-a="sec-edit" data-s="${si}">Renommer</button>
            <button class="icon-btn danger" data-a="sec-del" data-s="${si}">Supprimer</button>
          </div>
        </div>
        ${s.questions.map((q, qi) => `
          <div class="ed-q">
            <span class="type-badge">${TYPE_LABEL[q.type] || q.type}</span>
            <div class="lbl"><b>${esc(q.label)}</b>${q.required ? ' <span style="color:var(--red)">*</span>' : ""}
              <small>id : ${esc(q.id)}${q.showIf ? ` · affichée si « ${esc(q.showIf.q)} » ${q.showIf.equals !== undefined ? "= " + esc(q.showIf.equals) : q.showIf.includes !== undefined ? "contient " + esc(q.showIf.includes) : "≠ seulement " + esc(q.showIf.notIncludesOnly)}` : ""}${q.role ? " · rôle : " + q.role : ""}</small></div>
            <div class="ed-actions">
              <button class="icon-btn" data-a="q-up" data-s="${si}" data-q="${qi}" ${qi === 0 ? "disabled" : ""} aria-label="Monter">↑</button>
              <button class="icon-btn" data-a="q-down" data-s="${si}" data-q="${qi}" ${qi === s.questions.length - 1 ? "disabled" : ""} aria-label="Descendre">↓</button>
              <button class="icon-btn" data-a="q-edit" data-s="${si}" data-q="${qi}">Modifier</button>
              <button class="icon-btn danger" data-a="q-del" data-s="${si}" data-q="${qi}" aria-label="Supprimer">✕</button>
            </div>
          </div>`).join("")}
        <div class="ed-q"><button class="btn btn-line btn-sm" data-a="q-add" data-s="${si}">＋ Ajouter une question</button></div>
      </div>`).join("");
  }

  $("#editor").addEventListener("click", (e) => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const si = +b.dataset.s, qi = +b.dataset.q, secs = editSurvey.sections, a = b.dataset.a;
    const swap = (arr, i, j) => { [arr[i], arr[j]] = [arr[j], arr[i]]; setDirty(true); renderEditor(); };
    if (a === "sec-up") swap(secs, si, si - 1);
    if (a === "sec-down") swap(secs, si, si + 1);
    if (a === "q-up") swap(secs[si].questions, qi, qi - 1);
    if (a === "q-down") swap(secs[si].questions, qi, qi + 1);
    if (a === "sec-del" && confirm(`Supprimer l'étape « ${secs[si].title} » et ses ${secs[si].questions.length} question(s) ?`)) { secs.splice(si, 1); setDirty(true); renderEditor(); }
    if (a === "q-del" && confirm("Supprimer cette question ? Les réponses déjà collectées sont conservées dans les exports.")) { secs[si].questions.splice(qi, 1); setDirty(true); renderEditor(); }
    if (a === "sec-edit") editSection(si);
    if (a === "q-edit") editQuestion(si, qi);
    if (a === "q-add") editQuestion(si, -1);
  });
  $("#edAddSec").addEventListener("click", () => editSection(-1));

  function editSection(si) {
    const s = si >= 0 ? editSurvey.sections[si] : { title: "", intro: "" };
    openDlg(si >= 0 ? "Modifier l'étape" : "Nouvelle étape",
      `<label class="field"><span>Titre de l'étape</span><input type="text" id="esT" value="${esc(s.title)}"></label>
       <label class="field"><span>Texte d'introduction (facultatif)</span><textarea id="esI">${esc(s.intro || "")}</textarea></label>`,
      `<button class="btn btn-line btn-sm" data-close>Annuler</button><button class="btn btn-primary btn-sm" id="esOk">Enregistrer</button>`);
    $("#esOk").onclick = () => {
      const t = $("#esT").value.trim(); if (!t) { $("#esT").focus(); return; }
      if (si >= 0) Object.assign(s, { title: t, intro: $("#esI").value.trim() });
      else editSurvey.sections.push({ id: "s_" + Date.now().toString(36), title: t, intro: $("#esI").value.trim(), questions: [] });
      dlg.close(); setDirty(true); renderEditor();
    };
  }

  function slug(t) { return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "q"; }
  function editQuestion(si, qi) {
    const isNew = qi < 0;
    const q = isNew ? { id: "", type: "single", label: "", required: true, options: [] } : clone(editSurvey.sections[si].questions[qi]);
    const condSources = allQuestions(editSurvey).filter((x) => (x.type === "single" || x.type === "multi") && x.id !== q.id);
    const c = q.showIf || {};
    openDlg(isNew ? "Nouvelle question" : "Modifier la question", `
      <label class="field"><span>Intitulé de la question</span><textarea id="eqL" style="min-height:70px">${esc(q.label)}</textarea></label>
      <div class="row2">
        <label class="field"><span>Type de réponse</span><select id="eqT">${Object.entries(TYPE_LABEL).map(([k, v]) => `<option value="${k}" ${q.type === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label class="field"><span>Identifiant ${isNew ? "(généré automatiquement)" : "(non modifiable)"}</span><input type="text" id="eqId" value="${esc(q.id)}" ${isNew ? "" : "readonly"} placeholder="ex : delai_livraison"></label>
      </div>
      <label class="field"><span>Aide / précision (facultatif)</span><input type="text" id="eqH" value="${esc(q.help || "")}"></label>
      <label class="field" id="eqOptsF"><span id="eqOptsL">Options (une par ligne)</span><textarea id="eqO" style="min-height:140px">${esc((q.type === "matrix" ? q.items : q.options || []).join("\n"))}</textarea></label>
      <label style="display:flex;gap:8px;align-items:center;margin:12px 0"><input type="checkbox" id="eqR" ${q.required ? "checked" : ""} style="width:auto"> Réponse obligatoire</label>
      <fieldset style="border:1px solid var(--line);border-radius:10px;padding:12px 14px">
        <legend style="font-weight:600;font-size:14px;padding:0 6px">Affichage conditionnel</legend>
        <div class="row3">
          <select id="eqCq"><option value="">Toujours afficher</option>${condSources.map((x) => `<option value="${esc(x.id)}" ${c.q === x.id ? "selected" : ""}>${esc(x.label.slice(0, 60))}</option>`).join("")}</select>
          <select id="eqCop"></select>
          <select id="eqCv"></select>
        </div>
      </fieldset>
      ${q.role ? `<p class="note">Cette question alimente l'indicateur « ${q.role === "csat" ? "Satisfaction globale" : q.role === "nps" ? "NPS" : "Prestations utilisées"} » du rapport. Conservez son type.</p>` : ""}
      ${!isNew ? `<p class="note">Modifier le texte d'une option change la façon dont les nouvelles réponses sont comptées : les anciennes réponses gardent l'ancien libellé.</p>` : ""}`,
      `<button class="btn btn-line btn-sm" data-close>Annuler</button><button class="btn btn-primary btn-sm" id="eqOk">Enregistrer</button>`);

    const syncType = () => {
      const t = $("#eqT").value;
      $("#eqOptsF").classList.toggle("hidden", !["single", "multi", "matrix"].includes(t));
      $("#eqOptsL").textContent = t === "matrix" ? "Critères à noter de 1 à 5 (un par ligne)" : "Options (une par ligne)";
    };
    const syncCond = () => {
      const src = condSources.find((x) => x.id === $("#eqCq").value);
      $("#eqCop").innerHTML = src ? (src.type === "multi" ? `<option value="includes">contient</option><option value="notIncludesOnly" ${c.notIncludesOnly !== undefined ? "selected" : ""}>n'est pas uniquement</option>` : `<option value="equals">est égal à</option>`) : "";
      $("#eqCv").innerHTML = src ? src.options.map((o) => `<option ${[c.equals, c.includes, c.notIncludesOnly].includes(o) ? "selected" : ""}>${esc(o)}</option>`).join("") : "";
      $("#eqCop").disabled = $("#eqCv").disabled = !src;
    };
    $("#eqT").onchange = syncType; $("#eqCq").onchange = syncCond; syncType(); syncCond();
    $("#eqL").addEventListener("input", () => { if (isNew) $("#eqId").value = slug($("#eqL").value); });

    $("#eqOk").onclick = () => {
      const label = $("#eqL").value.trim(); if (!label) { $("#eqL").focus(); return; }
      const t = $("#eqT").value;
      let id = isNew ? slug($("#eqId").value || label) : q.id;
      if (isNew) { const ids = new Set(allQuestions(editSurvey).map((x) => x.id)); let base = id, k = 2; while (ids.has(id)) id = base + "_" + k++; }
      const lines = $("#eqO").value.split("\n").map((x) => x.trim()).filter(Boolean);
      if (["single", "multi"].includes(t) && lines.length < 2) { alert("Indiquez au moins deux options."); return; }
      if (t === "matrix" && !lines.length) { alert("Indiquez au moins un critère."); return; }
      const out = { id, type: t, label, required: $("#eqR").checked };
      if ($("#eqH").value.trim()) out.help = $("#eqH").value.trim();
      if (q.role) out.role = q.role;
      if (t === "single" || t === "multi") out.options = lines;
      if (t === "matrix") out.items = lines;
      if ($("#eqCq").value) out.showIf = { q: $("#eqCq").value, [$("#eqCop").value]: $("#eqCv").value };
      if (isNew) editSurvey.sections[si].questions.push(out); else editSurvey.sections[si].questions[qi] = out;
      dlg.close(); setDirty(true); renderEditor();
    };
  }

  $("#edSave").addEventListener("click", async () => {
    if (!editSurvey.sections.length) { alert("Le questionnaire doit contenir au moins une étape."); return; }
    const b = $("#edSave"); b.disabled = true; b.textContent = "Publication…";
    try { survey = await S.saveSurvey(clone(editSurvey)); editSurvey = clone(survey); setDirty(false); initFilters(); toast("Questionnaire publié ✓"); }
    catch (e) { toast("Erreur : " + e.message); }
    finally { b.disabled = false; b.textContent = "Publier"; }
  });
  $("#edReset").addEventListener("click", async () => {
    if (!confirm("Remplacer le questionnaire actuel par la version d'origine ? Les réponses déjà collectées ne sont pas supprimées.")) return;
    try { survey = await S.resetSurvey(); loadEditor(); initFilters(); toast("Questions d'origine rétablies"); } catch (e) { toast("Erreur : " + e.message); }
  });
  $("#edExport").addEventListener("click", () => download(`mlc-questionnaire-${stamp()}.json`, JSON.stringify(editSurvey, null, 2), "application/json"));
  $("#edImport").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const j = JSON.parse(await f.text()); if (!j.sections) throw new Error("format invalide"); editSurvey = j; setDirty(true); renderEditor(); toast("Questionnaire importé — cliquez sur Publier"); }
    catch (err) { alert("Fichier non reconnu : " + err.message); }
    e.target.value = "";
  });

  /* ============================== PARAMÈTRES ============================== */
  function renderSettings() {
    $("#setMode").innerHTML = S.mode === "remote"
      ? `<p><span class="pill ok">Connecté</span> Les réponses sont enregistrées dans votre Google Sheet via :<br><code>${esc(CFG.BACKEND_URL)}</code></p>`
      : `<p><span class="pill">Mode démo</span> Aucun serveur n'est configuré : les réponses ne sont visibles que dans le navigateur où elles ont été saisies. Pour une vraie campagne, déployez le script <code>backend/Code.gs</code> (Google Apps Script, gratuit) puis collez son URL dans <code>js/config.js</code> → <code>BACKEND_URL</code>. La marche à suivre est détaillée dans le README.</p>`;
    $("#pwdHelp").innerHTML = S.mode === "remote"
      ? "Le mot de passe est stocké côté serveur : dans Google Apps Script, ouvrez <b>Paramètres du projet → Propriétés du script</b> et modifiez la valeur <code>ADMIN_PASSWORD</code>. L'outil ci-dessous ne sert qu'au mode démo."
      : "Saisissez le nouveau mot de passe : l'outil calcule son empreinte SHA-256 à copier dans <code>js/config.js</code> → <code>ADMIN_PASS_SHA256</code> (le mot de passe lui-même n'est jamais écrit dans le code).";
  }
  $("#hashBtn").addEventListener("click", async () => {
    const p = $("#newPwd").value;
    if (p.length < 10) { $("#hashOut").innerHTML = '<span style="color:var(--red)">10 caractères minimum.</span>'; return; }
    $("#hashOut").innerHTML = `ADMIN_PASS_SHA256: <code>"${await S.sha256(p)}"</code>`;
  });
  $("#clearAll").addEventListener("click", async () => {
    if (!confirm("Supprimer TOUTES les réponses ? Cette action est irréversible.")) return;
    if (prompt('Tapez SUPPRIMER pour confirmer') !== "SUPPRIMER") return;
    try { await S.clearResponses(); responses = []; renderResponses(); renderReport(); toast("Toutes les réponses ont été supprimées"); } catch (e) { toast("Erreur : " + e.message); }
  });
  $("#impResp").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const list = JSON.parse(await f.text()); if (!Array.isArray(list)) throw new Error("format invalide"); await S.importResponses(list); await loadData(); renderResponses(); renderReport(); toast(list.length + " réponse(s) importée(s)"); }
    catch (err) { alert("Import impossible : " + err.message); }
    e.target.value = "";
  });

  /* ---------- générateur de données de démonstration ---------- */
  $("#genDemo").addEventListener("click", async () => {
    if (S.mode === "remote" && !confirm("Vous êtes connecté à Google Sheets : les réponses fictives y seront ajoutées. Continuer ?")) return;
    const list = makeDemo(120);
    try { await S.importResponses(list); await loadData(); renderResponses(); renderReport(); toast("120 réponses fictives générées — onglet Rapport"); }
    catch (e) { toast("Erreur : " + e.message); }
  });
  function makeDemo(n) {
    const rnd = Math.random, pick = (a) => a[Math.floor(rnd() * a.length)];
    const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.15;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const bias = {}; allQuestions(survey).forEach((q) => { bias[q.id] = (rnd() - .55) * .9; (q.items || []).forEach((it) => (bias[q.id + it] = (rnd() - .5) * .7)); });
    const comments = {
      good: ["Service fiable, chauffeurs professionnels. Continuez ainsi.", "Très bonne réactivité de notre interlocuteur, rapports clairs.", "Dédouanement rapide sur nos derniers conteneurs, merci.", "Bonne coordination au port de Pointe-Noire.", "Le suivi par géolocalisation est très apprécié par nos équipes."],
      mid: ["Globalement satisfait, mais les délais vers Brazzaville varient trop.", "Les factures pourraient être plus détaillées.", "Améliorer l'information en cas de retard sur le corridor.", "Le tracking en ligne mériterait d'être plus à jour."],
      bad: ["Retard important sur une livraison vers Bangui, peu d'information.", "Plusieurs relances nécessaires pour obtenir les documents.", "Tarifs en hausse sans explication claire."]
    };
    const out = [];
    for (let i = 0; i < n; i++) {
      const age = Math.pow(rnd(), 1.4) * 360;
      const date = new Date(Date.now() - age * 864e5 - rnd() * 864e5);
      const trend = (360 - age) / 360 * .35;   // amélioration progressive
      const base = clamp(3.75 + trend + gauss() * .8, 1, 5);
      const a = {};
      survey.sections.forEach((s) => s.questions.forEach((q) => {
        if (!S.isVisible(q, a)) return;
        if (!q.required && rnd() < .35 && q.type !== "multi") return;
        switch (q.type) {
          case "single":
            if (q.id === "incident") a[q.id] = rnd() < (base < 3 ? .5 : .12) ? "Oui" : "Non";
            else if (q.id === "recontact") a[q.id] = rnd() < (base < 3 ? .7 : .25) ? "Oui" : "Non";
            else a[q.id] = pick(q.options); break;
          case "multi": {
            let opts = q.options.filter((o) => o !== "Aucun");
            if (q.options.includes("Aucun") && rnd() < .25) { a[q.id] = ["Aucun"]; break; }
            if (q.id === "pays") { const v = ["République du Congo"]; if (rnd() < .3) v.push(opts[1]); if (rnd() < .25) v.push(opts[2]); if (rnd() < .07) v.push(opts[3]); a[q.id] = v.filter((x) => q.options.includes(x)); if (!a[q.id].length) a[q.id] = [pick(q.options)]; break; }
            const k = 1 + Math.floor(rnd() * (q.role === "services" ? 4 : 3));
            const w = opts.map((o, j) => ({ o, r: rnd() * (q.role === "services" ? 1 / (1 + j * .25) : 1) })).sort((x, y) => y.r - x.r);
            a[q.id] = w.slice(0, k).map((x) => x.o); if (!q.required && rnd() < .2) delete a[q.id]; break;
          }
          case "rating": a[q.id] = Math.round(clamp(base + bias[q.id] * .5 + gauss() * .5, 1, 5)); break;
          case "nps": a[q.id] = Math.round(clamp((base - 1) * 2.75 + .4 + gauss() * 1.2, 0, 10)); break;
          case "matrix": a[q.id] = {}; (q.items || []).forEach((it) => { a[q.id][it] = rnd() < .05 ? 0 : Math.round(clamp(base + bias[q.id] + bias[q.id + it] + gauss() * .55, 1, 5)); }); break;
          case "longtext": if (rnd() < .45) a[q.id] = pick(base >= 4 ? comments.good : base >= 3 ? comments.mid : comments.bad); break;
          case "text": a[q.id] = q.id === "email" ? `contact${i + 1}@client-demo.cg` : q.id === "entreprise" ? (rnd() < .3 ? "" : "Client démo " + (i + 1)) : "Réponse " + (i + 1); if (!a[q.id]) delete a[q.id]; break;
        }
      }));
      out.push({ id: "DEMO" + Date.now().toString(36).toUpperCase() + i, date: date.toISOString(), answers: a, meta: { demo: true } });
    }
    return out;
  }

  /* ============================== DÉMARRAGE ============================== */
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => renderReport());
  if (S.isLogged() && (S.mode === "demo" || sessionStorage.getItem("mlc_admin_pass"))) enterApp();
})();
