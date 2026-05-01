import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';
import { defineConfig } from 'vite';

const gitInfo = () => {
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim();
    const date = execSync('git log -1 --format=%cd --date=format:%Y.%m.%d').toString().trim();
    return { hash, date };
  } catch {
    return { hash: 'dev', date: new Date().toISOString().slice(0, 10).replace(/-/g, '.') };
  }
};

export default defineConfig(({ command }) => {
  const { hash, date } = gitInfo();
  return {
    base: command === 'build' ? '/dongast-work-hours-tracker/' : '/',
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(hash),
      __APP_BUILD_DATE__: JSON.stringify(date),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
