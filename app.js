import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

const overlayEl = document.getElementById("overlay");
const overlayEyebrowEl = document.getElementById("overlay-eyebrow");
const overlayTitleEl = document.getElementById("overlay-title");
const overlayTextEl = document.getElementById("overlay-text");
const startBtnEl = document.getElementById("start-btn");
const objectiveEl = document.getElementById("objective");
const healthEl = document.getElementById("health");
const statusEl = document.getElementById("status");
const enemyHealthEl = document.getElementById("enemy-health");
const promptEl = document.getElementById("prompt");
const crosshairEl = document.getElementById("crosshair");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);
scene.fog = new THREE.Fog(0x05070d, 10, 128);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 250);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x4c577a, 0.3));
const moonLight = new THREE.DirectionalLight(0x9fc1ff, 0.45);
moonLight.position.set(-12, 20, -18);
scene.add(moonLight);

const flashlight = new THREE.SpotLight(0xeaf3ff, 2.2, 24, Math.PI / 7, 0.42, 1);
const flashlightTarget = new THREE.Object3D();
scene.add(flashlightTarget);
flashlight.target = flashlightTarget;
camera.add(flashlight);
camera.add(new THREE.PointLight(0x7dcfff, 0.38, 10));
scene.add(camera);

const world = new THREE.Group();
const decor = new THREE.Group();
scene.add(world);
scene.add(decor);

const solids = [];
const colliders = [];
const interactables = [];
const ceilingLights = [];

const raycaster = new THREE.Raycaster();
const lineRaycaster = new THREE.Raycaster();
const handRaycaster = new THREE.Raycaster();
const centerScreen = new THREE.Vector2(0, 0);
const tmpVec3 = new THREE.Vector3();
const tmpVec3B = new THREE.Vector3();
const tmpVec3C = new THREE.Vector3();
const tmpForward = new THREE.Vector3();

const geometries = new Map();
function boxGeometry(w, h, d) {
  const key = `${w}:${h}:${d}`;
  if (!geometries.has(key)) geometries.set(key, new THREE.BoxGeometry(w, h, d));
  return geometries.get(key);
}

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.9,
    metalness: options.metalness ?? 0,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissive ? options.emissiveIntensity ?? 0.35 : 0,
    transparent: options.opacity !== undefined && options.opacity < 1,
    opacity: options.opacity ?? 1,
  });
}

function addMesh(geom, mat, x, y, z, parent = world) {
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function addSolidBox(x, y, z, w, h, d, color, options = {}) {
  const mesh = addMesh(boxGeometry(w, h, d), material(color, options), x, y, z);
  mesh.visible = options.visible !== false;
  solids.push(mesh);
  colliders.push({ mesh, w, h, d, enabled: true });
  return mesh;
}

function addDecorBox(x, y, z, w, h, d, color) {
  return addMesh(boxGeometry(w, h, d), material(color), x, y, z, decor);
}

function wallX(x1, x2, z, color, h = 5.8) {
  return addSolidBox((x1 + x2) / 2, 2.9, z, Math.abs(x2 - x1), h, 0.8, color);
}

function wallZ(x, z1, z2, color, h = 5.8) {
  return addSolidBox(x, 2.9, (z1 + z2) / 2, 0.8, h, Math.abs(z2 - z1), color);
}

function addCeilingLight(x, z, intensity = 1.1, color = 0xffe0a8) {
  const bulb = addMesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    material(color, { emissive: color, emissiveIntensity: 0.9, roughness: 0.4 }),
    x,
    5.66,
    z,
    decor,
  );
  const light = new THREE.PointLight(color, intensity, 12, 2);
  light.position.set(x, 5.42, z);
  scene.add(light);
  ceilingLights.push({ light, baseIntensity: intensity, phase: Math.random() * Math.PI * 2 });
  return bulb;
}

function addPipe(x, z, length, color = 0x3b4758) {
  const pipe = addMesh(
    new THREE.CylinderGeometry(0.1, 0.1, length, 10),
    material(color, { roughness: 0.68, metalness: 0.2 }),
    x,
    5.45,
    z,
    decor,
  );
  pipe.rotation.z = Math.PI / 2;
  return pipe;
}

function createHand(color, mirrored = false) {
  const group = new THREE.Group();
  const thumbSide = mirrored ? 1 : -1;
  const shell = material(color, { roughness: 0.66, metalness: 0.12, emissive: color, emissiveIntensity: 0.06 });
  const trim = material(0x151c28, { roughness: 0.9, metalness: 0.12 });
  const metal = material(0x8b95a9, { roughness: 0.38, metalness: 0.62 });
  const screen = material(0xd9f5ff, { roughness: 0.2, metalness: 0.25, emissive: 0xa7e8ff, emissiveIntensity: 0.45 });

  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.26), shell);
  palm.position.set(0, -0.02, 0.01);
  group.add(palm);

  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.12, 14), trim);
  wrist.rotation.x = Math.PI / 2;
  wrist.position.set(0, -0.2, -0.07);
  group.add(wrist);

  const topModule = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.1, 0.18), trim);
  topModule.position.set(0, 0.17, 0.02);
  topModule.rotation.x = -0.28;
  group.add(topModule);

  const screenPlate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.12), screen);
  screenPlate.position.set(0, 0.2, 0.05);
  screenPlate.rotation.x = -0.28;
  group.add(screenPlate);

  const sideGrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.14), trim);
  sideGrip.position.set(thumbSide * 0.16, -0.03, 0.02);
  group.add(sideGrip);

  const sideCap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12), metal);
  sideCap.rotation.z = Math.PI / 2;
  sideCap.position.set(-thumbSide * 0.18, -0.02, -0.03);
  group.add(sideCap);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.25, 14), shell);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(thumbSide * 0.2, 0.08, 0.09);
  group.add(barrel);

  const barrelRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.16), trim);
  barrelRail.position.set(thumbSide * 0.16, 0.12, 0.09);
  group.add(barrelRail);

  for (const x of [-0.1, 0, 0.1]) {
    const segmentA = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.06), shell);
    segmentA.position.set(x, 0.14, 0.11);
    segmentA.rotation.x = 0.22;
    group.add(segmentA);

    const segmentB = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.09, 0.055), shell);
    segmentB.position.set(x, 0.22, 0.14);
    segmentB.rotation.x = 0.46;
    group.add(segmentB);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.023, 0.06, 8), metal);
    tip.position.set(x, 0.28, 0.165);
    tip.rotation.x = Math.PI / 2;
    group.add(tip);
  }

  const thumbBase = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.07), shell);
  thumbBase.position.set(thumbSide * 0.13, 0.04, 0.1);
  thumbBase.rotation.z = thumbSide * 0.55;
  group.add(thumbBase);

  const thumbTip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.065, 8), metal);
  thumbTip.position.set(thumbSide * 0.17, 0.09, 0.14);
  thumbTip.rotation.x = Math.PI / 2;
  thumbTip.rotation.z = thumbSide * 0.28;
  group.add(thumbTip);

  return group;
}

