'use strict';
/* =====================================================================
   Muscle Program – 8-week digital coach (static site, no build step)
   Data: localStorage only. Science: live PubMed search via NCBI E-utilities.
   ===================================================================== */

// ---------- helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr = () => fmtDate(new Date());
const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); };
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
const num = v => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const round = (n, d = 0) => { const f = 10 ** d; return Math.round(n * f) / f; };
const avg = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const uid = () => Math.random().toString(36).slice(2, 9);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- state ----------
const KEY = 'muscleProgram.v1';
const defaultState = () => ({
  profile: null, customFoods: [], meals: {}, program: null,
  logs: [], body: [], photos: [], library: {}
});
function load() {
  try { return Object.assign(defaultState(), JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch (e) { return defaultState(); }
}
let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { alert('Could not save: browser storage is full or blocked. Export a backup and delete some photos.'); }
}

// ---------- constants ----------
const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 };
const ACTIVITY_LABEL = {
  sedentary: 'Sedentary (desk job, little walking)',
  light: 'Lightly active (some walking)',
  moderate: 'Moderately active (on your feet a lot)',
  high: 'Very active (physical job)'
};
const DELOAD_WEEKS = [4, 8];
const isDeload = w => DELOAD_WEEKS.includes(w);

const EXERCISES = {
  Chest: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Dumbbell Bench Press', 'Chest Press Machine', 'Cable Fly', 'Push-Up', 'Dips (chest focus)'],
  Back: ['Pull-Up', 'Lat Pulldown', 'Barbell Row', 'Seated Cable Row', 'One-Arm Dumbbell Row', 'Chest-Supported Row', 'Straight-Arm Pulldown'],
  Shoulders: ['Overhead Press', 'Dumbbell Shoulder Press', 'Lateral Raise', 'Cable Lateral Raise', 'Rear Delt Fly', 'Face Pull'],
  Biceps: ['Barbell Curl', 'Dumbbell Curl', 'Incline Dumbbell Curl', 'Hammer Curl', 'Cable Curl'],
  Triceps: ['Triceps Pushdown', 'Overhead Triceps Extension', 'Skull Crusher', 'Close-Grip Bench Press', 'Bench Dips'],
  Quads: ['Back Squat', 'Front Squat', 'Leg Press', 'Hack Squat', 'Bulgarian Split Squat', 'Leg Extension', 'Goblet Squat'],
  'Hamstrings & Glutes': ['Romanian Deadlift', 'Leg Curl', 'Hip Thrust', 'Walking Lunge', 'Good Morning'],
  Calves: ['Standing Calf Raise', 'Seated Calf Raise'],
  Core: ['Plank', 'Cable Crunch', 'Hanging Leg Raise', 'Ab Wheel']
};
// [name, sets, repMin, repMax, restSeconds]
const TEMPLATES = {
  3: [
    { name: 'Full Body A', ex: [['Back Squat', 3, 6, 10, 180], ['Barbell Bench Press', 3, 6, 10, 150], ['Seated Cable Row', 3, 8, 12, 120], ['Lateral Raise', 3, 10, 15, 60], ['Barbell Curl', 2, 8, 12, 60], ['Plank', 2, 30, 60, 60]] },
    { name: 'Full Body B', ex: [['Romanian Deadlift', 3, 6, 10, 150], ['Overhead Press', 3, 6, 10, 150], ['Lat Pulldown', 3, 8, 12, 120], ['Leg Press', 3, 10, 15, 120], ['Triceps Pushdown', 3, 10, 15, 60], ['Standing Calf Raise', 3, 10, 15, 60]] },
    { name: 'Full Body C', ex: [['Hack Squat', 3, 8, 12, 150], ['Incline Dumbbell Press', 3, 8, 12, 120], ['One-Arm Dumbbell Row', 3, 8, 12, 90], ['Leg Curl', 3, 10, 15, 90], ['Cable Lateral Raise', 3, 10, 15, 60], ['Hammer Curl', 2, 8, 12, 60]] }
  ],
  4: [
    { name: 'Upper A', ex: [['Barbell Bench Press', 3, 6, 10, 150], ['Barbell Row', 3, 6, 10, 150], ['Overhead Press', 3, 8, 12, 120], ['Lat Pulldown', 3, 8, 12, 90], ['Barbell Curl', 2, 8, 12, 60], ['Triceps Pushdown', 2, 10, 15, 60]] },
    { name: 'Lower A', ex: [['Back Squat', 3, 6, 10, 180], ['Romanian Deadlift', 3, 8, 12, 150], ['Leg Press', 2, 10, 15, 120], ['Leg Curl', 3, 10, 15, 90], ['Standing Calf Raise', 3, 10, 15, 60], ['Cable Crunch', 2, 10, 15, 60]] },
    { name: 'Upper B', ex: [['Incline Dumbbell Press', 3, 8, 12, 120], ['Seated Cable Row', 3, 8, 12, 120], ['Dumbbell Shoulder Press', 3, 8, 12, 120], ['Pull-Up', 3, 6, 10, 120], ['Cable Lateral Raise', 3, 10, 15, 60], ['Overhead Triceps Extension', 2, 10, 15, 60]] },
    { name: 'Lower B', ex: [['Hack Squat', 3, 8, 12, 150], ['Hip Thrust', 3, 8, 12, 120], ['Leg Extension', 3, 10, 15, 90], ['Leg Curl', 2, 10, 15, 90], ['Seated Calf Raise', 3, 10, 15, 60], ['Hanging Leg Raise', 2, 10, 15, 60]] }
  ],
  5: [
    { name: 'Push', ex: [['Barbell Bench Press', 3, 6, 10, 150], ['Overhead Press', 3, 8, 12, 120], ['Incline Dumbbell Press', 3, 8, 12, 120], ['Lateral Raise', 3, 10, 15, 60], ['Triceps Pushdown', 3, 10, 15, 60], ['Overhead Triceps Extension', 2, 10, 15, 60]] },
    { name: 'Pull', ex: [['Barbell Row', 3, 6, 10, 150], ['Lat Pulldown', 3, 8, 12, 90], ['Seated Cable Row', 3, 8, 12, 90], ['Rear Delt Fly', 3, 10, 15, 60], ['Barbell Curl', 3, 8, 12, 60], ['Hammer Curl', 2, 8, 12, 60]] },
    { name: 'Legs', ex: [['Back Squat', 3, 6, 10, 180], ['Romanian Deadlift', 3, 8, 12, 150], ['Leg Press', 3, 10, 15, 120], ['Leg Curl', 3, 10, 15, 90], ['Standing Calf Raise', 3, 10, 15, 60]] },
    { name: 'Upper', ex: [['Incline Dumbbell Press', 3, 8, 12, 120], ['Chest-Supported Row', 3, 8, 12, 120], ['Dumbbell Shoulder Press', 2, 8, 12, 120], ['Cable Curl', 2, 10, 15, 60], ['Triceps Pushdown', 2, 10, 15, 60]] },
    { name: 'Lower', ex: [['Hack Squat', 3, 8, 12, 150], ['Hip Thrust', 3, 8, 12, 120], ['Leg Extension', 3, 10, 15, 90], ['Seated Calf Raise', 3, 10, 15, 60], ['Cable Crunch', 2, 10, 15, 60]] }
  ]
};

// name, kcal, protein, carbs, fat (per 100 g, approximate), tags
const FOODS = [
  ['Chicken breast, cooked', 165, 31, 0, 3.6, ['meat']], ['Beef, lean, cooked', 217, 26, 0, 12, ['meat']],
  ['Salmon, cooked', 206, 22, 0, 12, ['fish']], ['Tuna, canned in water', 116, 26, 0, 1, ['fish']],
  ['Whole egg', 143, 12.6, 0.7, 9.5, ['egg']], ['Whole milk', 61, 3.2, 4.8, 3.3, ['dairy']],
  ['Greek yogurt, plain 0%', 59, 10, 3.6, 0.4, ['dairy']], ['Skyr, plain', 63, 11, 4, 0.2, ['dairy']],
  ['Cottage cheese', 98, 11, 3.4, 4.3, ['dairy']], ['Cheddar cheese', 403, 25, 1.3, 33, ['dairy']],
  ['Whey protein powder', 400, 80, 8, 6, ['dairy']], ['Oats, dry', 389, 16.9, 66, 6.9, ['gluten']],
  ['White rice, cooked', 130, 2.7, 28, 0.3, []], ['Pasta, cooked', 158, 5.8, 31, 0.9, ['gluten']],
  ['Potato, boiled', 87, 1.9, 20, 0.1, []], ['Whole-wheat bread', 247, 13, 41, 3.4, ['gluten']],
  ['Banana', 89, 1.1, 23, 0.3, []], ['Apple', 52, 0.3, 14, 0.2, []], ['Orange juice', 45, 0.7, 10, 0.2, []],
  ['Broccoli', 34, 2.8, 7, 0.4, []], ['Lentils, cooked', 116, 9, 20, 0.4, []], ['Chickpeas, cooked', 164, 8.9, 27, 2.6, []],
  ['Tofu, firm', 144, 15.8, 2.8, 8.7, []], ['Olive oil', 884, 0, 0, 100, []], ['Peanut butter', 588, 25, 20, 50, []],
  ['Almonds', 579, 21, 22, 50, []], ['Avocado', 160, 2, 9, 15, []]
].map(([name, kcal, p, c, f, tags]) => ({ name, kcal, p, c, f, tags }));
const DIET_EXCLUDES = {
  none: [], vegetarian: ['meat', 'fish'], vegan: ['meat', 'fish', 'egg', 'dairy'],
  'lactose-free': ['dairy'], 'gluten-free': ['gluten']
};

