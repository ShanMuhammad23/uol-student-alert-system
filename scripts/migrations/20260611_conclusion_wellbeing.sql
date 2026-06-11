-- Conclusion-based wellbeing metrics: N_concluded denominator, rename referral_rate_pct

ALTER TABLE effectiveness_scores_by_dimension
  ADD COLUMN IF NOT EXISTS concluded_students INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'effectiveness_scores_by_dimension'
      AND column_name = 'referral_rate_pct'
  ) THEN
    ALTER TABLE effectiveness_scores_by_dimension
      RENAME COLUMN referral_rate_pct TO conclusion_rate_pct;
  END IF;
END $$;
