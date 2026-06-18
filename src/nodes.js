// 노드 그래프 추상화 뷰(③단계) — 자동.
// 건물 = 동일 크기 동그라미(노드). 건물끼리 최단거리 직선을 자동으로 긋고,
// 두 선이 교차하는 곳에는 '갈림길' 노드를 자동으로 추가한다. (건물 크기는 무시)
const NODE_COLOR = '#38bdf8';   // 건물 노드
const JUNC_COLOR = '#f59e0b';   // 갈림길 노드

export function createNodes(refs) {
  const { state } = refs;
  const cv = document.getElementById('cvnode');
  const ctx = cv.getContext('2d');
  let cell = 24, ox = 0, oy = 0;

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

  // 두 선분(grid 좌표)의 교차점. 내부에서 만나면 점, 아니면 null.
  function segInt(a, b, c, d) {
    const d1c = b.c - a.c, d1r = b.r - a.r, d2c = d.c - c.c, d2r = d.r - c.r;
    const den = d1c * d2r - d1r * d2c;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((c.c - a.c) * d2r - (c.r - a.r) * d2c) / den;
    const u = ((c.c - a.c) * d1r - (c.r - a.r) * d1c) / den;
    if (t > 0 && t < 1 && u > 0 && u < 1) return { c: a.c + t * d1c, r: a.r + t * d1r };
    return null;
  }

  function render() {
    layout();
    ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, cv.width, cv.height);
    const bs = state.buildings;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    if (bs.length < 2) {
      ctx.fillStyle = '#64748b'; ctx.font = '15px 맑은 고딕';
      ctx.fillText('🧊3D / 🟦2D에서 건물을 2개 이상 세우면 자동으로 이어집니다.', cv.width / 2, cv.height / 2);
      return;
    }

    const ctr = bs.map(center);
    // 모든 건물 쌍 = 선분
    const segs = [];
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) segs.push([i, j]);

    // 1) 최단거리 선 + 거리
    ctx.lineWidth = 2; ctx.strokeStyle = '#475569';
    segs.forEach(([i, j]) => {
      const a = ctr[i], b = ctr[j];
      ctx.beginPath(); ctx.moveTo(px(a.c), py(a.r)); ctx.lineTo(px(b.c), py(b.r)); ctx.stroke();
      const dd = Math.round(Math.hypot(a.c - b.c, a.r - b.r));
      const mx = (px(a.c) + px(b.c)) / 2, my = (py(a.r) + py(b.r)) / 2, t = dd + '칸';
      ctx.font = '11px 맑은 고딕'; const w = ctx.measureText(t).width + 6;
      ctx.fillStyle = '#0b1020'; ctx.fillRect(mx - w / 2, my - 8, w, 16);
      ctx.fillStyle = '#94a3b8'; ctx.fillText(t, mx, my);
    });

    // 2) 선이 교차하는 곳 = 갈림길 노드(자동)
    const junc = [];
    for (let s = 0; s < segs.length; s++) for (let u = s + 1; u < segs.length; u++) {
      const [i, j] = segs[s], [k, l] = segs[u];
      if (i === k || i === l || j === k || j === l) continue; // 같은 건물 공유 → 제외
      const p = segInt(ctr[i], ctr[j], ctr[k], ctr[l]);
      if (p && !junc.some((q) => Math.abs(q.c - p.c) < 0.4 && Math.abs(q.r - p.r) < 0.4)) junc.push(p);
    }
    junc.forEach((p) => {
      ctx.beginPath(); ctx.arc(px(p.c), py(p.r), 6, 0, 7);
      ctx.fillStyle = JUNC_COLOR; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#0b1020'; ctx.stroke();
    });

    // 3) 건물 노드(동일 크기 동그라미)
    bs.forEach((b, idx) => {
      const a = ctr[idx];
      ctx.beginPath(); ctx.arc(px(a.c), py(a.r), 14, 0, 7);
      ctx.fillStyle = NODE_COLOR; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#0b1020'; ctx.stroke();
      ctx.fillStyle = '#cbd5e1'; ctx.font = '11px 맑은 고딕'; ctx.textBaseline = 'top';
      ctx.fillText(b.type, px(a.c), py(a.r) + 18);
      ctx.textBaseline = 'middle';
    });

    // 범례
    ctx.textAlign = 'left'; ctx.font = '12px 맑은 고딕';
    ctx.fillStyle = NODE_COLOR; ctx.beginPath(); ctx.arc(20, 24, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#cbd5e1'; ctx.fillText('건물', 32, 24);
    ctx.fillStyle = JUNC_COLOR; ctx.beginPath(); ctx.arc(80, 24, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#cbd5e1'; ctx.fillText('갈림길', 90, 24);
    ctx.textAlign = 'center';
  }

  window.addEventListener('resize', () => { if (cv.style.display !== 'none') resize(); });

  return {
    show() { cv.style.display = 'block'; resize(); },
    hide() { cv.style.display = 'none'; },
    render,
  };
}
