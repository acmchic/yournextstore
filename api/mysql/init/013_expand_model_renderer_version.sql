-- The ai-model-v1 renderer version includes a 64-character source checksum.
ALTER TABLE mockup_templates
  MODIFY COLUMN renderer_version varchar(80) NOT NULL DEFAULT 'v3-sharp';

INSERT IGNORE INTO schema_migrations (version) VALUES ('013_expand_model_renderer_version');
