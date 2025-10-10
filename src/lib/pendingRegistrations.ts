// Global storage for pending registrations
// In production, use Redis or a dedicated database table

export interface PendingRegistration {
  name: string;
  username: string;
  email: string;
  hashedPassword: string;
  verificationToken: string;
  expiresAt: Date;
}

// Use globalThis to ensure same instance across hot reloads in development
declare global {
  var pendingRegistrations: Map<string, PendingRegistration> | undefined
  var cleanupInterval: NodeJS.Timeout | undefined
}

export const pendingRegistrations = globalThis.pendingRegistrations ?? new Map<string, PendingRegistration>()

if (process.env.NODE_ENV !== 'production') {
  globalThis.pendingRegistrations = pendingRegistrations
}

// Clean up expired registrations periodically
if (!globalThis.cleanupInterval) {
  globalThis.cleanupInterval = setInterval(() => {
    const now = new Date()
    let cleaned = 0
    for (const [token, registration] of pendingRegistrations.entries()) {
      if (registration.expiresAt < now) {
        pendingRegistrations.delete(token)
        cleaned++
      }
    }
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired pending registrations`)
    }
  }, 5 * 60 * 1000) // Clean up every 5 minutes
}