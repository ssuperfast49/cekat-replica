-- Migration: Add blocked_until column to threads table
-- Created at: 2026-03-26 01:00:00

ALTER TABLE IF EXISTS public.threads 
ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.threads.blocked_until IS 'Timestamp until which the member is suspended from chatting in this thread.';
