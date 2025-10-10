import { NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"

// Admin credentials (in production, store these securely)
const ADMIN_CREDENTIALS = {
  adminId: "4xw1n",
  password: "admin123"
}

export async function POST(request: NextRequest) {
  try {
    const { adminId, password } = await request.json()

    if (!adminId || !password) {
      return NextResponse.json(
        { error: "Admin ID and password are required" },
        { status: 400 }
      )
    }

    // Verify admin credentials
    if (adminId !== ADMIN_CREDENTIALS.adminId || password !== ADMIN_CREDENTIALS.password) {
      return NextResponse.json(
        { error: "Invalid admin credentials" },
        { status: 401 }
      )
    }

    // Generate admin JWT token
    const token = jwt.sign(
      { 
        adminId,
        isAdmin: true,
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      },
      process.env.NEXTAUTH_SECRET || "admin-secret"
    )

    return NextResponse.json(
      { 
        message: "Admin login successful",
        token 
      },
      { status: 200 }
    )

  } catch (error) {
    console.error("Admin login error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}