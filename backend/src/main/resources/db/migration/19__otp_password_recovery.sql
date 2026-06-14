-- Add OTP code support to password reset tokens for V17 portfolio feature B
ALTER TABLE password_reset_tokens ADD COLUMN otp_code VARCHAR(10);
