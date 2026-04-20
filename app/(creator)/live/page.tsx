import { LiveConsole } from "@/components/creator/LiveConsole";

export default function LivePage() {
  return (
    <div className="px-4 md:px-6 py-4 min-h-screen lg:h-[100dvh] overflow-x-hidden lg:overflow-hidden flex flex-col">
      <div className="mx-auto flex w-full max-w-[1440px] flex-1">
        <LiveConsole />
      </div>
    </div>
  );
}
