import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import "./index.css";
import App from "./App";

const convexUrl = import.meta.env.VITE_CONVEX_URL || "https://resolute-kudu-325.convex.cloud";
if ( !convexUrl ) {
  throw new Error(
    "No VITE_CONVEX_URL environment variable found. Please add it to your environment variables."
  );
}
const convex = new ConvexReactClient( convexUrl );

if (typeof window !== "undefined") {
  const shouldSuppressExtensionNoise = (source?: string) =>
    Boolean(source && source.includes("content_script"));

  window.addEventListener(
    "error",
    (event) => {
      if (shouldSuppressExtensionNoise(event.filename)) {
        event.preventDefault();
      }
    },
    true
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      const reason =
        typeof event.reason === "string"
          ? event.reason
          : event.reason?.message || event.reason?.stack;
      if (shouldSuppressExtensionNoise(reason)) {
        event.preventDefault();
      }
    },
    true
  );
}

createRoot( document.getElementById( "root" )! ).render(
  <ConvexAuthProvider client={convex}>
    <App />
  </ConvexAuthProvider>,
);