function createHandProjectile(color, mirrored = false) {
  const group = createHand(color, mirrored);
  group.scale.setScalar(0.54);
  group.visible = false;
  scene.add(group);

  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.88 }),
  );
  line.visible = false;
  scene.add(line);

  return {
    group,
    line,
    active: false,
    phase: 0,
    duration: 0.14,
    hold: 0.06,
    retract: 0.12,
    start: new THREE.Vector3(),
    target: new THREE.Vector3(),
  };
}

function getHandSocket(side) {
  const offset = side === "left" ? new THREE.Vector3(-0.22, -0.12, -0.46) : new THREE.Vector3(0.22, -0.12, -0.46);
  return camera.localToWorld(offset);
}

const RIGHT_HAND_COLOR = 0xff8a24;

const handProjectiles = {
  left: createHandProjectile(0xb12f45, false),
  right: createHandProjectile(RIGHT_HAND_COLOR, true),
};

function createRightBlast(color) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const shellMat = material(0x9ca7bb, { roughness: 0.3, metalness: 0.72 });
  const ringMat = material(0x596278, { roughness: 0.44, metalness: 0.62 });
  const flameMat = material(color, { roughness: 0.26, emissive: color, emissiveIntensity: 1.35, opacity: 0.9 });

  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.24, 12), shellMat);
  shell.rotation.z = Math.PI / 2;
  group.add(shell);
  const ringA = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12), ringMat);
  ringA.rotation.z = Math.PI / 2;
  ringA.position.x = 0.07;
  group.add(ringA);
  const ringB = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12), ringMat);
  ringB.rotation.z = Math.PI / 2;
  ringB.position.x = -0.07;
  group.add(ringB);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.26, 10), ringMat);
  core.rotation.z = Math.PI / 2;
  core.position.x = 0.05;
  group.add(core);

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 10), flameMat);
  flame.rotation.z = -Math.PI / 2;
  flame.position.x = -0.28;
  group.add(flame);

  const trail = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.88 }),
  );
  trail.visible = false;
  scene.add(trail);

  const light = new THREE.PointLight(color, 0, 9, 2);
  scene.add(light);

  return {
    group,
    flame,
    flameMat,
    trail,
    light,
    active: false,
    start: new THREE.Vector3(),
    target: new THREE.Vector3(),
    travel: 0,
    distance: 1,
  };
}

const rightBlast = createRightBlast(RIGHT_HAND_COLOR);
const axisX = new THREE.Vector3(1, 0, 0);

const handRig = new THREE.Group();
handRig.position.set(0, -0.62, -0.95);
handRig.rotation.x = -0.08;
const leftHand = createHand(0xb12f45, false);
leftHand.position.set(-0.28, 0, 0.02);
leftHand.rotation.z = 0.14;
const rightHand = createHand(RIGHT_HAND_COLOR, true);
rightHand.position.set(0.18, 0, 0.02);
rightHand.rotation.z = -0.14;
handRig.add(leftHand);
handRig.add(rightHand);
camera.add(handRig);

const audioState = { ctx: null, ambience: null };
function ensureAudio() {
  if (!audioState.ctx) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    audioState.ctx = new AudioCtor();
  }
  if (audioState.ctx.state === "suspended") audioState.ctx.resume();
  return audioState.ctx;
}

function playTone({ type = "sine", freq = 220, freq2 = null, dur = 0.18, gain = 0.08, detune = 0, filter = null }) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  if (freq2 !== null) {
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq2), now + dur);
  }
  g.gain.value = 0.0001;
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  if (filter) {
    osc.connect(filter);
    filter.connect(g);
  } else {
    osc.connect(g);
  }
  g.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur + 0.02);
}

function playSfx(kind) {
  if (kind === "pickup") playTone({ type: "triangle", freq: 760, freq2: 980, dur: 0.14, gain: 0.04 });
  else if (kind === "gate") playTone({ type: "square", freq: 180, freq2: 320, dur: 0.35, gain: 0.05 });
  else if (kind === "hurt") playTone({ type: "sawtooth", freq: 120, freq2: 48, dur: 0.22, gain: 0.08 });
  else if (kind === "scare") {
    playTone({ type: "sawtooth", freq: 42, freq2: 18, dur: 0.75, gain: 0.11, detune: -18 });
    playTone({ type: "square", freq: 220, freq2: 140, dur: 0.13, gain: 0.03, detune: 12 });
  }
  else if (kind === "hum") playTone({ type: "sine", freq: 58, freq2: 52, dur: 1.2, gain: 0.018 });
}

const state = {
  running: false,
  paused: false,
  over: false,
  win: false,
  caught: false,
  gateOpen: false,
  health: 5,
  maxHealth: 5,
  power: 0,
  fuses: 0,
  finalGateOpen: false,
  enemyMode: "patrol",
  enemyMaxHealth: 8,
  enemyHealth: 8,
  enemyDead: false,
  enemyRespawnDelay: 7,
  enemyRespawnTimer: 0,
  enemyDamageCooldown: 0,
  toastText: "",
  toastTimer: 0,
  focused: null,
  beamTimer: 0,
  beamTarget: new THREE.Vector3(),
  scareTimer: 0,
  catchTimer: 0,
  handShake: 0,
  handShots: {
    left: null,
    right: null,
  },
};

const keys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  ShiftLeft: false,
  ShiftRight: false,
};

const PLAYER_RADIUS = 0.45;
const PLAYER_EYE_HEIGHT = 1.72;
const PLAYER_BODY_MIN_Y = 0.05;
const PLAYER_BODY_MAX_Y = PLAYER_EYE_HEIGHT + 0.05;
const MOVE_SPEED = 4.5;
const SPRINT_MULTIPLIER = 1.55;
const INTERACT_DISTANCE = 3.1;

const beam = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineBasicMaterial({ color: 0xff6a73, transparent: true, opacity: 0.9 }),
);
beam.visible = false;
scene.add(beam);

addSolidBox(37.5, -0.5, 5, 145, 1, 22, 0x171a23, { roughness: 1 });
addSolidBox(37.5, 6.18, 5, 145, 0.8, 22, 0x090b10, { roughness: 0.95 });
wallX(-31, 41, -5.5, 0x252b39);
wallX(-31, -22, 5.5, 0x252b39);
wallX(-14, -4, 5.5, 0x252b39);
wallX(4, 14, 5.5, 0x252b39);
wallX(22, 32, 5.5, 0x252b39);
wallX(34, 41, 5.5, 0x252b39);

const roomColors = [0x38242f, 0x233841, 0x303a27];
const roomXs = [-18, 0, 18];
for (let i = 0; i < roomXs.length; i += 1) {
  const cx = roomXs[i];
  const color = roomColors[i];
  wallZ(cx - 4.8, 5.5, 15.5, color);
  wallZ(cx + 4.8, 5.5, 15.5, color);
  wallX(cx - 4.8, cx + 4.8, 15.5, color);
  addDecorBox(cx - 2.8, 0.6, 7.2, 1.2, 1.2, 1.2, 0x58403a);
  addDecorBox(cx + 2.6, 0.45, 12.2, 1.0, 0.9, 1.0, 0x5e4650);
}

