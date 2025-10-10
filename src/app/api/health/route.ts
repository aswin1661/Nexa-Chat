import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ 
    message: "API is working", 
    timestamp: new Date().toISOString(),
    env: {
      hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      hasDatabaseUrl: !!process.env.DATABASE_URL
    }
  })
}