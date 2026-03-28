// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Origin, Horoscope } = require("circular-natal-horoscope-js");

interface AstrologyInput {
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm
  birthPlace: string; // City name
}

// Common city coordinates for birth chart calculation
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  // Taiwan
  台北: { lat: 25.033, lng: 121.565 },
  新北: { lat: 25.012, lng: 121.465 },
  桃園: { lat: 24.994, lng: 121.301 },
  台中: { lat: 24.148, lng: 120.674 },
  台南: { lat: 22.999, lng: 120.227 },
  高雄: { lat: 22.627, lng: 120.301 },
  基隆: { lat: 25.128, lng: 121.739 },
  新竹: { lat: 24.804, lng: 120.972 },
  嘉義: { lat: 23.480, lng: 120.449 },
  彰化: { lat: 24.081, lng: 120.539 },
  屏東: { lat: 22.669, lng: 120.487 },
  宜蘭: { lat: 24.752, lng: 121.753 },
  花蓮: { lat: 23.977, lng: 121.604 },
  台東: { lat: 22.755, lng: 121.145 },
  澎湖: { lat: 23.571, lng: 119.579 },
  金門: { lat: 24.449, lng: 118.377 },
  苗栗: { lat: 24.560, lng: 120.821 },
  南投: { lat: 23.909, lng: 120.685 },
  雲林: { lat: 23.709, lng: 120.431 },
  // China
  北京: { lat: 39.904, lng: 116.407 },
  上海: { lat: 31.230, lng: 121.474 },
  廣州: { lat: 23.129, lng: 113.264 },
  深圳: { lat: 22.543, lng: 114.058 },
  成都: { lat: 30.573, lng: 104.066 },
  杭州: { lat: 30.275, lng: 120.155 },
  南京: { lat: 32.060, lng: 118.797 },
  武漢: { lat: 30.593, lng: 114.305 },
  重慶: { lat: 29.563, lng: 106.551 },
  西安: { lat: 34.264, lng: 108.943 },
  天津: { lat: 39.084, lng: 117.201 },
  蘇州: { lat: 31.299, lng: 120.585 },
  長沙: { lat: 28.228, lng: 112.939 },
  瀋陽: { lat: 41.806, lng: 123.431 },
  大連: { lat: 38.914, lng: 121.615 },
  青島: { lat: 36.067, lng: 120.383 },
  昆明: { lat: 25.042, lng: 102.710 },
  福州: { lat: 26.075, lng: 119.306 },
  廈門: { lat: 24.480, lng: 118.089 },
  香港: { lat: 22.320, lng: 114.169 },
  澳門: { lat: 22.199, lng: 113.544 },
  // Japan
  東京: { lat: 35.682, lng: 139.759 },
  大阪: { lat: 34.694, lng: 135.502 },
  京都: { lat: 35.012, lng: 135.768 },
  名古屋: { lat: 35.181, lng: 136.906 },
  札幌: { lat: 43.062, lng: 141.354 },
  福岡: { lat: 33.590, lng: 130.402 },
  橫濱: { lat: 35.444, lng: 139.638 },
  神戶: { lat: 34.691, lng: 135.196 },
  沖繩: { lat: 26.335, lng: 127.801 },
  // Korea
  首爾: { lat: 37.567, lng: 126.978 },
  釜山: { lat: 35.180, lng: 129.076 },
  // Southeast Asia
  新加坡: { lat: 1.352, lng: 103.820 },
  曼谷: { lat: 13.756, lng: 100.502 },
  吉隆坡: { lat: 3.139, lng: 101.687 },
  馬尼拉: { lat: 14.599, lng: 120.984 },
  雅加達: { lat: -6.175, lng: 106.845 },
  河內: { lat: 21.028, lng: 105.854 },
  胡志明市: { lat: 10.823, lng: 106.630 },
  // US
  紐約: { lat: 40.713, lng: -74.006 },
  洛杉磯: { lat: 34.052, lng: -118.244 },
  舊金山: { lat: 37.775, lng: -122.419 },
  芝加哥: { lat: 41.878, lng: -87.630 },
  休斯頓: { lat: 29.760, lng: -95.370 },
  西雅圖: { lat: 47.606, lng: -122.332 },
  波士頓: { lat: 42.360, lng: -71.059 },
  華盛頓: { lat: 38.907, lng: -77.037 },
  // Europe
  倫敦: { lat: 51.507, lng: -0.128 },
  巴黎: { lat: 48.857, lng: 2.352 },
  柏林: { lat: 52.520, lng: 13.405 },
  羅馬: { lat: 41.903, lng: 12.496 },
  馬德里: { lat: 40.417, lng: -3.704 },
  阿姆斯特丹: { lat: 52.367, lng: 4.904 },
  維也納: { lat: 48.208, lng: 16.374 },
  蘇黎世: { lat: 47.377, lng: 8.542 },
  // Oceania
  雪梨: { lat: -33.869, lng: 151.209 },
  墨爾本: { lat: -37.814, lng: 144.963 },
  奧克蘭: { lat: -36.849, lng: 174.763 },
  // Others
  多倫多: { lat: 43.653, lng: -79.383 },
  溫哥華: { lat: 49.283, lng: -123.121 },
  杜拜: { lat: 25.205, lng: 55.271 },
};

function findCoords(place: string): { lat: number; lng: number } | null {
  // Direct match
  if (CITY_COORDS[place]) return CITY_COORDS[place];

  // Partial match — check if place contains or is contained by a key
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (place.includes(city) || city.includes(place)) return coords;
  }

  return null;
}

