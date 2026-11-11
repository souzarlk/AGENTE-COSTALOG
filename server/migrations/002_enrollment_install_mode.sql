ALTER TABLE enrollment_tokens
  ADD COLUMN IF NOT EXISTS install_mode VARCHAR(32) NOT NULL DEFAULT 'certificate-and-web';
