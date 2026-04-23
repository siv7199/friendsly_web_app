// Quick script to create a Stripe-backed test booking between two users.
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const SUPABASE_URL = "https://satowoyltkxkgwlfhdhd.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
}

if (!STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2026-03-25.dahlia",
});

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

function parseTimeString(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? "");
  if (!match) {
    throw new Error(`Invalid TEST_BOOKING_TIME "${value}". Use HH:MM in 24-hour time.`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid TEST_BOOKING_TIME "${value}". Use HH:MM in 24-hour time.`);
  }

  return { hours, minutes };
}

async function main() {
  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .in("email", ["sid.vangara@gmail.com", "sid.vangara@icloud.com"]);

  if (profilesErr) {
    console.error("Error fetching profiles:", profilesErr);
    return;
  }

  console.log("Found profiles:");
  profiles.forEach((profile) => {
    console.log(`  ${profile.email} -> id=${profile.id}, role=${profile.role}, name=${profile.full_name}`);
  });

  const creator = profiles.find((profile) => profile.role === "creator");
  const fan = profiles.find((profile) => profile.role === "fan");

  if (!creator) {
    console.error("No creator found among these emails.");
    return;
  }

  if (!fan) {
    console.error("No fan found among these emails.");
    return;
  }

  console.log(`\nCreator: ${creator.email} (${creator.full_name})`);
  console.log(`Fan: ${fan.email} (${fan.full_name})`);

  const { data: packages, error: pkgErr } = await supabase
    .from("call_packages")
    .select("id, name, duration, price, is_active")
    .eq("creator_id", creator.id)
    .eq("is_active", true);

  if (pkgErr) {
    console.error("Error fetching packages:", pkgErr);
    return;
  }

  console.log("\nAvailable packages:");
  packages.forEach((pkg) => {
    console.log(`  ${pkg.name} - ${pkg.duration} min - $${pkg.price} (id: ${pkg.id})`);
  });

  if (!packages?.length) {
    console.error("No active packages found for creator.");
    return;
  }

  const pkg = packages[0];
  const scheduledLocal = new Date();
  const requestedTime = process.env.TEST_BOOKING_TIME ?? "02:01";
  const { hours, minutes } = parseTimeString(requestedTime);
  scheduledLocal.setHours(hours, minutes, 0, 0);
  const scheduledAt = scheduledLocal.toISOString();

  const roundedPrice = roundCurrency(Number(pkg.price) * 1.025);
  const amountCents = Math.round(roundedPrice * 100);
  const bookingTopic = process.env.TEST_BOOKING_TOPIC ?? `Auto-cancel + refund test booking for ${requestedTime}`;

  console.log("\nCreating booking:");
  console.log(`  Package: ${pkg.name}`);
  console.log(`  Duration: ${pkg.duration} min`);
  console.log(`  Price: $${roundedPrice}`);
  console.log(`  Scheduled: ${scheduledAt} (${scheduledLocal.toString()})`);
  console.log(`  Topic: ${bookingTopic}`);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    payment_method: "pm_card_visa",
    payment_method_types: ["card"],
    confirm: true,
    receipt_email: fan.email,
    description: `Friendsly test booking: ${pkg.name} with ${creator.full_name}`,
    metadata: {
      creatorName: creator.full_name ?? "",
      packageName: pkg.name ?? "",
      userId: fan.id,
      userEmail: fan.email ?? "",
      source: "scratch/create_booking.mjs",
    },
  });

  console.log(`  PaymentIntent: ${paymentIntent.id} (${paymentIntent.status})`);

  const { data: booking, error: bookErr } = await supabase
    .from("bookings")
    .insert({
      creator_id: creator.id,
      fan_id: fan.id,
      package_id: pkg.id,
      scheduled_at: scheduledAt,
      duration: pkg.duration,
      price: roundedPrice,
      status: "upcoming",
      topic: bookingTopic,
      stripe_payment_intent_id: paymentIntent.id,
    })
    .select("*")
    .single();

  if (bookErr) {
    await stripe.refunds.create({
      payment_intent: paymentIntent.id,
      amount: amountCents,
    });
    console.error("Error creating booking:", bookErr);
    return;
  }

  console.log("\nBooking created successfully.");
  console.log(`  Booking ID: ${booking.id}`);
  console.log(`  Status: ${booking.status}`);
  console.log(`  Scheduled: ${booking.scheduled_at}`);
  console.log(`  PaymentIntent: ${booking.stripe_payment_intent_id}`);
}

main().catch(console.error);
