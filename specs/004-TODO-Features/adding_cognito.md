diff --git a/convex/auth.config.ts b/convex/auth.config.ts
index 43141f6bd594b47e842c8be91ef1545527d90c41..ff20e4aaad5defab5346e89ae3ff417232efc473 100644
--- a/convex/auth.config.ts
+++ b/convex/auth.config.ts
@@ -1,16 +1,16 @@
 export default {
   providers: [
     // This is the default provider for Convex email/passwordless auth
     {
       domain: process.env.CONVEX_SITE_URL,
       applicationID: "convex",
     },
-    // Add this provider for GitHub OAuth
+    // AWS Cognito hosted UI domain
     {
-      domain: "https://github.com",
-      applicationID: "github",
-      clientID: process.env.GITHUB_CLIENT_ID!,
-      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
+      domain: process.env.AWS_COGNITO_DOMAIN!,
+      applicationID: "cognito",
+      clientID: process.env.AWS_COGNITO_APP_CLIENT_ID!,
+      clientSecret: process.env.AWS_COGNITO_APP_CLIENT_SECRET!,
     },
   ],
-};
\ No newline at end of file
+};





8:24
convex/auth.ts
8:24
diff --git a/convex/auth.ts b/convex/auth.ts
index 424c6eee68b684d13c9ee189c440e0e0c58af413..2ce0bff4882d8e70071f7a098b60774a18e7f1b4 100644
--- a/convex/auth.ts
+++ b/convex/auth.ts
@@ -1,24 +1,38 @@
-import GitHub from "@auth/core/providers/github";
-import { Password } from "@convex-dev/auth/providers/Password";
+import Cognito from "@auth/core/providers/cognito";
 import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
+import { Password } from "@convex-dev/auth/providers/Password";
 import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
 import { query } from "./_generated/server";
 
+function requiredEnvVar(name: string) {
+  const value = process.env[name];
+  if (!value) {
+    throw new Error(`Missing required environment variable: ${name}`);
+  }
+  return value;
+}
+
+const cognitoProvider = Cognito({
+  clientId: requiredEnvVar("AWS_COGNITO_APP_CLIENT_ID"),
+  clientSecret: requiredEnvVar("AWS_COGNITO_APP_CLIENT_SECRET"),
+  issuer: requiredEnvVar("AWS_COGNITO_ISSUER_URL"),
+});
+
 export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
   providers: [
     Anonymous,
-    GitHub,
     Password,
+    cognitoProvider,
   ],
 });
 
 export const loggedInUser = query({
   handler: async (ctx) => {
     const userId = await getAuthUserId(ctx);
     if (!userId) {
       return null;
     }
     const user = await ctx.db.get(userId);
     return user ?? null;
   },
-});
\ No newline at end of file
+});
8:24
src/SignInForm.tsx
8:24
diff --git a/src/SignInForm.tsx b/src/SignInForm.tsx
index f9756e65611cf706eea44ffdc57bcb691d17004e..2f614ea764a53e03de5b1d64aa07dafdcc1dd7c0 100644
--- a/src/SignInForm.tsx
+++ b/src/SignInForm.tsx
@@ -1,77 +1,64 @@
 "use client";
 import { useAuthActions } from "@convex-dev/auth/react";
 import { useState } from "react";
 import { toast } from "sonner";
 
 export function SignInForm() {
   const { signIn } = useAuthActions();
-  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
-  const [submitting, setSubmitting] = useState(false);
+  const [startingCognito, setStartingCognito] = useState(false);
+  const [startingAnonymous, setStartingAnonymous] = useState(false);
+
+  const startCognitoSignIn = async () => {
+    setStartingCognito(true);
+    try {
+      const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
+      const result = await signIn("cognito", redirectTo ? { redirectTo } : undefined);
+      if (result.redirect && typeof window !== "undefined") {
+        window.location.href = result.redirect.toString();
+      }
+    } catch (error) {
+      toast.error("Unable to start the AWS Cognito sign-in flow. Please try again.");
+      setStartingCognito(false);
+    }
+  };
+
+  const startAnonymousSignIn = async () => {
+    setStartingAnonymous(true);
+    try {
+      await signIn("anonymous");
+    } catch (error) {
+      toast.error("Unable to sign in anonymously. Please try again.");
+      setStartingAnonymous(false);
+    }
+  };
 
   return (
-    <div className="w-full">
-      <form
-        className="flex flex-col gap-form-field"
-        onSubmit={(e) => {
-          e.preventDefault();
-          setSubmitting(true);
-          const formData = new FormData(e.target as HTMLFormElement);
-          formData.set("flow", flow);
-          void signIn("password", formData).catch((error) => {
-            let toastTitle = "";
-            if (error.message.includes("Invalid password")) {
-              toastTitle = "Invalid password. Please try again.";
-            } else {
-              toastTitle =
-                flow === "signIn"
-                  ? "Could not sign in, did you mean to sign up?"
-                  : "Could not sign up, did you mean to sign in?";
-            }
-            toast.error(toastTitle);
-            setSubmitting(false);
-          });
-        }}
+    <div className="w-full space-y-4">
+      <button
+        className="auth-button"
+        type="button"
+        onClick={() => void startCognitoSignIn()}
+        disabled={startingCognito}
       >
-        <input
-          className="auth-input-field"
-          type="email"
-          name="email"
-          placeholder="Email"
-          required
-        />
-        <input
-          className="auth-input-field"
-          type="password"
-          name="password"
-          placeholder="Password"
-          required
-        />
-        <button className="auth-button" type="submit" disabled={submitting}>
-          {flow === "signIn" ? "Sign in" : "Sign up"}
-        </button>
-        <div className="text-center text-sm text-secondary">
-          <span>
-            {flow === "signIn"
-              ? "Don't have an account? "
-              : "Already have an account? "}
-          </span>
-          <button
-            type="button"
-            className="text-primary hover:text-primary-hover hover:underline font-medium cursor-pointer"
-            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
-          >
-            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
-          </button>
-        </div>
-      </form>
-      <div className="flex items-center justify-center my-3">
-        <hr className="my-4 grow border-gray-200" />
-        <span className="mx-4 text-secondary">or</span>
-        <hr className="my-4 grow border-gray-200" />
+        {startingCognito ? "Redirecting to AWS Cognito..." : "Continue with AWS Cognito"}
+      </button>
+      <div className="flex items-center justify-center text-secondary text-sm gap-3">
+        <span className="block h-px w-12 bg-gray-800" aria-hidden />
+        <span>or</span>
+        <span className="block h-px w-12 bg-gray-800" aria-hidden />
       </div>
-      <button className="auth-button" onClick={() => void signIn("anonymous")}>
-        Sign in anonymously
+      <button
+        className="auth-button"
+        type="button"
+        onClick={() => void startAnonymousSignIn()}
+        disabled={startingAnonymous}
+      >
+        {startingAnonymous ? "Signing in..." : "Sign in anonymously"}
       </button>
+      <p className="text-center text-xs text-secondary">
+        AWS Cognito manages account creation, passwords, and multifactor authentication for this app.
+      </p>
     </div>
   );
 }