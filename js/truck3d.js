/* =====================================================================
   ANIMATION 3D — Camion SHACMAN orange chargé par un portique (RTG)
   Three.js r169 (chargé via importmap dans index.html)
   Séquence : le camion arrive → le portique saisit un conteneur 40'
   sur la pile → le dépose sur la remorque → le camion prend la route.
   ===================================================================== */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const ORANGE = 0xf28c1c;
const CONT_H = 2.59, CONT_L = 12.19, CONT_W = 2.44;
const DECK_Y = 1.48;              // hauteur du plateau de la remorque
const TRUCK_STOP_X = 7.6;         // le conteneur de la remorque est alors centré en x = 0
const ROW_Z = -4.6;               // rangée où se trouve le conteneur à charger
const HOIST_TOP = 12.5;           // position haute du palonnier
const CYCLE = 34;                 // durée d'une boucle (s)

/* ----------------------------- utilitaires ----------------------------- */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = THREE.MathUtils.lerp;

function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function noise(ctx, w, h, amount, alpha) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amount; d[i] += n; d[i + 1] += n; d[i + 2] += n; d[i + 3] = alpha ?? d[i + 3]; }
  ctx.putImageData(img, 0, 0);
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function box(w, h, d, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
function cyl(rt, rb, h, mat, seg = 24) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.castShadow = true; m.receiveShadow = true; return m; }

