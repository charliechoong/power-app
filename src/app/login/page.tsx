import { LoginForm } from "@/components/login-form";
import { storageMode } from "@/lib/server/config";
import { redirect } from "next/navigation";
export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";
export default function LoginPage() {
  if (storageMode() === "local") redirect("/reflections");
  return (
    <main id="main-content" className="account-page">
      <p className="eyebrow">COMMONPLACE · YOUR PRIVATE SPACE</p>
      <h1>Welcome back.</h1>
      <p>Sign in to access your reflections, books, and notes.</p>
      <LoginForm />
      <p className="account-hint">
        This is an owner-only app. There is no public registration.
      </p>
    </main>
  );
}
