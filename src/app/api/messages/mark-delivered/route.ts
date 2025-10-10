import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../auth/[...nextauth]/route"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function POST() {
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

    // Mark all undelivered messages to this user as delivered
    const result = await prisma.message.updateMany({
      where: {
        receiverId: currentUser.id,
        deliveredAt: null
      },
      data: {
        deliveredAt: new Date()
      }
    })

    return NextResponse.json({ 
      message: "Messages marked as delivered", 
      count: result.count 
    })
  } catch (error) {
    console.error("Error marking messages as delivered:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}