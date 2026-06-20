-- Create table to store FCM (Firebase Cloud Messaging) registration tokens.
-- Each user can register a device/web token to receive push notifications.
-- Tokens are stored per-user; a user can have one active token at a time.

CREATE TABLE fcm_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id),
    fcm_token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_fcm_tokens_user UNIQUE (user_id)
);

CREATE INDEX idx_fcm_tokens_user_id ON fcm_tokens(user_id);
