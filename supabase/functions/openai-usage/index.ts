import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
function toYMD(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
async function fetchUsageForDate(date, key) {
  const url = new URL("https://api.openai.com/v1/usage");
  url.searchParams.set("date", date);
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI usage failed ${res.status}: ${text}`);
  }
  return res.json();
}
Deno.serve(async (req)=>{
  try {
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({
        error: "Missing OPENAI_API_KEY"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const url = new URL(req.url);
    const range = url.searchParams.get("range") ?? "7d";
    const daysByRange = {
      "7d": 7,
      "30d": 30,
      "60d": 60,
      "1y": 365
    };
    const days = daysByRange[range] ?? 7;
    const end = new Date();
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - (days - 1));
    let inputTokens = 0;
    let outputTokens = 0;
    const daily = [];
    const tableUrl = new URL("/rest/v1/openai_usage_snapshots", Deno.env.get("SUPABASE_URL"));
    // Loop 4 times (every ~15s) to gather near-realtime snapshots
    for(let i = 0; i < 4; i++){
      inputTokens = 0;
      outputTokens = 0;
      daily.length = 0;
      const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
      const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
      while(cursor <= endDay){
        const day = toYMD(cursor);
        const data = await fetchUsageForDate(day, OPENAI_API_KEY);
        let dayInput = 0;
        let dayOutput = 0;
        if (Array.isArray(data?.data)) {
          for (const row of data.data){
            const ctx = Number(row?.n_context_tokens_total ?? row?.input_tokens ?? 0) || 0;
            const gen = Number(row?.n_generated_tokens_total ?? row?.output_tokens ?? 0) || 0;
            dayInput += ctx;
            dayOutput += gen;
          }
        }
        inputTokens += dayInput;
        outputTokens += dayOutput;
        daily.push({
          date: day,
          input_tokens: dayInput,
          output_tokens: dayOutput,
          total_tokens: dayInput + dayOutput
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      const payload = {
        range_label: range,
        start_date: toYMD(start),
        end_date: toYMD(end),
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        raw: {
          daily
        }
      };
      const insertRes = await fetch(tableUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": Deno.env.get("SUPABASE_ANON_KEY"),
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")}`,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(payload)
      });
      if (!insertRes.ok) {
        const t = await insertRes.text();
        throw new Error(`Insert failed ${insertRes.status}: ${t}`);
      }
      if (i < 3) {
        await new Promise((r)=>setTimeout(r, 15000));
      }
    }
    return new Response(JSON.stringify({
      status: "ok"
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: String(err)
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});
