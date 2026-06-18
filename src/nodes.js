// 노드 그래프 추상화 뷰(③단계).
// 건물 = 단색 동그라미(노드). 학생이 두 건물을 클릭해 직접 잇는다(자동 연결 없음).
// 선에는 두 건물 사이 거리(격자 칸)가 표시된다. 배경은 비워 깔끔한 노드 트리처럼 보이게 한다.
const NODE_COLOR = '#38bdf8';

export function createNodes(refs) {
  const { state } = refs;
  const cv = document.getElementById('cvnode');
  const ctx = cv.getContext('2d');
  let cell = 24, ox = 0, oy = 0;
  let hover = null, pending = null; // pending = 연결 시작 건물 id, hover = {x,y} 화면좌표
  let pressTimer = null, longFired = false, downPos = null; // 길게 누르기(이름 편집)

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
  const center = (b) => ({ c: b.col + (b.w - 1) / 2, r: b.row + (b.d - 1) / 2 });
  const screenOf = (b) => { const m = center(b); return { x: px(m.c), y: py(m.r) }; };
  const byId = (id) => state.buildings.find((b) => b.id === id);
  const dist = (a, b) => { const A = center(a), B = center(b); return Math.round(Math.abs(A.c - B.c) + Math.abs(A.r - B.r)); };

  function screenPos(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height };
  }
  function buildingAt(sx, sy) {
    for (const b of state.buildings) { const p = screenOf(b); if ((sx - p.x) ** 2 + (sy - p.y) ** 2 <= 18 * 18) return b; }
    return null;
  }
  function toggleEdge(a, b) {
    refs.pushHist();
    const i = state.graphEdges.findIndex((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
    if (i >= 0) state.graphEdges.splice(i, 1); else state.graphEdges.push({ a, b });
    refs.save();
  }

  function render() {
    layout();
    ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, cv.width, cv.height);

    if (state.buildings.length === 0) {
      ctx.fillStyle = '#64748b'; ctx.font = '15px 맑은 고딕'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('먼저 🧊3D / 🟦2D에서 건물을 세우면, 여기서 동그라미로 이어집니다.', cv.width / 2, cv.height / 2);
      return;
    }

    // 간선(선 + 거리)
    state.graphEdges.forEach((ed) => {
      const a = byId(ed.a), b = byId(ed.b); if (!a || !b) return;
      const pa = screenOf(a), pb = screenOf(b);
      ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2, t = dist(a, b) + '칸';
      ctx.font = 'bold 12px 맑은 고딕'; const w = ctx.measureText(t).width + 10;
      ctx.fillStyle = '#0b1020'; ctx.fillRect(mx - w / 2, my - 10, w, 20);
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 1; ctx.strokeRect(mx - w / 2, my - 10, w, 20);
      ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, mx, my);
    });

    // 연결 대기선(점선)
    if (pending != null && hover) {
      const a = byId(pending);
      if (a) {
        const pa = screenOf(a);
        ctx.strokeStyle = 'rgba(56,189,248,.6)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(hover.x, hover.y); ctx.stroke(); ctx.setLineDash([]);
      }
    }

    // 노드(단색 동그라미)
    state.buildings.forEach((b) => {
      const p = screenOf(b);
      ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, 7);
      ctx.fillStyle = b.id === pending ? '#fbbf24' : NODE_COLOR; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#0b1020'; ctx.stroke();
      ctx.fillStyle = '#cbd5e1'; ctx.font = '11px 맑은 고딕'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(b.name && b.name.length ? b.name : b.type, p.x, p.y + 18);
    });
  }

  function editName(b) {
    const cur = b.name && b.name.length ? b.name : b.type;
    const v = window.prompt('노드 이름을 입력하세요', cur);
    if (v !== null) { refs.pushHist(); b.name = v.trim(); refs.save(); render(); }
  }

  cv.addEventListener('pointermove', (e) => {
    hover = screenPos(e);
    if (pressTimer && downPos) { const dx = hover.x - downPos.x, dy = hover.y - downPos.y;
      if (dx * dx + dy * dy > 25) { clearTimeout(pressTimer); pressTimer = null; } }
    render();
  });
  cv.addEventListener('pointerleave', () => { hover = null; if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } render(); });
  cv.addEventListener('pointerdown', (e) => {
    const s = screenPos(e); const b = buildingAt(s.x, s.y);
    downPos = s; longFired = false;
    if (e.button === 2) {           // 우클릭: 이 건물의 선 모두 지우기
      if (b) { const kept = state.graphEdges.filter((ed) => ed.a !== b.id && ed.b !== b.id);
        if (kept.length !== state.graphEdges.length) { refs.pushHist(); state.graphEdges = kept; refs.save(); } }
      pending = null; render(); return;
    }
    if (b) { pressTimer = setTimeout(() => { longFired = true; pressTimer = null; editName(b); }, 500); } // 꾹 누르면 이름 편집
  });
  cv.addEventListener('pointerup', (e) => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    if (longFired) { longFired = false; return; }   // 길게 눌러 편집함 → 연결 안 함
    if (e.button === 2) return;
    const s = screenPos(e); const b = buildingAt(s.x, s.y);
    if (b) {
      if (pending == null) pending = b.id;
      else if (pending !== b.id) { toggleEdge(pending, b.id); pending = null; }
      else pending = null;
    } else pending = null;
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
