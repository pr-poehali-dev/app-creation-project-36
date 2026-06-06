
INSERT INTO t_p55602185_app_creation_project.materials
  (id, name, category, unit, stock, reserved, min_stock, supplier, next_delivery_date, price_per_unit)
  SELECT 'mat-can-033', 'Банка алюминиевая 0.33 л', 'tara', 'шт', 250000, 0, 50000, 'АО СлавИнвест', '2026-06-12', 4.20
  WHERE NOT EXISTS (SELECT 1 FROM t_p55602185_app_creation_project.materials WHERE id = 'mat-can-033');

INSERT INTO t_p55602185_app_creation_project.materials
  (id, name, category, unit, stock, reserved, min_stock, supplier, next_delivery_date, price_per_unit)
  SELECT 'mat-can-045', 'Банка алюминиевая 0.45 л', 'tara', 'шт', 80000, 0, 30000, 'АО СлавИнвест', '2026-06-15', 5.10
  WHERE NOT EXISTS (SELECT 1 FROM t_p55602185_app_creation_project.materials WHERE id = 'mat-can-045');

INSERT INTO t_p55602185_app_creation_project.materials
  (id, name, category, unit, stock, reserved, min_stock, supplier, next_delivery_date, price_per_unit)
  SELECT 'mat-can-05', 'Банка алюминиевая 0.5 л', 'tara', 'шт', 180000, 0, 50000, 'АО СлавИнвест', '2026-06-14', 5.80
  WHERE NOT EXISTS (SELECT 1 FROM t_p55602185_app_creation_project.materials WHERE id = 'mat-can-05');

INSERT INTO t_p55602185_app_creation_project.materials
  (id, name, category, unit, stock, reserved, min_stock, supplier, next_delivery_date, price_per_unit)
  SELECT 'mat-lid', 'Крышка Pull-tab', 'tara', 'шт', 430000, 0, 100000, 'ООО КрышкиПром', '2026-06-11', 1.10
  WHERE NOT EXISTS (SELECT 1 FROM t_p55602185_app_creation_project.materials WHERE id = 'mat-lid');

INSERT INTO t_p55602185_app_creation_project.materials
  (id, name, category, unit, stock, reserved, min_stock, supplier, next_delivery_date, price_per_unit)
  SELECT 'mat-sleeve', 'Sleeve термоусадочный', 'packaging', 'шт', 95000, 0, 20000, 'ООО ПолиПак', '2026-06-13', 1.80
  WHERE NOT EXISTS (SELECT 1 FROM t_p55602185_app_creation_project.materials WHERE id = 'mat-sleeve');

INSERT INTO t_p55602185_app_creation_project.materials
  (id, name, category, unit, stock, reserved, min_stock, supplier, next_delivery_date, price_per_unit)
  SELECT 'mat-sugar', 'Сахар-песок', 'raw', 'кг', 8500, 0, 2000, 'АО Сахком', '2026-06-10', 52.00
  WHERE NOT EXISTS (SELECT 1 FROM t_p55602185_app_creation_project.materials WHERE id = 'mat-sugar');

INSERT INTO t_p55602185_app_creation_project.materials
  (id, name, category, unit, stock, reserved, min_stock, supplier, next_delivery_date, price_per_unit)
  SELECT 'mat-co2', 'Углекислота CO₂', 'raw', 'кг', 1200, 0, 200, 'ГазПром СПГ', '2026-06-09', 38.00
  WHERE NOT EXISTS (SELECT 1 FROM t_p55602185_app_creation_project.materials WHERE id = 'mat-co2');

INSERT INTO t_p55602185_app_creation_project.materials
  (id, name, category, unit, stock, reserved, min_stock, supplier, next_delivery_date, price_per_unit)
  SELECT 'mat-hz', 'Честный знак (КМ)', 'marking', 'шт', 320000, 0, 50000, 'ЦРПТ', '2026-06-08', 0.60
  WHERE NOT EXISTS (SELECT 1 FROM t_p55602185_app_creation_project.materials WHERE id = 'mat-hz');

INSERT INTO t_p55602185_app_creation_project.materials
  (id, name, category, unit, stock, reserved, min_stock, supplier, next_delivery_date, price_per_unit)
  SELECT 'mat-stretch', 'Стрейч-плёнка', 'packaging', 'рул', 180, 0, 30, 'ООО ПолиПак', '2026-06-15', 420.00
  WHERE NOT EXISTS (SELECT 1 FROM t_p55602185_app_creation_project.materials WHERE id = 'mat-stretch');

INSERT INTO t_p55602185_app_creation_project.materials
  (id, name, category, unit, stock, reserved, min_stock, supplier, next_delivery_date, price_per_unit)
  SELECT 'mat-pallet', 'Поддон деревянный', 'packaging', 'шт', 240, 0, 50, 'ООО ПаллетСнаб', '2026-06-17', 380.00
  WHERE NOT EXISTS (SELECT 1 FROM t_p55602185_app_creation_project.materials WHERE id = 'mat-pallet');

INSERT INTO t_p55602185_app_creation_project.materials
  (id, name, category, unit, stock, reserved, min_stock, supplier, next_delivery_date, price_per_unit)
  SELECT 'mat-cardboard', 'Межрядный картон', 'packaging', 'шт', 12000, 0, 3000, 'ООО КартонТорг', '2026-06-14', 8.50
  WHERE NOT EXISTS (SELECT 1 FROM t_p55602185_app_creation_project.materials WHERE id = 'mat-cardboard');

INSERT INTO t_p55602185_app_creation_project.materials
  (id, name, category, unit, stock, reserved, min_stock, supplier, next_delivery_date, price_per_unit)
  SELECT 'mat-sticker', 'Групповой стикер', 'marking', 'шт', 45000, 0, 10000, 'ООО ЭтоЭтикетка', '2026-06-11', 0.35
  WHERE NOT EXISTS (SELECT 1 FROM t_p55602185_app_creation_project.materials WHERE id = 'mat-sticker');
