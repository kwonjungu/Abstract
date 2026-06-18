// 노드 그래프 추상화 뷰(③단계).
// 흐린 동네(건물·길)를 배경으로 깔고, 학생이 점(노드)을 직접 찍어 잇는다.
// 노드 = 동그라미(N1, N2 …), 꾹 누르면 이름 편집. 선에는 두 노드 사이 거리(칸)가 표시된다.
const TYPECOLOR = { 집: '#f6ad55', 건물: '#60a5fa', 학교: '#3b82f6', 마트: '#fb923c', 병원: '#f87171' };
const NODE_COLOR = '#22d3ee', EDGE_COLOR = '#22d3ee';

export function createNodes(refs) {
  const { state } = refs;
  const cv = document.getElementById('cvnode');
  const ctx = cv.getContext('2d');
  let cell = 24, ox = 0, oy = 0;
  let hover = null, pending = null;
  let pressTimer = null, longFired = false, downPos = null;

  function layout() {
    const pad = 90;
    cell = Math.max(8, Math.floor(Math.min((cv.width - pad) / state.N, (cv.height - pad) / state.N)));
    const g = cell * state.N;
    ox = Math.floor((cv.width - g) / 2);
    oy = Math.floor((cv.height - g) / 2) + 8;
  }
  function resize() { cv.width = window.innerWidth; cv.height = window.innerHeight; render(); }

  const px = (c) => ox + c * cell + cell / 2;
  const py = (r) => oy + r * cell + cell / 2;
  const nodeById = (id) => state.graphNodes.find((n) => n.id === id);
  const manh = (a, b) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
  const label = (n) => (n.name && n.name.length ? n.name : 'N' + n.id);

  function screenPos(e) { const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; }
  function cellOf(e) { const s = screenPos(e);
    const col = Math.floor((s.x - ox) / cell), row = Math.floor((s.y - oy) / cell);
    if (col < 0 || col >= state.N || row < 0 || row >= state.N) return null; return { col, row }; }
  function nodeAtScreen(sx, sy) {
    for (const n of state.graphNodes) if ((sx - px(n.col)) ** 2 + (sy - py(n.row)) ** 2 <= 16 * 16) return n;
    return null;
  }

  function toggleEdge(a, b) {
    refs.pushHist();
    const i = state.graphEdges.findIndex((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
    if (i >= 0) state.graphEdges.splice(i, 1); else state.graphEdges.push({ a, b });
    refs.save();
  }
  function deleteNode(n) {
    refs.pushHist();
    state.graphNodes = state.graphNodes.filter((x) => x !== n);
    state.graphEdges = state.graphEdges.filter((e) => e.a !== n.id && e.b !== n.id);
    refs.save();
  }
  function editName(n) {
    const v = window.prompt('노드 이름을 입력하세요', label(n));
    if (v !== null) { refs.pushHist(); n.name = v.trim(); refs.save(); render(); }
  }

  function render() {
    layout();
    ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, cv.width, cv.height);
    // 옅은 격자
    ctx.strokeStyle = '#16233c'; ctx.lineWidth = 1;
    for (let i = 0; i <= state.N; i++) {
      ctx.beginPath(); ctx.moveTo(ox + i * cell, oy); ctx.lineTo(ox + i * cell, oy + state.N * cell); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox, oy + i * cell); ctx.lineTo(ox + state.N * cell, oy + i * cell); ctx.stroke();
    }
    // 흐린 동네(참고용 배경)
    ctx.globalAlpha = 0.22;
    state.roads.forEach((k) => { const [c, r] = k.split(',').map(Number); ctx.fillStyle = '#94a3b8'; ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell); });
    state.buildings.forEach((b) => { ctx.fillStyle = TYPECOLOR[b.type] || '#888'; ctx.fillRect(ox + b.col * cell, oy + b.row * cell, b.w * cell, b.d * cell); });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // 간선(선 + 거리)
    state.graphEdges.forEach((ed) => {
      const a = nodeById(ed.a), b = nodeById(ed.b); if (!a || !b) return;
      ctx.strokeStyle = EDGE_COLOR; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(px(a.col), py(a.row)); ctx.lineTo(px(b.col), py(b.row)); ctx.stroke();
      const mx = (px(a.col) + px(b.col)) / 2, my = (py(a.row) + py(b.row)) / 2, t = manh(a, b) + '칸';
      ctx.font = 'bold 12px 맑은 고딕'; const w = ctx.measureText(t).width + 10;
      ctx.fillStyle = '#0b1020'; ctx.fillRect(mx - w / 2, my - 10, w, 20);
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 1; ctx.strokeRect(mx - w / 2, my - 10, w, 20);
      ctx.fillStyle = EDGE_COLOR; ctx.fillText(t, mx, my);
    });

    // 연결 대기선
    if (pending != null && hover) { const a = nodeById(pending); if (a) {
      ctx.strokeStyle = 'rgba(34,211,238,.6)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px(a.col), py(a.row)); ctx.lineTo(hover.x, hover.y); ctx.stroke(); ctx.setLineDash([]); } }

    // 노드(동그라미 + 이름)
    state.graphNodes.forEach((n) => {
      ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 11px 맑은 고딕'; ctx.textBaseline = 'bottom';
      ctx.fillText(label(n), px(n.col), py(n.row) - 12);
      ctx.beginPath(); ctx.arc(px(n.col), py(n.row), 9, 0, 7);
      ctx.fillStyle = n.id === pending ? '#fbbf24' : NODE_COLOR; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#0b1020'; ctx.stroke();
      ctx.textBaseline = 'middle';
    });

    if (state.graphNodes.length === 0) {
      ctx.fillStyle = '#64748b'; ctx.font = '14px 맑은 고딕';
      ctx.fillText('빈 칸을 클릭해 점을 찍고, 두 점을 클릭해 이으세요. 점을 꾹 누르면 이름 편집.', cv.width / 2, oy - 30);
    }
  }

  cv.addEventListener('pointermove', (e) => {
    hover = screenPos(e);
    if (pressTimer && downPos) { const dx = hover.x - downPos.x, dy = hover.y - downPos.y;
      if (dx * dx + dy * dy > 25) { clearTimeout(pressTimer); pressTimer = null; } }
    render();
  });
  cv.addEventListener('pointerleave', () => { hover = null; if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } render(); });
  cv.addEventListener('pointerdown', (e) => {
    const s = screenPos(e); downPos = s; longFired = false;
    const n = nodeAtScreen(s.x, s.y);
    if (e.button === 2) { if (n) deleteNode(n); pending = null; render(); return; }
    if (n) pressTimer = setTimeout(() => { longFired = true; pressTimer = null; editName(n); }, 500); // 꾹 누르면 이름 편집
  });
  cv.addEventListener('pointerup', (e) => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    if (longFired) { longFired = false; return; }
    if (e.button === 2) return;
    const s = screenPos(e); const n = nodeAtScreen(s.x, s.y);
    if (n) {
      if (pending == null) pending = n.id;
      else if (pending !== n.id) { toggleEdge(pending, n.id); pending = null; }
      else pending = null;
    } else {
      const c = cellOf(e);
      if (c) { if (pending != null) pending = null;
        else { refs.pushHist(); state.graphNodes.push({ id: state.graphCounter++, col: c.col, row: c.row }); refs.save(); } }
    }
    render();
  });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('resize', () => { if (cv.style.display !== 'none') resize(); });

  return {
    show() { cv.style.display = 'block'; pending = null; resize(); },
    hide() { cv.style.display = 'none'; pending = null; },
    render,
  };
}
