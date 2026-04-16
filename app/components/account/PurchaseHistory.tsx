"use client";
import { useEffect, useState } from "react";
import { useLocale } from "@/app/components/LocaleProvider";

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
  const { t, locale } = useLocale();
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

  const dateLocale =
    locale === "zh-Hans"
      ? "zh-CN"
      : locale === "en"
        ? "en-US"
        : locale === "ja"
          ? "ja-JP"
          : "zh-HK";

  if (error)
    return (
      <div className="text-red-400 text-sm">
        {t("account.history.loadFailed", { error })}
      </div>
    );
  if (!data)
    return <div className="text-text-secondary text-sm">{t("account.history.loading")}</div>;

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
    <section className="mt-8 tesla-card-bordered p-5 sm:p-6 rounded-2xl">
      <h3 className="text-xl text-accent mb-6">
        {t("account.history.title")}
      </h3>

      <div className="mb-6 rounded-xl border border-border-light bg-accent/5 p-4 sm:p-5">
        {data.quota.unlimited ? (
          <>
            <div className="text-xs uppercase text-text-secondary mb-2">
              {t("account.history.currentQuota")}
            </div>
            <div className="text-lg text-accent">
              {t("account.history.unlimited")}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-xs uppercase text-text-secondary mb-2">
                {t("account.history.remaining")}
              </div>
              <div className="text-text-primary flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span>{t("account.history.single")}</span>
                <span className="text-2xl text-accent">
                  {data.quota.singleRemaining}
                </span>
                <span className="text-text-secondary text-sm">
                  {t("account.history.times")}
                </span>
                <span className="mx-1 sm:mx-3 text-text-secondary">·</span>
                <span>{t("account.history.multi")}</span>
                <span className="text-2xl text-accent">
                  {data.quota.multiRemaining}
                </span>
                <span className="text-text-secondary text-sm">
                  {t("account.history.times")}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border-light text-xs">
              <div>
                <div className="text-text-secondary mb-1">
                  {t("account.history.totalGranted")}
                </div>
                <div className="text-text-primary">
                  {t("account.history.singleMultiSplit", {
                    single: String(data.quota.singleCredits),
                    multi: String(data.quota.multiCredits),
                  })}
                </div>
                {(purchasedSingle > 0 || purchasedMulti > 0) && (
                  <div className="text-text-secondary/70 mt-0.5">
                    {t("account.history.fromPurchases", {
                      single: String(purchasedSingle),
                      multi: String(purchasedMulti),
                    })}
                  </div>
                )}
              </div>
              <div>
                <div className="text-text-secondary mb-1">
                  {t("account.history.totalUsed")}
                </div>
                <div className="text-text-primary">
                  {t("account.history.singleMultiSplit", {
                    single: String(data.quota.singleUsed),
                    multi: String(data.quota.multiUsed),
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {data.purchases.length === 0 ? (
        <div className="text-center text-text-secondary py-8">
          {t("account.history.empty")}
        </div>
      ) : (
        <div className="-mx-5 sm:mx-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-border-light text-left text-text-secondary">
                <th className="py-3 px-5 sm:px-2 whitespace-nowrap">
                  {t("account.history.col.date")}
                </th>
                <th className="whitespace-nowrap">
                  {t("account.history.col.package")}
                </th>
                <th className="whitespace-nowrap">
                  {t("account.history.col.amount")}
                </th>
                <th className="whitespace-nowrap">
                  {t("account.history.col.credits")}
                </th>
                <th className="px-5 sm:px-2 whitespace-nowrap">
                  {t("account.history.col.status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.purchases.map((p) => (
                <tr key={p.id} className="border-b border-border-light">
                  <td className="py-3 px-5 sm:px-2 text-text-primary whitespace-nowrap">
                    {new Date(p.createdAt).toLocaleDateString(dateLocale)}
                  </td>
                  <td className="text-text-primary">
                    {p.packageName ?? t("account.history.removedPackage")}
                  </td>
                  <td className="text-text-primary whitespace-nowrap">
                    {p.currency.toUpperCase()} {(p.amount / 100).toFixed(2)}
                  </td>
                  <td className="text-text-primary">
                    {p.singleGranted > 0 &&
                      t("account.history.creditsSingleAdd", {
                        n: String(p.singleGranted),
                      })}
                    {p.singleGranted > 0 && p.multiGranted > 0 && " / "}
                    {p.multiGranted > 0 &&
                      t("account.history.creditsMultiAdd", {
                        n: String(p.multiGranted),
                      })}
                  </td>
                  <td className="px-5 sm:px-2">
                    <span
                      className={
                        p.status === "paid"
                          ? "text-emerald-400"
                          : p.status === "refunded"
                            ? "text-amber-400"
                            : "text-red-400"
                      }
                    >
                      {p.status === "paid"
                        ? t("account.history.status.paid")
                        : p.status === "refunded"
                          ? t("account.history.status.refunded")
                          : t("account.history.status.failed")}
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
