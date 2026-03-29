"use client";

import dynamic from "next/dynamic";

// react-iztro imports CSS files, must be loaded client-side only
const Iztrolabe = dynamic(
  () => import("react-iztro").then((mod) => mod.Iztrolabe),
  { ssr: false }
);

interface ZiweiChartProps {
  birthday: string; // YYYY-M-D format
  birthTime: number; // 0-12 時辰 index
  gender: "男" | "女";
  birthdayType: "lunar" | "solar";
}

export default function ZiweiChart({
  birthday,
  birthTime,
  gender,
  birthdayType,
}: ZiweiChartProps) {
  return (
    <div className="my-4 rounded-lg border border-gold/20 overflow-hidden">
      <Iztrolabe
        birthday={birthday}
        birthTime={birthTime}
        gender={gender}
        birthdayType={birthdayType}
        lang="zh-TW"
        width="100%"
      />
    </div>
  );
}
