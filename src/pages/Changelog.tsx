import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Changelog() {
  const [content, setContent] = useState<string>("Loading changelog...");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/CHANGELOG.md");
        if (!res.ok) throw new Error(`Failed to load changelog: ${res.status}`);
        const text = await res.text();
        setContent(text);
      } catch (e: any) {
        setContent(e?.message || "Failed to load changelog.");
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-6 flex justify-center">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Changelog</CardTitle>
        </CardHeader>
        <CardContent>
          <article className="prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none whitespace-pre-wrap">
            {content}
          </article>
        </CardContent>
      </Card>
    </div>
  );
}



