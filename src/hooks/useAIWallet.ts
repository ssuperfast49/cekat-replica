import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, protectedSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import { ROLES } from '@/types/rbac';
import { useToast } from '@/hooks/use-toast';

export type AIWalletProvider = 'openai' | 'gemini' | string;

export interface AIWalletData {
    org_id: string;
    balance_usd: number;
    battery_100_usd: number;
    battery_percent: number;
    provider: AIWalletProvider;
}

export const LOW_BATTERY_THRESHOLD = 20;

export const useAIWallets = () => {
    const { user } = useAuth();
    const { hasRole, loading: rbacLoading } = useRBAC();
    const { toast } = useToast();
    const [wallets, setWallets] = useState<Record<string, AIWalletData>>({});
    const [loading, setLoading] = useState(true);
    const [toppingUp, setToppingUp] = useState<Record<string, boolean>>({});

    const isWalletAdmin = hasRole(ROLES.BILLING_ADMIN);
    const canViewBattery = isWalletAdmin || hasRole(ROLES.MASTER_AGENT) || hasRole(ROLES.SUPER_AGENT) || hasRole(ROLES.AGENT);

    const lowBatteryProviders = useMemo(
        () => Object.values(wallets)
            .filter(w => w.battery_percent < LOW_BATTERY_THRESHOLD)
            .map(w => w.provider),
        [wallets],
    );
    const isLowBattery = lowBatteryProviders.length > 0;

    const fetchWallets = useCallback(async () => {
        if (!user || !canViewBattery) {
            setWallets({});
            setLoading(false);
            return;
        }

        try {
            const { data: orgMember } = await protectedSupabase
                .from('org_members')
                .select('org_id')
                .eq('user_id', user.id)
                .maybeSingle();

            const orgId = orgMember?.org_id;
            if (!orgId) {
                setWallets({});
                return;
            }

            const { data, error } = await protectedSupabase
                .from('ai_wallets')
                .select('org_id, balance_usd, battery_100_usd, provider')
                .eq('org_id', orgId);

            if (error) throw error;

            const next: Record<string, AIWalletData> = {};
            for (const row of data || []) {
                const provider = (row as any).provider || 'openai';
                const percent = row.battery_100_usd > 0
                    ? Math.max(0, Math.min(100, (row.balance_usd / row.battery_100_usd) * 100))
                    : 0;
                next[provider] = {
                    org_id: row.org_id,
                    balance_usd: row.balance_usd,
                    battery_100_usd: row.battery_100_usd,
                    battery_percent: Math.round(percent),
                    provider,
                };
            }
            setWallets(next);
        } catch (error) {
            console.error('Error fetching AI wallets:', error);
        } finally {
            setLoading(false);
        }
    }, [user, isWalletAdmin]);

    const topUp = useCallback(async (provider: AIWalletProvider, amountUsd: number) => {
        if (!user || !isWalletAdmin) return;

        setToppingUp(prev => ({ ...prev, [provider]: true }));
        try {
            const { data: orgMember } = await protectedSupabase
                .from('org_members')
                .select('org_id')
                .eq('user_id', user.id)
                .maybeSingle();

            const orgId = orgMember?.org_id;
            if (!orgId) throw new Error('Organization not found');

            const { error } = await supabase.rpc('topup_ai_wallet' as any, {
                p_org_id: orgId,
                p_amount_usd: amountUsd,
                p_provider: provider,
            });

            if (error) throw error;

            toast({
                title: 'Wallet Topped Up',
                description: `Successfully added $${amountUsd.toFixed(2)} to the ${String(provider).toUpperCase()} wallet.`,
            });

            await fetchWallets();
        } catch (error: any) {
            console.error('Error topping up wallet:', error);
            toast({
                title: 'Top Up Failed',
                description: error.message || 'Failed to top up the wallet.',
                variant: 'destructive',
            });
        } finally {
            setToppingUp(prev => ({ ...prev, [provider]: false }));
        }
    }, [user, isWalletAdmin, fetchWallets, toast]);

    useEffect(() => {
        if (!user || rbacLoading) return;

        if (!canViewBattery) {
            setWallets({});
            setLoading(false);
            return;
        }

        fetchWallets();

        const channel = supabase.channel('ai_wallet_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'ai_wallets',
            }, () => {
                fetchWallets();
            })
            .subscribe();

        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchWallets();
            }
        }, 30000);

        return () => {
            clearInterval(interval);
            try {
                supabase.removeChannel(channel);
            } catch { }
        };
    }, [user, rbacLoading, isWalletAdmin, fetchWallets]);

    return { wallets, loading, isWalletAdmin, canViewBattery, isLowBattery, lowBatteryProviders, topUp, toppingUp, refetch: fetchWallets };
};
