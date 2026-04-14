import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { roomName, isOwner = false, userName } = await req.json();

    if (!roomName) {
      return NextResponse.json({ error: "roomName is required" }, { status: 400 });
    }

    const DAILY_API_KEY = process.env.DAILY_API_KEY;
    if (!DAILY_API_KEY) {
      return NextResponse.json(
        { error: "DAILY_API_KEY is not set" },
        { status: 500 }
      );
    }

    // Create a meeting token
    const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          is_owner: isOwner,
          user_name: userName || undefined,
        },
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error("Failed to create token:", errorText);
      return NextResponse.json(
        { error: "Failed to create Daily token" },
        { status: tokenRes.status }
      );
    }

    const tokenData = await tokenRes.json();

    return NextResponse.json({
      token: tokenData.token,
    });
  } catch (error: any) {
    console.error("Server error creating token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
