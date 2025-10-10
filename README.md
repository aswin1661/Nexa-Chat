# Chat Application with Email Verification

A complete real-time chat application built with Next.js 15, featuring user authentication, message status tracking, and production-ready email verification.

## 🚀 Features

- **Real-time Chat**: Instant messaging with delivery status (sent/delivered/read)
- **User Authentication**: Secure login with NextAuth.js and JWT
- **Email Verification**: Production-ready email verification system
- **Message Status**: WhatsApp-like delivery receipts with color-coded ticks
- **User Search**: Find and start conversations with new users
- **Admin Panel**: Super user access for user management
- **Responsive Design**: Works on desktop and mobile devices
- **PostgreSQL Database**: Production database with Prisma ORM

## 🛠️ Tech Stack

- **Frontend**: Next.js 15.5.4, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, NextAuth.js
- **Database**: PostgreSQL with Prisma ORM
- **Email**: Nodemailer with Gmail/SMTP support
- **Authentication**: JWT with username/email support

## 📧 Email Configuration

### Gmail Setup (Recommended)

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
3. Update your `.env.local` file:

```bash
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
APP_NAME=Your Chat App Name
```

### Alternative SMTP Providers

For other email providers (SendGrid, Mailgun, etc.), update the email service configuration:

```bash
# SMTP Configuration
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
```

Then modify `src/lib/emailService.ts` to use SMTP instead of Gmail.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database (or use Prisma Cloud)
- Email provider (Gmail or SMTP)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd website
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env.local
```

4. Configure your environment variables in `.env.local`:
```bash
# Next.js Configuration
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret-key

# Database URL
DATABASE_URL=your-postgresql-url

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
APP_NAME=Chat App
```

5. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

6. Run the development server:
```bash
npm run dev
```

7. Open [http://localhost:3001](http://localhost:3001) in your browser

## 📦 Database Schema

The application uses the following main tables:

- **User**: Stores user information (name, username, email, password)
- **Message**: Chat messages with delivery status tracking
- **Admin**: Admin user permissions

## 🔐 Authentication Flow

1. User registers with email verification required
2. Verification email sent with secure token
3. User verifies email via link or manual token entry
4. Account activated and user can log in
5. JWT tokens manage session state

## 📱 Message Status System

Messages have three states with color-coded indicators:
- **Sent** (single black tick): Message sent to server
- **Delivered** (double black ticks): Message delivered to recipient 
- **Read** (double red ticks): Message read by recipient

## 🔧 Production Deployment

### Environment Variables

Set these in your production environment:

```bash
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
DATABASE_URL=your-production-db-url
EMAIL_USER=your-production-email
EMAIL_PASSWORD=your-production-password
```

### Email Service

- In development: Verification tokens shown in console + emails sent
- In production: Only emails sent (tokens hidden from API responses)

### Security

- JWT tokens for session management
- Password hashing with bcrypt
- Email verification prevents unauthorized signups
- Environment variables for sensitive data

## 🎯 Key Features Explained

### New Chat Search
- Floating button opens user search modal
- Real-time search through usernames and names
- Automatically starts conversation when user selected

### Interacted Users Filter
- Main sidebar shows only users you've chatted with
- Clean interface focused on active conversations
- Search for new users via dedicated modal

### Admin System
- Super user access for user management
- Admin panel for monitoring and control
- Secure role-based permissions

## 📊 Performance Optimizations

- Optimized polling intervals (1s normal, 0.5s when typing)
- Database indexing for fast message retrieval
- Efficient real-time updates without overwhelming server
- PostgreSQL for production-grade performance

## 🐛 Troubleshooting

### Email Not Sending

1. Check environment variables are set correctly
2. Verify Gmail app password (not regular password)
3. Ensure 2FA is enabled for Gmail
4. Check spam folder for verification emails

### Database Connection Issues

1. Verify DATABASE_URL format
2. Check database server is running
3. Ensure proper SSL configuration for cloud databases

### Authentication Problems

1. Verify NEXTAUTH_SECRET is set
2. Check NEXTAUTH_URL matches your domain
3. Clear browser cache and cookies

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review environment variable setup
3. Verify email configuration
4. Check database connectivity

---

Built with ❤️ using Next.js and modern web technologies.
