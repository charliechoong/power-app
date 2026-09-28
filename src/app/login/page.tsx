import { LoginForm } from "@/components/login-form";
import { storageMode } from "@/lib/server/config";
import { redirect } from "next/navigation";
export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";
export default function LoginPage() {
  if (storageMode() === "local") redirect("/reflections");
  return (
    <main id="main-content" className="account-page">
      <p className="eyebrow">COMMONPLACE · OWNER ACCESS</p>
      <h1>Welcome back.</h1>
      <p>Sign in to add and manage entries.</p>
      <LoginForm />
      <p className="account-hint">
        Everyone can read the collection. Only the owner can make changes.
      </p>
    </main>
  );
}
