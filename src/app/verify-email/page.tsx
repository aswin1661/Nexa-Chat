'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function VerifyEmailPage() {
  const [token, setToken] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Pre-fill from URL parameters if available
    const urlToken = searchParams.get('token')
    const urlEmail = searchParams.get('email')
    
    if (urlToken) setToken(urlToken)
    if (urlEmail) setEmail(decodeURIComponent(urlEmail))
  }, [searchParams])

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!token || !email) {
      setMessage('Please enter both email and 6-digit verification code')
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, token }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('Email verified successfully! Redirecting to login...')
        setIsSuccess(true)
        
        // Redirect to login page after 2 seconds
        setTimeout(() => {
          router.push('/login?verified=true')
        }, 2000)
      } else {
        setMessage(data.error || 'Verification failed')
      }
    } catch (error) {
      setMessage('An error occurred during verification')
      console.error('Verification error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Verify Your Email
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter the 6-digit verification code sent to your email address
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleVerification}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="token" className="sr-only">
                6-Digit Verification Code
              </label>
              <input
                id="token"
                name="token"
                type="text"
                required
                maxLength={6}
                pattern="[0-9]{6}"
                value={token}
                onChange={(e) => {
                  // Only allow numeric input and limit to 6 digits
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setToken(value);
                }}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm font-mono text-center text-lg tracking-widest"
                placeholder="123456"
              />
            </div>
          </div>

          {message && (
            <div className={`rounded-md p-4 ${
              isSuccess 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Verifying...' : 'Verify Email'}
            </button>
          </div>

          <div className="text-center">
            <a
              href="/login"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Back to Login
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}