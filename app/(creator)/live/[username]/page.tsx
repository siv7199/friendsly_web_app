import { LiveConsole } from "@/components/creator/LiveConsole";

export default function CreatorLiveByUsernamePage() {
  return (
    <div className="px-4 md:px-6 py-4 min-h-screen lg:h-[100dvh] overflow-x-hidden lg:overflow-hidden flex flex-col">
      <div className="mx-auto w-full max-w-[1600px] flex-1 flex min-h-0">
        <LiveConsole />
      </div>
    </div>
  );
}
