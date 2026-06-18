import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { wireUI } from './ui.js';

const TYPECOLOR = { 집: 0xf6ad55, 건물: 0x60a5fa, 학교: 0x3b82f6, 마트: 0xfb923c, 병원: 0xf87171 };

const state = {
  N: 25,
  buildings: [],
  roads: new Set(),
  counter: 1,
  undoStack: [],
  palType: '집',
  palEmoji: '🏠',
  tool: 'build',
};

const cv = document.getElementById('cv');
let renderer, scene, camera, controls, ground, gridHelper, buildingGroup, roadGroup, hoverMesh, sun;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let down = null, moved = false, painting = false;

function num(id) { return Math.max(1, parseInt(document.getElementById(id).value) || 1); }

try { init(); }
catch (e) { console.error(e); document.getElementById('err').style.display = 'flex'; }

function init() {
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9bd3ec);

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 5;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7a52, 0.85));
  sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  buildingGroup = new THREE.Group();
  roadGroup = new THREE.Group();
  scene.add(buildingGroup, roadGroup);

  hoverMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.2, 1),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.35 })
  );
  hoverMesh.visible = false;
  scene.add(hoverMesh);

  buildScene();
  load();
  resetView();

  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

  wireUI(api);
  animate();
}

function buildScene() {
  const N = state.N;
  if (ground) { scene.remove(ground); ground.geometry.dispose(); }
  if (gridHelper) scene.remove(gridHelper);

  const g = new THREE.PlaneGeometry(N, N);
  g.rotateX(-Math.PI / 2);
  ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x7fae5a }));
  ground.receiveShadow = true;
  scene.add(ground);

  gridHelper = new THREE.GridHelper(N, N, 0x2f4030, 0x3a5040);
  gridHelper.position.y = 0.01;
  scene.add(gridHelper);

  const sc = sun.shadow.camera;
  sc.left = -N; sc.right = N; sc.top = N; sc.bottom = -N; sc.near = 1; sc.far = N * 4;
  sc.updateProjectionMatrix();
  sun.position.set(N * 0.6, N * 1.4, N * 0.4);

  scene.fog = new THREE.Fog(0x9bd3ec, N * 1.6, N * 4.2);
}

function emojiTexture(emoji, hex) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#' + hex.toString(16).padStart(6, '0');
  x.fillRect(0, 0, 128, 128);
  x.font = '86px serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(emoji, 64, 72);
  return new THREE.CanvasTexture(c);
}

function buildingMats(type, emoji) {
  const col = TYPECOLOR[type];
  const side = new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 });
  const top = new THREE.MeshStandardMaterial({ map: emojiTexture(emoji, col), roughness: 0.8 });
  return [side, side, top, side, side, side];
}

const w2x = (col, w) => (col + w / 2) - state.N / 2;
const w2z = (row, d) => (row + d / 2) - state.N / 2;

function rebuildBuildings() {
  buildingGroup.clear();
  for (const b of state.buildings) {
    const geo = new THREE.BoxGeometry(b.w * 0.96, b.h, b.d * 0.96);
    const m = new THREE.Mesh(geo, buildingMats(b.type, b.emoji));
    m.castShadow = true; m.receiveShadow = true;
    m.position.set(w2x(b.col, b.w), b.h / 2, w2z(b.row, b.d));
    m.userData.id = b.id;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x10202a })
    );
    m.add(edges);
    buildingGroup.add(m);
  }
}

function rebuildRoads() {
  roadGroup.clear();
  const geo = new THREE.BoxGeometry(0.98, 0.14, 0.98);
  const mat = new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.95 });
  for (const k of state.roads) {
    const [c, r] = k.split(',').map(Number);
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    m.position.set(w2x(c, 1), 0.07, w2z(r, 1));
    roadGroup.add(m);
  }
}

function redraw() { rebuildBuildings(); rebuildRoads(); save(); }

// ---- 입력 처리 ----
function setPointer(e) {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
}
function groundCell() {
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(ground)[0];
  if (!hit) return null;
  const col = Math.floor(hit.point.x + state.N / 2);
  const row = Math.floor(hit.point.z + state.N / 2);
  if (col < 0 || col >= state.N || row < 0 || row >= state.N) return null;
  return { col, row };
}
function buildingHit() {
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(buildingGroup.children, true)[0];
  if (!hit) return null;
  let o = hit.object;
  while (o && o.userData.id === undefined) o = o.parent;
  return o ? o.userData.id : null;
}