/* ----------------------------- textures ----------------------------- */
function containerTextures(color, code, brand) {
  const [c, x] = canvas(1024, 256);
  x.fillStyle = color; x.fillRect(0, 0, 1024, 256);
  // ondulations de la tôle
  for (let i = 0; i < 1024; i += 18) {
    const g = x.createLinearGradient(i, 0, i + 18, 0);
    g.addColorStop(0, "rgba(0,0,0,.22)"); g.addColorStop(.35, "rgba(255,255,255,.10)"); g.addColorStop(.7, "rgba(0,0,0,.05)"); g.addColorStop(1, "rgba(0,0,0,.22)");
    x.fillStyle = g; x.fillRect(i, 0, 18, 256);
  }
  x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(0, 0, 1024, 10); x.fillRect(0, 246, 1024, 10);
  // rouille et salissures
  for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(${90 + Math.random() * 50},${45 + Math.random() * 20},20,${Math.random() * .18})`; x.fillRect(Math.random() * 1024, 200 + Math.random() * 50, 4 + Math.random() * 30, 2 + Math.random() * 10); }
  noise(x, 1024, 256, 18);
  x.fillStyle = "rgba(255,255,255,.92)"; x.font = "bold 22px Arial"; x.fillText(code, 860, 40);
  if (brand) { x.font = "bold 64px Arial"; x.globalAlpha = .9; x.fillText(brand, 70, 150); x.globalAlpha = 1; }
  const map = tex(c);

  const [bc, bx] = canvas(256, 64);
  for (let i = 0; i < 256; i += 4.5) { const g = bx.createLinearGradient(i, 0, i + 4.5, 0); g.addColorStop(0, "#000"); g.addColorStop(.5, "#fff"); g.addColorStop(1, "#000"); bx.fillStyle = g; bx.fillRect(i, 0, 4.5, 64); }
  const bump = tex(bc, false);

  const [dc, dx] = canvas(256, 256);
  dx.fillStyle = color; dx.fillRect(0, 0, 256, 256);
  dx.fillStyle = "rgba(0,0,0,.35)"; dx.fillRect(126, 0, 4, 256);
  [40, 92, 164, 216].forEach((px) => { dx.fillStyle = "#2b2b2b"; dx.fillRect(px, 10, 6, 236); dx.fillStyle = "rgba(255,255,255,.25)"; dx.fillRect(px + 6, 10, 1, 236); });
  dx.strokeStyle = "rgba(0,0,0,.4)"; dx.lineWidth = 8; dx.strokeRect(4, 4, 248, 248);
  noise(dx, 256, 256, 16);
  dx.fillStyle = "#fff"; dx.font = "bold 14px Arial"; dx.fillText(code, 140, 30);
  const door = tex(dc);
  return { map, bump, door };
}

function makeContainer(color, code, brand) {
  const t = containerTextures(color, code, brand);
  const side = new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 1.4, roughness: .62, metalness: .35 });
  t.bump.wrapS = THREE.RepeatWrapping; t.bump.repeat.set(4, 1);
  const end = new THREE.MeshStandardMaterial({ map: t.door, roughness: .6, metalness: .35 });
  const top = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(.8), roughness: .7, metalness: .3 });
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(CONT_L, CONT_H, CONT_W), [end, end, top, top, side, side]);
  m.position.y = CONT_H / 2; m.castShadow = m.receiveShadow = true; g.add(m);
  const cornerMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: .5, metalness: .6 });
  for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1])
    box(.18, .12, .18, cornerMat, sx * (CONT_L / 2 - .09), sy ? CONT_H - .06 : .06, sz * (CONT_W / 2 - .09), g);
  return g;
}

function cabFrontTexture(logoImg) {
  const W = 512, H = 482; const [c, x] = canvas(W, H);
  const draw = () => {
    // carrosserie
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#f7a032"); g.addColorStop(1, "#d9740f");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // pare-brise
    const ws = x.createLinearGradient(0, 18, 0, 205); ws.addColorStop(0, "#24313a"); ws.addColorStop(.6, "#3c4c56"); ws.addColorStop(1, "#1a2228");
    x.fillStyle = "#151515"; roundRect(x, 14, 14, W - 28, 200, 16); x.fill();
    x.fillStyle = ws; roundRect(x, 22, 20, W - 44, 186, 12); x.fill();
    x.fillStyle = "rgba(255,255,255,.10)"; x.beginPath(); x.moveTo(60, 20); x.lineTo(170, 20); x.lineTo(90, 206); x.lineTo(20, 206); x.fill();
    // essuie-glaces
    x.strokeStyle = "#111"; x.lineWidth = 5; x.beginPath(); x.moveTo(110, 200); x.lineTo(240, 160); x.moveTo(300, 200); x.lineTo(430, 160); x.stroke();
    // autocollant MLC
    x.fillStyle = "#fff"; x.fillRect(22, 232, 168, 62);
    if (logoImg && logoImg.complete && logoImg.naturalWidth) x.drawImage(logoImg, 28, 236, 78, 52);
    else { x.fillStyle = "#141414"; x.font = "bold 30px Arial Black, Arial"; x.fillText("MLC", 30, 276); }
    x.fillStyle = "#e3262b"; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(112 + i * 12, 258); x.lineTo(120 + i * 12, 258); x.lineTo(116 + i * 12, 266); x.lineTo(108 + i * 12, 266); x.fill(); }
    x.fillStyle = "#111"; x.font = "bold 11px Arial"; x.fillText("MERCURE", 112, 250); x.fillText("LOGISTICS", 112, 280); x.fillText("CONGO", 150, 266);
    x.fillStyle = "#e3262b"; x.fillRect(112, 286, 72, 3);
    // n° de parc
    x.fillStyle = "#fff"; x.fillRect(372, 232, 104, 56); x.fillStyle = "#111"; x.font = "bold 30px Arial"; x.fillText("SH007", 378, 272);
    // emblème
    const eg = x.createRadialGradient(256, 262, 4, 256, 262, 34); eg.addColorStop(0, "#f2f2f2"); eg.addColorStop(1, "#7d7d7d");
    x.fillStyle = eg; x.beginPath(); x.ellipse(256, 262, 28, 34, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "#555"; x.lineWidth = 6; x.beginPath(); x.moveTo(266, 244); x.lineTo(248, 258); x.lineTo(266, 268); x.lineTo(246, 282); x.stroke();
    // calandre
    [[312, 46], [372, 46], [428, 36]].forEach(([y, h], i) => {
      x.fillStyle = "#1c1c1c"; roundRect(x, 60 - i * 6, y, W - 120 + i * 12, h, 8); x.fill();
      x.fillStyle = "#2f2f2f"; for (let k = 70; k < W - 70; k += 9) x.fillRect(k, y + 8, 5, h - 16);
    });
    const cg = x.createLinearGradient(0, 360, 0, 390); cg.addColorStop(0, "#ffffff"); cg.addColorStop(.5, "#9aa0a6"); cg.addColorStop(1, "#e6e6e6");
    x.fillStyle = cg; x.font = "bold 40px Arial Black, Arial"; x.textAlign = "center"; x.fillText("SHACMAN", 256, 392); x.textAlign = "left";
    x.fillStyle = "#ddd"; x.font = "italic bold 18px Arial"; x.fillText("F3000", 420, 300);
    noise(x, W, H, 8);
  };
  draw();
  const t = tex(c);
  if (logoImg) logoImg.addEventListener("load", () => { draw(); t.needsUpdate = true; });
  return t;
}

function cabSideTexture(logoImg, flip) {
  const W = 512, H = 470; const [c, x] = canvas(W, H);
  const draw = () => {
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#f7a032"); g.addColorStop(1, "#d6700c");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // fenêtres
    x.fillStyle = "#1d262c"; roundRect(x, 150, 24, 300, 150, 14); x.fill();
    x.fillStyle = "rgba(255,255,255,.12)"; x.fillRect(170, 30, 60, 138);
    x.fillStyle = "#1d262c"; roundRect(x, 30, 24, 100, 110, 10); x.fill();
    // porte
    x.strokeStyle = "rgba(0,0,0,.45)"; x.lineWidth = 3; roundRect(x, 140, 14, 330, 430, 12); x.stroke();
    x.fillStyle = "#222"; x.fillRect(420, 230, 34, 10);
    // marchepieds
    x.fillStyle = "#2a2a2a"; x.fillRect(250, 400, 120, 14); x.fillRect(250, 440, 120, 14);
    // logo
    x.fillStyle = "#fff"; roundRect(x, 160, 210, 230, 150, 10); x.fill();
    if (logoImg && logoImg.complete && logoImg.naturalWidth) x.drawImage(logoImg, 170, 218, 210, 140);
    else { x.fillStyle = "#141414"; x.font = "bold 92px Arial Black, Arial"; x.fillText("MLC", 182, 310); x.fillStyle = "#e3262b"; x.fillRect(182, 324, 186, 10); x.fillStyle = "#141414"; x.font = "bold 15px Arial"; x.fillText("MERCURE LOGISTICS CONGO", 176, 352); }
    noise(x, W, H, 8);
  };
  draw();
  const t = tex(c);
  if (flip) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; }
  if (logoImg) logoImg.addEventListener("load", () => { draw(); t.needsUpdate = true; });
  return t;
}

function groundTexture() {
  const [c, x] = canvas(1024, 1024);
  x.fillStyle = "#b8a789"; x.fillRect(0, 0, 1024, 1024);   // terre battue / latérite claire
  noise(x, 1024, 1024, 40);
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${120 + Math.random() * 60},${100 + Math.random() * 40},${70 + Math.random() * 30},.25)`; x.beginPath(); x.ellipse(Math.random() * 1024, Math.random() * 1024, Math.random() * 40, Math.random() * 14, Math.random() * 3, 0, 7); x.fill(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 40); return t;
}
function roadTexture() {
  const [c, x] = canvas(512, 128);
  x.fillStyle = "#4a4845"; x.fillRect(0, 0, 512, 128); noise(x, 512, 128, 30);
  x.fillStyle = "#e9e6dc"; for (let i = 0; i < 512; i += 128) x.fillRect(i + 20, 61, 70, 6);
  x.fillStyle = "#d8cfae"; x.fillRect(0, 4, 512, 4); x.fillRect(0, 120, 512, 4);
  const t = tex(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(40, 1); return t;
}

/* ----------------------------- camion ----------------------------- */
function makeWheel(dual, tireMat, rimMat, hubMat) {
  const w = new THREE.Group();
  const width = dual ? .62 : .34;
  const tire = cyl(.53, .53, width, tireMat, 32); tire.rotation.x = Math.PI / 2; w.add(tire);
  const side = new THREE.Mesh(new THREE.TorusGeometry(.42, .1, 10, 28), tireMat); side.position.z = width / 2; side.castShadow = true; w.add(side);
  const side2 = side.clone(); side2.position.z = -width / 2; w.add(side2);
  const rim = cyl(.31, .31, width + .02, rimMat, 24); rim.rotation.x = Math.PI / 2; w.add(rim);
  const hub = cyl(.12, .14, width + .12, hubMat, 12); hub.rotation.x = Math.PI / 2; w.add(hub);
  for (let i = 0; i < 8; i++) { const n = box(.04, .04, .04, hubMat); const a = i / 8 * Math.PI * 2; n.position.set(Math.cos(a) * .2, Math.sin(a) * .2, width / 2 + .02); w.add(n); }
  return w;
}

function makeTruck(logoImg) {
  const truck = new THREE.Group();
  const wheels = [];
  const orange = new THREE.MeshPhysicalMaterial({ color: ORANGE, roughness: .32, metalness: .15, clearcoat: .8, clearcoatRoughness: .2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: .7, metalness: .3 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a8f94, roughness: .35, metalness: .85 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: .12, metalness: 1 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: .92 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: .3, metalness: .8 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x5a5d60, roughness: .4, metalness: .8 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0f1a20, roughness: .04, metalness: .1, transparent: true, opacity: .35, clearcoat: 1 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d0, emissiveIntensity: 1.4, roughness: .1 });
  const red = new THREE.MeshStandardMaterial({ color: 0xaa0000, emissive: 0xff2200, emissiveIntensity: .8 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff8800, emissiveIntensity: 1.2, transparent: true, opacity: .9 });

  /* --- tracteur --- */
  // longerons
  box(6.6, .26, .16, dark, -.7, 1.0, .45, truck); box(6.6, .26, .16, dark, -.7, 1.0, -.45, truck);
  // cabine
  const CAB_X0 = .55, CAB_X1 = 2.85, CAB_Y0 = 1.15, CAB_Y1 = 3.5, CAB_W = 2.5;
  const frontT = cabFrontTexture(logoImg);
  const sideL = cabSideTexture(logoImg, false), sideR = cabSideTexture(logoImg, true);
  const cabMats = [
    new THREE.MeshPhysicalMaterial({ map: frontT, roughness: .35, clearcoat: .7, metalness: .1 }), // +x avant
    orange, orange, dark,
    new THREE.MeshPhysicalMaterial({ map: sideL, roughness: .35, clearcoat: .7, metalness: .1 }), // +z
    new THREE.MeshPhysicalMaterial({ map: sideR, roughness: .35, clearcoat: .7, metalness: .1 })  // -z
  ];
  const cab = new THREE.Mesh(new THREE.BoxGeometry(CAB_X1 - CAB_X0, CAB_Y1 - CAB_Y0, CAB_W), cabMats);
  cab.position.set((CAB_X0 + CAB_X1) / 2, (CAB_Y0 + CAB_Y1) / 2, 0); cab.castShadow = cab.receiveShadow = true; truck.add(cab);
  // vitre brillante sur le pare-brise
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(2.3, .98), glass); ws.rotation.y = Math.PI / 2; ws.position.set(CAB_X1 + .012, 3.0, 0); truck.add(ws);
  // pare-soleil / déflecteur de toit
  const visor = box(.5, .16, 2.6, dark, CAB_X1 - .05, CAB_Y1 + .02, 0, truck); visor.rotation.z = -.25;
  const roof = box(1.9, .55, 2.3, orange, 1.6, CAB_Y1 + .27, 0, truck); roof.scale.set(1, 1, 1);
  box(.8, .45, 2.2, dark, .95, CAB_Y1 + .78, 0, truck);
  // gyrophare
  const beacon = cyl(.1, .12, .2, amber, 16); beacon.position.set(2.2, CAB_Y1 + .65, 0); truck.add(beacon);
  // pare-chocs + phares
  box(.3, .5, 2.55, dark, CAB_X1 + .1, .85, 0, truck);
  for (const z of [-1, 1]) {
    box(.06, .2, .32, lamp, CAB_X1 + .26, .95, z * .95, truck);
    box(.06, .1, .12, amber, CAB_X1 + .26, .78, z * 1.12, truck);
    // grille de protection
    for (let k = 0; k < 4; k++) box(.02, .26, .02, dark, CAB_X1 + .3, .95, z * .95 - .12 + k * .08, truck);
  }
  // rétroviseurs
  for (const z of [-1, 1]) {
    box(.06, .06, .5, dark, CAB_X1 - .1, 3.1, z * 1.45, truck);
    box(.12, .55, .22, dark, CAB_X1 - .1, 2.85, z * 1.68, truck);
    box(.02, .45, .17, chrome, CAB_X1 - .03, 2.85, z * 1.68, truck);
  }
  // réservoirs, batterie, échappement
  const tank = cyl(.32, .32, 1.2, steel, 24); tank.rotation.z = Math.PI / 2; tank.position.set(-.2, .95, 1.0); truck.add(tank);
  box(.7, .55, .45, dark, -.3, .95, -1.0, truck);
  const pipe = cyl(.08, .08, 1.8, chrome, 12); pipe.position.set(.4, 3.3, -1.0); truck.add(pipe);
  // garde-boue
  for (const z of [-1, 1]) {
    const mg = new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, .4, 20, 1, true, 0, Math.PI), dark);
    mg.rotation.x = Math.PI / 2; mg.rotation.z = Math.PI / 2; mg.position.set(1.9, .55, z * 1.08); truck.add(mg);
    box(2.0, .06, .7, dark, -2.85, 1.25, z * .9, truck);
  }
  // sellette
  const fifth = cyl(.55, .55, .12, dark, 24); fifth.position.set(-2.4, 1.2, 0); truck.add(fifth);
  // roues tracteur
  [[1.9, false], [-2.2, true], [-3.5, true]].forEach(([wx, dual]) => {
    for (const z of [-1, 1]) {
      const w = makeWheel(dual, tireMat, rimMat, hubMat); w.position.set(wx, .53, z * (dual ? .95 : 1.05));
      if (z < 0) w.rotation.y = Math.PI; truck.add(w); wheels.push(w);
    }
  });

  /* --- semi-remorque porte-conteneur --- */
  const tr = new THREE.Group(); truck.add(tr);
  const T0 = -1.3, T1 = -14.1; const TL = T0 - T1, TC = (T0 + T1) / 2;
  box(TL, .3, .2, dark, TC, 1.3, .5, tr); box(TL, .3, .2, dark, TC, 1.3, -.5, tr);
  for (let i = 0; i <= 8; i++) box(.16, .14, 2.45, dark, T0 - .2 - i * (TL - .4) / 8, DECK_Y - .07, 0, tr);
  box(.25, .25, 2.45, steel, T0 - .1, DECK_Y - .1, 0, tr);
  // béquilles
  for (const z of [-1, 1]) { box(.14, .8, .14, steel, -4.0, .75, z * .9, tr); box(.4, .06, .4, dark, -4.0, .33, z * .9, tr); }
  // essieux remorque
  [-10.7, -12.0, -13.3].forEach((wx) => {
    for (const z of [-1, 1]) { const w = makeWheel(true, tireMat, rimMat, hubMat); w.position.set(wx, .53, z * .95); if (z < 0) w.rotation.y = Math.PI; tr.add(w); wheels.push(w); }
  });
  for (const z of [-1, 1]) box(4.2, .06, .7, dark, -12.0, 1.17, z * .9, tr);
  // feux arrière + pare-cycliste
  box(.08, .25, 2.5, dark, T1 + .02, .9, 0, tr);
  for (const z of [-1, 1]) box(.05, .1, .35, red, T1 - .02, .95, z * 1.0, tr);
  for (let i = 0; i < 6; i++) box(.02, .2, .12, i % 2 ? red : new THREE.MeshStandardMaterial({ color: 0xffffff }), T1 - .03, .72, -.75 + i * .3, tr);

  return { truck, wheels, beacon };
}

