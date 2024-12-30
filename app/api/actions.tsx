"use server";

import { createClient } from "@/utils/supabase/server";
import Stripe from "stripe";

// Function to create a checkout session
export async function createCheckoutSession() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: user_data, error: userError } = await supabase
    .from("users")
    .select("stripe_id")
    .eq("id", user.id)
    .single();

  if (userError) throw new Error(userError.message);

  const session = await stripe.checkout.sessions.create({
    success_url: `${process.env.SERVER_URL!}/api/subscribe`,
    line_items: [
      {
        price: `${process.env.STRIPE_PRICE_ID!}`,
        quantity: 1,
      },
    ],
    mode: "subscription",
    customer: user_data.stripe_id,
    cancel_url: `${process.env.SERVER_URL!}/create`,
  });

  return session.url;
}

export async function createBillingPortal() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: user_data, error: userError } = await supabase
    .from("users")
    .select("stripe_id")
    .eq("id", user.id)
    .single();

  if (userError) throw new Error(userError.message);

  // check if user has any subscriptions
  const subscriptions = await stripe.subscriptions.list({
    customer: user_data.stripe_id,
  });

  if (
    subscriptions.data.length === 0 ||
    subscriptions.data[0].cancel_at !== null
  ) {
    const session = await stripe.billingPortal.sessions.create({
      customer: user_data.stripe_id,
      return_url: `${process.env.SERVER_URL!}/api/subscribe`,
    });

    return session.url;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user_data.stripe_id,
    return_url: `${process.env.SERVER_URL!}/api/subscribe`,
    flow_data: {
      type: "subscription_cancel",
      subscription_cancel: {
        subscription: subscriptions.data[0].id,
      },
      after_completion: {
        type: "redirect",
        redirect: {
          return_url: `${process.env.SERVER_URL!}/api/subscribe`,
        },
      },
    },
  });

  return session.url;
}

export async function markUserSubscribed() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: user_data, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (userError) throw new Error(userError.message);

  // check if user has any subscriptions
  const subscriptions = await stripe.subscriptions.list({
    customer: user_data.stripe_id,
  });

  // check if the user is already subscribed
  const still_subscribed =
    subscriptions.data.length > 0 && subscriptions.data[0].canceled_at === null;

  // check if the user is already subscribed
  if (still_subscribed === user_data.is_subscribed) return;

  // otherwise user has registered for a subscription
  await supabase
    .from("users")
    .update({ is_subscribed: still_subscribed })
    .eq("id", user.id);
}
