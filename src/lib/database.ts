import { PrismaClient } from '@prisma/client'

// Global Prisma instance with connection pooling
declare global {
  var prisma: PrismaClient | undefined
}

// Optimized Prisma configuration for performance
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
}

// Singleton pattern for Prisma client
export const prisma = globalThis.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

// Simple in-memory cache for frequently accessed data
class SimpleCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>()

  set(key: string, data: any, ttlSeconds: number = 300) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000
    })
  }

  get(key: string): any | null {
    const item = this.cache.get(key)
    if (!item) return null

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }

    return item.data
  }

  delete(key: string) {
    this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
  }

  // Clean expired entries
  cleanup() {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

export const cache = new SimpleCache()

// Cleanup expired cache entries every 5 minutes
setInterval(() => {
  cache.cleanup()
}, 5 * 60 * 1000)

// Optimized database queries
export class DatabaseService {
  // Fast user lookup with caching
  static async getUserById(id: string) {
    const cacheKey = `user:${id}`
    let user = cache.get(cacheKey)
    
    if (!user) {
      user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          profilePicture: true,
          createdAt: true,
          isEmailVerified: true
        }
      })
      
      if (user) {
        cache.set(cacheKey, user, 600) // Cache for 10 minutes
      }
    }
    
    return user
  }

  // Fast user lookup by email with caching
  static async getUserByEmail(email: string) {
    const cacheKey = `user:email:${email}`
    let user = cache.get(cacheKey)
    
    if (!user) {
      user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          password: true,
          isEmailVerified: true
        }
      })
      
      if (user) {
        cache.set(cacheKey, user, 300) // Cache for 5 minutes
      }
    }
    
    return user
  }

  // Optimized messages query with pagination and deleted message filtering
  static async getMessages(senderId: string, receiverId: string, limit: number = 50, offset: number = 0) {
    return await prisma.message.findMany({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId }
        ],
        AND: [
          // Filter out messages deleted by the current user (senderId in this context)
          {
            OR: [
              { deletedFor: null },
              { deletedFor: { not: senderId } }
            ]
          }
        ]
      },
      include: {
        sender: {
          select: { id: true, name: true, username: true, email: true }
        },
        receiver: {
          select: { id: true, name: true, username: true, email: true }
        }
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset
    })
  }

  // Optimized unread counts query
  static async getUnreadCounts(userId: string) {
    const cacheKey = `unread:${userId}`
    let counts = cache.get(cacheKey)
    
    if (!counts) {
      const unreadCounts = await prisma.message.groupBy({
        by: ['senderId'],
        where: {
          receiverId: userId,
          readAt: null
        },
        _count: {
          id: true
        }
      })

      counts = unreadCounts.reduce((acc: Record<string, number>, item: any) => {
        acc[item.senderId] = item._count.id
        return acc
      }, {} as Record<string, number>)
      
      cache.set(cacheKey, counts, 30) // Cache for 30 seconds
    }
    
    return counts
  }

  // Optimized interacted users query
  static async getInteractedUsers(currentUserId: string) {
    const cacheKey = `interacted:${currentUserId}`
    let users = cache.get(cacheKey)
    
    if (!users) {
      // Mark messages as delivered when user comes online
      await prisma.message.updateMany({
        where: {
          receiverId: currentUserId,
          deliveredAt: null
        },
        data: {
          deliveredAt: new Date()
        }
      })

      // Get users with optimized query
      users = await prisma.user.findMany({
        where: {
          OR: [
            {
              sentMessages: {
                some: {
                  receiverId: currentUserId
                }
              }
            },
            {
              receivedMessages: {
                some: {
                  senderId: currentUserId
                }
              }
            }
          ]
        },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      
      cache.set(cacheKey, users, 60) // Cache for 1 minute
    }
    
    return users
  }

  // Fast search users with caching
  static async searchUsers(query: string, currentUserId: string, limit: number = 20) {
    const cacheKey = `search:${query}:${currentUserId}`
    let users = cache.get(cacheKey)
    
    if (!users) {
      users = await prisma.user.findMany({
        where: {
          AND: [
            { id: { not: currentUserId } },
            {
              OR: [
                { username: { contains: query, mode: 'insensitive' } },
                { name: { contains: query, mode: 'insensitive' } }
              ]
            }
          ]
        },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          createdAt: true
        },
        take: limit,
        orderBy: [
          { username: 'asc' },
          { name: 'asc' }
        ]
      })
      
      cache.set(cacheKey, users, 120) // Cache for 2 minutes
    }
    
    return users
  }

  // Batch message operations for better performance
  static async markMessagesAsRead(senderId: string, receiverId: string) {
    const result = await prisma.message.updateMany({
      where: {
        senderId,
        receiverId,
        readAt: null
      },
      data: {
        read: true,
        readAt: new Date()
      }
    })

    // Invalidate unread count cache
    cache.delete(`unread:${receiverId}`)
    
    return result
  }

  // Optimized message creation
  static async createMessage(senderId: string, receiverId: string, content: string, isReceiverOnline: boolean = false) {
    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        senderId,
        receiverId,
        sentAt: new Date(),
        deliveredAt: isReceiverOnline ? new Date() : null
      },
      include: {
        sender: {
          select: { id: true, name: true, username: true, email: true }
        },
        receiver: {
          select: { id: true, name: true, username: true, email: true }
        }
      }
    })

    // Invalidate relevant caches
    cache.delete(`unread:${receiverId}`)
    cache.delete(`interacted:${senderId}`)
    cache.delete(`interacted:${receiverId}`)
    
    return message
  }

  // Bulk mark messages as delivered
  static async markMessagesAsDelivered(userId: string) {
    const result = await prisma.message.updateMany({
      where: {
        receiverId: userId,
        deliveredAt: null
      },
      data: {
        deliveredAt: new Date()
      }
    })

    return result
  }

  // Clear user caches (useful when user data changes)
  static clearUserCache(userId: string) {
    cache.delete(`user:${userId}`)
    cache.delete(`unread:${userId}`)
    cache.delete(`interacted:${userId}`)
  }
}

export default DatabaseService