for (let x = -26; x <= 30; x += 8) addCeilingLight(x, -1.5, 1.1 + Math.random() * 0.2, 0xfff1cf);
for (const cx of roomXs) addCeilingLight(cx, 10.8, 0.8, 0xffda9b);
addPipe(-6, -3.7, 62);
addPipe(-6, 3.7, 62);

function flashBeam(color, target) {
  state.beamTarget.copy(target);
  state.beamTimer = 0.16;
  beam.material.color.setHex(color);
  beam.visible = true;
}

function toast(text, duration = 1.1) {
  state.toastText = text;
  state.toastTimer = duration;
  promptEl.textContent = text;
  promptEl.classList.remove("hidden");
}

function createCore(name, color, x, z) {
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.56, 0.42, 10),
    material(0x3b4456, { roughness: 0.85, metalness: 0.12 }),
  );
  pedestal.position.set(x, 0.21, z);
  scene.add(pedestal);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 16, 12),
    material(color, { emissive: color, emissiveIntensity: 1.15, roughness: 0.25 }),
  );
  core.position.set(x, 1.0, z);
  scene.add(core);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.06, 8, 14),
    material(color, { emissive: color, emissiveIntensity: 0.6, roughness: 0.3 }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.set(x, 1.0, z);
  scene.add(halo);

  const light = new THREE.PointLight(color, 1.5, 6, 2);
  light.position.set(x, 1.45, z);
  scene.add(light);

  const item = {
    type: "core",
    name,
    mesh: core,
    light,
    halo,
    pedestal,
    range: INTERACT_DISTANCE,
    collected: false,
    prompt: () => `${name} al`,
    onInteract() {
      if (item.collected || state.over || state.win) return;
      item.collected = true;
      core.visible = false;
      halo.visible = false;
      light.visible = false;
      state.power += 1;
      flashBeam(color, core.position);
      playSfx("pickup");
      toast(`${name} alindi`);
      updateHud();
    },
  };
  interactables.push(item);
}

function openGate() {
  state.gateOpen = true;
  gateCollider.visible = false;
  const gateData = colliders.find((entry) => entry.mesh === gateCollider);
  if (gateData) gateData.enabled = false;
  gateGroup.visible = false;
  escapeLight.intensity = 1.4;
  flashBeam(0x8af2ff, exitButton.position);
  toast("Kapi acildi. Kac!");
  updateHud();
}

function createMonster() {
  const group = new THREE.Group();
  group.position.set(-10, 0, 0);
  scene.add(group);

  const bodyMat = material(0x24344a, { roughness: 0.86, emissive: 0x090f1b, emissiveIntensity: 0.32 });
  const accentMat = material(0x0f1827, { roughness: 0.94 });
  const toothMat = material(0xe0e7ff, { roughness: 0.35, emissive: 0x37486a, emissiveIntensity: 0.22 });
  const eyeMat = material(0xff2f4f, { emissive: 0xff2f4f, emissiveIntensity: 2, roughness: 0.1 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.12, 2.1, 0.84), bodyMat);
  torso.position.set(0, 1.58, 0);
  group.add(torso);

  const ribs = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.3, 0.66), accentMat);
  ribs.position.set(0, 1.4, 0.02);
  torso.add(ribs);

  const head = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.14, 1.08), bodyMat);
  head.position.set(0, 3.05, 0.02);
  group.add(head);

  const crown = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.26), accentMat);
  crown.position.set(0, 3.64, 0.05);
  group.add(crown);
  for (let i = -1; i <= 1; i += 1) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), toothMat);
    spike.position.set(i * 0.2, 3.78, 0.04);
    group.add(spike);
  }

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.22, 0.18), accentMat);
  mouth.position.set(0, 2.78, 0.64);
  group.add(mouth);

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), eyeMat);
  eyeL.position.set(-0.27, 3.12, 0.6);
  group.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), eyeMat);
  eyeR.position.set(0.27, 3.12, 0.6);
  group.add(eyeR);

  const armGeo = new THREE.BoxGeometry(0.18, 2.5, 0.18);
  const leftArm = new THREE.Mesh(armGeo, bodyMat);
  leftArm.position.set(-0.96, 1.45, 0);
  group.add(leftArm);
  const rightArm = new THREE.Mesh(armGeo, bodyMat);
  rightArm.position.set(0.96, 1.45, 0);
  group.add(rightArm);

  for (const arm of [leftArm, rightArm]) {
    const clawA = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 6), toothMat);
    clawA.position.set(-0.04, -1.35, 0.12);
    clawA.rotation.x = Math.PI * 0.6;
    arm.add(clawA);
    const clawB = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 6), toothMat);
    clawB.position.set(0.04, -1.35, 0.12);
    clawB.rotation.x = Math.PI * 0.6;
    arm.add(clawB);
  }

  const legGeo = new THREE.BoxGeometry(0.26, 1.35, 0.26);
  const legL = new THREE.Mesh(legGeo, accentMat);
  legL.position.set(-0.32, 0.65, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, accentMat);
  legR.position.set(0.32, 0.65, 0);
  group.add(legR);

  const chestCore = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), eyeMat);
  chestCore.position.set(0, 1.7, 0.46);
  group.add(chestCore);

  const glow = new THREE.PointLight(0xff365f, 0.9, 10, 2);
  glow.position.set(0, 2.3, 0.1);
  group.add(glow);
  return {
    group,
    pathIndex: 0,
    bob: Math.random() * Math.PI * 2,
    torso,
    head,
    mouth,
    eyeL,
    eyeR,
    leftArm,
    rightArm,
    legL,
    legR,
    glow,
  };
}

createCore("Kirmizi cekirdek", 0xff4b52, -18, 11.2);
createCore("Turkuaz cekirdek", 0x55d9ff, 0, 11.2);
createCore("Sari cekirdek", 0xffd84f, 18, 11.2);

const gateCollider = addSolidBox(39.4, 2.4, 0, 0.82, 4.8, 10.8, 0x0d121a, { opacity: 0.06, roughness: 1 });
const gateGroup = new THREE.Group();
gateGroup.position.set(39.4, 0, 0);
scene.add(gateGroup);
for (let z = -4.2; z <= 4.2; z += 1.5) {
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.5, 0.34), material(0x546575, { roughness: 0.82, metalness: 0.35 }));
  bar.position.set(0, 2.25, z);
  gateGroup.add(bar);
}
const gateTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 10.8), material(0x546575, { roughness: 0.82, metalness: 0.35 }));
gateTop.position.set(0, 4.45, 0);
gateGroup.add(gateTop);

const escapeLight = new THREE.PointLight(0x8de9ff, 0.02, 18, 2);
escapeLight.position.set(44.5, 2.1, 0);
scene.add(escapeLight);

const exitPanel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.9, 0.42), material(0x273142, { roughness: 0.8, metalness: 0.1 }));
exitPanel.position.set(35.6, 1.05, 0.7);
scene.add(exitPanel);
const exitButton = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), material(0xff5058, { emissive: 0xff5058, emissiveIntensity: 0.8, roughness: 0.25 }));
exitButton.position.set(35.74, 1.23, 0.7);
scene.add(exitButton);

