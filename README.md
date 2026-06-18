# 우리 동네 3D 추상화 스튜디오

초등 5~6학년 AI·SW 교과 융합 수업용 **3D 동네 만들기 도구**. 학생이 빈 격자 위에 건물·길을 세워 자기 동네를 추상화하고, 3D → 평면 → (노드)로 점점 단순화하며 추상화의 본질을 체험한다.

## 기술
- [Three.js](https://threejs.org/) (WebGL 3D)
- [Vite](https://vitejs.dev/) 번들러

## 실행
```bash
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 배포 빌드 → dist/
npm run preview  # 빌드 결과 미리보기
```

## 기능
- 🧱 건물 짓기 — 종류(집·건물·학교·마트·병원), 크기(가로×세로 칸), 높이(층) 지정
- 🛣️ 길 칠하기 — 클릭/드래그로 검정 도로 직접 그리기
- 🧽 지우기 · ↶ 실행취소 · 🖼️ 그림 저장 · 자동 저장(localStorage)
- 🔄 드래그 회전 · 휠 확대 · ⬇️ 평면(top) 시점
- 격자 크기 8~48칸 조절

## 교육 의도
"무엇을 버릴지 결정하는 것"이 추상화다. 나무·간판 같은 디테일을 버리고 집·건물·길만 남기며,
3D(디지털 트윈) → 평면 → 노드 그래프로 단계적으로 추상화한다.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
