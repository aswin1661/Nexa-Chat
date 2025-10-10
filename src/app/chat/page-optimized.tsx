"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSocket } from "../../lib/useSocket";
import { getSocket } from "../../lib/socket";

interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  createdAt: string;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  read: boolean;
  sender: {
    id: string;
    name: string;
    username: string;
    email: string;
  };
  receiver: {
    id: string;
    name: string;
    username: string;
    email: string;
  };
}

export default function ChatPageOptimized() {
  const { data: session, status } = useSession();
  const [inputMessage, setInputMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string>("");
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showThreeDotsMenu, setShowThreeDotsMenu] = useState(false);
  const [autoReadEnabled, setAutoReadEnabled] = useState(true);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Use our new Socket.IO hook
  const {
    isConnected,
    messages,
    unreadCounts,
    onlineUsers,
    typingUsers,
    sendMessage,
    setTyping,
    loadChatMessages,
    markAsRead,
    markMessagesAsRead,
    clearChat
  } = useSocket();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      console.log("User not authenticated, redirecting to login");
      router.push("/login");
      return;
    }
    
    console.log("User authenticated:", session?.user);
    fetchUsers();
  }, [status, router, session]);

  // Aggressive read receipt for latest messages - triggers when messages update
  useEffect(() => {
    if (selectedUser && messages.length > 0) {
      // Check for recent unread messages from the selected user
      const recentUnreadMessages = messages.filter(msg => 
        msg.sender.id === selectedUser.id && 
        !msg.readAt &&
        // Only consider messages from the last 30 seconds as "recent"
        new Date(msg.createdAt).getTime() > Date.now() - 30000
      );
      
      if (recentUnreadMessages.length > 0) {
        console.log(`Found ${recentUnreadMessages.length} recent unread messages, sending immediate read receipt`);
        // Immediate read receipt for recent messages
        markMessagesAsRead(selectedUser.id);
      }
    }
  }, [messages, selectedUser, markMessagesAsRead]);

  // Close three dots menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showThreeDotsMenu) {
        setShowThreeDotsMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showThreeDotsMenu]);

  // Fetch users list (still using REST API as this is less frequent)
  const fetchUsers = async () => {
    try {
      console.log("Fetching interacted users...");
      setError("");
      const response = await fetch("/api/interacted-users");
      
      if (response.ok) {
        const data = await response.json();
        console.log("Interacted users fetched:", data);
        setUsers(data);
      } else {
        const errorData = await response.text();
        console.error("Failed to fetch interacted users:", errorData);
        setError(`Failed to load chat history: ${response.status}`);
      }
    } catch (error) {
      console.error("Error fetching interacted users:", error);
      setError("Error loading chat history. Please refresh.");
    }
  };

  // Search users (still using REST API)
  useEffect(() => {
    if (showNewChatModal && searchQuery) {
      const timeoutId = setTimeout(() => {
        searchUsers(searchQuery);
      }, 300);

      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, showNewChatModal]);

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const allUsers = await response.json();
        const filtered = allUsers.filter((user: User) => 
          user.username.toLowerCase().includes(query.toLowerCase()) ||
          user.name.toLowerCase().includes(query.toLowerCase())
        );
        setSearchResults(filtered);
      }
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleNewChatSelect = (user: User) => {
    setSelectedUser(user);
    setShowNewChatModal(false);
    setSearchQuery("");
    setSearchResults([]);
    loadChatMessages(user.id);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showProfileDropdown && !target.closest('.profile-dropdown')) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Optimized auto-read: Mark visible messages as read (less aggressive)
  useEffect(() => {
    if (!autoReadEnabled || !selectedUser || !isConnected) return;

    const markVisibleMessagesAsRead = () => {
      const unreadMessages = messages.filter(msg => 
        msg.sender.id === selectedUser.id && !msg.readAt
      );

      if (unreadMessages.length > 0) {
        console.log(`Auto-marking ${unreadMessages.length} messages as read from ${selectedUser.id}`)
        // Send read receipt using hook function - no optimistic UI update
        markAsRead(selectedUser.id);
      }
    };

    // Only mark as read when user stays on the chat for a bit
    const timeoutId = setTimeout(markVisibleMessagesAsRead, 1000);
    return () => clearTimeout(timeoutId);
  }, [selectedUser, autoReadEnabled, isConnected, markAsRead]); // Removed messages from dependencies to prevent excessive calls

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() === "" || !selectedUser || !isConnected) return;

    const messageContent = inputMessage.trim();
    setInputMessage(""); // Clear input immediately for better UX
    
    // Send via WebSocket instead of REST API
    sendMessage(selectedUser.id, messageContent);
    
    // Stop typing indicator
    setTyping(selectedUser.id, false);
    setIsTyping(false);
  };
  
  const handleDeleteMessages = async () => {
    if (!selectedUser || selectedMessages.size === 0) return;

    const messageIdsToDelete = Array.from(selectedMessages);
    const socket = getSocket();
    
    if (socket && isConnected) {
      // Emit the delete event to remove messages from database
      socket.emit('deleteMessages', { messageIds: messageIdsToDelete });
      
      // Clear the selection state
      setSelectedMessages(new Set());
      setIsSelectionMode(false);
      
      // If all messages were selected, fetch users to update the chat list
      const allMessagesSelected = messageIdsToDelete.length === messages.length;
      if (allMessagesSelected) {
        setTimeout(fetchUsers, 500); // Small delay to allow server processing
      }
    } else {
      console.error('Socket not connected');
    }
  };

  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleScroll = () => {
    // More responsive scroll-based read receipts
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      if (selectedUser) {
        markMessagesAsRead(selectedUser.id);
      }
    }, 500); // Reduced from 1000ms to 500ms for faster response
  };



  const selectUser = (user: User) => {
    setSelectedUser(user);
    loadChatMessages(user.id);
    
    // Mark messages as read when user actively opens/views the chat
    // Multiple attempts with different delays to ensure latest messages get read receipts
    setTimeout(() => markMessagesAsRead(user.id), 200);  // Quick attempt
    setTimeout(() => markMessagesAsRead(user.id), 600);  // Follow-up
    setTimeout(() => markMessagesAsRead(user.id), 1200); // Final attempt
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleInputChange = (value: string) => {
    setInputMessage(value);
    
    if (selectedUser && isConnected) {
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Send typing indicator
      if (value.trim() && !isTyping) {
        setIsTyping(true);
        setTyping(selectedUser.id, true);
      }
      
      // Set timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        if (selectedUser) {
          setTyping(selectedUser.id, false);
        }
      }, 2000);
    }
  };

  const renderMessageStatus = (message: any, isCurrentUser: boolean) => {
    if (!isCurrentUser) return null;
    
    // Optimized status rendering with memoization
    const statusKey = `${message.sentAt}-${message.deliveredAt}-${message.readAt}`;
    
    return (
      <div className="flex items-center space-x-0.5 ml-2" key={statusKey}>
        {message.readAt ? (
          // Read - Blue double checkmark
          <div className="flex -space-x-1" title="Read">
            <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        ) : message.deliveredAt ? (
          // Delivered - Gray double checkmark
          <div className="flex -space-x-1" title="Delivered">
            <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        ) : message.sentAt ? (
          // Sent - Single gray checkmark
          <div title="Sent">
            <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        ) : (
          // Sending - Loading spinner
          <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" title="Sending..."></div>
        )}
      </div>
    );
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const handleDeleteAccount = async () => {
    const confirmed = confirm(
      "⚠️ WARNING: Delete Account\n\n" +
      "This action will permanently:\n" +
      "• Delete your account\n" +
      "• Delete ALL your messages\n" +
      "• Remove you from all conversations\n" +
      "• This CANNOT be undone\n\n" +
      "Are you absolutely sure you want to continue?"
    );

    if (!confirmed) return;

    const doubleConfirmed = confirm(
      "🚨 FINAL WARNING 🚨\n\n" +
      "You are about to permanently delete your account and ALL data.\n" +
      "This action is IRREVERSIBLE.\n\n" +
      "Type 'DELETE' and click OK to proceed."
    );

    if (!doubleConfirmed) return;

    try {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
      });

      if (response.ok) {
        alert("✅ Account deleted successfully. You will be redirected to the login page.");
        await signOut({ callbackUrl: "/login" });
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to delete account");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      setError("Error deleting account. Please try again.");
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Connection Status */}
      <div className={`fixed top-4 right-4 z-50 px-3 py-1 rounded-full text-xs font-medium ${
        isConnected 
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      }`}>
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Chats
            </h2>
            
            {/* Profile Dropdown */}
            <div className="relative profile-dropdown">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                  {(session.user?.name || session.user?.email)?.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {session.user?.name || "User"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    @{(session.user as any)?.username || "username"}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {session.user?.name || "User"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      @{(session.user as any)?.username || "username"}
                    </p>
                  </div>
                  <div className="py-2">
                    <button
                      onClick={() => {
                        setShowProfileDropdown(false);
                        handleDeleteAccount();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete Account</span>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setShowProfileDropdown(false);
                        handleLogout();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Logout</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {error && (
            <div className="mt-2 p-2 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded text-xs">
              {error}
            </div>
          )}
        </div>

        {/* Users List */}
        <div className="overflow-y-auto">
          {users.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <p className="text-sm">No recent conversations</p>
              <p className="text-xs mt-1">Use the + button to start a new chat!</p>
            </div>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                onClick={() => selectUser(user)}
                className={`p-4 cursor-pointer border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  selectedUser?.id === user.id ? "bg-blue-50 dark:bg-blue-900/20" : ""
                }`}
              >
                <div className="flex items-center">
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    {onlineUsers.has(user.id) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 bg-green-500"></div>
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      @{user.username}
                      {typingUsers[user.id] && (
                        <span className="ml-2 text-blue-500 animate-pulse">typing...</span>
                      )}
                    </p>
                  </div>
                  {unreadCounts[user.id] > 0 && (
                    <div className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                      {unreadCounts[user.id] > 9 ? '9+' : unreadCounts[user.id]}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </div>
                    {onlineUsers.has(selectedUser.id) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 bg-green-500"></div>
                    )}
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedUser.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      @{selectedUser.username}
                      {onlineUsers.has(selectedUser.id) ? (
                        <span className="ml-2 text-green-500">• online</span>
                      ) : (
                        <span className="ml-2 text-gray-400">• Offline</span>
                      )}
                      {typingUsers[selectedUser.id] && (
                        <span className="ml-2 text-blue-500 animate-pulse">typing...</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Three dots menu */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowThreeDotsMenu(!showThreeDotsMenu);
                    }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                  >
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </button>

                  {showThreeDotsMenu && (
                    <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setIsSelectionMode(!isSelectionMode);
                            setSelectedMessages(new Set());
                            setShowThreeDotsMenu(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-8 8-4-4" />
                          </svg>
                          {isSelectionMode ? 'Cancel Selection' : 'Select Messages'}
                        </button>
                        <button
                          onClick={() => {
                            const confirmed = confirm(
                              "⚠️ Clear Chat\n\n" +
                              "This will permanently delete all messages in this chat for everyone. " +
                              "This action cannot be undone.\n\n" +
                              "Are you sure you want to continue?"
                            );
                            if (confirmed && selectedUser) {
                              // Emit the clear chat event
                              clearChat(selectedUser.id);
                              
                              // Fetch users after a delay to update chat list
                              setTimeout(fetchUsers, 500);
                            }
                            setShowThreeDotsMenu(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Clear Chat
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 select-none"
              onScroll={handleScroll}
            >
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message: Message) => {
                  const isCurrentUser = message.sender.email === session.user?.email;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isCurrentUser ? "justify-end" : "justify-start"} group items-center gap-2`}
                    >
                      {isSelectionMode && (
                        <div 
                          className={`flex items-center justify-center w-5 h-5 rounded border ${
                            selectedMessages.has(message.id)
                              ? "bg-blue-500 border-blue-500"
                              : "border-gray-300 dark:border-gray-600"
                          } cursor-pointer`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMessages(prev => {
                              const newSet = new Set(prev);
                              if (prev.has(message.id)) {
                                newSet.delete(message.id);
                              } else {
                                newSet.add(message.id);
                              }
                              return newSet;
                            });
                          }}
                        >
                          {selectedMessages.has(message.id) && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      )}
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 select-none ${
                          isCurrentUser
                            ? "bg-blue-500 text-white"
                            : "bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600"
                        } hover:shadow-md ${selectedMessages.has(message.id) ? 'opacity-75' : ''}`}
                      >
                        {!isCurrentUser && (
                          <p className="text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
                            {message.sender.name} (@{message.sender.username})
                          </p>
                        )}
                        <p className="text-sm">{message.content}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className={`text-xs ${
                            isCurrentUser 
                              ? "text-blue-100" 
                              : "text-gray-500 dark:text-gray-400"
                          }`}>
                            {formatTime(message.createdAt)}
                          </p>
                          {renderMessageStatus(message, isCurrentUser)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Selection Actions Bar */}
            {isSelectionMode && selectedMessages.size > 0 && (
              <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedMessages.size} message{selectedMessages.size > 1 ? 's' : ''} selected
                  </div>
                  <button
                    onClick={() => {
                      const confirmed = confirm(
                        "This will permanently delete the selected messages from the chat for everyone. " + 
                        "This action cannot be undone. Continue?"
                      );
                      if (confirmed && selectedMessages.size > 0) {
                        handleDeleteMessages();
                      }
                    }}
                    className="px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
              <form onSubmit={handleSendMessage}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder={`Message ${selectedUser.name}...`}
                    disabled={!isConnected}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!isConnected || inputMessage.trim() === ""}
                    className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
                💬
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Select a Chat to Start Messaging
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                {users.length === 0 
                  ? "No conversations yet. Use the + button to start a new chat!" 
                  : "Choose a conversation from the sidebar to continue messaging"
                }
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Floating New Chat Button */}
      <button
        onClick={() => setShowNewChatModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Start New Chat
              </h3>
              <button
                onClick={() => {
                  setShowNewChatModal(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users by username or name..."
                  className="w-full px-4 py-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  autoFocus
                />
                <div className="absolute right-3 top-3">
                  {isSearching ? (
                    <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  ) : (
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto">
              {searchQuery ? (
                <div className="p-4">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                    Search Results ({searchResults.length})
                  </h4>
                  {searchResults.length === 0 && !isSearching ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <p>No users found matching "{searchQuery}"</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.map((user) => (
                        <div
                          key={user.id}
                          onClick={() => handleNewChatSelect(user)}
                          className="flex items-center p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        >
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium relative">
                            {user.name.charAt(0).toUpperCase()}
                            {onlineUsers.has(user.id) && (
                              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white bg-green-500"></div>
                            )}
                          </div>
                          <div className="ml-3 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              @{user.username}
                              {onlineUsers.has(user.id) && (
                                <span className="ml-2 text-green-500">• Online</span>
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-lg font-medium mb-2">Find Users</p>
                    <p className="text-sm">Search for users by username or name to start a new chat</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}