const exitSwitch = {
  type: "switch",
  name: "Guc paneli",
  mesh: exitButton,
  range: 3.4,
  prompt: () => (state.gateOpen ? "Kapi acik" : "E: Guc panelini calistir"),
  onInteract() {
    if (state.gateOpen) return;
    if (state.power < 3) {
      flashBeam(0xffad5b, exitButton.position);
      toast("Once 3 enerji cekirdegi lazim");
      return;
    }
    openGate();
  },
};
interactables.push(exitSwitch);

wallX(43, 108, -5.5, 0x252b39);
wallX(43, 108, 5.5, 0x252b39);
wallZ(108, -5.5, 5.5, 0x252b39);

for (let x = 46; x <= 102; x += 11) addCeilingLight(x, 1.0, 0.85, 0xd8f1ff);
addPipe(62, 0.3, 40, 0x445163);
addPipe(86, -0.4, 40, 0x445163);

function createFuse(name, color, x, z) {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.32, 0.28, 8),
    material(0x394353, { roughness: 0.82, metalness: 0.1 }),
  );
  base.position.set(x, 0.18, z);
  scene.add(base);

  const fuse = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 14, 10),
    material(color, { emissive: color, emissiveIntensity: 1.05, roughness: 0.25 }),
  );
  fuse.position.set(x, 0.9, z);
  scene.add(fuse);

  const glow = new THREE.PointLight(color, 1.1, 5, 2);
  glow.position.set(x, 1.15, z);
  scene.add(glow);

  const item = {
    type: "fuse",
    name,
    mesh: fuse,
    glow,
    range: INTERACT_DISTANCE,
    collected: false,
    prompt: () => `${name} al`,
    onInteract() {
      if (item.collected || state.over || state.win) return;
      item.collected = true;
      fuse.visible = false;
      glow.visible = false;
      state.fuses += 1;
      flashBeam(color, fuse.position);
      playSfx("pickup");
      toast(`${name} alindi`);
      updateHud();
    },
  };
  interactables.push(item);
}

function openFinalGate() {
  state.finalGateOpen = true;
  finalGateCollider.visible = false;
  const data = colliders.find((entry) => entry.mesh === finalGateCollider);
  if (data) data.enabled = false;
  finalGateGroup.visible = false;
  finalExitLight.intensity = 1.5;
  flashBeam(0x9efcff, finalSwitch.mesh.position);
  playSfx("gate");
  toast("Final kapi acildi!");
  updateHud();
}

const finalGateCollider = addSolidBox(100.4, 2.4, 0, 0.82, 4.8, 10.8, 0x0d121a, { opacity: 0.06, roughness: 1 });
const finalGateGroup = new THREE.Group();
finalGateGroup.position.set(100.4, 0, 0);
scene.add(finalGateGroup);
for (let z = -4.2; z <= 4.2; z += 1.5) {
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.5, 0.34), material(0x6b7b8d, { roughness: 0.82, metalness: 0.35 }));
  bar.position.set(0, 2.25, z);
  finalGateGroup.add(bar);
}
const finalTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 10.8), material(0x6b7b8d, { roughness: 0.82, metalness: 0.35 }));
finalTop.position.set(0, 4.45, 0);
finalGateGroup.add(finalTop);

const finalExitLight = new THREE.PointLight(0x9efcff, 0.02, 18, 2);
finalExitLight.position.set(105.6, 2.1, 0);
scene.add(finalExitLight);

const finalPanel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.9, 0.42), material(0x273142, { roughness: 0.8, metalness: 0.1 }));
finalPanel.position.set(96.6, 1.05, 0.7);
scene.add(finalPanel);
const finalButton = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), material(0x5cff8b, { emissive: 0x5cff8b, emissiveIntensity: 0.8, roughness: 0.25 }));
finalButton.position.set(96.74, 1.23, 0.7);
scene.add(finalButton);

const finalSwitch = {
  type: "switch",
  name: "Final panel",
  mesh: finalButton,
  range: 3.4,
  prompt: () => (state.finalGateOpen ? "Final kapi acik" : "E: Final paneli calistir"),
  onInteract() {
    if (state.finalGateOpen) return;
    if (!state.gateOpen || state.fuses < 2) {
      flashBeam(0xffad5b, finalButton.position);
      toast("Once 2 sigorta ve ana kapi gerekir");
      return;
    }
    openFinalGate();
  },
};
interactables.push(finalSwitch);

createFuse("Mavi sigorta", 0x59d8ff, 52, 11.2);
createFuse("Turuncu sigorta", 0xff8c4a, 63, 11.2);

const monster = createMonster();
const monsterPath = [
  new THREE.Vector2(-24, 0),
  new THREE.Vector2(-11, 0),
  new THREE.Vector2(2, 0),
  new THREE.Vector2(16, 0),
  new THREE.Vector2(28, 0),
  new THREE.Vector2(10, 0),
  new THREE.Vector2(-4, 0),
  new THREE.Vector2(52, 0),
  new THREE.Vector2(63, 0),
  new THREE.Vector2(78, 0),
  new THREE.Vector2(92, 0),
  new THREE.Vector2(103, 0),
];

const scareMonster = monster.group.clone(true);
scareMonster.visible = false;
scareMonster.scale.setScalar(0.9);
camera.add(scareMonster);

function isMonsterPart(obj) {
  let current = obj;
  while (current) {
    if (current === monster.group) return true;
    current = current.parent;
  }
  return false;
}

function damageMonster(amount = 1) {
  if (state.enemyDead || !state.running || state.over || state.win) return;
  state.enemyHealth = Math.max(0, state.enemyHealth - amount);
  playTone({ type: "square", freq: 520, freq2: 250, dur: 0.08, gain: 0.03 });
  if (state.enemyHealth <= 0) {
    state.enemyDead = true;
    state.enemyMode = "patrol";
    state.enemyRespawnTimer = state.enemyRespawnDelay;
    monster.group.visible = false;
    toast("Canavar dustu. Tekrar dogacak.");
  }
  updateHud();
}

function updateHud() {
  objectiveEl.textContent = `Guc: ${state.power}/3 | Sigorta: ${state.fuses}/2`;
  healthEl.textContent = `Saglik: ${state.health}/${state.maxHealth}`;
  enemyHealthEl.textContent = state.enemyDead
    ? `Canavar Cani: 0/${state.enemyMaxHealth} (Respawn ${state.enemyRespawnTimer.toFixed(1)}sn)`
    : `Canavar Cani: ${state.enemyHealth}/${state.enemyMaxHealth}`;
  const enemyStatus = state.enemyDead
    ? "Oldu"
    : (state.caught ? "Seni Yakaladi" : (state.enemyMode === "chase" ? "Kovaliyor" : "Dolasiyor"));
  statusEl.textContent = `Kapi: ${state.gateOpen ? "Acik" : "Kilitli"} | Final: ${state.finalGateOpen ? "Acik" : "Kilitli"} | Canavar: ${enemyStatus}`;
}

function updateCrosshair() {
  crosshairEl.classList.toggle("hidden", !state.running || state.paused || state.over || state.win || state.caught || !isLocked());
}

