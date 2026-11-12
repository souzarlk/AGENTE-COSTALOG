-- Chave única de cada visita, para o agente poder reenviar o histórico sem duplicar
ALTER TABLE browsing_events ADD COLUMN IF NOT EXISTS visit_key CHAR(40) NULL;
UPDATE IGNORE browsing_events SET visit_key=SHA1(CONCAT(browser,'|',windows_user,'|',ROUND(UNIX_TIMESTAMP(occurred_at)*1000),'|',url)) WHERE visit_key IS NULL AND url<>'';
-- Visitas repetidas no mesmo milissegundo (redirecionamentos/recargas): mantém a chave só em uma
UPDATE browsing_events b JOIN (SELECT device_id,visit_key,MIN(id) AS keep_id FROM browsing_events WHERE visit_key IS NOT NULL GROUP BY device_id,visit_key HAVING COUNT(*)>1) d ON b.device_id=d.device_id AND b.visit_key=d.visit_key AND b.id<>d.keep_id SET b.visit_key=NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_browse_visit ON browsing_events(device_id,visit_key)
