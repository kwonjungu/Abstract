// 2D 평면 추상화 뷰/에디터.
// 3D와 같은 state(건물·길)를 공유하며, 높이를 버린 납작한 2D로 그린다 = 추상화 ②단계.
const COLOR = { 집: '#f6ad55', 건물: '#60a5fa', 학교: '#3b82f6', 마트: '#fb923c', 병원: '#f87171' };

export function createTwoD(refs) {
  const { state, num } = refs;
  const cv = document.getElementById('cv2d');
  const ctx = cv.getContext('2d');
  let cell = 24, ox = 0, oy = 0;
  let hover = null, painting = false;

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
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function render() {
    layout();
    ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, cv.width, cv.height);
    // 격자 + 길
    for (let r = 0; r < state.N; r++) for (let c = 0; c < state.N; c++) {
      ctx.fillStyle = state.roads.has(c + ',' + r) ? '#15151c' : ((c + r) % 2 ? '#13203a' : '#162542');
      ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
      ctx.strokeStyle = '#0c1830'; ctx.strokeRect(ox + c * cell, oy + r * cell, cell, cell);
    }
    // 좌표 눈금
    ctx.fillStyle = '#64748b'; ctx.font = Math.max(8, Math.floor(cell * 0.42)) + 'px 맑은 고딕';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let c = 0; c < state.N; c++) ctx.fillText(c, ox + c * cell + cell / 2, oy - 13);
    for (let r = 0; r < state.N; r++) ctx.fillText(r, ox - 13, oy + r * cell + cell / 2);
    // 건물(네모로 추상화)
    state.buildings.forEach((b) => {
      const x = ox + b.col * cell, y = oy + b.row * cell, w = b.w * cell, h = b.d * cell;
      ctx.fillStyle = COLOR[b.type] || '#888'; roundRect(x + 2, y + 2, w - 4, h - 4, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#06121b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = Math.min(cell * 1.1, 26) + 'px serif';
      ctx.fillText(b.emoji, x + w / 2, y + h / 2 - (cell > 18 ? 6 : 0));
      if (cell > 16) { ctx.font = '10px 맑은 고딕'; ctx.fillText('(' + b.col + ',' + b.row + ')', x + w / 2, y + h / 2 + cell * 0.42); }
    });
    // 호버(놓을 수 없으면 빨강)
    if (hover) {
      const w = state.tool === 'build' ? Math.min(num('bw'), state.N - hover.col) : 1;
      const d = state.tool === 'build' ? Math.min(num('bd'), state.N - hover.row) : 1;
      const free = state.tool === 'build' ? refs.footprintFree(hover.col, hover.row, w, d)
        : state.tool === 'road' ? !refs.buildingCovers(hover.col, hover.row) : true;
      ctx.fillStyle = free ? 'rgba(34,211,238,.30)' : 'rgba(239,68,68,.40)';
      ctx.fillRect(ox + hover.col * cell, oy + hover.row * cell, w * cell, d * cell);
    }
  }

  // ---- 편집(겹침 방지 공유) ----
  function place(c) {
    if (state.tool === 'build') {
      const w = Math.min(num('bw'), state.N - c.col), d = Math.min(num('bd'), state.N - c.row);
      if (refs.footprintFree(c.col, c.row, w, d)) {
        refs.pushHist();
        state.buildings.push({ id: state.counter++, type: state.palType, emoji: state.palEmoji, col: c.col, row: c.row, w, d, h: num('bh') });
        refs.save();
      }
    } else if (state.tool === 'road') { paint(c); }
    else if (state.tool === 'erase') { erase(c); }
  }
  function paint(c) {
    if (refs.buildingCovers(c.col, c.row)) return;
    const k = c.col + ',' + c.row;
    if (!state.roads.has(k)) { refs.pushHist(); state.roads.add(k); refs.save(); }
  }
  function erase(c) {
    const b = state.buildings.find((b) => c.col >= b.col && c.col < b.col + b.w && c.row >= b.row && c.row < b.row + b.d);
    if (b) { refs.pushHist(); state.buildings = state.buildings.filter((x) => x !== b); refs.save(); return; }
    const k = c.col + ',' + c.row;
    if (state.roads.has(k)) { refs.pushHist(); state.roads.delete(k); refs.save(); }
  }

  cv.addEventListener('pointerdown', (e) => {
    const c = cellOf(e); if (!c) return;
    if (e.button === 2 || state.tool === 'erase') { erase(c); render(); return; }
    if (state.tool === 'road') { painting = true; paint(c); }
    else place(c);
    render();
  });
  cv.addEventListener('pointermove', (e) => {
    hover = cellOf(e);
    if (painting && state.tool === 'road' && hover) paint(hover);
    render();
  });
  cv.addEventListener('pointerup', () => { painting = false; });
  cv.addEventListener('pointerleave', () => { hover = null; render(); });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('resize', () => { if (cv.style.display !== 'none') resize(); });

  return {
    show() { cv.style.display = 'block'; resize(); },
    hide() { cv.style.display = 'none'; },
    render,
  };
}
