import { astro } from "iztro";
import { DestinyBoard, DestinyConfigBuilder } from "fortel-ziweidoushu";

interface ZiweiInput {
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm
  gender: string; // 男 or 女
  isLunar: boolean;
  isLeapMonth?: boolean;
}

/**
 * Convert HH:mm time to Chinese time period index (0-12)
 * 0=早子時(00:00-01:00), 1=丑時, ..., 12=晚子時(23:00-00:00)
 */
function timeToIndex(time: string): number {
  const [h] = time.split(":").map(Number);
  // iztro uses 0-12 index for 時辰:
  // 0=早子(23-01), 1=丑(01-03), 2=寅(03-05), ... 11=亥(21-23), 12=晚子
  if (h >= 23 || h < 1) return 0;
  if (h >= 1 && h < 3) return 1;
  if (h >= 3 && h < 5) return 2;
  if (h >= 5 && h < 7) return 3;
  if (h >= 7 && h < 9) return 4;
  if (h >= 9 && h < 11) return 5;
  if (h >= 11 && h < 13) return 6;
  if (h >= 13 && h < 15) return 7;
  if (h >= 15 && h < 17) return 8;
  if (h >= 17 && h < 19) return 9;
  if (h >= 19 && h < 21) return 10;
  return 11; // 21-23
}

const SHICHEN_NAMES = [
  "子時", "丑時", "寅時", "卯時", "辰時", "巳時",
  "午時", "未時", "申時", "酉時", "戌時", "亥時", "晚子時",
];

export function generateZiweiChart(input: ZiweiInput): string {
  const timeIdx = timeToIndex(input.birthTime);
  const genderStr = input.gender === "女" ? "女" : "男";

  const chart = input.isLunar
    ? astro.byLunar(input.birthDate, timeIdx, genderStr, !!input.isLeapMonth, true, "zh-TW")
    : astro.bySolar(input.birthDate, timeIdx, genderStr, true, "zh-TW");

  const lines: string[] = [];

  lines.push("<ziwei-chart source=\"iztro+fortel-ziweidoushu\" method=\"紫微斗數精確排盤\">");
  lines.push("");
  lines.push(`陽曆：${chart.solarDate}`);
  lines.push(`農曆：${chart.lunarDate}`);
  lines.push(`時辰：${SHICHEN_NAMES[timeIdx]}（${input.birthTime}）`);
  lines.push(`性別：${genderStr}`);
  lines.push(`生肖：${chart.zodiac}`);
  lines.push(`命主：${chart.soul}`);
  lines.push(`身主：${chart.body}`);
  lines.push(`五行局：${chart.fiveElementsClass}`);
  lines.push(`命宮地支：${chart.earthlyBranchOfSoulPalace}`);
  lines.push(`身宮地支：${chart.earthlyBranchOfBodyPalace}`);
  lines.push("");
  lines.push("【十二宮位排盤】");

  for (const p of chart.palaces) {
    lines.push("");
    lines.push(`【${p.name}】（${p.heavenlyStem}${p.earthlyBranch}）`);

    const majors = p.majorStars
      ?.filter((s) => s.name)
      .map((s) => {
        let str = s.name;
        if (s.brightness) str += `(${s.brightness})`;
        if (s.mutagen) str += `[${s.mutagen}]`;
        return str;
      });
    lines.push(`  主星：${majors && majors.length > 0 ? majors.join("、") : "無主星（借對宮星曜）"}`);

    const minors = p.minorStars
      ?.filter((s) => s.name)
      .map((s) => {
        let str = s.name;
        if (s.mutagen) str += `[${s.mutagen}]`;
        return str;
      });
    if (minors && minors.length > 0) {
      lines.push(`  輔星：${minors.join("、")}`);
    }

    const adjs = p.adjectiveStars?.filter((s) => s.name).map((s) => s.name);
    if (adjs && adjs.length > 0) {
      lines.push(`  雜曜：${adjs.join("、")}`);
    }

    // 大限 (Decadal fortune period)
    if (p.decadal?.range) {
      lines.push(`  大限：${p.decadal.range[0]}~${p.decadal.range[1]}歲（${p.decadal.heavenlyStem}${p.decadal.earthlyBranch}）`);
    }

    // 小限歲數 (Annual ages passing through this palace)
    if (p.ages && p.ages.length > 0) {
      lines.push(`  小限經過歲數：${p.ages.join("、")}`);
    }
  }

  // Summary: 大限順序
  lines.push("");
  lines.push("【大限總覽】");
  const decadalOrder = chart.palaces
    .filter((p: { decadal?: { range?: number[] } }) => p.decadal?.range)
    .sort((a: { decadal: { range: number[] } }, b: { decadal: { range: number[] } }) => a.decadal.range[0] - b.decadal.range[0]);
  for (const p of decadalOrder) {
    const majors = p.majorStars
      ?.filter((s: { name: string }) => s.name)
      .map((s: { name: string; brightness?: string }) => s.name + (s.brightness ? `(${s.brightness})` : ""))
      .join("、") || "無主星";
    lines.push(`${p.decadal.range[0]}~${p.decadal.range[1]}歲 → ${p.name}（${majors}）`);
  }

  // Cross-reference with fortel-ziweidoushu (中州派)
  try {
    const shichenName = SHICHEN_NAMES[timeIdx];
    const [y, m, d] = (input.isLunar ? chart.solarDate : input.birthDate).split("-").map(Number);
    const genderFlag = genderStr === "男" ? "男" : "女";
    const fortelText = `公曆${y}年${m}月${d}日${shichenName}出生${genderFlag}士`;
    const board = new DestinyBoard(DestinyConfigBuilder.withText(fortelText));

    lines.push("");
    lines.push("【中州派交叉驗證（fortel-ziweidoushu）】");
    lines.push("※ 以下為中州派算法結果，與上方排盤如有差異屬門派差異，非計算錯誤");
    lines.push(`命主：${board.destinyMaster?.toString() || "?"}`);
    lines.push(`身主：${board.bodyMaster?.toString() || "?"}`);

    for (const cell of board.cells) {
      const temples = cell.temples?.map((t: { toString(): string }) => t.toString()).join("、") || "?";
      const majors = cell.majorStars?.map((s: { toString(): string }) => s.toString()).join("、") || "無主星";
      const ground = cell.ground?.toString() || "?";
      const lifeStage = cell.lifeStage?.toString() || "";
      lines.push(`${ground} [${temples}]：${majors}（大限 ${cell.ageStart}-${cell.ageEnd}歲）${lifeStage ? `[${lifeStage}]` : ""}`);
    }
  } catch (e) {
    console.error("[ziwei] fortel cross-reference failed:", e);
  }

  lines.push("");
  lines.push("</ziwei-chart>");

  return lines.join("\n");
}
