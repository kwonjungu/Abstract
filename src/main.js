import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { wireUI } from './ui.js';
import { createTwoD } from './twod.js';
import { createNodes } from './nodes.js';

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
  graphNodes: [],
  graphEdges: [],
  graphCounter: 1,
};

const cv = document.getElementById('cv');
let renderer, scene, camera, controls, ground, gridHelper, buildingGroup, roadGroup, hoverMesh, sun;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let down = null, moved = false, painting = false;
let view = '3d', twoD = null, nodeView = null;

function num(id) { return Math.max(1, parseInt(document.getElementById(id).value) || 1); }

function hasWebGL() {
  try { const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); }
  catch (e) { return false; }
}

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

  twoD = createTwoD({ state, num, footprintFree, buildingCovers, pushHist, save });
  nodeView = createNodes({ state, pushHist, save });
  wireUI(api);
  animate();
}

function setView(v) {
  view = v;
  document.querySelectorAll('.vw').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  cv.style.display = v === '3d' ? 'block' : 'none';
  if (v === '2d') twoD.show(); else twoD.hide();
  if (v === 'node') nodeView.show(); else nodeView.hide();
  if (v === '3d') { onResize(); redraw(); }
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

function buildingCovers(col, row) {
  return state.buildings.some((b) => col >= b.col && col < b.col + b.w && row >= b.row && row < b.row + b.d);
}
function footprintFree(col, row, w, d) {
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) {
    if (buildingCovers(col + i, row + j)) return false;
    if (state.roads.has((col + i) + ',' + (row + j))) return false;
  }
  return true;
}
function flashCell(msg) { document.getElementById('cell').textContent = msg; }

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
  if (c) {
    hoverMesh.visible = true;
    const w = state.tool === 'build' ? num('bw') : 1;
    const d = state.tool === 'build' ? num('bd') : 1;
    hoverMesh.scale.set(w, 1, d);
    hoverMesh.position.set(w2x(c.col, w), 0.12, w2z(c.row, d));
    let okSpot = true;
    if (state.tool === 'build') okSpot = footprintFree(c.col, c.row, Math.min(w, state.N - c.col), Math.min(d, state.N - c.row));
    else if (state.tool === 'road') okSpot = !buildingCovers(c.col, c.row);
    hoverMesh.material.color.set(okSpot ? 0x22d3ee : 0xef4444);
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
        const w = Math.min(num('bw'), state.N - c.col);
        const d = Math.min(num('bd'), state.N - c.row);
        if (!footprintFree(c.col, c.row, w, d)) {
          flashCell('⛔ 겹침');
        } else {
          pushHist();
          state.buildings.push({ id: state.counter++, type: state.palType, emoji: state.palEmoji, col: c.col, row: c.row, w, d, h: num('bh') });
          redraw();
        }
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
  if (buildingCovers(c.col, c.row)) return; // 건물 위에는 길을 칠하지 않음
  const k = c.col + ',' + c.row;
  if (!state.roads.has(k)) {
    if (!painting || state.roads.size === 0) pushHist();
    state.roads.add(k); redraw();
  }
}

// ---- 상태 / 저장 ----
function snap() { return JSON.stringify({ buildings: state.buildings, roads: [...state.roads], counter: state.counter, N: state.N, graphNodes: state.graphNodes, graphEdges: state.graphEdges, graphCounter: state.graphCounter }); }
function pushHist() { state.undoStack.push(snap()); if (state.undoStack.length > 50) state.undoStack.shift(); }
function restore(s) {
  const o = JSON.parse(s);
  state.buildings = o.buildings; state.roads = new Set(o.roads); state.counter = o.counter;
  state.graphNodes = o.graphNodes || []; state.graphEdges = o.graphEdges || []; state.graphCounter = o.graphCounter || 1;
  if (o.N && o.N !== state.N) { state.N = o.N; document.getElementById('gridN').value = state.N; buildScene(); }
  redraw();
  if (view === '2d' && twoD) twoD.render();
  if (view === 'node' && nodeView) nodeView.render();
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
  setGrid(n) { state.N = Math.max(8, Math.min(48, n || 25)); buildScene(); redraw(); resetView(); if (view === '2d') twoD.render(); if (view === 'node') nodeView.render(); },
  setView,
  topView, resetView,
  undo() { const s = state.undoStack.pop(); if (s) restore(s); },
  clear() {
    pushHist();
    state.buildings = []; state.roads = new Set(); state.counter = 1;
    state.graphNodes = []; state.graphEdges = []; state.graphCounter = 1;
    redraw(); if (view === '2d') twoD.render(); if (view === 'node') nodeView.render();
  },
  png() {
    const id = view === '2d' ? 'cv2d' : view === 'node' ? 'cvnode' : null;
    if (id) { const a = document.createElement('a'); a.download = '우리동네_' + view + '.png'; a.href = document.getElementById(id).toDataURL(); a.click(); return; }
    renderer.render(scene, camera); const a = document.createElement('a'); a.download = '우리동네_3D.png'; a.href = cv.toDataURL(); a.click();
  },
  csv() {
    // 노드(건물)의 위치만 반올림하여 저장
    let s = '이름,가로,세로\n';
    state.buildings.forEach((b) => {
      const x = Math.round(b.col + (b.w - 1) / 2);
      const y = Math.round(b.row + (b.d - 1) / 2);
      s += `${b.name && b.name.length ? b.name : b.type},${x},${y}\n`;
    });
    const a = document.createElement('a');
    a.download = '노드_위치.csv';
    a.href = 'data:text/csv;charset=utf-8,﻿' + encodeURIComponent(s);
    a.click();
  },
};

// ---- 부팅 (모든 선언 이후에 호출해야 TDZ 오류가 없음) ----
if (!hasWebGL()) {
  const el = document.getElementById('err');
  el.style.display = 'flex';
  el.textContent = 'WebGL을 사용할 수 없는 환경입니다. 브라우저의 하드웨어 가속을 켜거나 다른 브라우저에서 열어주세요.';
} else {
  try {
    init();
  } catch (e) {
    console.error(e);
    const el = document.getElementById('err');
    el.style.display = 'flex';
    el.innerHTML = '실행 중 오류가 발생했습니다.<br><small style="opacity:.8">' + (e && e.message ? e.message : e) + '</small>';
  }
}
