"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { OAuthDebugPanel } from "./components/OAuthDebugPanel";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-form-field"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);
          console.log("Form data being sent:", Object.fromEntries(formData));
          void signIn("password", formData).catch((error) => {
            console.error("Sign in error:", error);
            let toastTitle = "";
            if (error.message.includes("Invalid password")) {
              toastTitle = "Invalid password. Please try again.";
            } else {
              toastTitle =
                flow === "signIn"
                  ? "Could not sign in, did you mean to sign up?"
                  : "Could not sign up, did you mean to sign in?";
            }
            toast.error(toastTitle);
            setSubmitting(false);
          });
        }}
      >
        <input
          className="auth-input-field"
          type="email"
          name="email"
          placeholder="Email"
          required
        />
        <input
          className="auth-input-field"
          type="password"
          name="password"
          placeholder="Password"
          required
          autoComplete="current-password"
        />
        <button className="auth-button" type="submit" disabled={submitting}>
          {flow === "signIn" ? "Sign in" : "Sign up"}
        </button>
        <div className="text-center text-sm text-secondary">
          <span>
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <button
            type="button"
            className="text-primary hover:text-primary-hover hover:underline font-medium cursor-pointer"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
      </form>
      <div className="flex items-center justify-center my-3">
        <hr className="my-4 grow border-gray-200" />
        <span className="mx-4 text-secondary">or</span>
        <hr className="my-4 grow border-gray-200" />
      </div>
      <button
        className="auth-button flex items-center justify-center gap-2"
        onClick={() => {
          void signIn("github").catch((error) => {
            console.error("GitHub OAuth error:", error);
            if (error.message?.includes("callback") || error.message?.includes("redirect")) {
              toast.error("GitHub OAuth callback URL mismatch. Check OAuth app settings.", {
                description: "Expected callback URL not configured in GitHub OAuth app.",
              });
            } else if (error.message?.includes("environment") || error.message?.includes("client")) {
              toast.error("GitHub OAuth not configured", {
                description: "Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET environment variables.",
              });
            } else {
              toast.error("GitHub authentication failed", {
                description: error.message || "Please try again or contact support.",
              });
            }
            setShowDebug(true);
          });
        }}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
        </svg>
        Sign in with GitHub
      </button>
      <button
        className="auth-button flex items-center justify-center gap-2 mt-3"
        onClick={() => {
          void signIn("google").catch((error) => {
            console.error("Google OAuth error:", error);
            if (error.message?.includes("callback") || error.message?.includes("redirect")) {
              toast.error("Google OAuth callback URL mismatch. Check OAuth app settings.", {
                description: "Expected callback URL not configured in Google Cloud Console.",
              });
            } else if (error.message?.includes("environment") || error.message?.includes("client")) {
              toast.error("Google OAuth not configured", {
                description: "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables.",
              });
            } else {
              toast.error("Google authentication failed", {
                description: error.message || "Please try again or contact support.",
              });
            }
            setShowDebug(true);
          });
        }}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Sign in with Google
      </button>
      <button
        className="auth-button flex items-center justify-center gap-2 mt-3 bg-orange-600 hover:bg-orange-700 text-white"
        onClick={() => {
          void signIn("cognito").catch((error) => {
            console.error("Cognito OAuth error:", error);
            if (error.message?.includes("callback") || error.message?.includes("redirect")) {
              toast.error("Cognito OAuth callback URL mismatch. Check OAuth app settings.", {
                description: "Expected callback URL not configured in Cognito app client.",
              });
            } else if (error.message?.includes("environment") || error.message?.includes("client")) {
              toast.error("Cognito OAuth not configured", {
                description: "Missing COGNITO_ISSUER_URL, COGNITO_CLIENT_ID, or COGNITO_CLIENT_SECRET environment variables.",
              });
            } else {
              toast.error("AWS Cognito authentication failed", {
                description: error.message || "Please try again or contact support.",
              });
            }
            setShowDebug(true);
          });
        }}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6.76 10.18c-.18.18-.18.47 0 .65l4.59 4.59c.18.18.47.18.65 0l4.59-4.59c.18-.18.18-.47 0-.65l-.65-.65c-.18-.18-.47-.18-.65 0L12 12.82l-3.29-3.29c-.18-.18-.47-.18-.65 0l-.65.65z"/>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
        </svg>
        Sign in with AWS Cognito
      </button>
      <button
        type="button"
        className="auth-button mt-3 bg-gray-600 hover:bg-gray-700 text-white"
        onClick={() => {
          console.log("Anonymous sign-in clicked");
          setSubmitting(true);
          void signIn("anonymous")
            .then(() => {
              console.log("Anonymous sign-in successful");
            })
            .catch((error: any) => {
              console.error("Anonymous sign-in error:", error);
              toast.error("Failed to sign in as guest", {
                description: error.message || "Please try again.",
              });
              setSubmitting(false);
            });
        }}
        disabled={submitting}
      >
        <svg className="w-5 h-5 inline-block mr-2" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
        </svg>
        {submitting ? "Signing in..." : "Continue as Guest"}
      </button>
      {showDebug && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-blue-400">OAuth Configuration Debug:</p>
            <button
              onClick={() => setShowDebug(false)}
              className="text-sm text-gray-400 hover:text-gray-200"
            >
              Hide
            </button>
          </div>
          <OAuthDebugPanel />
        </div>
      )}
      {!showDebug && (
        <button
          onClick={() => setShowDebug(true)}
          className="mt-4 text-sm text-gray-400 hover:text-gray-200 underline"
        >
          Having trouble? View OAuth Debug Info
        </button>
      )}
    </div>
  );
}
