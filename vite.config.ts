import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync } from "fs";

// https://vitejs.dev/config/
export default defineConfig(() => {
  const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

  // Removed OpenAI usage proxy as custom analytics is taken out

  return {
    server: {
      host: "::",
      port: 8080,
    },
    define: {
      '__APP_VERSION__': JSON.stringify(version),
    },
    plugins: [
      react(),
      // usage proxy removed
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
