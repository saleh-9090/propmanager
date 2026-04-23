-- Migration: Add unit_type column to units table
-- Run in: Supabase Dashboard → SQL Editor → New Query

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS unit_type text
  CHECK (unit_type IN ('facade', 'interior', 'dual_facade'));

COMMENT ON COLUMN public.units.unit_type IS 'facade=واجهة, interior=داخلية, dual_facade=واجهتين';
