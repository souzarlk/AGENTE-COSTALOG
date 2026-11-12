-- Saúde física dos discos (SSD/HDD) enviada pelo agente 0.4.0+
ALTER TABLE device_disks ADD COLUMN IF NOT EXISTS wear_percent DECIMAL(5,2) NULL;
ALTER TABLE device_disks ADD COLUMN IF NOT EXISTS disk_model VARCHAR(160) NOT NULL DEFAULT ''
