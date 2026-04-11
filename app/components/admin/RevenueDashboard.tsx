"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Range = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y";
const RANGES: Range[] = ["1D", "1W", "1M", "3M", "6M", "1Y"];

interface ConnectionStatus {
  secretKey: boolean;
  webhookSecret: boolean;
  publishableKey: boolean;
}

interface StatsResponse {
  range: Range;
  cards: {
    totalAmount: number;
    count: number;
    avgOrderValue: number;
    newPayingUsers: number;
  };
  lineChart: Array<{ bucket: string; total: number; count: number }>;
  barChart: Array<{
    package_id: number | null;
    name: string | null;
    total: number;
    count: number;
  }>;
}

interface TransactionRow {
  id: number;
  createdAt: string;
  userEmail: string | null;
  userId: number | null;
  packageName: string | null;
  amount: number;
  currency: string;
  status: string;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
}

interface TransactionsResponse {
  rows: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface ReconcileResponse {
  local: { count: number; total: number };
  stripe: { count: number; total: number };
  match: boolean;
  days: number;
  error: string | null;
}

type SortKey = "time" | "amount" | "user";
type SortDir = "asc" | "desc";

function formatHkd(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `HK$ ${(cents / 100).toLocaleString("en-HK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-HK", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: "bg-green-500/20 text-green-400",
    refunded: "bg-orange-500/20 text-orange-400",
    failed: "bg-red-500/20 text-red-400",
  };
  const cls = styles[status] ?? "bg-stone-500/20 text-mist";
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${cls}`}>{status}</span>
  );
}