/* ----------------------------- portique RTG ----------------------------- */
function makeCrane() {
  const crane = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf2c312, roughness: .45, metalness: .45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: .6, metalness: .5 });
  const white = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: .5, metalness: .3 });
  const redM = new THREE.MeshStandardMaterial({ color: 0xc8241f, roughness: .5, metalness: .3 });
  const H = 15.5, XL = 12.6, Z0 = 5.4, Z1 = -12.2;
  // jambes
  for (const x of [-XL, XL]) for (const z of [Z0, Z1]) {
    box(.9, H, .9, yellow, x, H / 2, z, crane);
    box(1.6, .9, 1.6, dark, x, .45, z, crane); // bogie
    for (const dz of [-.5, .5]) { const w = cyl(.42, .42, .5, dark, 16); w.rotation.x = Math.PI / 2; w.rotation.y = Math.PI / 2; w.position.set(x, .42, z + dz); crane.add(w); }
  }
  // sablières basses et poutres hautes (le long de Z)
  for (const x of [-XL, XL]) {
    box(.7, .7, Z0 - Z1, yellow, x, 1.3, (Z0 + Z1) / 2, crane);
    box(1.2, 1.4, Z0 - Z1 + 1.4, yellow, x, H + .7, (Z0 + Z1) / 2, crane);
    // croisillons
    for (const z of [Z0, Z1]) { const d = box(.25, 12, .25, yellow, x, 7.5, z, crane); }
  }
  // traverses (le long de X)
  for (const z of [Z0, Z1]) {
    box(2 * XL + .9, 1.6, 1.0, yellow, 0, H + .8, z, crane);
    const br = box(2 * XL, .3, .3, yellow, 0, H - 3.2, z, crane);
    for (const s of [-1, 1]) { const d = box(.3, 7.2, .3, yellow, s * XL * .5, H - 1.6, z, crane); d.rotation.z = s * 1.0; }
  }
  // bande de signalisation
  for (const x of [-XL, XL]) for (const z of [Z0, Z1]) for (let i = 0; i < 4; i++) box(.92, .4, .92, i % 2 ? white : redM, x, 2.2 + i * .4, z, crane);
  // salle des machines + cabine
  box(3.2, 2.2, 3.2, white, -XL, H + 2.5, Z1 + 2.2, crane);
  box(2.4, 1.8, 2.4, white, XL, H + 2.3, Z1 + 2.2, crane);

  // chariot (se déplace en Z)
  const trolley = new THREE.Group(); trolley.position.y = H + 1.6; crane.add(trolley);
  box(2 * XL + 1.2, .9, 3.2, yellow, 0, .45, 0, trolley);
  box(3, 1.6, 2.6, white, -3, 1.3, 0, trolley);
  const cabG = box(1.8, 1.8, 1.8, new THREE.MeshPhysicalMaterial({ color: 0x9fb3bd, roughness: .1, metalness: .2, transmission: 0, opacity: .9 }), 4.5, -1.2, 1.4, trolley);
  box(1.9, .2, 1.9, yellow, 4.5, -.25, 1.4, trolley);

  // palonnier (spreader)
  const spreader = new THREE.Group(); crane.add(spreader);
  box(CONT_L, .45, .5, yellow, 0, .25, 0, spreader);
  box(.5, .45, CONT_W, yellow, 0, .25, 0, spreader);
  for (const s of [-1, 1]) box(.5, .45, CONT_W, yellow, s * (CONT_L / 2 - .3), .25, 0, spreader);
  box(3.2, .7, 1.2, dark, 0, .75, 0, spreader);
  for (const s of [-1, 1]) for (const z of [-1, 1]) box(.2, .2, .2, dark, s * (CONT_L / 2 - .15), .02, z * (CONT_W / 2 - .15), spreader);

  // câbles
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .4, metalness: .7 });
  const cables = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const c = cyl(.035, .035, 1, cableMat, 6); c.castShadow = false; crane.add(c); cables.push({ m: c, sx: sx * 1.4, sz: sz * .5 });
  }
  return { crane, trolley, spreader, cables, H };
}

