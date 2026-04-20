-- Booking writes should go through server routes so payment, refund, late-fee,
-- attendance, room URL, and status changes cannot be spoofed from the browser.

DROP POLICY IF EXISTS "book_update" ON public.bookings;

CREATE POLICY "book_update"
ON public.bookings
FOR UPDATE
USING (false)
WITH CHECK (false);
