import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

// Generate a simple random token (in production, use crypto.randomBytes)
function generateResetToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function POST(request: NextRequest) {
  try {
    const { email, token, newPassword } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // If only email is provided, initiate password reset
    if (!token && !newPassword) {
      const user = await prisma.user.findUnique({
        where: { email }
      })

      if (!user) {
        // Don't reveal if user exists or not for security
        return NextResponse.json(
          { message: "If an account with this email exists, you will receive reset instructions." },
          { status: 200 }
        )
      }

      // In a real application, you would send an email with this token
      const resetToken = generateResetToken()
      const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

      // Store reset token in user record (you might want a separate table for this)
      await prisma.user.update({
        where: { email },
        data: {
          // We'll add these fields to the schema
          resetToken,
          resetTokenExpiry
        }
      })

      // In production, send email here
      console.log(`Password reset token for ${email}: ${resetToken}`)

      return NextResponse.json(
        { 
          message: "Password reset instructions sent to your email.",
          // Remove this in production - only for demo
          resetToken 
        },
        { status: 200 }
      )
    }

    // If token and newPassword are provided, reset the password
    if (token && newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters long" },
          { status: 400 }
        )
      }

      const user = await prisma.user.findFirst({
        where: {
          email,
          resetToken: token,
          resetTokenExpiry: {
            gt: new Date()
          }
        }
      })

      if (!user) {
        return NextResponse.json(
          { error: "Invalid or expired reset token" },
          { status: 400 }
        )
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12)

      // Update password and clear reset token
      // Also set email as verified since they can access their email
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null,
          isEmailVerified: true
        }
      })

      return NextResponse.json(
        { message: "Password successfully reset" },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    )

  } catch (error) {
    console.error("Password reset error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}