function startAmbience() {
  const ctx = ensureAudio();
  if (!ctx || audioState.ambience) return;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 48;
  filter.type = "lowpass";
  filter.frequency.value = 220;
  gain.gain.value = 0.015;
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  audioState.ambience = { osc, gain };
}

function stopAmbience() {
  if (!audioState.ambience) return;
  try {
    audioState.ambience.osc.stop();
  } catch {
    // ignore
  }
  audioState.ambience = null;
}

function triggerScare() {
  state.scareTimer = 0.95;
  state.handShake = 1.15;
  scareMonster.visible = true;
  scareMonster.position.set(0, -0.12, -0.68);
  scareMonster.scale.setScalar(1.18);
  playSfx("scare");
}

function updateHands(time) {
  const walking = state.running && !state.paused && !state.over && !state.win && !state.caught && isLocked() && (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD);
  if (state.handShake > 0) state.handShake = Math.max(0, state.handShake - 0.05);
  const shake = state.handShake;
  const bob = walking ? Math.sin(time * 12) * 0.06 : Math.sin(time * 2.2) * 0.015;
  handRig.position.x = (Math.sin(time * 24) + Math.cos(time * 17)) * 0.008 * shake;
  handRig.position.y = -0.62 + bob + Math.sin(time * 21) * 0.01 * shake;
  handRig.position.z = -0.95 + (walking ? Math.sin(time * 14) * 0.03 : 0) - shake * 0.03;
  leftHand.rotation.z = 0.14 + Math.sin(time * 8) * 0.04 + (walking ? 0.08 : 0) + shake * 0.06;
  rightHand.rotation.z = -0.14 - Math.sin(time * 8) * 0.04 - (walking ? 0.08 : 0) - shake * 0.06;
  leftHand.rotation.x = Math.sin(time * 5) * 0.03 + shake * 0.05;
  rightHand.rotation.x = -Math.sin(time * 5) * 0.03 - shake * 0.05;
  handRig.visible = state.scareTimer <= 0 && !state.over && !state.win && !state.caught;
}

function updateScare(delta, time) {
  if (state.scareTimer <= 0) {
    scareMonster.visible = false;
    scareMonster.scale.setScalar(0.9);
    camera.rotation.z = Math.sin(time * 0.4) * 0.005;
    return;
  }

  state.scareTimer = Math.max(0, state.scareTimer - delta);
  scareMonster.visible = true;
  scareMonster.position.set((Math.random() - 0.5) * 0.16, -0.08 + (Math.random() - 0.5) * 0.09, -0.7 + Math.sin(time * 28) * 0.03);
  scareMonster.rotation.y = Math.PI + Math.sin(time * 14) * 0.08;
  scareMonster.rotation.x = -0.04 + Math.sin(time * 24) * 0.05;
  scareMonster.scale.setScalar(1.18 + Math.sin(time * 18) * 0.05);
  camera.rotation.z = (Math.random() - 0.5) * 0.08;
  if (state.scareTimer <= 0) scareMonster.visible = false;
}

function fireRightBlast() {
  handRaycaster.setFromCamera(centerScreen, camera);
  const hits = handRaycaster.intersectObjects(
    [monster.group, ...interactables.map((entry) => entry.mesh), ...solids],
    true,
  );

  const start = getHandSocket("right");
  const hit = hits[0];
  const target = hit?.point?.clone() ?? camera.getWorldDirection(tmpForward).clone().multiplyScalar(24).add(camera.position);
  const hitObject = hit?.object ?? null;
  if (hitObject && isMonsterPart(hitObject)) {
    damageMonster(1);
  }
  const item = hitObject ? interactables.find((entry) => entry.mesh === hitObject) : null;
  if (item && hit.distance <= item.range + 0.75) {
    flashBeam(RIGHT_HAND_COLOR, hit.point);
    item.onInteract();
  }

  rightBlast.start.copy(start);
  rightBlast.target.copy(target);
  rightBlast.distance = Math.max(0.001, start.distanceTo(target));
  rightBlast.travel = 0;
  rightBlast.active = true;
  rightBlast.group.visible = true;
  rightBlast.trail.visible = true;
  rightBlast.group.position.copy(start);
  rightBlast.light.position.copy(start);
  rightBlast.light.intensity = 1.45;
  rightBlast.flame.scale.set(1, 1, 1);
  rightBlast.trail.geometry.setFromPoints([start, start]);

  const dir = tmpVec3B.copy(target).sub(start).normalize();
  rightBlast.group.quaternion.setFromUnitVectors(axisX, dir);
  playTone({ type: "sawtooth", freq: 280, freq2: 170, dur: 0.14, gain: 0.04 });
}

function fireHand(side) {
  if (!state.running || state.paused || state.over || state.win || state.caught || !isLocked()) return;

  if (side === "right") {
    fireRightBlast();
    return;
  }

  const projectile = handProjectiles.left;
  handRaycaster.setFromCamera(centerScreen, camera);
  const hits = handRaycaster.intersectObjects(
    [...interactables.map((entry) => entry.mesh), ...solids],
    false,
  );

  const start = getHandSocket("left");
  const hit = hits[0];
  const target = hit?.point?.clone() ?? camera.getWorldDirection(tmpForward).clone().multiplyScalar(32).add(camera.position);
  projectile.start.copy(start);
  projectile.target.copy(target);
  projectile.phase = 0;
  projectile.duration = 0.28;
  projectile.hold = 0.08;
  projectile.retract = 0.26;
  projectile.active = true;
  projectile.group.visible = true;
  projectile.line.visible = true;
  projectile.group.position.copy(start);
  projectile.group.lookAt(target);
  projectile.group.scale.setScalar(0.52);
  projectile.line.geometry.setFromPoints([projectile.start, projectile.start]);
  playTone({ type: "triangle", freq: 320, freq2: 160, dur: 0.11, gain: 0.028 });

  const hitObject = hit?.object ?? null;
  const item = hitObject ? interactables.find((entry) => entry.mesh === hitObject) : null;
  if (item && hit.distance <= 30) {
    flashBeam(0xb12f45, hit.point);
    item.onInteract();
  }
}

function updateHandProjectiles(delta, time) {
  const entries = [handProjectiles.left, handProjectiles.right];
  for (const projectile of entries) {
    if (!projectile.active) {
      projectile.group.visible = false;
      projectile.line.visible = false;
      continue;
    }

    projectile.phase += delta;
    const outbound = projectile.duration;
    const hold = projectile.hold;
    const retract = projectile.retract;
    let point;

    if (projectile.phase <= outbound) {
      const t = projectile.phase / outbound;
      point = tmpVec3.lerpVectors(projectile.start, projectile.target, t);
      projectile.group.lookAt(projectile.target);
    } else if (projectile.phase <= outbound + hold) {
      point = projectile.target;
      projectile.group.lookAt(camera.position);
    } else if (projectile.phase <= outbound + hold + retract) {
      const t = (projectile.phase - outbound - hold) / retract;
      point = tmpVec3.lerpVectors(projectile.target, projectile.start, t);
      projectile.group.lookAt(projectile.start);
    } else {
      projectile.active = false;
      projectile.group.visible = false;
      projectile.line.visible = false;
      continue;
    }

    projectile.group.position.copy(point);
    projectile.group.rotation.z += Math.sin(time * 28) * 0.03;
    projectile.group.scale.setScalar(0.54 + Math.sin(time * 20) * 0.02);
    projectile.line.geometry.setFromPoints([projectile.start, point]);
    projectile.line.material.opacity = projectile.phase <= outbound + hold ? 0.9 : 0.72;
    projectile.line.visible = true;
  }
}

