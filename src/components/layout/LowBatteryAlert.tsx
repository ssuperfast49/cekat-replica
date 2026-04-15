import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAIWallets } from "@/hooks/useAIWallet";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { BatteryWarning } from "lucide-react";

const ALERT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const formatUsd = (value: number) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);

export const LowBatteryAlert = () => {
    const { wallets, isLowBattery, isWalletAdmin, lowBatteryProviders } = useAIWallets();
    const [open, setOpen] = useState(false);
    const lastDismissedRef = useRef<number>(0);
    const providerLabels: Record<string, string> = { openai: "OpenAI", gemini: "Gemini" };

    const lowWallets = useMemo(
        () => lowBatteryProviders
            .map(p => wallets[p])
            .filter((w): w is NonNullable<typeof w> => !!w),
        [lowBatteryProviders, wallets],
    );
    const lowestWallet = useMemo(() => {
        if (lowWallets.length === 0) return null;
        return lowWallets.reduce((lowest, current) =>
            current.battery_percent < lowest.battery_percent ? current : lowest
        );
    }, [lowWallets]);

    useEffect(() => {
        if (!isLowBattery) {
            setOpen(false);
            return;
        }

        // Show immediately on first detection
        const now = Date.now();
        if (now - lastDismissedRef.current >= ALERT_INTERVAL_MS) {
            setOpen(true);
        }

        // Set up interval to re-show every 10 minutes
        const interval = setInterval(() => {
            if (isLowBattery) {
                setOpen(true);
            }
        }, ALERT_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [isLowBattery]);

    const handleDismiss = () => {
        lastDismissedRef.current = Date.now();
        setOpen(false);
    };

    if (!isLowBattery || !lowestWallet) return null;

    const providerNames = lowWallets.map(w => providerLabels[w.provider] || String(w.provider)).join(', ');
    const providerLabel = providerNames || (providerLabels[lowestWallet.provider] || String(lowestWallet.provider));

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 rounded-full bg-red-100 dark:bg-red-900/40">
                            <BatteryWarning className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <AlertDialogTitle className="text-lg">
                            ⚠️ Baterai AI Hampir Habis
                        </AlertDialogTitle>
                    </div>
                    <AlertDialogDescription asChild>
                        <div className="text-sm leading-relaxed space-y-2">
                            <p>
                                Baterai AI ({providerLabel}) saat ini berada di <span className="font-bold text-red-600 dark:text-red-400">{lowestWallet.battery_percent}%</span>.
                            </p>
                            <p>
                                Saldo saat ini: <span className="font-semibold">{formatUsd(lowestWallet.balance_usd)}</span>.
                            </p>
                            <p>
                                {isWalletAdmin
                                    ? "Silakan segera lakukan top up saldo AI wallet agar layanan tetap berjalan tanpa gangguan."
                                    : "Silakan hubungi Billing Admin untuk melakukan top up saldo AI wallet agar layanan tetap berjalan."
                                }
                            </p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={handleDismiss}>
                        Mengerti
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};
