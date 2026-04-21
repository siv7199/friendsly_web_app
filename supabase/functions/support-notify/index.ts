const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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
      Deno.env.get("SUPPORT_REQUEST_FROM_EMAIL") ||
      Deno.env.get("CREATOR_REQUEST_FROM_EMAIL");
    const notifyEmail =
      Deno.env.get("SUPPORT_REQUEST_NOTIFICATION_EMAIL") ||
      "support@friendsly.app";

    if (!resendApiKey || !fromEmail || !notifyEmail) {
      return jsonResponse({ ok: false, configured: false, delivered: false });
    }

    const body = await request.json();
    const recipients = notifyEmail
      .split(",")
      .map((entry: string) => entry.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      return jsonResponse({ ok: false, configured: false, delivered: false });
    }

    const subject = `Friendsly support: ${String(body.subject ?? "New request").trim()}`;
    const text = [
      "New Friendsly support request",
      "",
      `Name: ${body.fullName ?? ""}`,
      `Email: ${body.email ?? ""}`,
      `Subject: ${body.subject ?? ""}`,
      `Submitted at: ${body.createdAt ?? ""}`,
      "",
      "Description:",
      `${body.description ?? ""}`,
    ].join("\n");

    const html = `
      <h2>New Friendsly support request</h2>
      <p><strong>Name:</strong> ${escapeHtml(String(body.fullName ?? ""))}</p>
      <p><strong>Email:</strong> ${escapeHtml(String(body.email ?? ""))}</p>
      <p><strong>Subject:</strong> ${escapeHtml(String(body.subject ?? ""))}</p>
      <p><strong>Submitted at:</strong> ${escapeHtml(String(body.createdAt ?? ""))}</p>
      <p><strong>Description:</strong></p>
      <p style="white-space:pre-wrap;">${escapeHtml(String(body.description ?? ""))}</p>
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
        reply_to: body.email,
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(8000),
    });

    await resendResponse.text();

    return jsonResponse({
      ok: resendResponse.ok,
      configured: true,
      delivered: resendResponse.ok,
      resendStatus: resendResponse.status,
    });
  } catch (error) {
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
