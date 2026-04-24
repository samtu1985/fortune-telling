import type { Locale } from "@/app/lib/i18n";

type TermMap = Record<string, string>;

const IDENTITY: TermMap = {}; // English is canonical, fall back to raw value

// ── Types ──
const TYPE_ZH_HANT: TermMap = {
  "Manifestor": "顯示者",
  "Generator": "生產者",
  "Manifesting Generator": "顯示生產者",
  "Projector": "投射者",
  "Reflector": "反映者",
};
const TYPE_ZH_HANS: TermMap = {
  "Manifestor": "显示者",
  "Generator": "生产者",
  "Manifesting Generator": "显示生产者",
  "Projector": "投射者",
  "Reflector": "反映者",
};
const TYPE_JA: TermMap = {
  "Manifestor": "マニフェスター",
  "Generator": "ジェネレーター",
  "Manifesting Generator": "マニフェスティング・ジェネレーター",
  "Projector": "プロジェクター",
  "Reflector": "リフレクター",
};

// ── Strategy ──
// API values we've seen: "Wait to Respond", "Wait for the Invitation", "To Inform", "Wait a Lunar Cycle"
// Include common variants.
const STRATEGY_ZH_HANT: TermMap = {
  "Wait to Respond": "等待回應",
  "To Respond": "等待回應",
  "Respond": "等待回應",
  "To Inform": "告知",
  "Inform": "告知",
  "Wait for the Invitation": "等待被邀請",
  "Wait for Invitation": "等待被邀請",
  "Wait a Lunar Cycle": "等待28天月亮週期",
  "Wait 28 Days": "等待28天月亮週期",
};
const STRATEGY_ZH_HANS: TermMap = {
  "Wait to Respond": "等待回应",
  "To Respond": "等待回应",
  "Respond": "等待回应",
  "To Inform": "告知",
  "Inform": "告知",
  "Wait for the Invitation": "等待被邀请",
  "Wait for Invitation": "等待被邀请",
  "Wait a Lunar Cycle": "等待28天月亮周期",
  "Wait 28 Days": "等待28天月亮周期",
};
const STRATEGY_JA: TermMap = {
  "Wait to Respond": "反応を待つ",
  "To Respond": "反応を待つ",
  "Respond": "反応を待つ",
  "To Inform": "告知する",
  "Inform": "告知する",
  "Wait for the Invitation": "招待を待つ",
  "Wait for Invitation": "招待を待つ",
  "Wait a Lunar Cycle": "ひと月（28日）待つ",
  "Wait 28 Days": "ひと月（28日）待つ",
};

// ── Authority ──
// API values: "Sacral", "Emotional", "Splenic", "Ego", "Self-Projected", "Mental", "Lunar"
const AUTHORITY_ZH_HANT: TermMap = {
  "Sacral": "薦骨型權威",
  "Emotional": "情緒型權威",
  "Splenic": "直覺型權威",
  "Ego": "意志力型權威",
  "Heart": "意志力型權威",
  "Self-Projected": "自我投射型權威",
  "Self Projected": "自我投射型權威",
  "G Center": "自我投射型權威",
  "Mental": "心智權威",
  "Outer": "外在權威",
  "Lunar": "月亮週期權威",
  "None": "無權威（反映者）",
};
const AUTHORITY_ZH_HANS: TermMap = {
  "Sacral": "荐骨型权威",
  "Emotional": "情绪型权威",
  "Splenic": "直觉型权威",
  "Ego": "意志力型权威",
  "Heart": "意志力型权威",
  "Self-Projected": "自我投射型权威",
  "Self Projected": "自我投射型权威",
  "G Center": "自我投射型权威",
  "Mental": "心智权威",
  "Outer": "外在权威",
  "Lunar": "月亮周期权威",
  "None": "无权威（反映者）",
};
const AUTHORITY_JA: TermMap = {
  "Sacral": "仙骨型オーソリティ",
  "Emotional": "感情型オーソリティ",
  "Splenic": "スプリーン型オーソリティ",
  "Ego": "エゴ型オーソリティ",
  "Heart": "エゴ型オーソリティ",
  "Self-Projected": "セルフ・プロジェクテッド",
  "Self Projected": "セルフ・プロジェクテッド",
  "G Center": "セルフ・プロジェクテッド",
  "Mental": "メンタル型オーソリティ",
  "Outer": "アウター・オーソリティ",
  "Lunar": "月周期オーソリティ",
  "None": "オーソリティなし（リフレクター）",
};