/* ----------------------------- décor ----------------------------- */
const PALETTE = ["#8b2a22", "#1f4e79", "#2c6b3f", "#6b6e70", "#9c5a1a", "#7a1f2b", "#244a5c", "#b5813a", "#41505a", "#5a2a6b"];
function makeYard(scene) {
  const yard = new THREE.Group(); scene.add(yard);
  const codes = () => ["MLCU", "TGHU", "SEGU", "TCLU", "CAIU"][Math.floor(Math.random() * 5)] + " " + Math.floor(100000 + Math.random() * 899999);
  const add = (x, z, level, color, rotY = 0) => { const c = makeContainer(color, codes()); c.position.set(x, level * CONT_H, z); c.rotation.y = rotY; yard.add(c); return c; };
  // rangées sous le portique
  add(0, ROW_Z, 0, PALETTE[1]);
  add(0, -8.2, 0, PALETTE[0]); add(0, -8.2, 1, PALETTE[3]); add(0, -8.2, 2, PALETTE[2]);
  // piles alentour
  const rows = [[-26, -6], [-26, -9], [24, -6], [24, -9], [24, -12], [-26, -12], [-40, -7], [38, -7], [-12, -22], [12, -22], [0, -26], [-24, -24], [26, -24]];
  rows.forEach(([x, z]) => { const n = 1 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) add(x, z, i, PALETTE[Math.floor(Math.random() * PALETTE.length)]); });
  // conteneurs de l'autre côté de la route
  [[-34, 17], [-20, 18], [-48, 16]].forEach(([x, z]) => { const n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) add(x, z, i, PALETTE[Math.floor(Math.random() * PALETTE.length)], .02); });

  // lampadaires
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x9a9da0, roughness: .4, metalness: .8 });
  [-50, -20, 60].forEach((x) => { const p = cyl(.15, .22, 18, poleMat, 10); p.position.set(x, 9, 9); yard.add(p); box(2.4, .3, 1, poleMat, x, 18, 9, yard); });

  // portiques de quai (STS) au loin
  const stsMat = new THREE.MeshStandardMaterial({ color: 0xc23a2a, roughness: .6, metalness: .4 });
  [-60, -20, 25].forEach((x) => {
    const g = new THREE.Group(); g.position.set(x, 0, -70); yard.add(g);
    for (const dx of [-6, 6]) for (const dz of [-6, 6]) box(1, 32, 1, stsMat, dx, 16, dz, g);
    box(14, 2, 70, stsMat, 0, 33, 10, g); box(13, 6, 3, new THREE.MeshStandardMaterial({ color: 0xdddddd }), 0, 37, -6, g);
    const a = box(.6, 22, .6, stsMat, 0, 44, -6, g); a.rotation.x = .3;
  });

  // végétation simple (palmiers stylisés)
  const trunk = new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: .9 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x3f6b2a, roughness: .8, side: THREE.DoubleSide });
  [[-70, 22], [-55, 28], [60, 24], [75, 30], [-85, 15], [90, 18]].forEach(([x, z]) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); yard.add(g);
    const t = cyl(.25, .4, 9, trunk, 8); t.position.y = 4.5; t.rotation.z = .08; g.add(t);
    for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(.6, 4.5, 4, 1, true), leaf); l.position.set(0, 9, 0); l.rotation.set(Math.PI / 2 - .5, i / 7 * Math.PI * 2, 0); l.translateY(2); l.castShadow = true; g.add(l); }
  });
  return yard;
}

