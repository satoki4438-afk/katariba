import Stripe from "stripe";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const BASE_URL = (
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://tas-katariba.jp")
).trim().replace(/\/$/, "").replace(/^(https?:\/\/)www\./, "$1");

export async function POST(req) {
  const { customerId } = await req.json();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${BASE_URL}/profile`,
  });

  return NextResponse.json({ url: session.url });
}
