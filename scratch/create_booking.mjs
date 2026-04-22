// Quick script to create a booking between two users via Supabase service role
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://satowoyltkxkgwlfhdhd.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1. Look up both users by email
  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .in("email", ["sid.vangara@gmail.com", "sid.vangara@icloud.com"]);

  if (profilesErr) {
    console.error("Error fetching profiles:", profilesErr);
    return;
  }

  console.log("Found profiles:");
  profiles.forEach((p) => console.log(`  ${p.email} -> id=${p.id}, role=${p.role}, name=${p.full_name}`));

  // Identify creator and fan
  const creator = profiles.find((p) => p.role === "creator");
  const fan = profiles.find((p) => p.role === "fan");

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

  // 2. Get creator's packages
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
  packages.forEach((p) => console.log(`  ${p.name} — ${p.duration} min — $${p.price} (id: ${p.id})`));

  if (packages.length === 0) {
    console.error("No active packages found for creator.");
    return;
  }

  // Use the first package
  const pkg = packages[0];

  // 3. Schedule for tomorrow at 2:00 PM ET
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0); // 2 PM local
  const scheduledAt = tomorrow.toISOString();

  const price = parseFloat(pkg.price) * 1.025; // include platform fee
  const roundedPrice = Math.round(price * 100) / 100;

  console.log(`\nCreating booking:`);
  console.log(`  Package: ${pkg.name}`);
  console.log(`  Duration: ${pkg.duration} min`);
  console.log(`  Price: $${roundedPrice}`);
  console.log(`  Scheduled: ${scheduledAt}`);

  // 4. Insert booking
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
      topic: "Test booking created via script",
      stripe_payment_intent_id: null,
    })
    .select("*")
    .single();

  if (bookErr) {
    console.error("Error creating booking:", bookErr);
    return;
  }

  console.log("\n✅ Booking created successfully!");
  console.log(`  Booking ID: ${booking.id}`);
  console.log(`  Status: ${booking.status}`);
  console.log(`  Scheduled: ${booking.scheduled_at}`);
}

main().catch(console.error);
