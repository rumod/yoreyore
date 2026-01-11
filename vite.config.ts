
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // GitHub Pages 하위 경로 대응을 위해 상대 경로 설정
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});
