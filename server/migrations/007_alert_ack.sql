-- Alertas críticos lidos/não lidos (notificações do painel)
ALTER TABLE device_events ADD COLUMN IF NOT EXISTS acknowledged_at DATETIME(3) NULL;
ALTER TABLE device_events ADD COLUMN IF NOT EXISTS acknowledged_by CHAR(36) NULL;
CREATE INDEX IF NOT EXISTS idx_event_alerts ON device_events(severity,acknowledged_at,created_at);
CREATE INDEX IF NOT EXISTS idx_event_device_time ON device_events(device_id,created_at)
