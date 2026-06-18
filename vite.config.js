import { defineConfig } from 'vite';

// base: './' → 상대경로로 빌드. GitHub Pages(/Abstract/ 하위), Vercel(루트), 로컬 어디서나 자원 로딩됨.
export default defineConfig({
  base: './',
});
