import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, otherUserId, deleteForBoth } = await request.json()

    if (!userId || !otherUserId) {
      return NextResponse.json({ error: 'Missing user IDs' }, { status: 400 })
    }

    if (deleteForBoth) {
      // Delete entire conversation for both users
      await prisma.message.deleteMany({
        where: {
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId }
          ]
        }
      })
    } else {
      // Mark all messages as deleted for current user only
      await prisma.message.updateMany({
        where: {
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId }
          ]
        },
        data: {
          deletedFor: userId
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error clearing chat:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}