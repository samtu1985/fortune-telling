import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;

export const stripe = secret
  ? new Stripe(secret, { apiVersion: "2026-03-25.dahlia" as any })
  : null;

export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return stripe;
}

export function stripeConfigStatus() {
  return {
    secretKey: Boolean(process.env.STRIPE_SECRET_KEY),
    webhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    publishableKey: Boolean(process.env.STRIPE_PUBLISHABLE_KEY),
  };
}