function updateRightBlast(delta, time) {
  if (!rightBlast.active) {
    rightBlast.group.visible = false;
    rightBlast.trail.visible = false;
    rightBlast.light.intensity = 0;
    return;
  }

  rightBlast.travel += delta * 25;
  const t = Math.min(1, rightBlast.travel / rightBlast.distance);
  const pos = tmpVec3.lerpVectors(rightBlast.start, rightBlast.target, t);
  const dir = tmpVec3C.copy(rightBlast.target).sub(rightBlast.start).normalize();
  rightBlast.group.position.copy(pos);
  rightBlast.group.quaternion.setFromUnitVectors(axisX, dir);
  rightBlast.group.rotation.x += Math.sin(time * 32) * 0.02;
  rightBlast.flame.scale.set(1.2 + Math.sin(time * 30) * 0.18, 0.9, 0.9);
  rightBlast.flameMat.opacity = 0.68 + Math.sin(time * 26) * 0.1;
  rightBlast.trail.geometry.setFromPoints([rightBlast.start, pos]);
  rightBlast.trail.material.opacity = 0.85 - t * 0.35;
  rightBlast.trail.visible = true;
  rightBlast.light.position.copy(pos);
  rightBlast.light.intensity = 1.25 - t * 0.8;

  if (t >= 1) {
    rightBlast.active = false;
    rightBlast.group.visible = false;
    rightBlast.trail.visible = false;
    rightBlast.light.intensity = 0;
  }
}

function isLocked() {
  return document.pointerLockElement === renderer.domElement;
}

function requestLock() {
  renderer.domElement.requestPointerLock?.();
}

function releaseLock() {
  if (document.pointerLockElement) document.exitPointerLock();
}

function syncMenu(mode) {
  overlayEl.classList.remove("hidden");
  if (mode === "start") {
    overlayEyebrowEl.textContent = "Horror Prototype";
    overlayTitleEl.textContent = "Poppy Playtime: Karanlik Fabrika";
    overlayTextEl.textContent = "Karanlik fabrikada 3 enerji cekirdegi topla, guc panelini calistir ve canavardan kurtul.";
    startBtnEl.textContent = "Oyuna Basla";
  } else if (mode === "pause") {
    overlayEyebrowEl.textContent = "Duraklatildi";
    overlayTitleEl.textContent = "Devam etmeye hazir misin?";
    overlayTextEl.textContent = "ESC ile cikinca oyun durur. Devam etmek icin butona bas.";
    startBtnEl.textContent = "Devam Et";
  } else if (mode === "win") {
    overlayEyebrowEl.textContent = "Kacis Basarili";
    overlayTitleEl.textContent = "Fabrikadan kurtuldun";
    overlayTextEl.textContent = "Guc geri geldi ve cikis acildi. Oyun bitti.";
    startBtnEl.textContent = "Tekrar Oyna";
  } else {
    overlayEyebrowEl.textContent = "Yakalandin";
    overlayTitleEl.textContent = "Canavar seni buldu";
    overlayTextEl.textContent = "Gizlenmek yeterli olmadi. Istersen yeniden baslayabilirsin.";
    startBtnEl.textContent = "Yeniden Basla";
  }
}

function hideMenu() {
  overlayEl.classList.add("hidden");
}

function findFocusedInteractable() {
  raycaster.setFromCamera(centerScreen, camera);
  const hits = raycaster.intersectObjects(interactables.map((entry) => entry.mesh), false);
  for (const hit of hits) {
    const item = interactables.find((entry) => entry.mesh === hit.object);
    if (!item || hit.distance > item.range) continue;
    if (item.type === "core" && item.collected) continue;
    return item;
  }
  return null;
}

function updatePrompt(delta) {
  if (!state.running || state.paused || state.over || state.win || state.caught || !isLocked()) {
    promptEl.classList.add("hidden");
    state.focused = null;
    return;
  }

  if (state.toastTimer > 0) {
    state.toastTimer = Math.max(0, state.toastTimer - delta);
    if (state.toastTimer > 0) {
      promptEl.textContent = state.toastText;
      promptEl.classList.remove("hidden");
      return;
    }
  }

  const item = findFocusedInteractable();
  state.focused = item;
  if (!item) {
    promptEl.classList.add("hidden");
    return;
  }
  promptEl.textContent = item.prompt();
  promptEl.classList.remove("hidden");
}

function tryInteract() {
  if (!state.running || state.paused || state.over || state.win || state.caught || !isLocked()) return;
  const item = state.focused || findFocusedInteractable();
  if (item) item.onInteract();
}

function addDamage(amount) {
  if (state.over || state.win || state.caught) return;
  state.health = Math.max(0, state.health - amount);
  playSfx("hurt");
  triggerScare();
  toast("Canavar seni yaraladi");
  updateHud();
  if (state.health <= 0) startCatchScare();
}

function startCatchScare() {
  if (state.over || state.win || state.caught) return;
  state.caught = true;
  state.catchTimer = 1.05;
  state.health = 0;
  state.enemyDamageCooldown = 0;
  triggerScare();
  state.scareTimer = Math.max(state.scareTimer, 1.35);
  state.handShake = Math.max(state.handShake, 1.5);
  toast("Canavar seni yakaladi!");
  updateHud();
  updateCrosshair();
}

