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

    const { messageIds, deleteForBoth, userId, otherUserId } = await request.json()

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: 'Invalid message IDs' }, { status: 400 })
    }

    if (deleteForBoth) {
      // Delete messages completely for both users
      await prisma.message.deleteMany({
        where: {
          id: { in: messageIds },
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId }
          ]
        }
      })
    } else {
      // Mark messages as deleted for current user only
      await prisma.message.updateMany({
        where: {
          id: { in: messageIds },
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId }
          ]
        },
        data: {
          // Add a deletedFor field to track who deleted the message
          deletedFor: userId
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}