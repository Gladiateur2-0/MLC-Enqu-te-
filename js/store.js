/* =====================================================================
   COUCHE DE DONNÉES
   - Mode « remote » : Google Apps Script + Google Sheets (BACKEND_URL)
   - Mode « demo »   : stockage dans le navigateur (localStorage)
   ===================================================================== */
(function () {
  const CFG = window.MLC_CONFIG || {};
  const URL_ = (CFG.BACKEND_URL || "").trim();
  const mode = URL_ ? "remote" : "demo";
  const K = { survey: "mlc_survey_v1", resp: "mlc_responses_v1", pass: "mlc_admin_pass", auth: "mlc_admin_auth" };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  };

  async function sha256(txt) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function post(payload) {
    // Corps en text/plain : évite le « preflight » CORS avec Apps Script
    const r = await fetch(URL_, { method: "POST", body: JSON.stringify(payload) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "Erreur serveur");
    return j;
  }

  function uid() {
    return "R" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  /* Visibilité conditionnelle d'une question */
  function isVisible(q, answers) {
    const c = q.showIf;
    if (!c || !c.q) return true;
    const v = answers[c.q];
    if (c.equals !== undefined) return v === c.equals;
    if (c.includes !== undefined) return Array.isArray(v) && v.includes(c.includes);
    if (c.notIncludesOnly !== undefined) return Array.isArray(v) && v.length > 0 && !(v.length === 1 && v[0] === c.notIncludesOnly);
    return true;
  }

  const Store = {
    mode,
    isVisible,
    sha256,
    uid,

    async getSurvey() {
      if (mode === "remote") {
        try {
          const r = await fetch(URL_ + (URL_.includes("?") ? "&" : "?") + "action=survey");
          const j = await r.json();
          if (j.ok && j.survey && j.survey.sections) return j.survey;
        } catch (e) { console.warn("Questionnaire distant indisponible, version par défaut utilisée.", e); }
        return clone(window.MLC_DEFAULT_SURVEY);
      }
      return ls.get(K.survey, null) || clone(window.MLC_DEFAULT_SURVEY);
    },

    async submit(answers, meta) {
      const resp = { id: uid(), date: new Date().toISOString(), answers, meta: meta || {} };
      if (mode === "remote") { await post({ action: "submit", response: resp }); return resp; }
      const all = ls.get(K.resp, []); all.push(resp); ls.set(K.resp, all); return resp;
    },

    /* ---------- Administration ---------- */
    async login(user, pass) {
      if (mode === "remote") {
        await post({ action: "login", user, password: pass });
        ss.set(K.pass, pass); ss.set(K.auth, "1"); return true;
      }
      const okUser = user === CFG.ADMIN_USER;
      const okPass = (await sha256(pass)) === CFG.ADMIN_PASS_SHA256;
      if (!(okUser && okPass)) throw new Error("Identifiant ou mot de passe incorrect.");
      ss.set(K.auth, "1"); return true;
    },
    isLogged() { return ss.get(K.auth) === "1"; },
    logout() { ss.del(K.auth); ss.del(K.pass); },

    async getResponses() {
      if (mode === "remote") { const j = await post({ action: "responses", password: ss.get(K.pass) }); return j.responses || []; }
      return ls.get(K.resp, []);
    },
    async saveSurvey(survey) {
      survey.version = (survey.version || 1) + 1;
      survey.updatedAt = new Date().toISOString();
      if (mode === "remote") { await post({ action: "saveSurvey", password: ss.get(K.pass), survey }); return survey; }
      ls.set(K.survey, survey); return survey;
    },
    async resetSurvey() {
      const s = clone(window.MLC_DEFAULT_SURVEY);
      if (mode === "remote") { await post({ action: "saveSurvey", password: ss.get(K.pass), survey: s }); return s; }
      ls.del(K.survey); return s;
    },
    async deleteResponse(id) {
      if (mode === "remote") { await post({ action: "deleteResponse", password: ss.get(K.pass), id }); return; }
      ls.set(K.resp, ls.get(K.resp, []).filter((r) => r.id !== id));
    },
    async clearResponses() {
      if (mode === "remote") { await post({ action: "clearResponses", password: ss.get(K.pass) }); return; }
      ls.set(K.resp, []);
    },
    async importResponses(list) {
      if (mode === "remote") { await post({ action: "import", password: ss.get(K.pass), responses: list }); return; }
      const all = ls.get(K.resp, []); const ids = new Set(all.map((r) => r.id));
      list.forEach((r) => { if (!ids.has(r.id)) all.push(r); }); ls.set(K.resp, all);
    }
  };

  window.MLCStore = Store;
})();
