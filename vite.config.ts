import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages 하위 경로 대응을 위해 상대 경로 설정
  base: './', 
  define: {
    // 빌드 타임에 환경 변수 주입 및 객체 정의
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    'process.env': { env: { API_KEY: "" } }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    sourcemap: false
  },
  server: {
    port: 3000
  }
});