// ---------- calculations ----------
function calcTargets(p) {
  const bmi = p.weight / ((p.height / 100) ** 2);
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const tdee = bmr * (ACTIVITY[p.activity] || 1.375);
  const pct = { beginner: 0.10, intermediate: 0.07, advanced: 0.05 }[p.level] || 0.08;
  const baseSurplus = Math.min(500, Math.max(200, tdee * pct));
  const surplus = baseSurplus + (p.calAdjust || 0);
  const kcal = tdee + surplus;
  const protein = 1.8 * p.weight;
  const fat = (0.25 * kcal) / 9;
  const carbs = (kcal - protein * 4 - fat * 9) / 4;
  return { bmi, bmr, tdee, surplus, kcal, protein, fat, carbs };
}
function currentWeek() {
  if (!state.program) return 1;
  return Math.min(8, Math.max(1, Math.floor(daysBetween(state.program.startDate, todayStr()) / 7) + 1));
}
function dayTotals(date) {
  const list = state.meals[date] || [];
  return list.reduce((t, m) => ({ kcal: t.kcal + m.kcal, p: t.p + m.p, c: t.c + m.c, f: t.f + m.f, count: t.count + 1 }), { kcal: 0, p: 0, c: 0, f: 0, count: 0 });
}
function programStart() {
  return state.program?.startDate || (state.body.length ? state.body.map(b => b.date).sort()[0] : todayStr());
}
function weeklyWeights() {
  const start = programStart(); const buckets = {};
  state.body.filter(b => b.weight != null && b.date >= start).forEach(b => {
    const i = Math.floor(daysBetween(start, b.date) / 7) + 1;
    (buckets[i] = buckets[i] || []).push(b.weight);
  });
  return Object.keys(buckets).map(Number).sort((a, b) => a - b).map(i => ({ week: i, avg: avg(buckets[i]), n: buckets[i].length }));
}
const e1rm = (w, r) => w * (1 + r / 30); // Epley estimate

// ---------- program ----------
function generateProgram(p) {
  const T = TEMPLATES[p.sessions] || TEMPLATES[4];
  const maxEx = p.minutes <= 45 ? 4 : p.minutes <= 60 ? 5 : 99;
  const days = T.map(d => ({
    name: d.name,
    exercises: d.ex.slice(0, maxEx).map(([name, sets, a, b, rest], i) => ({
      id: uid(), name,
      sets: p.level === 'advanced' && i < 2 ? sets + 1 : p.level === 'beginner' ? Math.min(sets, 3) : sets,
      repMin: a, repMax: b, rest
    }))
  }));
  return { startDate: p.startDate || todayStr(), days };
}
const weekSets = (ex, week) => isDeload(week) ? Math.max(1, Math.round(ex.sets * 0.6)) : ex.sets;

// ---------- coach: recommended weights ----------
// [fraction of body weight for a beginner man (about 8-10 reps, 2-3 reps left), true = per dumbbell]
// Rough starting estimates only: real strength varies a lot between people.
const STRENGTH = {
  'Back Squat': [0.6], 'Front Squat': [0.45], 'Leg Press': [1.2], 'Hack Squat': [0.8], 'Bulgarian Split Squat': [0.2, true],
  'Goblet Squat': [0.25, true], 'Leg Extension': [0.4], 'Romanian Deadlift': [0.7], 'Leg Curl': [0.3], 'Hip Thrust': [0.8],
  'Walking Lunge': [0.2, true], 'Good Morning': [0.3],
  'Barbell Bench Press': [0.6], 'Incline Dumbbell Press': [0.22, true], 'Dumbbell Bench Press': [0.25, true], 'Chest Press Machine': [0.5], 'Cable Fly': [0.1],
  'Lat Pulldown': [0.6], 'Barbell Row': [0.5], 'Seated Cable Row': [0.5], 'One-Arm Dumbbell Row': [0.25, true], 'Chest-Supported Row': [0.4], 'Straight-Arm Pulldown': [0.25],
  'Overhead Press': [0.4], 'Dumbbell Shoulder Press': [0.17, true], 'Lateral Raise': [0.06, true], 'Cable Lateral Raise': [0.05], 'Rear Delt Fly': [0.06, true], 'Face Pull': [0.2],
  'Barbell Curl': [0.3], 'Dumbbell Curl': [0.12, true], 'Incline Dumbbell Curl': [0.1, true], 'Hammer Curl': [0.13, true], 'Cable Curl': [0.25],
  'Triceps Pushdown': [0.3], 'Overhead Triceps Extension': [0.2], 'Skull Crusher': [0.2], 'Close-Grip Bench Press': [0.5],
  'Standing Calf Raise': [0.7], 'Seated Calf Raise': [0.4], 'Cable Crunch': [0.3]
};
const isDb = name => !!(STRENGTH[name] && STRENGTH[name][1]);
const incFor = name => isDb(name) ? 2 : 2.5;
function startWeight(name, p) {
  const e = STRENGTH[name]; if (!e || !e[0] || !p) return null;
  const lvl = { beginner: 1, intermediate: 1.25, advanced: 1.5 }[p.level] || 1;
  const sex = p.sex === 'female' ? 0.7 : 1;
  const step = isDb(name) ? 2 : 2.5;
  return Math.max(step, Math.round(e[0] * p.weight * lvl * sex / step) * step);
}
function targetWeight(ex, wk, date) {
  const last = lastLog(ex.name, date);
  if (!last) return startWeight(ex.name, state.profile);
  const lastW = Math.max(...last.sets.map(s => s.w));
  if (!lastW) return startWeight(ex.name, state.profile);
  if (isDeload(wk)) return lastW;
  if (last.sets.every(s => s.r >= ex.repMax)) return round(lastW + incFor(ex.name), 1);
  return lastW;
}

// ---------- coach: meal plan ----------
const MEAL_SLOTS = [
  { label: 'Breakfast', share: 0.25, protein: ['Greek yogurt, plain 0%', 'Whole egg', 'Skyr, plain', 'Cottage cheese', 'Tofu, firm', 'Whey protein powder'], carb: ['Oats, dry', 'Whole-wheat bread', 'Banana'], carb2: ['Orange juice'], fat: ['Peanut butter', 'Almonds', 'Avocado'], veg: null },
  { label: 'Lunch', share: 0.32, protein: ['Chicken breast, cooked', 'Beef, lean, cooked', 'Salmon, cooked', 'Tuna, canned in water', 'Tofu, firm', 'Lentils, cooked', 'Chickpeas, cooked', 'Whole egg'], carb: ['White rice, cooked', 'Pasta, cooked', 'Potato, boiled'], fat: ['Olive oil'], veg: ['Broccoli'] },
  { label: 'Snack', share: 0.13, protein: ['Whey protein powder', 'Greek yogurt, plain 0%', 'Skyr, plain', 'Cottage cheese', 'Tuna, canned in water', 'Tofu, firm', 'Whole egg'], carb: ['Banana', 'Whole-wheat bread', 'Oats, dry'], carb2: ['Apple', 'Orange juice'], fat: ['Almonds', 'Peanut butter'], veg: null },
  { label: 'Dinner', share: 0.30, protein: ['Salmon, cooked', 'Chicken breast, cooked', 'Beef, lean, cooked', 'Tofu, firm', 'Lentils, cooked', 'Chickpeas, cooked', 'Tuna, canned in water', 'Whole egg'], carb: ['Potato, boiled', 'White rice, cooked', 'Pasta, cooked'], fat: ['Olive oil', 'Avocado'], veg: ['Broccoli'] }
];
const GRAM_CAP = {
  'Whey protein powder': 40, 'Olive oil': 25, 'Peanut butter': 35, 'Almonds': 40, 'Avocado': 100, 'Orange juice': 250, 'Whole egg': 250,
  'Whole-wheat bread': 120, 'Oats, dry': 100, 'Banana': 250, 'Apple': 250, 'White rice, cooked': 350, 'Pasta, cooked': 350, 'Potato, boiled': 450
};
function pickFood(names, seed) {
  const ex = DIET_EXCLUDES[state.profile?.diet || 'none'] || [];
  const list = names.map(n => FOODS.find(f => f.name === n)).filter(f => f && !f.tags.some(t => ex.includes(t)));
  return list.length ? list[seed % list.length] : null;
}
function buildPlan(t, seed) {
  return MEAL_SLOTS.map((slot, si) => {
    const K = t.kcal * slot.share;
    const tgt = { p: t.protein * slot.share, f: t.fat * slot.share };
    const items = []; const cur = { kcal: 0, p: 0, c: 0, f: 0 };
    const add = (food, g) => {
      g = Math.round(g / 5) * 5; if (!food || g <= 0) return;
      const k = g / 100;
      items.push({ name: food.name, grams: g, kcal: food.kcal * k, p: food.p * k, c: food.c * k, f: food.f * k });
      cur.kcal += food.kcal * k; cur.p += food.p * k; cur.c += food.c * k; cur.f += food.f * k;
    };
    const cap = (f, d) => GRAM_CAP[f.name] || d;
    if (slot.veg) add(pickFood(slot.veg, 0), 150);
    const pr = pickFood(slot.protein, seed + si);
    if (pr && pr.p > 0) add(pr, Math.min(cap(pr, 350), Math.max(0, (tgt.p - cur.p) / (pr.p / 100))));
    const ft = pickFood(slot.fat, seed + si);
    if (ft && ft.f > 0) add(ft, Math.min(cap(ft, 40), Math.max(0, (tgt.f - cur.f) / (ft.f / 100))));
    // carbohydrates fill the remaining calories of the meal
    const cb = pickFood(slot.carb, seed + si);
    if (cb && cb.kcal > 0) add(cb, Math.min(cap(cb, 400), Math.max(0, (K - cur.kcal) / (cb.kcal / 100))));
    const c2 = slot.carb2 ? pickFood(slot.carb2, seed + si) : null;
    if (c2 && c2 !== cb && K - cur.kcal > 80) add(c2, Math.min(cap(c2, 300), (K - cur.kcal) / (c2.kcal / 100)));
    return { label: slot.label, items, tot: cur };
  });
}

