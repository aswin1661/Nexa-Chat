import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { pendingRegistrations } from "../../../../lib/pendingRegistrations"

const prisma = new PrismaClient()

// Generate a new verification token
function generateVerificationToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function POST(request: NextRequest) {
  try {
    const { email, token } = await request.json()

    console.log("=== EMAIL VERIFICATION ATTEMPT ===")
    console.log("Received email:", email)
    console.log("Received token:", token)

    if (!email || !token) {
      return NextResponse.json(
        { error: "Email and verification token are required" },
        { status: 400 }
      )
    }

    console.log("Current pending registrations:")
    for (const [pendingToken, registration] of pendingRegistrations.entries()) {
      console.log(`Token: ${pendingToken}, Email: ${registration.email}, Expires: ${registration.expiresAt}`)
    }

    // Find the pending registration by token
    const pendingRegistration = pendingRegistrations.get(token)

    console.log("Found pending registration:", pendingRegistration ? "YES" : "NO")

    if (!pendingRegistration) {
      console.log("❌ Token not found in pending registrations")
      return NextResponse.json(
        { error: "Invalid or expired verification token" },
        { status: 400 }
      )
    }

    // Check if the email matches
    console.log("Email comparison:", { provided: email, stored: pendingRegistration.email, match: pendingRegistration.email === email })
    
    if (pendingRegistration.email !== email) {
      console.log("❌ Email mismatch")
      return NextResponse.json(
        { error: "Email does not match the verification token" },
        { status: 400 }
      )
    }

    // Check if token is expired
    const now = new Date()
    const isExpired = pendingRegistration.expiresAt < now
    console.log("Expiration check:", { now, expires: pendingRegistration.expiresAt, isExpired })
    
    if (isExpired) {
      pendingRegistrations.delete(token)
      console.log("❌ Token expired")
      return NextResponse.json(
        { error: "Verification token has expired. Please register again." },
        { status: 400 }
      )
    }

    // Check if user already exists in database (safety check)
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      pendingRegistrations.delete(token)
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      )
    }

    // Create the user in the database now that email is verified
    const user = await prisma.user.create({
      data: {
        name: pendingRegistration.name,
        username: pendingRegistration.username,
        email: pendingRegistration.email,
        password: pendingRegistration.hashedPassword,
        isEmailVerified: true, // Email is verified
        emailVerificationToken: null,
        emailVerificationExpiry: null
      }
    })

    // Remove the pending registration
    pendingRegistrations.delete(token)

    console.log(`User created successfully after email verification: ${user.email}`)

    return NextResponse.json(
      { 
        message: "Email verified successfully! Your account has been created.",
        userId: user.id
      },
      { status: 200 }
    )

  } catch (error) {
    console.error("Email verification error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // Find existing pending registration by email
    let existingToken: string | null = null
    for (const [token, registration] of pendingRegistrations.entries()) {
      if (registration.email === email) {
        existingToken = token
        break
      }
    }

    if (!existingToken) {
      return NextResponse.json(
        { error: "No pending registration found for this email. Please register first." },
        { status: 400 }
      )
    }

    const pendingRegistration = pendingRegistrations.get(existingToken)!

    // Remove old token
    pendingRegistrations.delete(existingToken)

    // Generate new verification token
    const newVerificationToken = generateVerificationToken()
    const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Store with new token
    pendingRegistrations.set(newVerificationToken, {
      ...pendingRegistration,
      verificationToken: newVerificationToken,
      expiresAt: newExpiresAt
    })

    // In production, send new verification email here
    console.log(`New verification token for ${email}: ${newVerificationToken}`)

    return NextResponse.json(
      { 
        message: "New verification email sent",
        // Remove this in production - only for demo
        verificationToken: newVerificationToken
      },
      { status: 200 }
    )

  } catch (error) {
    console.error("Resend verification error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}