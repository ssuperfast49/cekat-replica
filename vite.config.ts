import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {

  // Removed OpenAI usage proxy as custom analytics is taken out

  return {
    server: {
      host: "::",
      port: 8080,
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
