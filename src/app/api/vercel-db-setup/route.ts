import { NextResponse } from 'next/server';

// This runs on Vercel and handles database migrations
export async function GET() {
  if (process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ status: 'skipped - not production' });
  }

  try {
    const { execSync } = require('child_process');
    
    // Run migrations
    execSync('npx prisma migrate deploy', {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    return NextResponse.json({ status: 'migrations completed' });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { status: 'migration error', error: String(error) },
      { status: 500 }
    );
  }
}
