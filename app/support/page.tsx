"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LifeBuoy, Loader2, Mail, MessageSquareText, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthContext } from "@/lib/context/AuthContext";

export default function SupportPage() {
  const { user } = useAuthContext();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [emailDelivered, setEmailDelivered] = useState<boolean | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    subject: "",
    description: "",
  });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      fullName: current.fullName || user?.full_name || "",
      email: current.email || user?.email || "",
    }));
  }, [user?.email, user?.full_name]);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not send support request.");
      }

      setSubmitted(true);
      setEmailConfigured(Boolean(data.emailNotificationConfigured));
      setEmailDelivered(data.emailNotificationSent === true);

      setForm({
        fullName: user?.full_name || "",
        email: user?.email || "",
        subject: "",
        description: "",
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not send support request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-brand-bg px-4 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-surface px-4 py-2">
            <LifeBuoy className="h-4 w-4 text-brand-primary" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink-subtle">
              Friendsly Support
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-serif font-normal text-brand-ink">How can we help?</h1>
          <p className="mt-2 text-sm text-brand-ink-subtle">
            Send us a support request and we&apos;ll follow up at <span className="font-semibold text-brand-ink">support@friendsly.app</span>.
          </p>
        </div>

        <div className="rounded-3xl border border-brand-border bg-brand-surface p-6 shadow-card md:p-8">
          {submitted ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-live/15 text-brand-live">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-brand-ink">Support request sent</h2>
                <p className="mt-2 text-sm leading-6 text-brand-ink-subtle">
                  We saved your message and sent it to our support inbox.
                </p>
                {emailConfigured === false ? (
                  <p className="mt-3 text-xs text-amber-700">
                    The request was saved, but email forwarding is not configured yet.
                  </p>
                ) : null}
                {emailConfigured !== false && emailDelivered === false ? (
                  <p className="mt-3 text-xs text-amber-700">
                    The request was saved, but the support email did not send successfully.

                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button variant="primary" size="lg" onClick={() => setSubmitted(false)}>
                  Send another request
                </Button>
                <Link href={user ? (user.role === "creator" ? "/dashboard" : "/discover") : "/"}>
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    Back to Friendsly
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Your Name"
                value={form.fullName}
                onChange={(event) => update("fullName", event.target.value)}
                icon={<User className="h-4 w-4" />}
                placeholder="Jordan Kim"
                autoComplete="name"
                required
              />
              <Input
                label="Your Email"
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                icon={<Mail className="h-4 w-4" />}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
              <Input
                label="Subject"
                value={form.subject}
                onChange={(event) => update("subject", event.target.value)}
                icon={<MessageSquareText className="h-4 w-4" />}
                placeholder="What do you need help with?"
                required
              />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="support-description" className="text-sm font-medium text-brand-ink-muted">
                  Description
                </label>
                <textarea
                  id="support-description"
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                  placeholder="Tell us what happened and what you need."
                  rows={7}
                  className="w-full rounded-xl border border-brand-border bg-brand-elevated px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-ink-subtle focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30"
                  required
                />
              </div>

              {error ? (
                <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {error}
                </p>
              ) : null}

              <div className="rounded-xl border border-brand-border bg-brand-elevated px-4 py-3 text-xs leading-5 text-brand-ink-subtle">
                Please avoid sending full card numbers, passwords, or other sensitive secrets through support.
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={
                  submitting ||
                  !form.fullName.trim() ||
                  !form.email.trim() ||
                  !form.subject.trim() ||
                  !form.description.trim()
                }
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending support request...
                  </>
                ) : (
                  "Send support request"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