// ---------- charts ----------
function lineChart(series, o = {}) {
  const W = o.w || 640, H = o.h || 220, L = 44, R = 12, T = 12, B = 26;
  const all = series.flatMap(s => s.pts);
  if (!all.length) return '<p class="muted">No data yet.</p>';
  let x0 = Math.min(...all.map(p => p.x)), x1 = Math.max(...all.map(p => p.x));
  let y0 = Math.min(...all.map(p => p.y)), y1 = Math.max(...all.map(p => p.y));
  if (x0 === x1) { x0 -= 1; x1 += 1; }
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const pad = (y1 - y0) * 0.12; y0 -= pad; y1 += pad;
  const sx = x => L + (x - x0) / (x1 - x0) * (W - L - R);
  const sy = y => H - B - (y - y0) / (y1 - y0) * (H - T - B);
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const y = y0 + (y1 - y0) * i / 4;
    g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${sy(y)}" y2="${sy(y)}"/><text class="axis" x="${L - 6}" y="${sy(y) + 4}" text-anchor="end">${round(y, o.dec ?? 1)}</text>`;
  }
  for (let i = 0; i <= 3; i++) {
    const x = x0 + (x1 - x0) * i / 3;
    g += `<text class="axis" x="${sx(x)}" y="${H - 6}" text-anchor="middle">${esc(o.xFmt ? o.xFmt(x) : round(x))}</text>`;
  }
  const body = series.map(s => {
    const pts = [...s.pts].sort((a, b) => a.x - b.x);
    const path = s.line === false ? '' : `<polyline fill="none" stroke="${s.color}" stroke-width="2" points="${pts.map(p => sx(p.x) + ',' + sy(p.y)).join(' ')}"/>`;
    const dots = pts.map(p => `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="${s.r || 3}" fill="${s.color}"><title>${esc((o.xFmt ? o.xFmt(p.x) : p.x) + ': ' + round(p.y, 2))}</title></circle>`).join('');
    return path + dots;
  }).join('');
  const legend = series.length > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">${g}${body}</svg>${legend}`;
}
function bar(label, value, target, unit = '') {
  const pct = target ? Math.min(100, value / target * 100) : 0;
  const cls = target && value > target * 1.1 ? 'over' : (target && value >= target * 0.9 ? 'ok' : '');
  return `<div class="muted">${esc(label)}: <b>${round(value)}</b> / ${round(target)} ${unit}</div><div class="bar"><i class="${cls}" style="width:${pct}%"></i></div>`;
}

// ---------- navigation ----------
const TABS = [['dashboard', 'Dashboard'], ['profile', 'Profile'], ['nutrition', 'Nutrition'], ['training', 'Training'], ['progress', 'Progress'], ['coach', 'Coach'], ['research', 'Research']];
let activeTab = 'dashboard';
const ui = { planSeed: null, nutDate: todayStr(), trainWeek: null, trainDay: 0, workDate: todayStr(), draft: {}, rFilter: 'mixed', rYears: 10, rTopic: null, rQuery: '', progEx: null };

function buildNav() {
  $('#nav').innerHTML = TABS.map(([id, l]) => `<button data-tab="${id}" class="${id === activeTab ? 'active' : ''}">${l}</button>`).join('');
  $$('#nav button').forEach(b => b.onclick = () => go(b.dataset.tab));
}
function go(tab) { activeTab = tab; buildNav(); render(); window.scrollTo(0, 0); }
function render() {
  ({ dashboard: renderDashboard, profile: renderProfile, nutrition: renderNutrition, training: renderTraining, progress: renderProgress, coach: renderCoach, research: renderResearch })[activeTab]();
}
function needProfile() {
  return `<div class="card"><h2>Profile needed</h2><p>Fill in your profile first so targets and your program can be personalised.</p><button class="primary" data-go="profile">Go to profile</button></div>`;
}
function bindGo() { $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go)); }

// ---------- dashboard ----------
function renderDashboard() {
  const v = $('#view'); const p = state.profile;
  if (!p) {
    v.innerHTML = `<div class="card"><h2>Welcome 👋</h2>
      <p>Your 8-week digital coach: personalised calories and macros, a progressive training plan, daily tracking, automatic recommendations and a live search of the scientific literature (PubMed).</p>
      <p class="muted">Start by creating your profile.</p><button class="primary" data-go="profile">Create my profile</button></div>`;
    bindGo(); return;
  }
  const t = calcTargets(p); const tot = dayTotals(todayStr()); const wk = currentWeek();
  const recs = analyze().slice(0, 3);
  let next = '', sessionCard = '', sessionIdx = 0;
  if (state.program) {
    const doneDays = new Set(state.logs.filter(l => l.week === wk).map(l => l.date)).size;
    sessionIdx = doneDays % state.program.days.length;
    const d = state.program.days[sessionIdx];
    next = `<div class="stat"><span>Next workout</span><b>${esc(d.name)}</b></div>`;
    sessionCard = `<div class="card"><h2>Coach: your next session – ${esc(d.name)}</h2>
      ${d.exercises.map(ex => { const w = targetWeight(ex, wk, todayStr()); return `<div class="stat"><span>${esc(ex.name)}</span><b>${weekSets(ex, wk)} × ${ex.repMin}–${ex.repMax}${w != null ? ' @ ' + w + ' kg' + (isDb(ex.name) ? '/dumbbell' : '') : ' (bodyweight)'}</b></div>`; }).join('')}
      <p class="muted">Rest between sets: about 1–3 minutes (longer for heavy compound lifts). Warm up first. Weights are estimates that update from your logged workouts.</p>
      <button class="primary" id="openSession">Open and log this session</button></div>`;
  }
  const ww = weeklyWeights(); const last = ww[ww.length - 1];
  v.innerHTML = `
  <div class="grid">
    <div class="card"><h2>Program</h2>
      <div class="stat"><span>Current week</span><b>${wk} / 8${isDeload(wk) ? ' (deload)' : ''}</b></div>${next}
      <div class="bar"><i class="ok" style="width:${wk / 8 * 100}%"></i></div>
      <div class="stat"><span>Start weight</span><b>${p.weight} kg</b></div>
      <div class="stat"><span>Goal weight</span><b>${p.goalWeight} kg</b></div>
      <div class="stat"><span>Latest weekly average</span><b>${last ? round(last.avg, 1) + ' kg' : '–'}</b></div>
      <div class="row"><button class="secondary" data-go="training">Open training</button></div>
    </div>
    <div class="card"><h2>Today's nutrition</h2>
      ${bar('Calories', tot.kcal, t.kcal, 'kcal')}${bar('Protein', tot.p, t.protein, 'g')}${bar('Carbs', tot.c, t.carbs, 'g')}${bar('Fat', tot.f, t.fat, 'g')}
      <button class="secondary" data-go="nutrition">Log a meal</button>
    </div>
  </div>
  ${sessionCard}
  <div class="card"><h2>Coach highlights</h2>
    ${recs.length ? recs.map(r => `<p><b>${esc(r.title)}</b><br><span class="muted">${esc(r.body)}</span></p>`).join('') : '<p class="muted">No recommendation yet.</p>'}
    <button class="secondary" data-go="coach">See all recommendations</button>
  </div>`;
  bindGo();
  const os = $('#openSession');
  if (os) os.onclick = () => { ui.trainDay = sessionIdx; ui.trainWeek = null; ui.workDate = todayStr(); go('training'); };
}

