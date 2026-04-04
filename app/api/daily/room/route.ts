import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { exp } = await req.json();

    const DAILY_API_KEY = process.env.DAILY_API_KEY;
    if (!DAILY_API_KEY) {
      return NextResponse.json(
        { error: "DAILY_API_KEY is not set" },
        { status: 500 }
      );
    }

    // 1. Create a Daily room
    const roomRes = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        privacy: "private", // Only token-holders (creator + admitted fans) can join
        properties: {
          exp: exp || Math.round(Date.now() / 1000) + 60 * 60 * 24, // default 24h
        },
      }),
    });

    if (!roomRes.ok) {
      const errorText = await roomRes.text();
      console.error("Failed to create room:", errorText);
      return NextResponse.json(
        { error: "Failed to create Daily room" },
        { status: roomRes.status }
      );
    }

    const roomData = await roomRes.json();
    const roomUrl = roomData.url;
    const roomName = roomData.name;

    // 2. Create an owner token for the creator
    const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          is_owner: true,
        },
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error("Failed to create owner token:", errorText);
      return NextResponse.json(
        { error: "Failed to create owner token" },
        { status: tokenRes.status }
      );
    }

    const tokenData = await tokenRes.json();

    return NextResponse.json({
      url: roomUrl,
      roomName,
      token: tokenData.token, // owner token
    });
  } catch (error: any) {
    console.error("Server error creating Daily room:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
