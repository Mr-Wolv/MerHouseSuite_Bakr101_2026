-- Add firebase_uid column to app_users for direct Firebase Auth user mapping.
--
-- The firebase_uid is the unique identifier assigned by Firebase Auth when a
-- user is created via the Admin SDK or signs in for the first time. By storing
-- it in the app_users table, the backend can:
--   - Look up the user directly from the Firebase ID token's uid claim
--     instead of relying on email-based lookup
--   - Support future migration to uid-based foreign key relationships
--   - Decouple the local user identity from the email address (which can
--     change in Firebase Auth)
--
-- This column is initially nullable because existing users were created
-- before Firebase uid tracking was added. New users created through the
-- admin console or Firebase Auth flow will have a firebase_uid set.

ALTER TABLE app_users
    ADD COLUMN firebase_uid VARCHAR(128) NULL;

-- Unique constraint matches @Column(unique = true) in AppUser entity.
CREATE UNIQUE INDEX idx_app_users_firebase_uid ON app_users(firebase_uid);
