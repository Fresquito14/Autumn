-- Migration: Add actual_lag column to dependencies table
-- Allows recording the actual/real start delay between tasks independently of planned lag

ALTER TABLE IF EXISTS public.dependencies
ADD COLUMN IF NOT EXISTS actual_lag NUMERIC;
