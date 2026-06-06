
-- Добавляем order_index в orders и batches для сортировки DnD
ALTER TABLE t_p55602185_app_creation_project.orders
  ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;

ALTER TABLE t_p55602185_app_creation_project.batches
  ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;

-- Заполняем order_index по created_at для orders
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) - 1 AS rn
  FROM t_p55602185_app_creation_project.orders
)
UPDATE t_p55602185_app_creation_project.orders o
SET order_index = r.rn
FROM ranked r WHERE o.id = r.id;

-- Заполняем order_index по start_time внутри каждой линии для batches
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY line_id ORDER BY start_time ASC NULLS LAST) - 1 AS rn
  FROM t_p55602185_app_creation_project.batches
)
UPDATE t_p55602185_app_creation_project.batches b
SET order_index = r.rn
FROM ranked r WHERE b.id = r.id;
