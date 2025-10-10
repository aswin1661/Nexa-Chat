import nodemailer, { Transporter } from 'nodemailer'

// Email configuration
let transporter: Transporter;

// For testing: use Ethereal Email (fake SMTP)
if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_USER) {
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: 'ethereal.user@ethereal.email',
      pass: 'ethereal.pass'
    }
  })
} else {
  // Production: use Gmail with App Password
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    // Temporary fix for development
    tls: {
      rejectUnauthorized: false
    }
  })
}

// Alternative SMTP configuration for other providers
// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST,
//   port: parseInt(process.env.SMTP_PORT || '587'),
//   secure: false, // true for 465, false for other ports
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASSWORD,
//   },
// })

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: EmailOptions) {
  try {
    // Check if email is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.log('⚠️  Email not configured properly')
      console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'Set' : 'Missing')
      console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'Set' : 'Missing')
      console.log('📧 Would send email to:', to)
      console.log('📄 Subject:', subject)
      return { success: false, error: 'Email service not configured' }
    }

    console.log('📧 Attempting to send email...')
    console.log('From:', process.env.EMAIL_USER)
    console.log('To:', to)
    console.log('Subject:', subject)

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Chat App'}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('✅ Email sent successfully!')
    console.log('Message ID:', info.messageId)
    console.log('Response:', info.response)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('❌ Failed to send email:')
    console.error('Error details:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export function generateVerificationEmailHTML(verificationToken: string, email: string): string {
  const verificationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Verify Your Email</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { 
                display: inline-block; 
                background: #4F46E5; 
                color: white; 
                padding: 12px 30px; 
                text-decoration: none; 
                border-radius: 5px; 
                margin: 20px 0;
                font-weight: bold;
            }
            .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
            .token-box { 
                background: #e5e7eb; 
                padding: 20px; 
                border-radius: 8px; 
                font-family: 'Courier New', monospace; 
                font-size: 24px; 
                font-weight: bold;
                text-align: center; 
                margin: 20px 0;
                letter-spacing: 4px;
                border: 2px solid #4F46E5;
                color: #4F46E5;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome to ${process.env.APP_NAME || 'Chat App'}!</h1>
            </div>
            <div class="content">
                <h2>Verify Your Email Address</h2>
                <p>Thank you for registering! Please verify your email address to complete your account setup.</p>
                
                <p><strong>Click the button below to verify your email:</strong></p>
                <div style="text-align: center;">
                    <a href="${verificationUrl}" class="button">Verify Email Address</a>
                </div>
                
                <p><strong>Or enter this 6-digit verification code:</strong></p>
                <div class="token-box">${verificationToken}</div>
                
                <p>You can manually verify by visiting the verification page and entering this 6-digit code.</p>
                
                <p><strong>Important:</strong> This verification link will expire in 24 hours for security reasons.</p>
                
                <p>If you didn't request this account, please ignore this email.</p>
            </div>
            <div class="footer">
                <p>This is an automated message from ${process.env.APP_NAME || 'Chat App'}.</p>
                <p>If you have any questions, please contact our support team.</p>
            </div>
        </div>
    </body>
    </html>
  `
}

export function generateVerificationEmailText(verificationToken: string, email: string): string {
  const verificationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`
  
  return `
Welcome to ${process.env.APP_NAME || 'Chat App'}!

Thank you for registering! Please verify your email address to complete your account setup.

Your 6-digit verification code: ${verificationToken}

Verification URL: ${verificationUrl}

This verification link will expire in 24 hours for security reasons.

If you didn't request this account, please ignore this email.

---
This is an automated message from ${process.env.APP_NAME || 'Chat App'}.
  `
}