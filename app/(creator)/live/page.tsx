import { LiveConsole } from "@/components/creator/LiveConsole";

export default function LivePage() {
  return (
    <div className="px-4 md:px-6 py-4 min-h-screen lg:h-[100dvh] overflow-x-hidden lg:overflow-hidden flex flex-col">
      <LiveConsole />
    </div>
  );
}
