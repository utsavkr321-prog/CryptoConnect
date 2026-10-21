-- Preserve pre-existing envelopes as legacy encrypted rows. Their session-only
-- decryption keys were never persisted, so the content cannot be recovered.
ALTER TABLE encrypted_messages RENAME TO messages;

ALTER TABLE messages RENAME COLUMN ciphertext TO legacy_ciphertext;
ALTER TABLE messages RENAME COLUMN iv TO legacy_iv;
ALTER TABLE messages RENAME COLUMN algorithm TO legacy_algorithm;

ALTER TABLE messages
  ADD COLUMN content text,
  ADD COLUMN message_format varchar(32) NOT NULL DEFAULT 'LEGACY_ENCRYPTED';

ALTER TABLE messages
  ALTER COLUMN legacy_ciphertext DROP NOT NULL,
  ALTER COLUMN legacy_iv DROP NOT NULL,
  ALTER COLUMN legacy_algorithm DROP NOT NULL;

ALTER TABLE messages
  ADD CONSTRAINT ck_messages_format_content CHECK (
    (message_format = 'TEXT' AND content IS NOT NULL AND length(content) BETWEEN 1 AND 4000
      AND btrim(content) <> '' AND legacy_ciphertext IS NULL AND legacy_iv IS NULL AND legacy_algorithm IS NULL)
    OR
    (message_format = 'LEGACY_ENCRYPTED' AND content IS NULL
      AND legacy_ciphertext IS NOT NULL AND legacy_iv IS NOT NULL AND legacy_algorithm IS NOT NULL)
  );