// ---------- profile ----------
function renderProfile() {
  const p = state.profile || { age: 25, height: 175, weight: 70, goalWeight: 73, sex: 'male', level: 'beginner', experience: 0, sessions: 4, activity: 'light', minutes: 60, diet: 'none', notes: '', startDate: todayStr() };
  const t = state.profile ? calcTargets(state.profile) : null;
  const opt = (val, cur, label) => `<option value="${val}" ${val == cur ? 'selected' : ''}>${label}</option>`;
  $('#view').innerHTML = `
  <div class="card"><h2>Your profile</h2>
    <form id="pf" class="form">
      <label>Age<input name="age" type="number" min="14" max="90" value="${p.age}" required></label>
      <label>Height (cm)<input name="height" type="number" min="120" max="230" value="${p.height}" required></label>
      <label>Current weight (kg)<input name="weight" type="number" step="0.1" value="${p.weight}" required></label>
      <label>Goal weight (kg)<input name="goalWeight" type="number" step="0.1" value="${p.goalWeight}" required></label>
      <label>Sex (used for physiological estimates)<select name="sex">${opt('male', p.sex, 'Male')}${opt('female', p.sex, 'Female')}</select></label>
      <label>Training level<select name="level">${opt('beginner', p.level, 'Beginner (&lt; 1 year)')}${opt('intermediate', p.level, 'Intermediate (1–3 years)')}${opt('advanced', p.level, 'Advanced (3+ years)')}</select></label>
      <label>Lifting experience (years)<input name="experience" type="number" min="0" step="0.5" value="${p.experience}"></label>
      <label>Sessions per week<select name="sessions">${opt(3, p.sessions, '3')}${opt(4, p.sessions, '4')}${opt(5, p.sessions, '5')}</select></label>
      <label>Daily activity (outside training)<select name="activity">${Object.entries(ACTIVITY_LABEL).map(([k, l]) => opt(k, p.activity, l)).join('')}</select></label>
      <label>Time per session<select name="minutes">${opt(45, p.minutes, '≈ 45 min')}${opt(60, p.minutes, '≈ 60 min')}${opt(90, p.minutes, '75+ min')}</select></label>
      <label>Dietary constraint<select name="diet">${Object.keys(DIET_EXCLUDES).map(k => opt(k, p.diet, k)).join('')}</select></label>
      <label>Other notes (allergies, injuries…)<input name="notes" value="${esc(p.notes)}"></label>
      <label>Program start date<input name="startDate" type="date" value="${p.startDate}"></label>
    </form>
    <div class="row"><button class="primary" id="saveProfile">Save profile</button></div>
  </div>
  ${t ? `<div class="card"><h2>Estimates</h2>
    <div class="stat"><span>BMI</span><b>${round(t.bmi, 1)}</b></div>
    <p class="muted">BMI ignores muscle mass, so it can over-estimate "overweight" in muscular people. Use it as a rough screening number only.</p>
    <div class="stat"><span>Basal metabolic rate (Mifflin-St Jeor)</span><b>${round(t.bmr)} kcal</b></div>
    <div class="stat"><span>Estimated daily energy expenditure</span><b>${round(t.tdee)} kcal</b></div>
    <div class="stat"><span>Calorie surplus</span><b>+${round(t.surplus)} kcal</b></div>
    <div class="stat"><span>Calorie target</span><b>${round(t.kcal)} kcal</b></div>
    <div class="stat"><span>Protein (1.8 g/kg)</span><b>${round(t.protein)} g</b></div>
    <div class="stat"><span>Carbohydrates</span><b>${round(t.carbs)} g</b></div>
    <div class="stat"><span>Fat (≈25% of calories)</span><b>${round(t.fat)} g</b></div>
    <p class="muted">These are starting estimates. The Coach tab adjusts them using your real weight trend. ${state.profile.calAdjust ? `Current manual/auto adjustment: ${state.profile.calAdjust > 0 ? '+' : ''}${state.profile.calAdjust} kcal.` : ''}</p>
    <p class="muted">Reality check: ${round(state.profile.goalWeight - state.profile.weight, 1)} kg in 8 weeks is ${round((state.profile.goalWeight - state.profile.weight) / state.profile.weight / 8 * 100, 2)}% of body weight per week. Scale weight includes water, glycogen and some fat, so gaining 3 kg of pure muscle in 2 months is unrealistic for most people (it is more plausible for true beginners). A common practical aim is about 0.25–0.5% of body weight per week.</p>
  </div>` : ''}
  <div class="card"><h2>Data</h2>
    <div class="row">
      <button class="secondary" id="exp">Export backup (JSON)</button>
      <label class="row"><span class="muted">Import backup</span><input type="file" id="imp" accept="application/json"></label>
      <button class="danger" id="reset">Delete all data</button>
    </div>
  </div>`;
  $('#saveProfile').onclick = () => {
    const f = $('#pf'); if (!f.reportValidity()) return;
    const fd = Object.fromEntries(new FormData(f).entries());
    const prev = state.profile;
    const np = {
      age: num(fd.age), height: num(fd.height), weight: num(fd.weight), goalWeight: num(fd.goalWeight), sex: fd.sex, level: fd.level,
      experience: num(fd.experience) || 0, sessions: +fd.sessions, activity: fd.activity, minutes: +fd.minutes, diet: fd.diet, notes: fd.notes, startDate: fd.startDate || todayStr(),
      calAdjust: prev?.calAdjust || 0
    };
    state.profile = np;
    const changed = prev && (prev.sessions !== np.sessions || prev.level !== np.level || prev.minutes !== np.minutes);
    if (!state.program) state.program = generateProgram(np);
    else if (changed && confirm('Your schedule or level changed. Regenerate the training program? (Your logged workouts are kept.)')) state.program = generateProgram(np);
    else state.program.startDate = np.startDate;
    save(); renderProfile();
  };
  $('#exp').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `muscle-program-backup-${todayStr()}.json`; a.click();
  };
  $('#imp').onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => { try { state = Object.assign(defaultState(), JSON.parse(r.result)); save(); alert('Backup imported.'); renderProfile(); } catch (err) { alert('Invalid backup file.'); } };
    r.readAsText(file);
  };
  $('#reset').onclick = () => { if (confirm('Delete ALL your data from this browser? This cannot be undone.')) { state = defaultState(); save(); go('dashboard'); } };
}

