-- ============================================================
-- PropTech Cleanup — Run this FIRST before the PropManager schema
-- Drops all proptech tables from the shared Supabase project
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

drop view  if exists public.user_usage cascade;
drop table if exists public.generations cascade;
