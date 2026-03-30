"use client";
// Login is now handled on the main page (/).
// This redirect ensures any bookmarked /login links still work.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function LoginRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/"); }, [router]);
  return null;
}
