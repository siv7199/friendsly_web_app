import { PublicBookingFlow } from "@/components/public/PublicBookingFlow";

export default function ShareableBookingPage({ params }: { params: { creatorSlug: string } }) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-brand-bg">
      <PublicBookingFlow creatorSlug={params.creatorSlug} />
    </main>
  );
}