/* ============================== SCÈNE ============================== */
export function initTruckScene(host, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const SKY = new THREE.Color(0xdfe3e6);
  scene.background = SKY; scene.fog = new THREE.Fog(SKY, 70, 210);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;

  // ciel en dégradé
  const skyGeo = new THREE.SphereGeometry(400, 32, 16);
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x9fb4c6) }, bottom: { value: new THREE.Color(0xe9ebec) } },
    vertexShader: "varying vec3 vP; void main(){ vP = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vP,1.); }",
    fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*2.2,0.,1.); gl_FragColor = vec4(mix(bottom, top, h),1.); }" });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // lumières
  scene.add(new THREE.HemisphereLight(0xe8eef5, 0x8a7a60, .9));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(30, 45, 25); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 35, bottom: -35, near: 1, far: 140 });
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
  scene.add(sun); scene.add(sun.target);

  // sol + route
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: .95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(600, 7), new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: .85 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, .02, 0); road.receiveShadow = true; scene.add(road);

  // éléments
  let logoImg = null;
  // En ouvrant le fichier en local (file://), une image ne peut pas être envoyée à WebGL :
  // on remplace alors le logo par un marquage dessiné.
  if (opts.logoUrl && location.protocol !== "file:") { logoImg = new Image(); logoImg.src = opts.logoUrl; }
  makeYard(scene);
  const { crane, trolley, spreader, cables, H } = makeCrane(); scene.add(crane);
  const { truck, wheels, beacon } = makeTruck(logoImg); scene.add(truck);
  const load = makeContainer("#1f4e79", "MLCU 400712 7", "MLC"); scene.add(load);

  const camera = new THREE.PerspectiveCamera(38, 1, .5, 900);
  const mouse = { x: 0, y: 0 };
  host.addEventListener("pointermove", (e) => { const r = host.getBoundingClientRect(); mouse.x = (e.clientX - r.left) / r.width - .5; mouse.y = (e.clientY - r.top) / r.height - .5; });

  function resize() {
    const w = host.clientWidth, h = host.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w < 700 ? 58 : 36;
    // décale l'action vers la droite sur grand écran (le texte occupe la gauche)
    if (w > 900) camera.setViewOffset(w, h, -w * .17, -h * .04, w, h);
    else camera.setViewOffset(w, h, 0, h * .2, w, h);       // mobile : action remontée au-dessus du texte
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host); resize();

  /* --------- état de l'animation à l'instant t --------- */
  let prevTruckX = -70;
  const lookAt = new THREE.Vector3();
  function pose(t) {
    // camion
    let tx;
    if (t < 7) tx = lerp(-70, TRUCK_STOP_X, easeOut(seg(t, 0, 7)));
    else if (t < 23.5) tx = TRUCK_STOP_X;
    else tx = lerp(TRUCK_STOP_X, 110, easeIn(seg(t, 23.5, 33)));
    truck.position.x = tx;
    const dx = tx - prevTruckX; prevTruckX = tx;
    if (Math.abs(dx) < 5) wheels.forEach((w) => { w.children[0].parent.rotation.z -= dx / .53 * (w.rotation.y ? -1 : 1); });

    // chariot & palonnier
    let tz = 0, sy = HOIST_TOP;
    if (t < 6) { tz = 0; sy = HOIST_TOP; }
    else if (t < 8.5) tz = lerp(0, ROW_Z, ease(seg(t, 6, 8.5)));
    else tz = ROW_Z;
    if (t >= 8.5 && t < 11) sy = lerp(HOIST_TOP, CONT_H + .02, ease(seg(t, 8.5, 11)));
    else if (t >= 11 && t < 11.8) sy = CONT_H + .02;
    else if (t >= 11.8 && t < 14.5) sy = lerp(CONT_H + .02, HOIST_TOP, ease(seg(t, 11.8, 14.5)));
    if (t >= 14.5) { tz = lerp(ROW_Z, 0, ease(seg(t, 14.5, 17.5))); sy = HOIST_TOP; }
    if (t >= 17.5 && t < 20.5) sy = lerp(HOIST_TOP, DECK_Y + CONT_H + .02, ease(seg(t, 17.5, 20.5)));
    else if (t >= 20.5 && t < 21.2) sy = DECK_Y + CONT_H + .02;
    else if (t >= 21.2) sy = lerp(DECK_Y + CONT_H + .02, HOIST_TOP, ease(seg(t, 21.2, 24)));
    trolley.position.z = tz;
    spreader.position.set(0, sy, tz);
    // câbles
    const topY = trolley.position.y;
    cables.forEach((c) => { const len = topY - (sy + .9); c.m.scale.y = Math.max(.01, len); c.m.position.set(c.sx, sy + .9 + len / 2, tz + c.sz); });

    // conteneur : sur la pile → au palonnier → sur la remorque
    if (t < 11) load.position.set(0, 0, ROW_Z);
    else if (t < 20.8) load.position.set(0, sy - CONT_H - .02, tz);
    else load.position.set(tx - TRUCK_STOP_X, DECK_Y, 0);
    load.visible = true;

    // gyrophare
    beacon.material.emissiveIntensity = (Math.sin(t * 9) > 0) ? 2.2 : .3;

    // caméra cinématique
    // vue de trois-quarts avant : la face orange du SHACMAN est visible
    const a = 0.88 + Math.sin(t / CYCLE * Math.PI * 2) * .22 + mouse.x * .2;
    const radius = 37 - Math.sin(t / CYCLE * Math.PI) * 5;
    const follow = t > 23 ? Math.min(tx - TRUCK_STOP_X, 34) * .6 : (t < 7 ? Math.max(tx - TRUCK_STOP_X, -30) * .3 : 0);
    lookAt.set(2 + follow, 4.2 - mouse.y * 1.5, -2);
    camera.position.set(lookAt.x + Math.sin(a) * radius, 10.5 + Math.sin(t * .25) * 1.5 - mouse.y * 3, lookAt.z + Math.cos(a) * radius);
    camera.lookAt(lookAt);
  }

  /* --------- boucle --------- */
  const fixedT = parseFloat(new URLSearchParams(location.search).get("t3d"));   // débogage : ?t3d=12
  let running = true, visible = true, start = performance.now(), paused = 0, pauseAt = 0;
  const fade = opts.fadeEl;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!running || !visible) return;
    const t = isNaN(fixedT) ? ((now - start - paused) / 1000) % CYCLE : fixedT;
    if (fade && isNaN(fixedT)) fade.style.opacity = t > CYCLE - .9 ? String((t - (CYCLE - .9)) / .9) : (t < .6 ? String(1 - t / .6) : "0");
    if (t < .05) prevTruckX = -70;
    pose(t);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(host);

  return {
    toggle() {
      running = !running;
      if (!running) pauseAt = performance.now(); else paused += performance.now() - pauseAt;
      return running;
    }
  };
}
