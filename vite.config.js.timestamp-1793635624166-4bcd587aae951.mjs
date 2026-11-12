// vite.config.js
import { defineConfig } from "file:///K:/Documents/Projects/Account_plan/node_modules/vite/dist/node/index.js";
import react from "file:///K:/Documents/Projects/Account_plan/node_modules/@vitejs/plugin-react/dist/index.js";
import { viteSingleFile } from "file:///K:/Documents/Projects/Account_plan/node_modules/vite-plugin-singlefile/dist/esm/index.js";
import path from "path";
var vite_config_default = defineConfig(({ command, mode }) => {
  const isDevServer = command === "serve";
  const isMockPreview = mode === "mock";
  return {
    plugins: [react(), viteSingleFile()],
    base: "./",
    resolve: {
      alias: {
        // Dev keeps Salesforce-shaped fixtures for local work. Production
        // builds replace them with an empty module so deployable zips are
        // live-data-only and do not carry mock account records.
        "@/lib/mockData/mockAdapter": path.resolve(
          process.cwd(),
          isDevServer || isMockPreview ? "src/lib/mockData/mockAdapter.js" : "src/lib/dataservice/mockAdapter.live.js"
        ),
        "@": path.resolve(process.cwd(), "src")
      }
    },
    build: {
      outDir: "dist",
      // es2022 so the inlined pdf.js worker (top-level await + module worker)
      // builds. Supported on the Safari 15+/iPadOS the Veeva client runs.
      target: "es2022",
      emptyOutDir: true,
      assetsInlineLimit: 1e8,
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          inlineDynamicImports: true
        }
      }
    },
    worker: {
      format: "es"
    },
    esbuild: {
      target: "es2022"
    },
    optimizeDeps: {
      esbuildOptions: {
        target: "es2022"
      }
    },
    server: {
      port: 5173,
      open: true,
      watch: {
        usePolling: true,
        interval: 1e3
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJLOlxcXFxEb2N1bWVudHNcXFxcUHJvamVjdHNcXFxcQWNjb3VudF9wbGFuXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJLOlxcXFxEb2N1bWVudHNcXFxcUHJvamVjdHNcXFxcQWNjb3VudF9wbGFuXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9LOi9Eb2N1bWVudHMvUHJvamVjdHMvQWNjb3VudF9wbGFuL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XHJcbmltcG9ydCB7IHZpdGVTaW5nbGVGaWxlIH0gZnJvbSAndml0ZS1wbHVnaW4tc2luZ2xlZmlsZSc7XHJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xyXG5cclxuLy8gYGJhc2U6ICcuLydgIGtlZXBzIGV2ZXJ5IFVSTCByZWxhdGl2ZSBcdTIwMTQgVmVldmEgTXlJbnNpZ2h0cyBzZXJ2ZXMgdGhlIGJ1bmRsZVxyXG4vLyBmcm9tIGFuIHVua25vd24gQ0ROIHBhdGguIGB2aXRlU2luZ2xlRmlsZWAgaW5saW5lcyBhbGwgSlMvQ1NTIGNodW5rcyBpbnRvXHJcbi8vIHRoZSBmaW5hbCBpbmRleC5odG1sIHNvIHRoZSBvbmx5IHRoaW5nIFZlZXZhIG5lZWRzIGlzIHRoZSBaSVAgd2UgYnVpbGQgaW5cclxuLy8gc2NyaXB0cy9wb3N0YnVpbGQubWpzLlxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgY29tbWFuZCwgbW9kZSB9KSA9PiB7XHJcbiAgY29uc3QgaXNEZXZTZXJ2ZXIgPSBjb21tYW5kID09PSAnc2VydmUnO1xyXG4gIGNvbnN0IGlzTW9ja1ByZXZpZXcgPSBtb2RlID09PSAnbW9jayc7XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICBwbHVnaW5zOiBbcmVhY3QoKSwgdml0ZVNpbmdsZUZpbGUoKV0sXHJcbiAgICBiYXNlOiAnLi8nLFxyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICBhbGlhczoge1xyXG4gICAgICAgIC8vIERldiBrZWVwcyBTYWxlc2ZvcmNlLXNoYXBlZCBmaXh0dXJlcyBmb3IgbG9jYWwgd29yay4gUHJvZHVjdGlvblxyXG4gICAgICAgIC8vIGJ1aWxkcyByZXBsYWNlIHRoZW0gd2l0aCBhbiBlbXB0eSBtb2R1bGUgc28gZGVwbG95YWJsZSB6aXBzIGFyZVxyXG4gICAgICAgIC8vIGxpdmUtZGF0YS1vbmx5IGFuZCBkbyBub3QgY2FycnkgbW9jayBhY2NvdW50IHJlY29yZHMuXHJcbiAgICAgICAgJ0AvbGliL21vY2tEYXRhL21vY2tBZGFwdGVyJzogcGF0aC5yZXNvbHZlKFxyXG4gICAgICAgICAgcHJvY2Vzcy5jd2QoKSxcclxuICAgICAgICAgIGlzRGV2U2VydmVyIHx8IGlzTW9ja1ByZXZpZXdcclxuICAgICAgICAgICAgPyAnc3JjL2xpYi9tb2NrRGF0YS9tb2NrQWRhcHRlci5qcydcclxuICAgICAgICAgICAgOiAnc3JjL2xpYi9kYXRhc2VydmljZS9tb2NrQWRhcHRlci5saXZlLmpzJ1xyXG4gICAgICAgICksXHJcbiAgICAgICAgJ0AnOiBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgJ3NyYycpLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICAgIGJ1aWxkOiB7XHJcbiAgICAgIG91dERpcjogJ2Rpc3QnLFxyXG4gICAgICAvLyBlczIwMjIgc28gdGhlIGlubGluZWQgcGRmLmpzIHdvcmtlciAodG9wLWxldmVsIGF3YWl0ICsgbW9kdWxlIHdvcmtlcilcclxuICAgICAgLy8gYnVpbGRzLiBTdXBwb3J0ZWQgb24gdGhlIFNhZmFyaSAxNSsvaVBhZE9TIHRoZSBWZWV2YSBjbGllbnQgcnVucy5cclxuICAgICAgdGFyZ2V0OiAnZXMyMDIyJyxcclxuICAgICAgZW1wdHlPdXREaXI6IHRydWUsXHJcbiAgICAgIGFzc2V0c0lubGluZUxpbWl0OiAxMDAwMDAwMDAsXHJcbiAgICAgIGNzc0NvZGVTcGxpdDogZmFsc2UsXHJcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAgIGlubGluZUR5bmFtaWNJbXBvcnRzOiB0cnVlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgd29ya2VyOiB7XHJcbiAgICAgIGZvcm1hdDogJ2VzJyxcclxuICAgIH0sXHJcbiAgICBlc2J1aWxkOiB7XHJcbiAgICAgIHRhcmdldDogJ2VzMjAyMicsXHJcbiAgICB9LFxyXG4gICAgb3B0aW1pemVEZXBzOiB7XHJcbiAgICAgIGVzYnVpbGRPcHRpb25zOiB7XHJcbiAgICAgICAgdGFyZ2V0OiAnZXMyMDIyJyxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgcG9ydDogNTE3MyxcclxuICAgICAgb3BlbjogdHJ1ZSxcclxuICAgICAgIHdhdGNoOiB7XHJcbiAgICAgICAgdXNlUG9sbGluZzogdHJ1ZSxcclxuICAgICAgICBpbnRlcnZhbDogMTAwMFxyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgfTtcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBZ1MsU0FBUyxvQkFBb0I7QUFDN1QsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsc0JBQXNCO0FBQy9CLE9BQU8sVUFBVTtBQU1qQixJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLFNBQVMsS0FBSyxNQUFNO0FBQ2pELFFBQU0sY0FBYyxZQUFZO0FBQ2hDLFFBQU0sZ0JBQWdCLFNBQVM7QUFFL0IsU0FBTztBQUFBLElBQ0wsU0FBUyxDQUFDLE1BQU0sR0FBRyxlQUFlLENBQUM7QUFBQSxJQUNuQyxNQUFNO0FBQUEsSUFDTixTQUFTO0FBQUEsTUFDUCxPQUFPO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFJTCw4QkFBOEIsS0FBSztBQUFBLFVBQ2pDLFFBQVEsSUFBSTtBQUFBLFVBQ1osZUFBZSxnQkFDWCxvQ0FDQTtBQUFBLFFBQ047QUFBQSxRQUNBLEtBQUssS0FBSyxRQUFRLFFBQVEsSUFBSSxHQUFHLEtBQUs7QUFBQSxNQUN4QztBQUFBLElBQ0Y7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQTtBQUFBO0FBQUEsTUFHUixRQUFRO0FBQUEsTUFDUixhQUFhO0FBQUEsTUFDYixtQkFBbUI7QUFBQSxNQUNuQixjQUFjO0FBQUEsTUFDZCxlQUFlO0FBQUEsUUFDYixRQUFRO0FBQUEsVUFDTixzQkFBc0I7QUFBQSxRQUN4QjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTixRQUFRO0FBQUEsSUFDVjtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsUUFBUTtBQUFBLElBQ1Y7QUFBQSxJQUNBLGNBQWM7QUFBQSxNQUNaLGdCQUFnQjtBQUFBLFFBQ2QsUUFBUTtBQUFBLE1BQ1Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTCxPQUFPO0FBQUEsUUFDTixZQUFZO0FBQUEsUUFDWixVQUFVO0FBQUEsTUFDVjtBQUFBLElBQ0o7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
