-- Add verification token fields to contractors table
ALTER TABLE contractors 
ADD COLUMN IF NOT EXISTS verification_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_contractors_verification_token ON contractors(verification_token);

-- Function to generate secure tokens
CREATE OR REPLACE FUNCTION generate_verification_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;