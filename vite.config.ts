import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const usageProxyPlugin = (openaiKey: string) => ({
    name: "openai-usage-proxy",
    configureServer(server: any) {
      server.middlewares.use("/api/usage", async (req: any, res: any) => {
        try {
          const url = new URL(req.url || "/api/usage", "http://localhost");
          const range = url.searchParams.get("range") || "7d";

          const daysByRange: Record<string, number> = {
            "7d": 7,
            "30d": 30,
            "60d": 60,
            "1y": 365,
          };

          const days = daysByRange[range] ?? 7;

          const toYMD = (d: Date) => {
            const yyyy = d.getUTCFullYear();
            const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
            const dd = String(d.getUTCDate()).padStart(2, "0");
            return `${yyyy}-${mm}-${dd}`;
          };

          const end = new Date();
          const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
          start.setUTCDate(start.getUTCDate() - (days - 1));

          const startDate = toYMD(start);
          const endDate = toYMD(end);

          const key = openaiKey || env.OPENAI_API_KEY;
          if (!key) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Missing OPENAI_API_KEY in .env" }));
            return;
          }

          // The /v1/usage endpoint expects a single 'date' param per request.
          // We iterate day-by-day across the selected range and aggregate totals.
          let inputTokens = 0;
          let outputTokens = 0;
          const daily: { date: string; input_tokens: number; output_tokens: number; total_tokens: number }[] = [];

          const iterateDays = (from: Date, to: Date): string[] => {
            const days: string[] = [];
            const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
            const endD = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
            while (cur <= endD) {
              days.push(toYMD(cur));
              cur.setUTCDate(cur.getUTCDate() + 1);
            }
            return days;
          };

          const dayList = iterateDays(start, end);
          for (const day of dayList) {
            const dayUrl = new URL("https://api.openai.com/v1/usage");
            dayUrl.searchParams.set("date", day);

            const upstream = await fetch(dayUrl.toString(), {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${key}`,
                "Content-Type": "application/json",
              },
            });

            if (!upstream.ok) {
              const text = await upstream.text();
              res.statusCode = upstream.status;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "OpenAI usage request failed", status: upstream.status, body: text }));
              return;
            }

            const data = await upstream.json();
            let dayInput = 0;
            let dayOutput = 0;
            if (Array.isArray(data?.data)) {
              for (const row of data.data) {
                const ctx = Number(row?.n_context_tokens_total ?? row?.input_tokens ?? 0) || 0;
                const gen = Number(row?.n_generated_tokens_total ?? row?.output_tokens ?? 0) || 0;
                dayInput += ctx;
                dayOutput += gen;
              }
            }
            inputTokens += dayInput;
            outputTokens += dayOutput;
            daily.push({ date: day, input_tokens: dayInput, output_tokens: dayOutput, total_tokens: dayInput + dayOutput });
          }

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            start_date: startDate,
            end_date: endDate,
            totals: {
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              total_tokens: inputTokens + outputTokens,
            },
            daily,
          }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Server error", message: String(err?.message || err) }));
        }
      });
    },
  });

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === 'development' &&
      componentTagger(),
      mode === 'development' && usageProxyPlugin(env.OPENAI_API_KEY || ""),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
