// 툴바 DOM을 main.js가 노출한 api에 연결한다.
export function wireUI(api) {
  const $ = (id) => document.getElementById(id);

  document.querySelectorAll('.pal').forEach((b) =>
    b.addEventListener('click', () => {
      api.setBuilding(b.dataset.type, b.dataset.emoji);
      document.querySelectorAll('.pal').forEach((x) => x.classList.toggle('on', x === b));
      document.querySelectorAll('[data-tool]').forEach((x) => x.classList.toggle('on', x.dataset.tool === 'build'));
    })
  );

  document.querySelectorAll('[data-tool]').forEach((b) =>
    b.addEventListener('click', () => {
      api.setTool(b.dataset.tool);
      document.querySelectorAll('[data-tool]').forEach((x) => x.classList.toggle('on', x === b));
      if (b.dataset.tool !== 'build') document.querySelectorAll('.pal').forEach((x) => x.classList.remove('on'));
    })
  );

  $('gridN').addEventListener('change', (e) => api.setGrid(parseInt(e.target.value)));
  $('topview').addEventListener('click', () => api.topView());
  $('reset').addEventListener('click', () => api.resetView());
  $('undo').addEventListener('click', () => api.undo());
  $('clr').addEventListener('click', () => { if (confirm('전체를 지울까요?')) api.clear(); });
  $('png').addEventListener('click', () => api.png());
}
