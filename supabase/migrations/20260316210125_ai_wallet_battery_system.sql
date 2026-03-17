-- Create ai_wallets table
CREATE TABLE IF NOT EXISTS public.ai_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    balance_usd NUMERIC NOT NULL DEFAULT 0,
    battery_100_usd NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (org_id)
);

-- Enable RLS for ai_wallets
ALTER TABLE public.ai_wallets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_wallets
CREATE POLICY "Users can view their organization wallet" 
    ON public.ai_wallets FOR SELECT 
    USING (
        org_id IN (
            SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
            UNION
            SELECT org_id FROM public.super_agent_members WHERE agent_user_id = auth.uid()
        )
    );

-- Create ai_wallet_topups table
CREATE TABLE IF NOT EXISTS public.ai_wallet_topups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    amount_usd NUMERIC NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for ai_wallet_topups
ALTER TABLE public.ai_wallet_topups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_wallet_topups
CREATE POLICY "Users can view their organization wallet topups" 
    ON public.ai_wallet_topups FOR SELECT 
    USING (
        org_id IN (
            SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
            UNION
            SELECT org_id FROM public.super_agent_members WHERE agent_user_id = auth.uid()
        )
    );

-- RPC Function for Master Agent to Top Up the Wallet
CREATE OR REPLACE FUNCTION public.topup_ai_wallet(p_org_id UUID, p_amount_usd NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_balance NUMERIC;
    v_is_master BOOLEAN;
BEGIN
    -- Authorization check: Ensure caller has master_agent role
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid()
          AND r.name = 'master_agent'
    ) INTO v_is_master;

    IF NOT v_is_master THEN 
       RAISE EXCEPTION 'Unauthorized: Only Master Agents can top up wallets.';
    END IF;

    -- 1. Create the TopUp Log
    INSERT INTO public.ai_wallet_topups (org_id, amount_usd, created_by)
    VALUES (p_org_id, p_amount_usd, auth.uid());

    -- 2. Upsert the Wallet
    INSERT INTO public.ai_wallets (org_id, balance_usd, battery_100_usd)
    VALUES (p_org_id, p_amount_usd, p_amount_usd)
    ON CONFLICT (org_id) DO UPDATE 
    SET 
        balance_usd = public.ai_wallets.balance_usd + p_amount_usd,
        battery_100_usd = public.ai_wallets.balance_usd + p_amount_usd,
        updated_at = now()
    RETURNING balance_usd INTO v_new_balance;

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- Add split pricing to AI Models
ALTER TABLE public.ai_models
    ADD COLUMN IF NOT EXISTS input_cost_per_1m NUMERIC,
    ADD COLUMN IF NOT EXISTS output_cost_per_1m NUMERIC;

-- Data migration for existing rates in ai_models
UPDATE public.ai_models SET 
    input_cost_per_1m = cost_per_1m_tokens, 
    output_cost_per_1m = cost_per_1m_tokens 
WHERE input_cost_per_1m IS NULL;

-- Insert the gpt-5.2-2025-12-11 model explicitly 
INSERT INTO public.ai_models (id, provider, model_name, display_name, input_cost_per_1m, output_cost_per_1m, cost_per_1m_tokens, is_active)
VALUES (
    gen_random_uuid(), 
    'openai', 
    'gpt-5.2-2025-12-11', 
    'GPT 5.2 (Latest)', 
    1.75, 
    14.00, 
    7.875, -- Blended average strictly for backwards UI compatibility 
    true
)
ON CONFLICT DO NOTHING;

-- Add cost_usd to token_usage_logs
ALTER TABLE public.token_usage_logs
    ADD COLUMN IF NOT EXISTS cost_usd NUMERIC;

-- Create the Token Deduction Trigger Function
CREATE OR REPLACE FUNCTION public.apply_wallet_cost_from_token_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_input_cost NUMERIC;
    v_output_cost NUMERIC;
    v_total_cost NUMERIC;
BEGIN
    -- 1. Find the model pricing by model_name only (provider in logs may differ from ai_models)
    SELECT input_cost_per_1m, output_cost_per_1m 
    INTO v_input_cost, v_output_cost
    FROM public.ai_models 
    WHERE model_name = NEW.model
    LIMIT 1;

    -- Default fallback if model isn't found
    IF v_input_cost IS NULL THEN v_input_cost := 0; END IF;
    IF v_output_cost IS NULL THEN v_output_cost := 0; END IF;

    -- 2. Calculate literal USD cost for exactly this usage
    v_total_cost := ((NEW.prompt_tokens::NUMERIC / 1000000.0) * v_input_cost) + 
                    ((NEW.completion_tokens::NUMERIC / 1000000.0) * v_output_cost);

    NEW.cost_usd := v_total_cost;

    -- 3. Deduct from the Wallet if it exists
    IF v_total_cost > 0 THEN
        UPDATE public.ai_wallets
        SET balance_usd = balance_usd - v_total_cost,
            updated_at = now()
        WHERE org_id = NEW.org_id;
    END IF;

    RETURN NEW;
END;
$$;

-- Apply the Trigger
DROP TRIGGER IF EXISTS tr_apply_wallet_cost ON public.token_usage_logs;
CREATE TRIGGER tr_apply_wallet_cost
    BEFORE INSERT ON public.token_usage_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.apply_wallet_cost_from_token_log();
