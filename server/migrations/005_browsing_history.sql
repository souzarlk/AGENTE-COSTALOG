-- Histórico de navegação lido pelo agente 0.5.0+ (endereço completo, título, navegador e usuário)
ALTER TABLE browsing_events ADD COLUMN IF NOT EXISTS url VARCHAR(2048) NOT NULL DEFAULT '';
ALTER TABLE browsing_events ADD COLUMN IF NOT EXISTS page_title VARCHAR(300) NOT NULL DEFAULT '';
ALTER TABLE browsing_events ADD COLUMN IF NOT EXISTS browser VARCHAR(40) NOT NULL DEFAULT '';
ALTER TABLE browsing_events ADD COLUMN IF NOT EXISTS windows_user VARCHAR(160) NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_browse_device_time ON browsing_events(device_id,occurred_at)
