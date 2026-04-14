import Stripe from "stripe";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PRICE_ID = "price_1TKFz5CVs98wAKwVq0rwNwhd";
const BASE_URL = (
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://tas-katariba.jp")
).trim().replace(/\/$/, "").replace(/^(https?:\/\/)www\./, "$1");

export async function POST(req) {
  try {
    const { userId, email } = await req.json();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${BASE_URL}/premium/success`,
      cancel_url: `${BASE_URL}/premium`,
      client_reference_id: userId,
      customer_email: email,
      metadata: { userId },
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[stripe/checkout]", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
