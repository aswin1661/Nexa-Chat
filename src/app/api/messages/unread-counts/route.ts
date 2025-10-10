import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../auth/[...nextauth]/route"
import DatabaseService from "../../../../lib/database"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const currentUser = await DatabaseService.getUserByEmail(session.user.email)

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Use optimized database service with caching
    const countsMap = await DatabaseService.getUnreadCounts(currentUser.id)

    return NextResponse.json(countsMap)
  } catch (error) {
    console.error("Error fetching unread counts:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}