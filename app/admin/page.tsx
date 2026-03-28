"use client";

import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import SmokeParticles from "@/app/components/SmokeParticles";
import ThemeToggle from "@/app/components/ThemeToggle";

interface UserItem {
  email: string;
  name: string | null;
  image: string | null;
  status: "pending" | "approved" | "disabled";
  createdAt: string;
  approvedAt: string | null;
}

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending: { text: "待審核", color: "text-yellow-500" },
  approved: { text: "已核准", color: "text-green-500" },
  disabled: { text: "已停用", color: "text-red-400" },
};

export default function AdminPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateStatus = async (
    email: string,
    status: "approved" | "disabled"
  ) => {
    setActionLoading(email);
    try {
      await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, status }),
      });
      await fetchUsers();
    } finally {
      setActionLoading(null);
    }
  };

  const removeUser = async (email: string) => {
    if (!confirm(`確定要刪除 ${email} 嗎？`)) return;
    setActionLoading(email);
    try {
      await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      await fetchUsers();
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = users.filter((u) => u.status === "pending").length;

  return (
    <main className="relative z-10 min-h-screen">
      <SmokeParticles />

      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-4 sm:px-6 pt-4 pb-2">
        <a
          href="/"
          className="flex items-center gap-1.5 text-sm text-stone hover:text-mist transition-colors min-h-[44px] font-serif"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          返回首頁
        </a>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-stone hover:text-gold transition-colors"
          >
            登出
          </button>
        </div>
      </div>

      {/* Header */}
      <header className="text-center py-6">
        <h1 className="font-serif text-2xl font-bold tracking-[0.15em] text-gold">
          使用者管理
        </h1>
        {pendingCount > 0 && (
          <p className="text-sm text-yellow-500 mt-2">
            {pendingCount} 位使用者等待審核
          </p>
        )}
        <div className="mx-auto mt-4 w-24 gold-line" />
      </header>

      {/* User list */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-12">
        {loading ? (
          <div className="text-center py-12">
            <span className="inline-block w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-center text-stone/60 py-12">尚無使用者</p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => {
              const status = STATUS_LABELS[user.status];
              const isLoading = actionLoading === user.email;

              return (
                <div
                  key={user.email}
                  className={`
                    rounded-lg border p-4 transition-colors
                    ${
                      user.status === "pending"
                        ? "border-yellow-500/30 bg-yellow-500/[0.03]"
                        : "border-gold/10"
                    }
                  `}
                  style={{
                    backgroundColor:
                      user.status !== "pending"
                        ? "rgba(var(--glass-rgb), 0.02)"
                        : undefined,
                  }}
                >
                  <div className="flex items-start gap-3 sm:items-center">
                    {/* Avatar */}
                    {user.image ? (
                      <img
                        src={user.image}
                        alt=""
                        className="w-10 h-10 rounded-full border border-gold/20 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full border border-gold/20 bg-gold/10 flex items-center justify-center text-sm text-gold shrink-0">
                        {user.name?.[0] || "?"}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-cream font-medium truncate">
                          {user.name || "未命名"}
                        </span>
                        <span className={`text-xs ${status.color}`}>
                          {status.text}
                        </span>
                      </div>
                      <p className="text-xs text-stone/60 truncate">
                        {user.email}
                      </p>
                      <p className="text-xs text-stone/40 mt-0.5">
                        註冊於{" "}
                        {new Date(user.createdAt).toLocaleDateString("zh-TW")}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                      {isLoading ? (
                        <span className="inline-block w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                      ) : (
                        <>
                          {user.status === "pending" && (
                            <button
                              onClick={() =>
                                updateStatus(user.email, "approved")
                              }
                              className="px-3 py-1.5 min-h-[36px] text-xs text-green-500 border border-green-500/30 rounded hover:bg-green-500/10 transition-colors"
                            >
                              核准
                            </button>
                          )}
                          {user.status === "approved" && (
                            <button
                              onClick={() =>
                                updateStatus(user.email, "disabled")
                              }
                              className="px-3 py-1.5 min-h-[36px] text-xs text-yellow-500 border border-yellow-500/30 rounded hover:bg-yellow-500/10 transition-colors"
                            >
                              停用
                            </button>
                          )}
                          {user.status === "disabled" && (
                            <button
                              onClick={() =>
                                updateStatus(user.email, "approved")
                              }
                              className="px-3 py-1.5 min-h-[36px] text-xs text-green-500 border border-green-500/30 rounded hover:bg-green-500/10 transition-colors"
                            >
                              啟用
                            </button>
                          )}
                          <button
                            onClick={() => removeUser(user.email)}
                            className="px-3 py-1.5 min-h-[36px] text-xs text-red-400 border border-red-400/30 rounded hover:bg-red-400/10 transition-colors"
                          >
                            刪除
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
