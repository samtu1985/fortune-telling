"use client";

import { useCallback, useEffect, useState } from "react";

type IntegrationRow = {
  service: string;
  apiUrl: string;
  apiKey: string;        // masked from server ("••••XXXX" or "")
  hasKey: boolean;
  enabled: boolean;
  metadata: Record<string, unknown> | null;
};

type TestResult = { ok: boolean; code?: string; message?: string };

const SERVICES: Array<{ key: string; label: string; description: string; defaultUrl: string }> = [
  {
    key: "humandesign",
    label: "人類圖計算服務",
    description: "humandesignhub.app — 計算 bodygraph 所需的第三方 API（Standard 方案以上）",
    defaultUrl: "https://api.humandesignhub.app/v1",
  },
];

export default function IntegrationsTab() {
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<Record<string, string>>({});
  const [testResults, setTestResults] = useState<Record<string, TestResult | null>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/integrations");
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  function getOrDefault(key: string): IntegrationRow {
    const existing = rows.find((r) => r.service === key);
    if (existing) return existing;
    const defaultUrl = SERVICES.find((s) => s.key === key)?.defaultUrl ?? "";
    // Default enabled=true for a first-time configuration — if admin is
    // configuring the integration at all, they almost certainly want it active.
    return { service: key, apiUrl: defaultUrl, apiKey: "", hasKey: false, enabled: true, metadata: null };
  }

  function updateLocal(key: string, patch: Partial<IntegrationRow>) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.service === key);
      if (idx < 0) return [...prev, { ...getOrDefault(key), ...patch }];
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  async function save(service: string) {
    setSaving(service);
    try {
      const row = getOrDefault(service);
      const keyToSend = editingKey[service];
      // Server preserves the existing key when `apiKey` is omitted from the payload.
      // Only include it when the admin actually typed something in the key field,
      // or when there's no stored key yet (first-time save can write the empty string).
      const payload: Record<string, unknown> = {
        service,
        apiUrl: row.apiUrl,
        enabled: row.enabled,
      };
      if (keyToSend !== undefined) {
        payload.apiKey = keyToSend;
      } else if (!row.hasKey) {
        payload.apiKey = "";
      }
      const res = await fetch("/api/admin/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setTestResults((s) => ({ ...s, [service]: { ok: false, code: "save_failed", message: body.error ?? "儲存失敗" } }));
        return;
      }
      setEditingKey((s) => { const c = { ...s }; delete c[service]; return c; });
      setTestResults((s) => ({ ...s, [service]: null }));
      await refresh();
    } finally {
      setSaving(null);
    }
  }

  async function remove(service: string) {
    if (!confirm(`確定要移除 ${SERVICES.find((s) => s.key === service)?.label ?? service} 的設定嗎？`)) return;
    const res = await fetch(`/api/admin/integrations?service=${encodeURIComponent(service)}`, { method: "DELETE" });
    if (res.ok) await refresh();
  }

  async function test(service: string) {
    setTesting(service);
    setTestResults((s) => ({ ...s, [service]: null }));
    try {
      const res = await fetch("/api/admin/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service }),
      });
      const data: TestResult = await res.json().catch(() => ({ ok: false, code: "parse_error" }));
      setTestResults((s) => ({ ...s, [service]: data }));
    } finally {
      setTesting(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-text-tertiary">載入中…</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-medium text-text-primary">第三方整合</h2>
        <p className="mt-1 text-xs text-text-tertiary">
          設定外部計算服務（例如人類圖 bodygraph API）。金鑰以 AES-256-GCM 加密儲存。
        </p>
      </header>

      {SERVICES.map(({ key, label, description }) => {
        const row = getOrDefault(key);
        const result = testResults[key];
        return (
          <section
            key={key}
            className="glass-card p-4 space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-text-primary">{label}</div>
                <div className="mt-0.5 text-xs text-text-tertiary">{description}</div>
              </div>
              <label className="flex items-center gap-2 text-xs text-text-secondary whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => updateLocal(key, { enabled: e.target.checked })}
                />
                啟用
              </label>
            </div>

            <div className="space-y-3">
              <label className="block text-xs text-text-tertiary">
                <span className="block mb-1">API URL</span>
                <input
                  type="text"
                  className="w-full rounded-sm border border-border-light bg-bg-primary px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none"
                  value={row.apiUrl}
                  onChange={(e) => updateLocal(key, { apiUrl: e.target.value })}
                />
              </label>

              <label className="block text-xs text-text-tertiary">
                <span className="block mb-1">
                  API 金鑰{row.hasKey ? <span className="ml-2 text-accent">（已儲存：{row.apiKey}）</span> : null}
                </span>
                <input
                  type="password"
                  className="w-full rounded-sm border border-border-light bg-bg-primary px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none"
                  placeholder={row.hasKey ? "輸入新金鑰以覆蓋" : "輸入 API 金鑰"}
                  value={editingKey[key] ?? ""}
                  onChange={(e) => setEditingKey((s) => ({ ...s, [key]: e.target.value }))}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => save(key)}
                disabled={saving === key}
                className="rounded-sm border border-accent px-3 py-1 text-xs text-accent hover:bg-accent hover:text-white disabled:opacity-50"
              >
                {saving === key ? "儲存中…" : "儲存"}
              </button>
              <button
                type="button"
                onClick={() => test(key)}
                disabled={testing === key}
                className="rounded-sm border border-border-light px-3 py-1 text-xs text-text-secondary hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {testing === key ? "測試中…" : "測試連線"}
              </button>
              {row.hasKey && (
                <button
                  type="button"
                  onClick={() => remove(key)}
                  className="text-xs text-text-tertiary hover:text-red-500"
                >
                  移除
                </button>
              )}

              {result && (
                <span
                  className={`text-xs ${result.ok ? "text-accent" : "text-red-500"}`}
                >
                  {result.ok
                    ? "測試成功"
                    : result.message
                        ? `${result.message}${result.code ? ` (${result.code})` : ""}`
                        : `測試失敗${result.code ? ` (${result.code})` : ""}`}
                </span>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
