
-- Расширяем project_client_cards новыми полями карточки клиента
ALTER TABLE t_p55602185_app_creation_project.project_client_cards
  ADD COLUMN IF NOT EXISTS legal_name      text,
  ADD COLUMN IF NOT EXISTS short_name      text,
  ADD COLUMN IF NOT EXISTS location        text,
  ADD COLUMN IF NOT EXISTS legal_address   text,
  ADD COLUMN IF NOT EXISTS director        text,
  ADD COLUMN IF NOT EXISTS email           text,
  ADD COLUMN IF NOT EXISTS trademark       text,
  ADD COLUMN IF NOT EXISTS ds_type         text,
  ADD COLUMN IF NOT EXISTS pallet_scheme   text,
  ADD COLUMN IF NOT EXISTS can_label_type  text,
  ADD COLUMN IF NOT EXISTS can_color       text,
  ADD COLUMN IF NOT EXISTS lid_color       text,
  ADD COLUMN IF NOT EXISTS doc_comment     text,
  ADD COLUMN IF NOT EXISTS card_status     text NOT NULL DEFAULT 'empty',
  ADD COLUMN IF NOT EXISTS skus            jsonb,
  ADD COLUMN IF NOT EXISTS updated_at      timestamp with time zone DEFAULT now();