function onDown(e) {
  down = { x: e.clientX, y: e.clientY, b: e.button };
  moved = false;
  if (state.tool === 'road' && e.button === 0) {
    controls.enabled = false; painting = true; setPointer(e); paintRoad();
  }
}
function onMove(e) {
  setPointer(e);
  if (down) {
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (dx * dx + dy * dy > 30) moved = true;
  }
  if (painting) paintRoad();
  const c = groundCell();
  document.getElementById('cell').textContent = c ? `${c.col},${c.row}` : '-';
  if (c) {
    hoverMesh.visible = true;
    const w = state.tool === 'build' ? num('bw') : 1;
    const d = state.tool === 'build' ? num('bd') : 1;
    hoverMesh.scale.set(w, 1, d);
    hoverMesh.position.set(w2x(c.col, w), 0.12, w2z(c.row, d));
  } else hoverMesh.visible = false;
}
function onUp(e) {
  controls.enabled = true;
  painting = false;
  if (down && !moved) {
    if (e.button === 2 || state.tool === 'erase') {
      const id = buildingHit();
      if (id != null) { pushHist(); state.buildings = state.buildings.filter((b) => b.id !== id); redraw(); }
      else { const c = groundCell(); if (c && state.roads.delete(c.col + ',' + c.row)) { pushHist(); redraw(); } }
    } else if (state.tool === 'build') {
      const c = groundCell();
      if (c) {
        pushHist();
        const w = Math.min(num('bw'), state.N - c.col);
        const d = Math.min(num('bd'), state.N - c.row);
        state.buildings.push({ id: state.counter++, type: state.palType, emoji: state.palEmoji, col: c.col, row: c.row, w, d, h: num('bh') });
        redraw();
      }
    } else if (state.tool === 'road') {
      setPointer(e); paintRoad();
    }
  }
  down = null;
}
function paintRoad() {
  const c = groundCell();
  if (!c) return;
  const k = c.col + ',' + c.row;
  if (!state.roads.has(k)) {
    if (!painting || state.roads.size === 0) pushHist();
    state.roads.add(k); redraw();
  }
}

// ---- 상태 / 저장 ----
function snap() { return JSON.stringify({ buildings: state.buildings, roads: [...state.roads], counter: state.counter, N: state.N }); }
function pushHist() { state.undoStack.push(snap()); if (state.undoStack.length > 50) state.undoStack.shift(); }
function restore(s) {
  const o = JSON.parse(s);
  state.buildings = o.buildings; state.roads = new Set(o.roads); state.counter = o.counter;
  if (o.N && o.N !== state.N) { state.N = o.N; document.getElementById('gridN').value = state.N; buildScene(); }
  redraw();
}
function save() { localStorage.setItem('dongne3d', snap()); }
function load() {
  const s = localStorage.getItem('dongne3d');
  if (s) { try { restore(s); } catch (e) { rebuildBuildings(); rebuildRoads(); } }
  else { rebuildBuildings(); rebuildRoads(); }
}

function resetView() { camera.position.set(state.N * 0.85, state.N * 0.9, state.N * 0.95); controls.target.set(0, 0, 0); controls.update(); }
function topView() { camera.position.set(0.01, state.N * 1.4, 0.01); controls.target.set(0, 0, 0); controls.update(); }

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }

// ---- UI에 노출하는 API ----
const api = {
  setBuilding(type, emoji) { state.palType = type; state.palEmoji = emoji; state.tool = 'build'; },
  setTool(t) { state.tool = t; },
  setGrid(n) { state.N = Math.max(8, Math.min(48, n || 25)); buildScene(); redraw(); resetView(); },
  topView, resetView,
  undo() { const s = state.undoStack.pop(); if (s) restore(s); },
  clear() { pushHist(); state.buildings = []; state.roads = new Set(); state.counter = 1; redraw(); },
  png() { renderer.render(scene, camera); const a = document.createElement('a'); a.download = '우리동네_3D.png'; a.href = cv.toDataURL(); a.click(); },
};
