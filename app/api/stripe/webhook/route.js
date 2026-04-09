import Stripe from "stripe";
import { NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function getAdminDb() {
  if (getApps().length === 0) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_SDK)) });
  }
  return getFirestore();
}

export async function POST(req) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  const db = getAdminDb();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId || session.client_reference_id;
    const customerId = session.customer;
    if (userId) {
      await db.collection("users").doc(userId).update({
        isPremium: true,
        stripeCustomerId: customerId,
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const customerId = sub.customer;
    const snap = await db.collection("users").where("stripeCustomerId", "==", customerId).limit(1).get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({ isPremium: false });
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    const customerId = invoice.customer;
    const snap = await db.collection("users").where("stripeCustomerId", "==", customerId).limit(1).get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({ isPremium: false });
    }
  }

  return NextResponse.json({ received: true });
}

export const dynamic = "force-dynamic";
