import { Solar } from "lunar-typescript";

interface BaziInput {
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm
  gender: string; // 男 or 女
  isLunar: boolean;
}

export function generateBaziChart(input: BaziInput): string {
  const [yearStr, monthStr, dayStr] = input.birthDate.split("-");
  const [hourStr, minStr] = input.birthTime.split(":");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const day = parseInt(dayStr);
  const hour = parseInt(hourStr);
  const minute = parseInt(minStr);

  let solar: InstanceType<typeof Solar>;
  if (input.isLunar) {
    // Convert lunar to solar first
    const { Lunar } = require("lunar-typescript");
    const lunar = Lunar.fromYmdHms(year, month, day, hour, minute, 0);
    solar = lunar.getSolar();
  } else {
    solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
  }

  const lunar = solar.getLunar();
  const bazi = lunar.getEightChar();
  const isMale = input.gender !== "女";

  const lines: string[] = [];

  lines.push("══════ 八字命盤（由程式精確排盤）══════");
  lines.push("");
  lines.push(`陽曆：${solar.getYear()}年${solar.getMonth()}月${solar.getDay()}日 ${hour}:${minStr}`);
  lines.push(`農曆：${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`);
  lines.push(`性別：${isMale ? "男" : "女"}`);

  // 四柱
  lines.push("");
  lines.push("────── 四柱排盤 ──────");
  lines.push(`年柱：${bazi.getYear()}（${bazi.getYearWuXing()}）納音：${bazi.getYearNaYin()}`);
  lines.push(`月柱：${bazi.getMonth()}（${bazi.getMonthWuXing()}）納音：${bazi.getMonthNaYin()}`);
  lines.push(`日柱：${bazi.getDay()}（${bazi.getDayWuXing()}）納音：${bazi.getDayNaYin()}　← 日主`);
  lines.push(`時柱：${bazi.getTime()}（${bazi.getTimeWuXing()}）納音：${bazi.getTimeNaYin()}`);

  // 日主
  const dayGan = bazi.getDayGan();
  lines.push("");
  lines.push(`日主（日元）：${dayGan}`);

  // 十神
  lines.push("");
  lines.push("────── 十神配置 ──────");
  lines.push(`年柱天干十神：${bazi.getYearShiShenGan()}　地支十神：${(bazi.getYearShiShenZhi() as string[]).join("、")}`);
  lines.push(`月柱天干十神：${bazi.getMonthShiShenGan()}　地支十神：${(bazi.getMonthShiShenZhi() as string[]).join("、")}`);
  lines.push(`日柱地支十神：${(bazi.getDayShiShenZhi() as string[]).join("、")}`);
  lines.push(`時柱天干十神：${bazi.getTimeShiShenGan()}　地支十神：${(bazi.getTimeShiShenZhi() as string[]).join("、")}`);

  // 藏干
  lines.push("");
  lines.push("────── 地支藏干 ──────");
  lines.push(`年支 ${bazi.getYearZhi()} 藏：${(bazi.getYearHideGan() as string[]).join("、")}`);
  lines.push(`月支 ${bazi.getMonthZhi()} 藏：${(bazi.getMonthHideGan() as string[]).join("、")}`);
  lines.push(`日支 ${bazi.getDayZhi()} 藏：${(bazi.getDayHideGan() as string[]).join("、")}`);
  lines.push(`時支 ${bazi.getTimeZhi()} 藏：${(bazi.getTimeHideGan() as string[]).join("、")}`);

  // 地勢（十二長生）
  lines.push("");
  lines.push("────── 十二長生 ──────");
  lines.push(`年柱：${bazi.getYearDiShi()}`);
  lines.push(`月柱：${bazi.getMonthDiShi()}`);
  lines.push(`日柱：${bazi.getDayDiShi()}`);
  lines.push(`時柱：${bazi.getTimeDiShi()}`);

  // 胎元、命宮、身宮
  lines.push("");
  lines.push("────── 胎元・命宮・身宮 ──────");
  lines.push(`胎元：${bazi.getTaiYuan()}（${bazi.getTaiYuanNaYin()}）`);
  lines.push(`命宮：${bazi.getMingGong()}（${bazi.getMingGongNaYin()}）`);
  lines.push(`身宮：${bazi.getShenGong()}（${bazi.getShenGongNaYin()}）`);

  // 旬空
  lines.push("");
  lines.push("────── 旬空 ──────");
  lines.push(`年柱旬空：${bazi.getYearXunKong()}`);
  lines.push(`日柱旬空：${bazi.getDayXunKong()}`);

  // 五行統計
  lines.push("");
  lines.push("────── 五行力量分析 ──────");
  const allGan = [bazi.getYearGan(), bazi.getMonthGan(), dayGan, bazi.getTimeGan()];
  const allZhi = [bazi.getYearZhi(), bazi.getMonthZhi(), bazi.getDayZhi(), bazi.getTimeZhi()];
  const allHideGan = [
    ...(bazi.getYearHideGan() as string[]),
    ...(bazi.getMonthHideGan() as string[]),
    ...(bazi.getDayHideGan() as string[]),
    ...(bazi.getTimeHideGan() as string[]),
  ];

  const ganWuxing: Record<string, string> = {
    甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土",
    己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
  };
  const zhiWuxing: Record<string, string> = {
    子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火",
    午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水",
  };

  const counts: Record<string, number> = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };
  for (const g of allGan) { counts[ganWuxing[g]] = (counts[ganWuxing[g]] || 0) + 1; }
  for (const z of allZhi) { counts[zhiWuxing[z]] = (counts[zhiWuxing[z]] || 0) + 1; }

  const hideWxCounts: Record<string, number> = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };
  for (const g of allHideGan) { hideWxCounts[ganWuxing[g]] = (hideWxCounts[ganWuxing[g]] || 0) + 1; }

  lines.push(`天干地支：金${counts["金"]} 木${counts["木"]} 水${counts["水"]} 火${counts["火"]} 土${counts["土"]}`);
  lines.push(`含藏干：金${counts["金"] + hideWxCounts["金"]} 木${counts["木"] + hideWxCounts["木"]} 水${counts["水"] + hideWxCounts["水"]} 火${counts["火"] + hideWxCounts["火"]} 土${counts["土"] + hideWxCounts["土"]}`);

  // 大運
  lines.push("");
  lines.push("────── 大運 ──────");
  const yun = bazi.getYun(isMale ? 1 : 0);
  lines.push(`起運：${yun.getStartYear()}年${yun.getStartMonth()}月${yun.getStartDay()}日`);

  const daYunList = yun.getDaYun();
  for (const dy of daYunList) {
    const gz = dy.getGanZhi();
    if (!gz) continue; // Skip the first empty entry
    lines.push(`${dy.getStartAge()}~${dy.getEndAge()}歲：${gz}`);
  }

  // 近期流年
  lines.push("");
  lines.push("────── 近期流年 ──────");
  const currentYear = new Date().getFullYear();
  // Find the 大運 that contains current year
  for (const dy of daYunList) {
    const liuNianList = dy.getLiuNian();
    for (const ln of liuNianList) {
      const y = ln.getYear();
      if (y >= currentYear - 1 && y <= currentYear + 5) {
        lines.push(`${y}年：${ln.getGanZhi()}`);
      }
    }
  }

  lines.push("");
  lines.push("══════ 排盤結束 ══════");

  return lines.join("\n");
}
