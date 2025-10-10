import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../auth/[...nextauth]/route"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Delete all messages sent and received by the user
    await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: currentUser.id },
          { receiverId: currentUser.id }
        ]
      }
    })

    // Delete the user account
    await prisma.user.delete({
      where: { id: currentUser.id }
    })

    return NextResponse.json({ 
      message: "Account deleted successfully" 
    }, { status: 200 })

  } catch (error) {
    console.error("Error deleting account:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}