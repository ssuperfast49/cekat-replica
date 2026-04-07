import React, { useState } from "react";
import { useAIWallets } from "@/hooks/useAIWallet";
import { useTokenLimit } from "@/hooks/useTokenLimit";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { ChevronDown, AlertCircle, BatteryLow, BatteryMedium, BatteryFull, BatteryCharging, DollarSign, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const getBatteryIcon = (percent: number) => {
    if (percent <= 15) return <BatteryLow className="w-4 h-4" />;
    if (percent <= 50) return <BatteryMedium className="w-4 h-4" />;
    if (percent <= 85) return <BatteryFull className="w-4 h-4" />;
    return <BatteryFull className="w-4 h-4" />;
};

const getBatteryColor = (percent: number) => {
    if (percent <= 15) return "text-red-500 dark:text-red-400";
    if (percent <= 30) return "text-orange-500 dark:text-orange-400";
    if (percent <= 50) return "text-yellow-500 dark:text-yellow-400";
    return "text-emerald-500 dark:text-emerald-400";
};

const getBatteryBarBg = (percent: number) => {
    if (percent <= 15) return "bg-red-500";
    if (percent <= 30) return "bg-orange-500";
    if (percent <= 50) return "bg-yellow-500";
    return "bg-emerald-500";
};

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
    const { wallets, loading: walletLoading, isWalletAdmin, topUp, toppingUp } = useAIWallets();
    const { limits, loading: limitsLoading, isMasterAgent: isMasterLimits } = useTokenLimit();
    const [topUpAmount, setTopUpAmount] = useState<Record<string, string>>({});
    const [showTopUp, setShowTopUp] = useState<Record<string, boolean>>({});

    const loading = walletLoading || limitsLoading;

    if (loading) return null;

    const providers = [
        { key: "openai", label: "OpenAI" },
        { key: "gemini", label: "Gemini" },
    ];

    const hasAnyWallet = providers.some(p => wallets[p.key]);
    if (!hasAnyWallet && !isWalletAdmin && limits.length === 0) return null;

    const exceededCount = limits.filter(l =>
        (l.max_tokens_per_day > 0 && l.daily_used_tokens / l.max_tokens_per_day >= 0.95) ||
        (l.max_tokens_per_month > 0 && l.monthly_used_tokens / l.max_tokens_per_month >= 0.95)
    ).length;

    const renderWalletDropdown = (providerKey: string, providerLabel: string) => {
        const wallet = wallets[providerKey];
        const shouldShow = !!wallet || isWalletAdmin || (limits.length > 0 && providerKey === 'openai');
        if (!shouldShow) return null;

        const hasWallet = !!wallet;
        const batteryPercent = wallet?.battery_percent ?? 0;
        const batteryColor = hasWallet ? getBatteryColor(batteryPercent) : "text-muted-foreground";
        const batteryBarBg = hasWallet ? getBatteryBarBg(batteryPercent) : "bg-muted-foreground/40";
        const isTopUpOpen = !!showTopUp[providerKey];
        const amountValue = topUpAmount[providerKey] ?? "";
        const isToppingUp = !!toppingUp[providerKey];

        const handleTopUp = async () => {
            const amount = parseFloat(amountValue);
            if (isNaN(amount) || amount <= 0) return;
            await topUp(providerKey, amount);
            setTopUpAmount(prev => ({ ...prev, [providerKey]: "" }));
            setShowTopUp(prev => ({ ...prev, [providerKey]: false }));
        };

        return (
            <DropdownMenu key={providerKey}>
                <DropdownMenuTrigger asChild>
                    <button className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/50 cursor-pointer transition-all duration-200 hover:bg-accent/50 hover:border-border ${hasWallet && batteryPercent <= 15 ? 'animate-pulse' : ''}`}>
                        <span className={batteryColor}>
                            {getBatteryIcon(batteryPercent)}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground">
                            {providerLabel}
                        </span>
                        <span className={`text-xs font-semibold tabular-nums ${batteryColor}`}>
                            {wallet ? `${batteryPercent}%` : 'N/A'}
                        </span>
                        {(exceededCount > 0 || (hasWallet && batteryPercent <= 15)) && (
                            <AlertCircle className="w-3 h-3 text-red-500" />
                        )}
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[320px] sm:w-[360px] p-0">
                    {/* Battery Section */}
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Zap className={`w-4 h-4 ${batteryColor}`} />
                                <span className="text-sm font-medium">AI Usage — {providerLabel}</span>
                            </div>
                            <span className={`text-lg font-bold tabular-nums ${batteryColor}`}>
                                {wallet ? `${batteryPercent}%` : '—'}
                            </span>
                        </div>

                        {/* Battery Bar */}
                        <div className="w-full h-4 rounded-full bg-muted/50 border border-border/30 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ease-out ${batteryBarBg}`}
                            style={{ width: `${wallet ? batteryPercent : 0}%` }}
                        />
                    </div>

                    <p className="text-xs text-muted-foreground mt-2">
                            {!wallet
                                ? "Wallet belum tersedia untuk provider ini."
                                : batteryPercent <= 15
                                    ? "⚠️ Battery critically low. Consider topping up."
                                    : batteryPercent <= 30
                                        ? "Battery running low."
                                        : batteryPercent <= 50
                                            ? "Battery at moderate level."
                                            : "Battery level is healthy."}
                    </p>
                    </div>

                    {/* Token Limits Section (for Master/Super agents) */}
                    {limits.length > 0 && (
                        <>
                            <DropdownMenuSeparator />
                            <div className="px-4 py-2">
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Token Limits
                                </span>
                            </div>
                            <div className="px-3 pb-2 space-y-1 max-h-[200px] overflow-y-auto">
                                {isMasterLimits ? (
                                    limits.map(agent => (
                                        <div key={agent.user_id} className="flex flex-col gap-1 p-2 rounded-md hover:bg-accent/50 transition-colors">
                                            <span className="text-xs font-medium truncate" title={agent.email}>
                                                {agent.display_name || agent.email}
                                            </span>
                                            <div className="flex flex-wrap items-center gap-1">
                                                <LimitPill used={agent.daily_used_tokens} max={agent.max_tokens_per_day} label="D" />
                                                <LimitPill used={agent.monthly_used_tokens} max={agent.max_tokens_per_month} label="M" />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-wrap items-center gap-1 p-1">
                                        <LimitPill used={limits[0].daily_used_tokens} max={limits[0].max_tokens_per_day} label="Daily" />
                                        <LimitPill used={limits[0].monthly_used_tokens} max={limits[0].max_tokens_per_month} label="Monthly" />
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Wallet Top-Up Section */}
                    {isWalletAdmin && (
                        <>
                            <DropdownMenuSeparator />
                            <div className="p-3">
                                {!isTopUpOpen ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full gap-2"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setShowTopUp(prev => ({ ...prev, [providerKey]: true }));
                                        }}
                                    >
                                        <BatteryCharging className="w-4 h-4" />
                                        Top Up {providerLabel}
                                    </Button>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                                <Input
                                                    type="number"
                                                    placeholder="Amount"
                                                    value={amountValue}
                                                    onChange={(e) => setTopUpAmount(prev => ({ ...prev, [providerKey]: e.target.value }))}
                                                    className="pl-7 h-8 text-sm"
                                                    min="0"
                                                    step="0.01"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleTopUp();
                                                        if (e.key === 'Escape') setShowTopUp(prev => ({ ...prev, [providerKey]: false }));
                                                    }}
                                                />
                                            </div>
                                            <Button
                                                size="sm"
                                                className="h-8 px-3"
                                                disabled={isToppingUp || !amountValue || parseFloat(amountValue) <= 0}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    handleTopUp();
                                                }}
                                            >
                                                {isToppingUp ? "..." : "Add"}
                                            </Button>
                                        </div>
                                        <button
                                            className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setShowTopUp(prev => ({ ...prev, [providerKey]: false }));
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    return (
        <div className="flex items-center gap-2">
            {providers.map(p => renderWalletDropdown(p.key, p.label))}
        </div>
    );
};
