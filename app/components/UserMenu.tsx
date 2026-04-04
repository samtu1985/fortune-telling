"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import ProfileModal from "./ProfileModal";

const ADMIN_EMAIL = "geektu@gmail.com";

export default function UserMenu() {
  const { data: session } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  if (!session?.user) return null;

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 min-h-[44px]"
        >
          {session.user.image ? (
            <Image
              src={session.user.image}
              alt=""
              width={28}
              height={28}
              className="rounded-full border border-gold/30"
            />
          ) : (
            <div className="w-7 h-7 rounded-full border border-gold/30 bg-gold/10 flex items-center justify-center text-xs text-gold">
              {session.user.name?.[0]}
            </div>
          )}
          <span className="text-xs text-mist hidden sm:inline max-w-[100px] truncate">
            {session.user.name}
          </span>
          {/* Chevron */}
          <svg
            className={`w-3 h-3 text-stone transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-gold/15 shadow-lg overflow-hidden z-50"
            style={{ background: "var(--parchment-light)" }}
          >
            <button
              onClick={() => {
                setDropdownOpen(false);
                setProfileOpen(true);
              }}
              className="w-full text-left px-4 py-3 min-h-[44px] text-sm text-cream hover:bg-gold/10 transition-colors flex items-center gap-2.5"
            >
              <svg className="w-4 h-4 text-gold-dim shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              管理出生資料檔案
            </button>

            {session.user.email === ADMIN_EMAIL && (
              <>
                <div className="h-px" style={{ background: "rgba(var(--glass-rgb), 0.08)" }} />
                <a
                  href="/admin"
                  onClick={() => setDropdownOpen(false)}
                  className="w-full text-left px-4 py-3 min-h-[44px] text-sm text-cream hover:bg-gold/10 transition-colors flex items-center gap-2.5"
                >
                  <svg className="w-4 h-4 text-gold-dim shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  使用者管理
                </a>
                <a
                  href="/admin?tab=ai"
                  onClick={() => setDropdownOpen(false)}
                  className="w-full text-left px-4 py-3 min-h-[44px] text-sm text-cream hover:bg-gold/10 transition-colors flex items-center gap-2.5"
                >
                  <svg className="w-4 h-4 text-gold-dim shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  AI 引擎設定
                </a>
              </>
            )}
            <div className="h-px" style={{ background: "rgba(var(--glass-rgb), 0.08)" }} />
            <button
              onClick={() => signOut()}
              className="w-full text-left px-4 py-3 min-h-[44px] text-sm text-stone hover:bg-gold/10 transition-colors flex items-center gap-2.5"
            >
              <svg className="w-4 h-4 text-stone shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              登出
            </button>
          </div>
        )}
      </div>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