export default function RevenueDashboard() {
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(true);

  const [range, setRange] = useState<Range>("1M");
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sort, setSort] = useState<SortKey>("time");
  const [dir, setDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [transactions, setTransactions] =
    useState<TransactionsResponse | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const [reconcile, setReconcile] = useState<ReconcileResponse | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState(true);

  // Connection status on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setConnectionLoading(true);
      try {
        const res = await fetch("/api/admin/payments/connection", {
          cache: "no-store",
        });
        const data = await res.json();
        if (!cancelled && res.ok) setConnection(data);
      } catch {
        // ignored; connection panel will show unknown
      } finally {
        if (!cancelled) setConnectionLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reconcile on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReconcileLoading(true);
      try {
        const res = await fetch("/api/admin/payments/stripe-reconcile?days=7", {
          cache: "no-store",
        });
        const data = await res.json();
        if (!cancelled && res.ok) setReconcile(data);
      } catch {
        // ignored
      } finally {
        if (!cancelled) setReconcileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Stats on range change
  const canQuery = Boolean(connection?.secretKey);
  useEffect(() => {
    if (!canQuery) return;
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const res = await fetch(
          `/api/admin/payments/stats?range=${range}`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setStatsError(data.error ?? "載入失敗");
          return;
        }
        setStats(data);
      } catch (e) {
        if (!cancelled)
          setStatsError(e instanceof Error ? e.message : "載入失敗");
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range, canQuery]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  // Transactions when debouncedQ / sort / dir / page changes
  const fetchTransactions = useCallback(async () => {
    setTxLoading(true);
    setTxError(null);
    try {
      const params = new URLSearchParams({
        q: debouncedQ,
        sort,
        dir,
        page: String(page),
      });
      const res = await fetch(
        `/api/admin/payments/transactions?${params.toString()}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) {
        setTxError(data.error ?? "載入失敗");
        return;
      }
      setTransactions(data);
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setTxLoading(false);
    }
  }, [debouncedQ, sort, dir, page]);

  useEffect(() => {
    if (!canQuery) return;
    fetchTransactions();
  }, [fetchTransactions, canQuery]);

  function toggleSort(key: SortKey) {
    if (sort === key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setDir("desc");
    }
    setPage(1);
  }

  function sortIndicator(key: SortKey): string {
    if (sort !== key) return "";
    return dir === "asc" ? " ↑" : " ↓";
  }

  // ---- Connection status card ----
  const renderConnectionCard = () => {
    if (connectionLoading) {
      return (
        <div className="glass-card-premium p-4 text-mist text-sm">
          檢查 Stripe 連線狀態…
        </div>
      );
    }
    if (!connection) {
      return (
        <div className="glass-card-premium p-4 bg-red-900/20 border border-red-600/40 text-sm text-red-400">
          無法取得 Stripe 連線狀態
        </div>
      );
    }
    const missing: string[] = [];
    if (!connection.secretKey) missing.push("STRIPE_SECRET_KEY");
    if (!connection.webhookSecret) missing.push("STRIPE_WEBHOOK_SECRET");
    if (!connection.publishableKey)
      missing.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");

    if (missing.length === 0) {
      return (
        <div className="glass-card-premium p-4 bg-emerald-900/20 border border-emerald-600/40">
          <div className="font-serif text-emerald-400">✓ Stripe 已連線</div>
          <div className="text-xs text-mist mt-1">
            Secret Key / Webhook Secret / Publishable Key 皆已設定
          </div>
        </div>
      );
    }

    return (
      <div className="glass-card-premium p-4 bg-yellow-900/20 border border-yellow-600/40">
        <div className="font-serif text-yellow-400">
          ⚠ Stripe 設定不完整
        </div>
        <div className="text-sm text-cream mt-2">
          缺少環境變數：
          <ul className="list-disc list-inside mt-1 font-mono text-xs text-yellow-300">
            {missing.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </div>
        <div className="text-xs text-mist mt-2">
          請於 Vercel 專案的 Environment Variables 設定，並重新部署以套用。
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderConnectionCard()}

      {!connectionLoading && connection && !connection.secretKey ? (
        <div className="glass-card-premium p-8 text-center text-mist">
          STRIPE_SECRET_KEY 未設定，儀表板停用中。
        </div>
      ) : (
        <>
          {/* Range selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-mist mr-1">時間區間：</span>
            <div className="inline-flex rounded border border-gold/30 overflow-hidden">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 text-xs transition-colors ${
                    r === range
                      ? "bg-gold/20 text-gold"
                      : "text-mist hover:bg-gold/10 hover:text-gold"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {statsLoading && (
              <span className="text-xs text-mist ml-2">載入中…</span>
            )}
          </div>

          {statsError && (
            <div className="p-2 rounded bg-red-500/10 text-red-400 text-sm">
              {statsError}
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="總收入"
              value={formatHkd(stats?.cards.totalAmount ?? 0)}
            />
            <StatCard
              label="交易筆數"
              value={(stats?.cards.count ?? 0).toLocaleString()}
            />
            <StatCard
              label="平均客單價"
              value={formatHkd(stats?.cards.avgOrderValue ?? 0)}
            />
            <StatCard
              label="新付費使用者"
              value={(stats?.cards.newPayingUsers ?? 0).toLocaleString()}
            />
          </div>

          {/* Line chart */}
          <div className="glass-card-premium p-4">
            <div className="font-serif text-gold mb-2">收入趨勢</div>
            {stats && stats.lineChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={stats.lineChart}>
                  <CartesianGrid stroke="#a17c1e22" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fill: "#a8a29e", fontSize: 11 }}
                    tickFormatter={(v) => new Date(v).toLocaleDateString()}
                  />
                  <YAxis
                    tick={{ fill: "#a8a29e", fontSize: 11 }}
                    tickFormatter={(v) =>
                      `HK$${(Number(v) / 100).toLocaleString()}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10,10,10,0.92)",
                      border: "1px solid #a17c1e55",
                      borderRadius: 6,
                      color: "#f5f5f4",
                    }}
                    labelFormatter={(v) => new Date(v).toLocaleString()}
                    formatter={(v) =>
                      `HK$ ${(Number(v) / 100).toFixed(2)}`
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#a17c1e"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-mist text-sm">
                {statsLoading ? "載入中…" : "尚無資料"}
              </div>
            )}
          </div>

          {/* Bar chart */}
          <div className="glass-card-premium p-4">
            <div className="font-serif text-gold mb-2">方案貢獻</div>
            {stats && stats.barChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={stats.barChart.map((row) => ({
                    ...row,
                    name: row.name ?? "（未命名）",
                  }))}
                  layout="vertical"
                >
                  <CartesianGrid stroke="#a17c1e22" strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tick={{ fill: "#a8a29e", fontSize: 11 }}
                    tickFormatter={(v) =>
                      `HK$${(Number(v) / 100).toLocaleString()}`
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fill: "#a8a29e", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10,10,10,0.92)",
                      border: "1px solid #a17c1e55",
                      borderRadius: 6,
                      color: "#f5f5f4",
                    }}
                    formatter={(v) =>
                      `HK$ ${(Number(v) / 100).toFixed(2)}`
                    }
                  />
                  <Bar dataKey="total" fill="#a17c1e" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-mist text-sm">
                {statsLoading ? "載入中…" : "尚無資料"}
              </div>
            )}
          </div>

          {/* Reconciliation */}
          {reconcileLoading ? (
            <div className="glass-card-premium p-4 text-mist text-sm">
              對帳中…
            </div>
          ) : reconcile ? (
            <div
              className={`rounded-xl p-4 ${
                reconcile.match
                  ? "bg-emerald-900/20 border border-emerald-600/40"
                  : "bg-red-900/20 border border-red-600/40"
              }`}
            >
              <div className="font-serif text-gold mb-1">對帳狀態</div>
              <div className="text-sm text-cream">
                最近 {reconcile.days} 天：我方 {reconcile.local.count} 筆 / HK${" "}
                {(reconcile.local.total / 100).toFixed(2)}
                {" ⚖ "}
                Stripe {reconcile.stripe.count} 筆 / HK${" "}
                {(reconcile.stripe.total / 100).toFixed(2)}
              </div>
              {reconcile.error && (
                <div className="mt-2 text-sm text-red-400">
                  ⚠ Stripe API 錯誤：{reconcile.error}
                </div>
              )}
              {!reconcile.match && !reconcile.error && (
                <div className="mt-2 text-sm text-red-400">
                  ⚠ 數字不一致，請檢查 webhook 紀錄
                </div>
              )}
            </div>
          ) : null}

          {/* Transactions */}
          <div className="glass-card-premium p-4">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="font-serif text-gold">交易紀錄</div>
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜尋 email / 方案 / session…"
                className="px-3 py-1.5 text-sm rounded bg-black/40 border border-gold/20 text-cream focus:border-gold focus:outline-none w-64 max-w-[60%]"
              />
            </div>

            {txError && (
              <div className="mb-3 p-2 rounded bg-red-500/10 text-red-400 text-sm">
                {txError}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-mist border-b border-gold/20">
                    <th
                      className="py-2 pr-2 cursor-pointer select-none hover:text-gold"
                      onClick={() => toggleSort("time")}
                    >
                      時間{sortIndicator("time")}
                    </th>
                    <th
                      className="py-2 pr-2 cursor-pointer select-none hover:text-gold"
                      onClick={() => toggleSort("user")}
                    >
                      使用者{sortIndicator("user")}
                    </th>
                    <th className="py-2 pr-2">方案</th>
                    <th
                      className="py-2 pr-2 cursor-pointer select-none hover:text-gold"
                      onClick={() => toggleSort("amount")}
                    >
                      金額{sortIndicator("amount")}
                    </th>
                    <th className="py-2 pr-2">狀態</th>
                    <th className="py-2 pr-2">Stripe</th>
                  </tr>
                </thead>
                <tbody>
                  {txLoading && !transactions ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-mist">
                        載入中…
                      </td>
                    </tr>
                  ) : transactions && transactions.rows.length > 0 ? (
                    transactions.rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-gold/10 text-cream"
                      >
                        <td className="py-2 pr-2 whitespace-nowrap text-xs">
                          {formatDateTime(row.createdAt)}
                        </td>
                        <td className="py-2 pr-2 text-xs">
                          {row.userEmail ?? "—"}
                        </td>
                        <td className="py-2 pr-2 text-xs">
                          {row.packageName ?? "—"}
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {formatHkd(row.amount)}
                        </td>
                        <td className="py-2 pr-2">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="py-2 pr-2">
                          {row.stripePaymentIntentId ? (
                            <a
                              href={`https://dashboard.stripe.com/payments/${row.stripePaymentIntentId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gold hover:underline font-mono"
                            >
                              {row.stripePaymentIntentId.slice(-8)} ↗
                            </a>
                          ) : (
                            <span className="text-xs text-mist">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-mist">
                        尚無交易紀錄
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {transactions && transactions.total > 0 && (
              <div className="mt-3 flex items-center justify-between text-xs text-mist">
                <div>
                  共 {transactions.total.toLocaleString()} 筆，每頁{" "}
                  {transactions.pageSize} 筆
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || txLoading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-2 py-1 rounded border border-gold/20 text-gold hover:bg-gold/10 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ‹ 上一頁
                  </button>
                  <span className="text-cream">
                    第 {transactions.page} /{" "}
                    {Math.max(
                      1,
                      Math.ceil(transactions.total / transactions.pageSize),
                    )}{" "}
                    頁
                  </span>
                  <button
                    type="button"
                    disabled={
                      page >=
                        Math.ceil(
                          transactions.total / transactions.pageSize,
                        ) || txLoading
                    }
                    onClick={() => setPage((p) => p + 1)}
                    className="px-2 py-1 rounded border border-gold/20 text-gold hover:bg-gold/10 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    下一頁 ›
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card-premium p-4">
      <div className="text-xs text-mist">{label}</div>
      <div className="text-xl font-serif text-gold mt-1">{value}</div>
    </div>
  );
}
