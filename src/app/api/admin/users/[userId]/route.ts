import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import jwt from "jsonwebtoken"

const prisma = new PrismaClient()

// Verify admin token
function verifyAdminToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null
  }

  const token = authHeader.substring(7)
  try {
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET || "admin-secret") as any
    return decoded.isAdmin ? decoded : null
  } catch (error) {
    return null
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Verify admin authentication
    const adminData = verifyAdminToken(request)
    if (!adminData) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      )
    }

    const { userId } = await params

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Delete all related data in transaction
    await prisma.$transaction(async (tx: any) => {
      // Delete user's messages
      await tx.message.deleteMany({
        where: {
          OR: [
            { senderId: userId },
            { receiverId: userId }
          ]
        }
      })

      // Delete user's sessions and accounts (if any)
      await tx.session.deleteMany({
        where: { userId }
      })

      await tx.account.deleteMany({
        where: { userId }
      })

      // Delete the user
      await tx.user.delete({
        where: { id: userId }
      })
    })

    console.log(`Admin deleted user: ${user.email} (${user.name})`)

    return NextResponse.json(
      { 
        message: `User ${user.email} and all associated data deleted successfully`,
        deletedUser: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      },
      { status: 200 }
    )

  } catch (error) {
    console.error("Admin user deletion error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}