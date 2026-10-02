/* =====================================================================
   QUESTIONNAIRE — rendu, navigation par étapes, validation, envoi
   ===================================================================== */
(function () {
  const S = window.MLCStore;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DRAFT = "mlc_draft_v1";
  const STAR_TXT = ["", "Très insatisfait", "Insatisfait", "Neutre", "Satisfait", "Très satisfait"];

  let survey, step = 0, answers = {};
  try { answers = JSON.parse(localStorage.getItem(DRAFT) || "{}"); } catch (e) {}
  const saveDraft = () => { try { localStorage.setItem(DRAFT, JSON.stringify(answers)); } catch (e) {} };

  const form = $("#form");

  /* Une étape n'apparaît que si au moins une question y est visible */
  const visibleSections = () => survey.sections.filter((s) => s.questions.some((q) => S.isVisible(q, answers)));

  function renderSteps() {
    const vs = visibleSections();
    $("#steps").innerHTML = vs.map((s, i) => `<li class="${i < step ? "done" : i === step ? "current" : ""}">${esc(s.title)}</li>`).join("");
    $("#bar").style.width = Math.round((step / vs.length) * 100) + "%";
  }

  function qHTML(q) {
    const id = "q_" + q.id, v = answers[q.id];
    const req = q.required ? '<span class="req" aria-hidden="true">*</span>' : "";
    let body = "";
    switch (q.type) {
      case "single":
      case "multi": {
        const multi = q.type === "multi";
        body = `<div class="opts" role="${multi ? "group" : "radiogroup"}" aria-labelledby="${id}_l">` + (q.options || []).map((o, i) => {
          const checked = multi ? Array.isArray(v) && v.includes(o) : v === o;
          return `<label class="opt ${multi ? "multi" : ""}"><input type="${multi ? "checkbox" : "radio"}" name="${id}" value="${esc(o)}" ${checked ? "checked" : ""}><span class="box"></span><span>${esc(o)}</span></label>`;
        }).join("") + "</div>";
        break;
      }
      case "rating":
        body = `<div class="stars" role="radiogroup" aria-labelledby="${id}_l">` + [1, 2, 3, 4, 5].map((n) =>
          `<button type="button" data-star="${n}" role="radio" aria-checked="${v === n}" aria-label="${n} sur 5 — ${STAR_TXT[n]}" class="${v >= n ? "on" : ""}">★</button>`).join("") +
          `<span class="caption">${v ? STAR_TXT[v] : ""}</span></div>`;
        break;
      case "nps":
        body = `<div class="nps" role="radiogroup" aria-labelledby="${id}_l">` + Array.from({ length: 11 }, (_, n) => {
          const cls = n <= 6 ? "d" : n <= 8 ? "p" : "g";
          return `<button type="button" data-nps="${n}" role="radio" aria-checked="${v === n}" class="${cls} ${v === n ? "on" : ""}">${n}</button>`;
        }).join("") + `</div><div class="nps-legend"><span>0 — Pas du tout probable</span><span>10 — Très probable</span></div>`;
        break;
      case "matrix": {
        const m = v || {};
        body = `<table class="matrix"><thead><tr><th>Critère</th>${[1, 2, 3, 4, 5].map((n) => `<th>${n}</th>`).join("")}<th>N/C</th></tr></thead><tbody>` +
          (q.items || []).map((it, i) => `<tr data-row="${i}"><td>${esc(it)}</td>` +
            [1, 2, 3, 4, 5].map((n) => `<td><button type="button" class="mx s${n} ${m[it] === n ? "on" : ""}" data-item="${esc(it)}" data-val="${n}" aria-label="${esc(it)} : ${n} sur 5" aria-pressed="${m[it] === n}">${n}</button></td>`).join("") +
            `<td><button type="button" class="mx na ${m[it] === 0 ? "on" : ""}" data-item="${esc(it)}" data-val="0" aria-label="${esc(it)} : non concerné" aria-pressed="${m[it] === 0}">N/C</button></td></tr>`).join("") +
          `</tbody></table><p class="q-help" style="margin:10px 0 0">1 = très insatisfait · 5 = très satisfait · N/C = non concerné</p>`;
        break;
      }
      case "longtext":
        body = `<textarea id="${id}" name="${id}" aria-labelledby="${id}_l" maxlength="2000">${esc(v || "")}</textarea>`;
        break;
      default:
        body = `<input type="text" id="${id}" name="${id}" aria-labelledby="${id}_l" value="${esc(v || "")}" maxlength="200">`;
    }
    return `<div class="q" data-q="${esc(q.id)}" data-type="${q.type}">
      <span class="q-label" id="${id}_l">${esc(q.label)}${req}</span>
      ${q.help ? `<p class="q-help">${esc(q.help)}</p>` : ""}
      <div class="q-body">${body}</div>
      <div class="err" role="alert">${q.type === "matrix" ? "Merci de noter chaque critère (ou N/C)." : "Cette question est obligatoire."}</div>
    </div>`;
  }

  function render() {
    const vs = visibleSections();
    if (step >= vs.length) step = vs.length - 1;
    const sec = vs[step];
    const last = step === vs.length - 1;
    form.innerHTML = `
      <span class="kicker">Étape ${step + 1} sur ${vs.length}</span>
      <h2>${esc(sec.title)}</h2>
      ${sec.intro ? `<p class="intro">${esc(sec.intro)}</p>` : ""}
      ${sec.questions.filter((q) => S.isVisible(q, answers)).map(qHTML).join("")}
      <div class="nav">
        <button type="button" class="btn btn-line" id="prev" ${step === 0 ? "disabled" : ""}>← Précédent</button>
        <button type="submit" class="btn btn-primary" id="next">${last ? "Envoyer mes réponses" : "Suivant →"}</button>
      </div>`;
    renderSteps();
  }

  /* Re-rendu partiel quand une réponse change la visibilité d'autres questions */
  function visibilitySignature() { return survey.sections.map((s) => s.questions.map((q) => (S.isVisible(q, answers) ? 1 : 0)).join("")).join("|"); }

  function onChange(qid, value) {
    const before = visibilitySignature();
    answers[qid] = value; saveDraft();
    const node = form.querySelector(`.q[data-q="${CSS.escape(qid)}"]`);
    if (node) node.classList.remove("invalid");
    if (visibilitySignature() !== before) {
      const y = window.scrollY; render(); window.scrollTo(0, y);
    }
  }

  form.addEventListener("change", (e) => {
    const qEl = e.target.closest(".q"); if (!qEl) return;
    const qid = qEl.dataset.q, type = qEl.dataset.type;
    if (type === "multi") onChange(qid, [...qEl.querySelectorAll("input:checked")].map((i) => i.value));
    else if (type === "single") onChange(qid, e.target.value);
  });
  form.addEventListener("input", (e) => {
    const qEl = e.target.closest(".q"); if (!qEl) return;
    if (["text", "longtext"].includes(qEl.dataset.type)) onChange(qEl.dataset.q, e.target.value);
  });
  form.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const qEl = b.closest(".q");
    if (b.id === "prev") { step--; render(); $("#enquete").scrollIntoView(); return; }
    if (!qEl) return;
    const qid = qEl.dataset.q;
    if (b.dataset.star) {
      const n = +b.dataset.star; onChange(qid, n);
      qEl.querySelectorAll("[data-star]").forEach((s) => { s.classList.toggle("on", +s.dataset.star <= n); s.setAttribute("aria-checked", String(+s.dataset.star === n)); });
      qEl.querySelector(".caption").textContent = STAR_TXT[n];
    } else if (b.dataset.nps !== undefined) {
      const n = +b.dataset.nps; onChange(qid, n);
      qEl.querySelectorAll("[data-nps]").forEach((s) => { s.classList.toggle("on", +s.dataset.nps === n); s.setAttribute("aria-checked", String(+s.dataset.nps === n)); });
    } else if (b.dataset.item !== undefined) {
      const m = Object.assign({}, answers[qid] || {}); m[b.dataset.item] = +b.dataset.val; onChange(qid, m);
      const row = b.closest("tr"); row.classList.remove("missing");
      row.querySelectorAll(".mx").forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", String(on)); });
    }
  });

  function isAnswered(q) {
    const v = answers[q.id];
    if (q.type === "multi") return Array.isArray(v) && v.length > 0;
    if (q.type === "matrix") return (q.items || []).every((it) => v && v[it] !== undefined);
    if (q.type === "rating" || q.type === "nps") return typeof v === "number";
    return v !== undefined && String(v).trim() !== "";
  }

  function validate() {
    const sec = visibleSections()[step]; let first = null;
    sec.questions.filter((q) => S.isVisible(q, answers) && q.required).forEach((q) => {
      if (!isAnswered(q)) {
        const el = form.querySelector(`.q[data-q="${CSS.escape(q.id)}"]`); el.classList.add("invalid");
        if (q.type === "matrix") el.querySelectorAll("tr[data-row]").forEach((tr, i) => { const it = q.items[i]; if (!(answers[q.id] && answers[q.id][it] !== undefined)) tr.classList.add("missing"); });
        first = first || el;
      }
    });
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
    return !first;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const vs = visibleSections();
    if (step < vs.length - 1) { step++; render(); $("#enquete").scrollIntoView(); return; }
    // ne garder que les réponses aux questions visibles
    const clean = {};
    survey.sections.forEach((s) => s.questions.forEach((q) => { if (S.isVisible(q, answers) && answers[q.id] !== undefined) clean[q.id] = answers[q.id]; }));
    const btn = $("#next"); btn.disabled = true; btn.textContent = "Envoi en cours…";
    try {
      const r = await S.submit(clean, { surveyVersion: survey.version || 1, lang: navigator.language, ua: /Mobi/i.test(navigator.userAgent) ? "mobile" : "desktop" });
      localStorage.removeItem(DRAFT);
      form.classList.add("hidden"); $("#thanks").classList.remove("hidden");
      $("#ref").textContent = "Référence de votre réponse : " + r.id;
      $("#bar").style.width = "100%";
      document.querySelectorAll("#steps li").forEach((li) => (li.className = "done"));
      $("#enquete").scrollIntoView();
    } catch (err) {
      btn.disabled = false; btn.textContent = "Envoyer mes réponses";
      alert("L'envoi a échoué (" + err.message + "). Vérifiez votre connexion puis réessayez.");
    }
  });

  (async function init() {
    if (S.mode === "demo") $("#demo").classList.remove("hidden");
    const t = window.MLC_CONFIG && window.MLC_CONFIG.SURVEY_TITLE; if (t) $("#surveyTitle").textContent = t;
    survey = await S.getSurvey();
    render();
  })();
})();
