import React from "react";
import { useTokenLimit } from "@/hooks/useTokenLimit";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { ChevronDown, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const LimitPill = ({ used, max, label }: { used: number, max: number, label: string }) => {
    const ratio = max > 0 ? used / max : 0;
    const isExceeded = ratio >= 0.95;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Badge
                    variant="outline"
                    className={`font-mono text-xs px-2 py-0.5 whitespace-nowrap cursor-help transition-colors ${isExceeded
                        ? "border-red-500 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800"
                        : "border-border bg-muted/30 text-muted-foreground"
                        }`}
                >
                    {label}: {used.toLocaleString()}/{max.toLocaleString()}
                    {isExceeded && <AlertCircle className="w-3 h-3 ml-1 inline-block" />}
                </Badge>
            </TooltipTrigger>
            <TooltipContent>
                <p>{label} Limit: {isExceeded ? "Approaching or Exceeded!" : "Normal Usage"}</p>
            </TooltipContent>
        </Tooltip>
    );
};

export const TokenLimitIndicator = () => {
    const { limits, loading, isMasterAgent, isSuperAgent } = useTokenLimit();

    console.log('[TokenLimitIndicator] Render:', { loading, limitsLen: limits.length, isMasterAgent, isSuperAgent });

    if (loading) return null;
    if (!isMasterAgent && limits.length === 0) return null;

    if (!isMasterAgent) {
        // For Super/Basic Agent: there's only 1 limit corresponding to the super agent limit
        const data = limits[0];
        return (
            <div className="flex items-center gap-2">
                <LimitPill used={data.daily_used_tokens} max={data.max_tokens_per_day} label="Daily" />
                <LimitPill used={data.monthly_used_tokens} max={data.max_tokens_per_month} label="Monthly" />
            </div>
        );
    }

    // Master Agent: Dropdown of all super agents
    const totalSuperAgents = limits.length;
    const exceededCount = limits.filter(l =>
        (l.max_tokens_per_day > 0 && l.daily_used_tokens / l.max_tokens_per_day >= 0.95) ||
        (l.max_tokens_per_month > 0 && l.monthly_used_tokens / l.max_tokens_per_month >= 0.95)
    ).length;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Badge
                    variant="outline"
                    className={`cursor-pointer transition-colors ${exceededCount > 0
                        ? "border-red-500 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/60"
                        : "hover:bg-accent hover:text-accent-foreground"
                        }`}
                >
                    Super Agent Limits ({totalSuperAgents})
                    {exceededCount > 0 && <AlertCircle className="w-3 h-3 ml-1.5 inline-block" />}
                    <ChevronDown className="h-3 w-3 ml-1" />
                </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[380px] sm:w-[420px] max-h-[400px] overflow-y-auto">
                <div className="px-2 py-1.5">
                    <div className="flex flex-col space-y-1">
                        <span className="text-sm font-medium leading-none">Token Limits Summary</span>
                        <span className="text-xs text-muted-foreground font-normal">
                            {exceededCount > 0 ? `${exceededCount} agent(s) approaching limits` : "All agents within limits"}
                        </span>
                    </div>
                </div>
                <DropdownMenuSeparator />
                <div className="px-1 py-1 space-y-1">
                    {limits.length === 0 ? (
                        <div className="text-sm text-center py-2 text-muted-foreground">No limits enabled</div>
                    ) : (
                        limits.map(agent => (
                            <div key={agent.user_id} className="flex flex-col gap-1 p-2 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors">
                                <div className="flex justify-between items-center text-sm font-medium">
                                    <span className="truncate pr-2" title={agent.email}>{agent.display_name || agent.email}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                    <LimitPill used={agent.daily_used_tokens} max={agent.max_tokens_per_day} label="Daily" />
                                    <LimitPill used={agent.monthly_used_tokens} max={agent.max_tokens_per_month} label="Monthly" />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
