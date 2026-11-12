import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

// `base: './'` keeps every URL relative — Veeva MyInsights serves the bundle
// from an unknown CDN path. `viteSingleFile` inlines all JS/CSS chunks into
// the final index.html so the only thing Veeva needs is the ZIP we build in
// scripts/postbuild.mjs.
export default defineConfig(({ command, mode }) => {
  const isDevServer = command === 'serve';
  const isMockPreview = mode === 'mock';

  return {
    plugins: [react(), viteSingleFile()],
    base: './',
    resolve: {
      alias: {
        // Dev keeps Salesforce-shaped fixtures for local work. Production
        // builds replace them with an empty module so deployable zips are
        // live-data-only and do not carry mock account records.
        '@/lib/mockData/mockAdapter': path.resolve(
          process.cwd(),
          isDevServer || isMockPreview
            ? 'src/lib/mockData/mockAdapter.js'
            : 'src/lib/dataservice/mockAdapter.live.js'
        ),
        '@': path.resolve(process.cwd(), 'src'),
      },
    },
    build: {
      outDir: 'dist',
      // es2022 so the inlined pdf.js worker (top-level await + module worker)
      // builds. Supported on the Safari 15+/iPadOS the Veeva client runs.
      target: 'es2022',
      emptyOutDir: true,
      assetsInlineLimit: 100000000,
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
    worker: {
      format: 'es',
    },
    esbuild: {
      target: 'es2022',
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2022',
      },
    },
    server: {
      port: 5173,
      open: true,
       watch: {
        usePolling: true,
        interval: 1000
        }
    },
  };
});
