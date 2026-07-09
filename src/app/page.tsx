/**
 * Root page — redirects to /login.
 * Middleware also handles this redirect, but this covers
 * the edge case where middleware doesn't match "/".
 */
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/login");
}
