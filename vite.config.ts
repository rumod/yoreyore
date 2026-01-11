import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // GitHub Pages 하위 경로 대응을 위해 상대 경로 설정
  define: {
    // process.env 객체를 정의하여 런타임 에러 방지
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    'process.env': {}
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});