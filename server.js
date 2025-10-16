const { createServer } = require('http')
const { parse } = require('url')
const path = require('path')
const next = require('next')
const { Server } = require('socket.io')
const { PrismaClient } = require('@prisma/client')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'
const port = parseInt(process.env.PORT || '3001', 10)

// Use the correct directory - handle both local and Vercel environments
const appDir = process.env.NOW_REGION ? process.env.__NEXTAUTH_PROJECT_ROOT || process.cwd() : process.cwd()
const app = next({ dev, hostname, port, dir: appDir })
const handle = app.getRequestHandler()

// Initialize Prisma client with logging configuration
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn']
})

// Store active user connections and current chats
const userSockets = new Map() // userId -> socketId
const socketUsers = new Map() // socketId -> userId
const activeChats = new Map() // userId -> otherUserId (currently active chat)

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  const io = new Server(server, {
    cors: {
      origin: ['http://localhost:3001', process.env.NEXTAUTH_URL],
      methods: ["GET", "POST"],
      credentials: true
    },
    maxHttpBufferSize: 1e6, // 1 MB
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  })

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id)

    socket.on('join', async (userId) => {
      console.log(`User ${userId} joined with socket ${socket.id}`)
      
      // Handle user reconnection - remove old socket if exists
      const existingSocketId = userSockets.get(userId)
      if (existingSocketId && existingSocketId !== socket.id) {
        socketUsers.delete(existingSocketId)
        console.log(`Removed old socket ${existingSocketId} for user ${userId}`)
      }
      
      // Store user-socket mapping
      userSockets.set(userId, socket.id)
      socketUsers.set(socket.id, userId)
      
      // Join user to their own room
      socket.join(userId)
      
      // Mark messages as delivered when user comes online (optimized)
      try {
        const deliveredResult = await prisma.message.updateMany({
          where: {
            receiverId: userId,
            deliveredAt: null,
            OR: [
              { deletedFor: null },
              { deletedFor: { not: userId } }
            ]
          },
          data: {
            deliveredAt: new Date()
          }
        })
        console.log(`Marked ${deliveredResult.count} messages as delivered for user ${userId}`)
      } catch (error) {
        console.error('Error marking messages as delivered:', error)
      }
      
      // Broadcast that user is online with confirmation
      socket.broadcast.emit('userOnline', userId)
      
      // Send current online users to the newly connected user
      const onlineUserIds = Array.from(userSockets.keys())
      socket.emit('onlineUsers', onlineUserIds)
      
      console.log(`User ${userId} successfully joined. Total online: ${userSockets.size}`)
    })

    socket.on('sendMessage', async (data) => {
      const senderId = socketUsers.get(socket.id)
      if (!senderId) return

      try {
        console.log(`Message from ${senderId} to ${data.receiverId}: ${data.content}`)
        
        // Create temporary message object for instant delivery
        const tempMessage = {
          id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: data.content,
          senderId: senderId,
          receiverId: data.receiverId,
          sentAt: new Date(),
          deliveredAt: userSockets.has(data.receiverId) ? new Date() : null,
          readAt: null,
          sender: { id: senderId, name: data.senderName || 'User', username: data.senderUsername || 'user', email: data.senderEmail || '' },
          receiver: { id: data.receiverId, name: '', username: '', email: '' }
        }

        // Send to receiver INSTANTLY if online (before database save)
        const receiverSocketId = userSockets.get(data.receiverId)
        const isChatActive = activeChats.get(data.receiverId) === senderId
        
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('newMessage', tempMessage)
          
          // Only send notification if chat is not currently active
          if (!isChatActive) {
            io.to(receiverSocketId).emit('notification', {
              type: 'message',
              from: senderId,
              content: data.content,
              timestamp: new Date().toISOString()
            })
          }
        }

        // Save to database asynchronously (non-blocking)
        setImmediate(async () => {
          try {
            const message = await prisma.message.create({
              data: {
                content: data.content,
                senderId: senderId,
                receiverId: data.receiverId,
                sentAt: new Date(),
                deliveredAt: userSockets.has(data.receiverId) ? new Date() : null
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

            // Send confirmation to sender with real message ID
            socket.emit('newMessage', message)
            
            // Update the receiver with real message ID if still online
            if (receiverSocketId) {
              io.to(receiverSocketId).emit('messageUpdate', { 
                tempId: tempMessage.id, 
                realMessage: message 
              })
              
              // Update unread count asynchronously
              const unreadCount = await prisma.message.count({
                where: {
                  receiverId: data.receiverId,
                  readAt: null
                }
              })
              
              io.to(receiverSocketId).emit('unreadCountUpdate', { 
                userId: senderId, 
                count: unreadCount 
              })
            }

            console.log('Message saved to database successfully')
          } catch (error) {
            console.error('Error saving message to database:', error)
            // Notify users of the error
            socket.emit('error', { message: 'Failed to save message' })
            if (receiverSocketId) {
              io.to(receiverSocketId).emit('messageError', { tempId: tempMessage.id })
            }
          }
        })

        console.log('Message sent instantly')
      } catch (error) {
        console.error('Error sending message:', error)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    socket.on('markAsRead', async (data) => {
      const userId = socketUsers.get(socket.id)
      if (!userId) return

      try {
        console.log(`Processing read receipt: ${data.senderId} -> ${userId}`)
        
        // Update database with simpler, more reliable query
        const result = await prisma.message.updateMany({
          where: {
            senderId: data.senderId,
            receiverId: userId,
            readAt: null
          },
          data: {
            readAt: new Date(),
            read: true
          }
        })

        console.log(`Successfully marked ${result.count} messages as read`)

        // Always notify sender about read receipt, even if count is 0 (for real-time feedback)
        const senderSocketId = userSockets.get(data.senderId)
        if (senderSocketId) {
          io.to(senderSocketId).emit('messageRead', { 
            messageId: 'bulk', 
            userId: userId,
            readAt: new Date().toISOString(),
            count: result.count
          })
        }

        // Confirm to the reader for UI consistency
        socket.emit('readConfirmed', {
          senderId: data.senderId,
          count: result.count,
          readAt: new Date().toISOString()
        })

      } catch (error) {
        console.error('Error processing read receipt:', error)
        socket.emit('readError', { senderId: data.senderId })
      }
    })

    socket.on('typing', (data) => {
      const senderId = socketUsers.get(socket.id)
      if (!senderId) return

      const receiverSocketId = userSockets.get(data.receiverId)
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('typing', {
          userId: senderId,
          isTyping: data.isTyping
        })
      }
    })

    // Track active chat sessions to prevent unnecessary notifications
    socket.on('chatOpened', (data) => {
      const userId = socketUsers.get(socket.id)
      if (userId) {
        activeChats.set(userId, data.otherUserId)
        console.log(`User ${userId} opened chat with ${data.otherUserId}`)
      }
    })

    socket.on('chatClosed', () => {
      const userId = socketUsers.get(socket.id)
      if (userId) {
        activeChats.delete(userId)
        console.log(`User ${userId} closed active chat`)
      }
    })

    socket.on('deleteMessages', async (data) => {
      const userId = socketUsers.get(socket.id);
      if (!userId) {
        console.error('No user ID found for socket:', socket.id);
        socket.emit('error', { message: 'User not found' });
        return;
      }

      try {
        const { messageIds } = data;
        console.log(`Attempting to delete ${messageIds.length} messages by user ${userId}`);

        // Use a transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
          // First verify the messages exist and belong to this user
          const messagesToDelete = await tx.message.findMany({
            where: {
              id: { in: messageIds },
              OR: [
                { senderId: userId },
                { receiverId: userId }
              ]
            },
            select: {
              id: true,
              senderId: true,
              receiverId: true
            }
          });

          if (messagesToDelete.length === 0) {
            console.log('No valid messages found to delete');
            return { deletedIds: [], affectedUsers: new Set() };
          }

          // Delete the messages
          const deleteResult = await tx.message.deleteMany({
            where: {
              id: { in: messagesToDelete.map(m => m.id) }
            }
          });

          console.log(`Successfully deleted ${deleteResult.count} messages`);

          // Collect affected users
          const affectedUsers = new Set(
            messagesToDelete.flatMap(msg => [msg.senderId, msg.receiverId])
          );
          affectedUsers.delete(userId);

          return {
            deletedIds: messagesToDelete.map(m => m.id),
            affectedUsers
          };
        });

        const { deletedIds, affectedUsers } = result;

        if (deletedIds.length > 0) {
          // Notify the sender that messages were deleted
          socket.emit('messagesDeleted', { messageIds: deletedIds });
          console.log('Sent delete confirmation to sender');

          // Notify other affected users
          affectedUsers.forEach(affectedUserId => {
            const receiverSocketId = userSockets.get(affectedUserId);
            if (receiverSocketId) {
              io.to(receiverSocketId).emit('messagesDeleted', { messageIds: deletedIds });
              console.log(`Sent delete notification to affected user ${affectedUserId}`);
            }
          });
        }

        // Send final success confirmation
        socket.emit('deleteConfirmed', { success: true, count: deletedIds.length });

      } catch (error) {
        console.error('Error deleting messages:', error);
        socket.emit('error', { message: 'Failed to delete messages' });
        socket.emit('deleteConfirmed', { success: false, error: error.message });
      }
    });

    socket.on('clearChat', async (data) => {
      const userId = socketUsers.get(socket.id);
      if (!userId) {
        console.error('No user ID found for socket:', socket.id);
        socket.emit('error', { message: 'User not found' });
        return;
      }

      try {
        console.log(`Clearing chat between users ${userId} and ${data.userId}`);
        
        // Start a transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
          // Get all messages between these users
          const messages = await tx.message.findMany({
            where: {
              OR: [
                {
                  senderId: userId,
                  receiverId: data.userId
                },
                {
                  senderId: data.userId,
                  receiverId: userId
                }
              ]
            },
            select: {
              id: true
            }
          });

          console.log(`Found ${messages.length} messages to delete`);

          if (messages.length > 0) {
            // Delete all messages between these users
            const deleteResult = await tx.message.deleteMany({
              where: {
                OR: [
                  {
                    senderId: userId,
                    receiverId: data.userId
                  },
                  {
                    senderId: data.userId,
                    receiverId: userId
                  }
                ]
              }
            });

            if (deleteResult.count !== messages.length) {
              throw new Error(`Expected to delete ${messages.length} messages but deleted ${deleteResult.count}`);
            }

            console.log(`Successfully deleted ${deleteResult.count} messages from database`);
            return messages.map(msg => msg.id);
          }
          return [];
        });

        // Only emit events if messages were actually deleted
        if (result.length > 0) {
          // Notify current user
          socket.emit('messagesDeleted', { messageIds: result });
          console.log('Sent messagesDeleted event to current user');
          
          // Notify other user
          const otherUserSocketId = userSockets.get(data.userId);
          if (otherUserSocketId) {
            io.to(otherUserSocketId).emit('messagesDeleted', { messageIds: result });
            console.log('Sent messagesDeleted event to other user');
          }
          
          // Send success confirmation
          socket.emit('chatCleared', { success: true });
        } else {
          console.log('No messages found to delete');
          socket.emit('chatCleared', { success: true });
        }

      } catch (error) {
        console.error('Error clearing chat:', error);
        socket.emit('error', { message: 'Failed to clear chat' });
        socket.emit('chatCleared', { success: false, error: error.message });
      }
    });

    socket.on('disconnect', () => {
      const userId = socketUsers.get(socket.id)
      if (userId) {
        console.log(`User ${userId} disconnected`)
        
        // Clean up mappings
        userSockets.delete(userId)
        socketUsers.delete(socket.id)
        activeChats.delete(userId) // Clean up active chat tracking
        
        // Broadcast that user is offline
        socket.broadcast.emit('userOffline', userId)
      }
    })

    socket.on('error', (error) => {
      console.error('Socket error:', error)
    })
  })

  server.listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> Socket.IO server ready`)
  })
})