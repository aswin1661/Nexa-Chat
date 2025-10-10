import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]/route"
import DatabaseService from "../../../lib/database"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const currentUser = await DatabaseService.getUserByEmail(session.user.email)

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Mark all undelivered messages to this user as delivered when they come online
    await DatabaseService.markMessagesAsDelivered(currentUser.id)

    // Get search query from URL parameters
    const url = new URL(request.url)
    const searchQuery = url.searchParams.get('q')

    let users
    if (searchQuery) {
      // Use optimized search with caching
      users = await DatabaseService.searchUsers(searchQuery, currentUser.id)
    } else {
      // Get all users except current user (with limit for performance)
      users = await DatabaseService.searchUsers('', currentUser.id, 100)
    }

    return NextResponse.json(users)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}