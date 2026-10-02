/**
 * =====================================================================
 *  BACKEND — Enquête de satisfaction Mercure Logistics Congo
 *  Google Apps Script + Google Sheets (gratuit)
 * =====================================================================
 *  Installation (détails dans le README) :
 *   1. Créez une Google Sheet vide, puis Extensions → Apps Script.
 *   2. Collez tout ce fichier dans Code.gs et enregistrez.
 *   3. Exécutez une fois la fonction « setup » (autorisez l'accès).
 *   4. Paramètres du projet → Propriétés du script : modifiez ADMIN_PASSWORD.
 *   5. Déployer → Nouveau déploiement → Type « Application Web »
 *        Exécuter en tant que : Moi
 *        Qui a accès : Tout le monde
 *   6. Copiez l'URL (…/exec) dans js/config.js → BACKEND_URL.
 * =====================================================================
 */

const SHEET_RESP = "Réponses";
const SHEET_CONF = "Config";
const ADMIN_USER = "admin";

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_RESP);
  if (!sh) sh = ss.insertSheet(SHEET_RESP);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["Référence", "Date", "Entreprise", "Secteur", "Satisfaction (1-5)", "NPS (0-10)", "Réponses (JSON)"]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#141414").setFontColor("#ffffff");
  }
  if (!ss.getSheetByName(SHEET_CONF)) ss.insertSheet(SHEET_CONF);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("ADMIN_PASSWORD")) props.setProperty("ADMIN_PASSWORD", "MLC@2026!");
  Logger.log("Installation terminée. Pensez à changer ADMIN_PASSWORD dans les propriétés du script.");
}

/* ------------------------------ utilitaires ------------------------------ */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error("Feuille « " + name + " » introuvable : exécutez setup().");
  return sh;
}
function checkAdmin_(password) {
  const expected = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD") || "";
  const a = String(password || ""), b = expected;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  if (diff !== 0 || !b) { Utilities.sleep(1200); throw new Error("Identifiant ou mot de passe incorrect."); }
}
function readSurvey_() {
  const v = sheet_(SHEET_CONF).getRange("A1").getValue();
  return v ? JSON.parse(v) : null;
}
function rowFor_(r) {
  const a = r.answers || {};
  return [r.id, r.date, a.entreprise || "", a.secteur || "", a.csat !== undefined ? a.csat : "", a.nps !== undefined ? a.nps : "", JSON.stringify(r)];
}
function sanitize_(r) {
  if (!r || typeof r !== "object" || typeof r.answers !== "object") throw new Error("Réponse invalide");
  const s = JSON.stringify(r);
  if (s.length > 40000) throw new Error("Réponse trop volumineuse");
  return {
    id: String(r.id || ("R" + Date.now())).slice(0, 40),
    date: new Date().toISOString(),       // horodatage serveur
    answers: r.answers,
    meta: r.meta || {}
  };
}

/* ------------------------------ GET ------------------------------ */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "";
    if (action === "survey") return json_({ ok: true, survey: readSurvey_() });
    return json_({ ok: true, service: "MLC enquête", status: "en ligne" });
  } catch (err) { return json_({ ok: false, error: err.message }); }
}

/* ------------------------------ POST ------------------------------ */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const action = body.action;

    if (action === "submit") {
      const r = sanitize_(body.response);
      lock.waitLock(20000);
      sheet_(SHEET_RESP).appendRow(rowFor_(r));
      return json_({ ok: true, id: r.id });
    }

    if (action === "login") {
      if (body.user !== ADMIN_USER) { Utilities.sleep(1200); throw new Error("Identifiant ou mot de passe incorrect."); }
      checkAdmin_(body.password);
      return json_({ ok: true });
    }

    // ---- actions réservées à l'administrateur ----
    checkAdmin_(body.password);
    const sh = sheet_(SHEET_RESP);

    if (action === "responses") {
      const last = sh.getLastRow();
      if (last < 2) return json_({ ok: true, responses: [] });
      const vals = sh.getRange(2, 7, last - 1, 1).getValues();
      const list = vals.map(function (v) { try { return JSON.parse(v[0]); } catch (x) { return null; } }).filter(Boolean);
      return json_({ ok: true, responses: list });
    }

    lock.waitLock(20000);

    if (action === "saveSurvey") {
      if (!body.survey || !body.survey.sections) throw new Error("Questionnaire invalide");
      sheet_(SHEET_CONF).getRange("A1").setValue(JSON.stringify(body.survey));
      return json_({ ok: true });
    }
    if (action === "deleteResponse") {
      const last = sh.getLastRow();
      if (last >= 2) {
        const ids = sh.getRange(2, 1, last - 1, 1).getValues();
        for (let i = ids.length - 1; i >= 0; i--) if (ids[i][0] === body.id) sh.deleteRow(i + 2);
      }
      return json_({ ok: true });
    }
    if (action === "clearResponses") {
      const last = sh.getLastRow();
      if (last >= 2) sh.deleteRows(2, last - 1);
      return json_({ ok: true });
    }
    if (action === "import") {
      const list = (body.responses || []).filter(function (r) { return r && r.answers; });
      if (list.length) {
        const rows = list.map(function (r) { return rowFor_({ id: String(r.id).slice(0, 40), date: r.date, answers: r.answers, meta: r.meta || {} }); });
        sh.getRange(sh.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
      }
      return json_({ ok: true, count: list.length });
    }
    throw new Error("Action inconnue");
  } catch (err) {
    return json_({ ok: false, error: err.message });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}
