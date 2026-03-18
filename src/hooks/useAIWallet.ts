import { useState, useEffect, useCallback } from 'react';
import { supabase, protectedSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import { ROLES } from '@/types/rbac';
import { useToast } from '@/hooks/use-toast';

export interface AIWalletData {
    org_id: string;
    balance_usd: number;
    battery_100_usd: number;
    battery_percent: number;
}

export const LOW_BATTERY_THRESHOLD = 20;

export const useAIWallet = () => {
    const { user } = useAuth();
    const { hasRole, loading: rbacLoading } = useRBAC();
    const { toast } = useToast();
    const [wallet, setWallet] = useState<AIWalletData | null>(null);
    const [loading, setLoading] = useState(true);
    const [toppingUp, setToppingUp] = useState(false);

    const isMasterAgent = hasRole(ROLES.MASTER_AGENT);
    const isLowBattery = wallet !== null && wallet.battery_percent < LOW_BATTERY_THRESHOLD;

    const fetchWallet = useCallback(async () => {
        if (!user) return;

        try {
            const { data: orgMember } = await protectedSupabase
                .from('org_members')
                .select('org_id')
                .eq('user_id', user.id)
                .maybeSingle();

            const orgId = orgMember?.org_id;
            if (!orgId) {
                setWallet(null);
                return;
            }

            const { data, error } = await protectedSupabase
                .from('ai_wallets')
                .select('org_id, balance_usd, battery_100_usd')
                .eq('org_id', orgId)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                const percent = data.battery_100_usd > 0
                    ? Math.max(0, Math.min(100, (data.balance_usd / data.battery_100_usd) * 100))
                    : 0;
                setWallet({
                    org_id: data.org_id,
                    balance_usd: data.balance_usd,
                    battery_100_usd: data.battery_100_usd,
                    battery_percent: Math.round(percent),
                });
            } else {
                setWallet(null);
            }
        } catch (error) {
            console.error('Error fetching AI wallet:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    const topUp = useCallback(async (amountUsd: number) => {
        if (!user || !isMasterAgent) return;

        setToppingUp(true);
        try {
            const { data: orgMember } = await protectedSupabase
                .from('org_members')
                .select('org_id')
                .eq('user_id', user.id)
                .maybeSingle();

            const orgId = orgMember?.org_id;
            if (!orgId) throw new Error('Organization not found');

            const { data, error } = await supabase.rpc('topup_ai_wallet' as any, {
                p_org_id: orgId,
                p_amount_usd: amountUsd,
            });

            if (error) throw error;

            toast({
                title: 'Wallet Topped Up',
                description: `Successfully added $${amountUsd.toFixed(2)} to the AI wallet.`,
            });

            await fetchWallet();
        } catch (error: any) {
            console.error('Error topping up wallet:', error);
            toast({
                title: 'Top Up Failed',
                description: error.message || 'Failed to top up the wallet.',
                variant: 'destructive',
            });
        } finally {
            setToppingUp(false);
        }
    }, [user, isMasterAgent, fetchWallet, toast]);

    useEffect(() => {
        if (!user || rbacLoading) return;

        fetchWallet();

        const channel = supabase.channel('ai_wallet_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'ai_wallets',
            }, () => {
                fetchWallet();
            })
            .subscribe();

        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchWallet();
            }
        }, 30000);

        return () => {
            clearInterval(interval);
            try {
                supabase.removeChannel(channel);
            } catch { }
        };
    }, [user, rbacLoading, fetchWallet]);

    return { wallet, loading, isMasterAgent, isLowBattery, topUp, toppingUp, refetch: fetchWallet };
};
