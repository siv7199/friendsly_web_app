"use client";
// Sign-up is now handled on the main page (/).
// This redirect ensures any old /signup links still work.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function SignupRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/?tab=signup"); }, [router]);
  return null;
}
