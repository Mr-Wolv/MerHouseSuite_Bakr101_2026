-- Add a column to store a SHA-256 hashed recovery key for each user.
-- The recovery key is generated on signup and shown once to the user.
-- It allows password reset without email delivery (which is unreliable on Firebase Spark plan).
-- The key is hashed with SHA-256 before storage; only the hash is persisted.

ALTER TABLE app_users ADD COLUMN recovery_key_hash VARCHAR(128);
