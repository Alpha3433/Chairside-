"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/barber/logout", { method: "POST" });
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={logout}
      className="text-xs font-medium text-neutral-400 hover:text-neutral-700"
    >
      Sign out
    </button>
  );
}
