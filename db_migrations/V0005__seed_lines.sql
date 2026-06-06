
-- Заполняем линии дефолтными данными
INSERT INTO t_p55602185_app_creation_project.lines (id, name, speed, start_time) VALUES
  ('line-1', 'Линия №1', 2000, '2026-06-06 06:00:00+03'),
  ('line-2', 'Линия №2', 1800, '2026-06-06 07:00:00+03'),
  ('line-3', 'Линия №3', 2400, '2026-06-06 08:00:00+03')
ON CONFLICT (id) DO NOTHING;
