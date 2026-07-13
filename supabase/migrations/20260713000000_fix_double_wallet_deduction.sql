-- Remove the duplicate wallet deduction. token_usage_logs had TWO enabled triggers
-- both deducting the same cost_usd from the same ai_wallets row on every insert:
--   * tr_apply_wallet_cost (BEFORE ROW, apply_wallet_cost_from_token_log) -- KEEP:
--     it computes and stores NEW.cost_usd (via ai_models pricing + provider
--     inference) AND performs the correct single deduction.
--   * trg_deduct_ai_wallet_balance (AFTER ROW, deduct_ai_wallet_balance) -- DROP:
--     a legacy duplicate that re-deducts the same amount (hardcoded 2-model pricing).
-- Keeping both double-charged every AI usage. Dropping the AFTER trigger leaves a
-- single correct deduction. The function is left in place (dead but harmless).

drop trigger if exists trg_deduct_ai_wallet_balance on public.token_usage_logs;
