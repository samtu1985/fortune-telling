# Three Masters: 5-Round Limit + PDF Download (Phase A+B)

## 5-Round Limit

Add `roundCount` ref to ComprehensiveMode. In `runAutoLoop`, increment each round. Stop when `roundCount >= 5` or `[CONSENSUS]` is reached. After max rounds, the zodiac master auto-generates a final summary.

The auto-discussion system prompt for the final round tells the zodiac master to wrap up with `[CONSENSUS]`.

## PDF Download

After the auto-discussion ends (consensus OR 5 rounds), show a "Download PDF" button below the conversation.

### PDF Content
- Header: 天機 Fortune-For.me logo + title
- User birth info (date, time, place, gender, calendar type)
- User's question
- All master messages with:
  - Master name + symbol as label
  - Color-coded backgrounds (amber for bazi, violet for ziwei, cyan for zodiac)
  - User follow-up questions if any

### Implementation
Use browser-native approach: generate a styled HTML document, open in new window, trigger print-to-PDF. No server-side PDF library needed.

Alternative: use `html2canvas` + `jsPDF` for direct download. But this adds 200KB+ of dependencies.

Recommended: **styled HTML in a new window with `window.print()`**. Users can save as PDF from the print dialog. Works everywhere, zero dependencies.

## Files
- Modify: `app/components/ComprehensiveMode.tsx` — add round limit + PDF button
- Modify: `app/lib/i18n.ts` — add translation keys
