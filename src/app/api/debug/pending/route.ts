import { NextRequest, NextResponse } from "next/server"
import { pendingRegistrations } from "../../../../lib/pendingRegistrations"

export async function GET(request: NextRequest) {
  try {
    const registrations = Array.from(pendingRegistrations.entries()).map(([token, registration]) => ({
      token,
      email: registration.email,
      name: registration.name,
      expiresAt: registration.expiresAt.toISOString()
    }))

    return NextResponse.json(
      { 
        count: pendingRegistrations.size,
        registrations
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Debug endpoint error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}