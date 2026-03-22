CREATE OR REPLACE FUNCTION public.apply_wallet_cost_from_token_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_input_cost NUMERIC;
    v_output_cost NUMERIC;
    v_total_cost NUMERIC;
BEGIN
    -- 1. Find the model pricing using a prefix match (e.g., 'gpt-5.4-mini' matches 'gpt-5.4-mini-2026-03-17')
    SELECT input_cost_per_1m, output_cost_per_1m 
    INTO v_input_cost, v_output_cost
    FROM public.ai_models 
    WHERE NEW.model LIKE model_name || '%'
    ORDER BY length(model_name) DESC
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
$function$;