// ── Definition ──
// API values: "Single Definition", "Split Definition", "Triple Split", "Quadruple Split" (variants with/without "Definition")
const DEFINITION_ZH_HANT: TermMap = {
  "Single Definition": "一分人",
  "Single": "一分人",
  "Split Definition": "二分人",
  "Split": "二分人",
  "Triple Split": "三分人",
  "Triple Split Definition": "三分人",
  "Quadruple Split": "四分人",
  "Quadruple Split Definition": "四分人",
  "Quad Split": "四分人",
  "No Definition": "無定義",
  "None": "無定義",
};
const DEFINITION_ZH_HANS: TermMap = {
  "Single Definition": "一分人",
  "Single": "一分人",
  "Split Definition": "二分人",
  "Split": "二分人",
  "Triple Split": "三分人",
  "Triple Split Definition": "三分人",
  "Quadruple Split": "四分人",
  "Quadruple Split Definition": "四分人",
  "Quad Split": "四分人",
  "No Definition": "无定义",
  "None": "无定义",
};
const DEFINITION_JA: TermMap = {
  "Single Definition": "シングル定義",
  "Single": "シングル定義",
  "Split Definition": "スプリット定義",
  "Split": "スプリット定義",
  "Triple Split": "トリプル・スプリット",
  "Triple Split Definition": "トリプル・スプリット",
  "Quadruple Split": "クアドラプル・スプリット",
  "Quadruple Split Definition": "クアドラプル・スプリット",
  "Quad Split": "クアドラプル・スプリット",
  "No Definition": "定義なし",
  "None": "定義なし",
};

// ── Signature ──
// API: "Satisfaction", "Success", "Peace", "Surprise"
const SIGNATURE_ZH_HANT: TermMap = {
  "Satisfaction": "滿足",
  "Success": "成功",
  "Peace": "平和",
  "Surprise": "驚喜",
};
const SIGNATURE_ZH_HANS: TermMap = {
  "Satisfaction": "满足",
  "Success": "成功",
  "Peace": "平和",
  "Surprise": "惊喜",
};
const SIGNATURE_JA: TermMap = {
  "Satisfaction": "満足",
  "Success": "成功",
  "Peace": "平和",
  "Surprise": "驚き",
};

// ── Not-Self Theme ──
// API: "Frustration", "Anger", "Bitterness", "Disappointment"
const NOT_SELF_ZH_HANT: TermMap = {
  "Frustration": "挫敗感",
  "Anger": "憤怒",
  "Bitterness": "苦澀",
  "Disappointment": "失望",
};
const NOT_SELF_ZH_HANS: TermMap = {
  "Frustration": "挫败感",
  "Anger": "愤怒",
  "Bitterness": "苦涩",
  "Disappointment": "失望",
};
const NOT_SELF_JA: TermMap = {
  "Frustration": "フラストレーション",
  "Anger": "怒り",
  "Bitterness": "苦さ",
  "Disappointment": "失望",
};

export type HdTermCategory =
  | "type" | "strategy" | "authority" | "definition" | "signature" | "notSelf";

const MAPS: Record<HdTermCategory, Partial<Record<Locale, TermMap>>> = {
  type: { "zh-Hant": TYPE_ZH_HANT, "zh-Hans": TYPE_ZH_HANS, ja: TYPE_JA, en: IDENTITY },
  strategy: { "zh-Hant": STRATEGY_ZH_HANT, "zh-Hans": STRATEGY_ZH_HANS, ja: STRATEGY_JA, en: IDENTITY },
  authority: { "zh-Hant": AUTHORITY_ZH_HANT, "zh-Hans": AUTHORITY_ZH_HANS, ja: AUTHORITY_JA, en: IDENTITY },
  definition: { "zh-Hant": DEFINITION_ZH_HANT, "zh-Hans": DEFINITION_ZH_HANS, ja: DEFINITION_JA, en: IDENTITY },
  signature: { "zh-Hant": SIGNATURE_ZH_HANT, "zh-Hans": SIGNATURE_ZH_HANS, ja: SIGNATURE_JA, en: IDENTITY },
  notSelf: { "zh-Hant": NOT_SELF_ZH_HANT, "zh-Hans": NOT_SELF_ZH_HANS, ja: NOT_SELF_JA, en: IDENTITY },
};

/**
 * Localize a Human Design term value (e.g. "Manifesting Generator") into the
 * given locale. Falls back to the original English string if the translation
 * table doesn't have an entry for that value — ensuring the UI never shows
 * empty text even for unknown variants (e.g. rare authority types).
 */
export function localizeHdTerm(locale: Locale, category: HdTermCategory, value: string): string {
  const map = MAPS[category]?.[locale];
  if (!map) return value;
  return map[value] ?? value;
}
