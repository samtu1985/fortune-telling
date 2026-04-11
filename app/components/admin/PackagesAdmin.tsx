"use client";

import { useCallback, useEffect, useState } from "react";

interface PaymentPackage {
  id: number;
  name: string;
  description: string | null;
  buyButtonId: string;
  stripePriceId: string | null;
  priceAmount: number | null;
  currency: string;
  singleCreditsGranted: number;
  multiCreditsGranted: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type ModalMode = "create" | "edit";

interface FormState {
  name: string;
  description: string;
  priceId: string;
  buyButtonId: string;
  singleCreditsGranted: number;
  multiCreditsGranted: number;
  sortOrder: number;
  isActive: boolean;
  // verify result
  stripePriceId: string | null;
  priceAmount: number | null;
  currency: string | null;
  productName: string | null;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  priceId: "",
  buyButtonId: "",
  singleCreditsGranted: 0,
  multiCreditsGranted: 0,
  sortOrder: 0,
  isActive: true,
  stripePriceId: null,
  priceAmount: null,
  currency: null,
  productName: null,
};

function formatHkd(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `HK$ ${(cents / 100).toFixed(2)}`;
}

function lastSegment(value: string | null | undefined, n = 8): string {
  if (!value) return "—";
  return value.length <= n ? value : `…${value.slice(-n)}`;
}

export default function PackagesAdmin() {
  const [packages, setPackages] = useState<PaymentPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [rowBusyId, setRowBusyId] = useState<number | null>(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/packages");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "載入失敗");
        return;
      }
      setPackages(data.packages ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  function openCreate() {
    setModalMode("create");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setVerified(false);
    setVerifyError(null);
    setSubmitError(null);
    setModalOpen(true);
  }

  function openEdit(pkg: PaymentPackage) {
    setModalMode("edit");
    setEditingId(pkg.id);
    setForm({
      name: pkg.name,
      description: pkg.description ?? "",
      priceId: pkg.stripePriceId ?? "",
      buyButtonId: pkg.buyButtonId,
      singleCreditsGranted: pkg.singleCreditsGranted,
      multiCreditsGranted: pkg.multiCreditsGranted,
      sortOrder: pkg.sortOrder,
      isActive: pkg.isActive,
      stripePriceId: pkg.stripePriceId,
      priceAmount: pkg.priceAmount,
      currency: pkg.currency,
      productName: null,
    });
    // Already-persisted rows are considered verified (prior admin saved them).
    setVerified(Boolean(pkg.stripePriceId && pkg.priceAmount != null));
    setVerifyError(null);
    setSubmitError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  async function handleVerify() {
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch("/api/admin/packages/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: form.priceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data.message ?? data.error ?? "驗證失敗");
        setVerified(false);
        return;
      }
      setForm((f) => ({
        ...f,
        stripePriceId: data.stripePriceId,
        priceAmount: data.priceAmount,
        currency: data.currency,
        productName: data.productName,
      }));
      if (data.currency !== "hkd") {
        setVerifyError(
          `⚠ 此方案幣別為 ${String(data.currency).toUpperCase()}，非港幣 — 不建議建立`
        );
        setVerified(false);
      } else {
        setVerified(true);
      }
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "驗證失敗");
      setVerified(false);
    } finally {
      setVerifying(false);
    }
  }

  const canSubmit =
    verified &&
    form.currency === "hkd" &&
    form.name.trim().length > 0 &&
    form.buyButtonId.trim().length > 0 &&
    form.stripePriceId != null &&
    form.priceAmount != null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        buyButtonId: form.buyButtonId.trim(),
        stripePriceId: form.stripePriceId,
        priceAmount: form.priceAmount,
        currency: form.currency,
        singleCreditsGranted: form.singleCreditsGranted,
        multiCreditsGranted: form.multiCreditsGranted,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      };
      const url =
        modalMode === "create"
          ? "/api/admin/packages"
          : `/api/admin/packages/${editingId}`;
      const method = modalMode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.message ?? data.error ?? "儲存失敗");
        return;
      }
      setModalOpen(false);
      await fetchPackages();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(pkg: PaymentPackage) {
    setRowBusyId(pkg.id);
    try {
      const res = await fetch(`/api/admin/packages/${pkg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !pkg.isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? data.error ?? "切換狀態失敗");
        return;
      }
      await fetchPackages();
    } finally {
      setRowBusyId(null);
    }
  }

  async function handleDelete(pkg: PaymentPackage) {
    if (!confirm(`確定要刪除「${pkg.name}」？此動作無法復原。`)) return;
    setRowBusyId(pkg.id);
    try {
      const res = await fetch(`/api/admin/packages/${pkg.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 409 → show server message verbatim
        alert(data.message ?? data.error ?? "刪除失敗");
        return;
      }
      await fetchPackages();
    } finally {
      setRowBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-serif text-gold">方案管理</h3>
        <button
          type="button"
          onClick={openCreate}
          className="px-3 py-1.5 text-sm rounded border border-gold/40 text-gold hover:bg-gold/10 transition-colors"
        >
          ＋ 新增方案
        </button>
      </div>

      {error && (
        <div className="mb-3 p-2 rounded bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-mist">載入中…</div>
      ) : packages.length === 0 ? (
        <div className="p-8 text-center text-mist border border-dashed border-gold/20 rounded">
          目前沒有任何方案，點擊上方「＋ 新增方案」開始。
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-mist border-b border-gold/20">
                <th className="py-2 pr-2">排序</th>
                <th className="py-2 pr-2">名稱</th>
                <th className="py-2 pr-2">額度</th>
                <th className="py-2 pr-2">金額</th>
                <th className="py-2 pr-2">狀態</th>
                <th className="py-2 pr-2">Stripe 配對</th>
                <th className="py-2 pr-2 text-right">動作</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr
                  key={pkg.id}
                  className={`border-b border-gold/10 ${
                    pkg.isActive ? "" : "opacity-60"
                  }`}
                >
                  <td className="py-2 pr-2 text-cream">{pkg.sortOrder}</td>
                  <td className="py-2 pr-2 text-cream">
                    <div className="font-medium">{pkg.name}</div>
                    {pkg.description && (
                      <div className="text-xs text-mist">{pkg.description}</div>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-cream">
                    +{pkg.singleCreditsGranted} / +{pkg.multiCreditsGranted}
                  </td>
                  <td className="py-2 pr-2 text-cream">
                    {formatHkd(pkg.priceAmount)}
                  </td>
                  <td className="py-2 pr-2">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        pkg.isActive
                          ? "bg-green-500/20 text-green-500"
                          : "bg-stone-500/20 text-mist"
                      }`}
                    >
                      {pkg.isActive ? "啟用" : "停用"}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-xs text-mist font-mono">
                    {lastSegment(pkg.stripePriceId)}
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(pkg)}
                        disabled={rowBusyId === pkg.id}
                        className="text-xs text-gold hover:underline disabled:opacity-50"
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(pkg)}
                        disabled={rowBusyId === pkg.id}
                        className="text-xs text-mist hover:text-gold disabled:opacity-50"
                      >
                        {pkg.isActive ? "停用" : "啟用"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(pkg)}
                        disabled={rowBusyId === pkg.id}
                        className="text-xs text-red-400 hover:underline disabled:opacity-50"
                      >
                        刪除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg border border-gold/30 bg-[color:var(--cream)]/5 backdrop-blur-md p-6"
            style={{ background: "rgba(10,10,10,0.92)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-serif text-gold">
                {modalMode === "create" ? "新增方案" : "編輯方案"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-mist hover:text-gold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-mist mb-1">
                  方案名稱 *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full px-3 py-1.5 rounded bg-black/40 border border-gold/20 text-cream focus:border-gold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-mist mb-1">描述</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="w-full px-3 py-1.5 rounded bg-black/40 border border-gold/20 text-cream focus:border-gold focus:outline-none"
                />
              </div>

              <div className="p-3 rounded border border-gold/20 bg-gold/5">
                <div className="text-xs text-mist mb-2">
                  打開 Stripe Dashboard → Products → 選擇您的產品 → 複製 Price
                  ID（以 <code className="text-gold">price_</code> 開頭）
                </div>
                <label className="block text-xs text-mist mb-1">
                  Price ID *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    pattern="^price_.*"
                    placeholder="price_..."
                    value={form.priceId}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, priceId: e.target.value }));
                      setVerified(false);
                    }}
                    className="flex-1 px-3 py-1.5 rounded bg-black/40 border border-gold/20 text-cream focus:border-gold focus:outline-none font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleVerify}
                    disabled={
                      verifying || !form.priceId.startsWith("price_")
                    }
                    className="px-3 py-1.5 text-xs rounded border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-50 whitespace-nowrap"
                  >
                    {verifying ? "驗證中…" : "🔍 驗證並抓取方案資訊"}
                  </button>
                </div>
                {verifyError && (
                  <div className="mt-2 text-xs text-red-400">{verifyError}</div>
                )}
                {form.stripePriceId && (
                  <div className="mt-3 p-2 rounded bg-black/40 text-xs text-cream space-y-1">
                    <div>
                      <span className="text-mist">Price ID：</span>
                      <span className="font-mono">{form.stripePriceId}</span>
                    </div>
                    <div>
                      <span className="text-mist">金額：</span>
                      {formatHkd(form.priceAmount)}
                    </div>
                    <div>
                      <span className="text-mist">幣別：</span>
                      {form.currency?.toUpperCase() ?? "—"}
                    </div>
                    <div>
                      <span className="text-mist">產品名稱：</span>
                      {form.productName ?? "—"}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-mist mb-1">
                  Buy Button ID *
                </label>
                <div className="text-[10px] text-mist mb-1">
                  從 Stripe Buy Button 設定頁的 embed code 複製
                </div>
                <input
                  type="text"
                  required
                  value={form.buyButtonId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, buyButtonId: e.target.value }))
                  }
                  className="w-full px-3 py-1.5 rounded bg-black/40 border border-gold/20 text-cream focus:border-gold focus:outline-none font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-mist mb-1">
                    單次問答 +N
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.singleCreditsGranted}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        singleCreditsGranted: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-1.5 rounded bg-black/40 border border-gold/20 text-cream focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-mist mb-1">
                    三師論道 +M
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.multiCreditsGranted}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        multiCreditsGranted: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-1.5 rounded bg-black/40 border border-gold/20 text-cream focus:border-gold focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-mist mb-1">排序</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        sortOrder: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-1.5 rounded bg-black/40 border border-gold/20 text-cream focus:border-gold focus:outline-none"
                  />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-cream">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, isActive: e.target.checked }))
                      }
                      className="accent-gold"
                    />
                    啟用
                  </label>
                </div>
              </div>
            </div>

            {submitError && (
              <div className="mt-4 p-2 rounded bg-red-500/10 text-red-400 text-sm">
                {submitError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-3 py-1.5 text-sm rounded border border-gold/20 text-mist hover:text-gold"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className="px-4 py-1.5 text-sm rounded border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting
                  ? "儲存中…"
                  : modalMode === "create"
                    ? "建立"
                    : "儲存"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
