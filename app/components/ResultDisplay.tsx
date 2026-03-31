"use client";

import { useState, useMemo } from "react";

interface ResultDisplayProps {
  content: string;
  reasoning: string;
  streaming: boolean;
  hideDisclaimer?: boolean;
  onSave?: () => void;
  isSaved?: boolean;
}

interface TableData {
  headers: string[];
  rows: string[][];
}

function parseMarkdownTable(block: string): TableData | null {
  const lines = block.trim().split("\n");
  if (lines.length < 2) return null;

  // Header row
  const headerLine = lines[0].trim();
  if (!headerLine.includes("|")) return null;

  // Separator row (must contain dashes)
  const sepLine = lines[1].trim();
  if (!sepLine.match(/^[\s|:-]+$/) || !sepLine.includes("-")) return null;

  const parseCells = (line: string) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  const headers = parseCells(headerLine);
  const rows: string[][] = [];

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.includes("|")) break;
    rows.push(parseCells(line));
  }

  if (rows.length === 0) return null;
  return { headers, rows };
}

function renderInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="text-gold-bright text-[0.85em]">$1</code>');
}

function renderMarkdown(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    // Detect table: current line has |, next line is separator
    if (
      lines[i].includes("|") &&
      i + 1 < lines.length &&
      lines[i + 1].match(/^[\s|:-]+$/) &&
      lines[i + 1].includes("-")
    ) {
      // Collect all table lines
      const tableLines: string[] = [];
      while (i < lines.length && (lines[i].includes("|") || lines[i].match(/^[\s|:-]+$/))) {
        tableLines.push(lines[i]);
        i++;
      }

      const table = parseMarkdownTable(tableLines.join("\n"));
      if (table) {
        result.push(renderTable(table));
        continue;
      }
      // Fallback: not a valid table, render as regular lines
      for (const tl of tableLines) {
        result.push(renderLine(tl));
      }
      continue;
    }

    result.push(renderLine(lines[i]));
    i++;
  }

  return result.join("");
}

function renderTable(table: TableData): string {
  const thCells = table.headers
    .map(
      (h) =>
        `<th class="px-3 py-2.5 text-left font-semibold text-[0.85rem] border-b" style="color:var(--gold);border-color:rgba(var(--glass-rgb),0.15)">${renderInlineMarkdown(h)}</th>`
    )
    .join("");

  const bodyRows = table.rows
    .map((row, ri) => {
      const cells = row
        .map(
          (cell) =>
            `<td class="px-3 py-2 text-[0.85rem] border-b" style="color:var(--cream);border-color:rgba(var(--glass-rgb),0.06)">${renderInlineMarkdown(cell)}</td>`
        )
        .join("");
      const bgAlpha = ri % 2 === 0 ? "0.01" : "0.03";
      return `<tr style="background:rgba(var(--glass-rgb),${bgAlpha})">${cells}</tr>`;
    })
    .join("");

  return `<div class="my-4 overflow-x-auto rounded border" style="border-color:rgba(var(--glass-rgb),0.1)">
    <table class="w-full border-collapse min-w-0">
      <thead><tr style="background:rgba(var(--glass-rgb),0.04)">${thCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>`;
}

function renderLine(line: string): string {
  const trimmed = line.trimStart();

  // Headers
  if (trimmed.startsWith("#### "))
    return `<h4 class="text-gold text-[0.95rem] font-semibold mt-4 mb-2">${renderInlineMarkdown(trimmed.slice(5))}</h4>`;
  if (trimmed.startsWith("### "))
    return `<h3 class="text-gold text-[1.05rem] font-semibold mt-5 mb-2">${renderInlineMarkdown(trimmed.slice(4))}</h3>`;
  if (trimmed.startsWith("## "))
    return `<h3 class="text-gold text-[1.1rem] font-bold mt-6 mb-2">${renderInlineMarkdown(trimmed.slice(3))}</h3>`;

  // Horizontal rule
  if (trimmed.match(/^[-*_]{3,}$/))
    return `<div class="my-4 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent"></div>`;

  // Unordered list
  if (trimmed.match(/^[-*+]\s/))
    return `<div class="flex gap-2 mb-1 pl-2"><span class="text-gold-dim shrink-0">·</span><span>${renderInlineMarkdown(trimmed.slice(2))}</span></div>`;

  // Ordered list
  const olMatch = trimmed.match(/^(\d+)[.)]\s(.+)/);
  if (olMatch)
    return `<div class="flex gap-2 mb-1 pl-2"><span class="text-gold-dim shrink-0">${olMatch[1]}.</span><span>${renderInlineMarkdown(olMatch[2])}</span></div>`;

  // Empty line
  if (!trimmed) return `<div class="h-3"></div>`;

  // Regular paragraph
  return `<p class="mb-1.5">${renderInlineMarkdown(line)}</p>`;
}

export default function ResultDisplay({
  content,
  reasoning,
  streaming,
  hideDisclaimer,
  onSave,
  isSaved,
}: ResultDisplayProps) {
  const [showReasoning, setShowReasoning] = useState(false);

  const renderedContent = useMemo(() => renderMarkdown(content), [content]);
  const renderedReasoning = useMemo(() => renderMarkdown(reasoning), [reasoning]);

  if (!content && !reasoning) return null;

  return (
    <div className="animate-fade-in-up mt-8" style={{ animationDelay: "200ms", opacity: 0 }}>
      <div className="gold-line mb-6" />

      {/* Reasoning toggle */}
      {reasoning && (
        <div className="mb-4">
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex items-center gap-2 text-sm text-stone hover:text-mist transition-colors min-h-[44px]"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-300 ${
                showReasoning ? "rotate-90" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            深度思考過程
            {streaming && !content && (
              <span className="inline-block w-2 h-2 rounded-full bg-gold/60 animate-pulse" />
            )}
          </button>

          {showReasoning && (
            <div className="mt-3 pl-4 border-l border-gold-dim/20 text-sm text-stone/80 leading-relaxed max-h-64 overflow-y-auto">
              <div
                className={streaming && !content ? "streaming-cursor" : ""}
                dangerouslySetInnerHTML={{ __html: renderedReasoning }}
              />
            </div>
          )}
        </div>
      )}

      {/* Main result */}
      {content && (
        <div className="relative">
          {/* Decorative corner brackets */}
          <div className="absolute -top-2 -left-2 w-6 h-6 border-t border-l border-gold/30" />
          <div className="absolute -top-2 -right-2 w-6 h-6 border-t border-r border-gold/30" />
          <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b border-l border-gold/30" />
          <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b border-r border-gold/30" />

          <div className="px-6 py-8">
            <div
              className={`result-text font-serif text-[0.95rem] leading-[1.9] ${
                streaming ? "streaming-cursor" : ""
              }`}
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          </div>
        </div>
      )}

      {/* Save conversation button */}
      {content && !streaming && onSave && (
        <div className="flex justify-end px-6 pb-2">
          <button
            onClick={onSave}
            disabled={isSaved}
            className={`text-xs flex items-center gap-1 min-h-[32px] px-2 transition-colors ${
              isSaved
                ? "text-gold-dim/50 cursor-default"
                : "text-stone/40 hover:text-gold-dim"
            }`}
          >
            {isSaved ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                已保存
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                保存
              </>
            )}
          </button>
        </div>
      )}

      {/* Disclaimer */}
      {content && !streaming && !hideDisclaimer && (
        <p className="mt-6 text-center text-xs text-stone/50 tracking-wide">
          以上分析由 AI 生成，僅供參考，不構成任何決策建議
        </p>
      )}
    </div>
  );
}
