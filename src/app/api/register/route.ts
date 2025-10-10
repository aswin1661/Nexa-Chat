import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
// import { pendingRegistrations } from "../../../lib/pendingRegistrations"
// import { sendEmail, generateVerificationEmailHTML, generateVerificationEmailText } from "../../../lib/emailService"

const prisma = new PrismaClient()

// Generate a 6-digit verification token (currently disabled)
// function generateVerificationToken(): string {
//   // Generate a random 6-digit number (100000 to 999999)
//   return Math.floor(100000 + Math.random() * 900000).toString();
// }

export async function POST(request: NextRequest) {
  try {
    const { name, username, email, password } = await request.json()

    if (!name || !username || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      )
    }

    // Validate username format (alphanumeric and underscores only)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: "Username can only contain letters, numbers, and underscores" },
        { status: 400 }
      )
    }

    if (username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { error: "Username must be between 3 and 20 characters" },
        { status: 400 }
      )
    }

    // Check if user already exists in database
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    })

    if (existingUser) {
      if (existingUser.email === email) {
        return NextResponse.json(
          { error: "Email already exists" },
          { status: 400 }
        )
      } else {
        return NextResponse.json(
          { error: "Username already taken" },
          { status: 400 }
        )
      }
    }

    // TEMPORARILY SKIP EMAIL VERIFICATION - No pending registration check needed
    // When email verification is enabled, uncomment the check below

    /*
    // Check if there's already a pending registration for this email
    const existingPending = Array.from(pendingRegistrations.values()).find(
      registration => registration.email === email
    )

    if (existingPending) {
      // Resend verification logic would go here
      return NextResponse.json(
        { 
          message: "A verification email has already been sent to this address.",
          email: email
        },
        { status: 200 }
      )
    }
    */

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // TEMPORARILY SKIP EMAIL VERIFICATION - Create user directly
    const user = await prisma.user.create({
      data: {
        name,
        username,
        email,
        password: hashedPassword,
        isEmailVerified: true, // Skip verification for now
      }
    })

    console.log("=== USER CREATED DIRECTLY (NO EMAIL VERIFICATION) ===")
    console.log(`User: ${user.username} (${user.email})`)
    console.log(`ID: ${user.id}`)

    return NextResponse.json(
      { 
        message: "Account created successfully! You can now log in.",
        email: email,
        username: username
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}