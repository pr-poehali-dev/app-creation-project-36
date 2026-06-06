
CREATE TABLE IF NOT EXISTS t_p55602185_app_creation_project.materials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  unit TEXT NOT NULL DEFAULT 'шт',
  stock NUMERIC(14,2) NOT NULL DEFAULT 0,
  reserved NUMERIC(14,2) NOT NULL DEFAULT 0,
  min_stock NUMERIC(14,2) NOT NULL DEFAULT 0,
  supplier TEXT DEFAULT '',
  next_delivery_date DATE,
  price_per_unit NUMERIC(12,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p55602185_app_creation_project.material_reservations (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  needed NUMERIC(14,2) NOT NULL DEFAULT 0,
  reserved NUMERIC(14,2) NOT NULL DEFAULT 0,
  shortage NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p55602185_app_creation_project.material_check_results (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  all_available BOOLEAN NOT NULL DEFAULT FALSE,
  shortage_count INTEGER NOT NULL DEFAULT 0
);
