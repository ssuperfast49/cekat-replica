import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { CalendarDays, ListChecks, Search, Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import changelogContent from "../../CHANGELOG.md?raw";
import { cn } from "@/lib/utils";

type ChangelogSection = {
  heading: string;
  body: string;
  highlights: string[];
};

type ChangelogEntry = {
  version: string;
  label?: string;
  date?: string;
  sections: ChangelogSection[];
  summary: string[];
  raw: string;
};

const sectionPalette = [
  "from-sky-400/60 via-cyan-400/20 to-transparent border-sky-500/40",
  "from-fuchsia-400/60 via-purple-500/20 to-transparent border-fuchsia-500/30",
  "from-emerald-400/60 via-lime-400/20 to-transparent border-emerald-500/30",
  "from-amber-400/60 via-orange-400/20 to-transparent border-amber-500/30",
  "from-indigo-400/60 via-violet-500/20 to-transparent border-indigo-500/30",
  "from-rose-400/60 via-pink-500/20 to-transparent border-rose-500/30",
];

function extractHighlights(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^-\s*\*\*/.test(line))
    .map((line) => {
      const match = line.match(/^-\s*\*\*(.+?)\*\*:?\s*(.*)$/);
      if (!match) {
        return line.replace(/^-+\s*/, "");
      }
      const [, feature, description] = match;
      return description
        ? `${feature.trim()} — ${description.trim()}`
        : feature.trim();
    });
}

