import { NextResponse } from "next/server";

export async function POST(request: Request) {
  await request.json().catch(() => null);

  return NextResponse.json(
    { error: "Guest checkout has been retired. Please sign in or create a fan account to book." },
    { status: 410 }
  );
}
