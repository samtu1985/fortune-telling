"use client";
import { useEffect, useState } from "react";

type PurchaseRow = {
  id: number;
  createdAt: string;
  packageName: string | null;
  amount: number;
  currency: string;
  singleGranted: number;
  multiGranted: number;
  status: string;
};
type Data = {
  purchases: PurchaseRow[];
  quota: {
    unlimited: boolean;
    singleCredits: number;
    multiCredits: number;
    singleUsed: number;
    multiUsed: number;
    singleRemaining: number;
    multiRemaining: number;
  };
};

export default function PurchaseHistory() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/purchases")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="text-red-400 text-sm">載入失敗：{error}</div>;
  if (!data) return <div className="text-mist text-sm">載入中...</div>;

  // Sum credits granted from paid purchases (refunded purchases are already
  // reflected in the users.*Credits columns via webhook deduction, so we use
  // paid-only totals here to show "this much came from purchases").
  const purchasedSingle = data.purchases
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.singleGranted, 0);
  const purchasedMulti = data.purchases
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.multiGranted, 0);

  return (
    <section className="mt-8 glass-card-premium p-6 rounded-2xl">
      <h3 className="font-serif text-xl text-gold mb-6">購買紀錄</h3>

      <div className="mb-6 rounded-xl border border-gold/20 bg-gold/5 p-5">
        {data.quota.unlimited ? (
          <>
            <div className="text-xs uppercase tracking-wider text-mist mb-2">目前額度</div>
            <div className="text-lg font-serif text-gold">無限次（尊榮身份）</div>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-mist mb-2">目前剩餘</div>
              <div className="text-cream">
                <span className="font-serif">個別問答</span>{" "}
                <span className="font-serif text-2xl text-gold">{data.quota.singleRemaining}</span>{" "}
                <span className="text-mist text-sm">次</span>
                <span className="mx-3 text-mist">·</span>
                <span className="font-serif">三師論道</span>{" "}
                <span className="font-serif text-2xl text-gold">{data.quota.multiRemaining}</span>{" "}
                <span className="text-mist text-sm">次</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gold/10 text-xs">
              <div>
                <div className="text-mist mb-1">累計獲得</div>
                <div className="text-cream">
                  個別 {data.quota.singleCredits} / 三師 {data.quota.multiCredits}
                </div>
                {(purchasedSingle > 0 || purchasedMulti > 0) && (
                  <div className="text-mist/70 mt-0.5">
                    其中 {purchasedSingle}/{purchasedMulti} 來自購買
                  </div>
                )}
              </div>
              <div>
                <div className="text-mist mb-1">累計使用</div>
                <div className="text-cream">
                  個別 {data.quota.singleUsed} / 三師 {data.quota.multiUsed}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {data.purchases.length === 0 ? (
        <div className="text-center text-mist py-8">尚無購買紀錄</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold/30 text-left text-mist">
                <th className="py-3 font-serif">日期</th>
                <th className="font-serif">方案</th>
                <th className="font-serif">金額</th>
                <th className="font-serif">新增額度</th>
                <th className="font-serif">狀態</th>
              </tr>
            </thead>
            <tbody>
              {data.purchases.map((p) => (
                <tr key={p.id} className="border-b border-gold/10">
                  <td className="py-3 text-cream">{new Date(p.createdAt).toLocaleDateString("zh-HK")}</td>
                  <td className="text-cream">{p.packageName ?? "（已下架方案）"}</td>
                  <td className="text-cream">
                    {p.currency.toUpperCase()} {(p.amount / 100).toFixed(2)}
                  </td>
                  <td className="text-cream">
                    {p.singleGranted > 0 && `個別 +${p.singleGranted}`}
                    {p.singleGranted > 0 && p.multiGranted > 0 && " / "}
                    {p.multiGranted > 0 && `三師 +${p.multiGranted}`}
                  </td>
                  <td>
                    <span
                      className={
                        p.status === "paid"
                          ? "text-emerald-400"
                          : p.status === "refunded"
                            ? "text-amber-400"
                            : "text-red-400"
                      }
                    >
                      {p.status === "paid" ? "已付款" : p.status === "refunded" ? "已退款" : "失敗"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
