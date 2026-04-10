#!/usr/bin/env node
// calc-dates.js [YYYY-MM-DD]
// Outputs JSON { monday, sunday } for the target week (local timezone).
// If no argument: last week. If argument: the week containing that Sunday.

function toLocalISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const arg = process.argv[2];

let sunday;
if (arg) {
  const [y, m, d] = arg.split('-').map(Number);
  const candidate = new Date(y, m - 1, d);
  if (candidate.getDay() !== 0) {
    console.error(`错误：参数必须是周日（如 2026-03-29），${arg} 是周${['日','一','二','三','四','五','六'][candidate.getDay()]}`);
    process.exit(1);
  }
  sunday = candidate;
} else {
  // Last week's Sunday: today minus (today.getDay() + 1) days, but if today is Sunday minus 7
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Days since last Sunday: if today is Sun(0) => 7, Mon(1) => 1, ..., Sat(6) => 6
  const daysSinceLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
  sunday = addDays(today, -daysSinceLastSunday);
}

const monday = addDays(sunday, -6);

console.log(JSON.stringify({ monday: toLocalISODate(monday), sunday: toLocalISODate(sunday) }));