import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import changelogContent from "../../CHANGELOG.md?raw";

export default function Changelog() {
  const content = changelogContent;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 flex justify-center">
      <Card className="w-full max-w-2xl">
        <CardContent>
          <article className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h1:mt-4 prose-h1:mb-2 prose-h2:mt-2 prose-h2:mb-2 prose-h3:mt-1 prose-h3:mb-1 prose-p:my-1 prose-li:my-0 prose-ul:my-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        </CardContent>
      </Card>
    </div>
  );
}



