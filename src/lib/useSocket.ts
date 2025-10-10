import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { initSocket, getSocket, disconnectSocket } from './socket'
import type { Message, SessionUser } from './types'
import type { Session } from 'next-auth'

// Remove the Message interface since it's imported

export const useSocket = () => {
  const { data: session } = useSession()
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({})
  const currentChatUser = useRef<string | null>(null)

  useEffect(() => {
    if (session?.user) {
      const userId = session.user.id
      const socket = initSocket(userId)

      const onConnect = () => {
        console.log('Socket connected')
        setIsConnected(true)
      }

      const onDisconnect = () => {
        console.log('Socket disconnected')
        setIsConnected(false)
      }

      const onNewMessage = (message: Message) => {
        console.log('New message received:', message)
        
        // If this message is for the current chat, add it to messages
        if (currentChatUser.current) {
          const isCurrentChat = 
            (message.sender.id === currentChatUser.current && message.receiver.id === userId) ||
            (message.receiver.id === currentChatUser.current && message.sender.id === userId)
          
          if (isCurrentChat) {
            setMessages(prev => {
              // Check if this is replacing an optimistic message
              const optimisticIndex = prev.findIndex(m => 
                m.id.startsWith('temp-') && 
                m.sender.id === message.sender.id &&
                m.receiver.id === message.receiver.id &&
                m.content === message.content
              )
              
              if (optimisticIndex !== -1) {
                // Replace optimistic message with real one
                const newMessages = [...prev]
                newMessages[optimisticIndex] = message
                return newMessages
              }
              
              // Avoid duplicates for real messages
              const exists = prev.some(m => m.id === message.id)
              if (exists) return prev
              return [...prev, message]
            })
            
            // Send read receipt for new messages if chat is active - IMMEDIATE for better UX
            if (message.sender.id === currentChatUser.current) {
              // Send immediately without delay for the latest message
              socket.emit('markAsRead', { senderId: message.sender.id })
            }
          }
        }
      }

      const onMessageUpdate = (data: { tempId: string; realMessage: Message }) => {
        console.log('Message update received:', data)
        
        // Replace temporary message with real message
        setMessages(prev => prev.map(msg => 
          msg.id === data.tempId ? data.realMessage : msg
        ))
      }

      const onMessageError = (data: { tempId: string }) => {
        console.log('Message error:', data)
        
        // Remove failed temporary message
        setMessages(prev => prev.filter(msg => msg.id !== data.tempId))
      }

      const onMessageDelivered = (data: { messageId: string; userId: string }) => {
        console.log('Message delivered:', data)
        // Update message status to delivered
        setMessages(prev => prev.map(msg => 
          msg.receiver.id === data.userId && !msg.deliveredAt 
            ? { ...msg, deliveredAt: new Date().toISOString() }
            : msg
        ))
      }

      const onMessageRead = (data: { messageId: string; userId: string; readAt?: string; count?: number }) => {
        console.log('Message read confirmation received:', data)
        
        // More reliable read status update - use server timestamp
        const readTimestamp = data.readAt || new Date().toISOString()
        
        setMessages(prev => prev.map(msg => {
          // Only update messages that were sent to the user who read them
          if (msg.receiver.id === data.userId && !msg.readAt) {
            return { ...msg, read: true, readAt: readTimestamp }
          }
          return msg
        }))
      }

      const onReadConfirmed = (data: { senderId: string; count: number; readAt: string }) => {
        console.log('Read confirmation for receiver:', data)
        
        // Update messages from the sender that were just read
        setMessages(prev => prev.map(msg => {
          if (msg.sender.id === data.senderId && !msg.readAt) {
            return { ...msg, read: true, readAt: data.readAt }
          }
          return msg
        }))
      }

      const onReadError = (data: { senderId: string }) => {
        console.log('Read receipt error for sender:', data.senderId)
        // Could revert optimistic read status updates here if needed
      }

      const onUserOnline = (userId: string) => {
        console.log('User came online:', userId)
        setOnlineUsers(prev => {
          const newSet = new Set(prev)
          newSet.add(userId)
          return newSet
        })
      }

      const onUserOffline = (userId: string) => {
        console.log('User went offline:', userId)
        setOnlineUsers(prev => {
          const newSet = new Set(prev)
          newSet.delete(userId)
          return newSet
        })
      }

      const onOnlineUsers = (userIds: string[]) => {
        console.log('Received online users list:', userIds)
        setOnlineUsers(new Set(userIds))
      }

      const onUnreadCountUpdate = (data: { userId: string; count: number }) => {
        console.log('Unread count update:', data)
        setUnreadCounts(prev => ({
          ...prev,
          [data.userId]: data.count
        }))
      }
      
      const onMessagesDeleted = (data: { messageIds: string[] }) => {
        console.log('Messages deleted:', data.messageIds)
        setMessages(prev => prev.filter(msg => !data.messageIds.includes(msg.id)))
      }

      const onChatCleared = (data: { userId: string }) => {
        console.log('Chat cleared for user:', data.userId)
        if (currentChatUser.current === data.userId) {
          setMessages([])
        }
      }

      const onTyping = (data: { userId: string; isTyping: boolean }) => {
        setTypingUsers(prev => ({
          ...prev,
          [data.userId]: data.isTyping
        }))
        
        // Clear typing after 3 seconds
        if (data.isTyping) {
          setTimeout(() => {
            setTypingUsers(prev => ({
              ...prev,
              [data.userId]: false
            }))
          }, 3000)
        }
      }

      socket.on('connect', onConnect)
      socket.on('disconnect', onDisconnect)
      socket.on('newMessage', onNewMessage)
      socket.on('messageUpdate', onMessageUpdate)
      socket.on('messageError', onMessageError)
      socket.on('messageDelivered', onMessageDelivered)
      socket.on('messageRead', onMessageRead)
      socket.on('readConfirmed', onReadConfirmed)
      socket.on('readError', onReadError)
      socket.on('userOnline', onUserOnline)
      socket.on('userOffline', onUserOffline)
      socket.on('onlineUsers', onOnlineUsers)
      socket.on('unreadCountUpdate', onUnreadCountUpdate)
      socket.on('typing', onTyping)

      socket.on('messagesDeleted', onMessagesDeleted);
      socket.on('chatCleared', onChatCleared);

      return () => {
        socket.off('connect', onConnect)
        socket.off('disconnect', onDisconnect)
        socket.off('newMessage', onNewMessage)
        socket.off('messageUpdate', onMessageUpdate)
        socket.off('messageError', onMessageError)
        socket.off('messageDelivered', onMessageDelivered)
        socket.off('messageRead', onMessageRead)
        socket.off('readConfirmed', onReadConfirmed)
        socket.off('readError', onReadError)
        socket.off('userOnline', onUserOnline)
        socket.off('userOffline', onUserOffline)
        socket.off('onlineUsers', onOnlineUsers)
        socket.off('unreadCountUpdate', onUnreadCountUpdate)
        socket.off('typing', onTyping)
        socket.off('messagesDeleted', onMessagesDeleted)
        socket.off('chatCleared', onChatCleared)
      }
    }

    return () => {
      disconnectSocket()
    }
  }, [session])

  const sendMessage = (receiverId: string, content: string) => {
    const socket = getSocket()
    if (socket && isConnected && session?.user) {
      const userId = session.user.id
      
      // Create optimistic message for instant UI update
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`, // Temporary ID
        content: content,
        createdAt: new Date().toISOString(),
        sentAt: new Date().toISOString(),
        deliveredAt: undefined,
        readAt: undefined,
        read: false,
        sender: {
          id: userId,
          name: session.user.name,
          username: session.user.username,
          email: session.user.email || ''
        },
        receiver: {
          id: receiverId,
          name: '',
          username: '',
          email: ''
        }
      }
      
      // Add optimistic message immediately for instant display
      if (currentChatUser.current === receiverId) {
        setMessages(prev => [...prev, optimisticMessage])
      }
      
      // Send to server with sender information
      socket.emit('sendMessage', { 
        receiverId, 
        content,
        senderName: session.user.name,
        senderUsername: session.user.username,
        senderEmail: session.user.email || ''
      })
    }
  }

  const markAsRead = (senderId: string) => {
    const socket = getSocket()
    if (socket && isConnected) {
      socket.emit('markAsRead', { senderId })
    }
  }

  const setTyping = (receiverId: string, isTyping: boolean) => {
    const socket = getSocket()
    if (socket && isConnected) {
      socket.emit('typing', { receiverId, isTyping })
    }
  }

  const setCurrentChat = (userId: string | null) => {
    const socket = getSocket()
    if (socket && isConnected) {
      // Close previous chat if exists
      if (currentChatUser.current) {
        socket.emit('chatClosed')
      }
      
      // Open new chat if provided
      if (userId) {
        socket.emit('chatOpened', { otherUserId: userId })
      }
    }
    
    currentChatUser.current = userId
    if (userId) {
      // Mark messages as read when opening chat
      markAsRead(userId)
      // Clear unread count for this user
      setUnreadCounts(prev => ({
        ...prev,
        [userId]: 0
      }))
    }
  }

  const loadChatMessages = async (userId: string) => {
    try {
      const response = await fetch(`/api/messages/${userId}`)
      if (response.ok) {
        const chatMessages = await response.json()
        setMessages(chatMessages)
        setCurrentChat(userId) // This will trigger chatOpened event
        
        // Don't automatically mark as read when loading chat
        // Only mark as read when user actually views/interacts with the chat
        console.log(`Loaded ${chatMessages.length} messages from ${userId}`)
      }
    } catch (error) {
      console.error('Error loading chat messages:', error)
    }
  }

  const markMessagesAsRead = (senderId: string) => {
    const socket = getSocket()
    if (socket && currentChatUser.current === senderId) {
      console.log(`Attempting to mark messages as read from ${senderId}`)
      // Always send read receipt - let server determine if there are unread messages
      // This avoids state synchronization issues
      socket.emit('markAsRead', { senderId })
    }
  }

  const deleteMessages = (messageIds: string[]) => {
    console.log('Sending deleteMessages event with IDs:', messageIds);
    const socket = getSocket();
    if (socket && isConnected) {
      socket.emit('deleteMessages', { messageIds });
      
      // Listen for deletion confirmation
      socket.once('deleteConfirmed', (data: { success: boolean; count: number; error?: string }) => {
        if (data.success) {
          console.log(`Successfully deleted ${data.count} messages`);
          // The messagesDeleted event will handle the UI update
        } else {
          console.error('Failed to delete messages:', data.error);
          // Revert any optimistic UI updates if needed
          console.log('Deletion failed, UI remains unchanged');
        }
      });
      
      // Handle any socket errors
      socket.once('error', (data: { message: string }) => {
        console.error('Socket error during message deletion:', data.message);
      });
    } else {
      console.error('Socket not connected, cannot delete messages');
    }
  }

  const clearChat = (userId: string) => {
    const socket = getSocket();
    if (socket && isConnected) {
      console.log(`Sending clearChat event for user: ${userId}`);
      socket.emit('clearChat', { userId });
      
      // Log when we receive the messagesDeleted event in response
      socket.once('messagesDeleted', (data) => {
        console.log(`Chat cleared, received deletion confirmation for ${data.messageIds.length} messages`);
      });
    }
  }

  return {
    isConnected,
    messages,
    unreadCounts,
    onlineUsers,
    typingUsers,
    sendMessage,
    markAsRead,
    markMessagesAsRead,
    setTyping,
    setCurrentChat,
    loadChatMessages,
    deleteMessages,
    clearChat
  }
}