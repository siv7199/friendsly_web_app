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
  console.log("--- creator-signup-notify: HEARTBEAT ---");
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("CREATOR_REQUEST_FROM_EMAIL") ||
      "Friendsly <notifications@send.friendsly.app>";
    const notifyEmail = Deno.env.get("CREATOR_REQUEST_NOTIFICATION_EMAIL") ||
      "sid.vangara@gmail.com";
    const appBaseUrl = Deno.env.get("APP_BASE_URL");

    console.log("creator-signup-notify: Config loaded", {
      hasKey: !!resendApiKey,
      hasFrom: !!fromEmail,
      hasNotify: !!notifyEmail,
    });

    if (!resendApiKey || !fromEmail || !notifyEmail || !appBaseUrl) {
      return jsonResponse({ ok: false, configured: false, delivered: false });
    }

    const body = await request.json();
    const kind = body.kind ?? "admin_request";
    const approveLink = `${appBaseUrl.replace(/\/$/, "")}/creator-request/review?action=approve&token=${encodeURIComponent(body.reviewToken ?? "")}`;
    const rejectLink = `${appBaseUrl.replace(/\/$/, "")}/creator-request/review?action=reject&token=${encodeURIComponent(body.reviewToken ?? "")}`;
    const recipients = kind === "decision"
      ? [String(body.email ?? "").trim()].filter(Boolean)
      : notifyEmail
          .split(",")
          .map((entry: string) => entry.trim())
          .filter(Boolean);

    if (recipients.length === 0) {
      return jsonResponse({ ok: false, configured: false, delivered: false });
    }

    const subject = kind === "decision"
      ? body.decision === "approved"
        ? "Your Friendsly creator account was approved"
        : "Your Friendsly creator account request was not approved"
      : `New creator request from ${body.fullName ?? "Unknown applicant"}`;

    const text = kind === "decision"
      ? [
          body.decision === "approved"
            ? "Your Friendsly creator account request was approved."
            : "Your Friendsly creator account request was not approved.",
          "",
          body.decision === "approved"
            ? "You can now log in using the password you created when you applied."
            : "You will not be able to access creator features with this request.",
          body.loginUrl ? `Login: ${body.loginUrl}` : null,
        ].filter(Boolean).join("\n")
      : [
          "New Friendsly creator account request",
          "",
          `Name: ${body.fullName}`,
          `Email: ${body.email}`,
          `Phone: ${body.phone}`,
          body.instagramUrl ? `Instagram: ${body.instagramUrl}` : null,
          body.tiktokUrl ? `TikTok: ${body.tiktokUrl}` : null,
          body.xUrl ? `X: ${body.xUrl}` : null,
          `Submitted at: ${body.createdAt}`,
          body.notes ? `Notes: ${body.notes}` : null,
          "",
          `Approve: ${approveLink}`,
          `Reject: ${rejectLink}`,
        ]
          .filter(Boolean)
          .join("\n");

    const html = kind === "decision"
      ? `
        <h2>${body.decision === "approved" ? "Creator account approved" : "Creator request update"}</h2>
        <p>
          ${body.decision === "approved"
            ? "Your Friendsly creator account request was approved."
            : "Your Friendsly creator account request was not approved."}
        </p>
        <p>
          ${body.decision === "approved"
            ? "You can now log in with the password you created when you applied."
            : "You will not be able to access creator features with this request."}
        </p>
        ${body.loginUrl ? `<p><a href="${escapeHtml(body.loginUrl)}">Log in to Friendsly</a></p>` : ""}
      `
      : `
        <h2>New Friendsly creator account request</h2>
        <p><strong>Name:</strong> ${escapeHtml(body.fullName ?? "")}</p>
        <p><strong>Email:</strong> ${escapeHtml(body.email ?? "")}</p>
        <p><strong>Phone:</strong> ${escapeHtml(body.phone ?? "")}</p>
        ${body.instagramUrl ? `<p><strong>Instagram:</strong> <a href="${escapeHtml(body.instagramUrl)}">${escapeHtml(body.instagramUrl)}</a></p>` : ""}
        ${body.tiktokUrl ? `<p><strong>TikTok:</strong> <a href="${escapeHtml(body.tiktokUrl)}">${escapeHtml(body.tiktokUrl)}</a></p>` : ""}
        ${body.xUrl ? `<p><strong>X:</strong> <a href="${escapeHtml(body.xUrl)}">${escapeHtml(body.xUrl)}</a></p>` : ""}
        <p><strong>Submitted at:</strong> ${escapeHtml(body.createdAt ?? "")}</p>
        ${body.notes ? `<p><strong>Notes:</strong> ${escapeHtml(body.notes)}</p>` : ""}
        <p><a href="${escapeHtml(approveLink)}" style="display:inline-block;padding:10px 16px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;margin-right:8px;">Approve creator</a></p>
        <p><a href="${escapeHtml(rejectLink)}" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;">Reject request</a></p>
      `;

    console.log("creator-signup-notify: Calling Resend API...");
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipients,
        reply_to: body.email,
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(8000),
    });

    await resendResponse.text();
    console.log("creator-signup-notify: Resend response received", {
      status: resendResponse.status,
      ok: resendResponse.ok,
    });

    return jsonResponse({
      ok: resendResponse.ok,
      configured: true,
      delivered: resendResponse.ok,
      resendStatus: resendResponse.status,
    });
  } catch (error) {
    console.error("creator-signup-notify: Error", error);
    return jsonResponse(
      {
        ok: false,
        configured: true,
        delivered: false,
        error: error instanceof Error ? error.message : "Unknown function error",
      },
      500
    );
  }
});
