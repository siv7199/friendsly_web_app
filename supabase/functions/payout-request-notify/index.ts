const corsHeaders = {
  "Access-Control-Allow-Origin": "https://friendsly.app",
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export {};

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail =
      Deno.env.get("PAYOUT_REQUEST_FROM_EMAIL") ||
      Deno.env.get("CREATOR_REQUEST_FROM_EMAIL") ||
      "Friendsly Support <support@send.friendsly.app>";
    const notifyEmail =
      Deno.env.get("PAYOUT_REQUEST_NOTIFICATION_EMAIL") ||
      Deno.env.get("CREATOR_REQUEST_NOTIFICATION_EMAIL") ||
      "sid.vangara@gmail.com";
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://friendsly.app";

    if (!resendApiKey || !fromEmail || !notifyEmail || !appBaseUrl) {
      return jsonResponse({
        ok: false,
        configured: false,
        delivered: false,
        reason: "missing_resend_config",
      });
    }

    const body = await request.json();
    const recipients = notifyEmail
      .split(",")
      .map((entry: string) => entry.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      return jsonResponse({
        ok: false,
        configured: false,
        delivered: false,
        reason: "missing_notification_recipient",
      });
    }

    const baseUrl = appBaseUrl.replace(/\/$/, "");
    const token = encodeURIComponent(String(body.reviewToken ?? ""));
    const approveLink = `${baseUrl}/creator-payouts/review?action=approve&token=${token}`;
    const rejectLink = `${baseUrl}/creator-payouts/review?action=reject&token=${token}`;
    const amount = Number(body.amount ?? 0).toFixed(2);
    const subject = `Friendsly payout request: $${amount} from ${body.creatorName ?? "Creator"}`;

    const text = [
      "New Friendsly creator payout request",
      "",
      `Creator: ${body.creatorName ?? ""}`,
      `Email: ${body.creatorEmail ?? ""}`,
      `Amount: $${amount}`,
      `Available at request: $${Number(body.withdrawableAtRequest ?? 0).toFixed(2)}`,
      `Stripe Connect account: ${body.stripeConnectAccountId ?? ""}`,
      `Requested at: ${body.requestedAt ?? ""}`,
      `Payout request ID: ${body.payoutId ?? ""}`,
      "",
      `Approve: ${approveLink}`,
      `Reject: ${rejectLink}`,
    ].join("\n");

    const html = `
      <h2>New Friendsly creator payout request</h2>
      <p><strong>Creator:</strong> ${escapeHtml(String(body.creatorName ?? ""))}</p>
      <p><strong>Email:</strong> ${escapeHtml(String(body.creatorEmail ?? ""))}</p>
      <p><strong>Amount:</strong> $${escapeHtml(amount)}</p>
      <p><strong>Available at request:</strong> $${escapeHtml(Number(body.withdrawableAtRequest ?? 0).toFixed(2))}</p>
      <p><strong>Stripe Connect account:</strong> ${escapeHtml(String(body.stripeConnectAccountId ?? ""))}</p>
      <p><strong>Requested at:</strong> ${escapeHtml(String(body.requestedAt ?? ""))}</p>
      <p><strong>Payout request ID:</strong> ${escapeHtml(String(body.payoutId ?? ""))}</p>
      <p>
        <a href="${escapeHtml(approveLink)}" style="display:inline-block;padding:10px 16px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;margin-right:8px;">Approve payout</a>
      </p>
      <p>
        <a href="${escapeHtml(rejectLink)}" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;">Reject payout</a>
      </p>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipients,
        reply_to: body.creatorEmail,
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(8000),
    });

    const resendText = await resendResponse.text();

    return jsonResponse({
      ok: resendResponse.ok,
      configured: true,
      delivered: resendResponse.ok,
      resendStatus: resendResponse.status,
      reason: resendResponse.ok ? null : "resend_rejected",
      providerMessage: resendResponse.ok ? null : resendText.slice(0, 500),
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        configured: true,
        delivered: false,
        reason: error instanceof Error ? error.name || "function_error" : "function_error",
        error: error instanceof Error ? error.message : "Unknown function error",
      },
      500
    );
  }
});