function updateCaught(delta, time) {
  if (!state.caught || state.over || state.win) return;
  state.catchTimer = Math.max(0, state.catchTimer - delta);
  const p = 1 - state.catchTimer / 1.05;
  yaw += Math.sin(time * 34) * (0.0018 + p * 0.0012);
  pitch = THREE.MathUtils.clamp(pitch + Math.sin(time * 26) * (0.0012 + p * 0.0008), -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
  camera.rotation.set(pitch, yaw, camera.rotation.z + (Math.random() - 0.5) * (0.02 + p * 0.03));
  if (state.catchTimer <= 0) loseGame();
}

function loseGame() {
  if (state.over || state.win) return;
  state.over = true;
  state.caught = false;
  state.catchTimer = 0;
  state.paused = false;
  stopAmbience();
  syncMenu("lose");
  releaseLock();
  updateCrosshair();
}

function winGame() {
  if (state.win) return;
  state.win = true;
  state.paused = false;
  stopAmbience();
  syncMenu("win");
  releaseLock();
  updateCrosshair();
}

function resetGame() {
  state.running = false;
  state.paused = false;
  state.over = false;
  state.win = false;
  state.caught = false;
  state.gateOpen = false;
  state.finalGateOpen = false;
  state.health = state.maxHealth;
  state.power = 0;
  state.fuses = 0;
  state.enemyMode = "patrol";
  state.enemyHealth = state.enemyMaxHealth;
  state.enemyDead = false;
  state.enemyRespawnTimer = 0;
  state.enemyDamageCooldown = 0;
  state.toastText = "";
  state.toastTimer = 0;
  state.beamTimer = 0;
  state.focused = null;
  state.scareTimer = 0;
  state.catchTimer = 0;
  state.handShake = 0;
  state.handShots.left = null;
  state.handShots.right = null;

  gateCollider.visible = true;
  const gateData = colliders.find((entry) => entry.mesh === gateCollider);
  if (gateData) gateData.enabled = true;
  gateGroup.visible = true;
  escapeLight.intensity = 0.02;
  finalGateCollider.visible = true;
  const finalGateData = colliders.find((entry) => entry.mesh === finalGateCollider);
  if (finalGateData) finalGateData.enabled = true;
  finalGateGroup.visible = true;
  finalExitLight.intensity = 0.02;

  for (const item of interactables) {
    if (item.type !== "core") continue;
    item.collected = false;
    item.mesh.visible = true;
    item.halo.visible = true;
    item.light.visible = true;
  }
  for (const item of interactables) {
    if (item.type !== "fuse") continue;
    item.collected = false;
    item.mesh.visible = true;
    item.glow.visible = true;
  }

  monster.group.position.set(-10, 0, 0);
  monster.pathIndex = 0;
  monster.group.visible = true;
  monster.group.rotation.set(0, 0, 0);
  scareMonster.visible = false;
  for (const projectile of [handProjectiles.left, handProjectiles.right]) {
    projectile.active = false;
    projectile.group.visible = false;
    projectile.line.visible = false;
  }
  rightBlast.active = false;
  rightBlast.group.visible = false;
  rightBlast.trail.visible = false;
  rightBlast.light.intensity = 0;

  camera.position.set(-26, PLAYER_EYE_HEIGHT, 0.2);
  yaw = Math.PI / 2;
  pitch = 0;
  camera.rotation.set(pitch, yaw, 0);

  beam.visible = false;
  promptEl.classList.add("hidden");
  updateHud();
  updateCrosshair();
}

function startSession() {
  resetGame();
  state.running = true;
  hideMenu();
  ensureAudio();
  startAmbience();
  requestLock();
  updateCrosshair();
}

function resumeSession() {
  state.paused = false;
  hideMenu();
  requestLock();
  updateCrosshair();
}

function onMenuAction(event) {
  event?.stopPropagation?.();
  if (!state.running || state.over || state.win) {
    startSession();
    return;
  }
  if (state.paused) resumeSession();
}

function pointerLockChange() {
  if (isLocked()) {
    if (!state.over && !state.win) hideMenu();
  }
  updateCrosshair();
}

function pointerLockError() {
  if (!state.running) syncMenu("start");
}

let yaw = Math.PI / 2;
let pitch = 0;
camera.position.set(-26, PLAYER_EYE_HEIGHT, 0.2);
camera.rotation.set(pitch, yaw, 0);

function onMouseMove(event) {
  if (!state.running || state.paused || state.over || state.win || state.caught || !isLocked()) return;
  yaw -= event.movementX * 0.0022;
  pitch -= event.movementY * 0.0022;
  pitch = THREE.MathUtils.clamp(pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
  camera.rotation.set(pitch, yaw, 0);
}

function onMouseDown(event) {
  if (event.button === 0) {
    event.preventDefault();
    fireHand("left");
  } else if (event.button === 2) {
    event.preventDefault();
    fireHand("right");
  }
}

function onKeyDown(event) {
  const isMoveKey = event.code === "KeyW" || event.code === "KeyA" || event.code === "KeyS" || event.code === "KeyD";
  if (event.code in keys) keys[event.code] = true;
  if (isMoveKey) {
    event.preventDefault();
    if (!state.running) {
      startSession();
      return;
    }
    if (!state.paused && !state.over && !state.win && !state.caught && !isLocked()) {
      requestLock();
    }
  }
  if (event.code === "KeyE") {
    event.preventDefault();
    tryInteract();
  }
  if (event.code === "Escape" && state.running && !state.over && !state.win && !state.caught && isLocked()) {
    state.paused = true;
    syncMenu("pause");
    releaseLock();
  }
}

function onKeyUp(event) {
  if (event.code in keys) keys[event.code] = false;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function canOccupy(x, z) {
  for (const collider of colliders) {
    if (!collider.enabled) continue;
    const { mesh, w, h, d } = collider;
    const minY = mesh.position.y - h / 2;
    const maxY = mesh.position.y + h / 2;
    if (maxY <= PLAYER_BODY_MIN_Y || minY >= PLAYER_BODY_MAX_Y) continue;
    const minX = mesh.position.x - w / 2;
    const maxX = mesh.position.x + w / 2;
    const minZ = mesh.position.z - d / 2;
    const maxZ = mesh.position.z + d / 2;
    if (x + PLAYER_RADIUS > minX && x - PLAYER_RADIUS < maxX && z + PLAYER_RADIUS > minZ && z - PLAYER_RADIUS < maxZ) {
      return false;
    }
  }
  return true;
}

function movePlayer(delta) {
  if (!state.running || state.paused || state.over || state.win || state.caught) return;

  tmpForward.set(Math.sin(yaw), 0, -Math.cos(yaw));

  const right = new THREE.Vector3(tmpForward.z, 0, -tmpForward.x);
  const move = new THREE.Vector3();
  if (keys.KeyW) move.add(tmpForward);
  if (keys.KeyS) move.sub(tmpForward);
  if (keys.KeyA) move.sub(right);
  if (keys.KeyD) move.add(right);

  if (move.lengthSq() > 0) {
    move.normalize();
    const speed = MOVE_SPEED * (keys.ShiftLeft || keys.ShiftRight ? SPRINT_MULTIPLIER : 1);
    const nextX = camera.position.x + move.x * speed * delta;
    const nextZ = camera.position.z + move.z * speed * delta;
    if (canOccupy(nextX, camera.position.z)) camera.position.x = nextX;
    if (canOccupy(camera.position.x, nextZ)) camera.position.z = nextZ;
    camera.position.y = PLAYER_EYE_HEIGHT;
  }

  if (state.finalGateOpen && camera.position.x > 106.8) winGame();
}

function hasLineOfSight(from2D, to2D) {
  const from = tmpVec3.set(from2D.x, 1.5, from2D.y);
  const to = tmpVec3B.set(to2D.x, 1.5, to2D.y);
  const direction = to.clone().sub(from);
  const distance = direction.length();
  if (distance > 16) return false;
  lineRaycaster.set(from, direction.normalize());
  lineRaycaster.far = distance;
  return lineRaycaster.intersectObjects(solids, false).length === 0;
}

function updateEnemy(delta) {
  if (!state.running || state.over || state.win || state.caught) return;

  if (state.enemyDead) {
    state.enemyRespawnTimer = Math.max(0, state.enemyRespawnTimer - delta);
    if (state.enemyRespawnTimer <= 0) {
      monster.group.position.set(-10, 0, 0);
      monster.pathIndex = 0;
      monster.group.rotation.set(0, 0, 0);
      monster.group.visible = true;
      state.enemyHealth = state.enemyMaxHealth;
      state.enemyDead = false;
      state.enemyDamageCooldown = 0;
      state.enemyMode = "patrol";
      toast("Canavar yeniden dogdu!");
    }
    updateHud();
    return;
  }

  const player = new THREE.Vector2(camera.position.x, camera.position.z);
  const enemyPos = new THREE.Vector2(monster.group.position.x, monster.group.position.z);
  const dist = enemyPos.distanceTo(player);
  const sees = hasLineOfSight(enemyPos, player);

  if (dist < 15 && sees) state.enemyMode = "chase";
  else if (state.enemyMode === "chase" && dist < 21) state.enemyMode = "chase";
  else state.enemyMode = "patrol";

  const target = state.enemyMode === "chase" ? player : monsterPath[monster.pathIndex];
  const speed = state.enemyMode === "chase" ? 1.35 + state.power * 0.08 : 0.42 + state.power * 0.02;
  const dir = target.clone().sub(enemyPos);
  if (dir.lengthSq() > 0.0001) {
    dir.normalize();
    monster.group.position.x += dir.x * speed * delta;
    monster.group.position.z += dir.y * speed * delta;
    monster.group.rotation.y = Math.atan2(dir.x, dir.y);
  }

  if (state.enemyMode === "patrol" && enemyPos.distanceTo(target) < 0.7) {
    monster.pathIndex = (monster.pathIndex + 1) % monsterPath.length;
  }

  const now = performance.now() * 0.001;
  const chaseWeight = state.enemyMode === "chase" ? 1 : 0;
  const stride = now * (state.enemyMode === "chase" ? 13 : 7.5) + monster.bob;
  const sway = Math.sin(now * 6) * 0.04;
  const lean = chaseWeight * 0.22;

  monster.group.position.y = 0.03 + Math.sin(now * 5 + monster.bob) * 0.04;
  monster.group.scale.setScalar(1 + chaseWeight * 0.08 + Math.sin(now * 2.5) * 0.01);
  monster.group.rotation.z = Math.sin(now * 3.2) * 0.03 * (0.4 + chaseWeight);
  monster.torso.rotation.x = -0.03 - lean * 0.5 + Math.sin(now * 4.8) * 0.02;
  monster.torso.rotation.z = Math.sin(now * 5.4) * 0.02;
  monster.head.rotation.x = 0.05 + Math.sin(now * 8.2) * 0.04 - lean * 0.35;
  monster.head.rotation.y = Math.sin(now * 3.6) * 0.08;
  monster.head.rotation.z = Math.sin(now * 7.4) * 0.05 * chaseWeight;
  monster.mouth.scale.y = 1 + Math.max(0, Math.sin(now * 14 + 1.4)) * (0.25 + chaseWeight * 0.35);
  monster.mouth.position.z = 0.64 + Math.max(0, Math.sin(now * 11.2)) * 0.06;
  monster.eyeL.scale.setScalar(1 + Math.max(0, Math.sin(now * 18)) * 0.12);
  monster.eyeR.scale.setScalar(1 + Math.max(0, Math.sin(now * 18 + 0.7)) * 0.12);
  monster.eyeL.position.y = 3.12 + Math.sin(now * 16) * 0.04;
  monster.eyeR.position.y = 3.12 + Math.sin(now * 16 + 0.7) * 0.04;
  monster.leftArm.rotation.x = 0.18 + Math.sin(stride) * (0.18 + chaseWeight * 0.22);
  monster.rightArm.rotation.x = -0.18 - Math.sin(stride + Math.PI) * (0.18 + chaseWeight * 0.22);
  monster.leftArm.rotation.z = -0.08 + sway - chaseWeight * 0.08;
  monster.rightArm.rotation.z = 0.08 - sway + chaseWeight * 0.08;
  monster.leftArm.position.y = 1.45 + Math.sin(stride + 0.5) * (0.08 + chaseWeight * 0.08);
  monster.rightArm.position.y = 1.45 + Math.sin(stride + Math.PI + 0.5) * (0.08 + chaseWeight * 0.08);
  monster.legL.rotation.x = Math.sin(stride + Math.PI) * 0.18;
  monster.legR.rotation.x = Math.sin(stride) * 0.18;
  monster.legL.position.y = 0.65 + Math.max(0, Math.sin(stride + Math.PI)) * 0.06;
  monster.legR.position.y = 0.65 + Math.max(0, Math.sin(stride)) * 0.06;
  monster.glow.intensity = 0.55 + chaseWeight * 0.55 + Math.sin(now * 10) * 0.08;
  monster.glow.distance = 7.5 + chaseWeight * 1.8;

  if (dist < 1.08) {
    startCatchScare();
    return;
  }

  if (state.enemyMode === "chase" && dist < 3.2 && state.scareTimer <= 0) triggerScare();

  if (dist < 1.35) {
    state.enemyDamageCooldown += delta;
    if (state.enemyDamageCooldown > 0.45) {
      state.enemyDamageCooldown = 0;
      addDamage(1);
    }
  } else {
    state.enemyDamageCooldown = Math.max(0, state.enemyDamageCooldown - delta * 1.5);
  }
}

function updateBeam(delta) {
  if (state.beamTimer <= 0) {
    beam.visible = false;
    return;
  }
  state.beamTimer = Math.max(0, state.beamTimer - delta);
  beam.geometry.setFromPoints([camera.getWorldPosition(new THREE.Vector3()), state.beamTarget.clone()]);
  beam.material.opacity = Math.max(0, state.beamTimer / 0.16);
  beam.visible = true;
}

function updateLights(time) {
  for (let i = 0; i < ceilingLights.length; i += 1) {
    const entry = ceilingLights[i];
    const flicker = 0.88 + Math.sin(time * 6 + entry.phase) * 0.08 + Math.sin(time * 17 + i) * 0.04;
    entry.light.intensity = Math.max(0.12, entry.baseIntensity * flicker);
  }
  camera.getWorldDirection(tmpForward);
  flashlightTarget.position.copy(camera.position).add(tmpForward.multiplyScalar(12));
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (state.running && !state.paused && !state.over && !state.win && !state.caught) {
    movePlayer(delta);
    updateEnemy(delta);
  }

  updateCaught(delta, time);
  updateBeam(delta);
  updateLights(time);
  updateHands(time);
  updateHandProjectiles(delta, time);
  updateRightBlast(delta, time);
  updateScare(delta, time);
  updatePrompt(delta);
  updateHud();
  updateCrosshair();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

overlayEl.addEventListener("click", onMenuAction);
startBtnEl.addEventListener("click", onMenuAction);
document.addEventListener("pointerlockchange", pointerLockChange);
document.addEventListener("pointerlockerror", pointerLockError);
document.addEventListener("mousemove", onMouseMove);
document.addEventListener("mousedown", onMouseDown);
document.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.addEventListener("resize", onResize);
renderer.domElement.addEventListener("click", () => {
  if (!isLocked() && state.running && !state.paused && !state.over && !state.win && !state.caught) requestLock();
});

const clock = new THREE.Clock();
resetGame();
syncMenu("start");
updateCrosshair();
updateHud();
animate();
