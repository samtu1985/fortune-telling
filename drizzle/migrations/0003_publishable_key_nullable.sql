-- Publishable key is now read from NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY at
-- render time. Relax the NOT NULL constraint so new packages can be created
-- without it. Existing rows are untouched.
ALTER TABLE "payment_packages" ALTER COLUMN "publishable_key" DROP NOT NULL;