// ---------- nutrition ----------
function allowedFoods() {
  const ex = DIET_EXCLUDES[state.profile?.diet || 'none'] || [];
  return [...state.customFoods, ...FOODS].filter(f => !(f.tags || []).some(t => ex.includes(t)));
}
function renderNutrition() {
  const p = state.profile; if (!p) { $('#view').innerHTML = needProfile(); bindGo(); return; }
  const t = calcTargets(p); const date = ui.nutDate; const meals = state.meals[date] || []; const tot = dayTotals(date);
  const week = []; for (let i = 6; i >= 0; i--) { const d = addDays(todayStr(), -i); week.push({ d, ...dayTotals(d) }); }
  const topProtein = allowedFoods().filter(f => f.kcal > 0).sort((a, b) => (b.p / b.kcal) - (a.p / a.kcal)).slice(0, 5);
  const seed = ui.planSeed ?? Math.floor(Date.now() / 86400000);
  const plan = buildPlan(t, seed);
  const planTot = plan.reduce((s, m) => ({ kcal: s.kcal + m.tot.kcal, p: s.p + m.tot.p, c: s.c + m.tot.c, f: s.f + m.tot.f }), { kcal: 0, p: 0, c: 0, f: 0 });
  const planHtml = `<div class="card"><h2>Coach meal plan</h2>
    <p class="muted">Built from your targets and dietary constraint (${esc(p.diet)}). Quantities are cooked/ready-to-eat weights. Tap "Another suggestion" for different foods, or add a meal to your log.</p>
    ${plan.map((m, mi) => `<h3>${m.label} · ${round(m.tot.kcal)} kcal · ${round(m.tot.p)} g protein</h3>
      ${m.items.length ? `<ul>${m.items.map(i => `<li>${i.grams} g ${esc(i.name)}</li>`).join('')}</ul><button class="small" data-pm="${mi}">Add to this day's log</button>` : '<p class="muted">No suitable food for your diet in this meal.</p>'}`).join('')}
    <p><b>Plan total:</b> ${round(planTot.kcal)} kcal · ${round(planTot.p)} g protein · ${round(planTot.c)} g carbs · ${round(planTot.f)} g fat <span class="muted">(target ${round(t.kcal)} kcal / ${round(t.protein)} g protein)</span></p>
    <p class="muted">Adjust portions to hit your numbers (a little rice or oil closes most gaps). Drink water through the day.</p>
    <div class="row"><button class="primary" id="pAll">Add whole plan to log</button><button class="secondary" id="pShuf">Another suggestion</button></div></div>`;
  $('#view').innerHTML = `
  <div class="card"><h2>Daily targets</h2>
    <div class="row"><label>Date <input type="date" id="nd" value="${date}"></label></div>
    ${bar('Calories', tot.kcal, t.kcal, 'kcal')}${bar('Protein', tot.p, t.protein, 'g')}${bar('Carbs', tot.c, t.carbs, 'g')}${bar('Fat', tot.f, t.fat, 'g')}
    <p class="muted">Remaining: ${round(t.kcal - tot.kcal)} kcal · ${round(t.protein - tot.p)} g protein. Hydration: keep water within reach and drink regularly through the day.</p>
  </div>
  ${planHtml}
  <div class="card"><h2>Add food</h2>
    <div class="row"><input id="fq" placeholder="Search a food (e.g. rice, chicken, yogurt)…" style="flex:1"><button class="secondary" id="off">Search Open Food Facts</button></div>
    <div id="fres"></div>
    <details><summary class="muted">Add a custom food (values per 100 g)</summary>
      <form id="cf" class="form" style="margin-top:.6rem">
        <label>Name<input name="name" required></label><label>kcal<input name="kcal" type="number" step="0.1" required></label>
        <label>Protein (g)<input name="p" type="number" step="0.1" required></label><label>Carbs (g)<input name="c" type="number" step="0.1" required></label><label>Fat (g)<input name="f" type="number" step="0.1" required></label>
      </form><button class="secondary" id="cfs">Save food</button>
    </details>
    <p class="muted">Built-in values are approximate; check labels for packaged foods. Highest protein-per-calorie foods for your diet: ${topProtein.map(f => esc(f.name)).join(', ')}.</p>
  </div>
  <div class="card"><h2>Meals logged</h2>
    ${meals.length ? `<div class="scroll"><table><tr><th>Food</th><th>g</th><th>kcal</th><th>P</th><th>C</th><th>F</th><th></th></tr>
    ${meals.map(m => `<tr><td>${esc(m.name)}</td><td>${m.grams}</td><td>${round(m.kcal)}</td><td>${round(m.p, 1)}</td><td>${round(m.c, 1)}</td><td>${round(m.f, 1)}</td><td><button class="small" data-del="${m.id}">✕</button></td></tr>`).join('')}</table></div>` : '<p class="muted">Nothing logged for this day.</p>'}
  </div>
  <div class="card"><h2>Last 7 days</h2><div class="scroll"><table><tr><th>Day</th><th>kcal</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Gap vs target</th></tr>
    ${week.map(w => `<tr><td>${w.d.slice(5)}</td><td>${w.count ? round(w.kcal) : '–'}</td><td>${w.count ? round(w.p) : '–'}</td><td>${w.count ? round(w.c) : '–'}</td><td>${w.count ? round(w.f) : '–'}</td><td>${w.count ? (w.kcal - t.kcal >= 0 ? '+' : '') + round(w.kcal - t.kcal) : '–'}</td></tr>`).join('')}
  </table></div></div>`;
  $('#nd').onchange = e => { ui.nutDate = e.target.value || todayStr(); renderNutrition(); };
  const logItems = items => {
    (state.meals[date] = state.meals[date] || []).push(...items.map(i => ({ id: uid(), name: i.name, grams: i.grams, kcal: i.kcal, p: i.p, c: i.c, f: i.f })));
    save(); renderNutrition();
  };
  $$('[data-pm]').forEach(b => b.onclick = () => logItems(plan[+b.dataset.pm].items));
  $('#pAll').onclick = () => logItems(plan.flatMap(m => m.items));
  $('#pShuf').onclick = () => { ui.planSeed = seed + 1; renderNutrition(); };
  const showFoods = list => {
    const box = $('#fres');
    if (!list.length) { box.innerHTML = '<p class="muted">No result.</p>'; return; }
    box.innerHTML = list.map((f, i) => `<div class="row"><span style="flex:1;min-width:160px">${esc(f.name)}<br><span class="muted">${round(f.kcal)} kcal · P ${round(f.p, 1)} · C ${round(f.c, 1)} · F ${round(f.f, 1)} /100 g</span></span><input type="number" value="100" min="1" style="width:80px" id="g${i}"> g <button class="small" data-add="${i}">Add</button></div>`).join('');
    $$('[data-add]', box).forEach(b => b.onclick = () => {
      const f = list[+b.dataset.add]; const g = num($('#g' + b.dataset.add).value); if (!g || g <= 0) return;
      (state.meals[date] = state.meals[date] || []).push({ id: uid(), name: f.name, grams: g, kcal: f.kcal * g / 100, p: f.p * g / 100, c: f.c * g / 100, f: f.f * g / 100 });
      save(); renderNutrition();
    });
  };
  const local = q => allowedFoods().filter(f => !q || f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  showFoods(local(''));
  $('#fq').oninput = e => showFoods(local(e.target.value.trim()));
  $('#off').onclick = async () => {
    const q = $('#fq').value.trim(); if (!q) return;
    $('#fres').innerHTML = '<p class="muted">Searching Open Food Facts…</p>';
    try {
      const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=10&fields=product_name,brands,nutriments`);
      const j = await r.json();
      const list = (j.products || []).filter(x => x.product_name && x.nutriments && x.nutriments['energy-kcal_100g'] != null).map(x => ({
        name: x.product_name + (x.brands ? ' (' + x.brands.split(',')[0] + ')' : ''),
        kcal: +x.nutriments['energy-kcal_100g'] || 0, p: +x.nutriments.proteins_100g || 0, c: +x.nutriments.carbohydrates_100g || 0, f: +x.nutriments.fat_100g || 0, tags: []
      }));
      showFoods(list);
    } catch (e) { $('#fres').innerHTML = '<p class="muted">Could not reach Open Food Facts (offline or blocked). Use the built-in list or a custom food.</p>'; }
  };
  $('#cfs').onclick = () => {
    const f = $('#cf'); if (!f.reportValidity()) return;
    const d = Object.fromEntries(new FormData(f).entries());
    state.customFoods.push({ name: d.name, kcal: num(d.kcal), p: num(d.p), c: num(d.c), f: num(d.f), tags: [] });
    save(); renderNutrition();
  };
  $$('[data-del]').forEach(b => b.onclick = () => { state.meals[date] = (state.meals[date] || []).filter(m => m.id !== b.dataset.del); save(); renderNutrition(); });
}

// ---------- training ----------
function exerciseSelect(cur) {
  const all = Object.values(EXERCISES).flat();
  return `<select class="exName">${!all.includes(cur) ? `<option selected>${esc(cur)}</option>` : ''}${Object.entries(EXERCISES).map(([g, list]) => `<optgroup label="${esc(g)}">${list.map(n => `<option ${n === cur ? 'selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`).join('')}</select>`;
}
function lastLog(name, beforeDate) {
  return state.logs.filter(l => l.name === name && l.date < beforeDate).sort((a, b) => a.date.localeCompare(b.date)).pop();
}
function suggestion(ex, wk) {
  const last = lastLog(ex.name, ui.workDate);
  const tw = targetWeight(ex, wk, ui.workDate);
  const unit = isDb(ex.name) ? ' per dumbbell' : '';
  if (!last) {
    if (tw == null) return `Bodyweight or unknown load: do controlled reps in the ${ex.repMin}–${ex.repMax} range, stopping 1–3 reps before failure.`;
    return `Starting weight estimate: about ${tw} kg${unit}, based on your body weight and level. Do 1–2 light warm-up sets first, then adjust so the last reps of each set are hard but clean (2–3 reps left).`;
  }
  const lastW = Math.max(...last.sets.map(s => s.w));
  const summary = last.sets.map(s => `${s.w}×${s.r}`).join(', ');
  if (isDeload(wk)) return `Last: ${summary}. Deload week: keep ${lastW} kg, fewer sets, stay well short of failure.`;
  if (last.sets.every(s => s.r >= ex.repMax)) return `Last: ${summary}. All sets reached ${ex.repMax} reps → try ${round(lastW + incFor(ex.name), 1)} kg${unit}.`;
  return `Last: ${summary}. Keep ${lastW} kg and aim for +1 rep per set (top of range: ${ex.repMax}).`;
}
let timerId = null;
function startTimer(sec) {
  clearInterval(timerId); const el = $('#timer'); let left = sec; el.classList.remove('hidden');
  const tick = () => {
    el.textContent = `Rest ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} (tap to dismiss)`;
    if (left <= 0) {
      clearInterval(timerId); el.textContent = 'Rest over – next set!';
      try { navigator.vibrate && navigator.vibrate(300); const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(); o.connect(a.destination); o.frequency.value = 880; o.start(); setTimeout(() => o.stop(), 250); } catch (e) { }
      setTimeout(() => el.classList.add('hidden'), 3000);
    }
    left--;
  };
  tick(); timerId = setInterval(tick, 1000);
  el.onclick = () => { clearInterval(timerId); el.classList.add('hidden'); };
}
function renderTraining() {
  const v = $('#view'); const p = state.profile;
  if (!p) { v.innerHTML = needProfile(); bindGo(); return; }
  if (!state.program) {
    v.innerHTML = `<div class="card"><h2>Training</h2><p>No program yet.</p><button class="primary" id="gen">Generate my 8-week program</button></div>`;
    $('#gen').onclick = () => { state.program = generateProgram(p); save(); renderTraining(); }; return;
  }
  const prog = state.program;
  if (ui.trainWeek == null) ui.trainWeek = currentWeek();
  const wk = ui.trainWeek; if (!prog.days[ui.trainDay]) ui.trainDay = 0;
  const di = ui.trainDay; const day = prog.days[di]; const date = ui.workDate;
  const existing = name => state.logs.find(l => l.date === date && l.name === name);
  v.innerHTML = `
  <div class="card"><h2>8-week program</h2>
    <p class="muted">Progression is by load/reps (double progression), not by automatically adding sets. Weeks 4 and 8 are deloads (about 40% fewer sets). Volume only goes up if the Coach tab finds a justification. Starting weights are rough estimates from your body weight: always warm up, and go lighter if unsure.</p>
    <div class="weeks">${[1, 2, 3, 4, 5, 6, 7, 8].map(w => `<button class="small ${w === wk ? 'active' : ''} ${isDeload(w) ? 'deload' : ''}" data-wk="${w}">W${w}</button>`).join('')}</div>
    <div class="weeks">${prog.days.map((d, i) => `<button class="small ${i === di ? 'active' : ''}" data-day="${i}">${esc(d.name)}</button>`).join('')}</div>
    <div class="row"><label class="row"><span class="muted">Workout date</span><input type="date" id="wd" value="${date}"></label>
    <button class="danger small" id="regen">Regenerate program</button></div>
    ${isDeload(wk) ? '<p><b>Deload week:</b> fewer sets, same exercises, stay clear of failure. Recovery lets you come back stronger.</p>' : ''}
  </div>
  ${day.exercises.map((ex, i) => {
    const n = weekSets(ex, wk); const ln = existing(ex.name); const tw = targetWeight(ex, wk, date);
    const val = (s, k) => ui.draft[`${wk}-${di}-${i}-${s}-${k}`] ?? (ln && ln.sets[s] ? ln.sets[s][k === 'w' ? 'w' : 'r'] : '');
    return `<div class="card ex" data-i="${i}">
      <div class="row">${exerciseSelect(ex.name)}<button class="danger small rm">✕</button></div>
      <div class="row muted">Base sets <input class="exSets" type="number" min="1" max="8" value="${ex.sets}" style="width:60px"> Reps <input class="exMin" type="number" min="1" value="${ex.repMin}" style="width:60px">–<input class="exMax" type="number" min="1" value="${ex.repMax}" style="width:60px"> Rest (s) <input class="exRest" type="number" min="15" step="15" value="${ex.rest}" style="width:70px"></div>
      <p><b>Coach: ${n} sets × ${ex.repMin}–${ex.repMax} reps${tw != null ? ` at ${tw} kg${isDb(ex.name) ? ' per dumbbell' : ''}` : ''}</b>${isDeload(wk) ? ' (deload)' : ''}</p>
      <p class="muted">${esc(suggestion(ex, wk))}</p>
      <div class="scroll"><table><tr><th>Set</th><th>Weight (kg)</th><th>Reps</th></tr>
      ${Array.from({ length: n }, (_, s) => `<tr><td>${s + 1}</td><td><input class="w" data-s="${s}" type="number" step="0.5" placeholder="${tw ?? 'kg'}" value="${val(s, 'w')}"></td><td><input class="r" data-s="${s}" type="number" value="${val(s, 'r')}"></td></tr>`).join('')}</table></div>
      <div class="row"><label class="row"><span class="muted">Actual rest (s)</span><input class="restAct" type="number" style="width:80px" value="${ui.draft[`${wk}-${di}-${i}-rest`] ?? ln?.rest ?? ''}"></label><button class="small timer-btn">⏱ Start ${ex.rest}s timer</button></div>
    </div>`;
  }).join('')}
  <div class="card"><div class="row">
    <select id="addGroup">${Object.keys(EXERCISES).map(g => `<option>${esc(g)}</option>`).join('')}</select>
    <button class="secondary" id="addEx">+ Add exercise</button>
    <button class="primary" id="saveW">Save workout</button></div></div>`;
  $$('[data-wk]').forEach(b => b.onclick = () => { ui.trainWeek = +b.dataset.wk; renderTraining(); });
  $$('[data-day]').forEach(b => b.onclick = () => { ui.trainDay = +b.dataset.day; renderTraining(); });
  $('#wd').onchange = e => { ui.workDate = e.target.value || todayStr(); renderTraining(); };
  $('#regen').onclick = () => { if (confirm('Replace the current program with a freshly generated one?')) { state.program = generateProgram(state.profile); save(); renderTraining(); } };
  $$('.ex').forEach(card => {
    const i = +card.dataset.i; const ex = day.exercises[i];
    $('.exName', card).onchange = e => { ex.name = e.target.value; save(); renderTraining(); };
    $('.exSets', card).onchange = e => { ex.sets = Math.max(1, Math.min(8, +e.target.value || 3)); save(); renderTraining(); };
    $('.exMin', card).onchange = e => { ex.repMin = +e.target.value || 8; save(); renderTraining(); };
    $('.exMax', card).onchange = e => { ex.repMax = +e.target.value || 12; save(); renderTraining(); };
    $('.exRest', card).onchange = e => { ex.rest = +e.target.value || 90; save(); renderTraining(); };
    $('.rm', card).onclick = () => { day.exercises.splice(i, 1); save(); renderTraining(); };
    $('.timer-btn', card).onclick = () => startTimer(ex.rest);
    $$('input.w, input.r', card).forEach(inp => inp.oninput = () => { ui.draft[`${wk}-${di}-${i}-${inp.dataset.s}-${inp.classList.contains('w') ? 'w' : 'r'}`] = inp.value; });
    $('.restAct', card).oninput = e => { ui.draft[`${wk}-${di}-${i}-rest`] = e.target.value; };
  });
  $('#addEx').onclick = () => { const g = $('#addGroup').value; day.exercises.push({ id: uid(), name: EXERCISES[g][0], sets: 3, repMin: 8, repMax: 12, rest: 90 }); save(); renderTraining(); };
  $('#saveW').onclick = () => {
    let saved = 0;
    $$('.ex').forEach(card => {
      const ex = day.exercises[+card.dataset.i];
      const sets = [];
      $$('tr', card).slice(1).forEach(tr => { const w = num($('.w', tr).value), r = num($('.r', tr).value); if (r != null && r > 0) sets.push({ w: w ?? 0, r }); });
      if (!sets.length) return;
      state.logs = state.logs.filter(l => !(l.date === date && l.name === ex.name));
      state.logs.push({ id: uid(), date, week: wk, dayIndex: di, name: ex.name, sets, rest: num($('.restAct', card).value) });
      saved++;
    });
    if (!saved) { alert('Enter at least one set (reps) first.'); return; }
    Object.keys(ui.draft).filter(k => k.startsWith(`${wk}-${di}-`)).forEach(k => delete ui.draft[k]);
    save(); alert(`Workout saved (${saved} exercises).`); renderTraining();
  };
}

// ---------- progress ----------
function fileToDataUrl(file, maxW = 600) {
  return new Promise((res, rej) => {
    const img = new Image(); const fr = new FileReader();
    fr.onload = () => { img.onload = () => { const s = Math.min(1, maxW / img.width); const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.7)); }; img.onerror = rej; img.src = fr.result; };
    fr.onerror = rej; fr.readAsDataURL(file);
  });
}
function renderProgress() {
  const p = state.profile; if (!p) { $('#view').innerHTML = needProfile(); bindGo(); return; }
  const start = programStart(); const body = [...state.body].sort((a, b) => a.date.localeCompare(b.date));
  const xFmt = x => addDays(start, Math.round(x)).slice(5);
  const wPts = body.filter(b => b.weight != null).map(b => ({ x: daysBetween(start, b.date), y: b.weight }));
  const wAvg = weeklyWeights().map(w => ({ x: (w.week - 1) * 7 + 3, y: w.avg }));
  const exNames = [...new Set(state.logs.map(l => l.name))];
  if (!ui.progEx || !exNames.includes(ui.progEx)) ui.progEx = exNames[0] || null;
  const exPts = state.logs.filter(l => l.name === ui.progEx).sort((a, b) => a.date.localeCompare(b.date)).map(l => ({ x: daysBetween(start, l.date), y: Math.max(...l.sets.map(s => e1rm(s.w, s.r))) }));
  const meas = [['arm', 'Arm (cm)', '#3ddc97'], ['chest', 'Chest (cm)', '#4da3ff'], ['waist', 'Waist (cm)', '#ffb84d'], ['thigh', 'Thigh (cm)', '#c792ea']];
  const today = todayStr(); const todayEntry = body.find(b => b.date === today) || {};
  $('#view').innerHTML = `
  <div class="card"><h2>Log measurements</h2>
    <form id="bf" class="form">
      <label>Date<input name="date" type="date" value="${today}"></label>
      <label>Body weight (kg)<input name="weight" type="number" step="0.1" value="${todayEntry.weight ?? ''}"></label>
      <label>Arm (cm)<input name="arm" type="number" step="0.1" value="${todayEntry.arm ?? ''}"></label>
      <label>Chest (cm)<input name="chest" type="number" step="0.1" value="${todayEntry.chest ?? ''}"></label>
      <label>Waist (cm)<input name="waist" type="number" step="0.1" value="${todayEntry.waist ?? ''}"></label>
      <label>Thigh (cm)<input name="thigh" type="number" step="0.1" value="${todayEntry.thigh ?? ''}"></label>
      <label>Sleep last night (h)<input name="sleepH" type="number" step="0.25" value="${todayEntry.sleepH ?? ''}"></label>
      <label>Sleep quality (1 bad – 5 great)<input name="sleepQ" type="number" min="1" max="5" value="${todayEntry.sleepQ ?? ''}"></label>
      <label>Fatigue (1 fresh – 5 exhausted)<input name="fatigue" type="number" min="1" max="5" value="${todayEntry.fatigue ?? ''}"></label>
    </form>
    <div class="row"><button class="primary" id="bs">Save entry</button></div>
    <p class="muted">Tip: weigh yourself in the morning, after the toilet, before eating, at least 3 times a week. The app uses weekly averages.</p>
  </div>
  <div class="card"><h2>Body weight</h2>${lineChart([{ name: 'Daily', color: '#8fa0b3', pts: wPts, line: false, r: 2.5 }, { name: 'Weekly average', color: '#3ddc97', pts: wAvg, r: 4 }], { xFmt })}</div>
  <div class="card"><h2>Measurements</h2><div class="grid">${meas.map(([k, l, c]) => `<div><h3>${l}</h3>${lineChart([{ name: l, color: c, pts: body.filter(b => b[k] != null).map(b => ({ x: daysBetween(start, b.date), y: b[k] })) }], { xFmt, w: 320, h: 150 })}</div>`).join('')}</div></div>
  <div class="card"><h2>Strength (estimated 1RM)</h2>
    ${exNames.length ? `<select id="pe">${exNames.map(n => `<option ${n === ui.progEx ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>${lineChart([{ name: 'e1RM', color: '#4da3ff', pts: exPts }], { xFmt })}<p class="muted">Epley estimate from your best set each session. Log workouts in the Training tab.</p>` : '<p class="muted">Log a workout to see progress per exercise.</p>'}
  </div>
  <div class="card"><h2>Sleep and fatigue</h2>${lineChart([{ name: 'Sleep quality', color: '#4da3ff', pts: body.filter(b => b.sleepQ != null).map(b => ({ x: daysBetween(start, b.date), y: b.sleepQ })) }, { name: 'Fatigue', color: '#ff6b6b', pts: body.filter(b => b.fatigue != null).map(b => ({ x: daysBetween(start, b.date), y: b.fatigue })) }], { xFmt })}</div>
  <div class="card"><h2>Progress photos (optional)</h2>
    <p class="muted">Stored only in this browser, resized to save space.</p>
    <input type="file" id="ph" accept="image/*">
    <div class="photos" style="margin-top:.6rem">${state.photos.map((ph, i) => `<div><img src="${ph.data}" alt="Progress photo ${esc(ph.date)}"><div class="row"><span class="muted">${esc(ph.date)}</span><button class="small" data-dp="${i}">✕</button></div></div>`).join('')}</div>
  </div>
  <div class="card"><h2>Entries</h2><div class="scroll"><table><tr><th>Date</th><th>kg</th><th>Arm</th><th>Chest</th><th>Waist</th><th>Thigh</th><th>Sleep</th><th>Fat.</th><th></th></tr>
    ${[...body].reverse().slice(0, 15).map(b => `<tr><td>${b.date}</td><td>${b.weight ?? ''}</td><td>${b.arm ?? ''}</td><td>${b.chest ?? ''}</td><td>${b.waist ?? ''}</td><td>${b.thigh ?? ''}</td><td>${b.sleepH ?? ''}${b.sleepQ ? ' (' + b.sleepQ + ')' : ''}</td><td>${b.fatigue ?? ''}</td><td><button class="small" data-db="${b.date}">✕</button></td></tr>`).join('')}</table></div></div>`;
  $('#bs').onclick = () => {
    const d = Object.fromEntries(new FormData($('#bf')).entries());
    if (!d.date) return;
    let e = state.body.find(b => b.date === d.date); if (!e) { e = { date: d.date }; state.body.push(e); }
    ['weight', 'arm', 'chest', 'waist', 'thigh', 'sleepH', 'sleepQ', 'fatigue'].forEach(k => { const n = num(d[k]); if (n != null) e[k] = n; });
    if (e.weight != null && d.date >= todayStr() && state.profile) { /* keep profile start weight unchanged */ }
    save(); renderProgress();
  };
  $$('[data-db]').forEach(b => b.onclick = () => { state.body = state.body.filter(x => x.date !== b.dataset.db); save(); renderProgress(); });
  $$('[data-dp]').forEach(b => b.onclick = () => { state.photos.splice(+b.dataset.dp, 1); save(); renderProgress(); });
  const pe = $('#pe'); if (pe) pe.onchange = e => { ui.progEx = e.target.value; renderProgress(); };
  $('#ph').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { state.photos.push({ date: todayStr(), data: await fileToDataUrl(f) }); save(); renderProgress(); } catch (err) { alert('Could not read this image.'); } };
}

// ---------- coach (rules engine) ----------
const LEVEL_LABEL = { established: '🟢 Well established', promising: '🟡 Promising, still uncertain', practical: '🔵 Practical hypothesis' };
function analyze() {
  const p = state.profile; const recs = []; if (!p) return recs;
  const t = calcTargets(p); const today = todayStr();
  const intake = []; for (let i = 0; i < 7; i++) { const d = dayTotals(addDays(today, -i)); if (d.count) intake.push(d); }
  const avgK = intake.length >= 3 ? avg(intake.map(d => d.kcal)) : null;
  const avgP = intake.length >= 3 ? avg(intake.map(d => d.p)) : null;
  const eatingBelow = avgK != null && avgK < 0.9 * t.kcal;

  if (avgK == null) recs.push({ title: 'Log your meals for at least 3 days', body: 'Without intake data the coach cannot tell whether a slow weight gain comes from the plan or from not eating the target.', level: 'practical', query: 'energy surplus lean mass gain resistance training' });
  if (eatingBelow) recs.push({ title: 'You are eating below your calorie target', body: `Your 7-day average is about ${round(avgK)} kcal versus a target of ${round(t.kcal)} kcal. Close this gap before raising the target: add one calorie-dense meal or snack (rice, oats, peanut butter, olive oil).`, level: 'practical', query: 'energy surplus lean mass gain resistance training' });
  if (avgP != null && avgP < 0.9 * t.protein) recs.push({ title: 'Increase protein intake', body: `Average ${round(avgP)} g/day versus ${round(t.protein)} g/day target. Spread it over 3–5 meals, with a protein source at each (eggs, dairy, meat, fish, legumes, tofu, whey).`, level: 'established', query: 'protein intake resistance training lean mass' });

  const weeks = weeklyWeights().filter(w => w.n >= 2);
  if (weeks.length < 3) {
    recs.push({ title: 'Keep logging your weight', body: 'Weight-trend recommendations need about 3 weeks with at least 2–3 weigh-ins per week. Until then, follow the targets and the program.', level: 'practical', query: 'body weight monitoring resistance training lean mass' });
  } else {
    const a = weeks[weeks.length - 3], c = weeks[weeks.length - 1];
    const rate = ((c.avg - a.avg) / (c.week - a.week)) / a.avg * 100;
    if (rate < 0.1) {
      recs.push(eatingBelow
        ? { title: 'Weight is flat, but intake is below target', body: `Weekly weight change is about ${round(rate, 2)}%/week. Because you are not reaching the calorie target, keep the target for now and fix adherence first.`, level: 'practical', query: 'energy surplus lean mass gain resistance training' }
        : { title: 'Weight is not rising enough', body: `Weekly weight change is about ${round(rate, 2)}%/week (a common aim is roughly 0.25–0.5%). Raise calories by about 150 kcal/day and re-check in 2 weeks.`, level: 'promising', query: 'energy surplus lean mass gain resistance training', action: { label: 'Apply +150 kcal/day', delta: 150 } });
    } else if (rate > 0.75) {
      recs.push({ title: 'Weight is rising quickly', body: `About ${round(rate, 2)}%/week. A bigger surplus tends to add more fat than muscle, especially for trained people. Consider lowering calories by about 150 kcal/day and check your waist trend.`, level: 'promising', query: 'rate of weight gain fat mass lean mass resistance training', action: { label: 'Apply −150 kcal/day', delta: -150 } });
    } else {
      recs.push({ title: 'Weight trend is on track', body: `About ${round(rate, 2)}%/week, within the usual 0.1–0.75% range. Keep the current plan.`, level: 'practical', query: 'rate of weight gain lean mass resistance training' });
    }
  }
  const bw = [...state.body].sort((x, y) => x.date.localeCompare(y.date));
  const waists = bw.filter(b => b.waist != null), arms = bw.filter(b => b.arm != null), chests = bw.filter(b => b.chest != null);
  if (waists.length >= 2 && waists[waists.length - 1].waist - waists[0].waist >= 2 && ((arms.length < 2 || arms[arms.length - 1].arm - arms[0].arm <= 0.5) && (chests.length < 2 || chests[chests.length - 1].chest - chests[0].chest <= 0.5))) {
    recs.push({ title: 'Waist is growing faster than arms/chest', body: 'Waist up 2 cm or more while arm and chest barely moved suggests the surplus may be going mostly to fat. Check portion accuracy and consider a smaller surplus.', level: 'practical', query: 'energy surplus fat gain lean mass resistance training' });
  }
  const stagnant = [];
  [...new Set(state.logs.map(l => l.name))].forEach(name => {
    const s = state.logs.filter(l => l.name === name && !isDeload(l.week)).sort((x, y) => x.date.localeCompare(y.date)).map(l => Math.max(...l.sets.map(z => e1rm(z.w, z.r))));
    if (s.length >= 3) { const [x, y, z] = s.slice(-3); if (z <= x && z <= y) stagnant.push(name); }
  });
  if (stagnant.length) recs.push({ title: 'Strength has stalled on: ' + stagnant.slice(0, 4).join(', '), body: 'Before adding volume, check in order: calories and protein adherence, sleep, technique and rep range, and total weekly sets per muscle. Only add 1–2 sets per muscle if recovery is good and the other items are in place.', level: 'practical', query: 'resistance training volume muscle hypertrophy' });
  const recent = bw.slice(-5);
  const fat = recent.filter(b => b.fatigue != null);
  if (fat.length >= 3 && avg(fat.map(b => b.fatigue)) >= 4) recs.push({ title: 'Fatigue is high', body: 'Your recent fatigue scores average 4 or more. Consider a deload now (about 40% fewer sets, no failure) instead of waiting for week 4 or 8, and review sleep and calories.', level: 'practical', query: 'overtraining resistance training fatigue recovery' });
  const sl = recent.filter(b => b.sleepH != null);
  if (sl.length >= 3 && avg(sl.map(b => b.sleepH)) < 7) recs.push({ title: 'Sleep looks short', body: `Recent average about ${round(avg(sl.map(b => b.sleepH)), 1)} h/night. Aiming for roughly 7–9 hours supports recovery and training quality.`, level: 'promising', query: 'sleep muscle recovery resistance training' });
  return recs;
}
function renderCoach() {
  if (!state.profile) { $('#view').innerHTML = needProfile(); bindGo(); return; }
  const recs = analyze();
  $('#view').innerHTML = `
  <div class="card"><h2>Coach recommendations</h2>
    <p class="muted">Rules are computed from your own data. The evidence label is my own classification of the topic (not generated from the search). Use "Search the evidence" to open the actual studies on PubMed and judge for yourself.</p>
    <p class="muted">${Object.values(LEVEL_LABEL).join(' · ')}</p></div>
  ${recs.map((r, i) => `<div class="card rec ${r.level}"><h3>${esc(r.title)}</h3><p>${esc(r.body)}</p><p class="muted">${LEVEL_LABEL[r.level]}</p>
    <div class="row">${r.action ? `<button class="primary" data-act="${i}">${esc(r.action.label)}</button>` : ''}<button class="secondary" data-q="${i}">Search the evidence</button></div></div>`).join('')}`;
  $$('[data-act]').forEach(b => b.onclick = () => { const r = recs[+b.dataset.act]; state.profile.calAdjust = (state.profile.calAdjust || 0) + r.action.delta; save(); renderCoach(); });
  $$('[data-q]').forEach(b => b.onclick = () => { const r = recs[+b.dataset.q]; ui.rQuery = r.query; ui.rTopic = null; go('research'); runResearch(r.query, 'Recommendation: ' + r.title, null); });
}

// ---------- research (PubMed E-utilities) ----------
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
const TOPICS = [
  ['Hypertrophy', 'Mechanisms of muscle growth', 'mechanisms muscle hypertrophy resistance exercise'],
  ['Hypertrophy', 'Training volume', 'resistance training volume muscle hypertrophy'],
  ['Hypertrophy', 'Repetitions and load', 'resistance training repetition load muscle hypertrophy'],
  ['Hypertrophy', 'Proximity to failure', 'resistance training failure muscle hypertrophy'],
  ['Hypertrophy', 'Training frequency', 'resistance training frequency muscle hypertrophy'],
  ['Hypertrophy', 'Rest between sets', 'rest interval resistance training hypertrophy'],
  ['Hypertrophy', 'Progressive overload', 'progressive overload resistance training muscle'],
  ['Nutrition', 'Calorie surplus', 'energy surplus lean mass gain resistance training'],
  ['Nutrition', 'Protein intake', 'protein intake resistance training lean mass'],
  ['Nutrition', 'Carbs and fats', 'carbohydrate fat intake resistance training muscle'],
  ['Nutrition', 'Meal timing', 'protein timing distribution muscle resistance training'],
  ['Nutrition', 'Diet quality', 'diet quality muscle mass'],
  ['Nutrition', 'Hydration', 'hydration resistance exercise performance'],
  ['Recovery', 'Sleep', 'sleep muscle recovery resistance training'],
  ['Recovery', 'Rest and recovery', 'recovery between resistance training sessions'],
  ['Recovery', 'Overtraining and fatigue', 'overtraining resistance training fatigue'],
  ['Recovery', 'Mobility and active recovery', 'active recovery muscle soreness'],
  ['Supplements', 'Creatine', 'creatine supplementation resistance training lean mass'],
  ['Supplements', 'Whey protein', 'whey protein supplementation muscle mass'],
  ['Supplements', 'Caffeine', 'caffeine resistance exercise performance'],
  ['Supplements', 'Vitamins and minerals', 'vitamin D supplementation muscle strength'],
  ['Supplements', 'Risks and side effects', 'dietary supplement adverse effects athletes']
].map(([group, title, query], i) => ({ id: 't' + i, group, title, query }));
const TYPE_FILTER = {
  mixed: '(meta-analysis[pt] OR systematic review[pt] OR randomized controlled trial[pt])',
  meta: '(meta-analysis[pt] OR systematic review[pt])', rct: 'randomized controlled trial[pt]', all: ''
};
function tierOf(types) {
  if (types.includes('Meta-Analysis') || types.includes('Systematic Review')) return 1;
  if (types.includes('Randomized Controlled Trial')) return 2;
  if (types.includes('Review')) return 3;
  return 4;
}
const TIER_LABEL = { 1: 'Meta-analysis / systematic review', 2: 'Randomized controlled trial', 3: 'Narrative review', 4: 'Other study type' };
async function pubmedSearch(query, filter, years) {
  let term = `(${query})`;
  if (TYPE_FILTER[filter]) term += ' AND ' + TYPE_FILTER[filter];
  if (years) term += ` AND ("${new Date().getFullYear() - years}"[dp] : "3000"[dp])`;
  const r = await fetch(`${EUTILS}esearch.fcgi?db=pubmed&retmode=json&retmax=15&sort=relevance&tool=muscle-program&term=${encodeURIComponent(term)}`);
  if (!r.ok) throw new Error('esearch ' + r.status);
  const j = await r.json(); const ids = j.esearchresult.idlist || [];
  if (!ids.length) return { count: 0, items: [] };
  await sleep(350);
  const s = await fetch(`${EUTILS}esummary.fcgi?db=pubmed&retmode=json&tool=muscle-program&id=${ids.join(',')}`);
  if (!s.ok) throw new Error('esummary ' + s.status);
  const sj = await s.json();
  const items = ids.map(id => {
    const d = sj.result[id]; if (!d) return null; const au = d.authors || [];
    return {
      pmid: id, title: d.title, authors: au.slice(0, 3).map(a => a.name).join(', ') + (au.length > 3 ? ' et al.' : ''),
      journal: d.fulljournalname || d.source, date: d.pubdate, types: d.pubtype || [],
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, doi: (d.articleids || []).find(a => a.idtype === 'doi')?.value || null
    };
  }).filter(Boolean).sort((a, b) => tierOf(a.types) - tierOf(b.types));
  return { count: +j.esearchresult.count || items.length, items };
}
async function fetchAbstract(pmid) {
  const r = await fetch(`${EUTILS}efetch.fcgi?db=pubmed&id=${pmid}&rettype=abstract&retmode=xml&tool=muscle-program`);
  const x = new DOMParser().parseFromString(await r.text(), 'text/xml');
  return [...x.querySelectorAll('AbstractText')].map(n => { const l = n.getAttribute('Label'); return (l ? l + ': ' : '') + n.textContent; }).join('\n\n') || 'No abstract available for this record.';
}
function renderResearch() {
  const groups = [...new Set(TOPICS.map(t => t.group))];
  $('#view').innerHTML = `
  <div class="card"><h2>Scientific library</h2>
    <p class="muted">Live search of PubMed through the official NCBI E-utilities API. Results are never generated or invented: every reference below comes from PubMed with its link. A keyword search is a starting point, not an exhaustive review of the literature; read the studies and prefer converging evidence from meta-analyses.</p>
    <div class="row">
      <label class="row"><span class="muted">Study type</span><select id="rf">
        <option value="mixed" ${ui.rFilter === 'mixed' ? 'selected' : ''}>Meta-analyses, reviews and RCTs</option>
        <option value="meta" ${ui.rFilter === 'meta' ? 'selected' : ''}>Meta-analyses and systematic reviews</option>
        <option value="rct" ${ui.rFilter === 'rct' ? 'selected' : ''}>Randomized controlled trials</option>
        <option value="all" ${ui.rFilter === 'all' ? 'selected' : ''}>All types</option></select></label>
      <label class="row"><span class="muted">Published</span><select id="ry">
        <option value="5" ${ui.rYears == 5 ? 'selected' : ''}>Last 5 years</option><option value="10" ${ui.rYears == 10 ? 'selected' : ''}>Last 10 years</option><option value="0" ${ui.rYears == 0 ? 'selected' : ''}>Any date (includes classics)</option></select></label>
    </div>
    <div class="row"><input id="rq" placeholder="Custom search (e.g. creatine loading phase)" value="${esc(ui.rQuery)}" style="flex:1"><button class="primary" id="rs">Search</button></div>
    ${groups.map(g => `<h3>${g}</h3><div class="chips">${TOPICS.filter(t => t.group === g).map(t => `<button class="chip ${ui.rTopic === t.id ? 'active' : ''}" data-t="${t.id}">${esc(t.title)}${state.library[t.id] ? ' ✓' : ''}</button>`).join('')}</div>`).join('')}
    <div class="row"><button class="secondary" id="ua">Update all topics</button><span class="muted" id="uas"></span></div>
    <p class="muted">Other sources: <a href="https://www.ncbi.nlm.nih.gov/" target="_blank" rel="noopener">NCBI</a> · <a href="https://www.sportsnutritionsociety.org/" target="_blank" rel="noopener">International Society of Sports Nutrition</a> · <a href="https://examine.com/" target="_blank" rel="noopener">Examine</a> · <a href="https://www.strongerbyscience.com/" target="_blank" rel="noopener">Stronger By Science</a>. These last three have no free public API, so they are linked, not searched automatically.</p>
  </div>
  <div id="rres"></div>`;
  $('#rf').onchange = e => ui.rFilter = e.target.value;
  $('#ry').onchange = e => ui.rYears = +e.target.value;
  $('#rs').onclick = () => { const q = $('#rq').value.trim(); if (!q) return; ui.rQuery = q; ui.rTopic = null; runResearch(q, 'Custom search', null); };
  $('#rq').onkeydown = e => { if (e.key === 'Enter') $('#rs').click(); };
  $$('[data-t]').forEach(b => b.onclick = () => {
    const t = TOPICS.find(x => x.id === b.dataset.t); ui.rTopic = t.id; ui.rQuery = t.query;
    const c = state.library[t.id]; const fresh = c && c.filter === ui.rFilter && c.years === ui.rYears && (Date.now() - new Date(c.updated)) < 7 * 86400000;
    $$('.chip').forEach(x => x.classList.toggle('active', x === b));
    if (fresh) showResults(c, t.title); else runResearch(t.query, t.title, t.id);
  });
  $('#ua').onclick = async () => {
    const s = $('#uas');
    for (let i = 0; i < TOPICS.length; i++) {
      const t = TOPICS[i]; s.textContent = `Updating ${i + 1}/${TOPICS.length}: ${t.title}…`;
      try { const r = await pubmedSearch(t.query, ui.rFilter, ui.rYears); state.library[t.id] = { updated: new Date().toISOString(), filter: ui.rFilter, years: ui.rYears, query: t.query, ...r }; save(); }
      catch (e) { s.textContent = 'Stopped: PubMed unreachable or rate-limited. Try again later.'; return; }
      await sleep(700);
    }
    s.textContent = 'Library updated.'; renderResearch();
  };
  if (ui.rTopic && state.library[ui.rTopic]) showResults(state.library[ui.rTopic], TOPICS.find(t => t.id === ui.rTopic).title);
}
async function runResearch(query, label, topicId) {
  const box = $('#rres'); if (!box) return;
  box.innerHTML = `<div class="card"><p class="muted">Searching PubMed for “${esc(query)}”…</p></div>`;
  try {
    const r = await pubmedSearch(query, ui.rFilter, ui.rYears);
    const data = { updated: new Date().toISOString(), filter: ui.rFilter, years: ui.rYears, query, ...r };
    if (topicId) { state.library[topicId] = data; save(); }
    if (activeTab === 'research') showResults(data, label);
  } catch (e) {
    if (activeTab === 'research' && $('#rres')) $('#rres').innerHTML = `<div class="card"><p>Could not reach PubMed (offline, blocked or rate-limited). Please try again in a moment.</p></div>`;
  }
}
function showResults(data, label) {
  const box = $('#rres'); if (!box) return;
  box.innerHTML = `<div class="card"><h2>${esc(label)}</h2>
    <p class="muted">${data.count} matching records on PubMed, showing the top ${data.items.length} (highest evidence type first). Last updated ${new Date(data.updated).toLocaleDateString()}. Query: ${esc(data.query)}</p>
    ${data.items.length ? data.items.map((it, i) => { const tier = tierOf(it.types); return `<div class="paper"><span class="badge t${tier}">${TIER_LABEL[tier]}</span><br>
      <a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a><br>
      <span class="muted">${esc(it.authors)} · ${esc(it.journal)} · ${esc(it.date)} · PMID ${esc(it.pmid)}${it.doi ? ` · DOI ${esc(it.doi)}` : ''}</span><br>
      <button class="small" data-ab="${i}">Show abstract</button><div id="ab${i}">${it.abstract ? `<pre>${esc(it.abstract)}</pre>` : ''}</div></div>`; }).join('') : '<p>No results. Try widening the study type or date range.</p>'}
    <p class="muted">Study design is a rough guide to evidence quality, not a verdict: results still depend on population, dose and methods.</p></div>`;
  $$('[data-ab]', box).forEach(b => b.onclick = async () => {
    const it = data.items[+b.dataset.ab]; const out = $('#ab' + b.dataset.ab);
    if (!it.abstract) { out.innerHTML = '<span class="muted">Loading…</span>'; try { it.abstract = await fetchAbstract(it.pmid); save(); } catch (e) { out.innerHTML = '<span class="muted">Could not load the abstract.</span>'; return; } }
    out.innerHTML = `<pre>${esc(it.abstract)}</pre>`;
  });
}

// ---------- boot ----------
buildNav();
render();