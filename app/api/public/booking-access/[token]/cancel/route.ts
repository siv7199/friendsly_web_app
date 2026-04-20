import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: { token: string } }
) {
  if (!params.token?.trim()) {
    return NextResponse.json({ error: "Missing access token." }, { status: 400 });
  }

  return NextResponse.json(
    { error: "Please sign in and claim this booking before cancelling it." },
    { status: 403 }
  );
}