function parseChangelog(markdown: string): ChangelogEntry[] {
  const normalized = markdown.replace(/\r/g, "").trim();
  if (!normalized) return [];

  const blocks = normalized
    .split(/\n(?=# \[)/g)
    .map((block) => block.trim())
    .filter(Boolean);

  const entries: ChangelogEntry[] = [];

  for (const block of blocks) {
    if (block.startsWith("# Change Log")) {
      const remainder = block.replace(/^# Change Log\s*/, "").trim();
      if (!remainder) continue;
      // re-process the remainder if it still contains release entries
      const nestedEntries = parseChangelog(remainder);
      entries.push(...nestedEntries);
      continue;
    }

    const headerMatch = block.match(/^# \[(?<version>[^\]]+)\](?<title>.*?)(?:\n|$)/);
    if (!headerMatch?.groups) continue;

    const rawVersion = headerMatch.groups.version?.trim();
    if (!rawVersion) continue;

    const headerRemainder = headerMatch.groups.title?.trim() ?? "";

    let label: string | undefined = headerRemainder || undefined;
    let date: string | undefined;

    if (headerRemainder) {
      const dateMatch = headerRemainder.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        date = dateMatch[1];
        label = headerRemainder.replace(dateMatch[1], "").trim() || undefined;
      }
    }

    const body = block.slice(headerMatch[0].length).trim();
    const sectionChunks = body
      ? body
          .split(/\n(?=### )/g)
          .map((chunk) => chunk.trim())
          .filter(Boolean)
      : [];

    const sections: ChangelogSection[] = sectionChunks.length
      ? sectionChunks.map((chunk, index) => {
          const [firstLine, ...rest] = chunk.split("\n");
          const heading = firstLine.replace(/^###\s*/, "").trim() || `Section ${index + 1}`;
          const sectionBody = rest.join("\n").trim();
          return {
            heading,
            body: sectionBody,
            highlights: extractHighlights(sectionBody),
          };
        })
      : body
      ? [
          {
            heading: "Updates",
            body,
            highlights: extractHighlights(body),
          },
        ]
      : [];

    const summary = sections
      .flatMap((section) => section.highlights)
      .filter(Boolean)
      .slice(0, 5);

    entries.push({
      version: rawVersion,
      label,
      date,
      sections,
      summary,
      raw: body,
    });
  }

  return entries;
}

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="text-sm leading-relaxed text-slate-200">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="space-y-2 text-sm text-slate-200">{children}</ul>
  ),
  li: ({ children }) => (
    <li className="relative pl-6">
      <span className="absolute left-0 top-2 h-2 w-2 rounded-full bg-gradient-to-r from-sky-400 to-blue-500 shadow-[0_0_12px_rgba(56,189,248,0.6)]" />
      <div className="space-y-1">{children}</div>
    </li>
  ),
  strong: ({ children }) => (
    <span className="font-semibold text-sky-200">{children}</span>
  ),
  code: ({ children }) => (
    <code className="rounded-md bg-slate-900/80 px-1.5 py-0.5 text-xs text-sky-200">
      {children}
    </code>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      className="text-sky-300 underline decoration-dotted underline-offset-4 transition hover:text-sky-200"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
};

export default function Changelog() {
  const entries = useMemo(() => parseChangelog(changelogContent), []);
  const [searchValue, setSearchValue] = useState("");
  const [view, setView] = useState<"interactive" | "markdown">("interactive");
  const [selectedVersion, setSelectedVersion] = useState(
    entries[0]?.version ?? ""
  );

  const query = searchValue.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    if (!query) return entries;
    return entries.filter((entry) => {
      const haystacks = [
        entry.version,
        entry.label ?? "",
        entry.date ?? "",
        entry.raw,
        ...entry.sections.map((section) => section.heading),
        ...entry.sections.map((section) => section.body),
      ]
        .join(" ")
        .toLowerCase();

      if (haystacks.includes(query)) return true;

      return entry.sections.some((section) =>
        section.highlights.some((highlight) =>
          highlight.toLowerCase().includes(query)
        )
      );
    });
  }, [entries, query]);

  useEffect(() => {
    if (!filteredEntries.length) {
      setSelectedVersion("");
      return;
    }
    const stillVisible = filteredEntries.some(
      (entry) => entry.version === selectedVersion
    );
    if (!stillVisible) {
      setSelectedVersion(filteredEntries[0]?.version ?? "");
    }
  }, [filteredEntries, selectedVersion]);

  const activeEntry =
    filteredEntries.find((entry) => entry.version === selectedVersion) ||
    filteredEntries[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Release Notes & Progress Journal
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-slate-300 md:text-base">
            Explore every release with rich summaries, vivid highlights, and
            interactive sections. Filter by keyword, skim highlights, or dive
            deep into the full notes.
          </p>
        </div>

        <Tabs
          value={view}
          onValueChange={(value) => setView(value as typeof view)}
          className="w-full"
        >
          <TabsList className="mx-auto grid w-full max-w-xs grid-cols-2 bg-slate-900/60 p-1 shadow-inner shadow-slate-800/40">
            <TabsTrigger
              value="interactive"
              className="data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-100"
            >
              Interactive
            </TabsTrigger>
            <TabsTrigger
              value="markdown"
              className="data-[state=active]:bg-slate-700/40 data-[state=active]:text-slate-100"
            >
              Classic
            </TabsTrigger>
          </TabsList>

          <TabsContent value="interactive" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              <Card className="border border-white/10 bg-slate-950/60 shadow-[0_12px_40px_-24px_rgba(56,189,248,0.65)] backdrop-blur">
                <CardHeader className="space-y-4">
                  <CardTitle className="flex items-center gap-2 text-lg text-white">
                    <Sparkles className="h-4 w-4 text-sky-300" />
                    Releases
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-300">
                    Search and choose any release to explore tailored highlights
                    and details. Recent entries glow brighter.
                  </CardDescription>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search versions, features, or dates..."
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      className="bg-slate-900/70 pl-9 text-sm text-slate-100 placeholder:text-slate-400 focus-visible:ring-sky-400"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[540px]">
                    <div className="flex flex-col divide-y divide-white/5">
                      {filteredEntries.length === 0 && (
                        <div className="p-6 text-center text-sm text-slate-400">
                          No release notes match your search. Try another term.
                        </div>
                      )}
                      {filteredEntries.map((entry, index) => {
                        const isActive = entry.version === activeEntry?.version;
                        return (
                          <button
                            key={entry.version}
                            onClick={() => setSelectedVersion(entry.version)}
                            className={cn(
                              "group relative flex w-full flex-col items-start gap-3 px-5 py-4 text-left transition",
                              isActive
                                ? "bg-sky-500/15"
                                : "hover:bg-slate-900/70"
                            )}
                          >
                            <div className="flex w-full items-start gap-3">
                              <span
                                className={cn(
                                  "mt-2 h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.7)] transition-transform",
                                  isActive && "scale-125"
                                )}
                              />
                              <div className="flex flex-1 flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-100">
                                    v{entry.version}
                                  </span>
                                  {entry.label && (
                                    <Badge
                                      variant="outline"
                                      className="border-slate-500/50 bg-slate-900/60 px-2 py-0 text-[10px] font-medium uppercase tracking-wide text-slate-300"
                                    >
                                      {entry.label}
                                    </Badge>
                                  )}
                                  {entry.date && (
                                    <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-400">
                                      <CalendarDays className="h-3 w-3 text-slate-400" />
                                      {entry.date}
                                    </span>
                                  )}
                                </div>
                                {entry.summary.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {entry.summary.slice(0, 3).map((highlight) => (
                                      <Badge
                                        key={highlight}
                                        variant="secondary"
                                        className="max-w-full truncate bg-sky-500/15 text-[10px] font-medium text-sky-100"
                                        title={highlight}
                                      >
                                        {highlight}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <div className="space-y-6">
                {activeEntry ? (
                  <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 p-1 shadow-[0_45px_90px_-60px_rgba(56,189,248,0.8)] backdrop-blur">
                    <div className="absolute -left-32 -top-32 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl" />
                    <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
                    <div className="relative z-10 rounded-[calc(theme(borderRadius.3xl))] border border-white/10 bg-slate-950/80 px-8 py-8">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge className="bg-sky-500/30 text-sky-50">
                          Version {activeEntry.version}
                        </Badge>
                        {activeEntry.label && (
                          <h2 className="text-xl font-semibold text-white md:text-2xl">
                            {activeEntry.label}
                          </h2>
                        )}
                        {activeEntry.date && (
                          <span className="flex items-center gap-1 text-sm text-slate-300">
                            <CalendarDays className="h-4 w-4 text-sky-300" />
                            {activeEntry.date}
                          </span>
                        )}
                      </div>

                      {activeEntry.summary.length > 0 && (
                        <div className="mt-5 flex flex-wrap gap-2">
                          {activeEntry.summary.map((highlight) => (
                            <Badge
                              key={highlight}
                              variant="outline"
                              className="gap-1 border-sky-400/40 bg-sky-500/15 px-3 py-1 text-[11px] font-medium text-sky-100"
                              title={highlight}
                            >
                              <Sparkles className="h-3 w-3 text-sky-200" />
                              <span className="max-w-[220px] truncate">
                                {highlight}
                              </span>
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="mt-8 space-y-4">
                        <Accordion
                          key={activeEntry.version}
                          type="multiple"
                          defaultValue={activeEntry.sections.map(
                            (_, index) => `section-${index}`
                          )}
                          className="space-y-4"
                        >
                          {activeEntry.sections.map((section, index) => {
                            const palette =
                              sectionPalette[index % sectionPalette.length];
                            return (
                              <AccordionItem
                                key={section.heading + index}
                                value={`section-${index}`}
                                className={cn(
                                  "border border-white/5",
                                  "rounded-2xl bg-slate-950/60 shadow-[0_24px_60px_-35px_rgba(56,189,248,0.55)]"
                                )}
                              >
                                <AccordionTrigger className="px-6 py-5 text-left hover:no-underline data-[state=open]:bg-slate-900/60">
                                  <div className="flex flex-1 flex-col gap-3">
                                    <div className="flex items-center gap-3">
                                      <span
                                        className={cn(
                                          "h-2.5 w-2.5 rounded-full bg-gradient-to-r shadow-[0_0_12px_rgba(56,189,248,0.6)]",
                                          palette
                                        )}
                                      />
                                      <span className="text-base font-semibold text-white md:text-lg">
                                        {section.heading}
                                      </span>
                                    </div>
                                    {section.highlights.length > 0 && (
                                      <p className="text-xs text-slate-300 md:text-sm">
                                        {section.highlights[0]}
                                      </p>
                                    )}
                                  </div>
                                  <ListChecks className="h-4 w-4 text-sky-300" />
                                </AccordionTrigger>
                                <AccordionContent className="px-6 pb-6">
                                  <div
                                    className={cn(
                                      "relative overflow-hidden rounded-xl border border-white/5 bg-slate-950/80 px-5 py-5",
                                      "shadow-[inset_0_0_40px_-25px_rgba(56,189,248,0.75)]"
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-40",
                                        palette
                                      )}
                                    />
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      components={markdownComponents}
                                      className="relative z-10 space-y-3"
                                    >
                                      {section.body}
                                    </ReactMarkdown>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                          {activeEntry.sections.length === 0 && (
                            <p className="text-sm text-slate-300">
                              No detailed sections were found for this release.
                              Check the classic view for raw notes.
                            </p>
                          )}
                        </Accordion>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Card className="border border-white/10 bg-slate-950/60 p-12 text-center text-slate-300">
                    <CardTitle className="text-xl text-white">
                      No entries available
                    </CardTitle>
                    <CardDescription className="mt-2 text-sm text-slate-300">
                      Try clearing the search filter to view release notes.
                    </CardDescription>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="markdown" className="mt-6">
            <Card className="border border-white/10 bg-slate-950/70 shadow-[0_30px_80px_-60px_rgba(15,23,42,0.95)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <ListChecks className="h-5 w-5 text-sky-300" />
                  Full Markdown
                </CardTitle>
                <CardDescription className="text-xs text-slate-300">
                  Prefer the traditional view? Browse the original changelog
                  with full Markdown formatting.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <article className="prose prose-sm max-w-none text-slate-200 dark:prose-invert prose-headings:text-white prose-a:text-sky-300 prose-strong:text-sky-200">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {changelogContent}
                  </ReactMarkdown>
                </article>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}