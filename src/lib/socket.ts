import { io, Socket } from 'socket.io-client'
import type { Message } from './types'

interface ServerToClientEvents {
  newMessage: (message: Message) => void
  messageUpdate: (data: { tempId: string; realMessage: Message }) => void
  messageError: (data: { tempId: string }) => void
  messageDelivered: (data: { messageId: string; userId: string }) => void
  messageRead: (data: { messageId: string; userId: string; readAt?: string; count?: number }) => void
  readConfirmed: (data: { senderId: string; count: number; readAt: string }) => void
  readError: (data: { senderId: string }) => void
  userOnline: (userId: string) => void
  userOffline: (userId: string) => void
  onlineUsers: (userIds: string[]) => void
  notification: (data: { type: string; from: string; content: string; timestamp: string }) => void
  unreadCountUpdate: (data: { userId: string; count: number }) => void
  typing: (data: { userId: string; isTyping: boolean }) => void
  messagesDeleted: (data: { messageIds: string[] }) => void
  chatCleared: (data: { userId: string }) => void
  deleteConfirmed: (data: { success: boolean; count: number; error?: string }) => void
  error: (data: { message: string }) => void
}

interface ClientToServerEvents {
  join: (userId: string) => void
  leave: (userId: string) => void
  sendMessage: (data: { 
    receiverId: string; 
    content: string;
    senderName?: string;
    senderUsername?: string;
    senderEmail?: string;
  }) => void
  markAsRead: (data: { senderId: string }) => void
  chatOpened: (data: { otherUserId: string }) => void
  chatClosed: () => void
  typing: (data: { receiverId: string; isTyping: boolean }) => void
  deleteMessages: (data: { messageIds: string[] }) => void
  clearChat: (data: { userId: string }) => void
}

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null

export const initSocket = (userId: string): Socket<ServerToClientEvents, ClientToServerEvents> => {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      query: { userId },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: false
    })

    socket.on('connect', () => {
      console.log('Connected to Socket.IO server')
      socket?.emit('join', userId)
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server')
    })

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      // Attempt to reconnect after error
      setTimeout(() => {
        socket?.connect();
      }, 5000)
    })
  }

  return socket
}

export const getSocket = (): Socket<ServerToClientEvents, ClientToServerEvents> | null => {
  return socket
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}