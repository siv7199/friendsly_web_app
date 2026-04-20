import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  await request.json().catch(() => null);

  if (!params.token?.trim()) {
    return NextResponse.json({ error: "Missing access token." }, { status: 400 });
  }

  return NextResponse.json(
    { error: "Please sign in and claim this booking before joining." },
    { status: 403 }
  );
}
