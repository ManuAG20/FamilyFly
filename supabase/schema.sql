-- FamilyFly Fase 3 schema
-- Ejecutar en SQL Editor de Supabase. Activar RLS.

CREATE TABLE IF NOT EXISTS price_history (
  id BIGSERIAL PRIMARY KEY,
  origin TEXT NOT NULL,
  destination TEXT,
  departure_date DATE NOT NULL,
  return_date DATE,
  price_usd NUMERIC(10,2) NOT NULL,
  airline_code TEXT,
  provider TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_route_date ON price_history (origin, destination, departure_date, observed_at DESC);

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS price_history_read ON price_history
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS price_history_insert ON price_history
  FOR INSERT WITH CHECK (false);

CREATE TABLE IF NOT EXISTS watchlist (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_date DATE,
  return_date DATE,
  max_price_usd NUMERIC(10,2),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watchlist_active ON watchlist (active, created_at DESC);

ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS watchlist_owner_select ON watchlist
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS watchlist_owner_insert ON watchlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS watchlist_owner_update ON watchlist
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS watchlist_owner_delete ON watchlist
  FOR DELETE USING (auth.uid() = user_id);
