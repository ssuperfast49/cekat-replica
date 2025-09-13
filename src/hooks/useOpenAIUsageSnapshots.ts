import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UsageRange = "7d" | "30d" | "60d" | "1y";

export type NormalizedUsage = {
  start_date: string;
  end_date: string;
  totals: { input_tokens: number; output_tokens: number; total_tokens: number };
  daily?: { date: string; input_tokens: number; output_tokens: number; total_tokens: number }[];
};

export function useOpenAIUsageSnapshots(range: UsageRange, live: boolean) {
  const [data, setData] = useState<NormalizedUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLatest = useMemo(
    () => async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
          .from("openai_usage_snapshots")
          .select("captured_at, range_label, start_date, end_date, input_tokens, output_tokens, total_tokens, raw")
          .eq("range_label", range)
          .order("captured_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (!data) return;

        const daily = Array.isArray(data.raw?.daily) ? data.raw.daily : [];
        setData({
          start_date: String(data.start_date),
          end_date: String(data.end_date),
          totals: {
            input_tokens: Number(data.input_tokens) || 0,
            output_tokens: Number(data.output_tokens) || 0,
            total_tokens: Number(data.total_tokens) || 0,
          },
          daily,
        });
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    },
    [range]
  );

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let mounted = true;

    const init = async () => {
      await fetchLatest();
      if (!live) return;
      channel = supabase
        .channel(`openai-usage-${range}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "openai_usage_snapshots", filter: `range_label=eq.${range}` },
          (payload) => {
            try {
              const row: any = payload.new as any;
              const daily = Array.isArray(row?.raw?.daily) ? row.raw.daily : [];
              if (!mounted) return;
              setData({
                start_date: String(row.start_date),
                end_date: String(row.end_date),
                totals: {
                  input_tokens: Number(row.input_tokens) || 0,
                  output_tokens: Number(row.output_tokens) || 0,
                  total_tokens: Number(row.total_tokens) || 0,
                },
                daily,
              });
            } catch (err) {
              // ignore
            }
          }
        )
        .subscribe();
    };

    init();

    return () => {
      mounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [range, live, fetchLatest]);

  return { data, loading, error, refetch: fetchLatest } as const;
}