const ZODIAC_NAMES: Record<string, string> = {
  Aries: "牡羊座",
  Taurus: "金牛座",
  Gemini: "雙子座",
  Cancer: "巨蟹座",
  Leo: "獅子座",
  Virgo: "處女座",
  Libra: "天秤座",
  Scorpio: "天蠍座",
  Sagittarius: "射手座",
  Capricorn: "摩羯座",
  Aquarius: "水瓶座",
  Pisces: "雙魚座",
};

const PLANET_NAMES: Record<string, string> = {
  Sun: "太陽",
  Moon: "月亮",
  Mercury: "水星",
  Venus: "金星",
  Mars: "火星",
  Jupiter: "木星",
  Saturn: "土星",
  Uranus: "天王星",
  Neptune: "海王星",
  Pluto: "冥王星",
  Chiron: "凱龍星",
};

const ASPECT_NAMES: Record<string, string> = {
  Conjunction: "合相 (0°)",
  Opposition: "對分相 (180°)",
  Trine: "三分相 (120°)",
  Square: "四分相 (90°)",
  Sextile: "六分相 (60°)",
};

const HOUSE_NAMES = [
  "", "第一宮（命宮）", "第二宮（財帛宮）", "第三宮（兄弟宮）",
  "第四宮（家庭宮）", "第五宮（子女宮）", "第六宮（工作宮）",
  "第七宮（夫妻宮）", "第八宮（疾厄宮）", "第九宮（遷移宮）",
  "第十宮（事業宮）", "第十一宮（福德宮）", "第十二宮（玄秘宮）",
];

export function generateNatalChart(input: AstrologyInput): string | null {
  const coords = findCoords(input.birthPlace);
  if (!coords) return null;

  const [yearStr, monthStr, dayStr] = input.birthDate.split("-");
  const [hourStr, minStr] = input.birthTime.split(":");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1; // 0-indexed
  const date = parseInt(dayStr);
  const hour = parseInt(hourStr);
  const minute = parseInt(minStr);

  const origin = new Origin({
    year, month, date, hour, minute,
    latitude: coords.lat,
    longitude: coords.lng,
  });

  const horoscope = new Horoscope({
    origin,
    houseSystem: "placidus",
    zodiac: "tropical",
    aspectPoints: ["bodies", "points", "angles"],
    aspectWithPoints: ["bodies", "points", "angles"],
    aspectTypes: ["major"],
    language: "en",
  });

  const lines: string[] = [];

  lines.push("══════ 西洋星座星盤（由程式精確計算）══════");
  lines.push("");
  lines.push(`出生時間：${input.birthDate} ${input.birthTime}`);
  lines.push(`出生地點：${input.birthPlace}（${coords.lat.toFixed(3)}°N, ${coords.lng.toFixed(3)}°E）`);
  lines.push("");

  // Angles
  lines.push("────── 重要軸點 ──────");
  for (const angle of horoscope.Angles.all) {
    const sign = ZODIAC_NAMES[angle.Sign.label] || angle.Sign.label;
    const deg = Math.floor(angle.ChartPosition.Ecliptic.DecimalDegrees % 30);
    const label = angle.label === "Ascendant" ? "上升點 (ASC)" : "天頂 (MC)";
    lines.push(`${label}：${sign} ${deg}°`);
  }

  // Planets
  lines.push("");
  lines.push("────── 行星位置 ──────");
  for (const body of horoscope.CelestialBodies.all) {
    const name = PLANET_NAMES[body.label];
    if (!name) continue; // Skip Sirius etc.
    const sign = ZODIAC_NAMES[body.Sign.label] || body.Sign.label;
    const deg = Math.floor(body.ChartPosition.Ecliptic.DecimalDegrees % 30);
    const min = Math.floor(
      (body.ChartPosition.Ecliptic.DecimalDegrees % 1) * 60
    );
    // Determine which house
    const houseNum = body.House?.id || "";
    const houseLabel = houseNum ? ` — ${HOUSE_NAMES[houseNum] || `第${houseNum}宮`}` : "";
    lines.push(`${name}：${sign} ${deg}°${min}'${houseLabel}`);
  }

  // Houses
  lines.push("");
  lines.push("────── 宮位 (Placidus) ──────");
  for (const house of horoscope.Houses) {
    const sign = ZODIAC_NAMES[house.Sign.label] || house.Sign.label;
    const startDeg = house.ChartPosition.StartPosition.Ecliptic.DecimalDegrees;
    const deg = Math.floor(startDeg % 30);
    lines.push(`${HOUSE_NAMES[house.id] || `第${house.id}宮`}：${sign} ${deg}°`);
  }

  // Aspects
  lines.push("");
  lines.push("────── 主要相位 ──────");
  const aspects = horoscope.Aspects.all
    .filter(
      (a: { label: string }) =>
        ASPECT_NAMES[a.label] !== undefined
    )
    .slice(0, 25); // Limit to 25 most relevant

  for (const aspect of aspects) {
    const p1 = PLANET_NAMES[aspect.point1Label] || aspect.point1Label;
    const p2 = PLANET_NAMES[aspect.point2Label] || aspect.point2Label;
    const name = ASPECT_NAMES[aspect.label] || aspect.label;
    lines.push(`${p1} ${name} ${p2}（容許度 ${aspect.orb.toFixed(1)}°）`);
  }

  lines.push("");
  lines.push("══════ 星盤計算結束 ══════");

  return lines.join("\n");
}
