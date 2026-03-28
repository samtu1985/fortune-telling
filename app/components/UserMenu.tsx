"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";

export default function UserMenu() {
  const { data: session } = useSession();
  if (!session?.user) return null;

  return (
    <div className="flex items-center gap-2">
      {session.user.image && (
        <Image
          src={session.user.image}
          alt=""
          width={28}
          height={28}
          className="rounded-full border border-gold/30"
        />
      )}
      <span className="text-xs text-mist hidden sm:inline max-w-[100px] truncate">
        {session.user.name}
      </span>
      <button
        onClick={() => signOut()}
        className="text-xs text-stone hover:text-gold transition-colors px-1"
      >
        登出
      </button>
    </div>
  );
}
