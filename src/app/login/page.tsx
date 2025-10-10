"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetStep, setResetStep] = useState<"email" | "token" | "success">("email");
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [verificationStep, setVerificationStep] = useState<"token" | "success">("token");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if user was redirected after email verification
    if (searchParams.get('verified') === 'true') {
      setSuccessMessage('Email verified successfully! You can now log in.');
      setIsLogin(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (isLogin) {
        // Login
        console.log("Attempting login with:", { email: formData.email });
        const result = await signIn("credentials", {
          email: formData.email,
          password: formData.password,
          redirect: false,
        });

        console.log("Login result:", result);

        if (result?.error) {
          console.error("Login error:", result.error);
          setError("Invalid email or password");
        } else if (result?.ok) {
          console.log("Login successful, redirecting to chat");
          router.push("/chat");
        } else {
          setError("Login failed. Please try again.");
        }
      } else {
        // Register
        console.log("Attempting registration with:", { 
          name: formData.name, 
          email: formData.email 
        });
        
        const response = await fetch("/api/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        console.log("Registration response:", response.status, response.statusText);
        const data = await response.json();
        console.log("Registration data:", data);

        if (response.ok) {
          console.log("Registration successful - no email verification required");
          
          // Show success message and switch to login form
          setSuccessMessage("Account created successfully! You can now log in with your credentials.");
          setIsLogin(true); // Switch to login form
          
          // Clear form data
          setFormData({
            name: "",
            username: "",
            email: "",
            password: ""
          });
        } else {
          setError(data.error || "Registration failed");
        }
      }
    } catch (error) {
      console.error("Authentication error:", error);
      if (error instanceof Error && error.message === "Please verify your email before logging in") {
        setVerificationEmail(formData.email);
        setShowEmailVerification(true);
        setError("Please verify your email before logging in. Check your email for verification instructions.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setError("Please enter your email address");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      if (resetStep === "email") {
        // Request password reset
        const response = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: resetEmail }),
        });

        const data = await response.json();

        if (response.ok) {
          setResetStep("token");
          alert(`Reset instructions sent! For demo purposes, your reset token is: ${data.resetToken}\n\nIn production, this would be sent to your email.`);
        } else {
          setError(data.error || "Failed to send reset instructions");
        }
      } else if (resetStep === "token") {
        // Reset password with token
        if (!resetToken.trim() || !newPassword.trim()) {
          setError("Please enter both reset token and new password");
          return;
        }

        if (newPassword.length < 6) {
          setError("Password must be at least 6 characters long");
          return;
        }

        const response = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: resetEmail,
            token: resetToken,
            newPassword: newPassword,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setResetStep("success");
          alert("Password successfully reset! You can now login with your new password.");
          setShowForgotPassword(false);
          setResetStep("email");
          setResetEmail("");
          setResetToken("");
          setNewPassword("");
        } else {
          setError(data.error || "Failed to reset password");
        }
      }
    } catch (error) {
      console.error("Password reset error:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationToken.trim()) {
      setError("Please enter the 6-digit verification code");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: verificationEmail,
          token: verificationToken,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setVerificationStep("success");
        alert("Email successfully verified! You can now login.");
        setShowEmailVerification(false);
        setVerificationStep("token");
        setVerificationEmail("");
        setVerificationToken("");
      } else {
        setError(data.error || "Failed to verify email");
      }
    } catch (error) {
      console.error("Email verification error:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerificationEmail = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: verificationEmail,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(`New verification email sent! For demo purposes, your verification token is: ${data.verificationToken}\n\nIn production, this would be sent to your email.`);
      } else {
        setError(data.error || "Failed to resend verification email");
      }
    } catch (error) {
      console.error("Resend verification error:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome to ChatApp
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isLogin ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        {/* Toggle Buttons */}
        <div className="flex mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError("");
              setFormData({ name: "", username: "", email: "", password: "" });
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              isLogin
                ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError("");
              setFormData({ name: "", username: "", email: "", password: "" });
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              !isLogin
                ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-md text-sm">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-200 rounded-md text-sm">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter your full name"
                required={!isLogin}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          )}

          {!isLogin && (
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Choose a unique username"
                required={!isLogin}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                3-20 characters, letters, numbers, and underscores only
              </p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
            {isLogin && (
              <div className="mt-1 text-right">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setError("");
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {isLogin ? "Signing in..." : "Creating account..."}
              </div>
            ) : (
              isLogin ? "Sign In" : "Create Account"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
                setFormData({ name: "", username: "", email: "", password: "" });
              }}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Reset Password
                </h3>
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetStep("email");
                    setResetEmail("");
                    setResetToken("");
                    setNewPassword("");
                    setError("");
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-md text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="space-y-4">
                {resetStep === "email" && (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Enter your email address and we'll send you instructions to reset your password.
                    </p>
                    <div>
                      <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email Address
                      </label>
                      <input
                        id="resetEmail"
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
                    >
                      {isLoading ? "Sending..." : "Send Reset Instructions"}
                    </button>
                  </>
                )}

                {resetStep === "token" && (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Enter the reset token and your new password.
                    </p>
                    <div>
                      <label htmlFor="resetToken" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Reset Token
                      </label>
                      <input
                        id="resetToken"
                        type="text"
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        placeholder="Enter reset token"
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        New Password
                      </label>
                      <input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min 6 characters)"
                        required
                        minLength={6}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setResetStep("email")}
                        className="flex-1 py-2 px-4 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-md transition-colors"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
                      >
                        {isLoading ? "Resetting..." : "Reset Password"}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Email Verification Modal */}
        {showEmailVerification && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Verify Email
                </h3>
                <button
                  onClick={() => {
                    setShowEmailVerification(false);
                    setVerificationStep("token");
                    setVerificationEmail("");
                    setVerificationToken("");
                    setError("");
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-md text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleEmailVerification} className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Please enter the verification token sent to your email.
                </p>
                
                <div>
                  <label htmlFor="verificationToken" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    6-Digit Verification Code
                  </label>
                  <input
                    id="verificationToken"
                    type="text"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={verificationToken}
                    onChange={(e) => {
                      // Only allow numeric input and limit to 6 digits
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setVerificationToken(value);
                    }}
                    placeholder="123456"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 font-mono text-center text-lg tracking-widest"
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition duration-200"
                  >
                    {isLoading ? "Verifying..." : "Verify Email"}
                  </button>
                  
                  <button
                    type="button"
                    onClick={resendVerificationEmail}
                    disabled={isLoading}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition duration-200"
                  >
                    {isLoading ? "Sending..." : "Resend Token"}
                  </button>
                </div>
              </form>
              
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Or verify using the{" "}
                  <a 
                    href="/verify-email" 
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                  >
                    dedicated verification page
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}