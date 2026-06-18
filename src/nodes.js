// 노드 그래프 추상화 뷰(③단계).
// 2D 동네를 흐리게 깔고, 학생이 직접 점(노드)을 찍고 두 점을 이어 그래프를 그린다(자동 연결 없음).
// 이은 선에는 격자 거리(가로칸+세로칸, 제곱근 없음)가 자동 표시된다.
const TYPECOLOR = { 집: '#f6ad55', 건물: '#60a5fa', 학교: '#3b82f6', 마트: '#fb923c', 병원: '#f87171' };

export function createNodes(refs) {
  const { state } = refs;
  const cv = document.getElementById('cvnode');
  const ctx = cv.getContext('2d');
  let cell = 24, ox = 0, oy = 0;
  let hover = null, pending = null; // pending = 연결 시작 노드 id

  function layout() {
    const pad = 90;
    cell = Math.max(8, Math.floor(Math.min((cv.width - pad) / state.N, (cv.height - pad) / state.N)));
    const g = cell * state.N;
    ox = Math.floor((cv.width - g) / 2);
    oy = Math.floor((cv.height - g) / 2) + 8;
  }
  function resize() { cv.width = window.innerWidth; cv.height = window.innerHeight; render(); }
  function cellOf(e) {
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) * cv.width / r.width;
    const y = (e.clientY - r.top) * cv.height / r.height;
    const col = Math.floor((x - ox) / cell), row = Math.floor((y - oy) / cell);
    if (col < 0 || col >= state.N || row < 0 || row >= state.N) return null;
    return { col, row };
  }
  const px = (c) => ox + c * cell + cell / 2;
  const py = (r) => oy + r * cell + cell / 2;
  const nodeAtCell = (c, r) => state.graphNodes.find((n) => n.col === c && n.row === r);
  const nodeById = (id) => state.graphNodes.find((n) => n.id === id);
  const manh = (a, b) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row);

  function render() {
    layout();
    ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, cv.width, cv.height);
    // 격자 (옅게)
    ctx.strokeStyle = '#16233c';
    for (let i = 0; i <= state.N; i++) {
      ctx.beginPath(); ctx.moveTo(ox + i * cell, oy); ctx.lineTo(ox + i * cell, oy + state.N * cell); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox, oy + i * cell); ctx.lineTo(ox + state.N * cell, oy + i * cell); ctx.stroke();
    }
    // 참고용 동네(흐리게): 길 + 건물
    ctx.globalAlpha = 0.22;
    state.roads.forEach((k) => { const [c, r] = k.split(',').map(Number);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell); });
    state.buildings.forEach((b) => { ctx.fillStyle = TYPECOLOR[b.type] || '#888';
      ctx.fillRect(ox + b.col * cell, oy + b.row * cell, b.w * cell, b.d * cell); });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // 간선(선 + 거리)
    state.graphEdges.forEach((ed) => {
      const a = nodeById(ed.a), b = nodeById(ed.b); if (!a || !b) return;
      ctx.strokeStyle = '#5eead4'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(px(a.col), py(a.row)); ctx.lineTo(px(b.col), py(b.row)); ctx.stroke();
      const mx = (px(a.col) + px(b.col)) / 2, my = (py(a.row) + py(b.row)) / 2;
      const t = manh(a, b) + '칸';
      ctx.font = 'bold 12px 맑은 고딕'; const w = ctx.measureText(t).width + 8;
      ctx.fillStyle = '#0b1020'; ctx.fillRect(mx - w / 2, my - 9, w, 18);
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 1; ctx.strokeRect(mx - w / 2, my - 9, w, 18);
      ctx.fillStyle = '#5eead4'; ctx.fillText(t, mx, my);
    });
    // 연결 대기선
    if (pending != null && hover) { const a = nodeById(pending); if (a) {
      ctx.strokeStyle = 'rgba(94,234,212,.5)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px(a.col), py(a.row)); ctx.lineTo(px(hover.col), py(hover.row)); ctx.stroke();
      ctx.setLineDash([]); } }
    // 노드(점)
    state.graphNodes.forEach((n) => {
      ctx.beginPath(); ctx.arc(px(n.col), py(n.row), 9, 0, 7);
      ctx.fillStyle = n.id === pending ? '#fbbf24' : '#22d3ee'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#0b1020'; ctx.stroke();
      ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 10px 맑은 고딕'; ctx.textBaseline = 'bottom';
      ctx.fillText('N' + n.id, px(n.col), py(n.row) - 11);
    });
  }

  function deleteNode(n) {
    refs.pushHist();
    state.graphNodes = state.graphNodes.filter((x) => x !== n);
    state.graphEdges = state.graphEdges.filter((e) => e.a !== n.id && e.b !== n.id);
    refs.save();
  }

  cv.addEventListener('pointerdown', (e) => {
    const c = cellOf(e); if (!c) return;
    const hit = nodeAtCell(c.col, c.row);
    if (e.button === 2) { if (hit) { deleteNode(hit); pending = null; render(); } return; }
    if (hit) {
      if (pending == null) pending = hit.id;
      else if (pending !== hit.id) {
        const ek = [Math.min(pending, hit.id), Math.max(pending, hit.id)].join('-');
        if (!state.graphEdges.some((x) => [Math.min(x.a, x.b), Math.max(x.a, x.b)].join('-') === ek)) {
          refs.pushHist(); state.graphEdges.push({ a: pending, b: hit.id }); refs.save();
        }
        pending = null;
      } else pending = null;
    } else {
      if (pending != null) pending = null;
      else { refs.pushHist(); state.graphNodes.push({ id: state.graphCounter++, col: c.col, row: c.row }); refs.save(); }
    }
    render();
  });
  cv.addEventListener('pointermove', (e) => { hover = cellOf(e); render(); });
  cv.addEventListener('pointerleave', () => { hover = null; render(); });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('resize', () => { if (cv.style.display !== 'none') resize(); });

  return {
    show() { cv.style.display = 'block'; pending = null; resize(); },
    hide() { cv.style.display = 'none'; pending = null; },
    render,
  };
}
