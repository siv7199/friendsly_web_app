"use client";

import { ReceiptText, Video } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function PostLiveCallModal({
  open,
  onContinueWatching,
  onViewReceipts,
}: {
  open: boolean;
  onContinueWatching: () => void;
  onViewReceipts: () => void;
}) {
  return (
    <Dialog open={open} onClose={onContinueWatching}>
      <DialogContent
        className="mx-auto w-[calc(100vw-1rem)] max-w-md"
        title="Call Finished"
        description="Your live stage session has ended. What would you like to do next?"
      >
        <div className="space-y-3">
          <Button variant="live" className="w-full justify-center gap-2" onClick={onViewReceipts}>
            <ReceiptText className="h-4 w-4" />
            Go To Receipts
          </Button>
          <Button variant="outline" className="w-full justify-center gap-2" onClick={onContinueWatching}>
            <Video className="h-4 w-4" />
            Continue Watching
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
