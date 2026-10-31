/* SmarttechCN 2026 – Ứng dụng trí tuệ nhân tạo và điện toán đám mây hỗ trợ dạy học, kiểm tra, đánh giá năng lực học sinh môn Công nghệ công nghiệp cấp THPT */
(() => {
'use strict';
const CFG = window.STC_CONFIG || {};
const API = String(CFG.API_URL || '').trim();
const DEMO = !API;
const V = document.getElementById('view');
const LETTERS = 'ABCD';
const TF_POINTS = [0, 0.1, 0.25, 0.5, 1];

/* ================= Lưu trữ an toàn ================= */
const store = {
  get(k, d) { try { const v = localStorage.getItem('stc_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('stc_' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem('stc_' + k); } catch (e) {} }
};
let session = store.get('session', null);
const uid = () => (session && session.user && (session.user.MaHS || session.user.MaGV)) || 'demo';
/** lưu kết quả bài vừa làm + giữ lại 20 bài gần nhất trên máy để em xem lại bất cứ lúc nào */
function saveLast(L) {
  store.set('last', L);
  if (!L || !L.attemptId) return;
  const k = 'rv_' + uid(), a = store.get(k, []).filter(x => x.attemptId !== L.attemptId);
  const keep = Object.assign({}, L, { t: L.t || Date.now() }); delete keep.rank;
  a.push(keep); store.set(k, a.slice(-20));
}
function isGV() { return Boolean(session && (session.role === 'gv' || session.role === 'admin')); }

/* ================= Tiện ích ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => (Math.round(n * 100) / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
/** sắp xếp tên tiếng Việt theo vần A–B: so sánh TÊN (chữ cuối) trước, rồi họ đệm */
const viName = s => { const w = String(s || '').trim().split(/\s+/); return [w[w.length - 1] || '', w.slice(0, -1).join(' ')]; };
const viNameCmp = (a, b) => { const x = viName(a), y = viName(b); return x[0].localeCompare(y[0], 'vi', { sensitivity: 'base' }) || x[1].localeCompare(y[1], 'vi', { sensitivity: 'base' }) || String(a).localeCompare(String(b), 'vi'); };
const mmss = s => { s = Math.max(0, Math.round(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const dt = t => { if (!t) return ''; const d = new Date(t); return isNaN(d) ? String(t) : d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }); };
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms); }
function plain(html) { const d = document.createElement('div'); d.innerHTML = sanitize(html); return d.textContent.replace(/\s+/g, ' ').trim(); }

/* Lọc HTML trong ngân hàng (chỉ giữ thẻ định dạng an toàn) */
const OKT = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'SUB', 'SUP', 'BR', 'IMG', 'SPAN', 'TABLE', 'TBODY', 'THEAD', 'TR', 'TD', 'TH', 'P', 'UL', 'OL', 'LI', 'CODE', 'PRE']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'SVG', 'MATH']);
function driveImg(s) { const m = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/.exec(s); return m ? 'https://lh3.googleusercontent.com/d/' + m[1] : s; }
function walk(node) {
  [...node.childNodes].forEach(n => {
    if (n.nodeType === 8) { n.remove(); return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName;
    if (DROP.has(tag)) { n.remove(); return; }
    if (!OKT.has(tag)) { walk(n); n.replaceWith(...n.childNodes); return; }
    [...n.attributes].forEach(a => {
      const k = a.name.toLowerCase();
      const keep = tag === 'IMG' ? ['src', 'width', 'height', 'class', 'alt'].includes(k)
        : (tag === 'SPAN' && k === 'class' && /^math (inline|display)$/.test(a.value)) || ((tag === 'TD' || tag === 'TH') && (k === 'colspan' || k === 'rowspan'));
      if (!keep) n.removeAttribute(a.name);
    });
    if (tag === 'IMG') {
      const s = driveImg(n.getAttribute('src') || '');
      if (!/^(img\/[\w.\-]+|https:\/\/[^\s"'<>]+|data:image\/(png|webp|jpeg|gif);base64,[A-Za-z0-9+\/=]+)$/.test(s)) { n.remove(); return; }
      n.setAttribute('src', s); n.setAttribute('loading', 'lazy'); n.setAttribute('alt', n.getAttribute('alt') || '');
      if (!n.getAttribute('class')) n.setAttribute('class', 'pic');
    }
    walk(n);
  });
}
function sanitize(html) { const t = document.createElement('template'); t.innerHTML = String(html == null ? '' : html); walk(t.content); return t.innerHTML; }
function math(el) {
  if (window.renderMathInElement) {
    try { window.renderMathInElement(el, { delimiters: [{ left: '\\(', right: '\\)', display: false }, { left: '\\[', right: '\\]', display: true }], throwOnError: false, strict: false }); } catch (e) {}
  } else if (!math._wait) { math._wait = 1; window.addEventListener('load', () => { math._wait = 0; math(V); }, { once: true }); }
}

/* ================= Máy chủ ================= */
async function api(action, data = {}) {
  if (DEMO) throw new Error('Chế độ dùng thử chưa kết nối máy chủ');
  const ctl = new AbortController();
  // AI soạn câu, chấm tự luận, chấm bài vẽ, phân tích kết quả có thể mất 1–2 phút (Google bận thì máy chủ tự thử lại)
  const timer = setTimeout(() => ctl.abort(), /^(ai_|submit|grade_drawing|generate_exam)/.test(action) ? 240000 : 30000);
  let res;
  try {
    res = await fetch(API, { method: 'POST', body: JSON.stringify(Object.assign({ action, token: session && session.token }, data)), signal: ctl.signal, redirect: 'follow' });
  } catch (e) {
    const err = new Error(navigator.onLine ? 'Không kết nối được máy chủ, hãy thử lại' : 'Đang mất mạng'); err.network = true; throw err;
  } finally { clearTimeout(timer); }
  let j;
  try { j = await res.json(); } catch (e) { const err = new Error('Máy chủ trả lời không hợp lệ'); err.network = true; throw err; }
  if (!j.ok) {
    const err = new Error(j.error || 'Lỗi máy chủ');
    if (/Phiên đăng nhập/.test(err.message)) { err.auth = true; logout(true, /^#\/(ketquabai|lambai)/.test(location.hash)); }
    throw err;
  }
  return j.data;
}

/* ================= Ngân hàng câu hỏi ================= */
const bank = { v: null, q: [], byId: {} };
function setBank(b) {
  bank.v = b.v; bank.q = b.q || []; bank.byId = {};
  bank.q.forEach(q => { bank.byId[q.id] = q; });
}
async function loadBank() {
  const local = store.get('bank', null);
  if (local && local.q && local.q.length) setBank(local);
  else {
    try { const r = await fetch('bank.json', { cache: 'no-cache' }); setBank(await r.json()); store.set('bank', { v: bank.v, q: bank.q }); }
    catch (e) { toast('Chưa tải được ngân hàng câu hỏi'); }
  }
  syncBank();
}
async function syncBank(force) {
  if (DEMO || !navigator.onLine) return false;
  try {
    const { v } = await api('bankVersion');
    if (v !== bank.v || force) {
      const b = await api('getBank');
      if (b.q && b.q.length) { setBank(b); store.set('bank', { v: b.v, q: b.q }); return true; }
    }
  } catch (e) {}
  return false;
}
const deList = () => [...new Set(bank.q.map(q => q.de))].filter(d => /^Đề/.test(d)).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));

const lessonsOf = k => {
  if (k === '10') {
    return [...new Set(bank.q.filter(q => q.k === '10').map(q => q.bai || q.cd))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
  }
  return [...new Set(bank.q.filter(q => q.k === k && /^Bài \d+/.test(q.bai)).map(q => q.bai))].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
};

const topicsOf = k => [...new Set(bank.q.filter(q => !k || q.k === k).map(q => q.cd))].sort((a, b) => a.localeCompare(b, 'vi'));

function lessonPackages(k) {
  const grades = k ? [String(k)] : ['10', '11', '12'];
  const res = [];
  grades.forEach(g => {
    if (g === '10') {
      const baiNames = [...new Set(bank.q.filter(q => q.k === '10').map(q => q.bai || q.cd))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
      baiNames.forEach(b => {
        const qs = bank.q.filter(q => q.k === '10' && (q.bai === b || (!q.bai && q.cd === b)));
        if (qs.length) {
          res.push({
            id: 'K10_' + b.replace(/[^\wÀ-ỹ]+/g, '_'),
            key: 'BAI:10:' + b,
            khoi: '10',
            name: 'Khối 10 – ' + b,
            shortName: b,
            count: qs.length,
            ids: qs.map(q => q.id)
          });
        }
      });
    } else {
      const baiNames = [...new Set(bank.q.filter(q => q.k === g && /^Bài \d+/.test(q.bai)).map(q => q.bai))].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
      baiNames.forEach(b => {
        const qs = bank.q.filter(q => q.k === g && q.bai === b);
        if (qs.length) {
          res.push({
            id: 'K' + g + '_' + b.replace(/[^\wÀ-ỹ]+/g, '_'),
            key: 'BAI:' + g + ':' + b,
            khoi: g,
            name: 'Lớp ' + g + ' – ' + b,
            shortName: b,
            count: qs.length,
            ids: qs.map(q => q.id)
          });
        }
      });
    }
  });
  return res;
}

function getStudentGrade() {
  if (session && session.role === 'hs' && session.user && session.user.Khoi) {
    return String(session.user.Khoi);
  }
  return store.get('chosen_grade', '12');
}

function getAllowedGrades() {
  const g = getStudentGrade();
  if (g === '10') return ['10'];
  if (g === '11') return ['11'];
  return ['10', '11', '12'];
}

function matrixPick() {
  const slots = {};
  bank.q.forEach(q => { const m = /^DE\d+_(C\d+|DS\d+)$/.exec(q.id); if (m) (slots[m[1]] = slots[m[1]] || []).push(q.id); });
  return Object.keys(slots).map(k => slots[k][rnd(slots[k].length)]);
}

/* ================= Chấm điểm (giống máy chủ) ================= */
function normAns(q) { return q.t === 'T' ? String(q.a).replace(/[\s,]/g, '').toUpperCase().replace(/D/g, 'Đ') : String(q.a).trim().toUpperCase(); }
function respStr(q, r) { if (q.t === 'T') return (r || []).map(x => x || '-').join('').padEnd(4, '-'); if (q.t === 'L') return String(r || '').slice(0, 3000); return r || ''; }
const TYPE_NAME = { M: 'Trắc nghiệm nhiều lựa chọn', T: 'Đúng/Sai', L: 'Tự luận' };
const TYPE_ICON = { M: '🔘', T: '✅', L: '✍️' };
const STD_MD = ['Biết', 'Hiểu', 'Vận dụng'];
function hasImg(q) { return /<img/i.test(String(q.s) + (q.o || []).join('')); }
/** ước lượng thời gian làm (phút): TN 1,25 – Đ/S 2,5 – tự luận 6 */
function estMin(ids) { return Math.max(5, Math.ceil(ids.reduce((s, id) => { const q = bank.byId[id]; return s + (!q ? 0 : q.t === 'L' ? 6 : q.t === 'T' ? 2.5 : 1.25); }, 0))); }
/** chấm điểm; câu tự luận dùng kết quả AI/tự chấm trong tl, chưa có thì không tính vào điểm */
function grade(ids, resp, tl = {}, tlw = 0) {
  let got = 0, max = 0, dung = 0; const sai = [], detail = {}, pending = [];
  const nTL = tlw ? ids.filter(id => bank.byId[id] && bank.byId[id].t === 'L').length : 0;
  ids.forEach(id => {
    const q = bank.byId[id]; if (!q) return;
    const a = normAns(q), r = respStr(q, resp[id]);
    if (q.t === 'L') {
      const x = tl[id];
      if (!x || x.cho_cham) { detail[id] = { ok: false, pending: true }; pending.push(id); return; }
      const mx0 = +x.max || q.p || 1, d0 = Math.max(0, Math.min(mx0, +x.diem || 0));
      const mx = nTL ? tlw / nTL : mx0, d = nTL ? d0 / mx0 * mx : d0;
      max += mx; got += d; const ok = d >= mx * 0.8; if (ok) dung++; else sai.push(id); detail[id] = { ok, k: d, mx };
    }
    else if (q.t === 'M') { max += 0.25; const ok = r === a; if (ok) { got += 0.25; dung++; } else sai.push(id); detail[id] = { ok, k: ok ? 1 : 0 }; }
    else { max += 1; let k = 0; for (let i = 0; i < 4; i++) if (r[i] === a[i]) k++; got += TF_POINTS[k]; if (k === 4) dung++; else sai.push(id); detail[id] = { ok: k === 4, k }; }
  });
  return { diem: max ? Math.round(got / max * 1000) / 100 : 0, dung, tong: ids.filter(id => bank.byId[id]).length - pending.length, sai, detail, pending };
}
/** ghép kết quả chấm tự luận (AI hoặc tự chấm) vào lượt làm, cập nhật điểm, lịch sử, sổ tay */
function applyTL(L, tl) {
  L.tl = Object.assign({}, L.tl || {}, tl || {});
  const g = grade(L.ids, L.resp, L.tl, L.tlw || 0);
  Object.assign(L, { diem: g.diem, dung: g.dung, tong: g.tong, sai: g.sai, detail: g.detail, pendingTL: g.pending.length ? g.pending : null });
  const hk = 'hist_' + uid(), hist = store.get(hk, []), h = hist.find(x => x.attemptId === L.attemptId);
  if (h) { h.diem = g.diem; h.dung = g.dung; h.tong = g.tong; store.set(hk, hist); }
  const wk = 'wrong_' + uid(), w = store.get(wk, {});
  Object.keys(tl || {}).forEach(id => { const d = g.detail[id]; if (!d || d.pending) return; if (d.ok) { if (w[id] != null) { w[id]++; if (w[id] >= 2) delete w[id]; } } else w[id] = 0; });
  store.set(wk, w);
  return L;
}

/* ================= Hàng chờ nộp bài (offline) ================= */
let flushing = false;
async function flush() {
  if (DEMO || flushing || !session || session.role !== 'hs' || !navigator.onLine) return;
  flushing = true;
  try {
    let q = store.get('queue', []);
    while (q.length) {
      const item = q[0];
      try {
        const r = await api('submit', { result: item });
        const last = store.get('last', null);
        if (last && last.attemptId === item.attemptId) { last.rank = r; last.synced = true; if (r && r.tl && Object.keys(r.tl).length) applyTL(last, r.tl); saveLast(last); }
        document.dispatchEvent(new CustomEvent('synced', { detail: { attemptId: item.attemptId, rank: r } }));
      } catch (e) {
        if (e.network) break;
        if (e.auth) { // hết phiên: giữ bài trong hàng chờ, KHÔNG rời trang kết quả; đăng nhập lại sẽ tự gửi
          const last = store.get('last', null);
          if (last && last.attemptId === item.attemptId) { last.syncError = 'Phiên đăng nhập đã hết hạn nên điểm chưa được lưu lên máy chủ. Em cứ xem lại bài bình thường, sau đó đăng nhập lại – bài sẽ tự gửi.'; saveLast(last); }
          document.dispatchEvent(new CustomEvent('synced', { detail: { attemptId: item.attemptId, error: last && last.syncError } }));
          break;
        }
        toast('Không nộp được: ' + e.message, 4000);
        const last = store.get('last', null);
        if (last && last.attemptId === item.attemptId) { last.syncError = e.message; saveLast(last); }
        document.dispatchEvent(new CustomEvent('synced', { detail: { attemptId: item.attemptId, error: e.message } }));
      }
      q = store.get('queue', []); q.shift(); store.set('queue', q);
    }
  } finally { flushing = false; netBadge(); }
}
function netBadge() {
  const el = $('#net'); const q = store.get('queue', []).length;
  if (!navigator.onLine) { el.textContent = 'Ngoại tuyến' + (q ? ' · ' + q + ' bài chờ' : ''); el.className = 'net off'; }
  else if (q) { el.textContent = q + ' bài chờ gửi'; el.className = 'net off'; }
  else { el.textContent = DEMO ? 'Dùng thử' : 'Trực tuyến'; el.className = 'net'; }
}
window.addEventListener('online', () => { netBadge(); flush(); syncBank(); });
window.addEventListener('offline', netBadge);

/* ================= Phiên đăng nhập & menu ================= */
function setSession(s) { session = s; store.set('session', s); renderMenu(); }
function logout(expired, stay) {
  // giữ bài xem lại của tài khoản trước khi xoá phiên
  const old = uid(), rv = store.get('rv_' + old, null);
  session = null; store.del('session'); renderMenu();
  if (rv && old !== 'demo') store.set('rv_demo', rv);
  if (stay) { toast('Phiên đăng nhập đã hết hạn. Em vẫn xem lại bài được; đăng nhập lại để lưu điểm.', 5000); return; }
  if (expired) toast('Phiên đăng nhập đã hết hạn, hãy đăng nhập lại');
  location.hash = '#/dangnhap';
}
/* ---------- Thanh điều hướng dưới (điện thoại) / bên trái (máy tính) ---------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
  learn: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8 7.5h8M8 11h6"/>',
  task: '<rect x="4" y="3.5" width="16" height="18" rx="2.5"/><path d="M8.5 3.5V2M15.5 3.5V2"/><path d="m8.5 13 2.2 2.2L15.5 10.5"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  send: '<path d="M21 3 10 14"/><path d="m21 3-7 18-4-7-7-4z"/>',
  bank: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/><path d="M4 11.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'
};
let tabDot = 0;
function setTabDot(n) { tabDot = n; const d = $('#tabbar [data-dot]'); if (d) { d.textContent = n > 9 ? '9+' : n; d.hidden = !n; } }
function renderNav(path) {
  const nav = $('#tabbar'); if (!nav) return;
  const focus = /^\/(lambai|dangnhap|dangky|dangkygv|quenmk|doimk|cham\/)/.test(path) || (!session && !DEMO);
  document.body.classList.toggle('focus', focus);
  const items = isGV()
    ? [['#/gv', 'grid', 'Trang chủ', /^\/(gv|hcvg|hcat|hctd|hcpc|hinhchieu|gocchieu|trochoi|sgk|thitn)$|^\/gv\/(matran|sinhde|dethi|baive|thietke|aisoancau|themcau|nganhang|thitn)/], ['#/gv/lop', 'home', 'Các lớp', /^\/gv\/(lop|hs|taolop)/], ['#/gv/diem', 'chart', 'Điểm', /^\/gv\/diem/], ['#/gv/giaobai', 'send', 'Giao bài', /^\/gv\/(giaobai|baigiao|bai\/)/]]
    : [['#/', 'home', 'Trang chủ', /^\/$/], ['#/onluyen', 'learn', 'Ôn luyện', /^\/(onluyen|chude|de|dinhki|sgk|sotay|hinhchieu|gocchieu|hcvg|hcat|hctd|trochoi|thitn)/], ['#/baigiao', 'task', 'Bài giao', /^\/(baigiao|baive)/], ['#/ketqua', 'chart', 'Kết quả', /^\/(ketqua|ketquabai|bxh)/]];
  nav.hidden = false;
  nav.innerHTML = items.map(([h, ic, t, re]) => `<a href="${h}" class="${re.test(path) ? 'on' : ''}"${re.test(path) ? ' aria-current="page"' : ''}><span class="tico"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[ic]}</svg></span>${t}${ic === 'task' && !isGV() ? `<span class="dot" data-dot${tabDot ? '' : ' hidden'}>${tabDot > 9 ? '9+' : tabDot}</span>` : ''}</a>`).join('');
}
function renderMenu() {
  const btn = $('#menuBtn'), m = $('#menu');
  btn.hidden = false;
  btn.textContent = session ? (String(session.user.HoTen || '?').trim().split(' ').slice(-1)[0][0] || '?').toUpperCase() : '☰';
  if (!session) {
    m.innerHTML = DEMO ? '<div class="who"><b>Chế độ dùng thử</b>Chưa kết nối máy chủ</div><a href="#/">Trang chủ</a>'
      : '<div class="who"><b>Chưa đăng nhập</b></div><a href="#/">Trang chủ</a><a href="#/dangnhap" style="font-weight:700;color:var(--brand2)">🎓 Học sinh đăng nhập</a><a href="#/dangnhap?gv=1">👨‍🏫 Giáo viên đăng nhập</a><a href="#/dangkygv">Đăng ký Giáo viên mới</a>';
    return;
  }
  const u = session.user;
  const hs = session.role === 'hs';
  m.innerHTML = `<div class="who"><b>${esc(u.HoTen)}</b>${hs ? esc(u.TenLop + ' · ' + u.Truong) : esc(u.Email + (session.role === 'admin' ? ' (Admin)' : ' (GV)'))}</div>
    <a href="#/">Trang chủ</a>
    ${hs ? '<a href="#/hoso">Hồ sơ của em</a><a href="#/ketqua">Kết quả của em</a>' : '<a href="#/gv">👨‍🏫 Bàn làm việc Giáo viên</a><a href="#/?role=hs">🎓 Màn hình Học sinh</a><a href="#/gv/nganhang">Ngân hàng câu hỏi</a>' + (session.role === 'admin' ? '<a href="#/admin">Quản trị</a>' : '')}
    <a href="#/doimk">Đổi mật khẩu</a>
    <button data-out>Đăng xuất</button>`;
  $('[data-out]', m).onclick = () => { m.hidden = true; logout(); };
}
$('#menuBtn').onclick = e => { e.stopPropagation(); $('#menu').hidden = !$('#menu').hidden; };
document.addEventListener('click', e => { if (!e.target.closest('#menu')) $('#menu').hidden = true; });

/* ================= Bộ định tuyến ================= */
let cleanup = null;
const routes = [];
const route = (re, fn) => routes.push([re, fn]);
function render() {
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  $('#menu').hidden = true;
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = hash.split('?');
  renderNav(path);
  const params = new URLSearchParams(qs || '');
  if (!DEMO && !session && !/^\/(dangnhap|dangky|dangkygv|quenmk)/.test(path)) { if (path !== '/') store.set('next', location.hash); location.hash = '#/dangnhap' + (params.get('lop') ? '?lop=' + params.get('lop') : ''); return; }
  if (session && session.role === 'hs' && session.user.DoiMK && path !== '/doimk') { location.hash = '#/doimk'; return; }
  for (const [re, fn] of routes) {
    const m = re.exec(path);
    if (m) { window.scrollTo(0, 0); fn(params, ...m.slice(1).map(decodeURIComponent)); return; }
  }
  location.hash = '#/';
}
window.addEventListener('hashchange', render);
function setView(html) { V.innerHTML = html; math(V); }
function errBox(el, e) { if (!el) return; el.innerHTML = `<div class="err">${esc(e.message || e)}</div>`; }
async function busy(btn, fn) {
  const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = 'Đang xử lý…';
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = old; }
}

/* ================= Đăng nhập / đăng ký ================= */
route(/^\/dangnhap$/, params => {
  if (session) { location.hash = '#/'; return; }
  let tab = params.get('gv') ? 'gv' : 'hs';
  const draw = () => {
    setView(`<div class="auth">
      <div class="hero"><h1>SmarttechCN 2026</h1><p class="sub herosub">Trợ lý dạy học và kiểm tra, đánh giá môn CNCN cấp THPT</p></div>
      <div class="tabs"><button data-t="hs" class="${tab === 'hs' ? 'on' : ''}">Học sinh</button><button data-t="gv" class="${tab === 'gv' ? 'on' : ''}">Giáo viên</button></div>
      <form class="card" id="f">
        ${tab === 'hs' ? `<label for="u">Tên đăng nhập</label><input id="u" type="text" autocomplete="username" autocapitalize="none" required placeholder="Tên tài khoản cá nhân (vd: an12pd)"><div class="hint" style="margin-top:-4px;margin-bottom:8px">💡 <i>Lưu ý: Không nhập mã lớp vào đây. Nếu chưa có tài khoản, bấm dòng xanh bên dưới để đăng ký bằng mã chung.</i></div>`
          : `<label for="u">Email</label><input id="u" type="email" autocomplete="username" required>`}
        <label for="p">Mật khẩu</label><input id="p" type="password" autocomplete="current-password" required>
        <div id="msg"></div>
        <div style="margin-top:14px"><button class="btn block">Đăng nhập</button></div>
        <p style="text-align:right;margin:10px 0 0"><a href="#/quenmk${tab === 'gv' ? '?gv=1' : ''}">Quên mật khẩu?</a></p>
      </form>
      <p class="sub" style="text-align:center">${tab === 'hs' ? `Chưa có tài khoản? <a href="#/dangky${params.get('lop') ? '?lop=' + esc(params.get('lop')) : ''}">Đăng ký tài khoản mới</a>` : 'Giáo viên mới? <a href="#/dangkygv">Đăng ký tài khoản giáo viên</a>'}</p>
    </div>`);
    $$('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
    $('#f').onsubmit = async e => {
      e.preventDefault();
      const btn = $('#f .btn');
      await busy(btn, async () => {
        try {
          const s = tab === 'hs' ? await api('login_hs', { username: $('#u').value, password: $('#p').value })
            : await api('login_gv', { email: $('#u').value, password: $('#p').value });
          setSession(s); flush(); const nx = store.get('next', ''); store.del('next'); location.hash = nx || '#/';
        } catch (err) {
          const msg = (tab === 'hs' && (err.message || '').includes('Sai tên đăng nhập hoặc mật khẩu'))
            ? 'Sai tên đăng nhập hoặc mật khẩu. Lưu ý: Tên đăng nhập là tài khoản cá nhân của em (không phải mã lớp). Nếu em chưa có tài khoản, hãy bấm “Đăng ký tài khoản mới” bên dưới.'
            : err;
          errBox($('#msg'), msg);
        }
      });
    };
  };
  draw();
});

route(/^\/quenmk$/, params => {
  const gv = !!params.get('gv');
  let id = '';
  const step1 = () => {
    setView(`<div class="auth"><h1>Quên mật khẩu</h1><p class="sub">${gv ? 'Nhập email đã đăng kí, hệ thống sẽ gửi <b>mã 6 số</b> về email đó.' : 'Nhập <b>tên đăng nhập</b> của em. Mã 6 số sẽ được gửi về email em đã khai trong Hồ sơ.'}</p>
      <form class="card" id="f">
        <label for="u">${gv ? 'Email giáo viên' : 'Tên đăng nhập'}</label><input id="u" type="${gv ? 'email' : 'text'}" autocapitalize="none" required value="${esc(id)}">
        <div id="msg"></div><div style="margin-top:14px"><button class="btn block">Gửi mã về email</button></div>
        ${gv ? '' : '<p class="hint" style="margin-top:10px">Chưa khai email? Em hãy nhờ thầy/cô chủ nhiệm bấm <b>Đặt lại MK</b> trong trang lớp học.</p>'}
      </form><p class="sub" style="text-align:center"><a href="#/dangnhap${gv ? '?gv=1' : ''}">← Quay lại đăng nhập</a></p></div>`);
    $('#f').onsubmit = async e => {
      e.preventDefault();
      await busy($('#f .btn'), async () => {
        try { id = $('#u').value.trim(); const r = await api('forgot_pw', { role: gv ? 'gv' : 'hs', id }); step2(r.to); }
        catch (err) { errBox($('#msg'), err); }
      });
    };
  };
  const step2 = to => {
    setView(`<div class="auth"><h1>Nhập mã xác nhận</h1><p class="sub">Đã gửi mã 6 số tới <b>${esc(to)}</b>. Mở email (xem cả mục <i>Spam / Quảng cáo</i>), nhập mã và đặt mật khẩu mới. Mã có hiệu lực 15 phút.</p>
      <form class="card" id="f">
        <label for="c">Mã xác nhận</label><input id="c" type="text" inputmode="numeric" maxlength="6" required autocomplete="one-time-code" style="font-size:22px;letter-spacing:6px;text-align:center">
        <label for="p1">Mật khẩu mới</label><input id="p1" type="password" required minlength="6" autocomplete="new-password" placeholder="Tối thiểu 6 kí tự">
        <label for="p2">Nhập lại mật khẩu mới</label><input id="p2" type="password" required minlength="6" autocomplete="new-password">
        <div id="msg"></div><div style="margin-top:14px"><button class="btn block">Đặt mật khẩu mới</button></div>
        <p style="text-align:center;margin-top:10px"><a href="javascript:void 0" id="again">Chưa nhận được mã? Gửi lại</a></p>
      </form></div>`);
    $('#again').onclick = step1;
    $('#f').onsubmit = async e => {
      e.preventDefault();
      if ($('#p1').value !== $('#p2').value) { errBox($('#msg'), 'Hai lần nhập mật khẩu không giống nhau'); return; }
      await busy($('#f .btn'), async () => {
        try {
          const s = await api('reset_pw', { role: gv ? 'gv' : 'hs', id, code: $('#c').value, newPw: $('#p1').value });
          setSession(s); flush(); toast('Đã đặt mật khẩu mới và đăng nhập'); location.hash = '#/';
        } catch (err) { errBox($('#msg'), err); }
      });
    };
  };
  step1();
});

route(/^\/dangky$/, params => {
  if (params.get('lop') && params.get('cach') !== 'machung') return registerByClassCode(params);
  let classes = null, common = '', khoi = '';
  setView(`<div class="auth"><h1>Đăng ký tài khoản học sinh</h1><p class="sub">Nhập <b>mã chung</b> thầy/cô cung cấp, sau đó chọn lớp và tự đặt mật khẩu.</p>
    <form class="card" id="f1">
      <label for="mc">Mã chung</label><input id="mc" type="text" maxlength="20" autocapitalize="characters" autocomplete="off" required placeholder="vd: PD2026">
      <div id="msg1"></div>
      <div style="margin-top:14px"><button class="btn block">Tiếp tục</button></div>
    </form>
    <form class="card" id="f" hidden>
      <label>Khối</label><div class="tabs" id="kh" style="margin:4px 0 10px">${['10', '11', '12'].map(k => `<button type="button" data-k="${k}">Khối ${k}</button>`).join('')}</div>
      <label for="lop">Lớp</label><select id="lop" disabled><option value="">— Chọn khối trước —</option></select>
      <div id="newwrap" hidden><label for="nl">Tên lớp của em</label><input id="nl" type="text" maxlength="15" autocapitalize="characters" placeholder="vd: 10/1"><div class="hint">Ghi đúng tên lớp, vd: 10/1, 11/4. Nếu lớp em đã có trong danh sách phía trên thì chọn lớp đó, không cần gõ.</div></div>
      <label for="n">Họ và tên</label><input id="n" type="text" required maxlength="60" placeholder="Nguyễn Văn An">
      <label for="u">Tên đăng nhập</label><input id="u" type="text" required autocapitalize="none" placeholder="vd: an.10a1" maxlength="30">
      <div class="hint">Chữ không dấu, số, dấu chấm hoặc gạch dưới. Em dùng tên này để đăng nhập.</div>
      <label for="em">Email <span class="hint">(không bắt buộc – dùng để lấy lại mật khẩu khi quên)</span></label><input id="em" type="email" autocomplete="email" placeholder="vd: an123@gmail.com">
      <label for="p1">Mật khẩu</label><input id="p1" type="password" required minlength="6" autocomplete="new-password" placeholder="Tối thiểu 6 kí tự">
      <label for="p2">Nhập lại mật khẩu</label><input id="p2" type="password" required minlength="6" autocomplete="new-password">
      <div id="msg"></div>
      <div style="margin-top:14px"><button class="btn block">Đăng ký</button></div>
    </form>
    <p class="sub" style="text-align:center"><a href="#/dangnhap">Đã có tài khoản? Đăng nhập</a></p></div>`);
  const fill = () => {
    const sel = $('#lop'); const list = classes.filter(c => c.Khoi === khoi);
    sel.disabled = false;
    sel.innerHTML = '<option value="">— Chọn lớp —</option>' + list.map(c => `<option value="${esc(c.MaLop)}">${esc(c.TenLop)}${c.Truong ? ' – ' + esc(c.Truong) : ''}</option>`).join('')
      + '<option value="__new">➕ Lớp của em chưa có – tự nhập tên lớp</option>';
    if (!list.length) sel.value = '__new';
    $('#newwrap').hidden = sel.value !== '__new';
  };
  $$('#kh button').forEach(b => b.onclick = () => { khoi = b.dataset.k; $$('#kh button').forEach(x => x.classList.toggle('on', x === b)); fill(); });
  $('#lop').onchange = () => { $('#newwrap').hidden = $('#lop').value !== '__new'; };
  $('#f1').onsubmit = async e => {
    e.preventDefault();
    await busy($('#f1 .btn'), async () => {
      try {
        common = $('#mc').value.trim().toUpperCase();
        classes = await api('common_classes', { common });
        $('#f1').hidden = true; $('#f').hidden = false;
        toast('Mã chung đúng! Em chọn khối và lớp nhé.');
      } catch (err) { errBox($('#msg1'), err); }
    });
  };
  $('#f').onsubmit = async e => {
    e.preventDefault();
    if (!khoi) return errBox($('#msg'), 'Em hãy chọn khối.');
    const lop = $('#lop').value;
    if (!lop) return errBox($('#msg'), 'Em hãy chọn lớp.');
    if (lop === '__new' && !$('#nl').value.trim()) return errBox($('#msg'), 'Em hãy nhập tên lớp.');
    if ($('#p1').value !== $('#p2').value) return errBox($('#msg'), 'Hai lần nhập mật khẩu chưa giống nhau.');
    await busy($('#f .btn'), async () => {
      try {
        const req = { common, khoi, name: $('#n').value, username: $('#u').value, password: $('#p1').value, email: ($('#em') || {}).value || '' };
        if (lop === '__new') req.newClass = $('#nl').value.trim(); else req.code = lop;
        const s = await api('register_hs', req);
        setSession(s); flush(); toast('Đăng ký thành công! Chào mừng em.'); location.hash = '#/';
      } catch (err) { errBox($('#msg'), err); }
    });
  };
});

function registerByClassCode(params) {
  setView(`<div class="auth"><h1>Đăng ký tài khoản học sinh</h1><p class="sub">Nhập mã lớp và mật khẩu chung do thầy/cô cung cấp.</p>
    <form class="card" id="f">
      <label for="c">Mã lớp</label><input id="c" type="text" maxlength="10" autocapitalize="characters" required value="${esc(params.get('lop') || '')}" placeholder="vd: 12PD">
      <div id="ci" class="hint"></div>
      <label for="cp">Mật khẩu chung của lớp</label><input id="cp" type="password" required>
      <label for="n">Họ và tên</label><input id="n" type="text" required maxlength="60" placeholder="Nguyễn Văn An">
      <label for="u">Tên đăng nhập</label><input id="u" type="text" required autocapitalize="none" placeholder="vd: an.12a3" maxlength="30">
      <div class="hint">Chữ không dấu, số, dấu chấm hoặc gạch dưới. Em dùng tên này để đăng nhập.</div>
      <div id="msg"></div>
      <div style="margin-top:14px"><button class="btn block">Đăng ký</button></div>
    </form><p class="sub" style="text-align:center"><a href="#/dangky?cach=machung">Đăng ký bằng mã chung</a> · <a href="#/dangnhap">Đã có tài khoản? Đăng nhập</a></p></div>`);
  const check = async () => {
    const c = $('#c').value.trim().toUpperCase(); $('#ci').textContent = '';
    if (c.length < 3) return;
    try { const i = await api('classInfo', { code: c }); ($('#ci') || {}).innerHTML = `✅ Lớp <b>${esc(i.TenLop || c)}</b> – khối ${esc(i.Khoi)} – ${esc(i.Truong)}`; }
    catch (e) { $('#ci').textContent = '⚠️ ' + e.message; }
  };
  $('#c').oninput = check; if (params.get('lop')) check();
  $('#f').onsubmit = async e => {
    e.preventDefault();
    await busy($('#f .btn'), async () => {
      try {
        const s = await api('register_hs', { code: $('#c').value.trim().toUpperCase(), classPw: $('#cp').value, name: $('#n').value, username: $('#u').value });
        setSession(s); toast('Đăng ký thành công! Hãy đặt mật khẩu riêng.'); location.hash = '#/doimk';
      } catch (err) { errBox($('#msg'), err); }
    });
  };
}

route(/^\/dangkygv$/, () => {
  setView(`<div class="auth"><h1>Đăng ký giáo viên</h1><p class="sub">Đăng ký xong là dùng được ngay.</p>
    <form class="card" id="f">
      <label for="n">Họ và tên</label><input id="n" type="text" required maxlength="60">
      <label for="s">Trường</label><input id="s" type="text" required maxlength="80" value="${esc(CFG.SCHOOL_DEFAULT || '')}">
      <label for="e">Email</label><input id="e" type="email" required>
      <label for="p">Mật khẩu (tối thiểu 6 ký tự)</label><input id="p" type="password" required minlength="6">
      <div id="msg"></div>
      <div style="margin-top:14px"><button class="btn block">Gửi đăng ký</button></div>
    </form><p class="sub" style="text-align:center"><a href="#/dangnhap?gv=1">Quay lại đăng nhập</a></p></div>`);
  $('#f').onsubmit = async e => {
    e.preventDefault();
    await busy($('#f .btn'), async () => {
      try {
        const s = await api('register_gv', { name: $('#n').value, school: $('#s').value, email: $('#e').value, password: $('#p').value });
        if (s && s.token) { setSession(s); toast('Đăng ký thành công!'); location.hash = '#/'; }
        else ($('#f') || {}).innerHTML = '<div class="okmsg">Đã đăng ký. Thầy/cô hãy đăng nhập bằng email và mật khẩu vừa tạo.</div>';
      } catch (err) { errBox($('#msg'), err); }
    });
  };
});

route(/^\/doimk$/, () => {
  const forced = session && session.role === 'hs' && session.user.DoiMK;
  setView(`<div class="auth"><h1>${forced ? 'Đặt mật khẩu riêng' : 'Đổi mật khẩu'}</h1>
    ${forced ? '<p class="sub">Lần đầu đăng nhập, em cần đổi mật khẩu chung của lớp thành mật khẩu riêng.</p>' : ''}
    <form class="card" id="f">
      <label for="o">Mật khẩu hiện tại${forced ? ' (mật khẩu chung của lớp)' : ''}</label><input id="o" type="password" required>
      <label for="n1">Mật khẩu mới (tối thiểu 6 ký tự)</label><input id="n1" type="password" required minlength="6">
      <label for="n2">Nhập lại mật khẩu mới</label><input id="n2" type="password" required minlength="6">
      ${forced ? `<label for="sc">Trường của em</label><input id="sc" type="text" maxlength="80" value="${esc(session.user.Truong)}">` : ''}
      <div id="msg"></div>
      <div style="margin-top:14px"><button class="btn block">Lưu mật khẩu</button></div>
    </form></div>`);
  $('#f').onsubmit = async e => {
    e.preventDefault();
    if ($('#n1').value !== $('#n2').value) { errBox($('#msg'), 'Hai mật khẩu mới không khớp'); return; }
    await busy($('#f .btn'), async () => {
      try {
        await api('change_pw', { oldPw: $('#o').value, newPw: $('#n1').value });
        if (forced && $('#sc') && $('#sc').value.trim() && $('#sc').value.trim() !== session.user.Truong) {
          session.user = await api('update_profile', { school: $('#sc').value.trim() });
        }
        if (session.role === 'hs') session.user.DoiMK = false;
        setSession(session); toast('Đã đổi mật khẩu'); location.hash = '#/';
      } catch (err) { errBox($('#msg'), err); }
    });
  };
});

/* ================= Trang chủ ================= */
function streak() {
  const days = new Set(store.get('days_' + uid(), []));
  let n = 0; const d = new Date();
  if (!days.has(today())) d.setDate(d.getDate() - 1);
  for (;;) { const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); if (days.has(k)) { n++; d.setDate(d.getDate() - 1); } else break; }
  return n;
}
route(/^\/$/, params => {
  const isTeacher = isGV();
  const forceHs = params.get('role') === 'hs';
  if (isTeacher && !forceHs) { location.hash = '#/gv'; return; }

  const currentGrade = getStudentGrade();
  const u = session ? session.user : { HoTen: 'bạn', TenLop: '', Khoi: currentGrade };
  const hist = store.get('hist_' + uid(), []);
  const wrong = Object.keys(store.get('wrong_' + uid(), {})).filter(id => bank.byId[id]).length;
  const todayN = hist.filter(h => { const d = new Date(h.t); return d.toDateString() === new Date().toDateString(); }).length;
  const GOAL = 2, recent = hist.filter(h => !(h.dm === 'calop' && !h.rel)).slice(-7), avg = recent.length ? recent.reduce((s, h) => s + h.diem, 0) / recent.length : null;
  const is12 = currentGrade === '12' || isTeacher;
  const first = esc(String(u.HoTen || 'bạn').trim().split(' ').slice(-1)[0]);
  const st = streak();

  setView(`${DEMO ? '<div class="demo">⚙️ <b>Chế độ dùng thử</b>: chưa nhập địa chỉ máy chủ trong <code>config.js</code>. Em vẫn ôn tập được, nhưng điểm và bảng xếp hạng chưa được lưu.</div>' : ''}
    ${isTeacher ? '<div class="card note row"><span class="grow">👁️ Thầy/Cô đang xem giao diện Học sinh</span><a class="btn sm" href="#/gv">Về trang Giáo viên</a></div>' : ''}
    <section class="hero">
      <div class="greet"><div><h1>Chào ${first} 👋</h1><p class="sub">${session ? esc([u.TenLop, u.Truong].filter(Boolean).join(' – ')) : 'AI hỗ trợ dạy học, kiểm tra, đánh giá môn Công nghệ công nghiệp'}</p></div>
        ${st ? `<span class="streak" title="Số ngày học liên tiếp">🔥 ${st} ngày</span>` : ''}</div>
      <div class="dim" aria-label="Tiến độ hôm nay"><div class="lbl"><span>Mục tiêu hôm nay: ${GOAL} lượt ôn</span><b>${Math.min(todayN, GOAL)}/${GOAL}${todayN >= GOAL ? ' ✓' : ''}</b></div>
        <div class="line"><i class="fill" style="width:${Math.min(100, todayN / GOAL * 100)}%"></i></div></div>
    </section>
    ${!session ? `<div class="card row"><span class="grow">Đăng nhập để nhận bài thầy cô giao và lưu điểm.</span><a class="btn sm" href="#/dangnhap">Học sinh</a><a class="btn sm ghost" href="#/dangnhap?gv=1">Giáo viên</a></div>
      <div class="tabs" style="margin-top:4px">${['10', '11', '12'].map(k => `<button data-guest-k="${k}" class="${currentGrade === k ? 'on' : ''}">Lớp ${k}</button>`).join('')}</div>` : ''}
    ${session ? '<div class="sechead"><h2>Việc cần làm</h2><a href="#/baigiao">Tất cả bài giao</a></div><div id="todo"><div class="card empty">Đang tải…</div></div>' : ''}
    <div class="sechead"><h2>Ôn luyện nhanh</h2><a href="#/onluyen">Xem thêm</a></div>
    <div class="quick">
      <a class="qa" href="#/chude?by=bai"><span class="ic">📖</span>Ôn theo bài</a>
      <a class="qa amber" href="#/dinhki"><span class="ic">📑</span>Đề định kì</a>
      <a class="qa" href="#/chude?by=dang&dang=L"><span class="ic">✍️</span>Tự luận AI chấm</a>
      <a class="qa green" href="${is12 ? '#/thitn' : '#/de?tab=bai'}"><span class="ic">${is12 ? '📁' : '🎓'}</span>${is12 ? 'Bộ đề thi TN' : 'Làm nguyên bài'}</a>
      ${window.STC_SGK ? '<a class="qa" href="#/sgk"><span class="ic">📘</span>Sách giáo khoa</a>' : '<a class="qa" href="#/hinhchieu"><span class="ic">🧊</span>Hình chiếu 3D</a>'}
      <a class="qa red" href="#/sotay"><span class="ic">📕</span>Câu sai${wrong ? ` (${wrong})` : ''}</a>
    </div>
    ${hist.length ? `<div class="sechead"><h2>Tiến bộ của em</h2><a href="#/ketqua">Chi tiết</a></div>
      <div class="kpis"><div class="kpi"><b>${hist.length}</b><span>lượt đã làm</span></div><div class="kpi"><b>${avg == null ? '–' : fmt(avg)}</b><span>điểm TB 7 lượt gần nhất</span></div>
      <div class="kpi"><b>${fmt(Math.max(...hist.map(h => h.diem)))}</b><span>điểm cao nhất</span></div></div>` : ''}`);

  $$('[data-guest-k]').forEach(b => b.onclick = () => { store.set('chosen_grade', b.dataset.guestK); render(); });
  if (session) homeTodo($('#todo'));
});

/** Việc cần làm ở trang chủ: tối đa 3 bài chưa làm, còn hạn */
async function homeTodo(box) {
  const lateOf = h => h && new Date(h).getTime() < Date.now();
  const draw = (quiz, drw, err) => {
    if (!box.isConnected) return;
    quiz = Array.isArray(quiz) ? quiz : []; drw = Array.isArray(drw) ? drw : [];
    const items = [
      ...quiz.filter(a => !a.soLanDaLam && !lateOf(a.HanNop)).map(a => ({ ic: '📝', c: '', t: a.TieuDe, m: [a.LoaiBai, a.DanhSachCau.length + ' câu', a.HanNop ? 'hạn ' + dt(a.HanNop) : ''].filter(Boolean).join(' – '), href: '#/baigiao?mo=' + a.MaBai })),
      ...drw.filter(t => !t.bai.length && !lateOf(t.HanNop)).map(t => ({ ic: t.Loai === 'thietke' ? '💡' : '✏️', c: 'amber', t: t.TieuDe, m: [t.Loai === 'thietke' ? 'Thiết kế kĩ thuật' : 'Bài tập vẽ', t.HanNop ? 'hạn ' + dt(t.HanNop) : ''].filter(Boolean).join(' – '), href: '#/baive/' + t.MaBV }))];
    setTabDot(items.length);
    if (!items.length) { box.innerHTML = `<div class="card empty">${err ? esc(err) : 'Em đã làm hết bài thầy cô giao. Ôn thêm bên dưới nhé!'}</div>`; return; }
    box.innerHTML = '<div class="rows">' + items.slice(0, 3).map(x => `<a href="${x.href}"><span class="ic ${x.c}">${x.ic}</span><span class="tx"><b>${esc(x.t)}</b><span>${esc(x.m)}</span></span><span class="chev">›</span></a>`).join('')
      + (items.length > 3 ? `<a href="#/baigiao"><span class="ic">＋</span><span class="tx"><b>Còn ${items.length - 3} bài nữa</b></span><span class="chev">›</span></a>` : '') + '</div>';
  };
  draw(store.get('asg_' + uid(), null), store.get('drw_' + uid(), null));
  const [q, d] = await Promise.allSettled([api('my_assignments'), api('my_drawing_tasks')]);
  if (q.status === 'fulfilled') store.set('asg_' + uid(), q.value);
  if (d.status === 'fulfilled') store.set('drw_' + uid(), d.value);
  draw(store.get('asg_' + uid(), null), store.get('drw_' + uid(), null), q.status === 'rejected' && !store.get('asg_' + uid(), null) ? (q.reason.network ? 'Đang ngoại tuyến – bài giao sẽ hiện khi có mạng.' : q.reason.message) : '');
}

/* ================= Trang Ôn luyện (gom mọi cách tự ôn) ================= */
route(/^\/onluyen$/, () => {
  const g = getStudentGrade(), is12 = g === '12' || isGV();
  const row = (href, ic, c, t, d, attrs = '') => `<${href ? `a href="${href}"` : `button ${attrs}`}><span class="ic ${c}">${ic}</span><span class="tx"><b>${t}</b><span>${d}</span></span><span class="chev">›</span></${href ? 'a' : 'button'}>`;
  setView(`<h1>Ôn luyện</h1><p class="sub">Chọn cách ôn phù hợp với em. Mọi bài đều chấm ngay và có giải thích.</p>
    ${g === '10' || is12 ? `<h2>Thư mục Khối 10</h2><div class="rows">
      ${row('#/hcvg', '📁', 'amber', 'Bài 9. Hình chiếu vuông góc', 'Mô hình 3D: chiếu góc thứ nhất, góc thứ ba, so sánh và luyện tập Hình 1, 2, 3, 4')}
      ${row('#/hcat', '✂️', 'red', 'Bài 10. Hình cắt và mặt cắt', 'Cắt vật thể 3D: hình cắt toàn bộ, một nửa, mặt cắt rời, mặt cắt chập')}
      ${row('#/hctd', '🧊', 'green', 'Bài 11. Hình chiếu trục đo', 'Vẽ từng bước: vuông góc đều, xiên góc cân; luyện tập đọc bản vẽ')}
      ${row('#/hcpc', '🛤️', '', 'Bài 12. Hình chiếu phối cảnh', 'Hiệu ứng điểm tụ: phối cảnh 1 điểm tụ, 2 điểm tụ, kéo đường chân trời')}
    </div>` : ''}
    <h2>Theo nội dung</h2><div class="rows">
      ${row('#/chude?by=bai', '📖', '', 'Theo bài học', 'Chọn bài trong SGK Lớp ' + (is12 ? '10, 11, 12' : g))}
      ${row('#/chude?by=cd', '🎯', '', 'Theo chủ đề', 'Gộp nhiều bài cùng chủ đề')}
      ${row('#/chude?by=dang', '🧩', '', 'Theo dạng câu', 'Trắc nghiệm, Đúng/Sai, tự luận, câu có hình vẽ')}
      ${row('#/de?tab=bai', '📚', '', 'Làm nguyên bài', 'Toàn bộ câu hỏi của một bài, có bấm giờ')}
    </div>
    <h2>Luyện đề</h2><div class="rows">
      ${window.STC_MATRAN ? row('#/dinhki', '📑', 'amber', 'Đề kiểm tra định kì', 'Giữa kì, cuối kì đúng ma trận CV 7991') : ''}
      ${row('#/thitn', '📁', 'green', 'Bộ đề luyện thi TN THPT', deList().length + ' đề đủ 28 câu · mỗi lần mở đều đảo câu, đảo đáp án' + (is12 ? '' : ' (dành cho HS lớp 12)'))}
      ${row('', '🧪', 'green', is12 ? 'Đề tổng hợp theo ma trận' : 'Đề tổng hợp Lớp ' + g, 'Mỗi lần làm là một đề mới', 'id="mx"')}
    </div>
    <h2>Công cụ học tập</h2><div class="rows">
      ${window.STC_SGK ? row('#/sgk', '📘', '', 'Sách giáo khoa', 'Đọc lại lí thuyết từng bài') : ''}
      ${row('#/sotay', '📕', 'red', 'Sổ tay câu sai', 'Làm lại những câu em từng sai')}
      ${row('#/hinhchieu', '🧊', '', 'Hình chiếu 3D', 'Xoay vật thể, tìm hình chiếu đúng')}
      ${row('#/gocchieu', '📐', 'amber', 'Góc chiếu 1 & 3 – luyện thêm', 'Nhận biết nhanh, xếp hình chiếu nhiều vật thể')}
      ${row('#/trochoi', '🎮', 'amber', 'Trò chơi', 'Đoán từ, ô chữ, lật ô đoán tranh')}
    </div>`);
  $('#mx').onclick = () => {
    if (!is12) {
      const pool = bank.q.filter(q => q.k === g && q.t !== 'L');
      if (!pool.length) { toast(`Chưa có câu hỏi khối ${g}`); return; }
      startQuiz({ title: `Đề tổng hợp kiểm tra Lớp ${g}`, key: '', loai: 'matran', ids: shuffle(pool).slice(0, 24).map(q => q.id), minutes: 45 });
    } else startQuiz({ title: 'Đề tổng hợp theo ma trận tốt nghiệp', key: '', loai: 'matran', ids: matrixPick(), minutes: 50 });
  };
});

/* ================= Trang Bài giao (đầy đủ 3 nhóm) ================= */
route(/^\/baigiao$/, params => {
  if (!session || session.role !== 'hs') { setView('<h1>Bài thầy cô giao</h1><div class="card empty">Hãy đăng nhập bằng tài khoản học sinh để nhận bài.<div style="margin-top:12px"><a class="btn" href="#/dangnhap">Đăng nhập</a></div></div>'); return; }
  setView('<h1>Bài thầy cô giao</h1><p class="sub">Bài kiểm tra, bài tập vẽ và bài thiết kế kĩ thuật của lớp em.</p><div id="asg"><div class="card empty">Đang tải…</div></div>');
  homeTasks($('#asg'), params && params.get('mo'));
});

/* ===== Bài thầy cô giao: 3 nhóm Kiểm tra / Bài tập vẽ / Thiết kế kĩ thuật ===== */
async function homeTasks(box, openId) {
  const st = { quiz: store.get('asg_' + uid(), null), drw: store.get('drw_' + uid(), null), err: '', tab: openId ? 'quiz' : store.get('asg_tab_' + uid(), '') };
  const now = () => Date.now();
  const lateOf = h => h && new Date(h).getTime() < now();
  const draw = () => {
    const quiz = Array.isArray(st.quiz) ? st.quiz : [], drw = Array.isArray(st.drw) ? st.drw : [];
    const ve = drw.filter(t => t.Loai !== 'thietke'), tk = drw.filter(t => t.Loai === 'thietke');
    const pq = quiz.filter(a => !a.soLanDaLam && !lateOf(a.HanNop)).length;
    const pd = l => l.filter(t => !t.bai.length && !lateOf(t.HanNop)).length;
    const tabs = [['quiz', '📝 Bài kiểm tra', quiz, pq], ['ve', '✏️ Bài tập vẽ', ve, pd(ve)], ['tk', '💡 Thiết kế kĩ thuật', tk, pd(tk)]];
    if (!st.tab) { const f = tabs.find(t => t[3]); st.tab = f ? f[0] : 'quiz'; }
    setTabDot(tabs.reduce((s, t) => s + t[3], 0));
    const cur = tabs.find(t => t[0] === st.tab) || tabs[0];
    let body = '';
    if (st.quiz == null && st.drw == null) body = `<div class="card empty">${esc(st.err || 'Đang tải…')}</div>`;
    else if (cur[0] === 'quiz') {
      body = quiz.length ? '<div class="list">' + quiz.map((a, i) => {
        const late = lateOf(a.HanNop), out = a.SoLan && a.soLanDaLam >= a.SoLan;
        const nTL = a.DanhSachCau.filter(id => bank.byId[id] && bank.byId[id].t === 'L').length;
        return `<div class="item"${a.MaBai === openId ? ' id="asgopen" style="border-color:var(--brand2);box-shadow:0 0 0 3px var(--info-soft)"' : ''}><div class="grow">${a.MaBai === openId ? '<div class="pill" style="margin-bottom:4px">👉 Bài thầy cô vừa chia sẻ</div>' : ''}<b>${esc(a.TieuDe)}</b> ${a.LoaiBai ? `<span class="pill">${esc(a.LoaiBai)}</span>` : ''}
          <div class="meta">${a.DanhSachCau.length} câu${nTL ? ' (có ' + nTL + ' câu tự luận)' : ''}${a.ThoiGian ? ' · ' + a.ThoiGian + ' phút' : ''}${a.HanNop ? ' · hạn ' + dt(a.HanNop) : ''} · ${esc(a.TenGV)}</div>
          ${a.MoTa ? `<div class="meta">📌 ${esc(a.MoTa)}</div>` : ''}
          <div class="row" style="margin-top:4px">${a.soLanDaLam ? (a.choDiem ? `<span class="pill ok">Đã nộp ${a.soLanDaLam} lần</span><span class="pill warn">⏳ Chờ cả lớp nộp (${a.choDiem.nop}/${a.choDiem.si}) mới có điểm</span>` : `<span class="pill ok">Đã làm ${a.soLanDaLam} lần · cao nhất ${fmt(a.diemCao)}</span>`) : '<span class="pill warn">Chưa làm</span>'}
          ${a.CheDoDiem === 'diem' ? '<span class="pill">Chỉ xem điểm</span>' : a.CheDoDiem === 'calop' && !a.soLanDaLam ? '<span class="pill">Cả lớp nộp xong mới có điểm</span>' : ''}
          ${late ? '<span class="pill bad">Hết hạn</span>' : ''}</div></div>
          <div class="row">${a.soLanDaLam && a.BangXepHang !== 'tat' && !a.choDiem ? `<a class="btn ghost sm" href="#/bxh?key=${encodeURIComponent(a.MaBai)}&t=${encodeURIComponent(a.TieuDe)}">🏆</a>` : ''}
          <button class="btn sm" data-i="${i}" ${late || out ? 'disabled' : ''}>${out ? 'Hết lượt' : 'Làm bài'}</button></div></div>`;
      }).join('') + '</div>' : '<div class="card empty">Chưa có bài kiểm tra nào được giao.</div>';
    } else {
      const l = cur[2], isTK = cur[0] === 'tk';
      body = l.length ? '<div class="list">' + l.map(t => {
        const last = t.bai[0];
        return `<a class="item" href="#/baive/${t.MaBV}"><div class="grow"><b>${esc(t.TieuDe)}</b><div class="meta">${esc(isTK ? 'Nộp ảnh bản phác thảo thiết kế' : t.LoaiTen)} · thang ${t.DiemToiDa} điểm${t.HanNop ? ' · hạn ' + dt(t.HanNop) : ''} · ${esc(t.TenGV)}</div>
          <div class="row" style="margin-top:4px">${last ? subStatus(last, t.DiemToiDa) : '<span class="pill warn">Chưa nộp</span>'}${lateOf(t.HanNop) ? '<span class="pill bad">Hết hạn</span>' : ''}</div></div>›</a>`;
      }).join('') + '</div>' : `<div class="card empty">${isTK ? 'Chưa có bài thiết kế kĩ thuật nào được giao.' : 'Chưa có bài tập vẽ nào được giao.'}</div>`;
    }
    box.innerHTML = `<div class="tabs asgtabs">${tabs.map(([k, n, l, p]) => `<button data-at="${k}" class="${cur[0] === k ? 'on' : ''}">${n} ${p ? `<span class="badge" title="Chưa làm">${p}</span>` : `<span class="cnt">${l.length}</span>`}</button>`).join('')}</div>${body}`;
    $$('[data-at]', box).forEach(b => b.onclick = () => { st.tab = b.dataset.at; store.set('asg_tab_' + uid(), st.tab); draw(); });
    const op = $('#asgopen', box); if (op && !st.scrolled) { st.scrolled = true; setTimeout(() => op.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200); }
    $$('[data-i]', box).forEach(b => b.onclick = async () => {
      const a = quiz[+b.dataset.i];
      if (a.DanhSachCau.some(id => !bank.byId[id])) { toast('Đang tải câu hỏi mới…'); await syncBank(true); }
      const ids = a.DanhSachCau.filter(id => bank.byId[id]);
      if (!ids.length) { toast('Chưa tải được câu hỏi của bài này'); return; }
      startQuiz({ title: a.TieuDe, key: a.MaBai, loai: 'baigiao', ids, minutes: a.ThoiGian, hints: a.HienGoiY, dm: a.CheDoDiem || '' });
    });
  };
  draw();
  const [q, d] = await Promise.allSettled([api('my_assignments'), api('my_drawing_tasks')]);
  if (q.status === 'fulfilled') { st.quiz = q.value; store.set('asg_' + uid(), q.value); }
  else if (st.quiz == null) st.err = q.reason.network ? 'Đang ngoại tuyến – danh sách bài giao sẽ hiện khi có mạng.' : q.reason.message;
  if (d.status === 'fulfilled') { st.drw = d.value; store.set('drw_' + uid(), d.value); }
  if (box.isConnected) draw();
}

/* ================= Chọn đề / chủ đề / sổ tay ================= */
route(/^\/de$/, params => {
  if (params && params.get('tab') === 'de') { location.replace('#/thitn'); return; }
  const g = getStudentGrade();
  const allowed = getAllowedGrades();
  let tab = (params && params.get('tab')) || ((g === '10' || g === '11') ? 'bai' : 'bai');
  let selectedK = (params && params.get('k')) || (allowed.includes(g) ? g : allowed[0]);
  const hist = store.get('hist_' + uid(), []);

  const draw = () => {
    const isBai = tab === 'bai';
    const pkgs = lessonPackages(selectedK);
    const exams = deList();

    const gradeTabs = (isBai && allowed.length > 1) ? `
      <div class="tabs" style="margin-bottom:12px">
        ${allowed.map(x => `<button type="button" data-grade="${x}" class="${x === selectedK ? 'on' : ''}">Lớp ${x}</button>`).join('')}
      </div>` : '';

    const listHtml = isBai ? `
      <div class="list compact">
        ${pkgs.map(p => {
          const mine = hist.filter(h => h.key === p.key);
          const best = mine.length ? Math.max(...mine.map(h => h.diem)) : null;
          return `
            <div class="item">
              <div class="grow">
                <b>${esc(p.name)}</b>
                <div class="meta">${p.count} câu hỏi nguyên bài${best != null ? ' · Điểm cao nhất: ' + fmt(best) + ' (' + mine.length + ' lượt)' : ''}</div>
              </div>
              <div class="row">
                ${best != null && !DEMO ? `<a class="btn ghost sm" href="#/bxh?key=${encodeURIComponent(p.key)}&t=${encodeURIComponent(p.name)}">🏆</a>` : ''}
                ${(() => { const r = sgkLesson(bank.byId[p.ids[0]]); return r ? `<a class="btn ghost sm" title="Đọc SGK" href="${sgkHref(r.b.k, r.l.pdf)}">📘 SGK</a>` : ''; })()}
                <button class="btn sm" data-pkg="${esc(p.id)}">Làm nguyên bài (${p.count} câu)</button>
              </div>
            </div>`;
        }).join('') || '<div class="card empty">Chưa có bài học cho khối này.</div>'}
      </div>`
    : `
      <div class="list compact">
        ${exams.map(d => {
          const n = bank.q.filter(q => q.de === d).length;
          const mine = hist.filter(h => h.key === 'DE:' + d);
          const best = mine.length ? Math.max(...mine.map(h => h.diem)) : null;
          return `
            <div class="item">
              <div class="grow">
                <b>${esc(d)}</b>
                <div class="meta">${n} câu theo chuẩn Bộ GD&ĐT${best != null ? ' · Điểm cao nhất: ' + fmt(best) + ' (' + mine.length + ' lượt)' : ''}</div>
              </div>
              <div class="row">
                ${best != null && !DEMO ? `<a class="btn ghost sm" href="#/bxh?key=${encodeURIComponent('DE:' + d)}&t=${encodeURIComponent(d)}">🏆</a>` : ''}
                <button class="btn sm" data-d="${esc(d)}">Làm đề (50 phút)</button>
              </div>
            </div>`;
        }).join('')}
      </div>`;

    setView(`
      <div class="row" style="align-items:center;margin-bottom:8px">
        <h1 class="grow" style="margin:0">${isBai ? '📖 Trắc nghiệm theo từng Bài học SGK' : '🎓 30 Đề thi thử tốt nghiệp THPT'}</h1>
      </div>
      <p class="sub">${isBai ? 'Làm nguyên bài trọn vẹn toàn bộ câu hỏi trắc nghiệm & đúng sai của từng bài học, có bấm giờ, chấm điểm và xem giải thích chi tiết.' : 'Mỗi đề gồm 24 câu nhiều lựa chọn và 4 câu Đúng/Sai tổng hợp cả 3 khối, làm trong 50 phút.'}</p>
      
      <div class="tabs" style="margin-bottom:14px">
        <button type="button" data-tab="bai" class="${isBai ? 'on' : ''}">📖 Nguyên bài học SGK (${isBai ? 'Lớp ' + selectedK : 'Lớp ' + g})</button>
        <a class="btn ghost" href="#/thitn" style="margin-left:6px">📁 Bộ đề luyện thi TN THPT (${exams.length} đề)</a>
      </div>

      ${gradeTabs}

      ${(!isBai && (g === '10' || g === '11')) ? `
        <div class="card" style="margin-bottom:14px;background:var(--info-soft);border-left:4px solid var(--accent)">
          💡 <i>Lưu ý: 30 đề thi tốt nghiệp tổng hợp kiến thức cả 3 khối (chủ yếu Lớp 12). Học sinh Khối ${g} nên làm ở tab <b>Nguyên bài học SGK</b> ở trên để bám sát bài học trên lớp.</i>
        </div>` : ''}

      ${listHtml}
    `);

    $$('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
    $$('[data-grade]').forEach(b => b.onclick = () => { selectedK = b.dataset.grade; draw(); });
    $$('[data-pkg]').forEach(b => {
      b.onclick = () => {
        const p = lessonPackages().find(x => x.id === b.dataset.pkg);
        if (!p) return;
        startQuiz({ title: p.name, key: p.key, loai: 'baihoc', ids: p.ids, minutes: Math.min(150, estMin(p.ids)) });
      };
    });
    $$('[data-d]').forEach(b => {
      b.onclick = () => {
        const d = b.dataset.d;
        startQuiz({ title: d, key: 'DE:' + d, loai: 'de', ids: bank.q.filter(q => q.de === d).map(q => q.id), minutes: 50 });
      };
    });
  };

  draw();
});

/* ================= GV: Quản lý đề luyện thi TN – kết quả, câu hay sai, bài làm HS ================= */
route(/^\/gv\/thitn$/, async params => {
  if (!needGV()) return;
  const key = params.get('de') ? 'DE:' + params.get('de') : '', code = params.get('lop') || '';
  setView('<div class="card empty">Đang tải kết quả…</div>');
  let res;
  try { res = await api('tn_results', { key, code }); } catch (e) { errBox(V, e); return; }
  if (bank.q.length && res.rows.some(r => r.sai.some(id => !bank.byId[id]))) await syncBank(true);
  const exams = deList(), rows = res.rows, classes = res.classes || {};
  const nm = d => (/(\d+)\s*$/.exec(d) || [])[1] || d;
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const lopSel = `<select id="lsel" style="max-width:220px"><option value="">Tất cả lớp của tôi (${Object.keys(classes).length})</option>${Object.entries(classes).sort((a, b) => a[1].localeCompare(b[1], 'vi', { numeric: true })).map(([c, t]) => `<option value="${esc(c)}" ${c === code ? 'selected' : ''}>Lớp ${esc(t)}</option>`).join('')}</select>`;
  const go = (de, lop) => { location.hash = '#/gv/thitn' + (de || lop ? '?' + [de ? 'de=' + encodeURIComponent(de) : '', lop ? 'lop=' + encodeURIComponent(lop) : ''].filter(Boolean).join('&') : ''); };
  /* thống kê sai theo câu / theo bài học từ danh sách lượt làm */
  const qStats = rs => {
    const st = {};
    rs.forEach(r => { const d = r.key.slice(3); bank.q.filter(q => q.de === d).forEach(q => { const s = st[q.id] = st[q.id] || { q, lam: 0, sai: 0, chon: {} }; s.lam++; if (r.sai.includes(q.id)) s.sai++;
      const a = r.ct && r.ct[q.id]; if (a && q.t === 'M' && a !== normAns(q)) s.chon[a] = (s.chon[a] || 0) + 1;
      if (a && q.t === 'T') { const ok = normAns(q); String(a).split('').forEach((x, i) => { if (x !== '-' && x !== ok[i]) s.chon['abcd'[i]] = (s.chon['abcd'[i]] || 0) + 1; }); } }); });
    return Object.values(st);
  };
  const lessonStats = qs => {
    const m = {};
    qs.forEach(s => { const b = (s.q.bai || s.q.cd || '').replace(/^Lớp \d+ – /, ''), k = s.q.k + '|' + b; const x = m[k] = m[k] || { k: s.q.k, b, lam: 0, sai: 0 }; x.lam += s.lam; x.sai += s.sai; });
    return Object.values(m).filter(x => x.lam).sort((a, b) => b.sai / b.lam - a.sai / a.lam);
  };
  const bar = p => `<span class="tr" style="display:inline-block;width:90px;height:8px;border-radius:4px;background:var(--line);vertical-align:middle;margin-right:6px"><i style="display:block;height:100%;width:${p}%;border-radius:4px;background:${p >= 60 ? 'var(--bad)' : p >= 35 ? '#e0a800' : 'var(--ok)'}"></i></span>${p}%`;
  const lessonTable = ls => ls.length ? `<div class="tablewrap"><table><thead><tr><th>Bài học</th><th class="n">Lớp</th><th class="n">Lượt trả lời</th><th>Tỉ lệ sai</th></tr></thead><tbody>${ls.slice(0, 12).map(x => `<tr><td>${esc(x.b)}</td><td class="n">${esc(x.k)}</td><td class="n">${x.lam}</td><td>${bar(pct(x.sai, x.lam))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Chưa có dữ liệu</div>';

  if (!key) {
    /* ---- Danh sách đề (hàng dọc) ---- */
    const by = {}; rows.forEach(r => (by[r.key] = by[r.key] || []).push(r));
    const ls = lessonStats(qStats(rows));
    const allQ = qStats(rows).filter(s => s.lam >= 3).sort((a, b) => b.sai / b.lam - a.sai / a.lam).slice(0, 8);
    setView(`<a href="#/gv">← Trang giáo viên</a>
      <div class="row" style="align-items:center"><h1 class="grow">🎓 Quản lý đề luyện thi TN THPT</h1><a class="btn ghost sm" href="#/thitn">👁 Xem bộ đề như HS</a></div>
      <p class="sub">${exams.length} đề · mỗi đề 28 câu · mỗi lần HS mở đề đều đảo câu, đảo đáp án. Thống kê theo đúng câu gốc của đề nên vẫn chính xác dù thứ tự bị đảo.</p>
      <div class="row" style="margin:6px 0 10px">${lopSel}<span class="grow"></span><button class="btn sm" id="ex">⬇ Xuất Excel</button></div>
      <div class="kpis"><div class="kpi"><b>${new Set(rows.map(r => r.maHS)).size}</b><span>HS đã luyện</span></div><div class="kpi"><b>${rows.length}</b><span>lượt làm đề</span></div>
        <div class="kpi"><b>${rows.length ? fmt(rows.reduce((a, r) => a + r.diem, 0) / rows.length) : '–'}</b><span>điểm TB mọi lượt</span></div><div class="kpi"><b>${Object.keys(by).length}/${exams.length}</b><span>đề đã có HS làm</span></div></div>
      <div class="card"><div class="tablewrap"><table class="detable"><thead><tr><th>Đề</th><th class="n">Số HS</th><th class="n">Lượt</th><th class="n">Điểm TB</th><th class="n">Cao nhất</th><th class="n">Thấp nhất</th><th>Câu sai nhiều nhất</th><th></th></tr></thead><tbody>
        ${exams.map(d => { const rs = by['DE:' + d] || [], ds = rs.map(r => r.diem);
          const top = rs.length ? qStats(rs).sort((a, b) => b.sai - a.sai)[0] : null;
          const pos = top ? (/_(C|DS)(\d+)$/.exec(top.q.id) || []) : [];
          return `<tr class="${rs.length ? 'click' : 'muted'}" data-de="${esc(d)}"><td><b>Đề ${esc(nm(d))}</b></td><td class="n">${new Set(rs.map(r => r.maHS)).size || '–'}</td><td class="n">${rs.length || '–'}</td>
            <td class="n"><b>${rs.length ? fmt(ds.reduce((a, b) => a + b, 0) / ds.length) : '–'}</b></td><td class="n">${rs.length ? fmt(Math.max(...ds)) : '–'}</td><td class="n">${rs.length ? fmt(Math.min(...ds)) : '–'}</td>
            <td>${top && top.sai ? `${pos[1] === 'DS' ? 'Đ/S câu ' + +pos[2] : 'Câu ' + +pos[2]} – sai ${pct(top.sai, top.lam)}%` : '<span class="hint">–</span>'}</td><td>${rs.length ? '<span class="btn ghost sm">Xem ›</span>' : ''}</td></tr>`; }).join('')}
      </tbody></table></div></div>
      <h2>📉 Bài học HS hay sai nhất (toàn bộ đề đã làm)</h2><div class="card">${lessonTable(ls)}<p class="hint">Tỉ lệ sai = số lần trả lời sai / số lần gặp câu của bài đó. Bài đỏ (≥ 60%) nên dạy lại; vàng (35–60%) cần ôn thêm.</p></div>
      ${allQ.length ? `<h2>❗ Câu sai nhiều nhất</h2><div class="card"><div class="list compact">${allQ.map(s => `<a class="item" href="#/gv/thitn?de=${encodeURIComponent(s.q.de)}${code ? '&lop=' + code : ''}"><div class="grow"><b>Đề ${esc(nm(s.q.de))}</b> · ${esc(plainQ(s.q.s).slice(0, 110))}…<div class="meta">${esc((s.q.bai || '').replace(/^Lớp \d+ – /, ''))} · ${esc(s.q.md)}</div></div><span>${bar(pct(s.sai, s.lam))}</span></a>`).join('')}</div></div>` : ''}`);
    $('#lsel').onchange = e => go('', e.target.value);
    $$('tr.click[data-de]').forEach(tr => tr.onclick = () => go(tr.dataset.de, code));
    $('#ex').onclick = () => csv('LuyenThiTN_' + (code ? classes[code] : 'tat_ca') + '.csv', [['Họ tên', 'Lớp', 'Đề', 'Lần', 'Điểm', 'Số câu đúng', 'Thời gian (phút)', 'Thời điểm'],
      ...rows.slice().sort((a, b) => viNameCmp(a.hoTen, b.hoTen) || a.key.localeCompare(b.key, 'vi', { numeric: true })).map(r => [r.hoTen, r.lop, r.key.slice(3), r.lan, r.diem, r.dung + '/' + r.tong, Math.round(r.giay / 60), dt(r.t)])]);
    return;
  }

  /* ---- Chi tiết một đề ---- */
  const d = key.slice(3), qs = qStats(rows), qsBy = {}; qs.forEach(s => { qsBy[s.q.id] = s; });
  const order = bank.q.filter(q => q.de === d);
  const posOf = q => { const m = /_(C|DS)(\d+)$/.exec(q.id) || []; return m[1] === 'DS' ? 'Đ/S ' + +m[2] : 'Câu ' + +m[2]; };
  let sortBy = 'sai', open = {}, who = '';
  const hs = {}; rows.forEach(r => { const x = hs[r.maHS] = hs[r.maHS] || { ten: r.hoTen, lop: r.lop, l: [] }; x.l.push(r); });
  const draw = () => {
    const list = order.slice().sort((a, b) => sortBy === 'sai' ? ((qsBy[b.id] || {}).sai || 0) - ((qsBy[a.id] || {}).sai || 0) : 0);
    const hsList = Object.entries(hs).sort((a, b) => viNameCmp(a[1].ten, b[1].ten));
    const one = who && hs[who];
    setView(`<a href="#/gv/thitn${code ? '?lop=' + code : ''}">← Quản lý đề luyện thi TN</a>
      <h1>${esc(d)}</h1><p class="sub">${rows.length} lượt làm · ${hsList.length} học sinh${code ? ' · lớp ' + esc(classes[code] || '') : ''} · điểm TB <b>${rows.length ? fmt(rows.reduce((a, r) => a + r.diem, 0) / rows.length) : '–'}</b></p>
      <div class="row" style="margin-bottom:8px">${lopSel}<span class="grow"></span><button class="btn ghost sm" id="pr">🖨️ In đề kèm đáp án</button></div>
      <h2>📉 Bài học hay sai trong đề này</h2><div class="card">${lessonTable(lessonStats(qs))}</div>
      <div class="row" style="align-items:center"><h2 class="grow">📝 Từng câu của đề</h2><div class="tabs" style="margin:0"><button data-sort="sai" class="${sortBy === 'sai' ? 'on' : ''}">Sai nhiều trước</button><button data-sort="de" class="${sortBy === 'de' ? 'on' : ''}">Theo thứ tự đề</button></div></div>
      <div class="card"><div class="tablewrap"><table class="detable"><thead><tr><th>Câu</th><th>Nội dung</th><th class="n">Lượt</th><th>Tỉ lệ sai</th><th>HS hay chọn nhầm</th></tr></thead><tbody>
        ${list.map(q => { const s = qsBy[q.id] || { lam: 0, sai: 0, chon: {} }, wrong = Object.entries(s.chon).sort((a, b) => b[1] - a[1]);
          return `<tr class="click" data-q="${q.id}"><td><b>${posOf(q)}</b><div class="hint">${esc(q.t === 'T' ? 'Đúng/Sai' : q.md)}</div></td><td>${esc(plainQ(q.s).slice(0, 120))}${plainQ(q.s).length > 120 ? '…' : ''}<div class="hint">${esc((q.bai || q.cd || '').replace(/^Lớp \d+ – /, ''))} · Lớp ${esc(q.k)}</div></td>
            <td class="n">${s.lam || '–'}</td><td>${s.lam ? bar(pct(s.sai, s.lam)) : '–'}</td>
            <td>${wrong.length ? wrong.slice(0, 2).map(([x, c]) => q.t === 'M' ? `<span class="pill bad">${x}. ${esc(plainQ(q.o[LETTERS.indexOf(x)]).slice(0, 28))} · ${c}</span>` : `<span class="pill bad">ý ${x}) sai ${c} lần</span>`).join(' ') : '<span class="hint">–</span>'}</td></tr>
            ${open[q.id] ? `<tr><td colspan="5"><div class="preview">${qHtml(q, { ids: [q.id], perm: { [q.id]: [0, 1, 2, 3] }, resp: {} }, 0, { showAns: true })}${q.e ? `<div class="expl ans"><b class="t">Lời giải</b>${q.t === 'T' ? (q.e || []).map((e, k) => e ? `<div><b>${'abcd'[k]})</b> ${sanitize(e)}</div>` : '').join('') : sanitize(q.e)}</div>` : ''}</div></td></tr>` : ''}`; }).join('')}
      </tbody></table></div><p class="hint">Bấm vào một câu để xem đầy đủ đề, đáp án và lời giải. "HS hay chọn nhầm" tính theo phương án gốc của đề (A, B, C, D như bản in), dù HS làm trên app bị đảo.</p></div>
      <h2>👩‍🎓 Bài làm của học sinh</h2><div class="card"><div class="tablewrap"><table><thead><tr><th>Họ tên</th><th>Lớp</th><th class="n">Số lượt</th><th class="n">Cao nhất</th><th class="n">Lần gần nhất</th><th></th></tr></thead><tbody>
        ${hsList.map(([id, x]) => { const ds = x.l.map(r => r.diem), last = x.l.slice().sort((a, b) => new Date(b.t) - new Date(a.t))[0];
          return `<tr><td>${esc(x.ten)}</td><td>${esc(x.lop)}</td><td class="n">${x.l.length}</td><td class="n"><b>${fmt(Math.max(...ds))}</b></td><td class="n">${fmt(last.diem)}</td><td><button class="btn ghost sm" data-who="${esc(id)}">${who === id ? 'Ẩn' : 'Xem bài làm'}</button></td></tr>
          ${who === id ? `<tr><td colspan="6">${studentView(x, last)}</td></tr>` : ''}`; }).join('') || '<tr><td colspan="6" class="empty">Chưa có học sinh làm đề này</td></tr>'}
      </tbody></table></div></div>`);
    math(V);
    $('#lsel').onchange = e => go(key, e.target.value);
    $$('[data-sort]').forEach(b => b.onclick = () => { sortBy = b.dataset.sort; draw(); });
    $$('tr.click[data-q]').forEach(tr => tr.onclick = () => { open[tr.dataset.q] = !open[tr.dataset.q]; draw(); });
    $$('[data-who]').forEach(b => b.onclick = () => { who = who === b.dataset.who ? '' : b.dataset.who; draw(); });
    $('#pr').onclick = () => printExam({ TieuDe: 'ĐỀ LUYỆN THI TỐT NGHIỆP THPT – ' + d.toUpperCase(), Truong: (session && session.user.Truong) || '', Khoi: '12', ThoiGian: 50, versions: [{ ma: '', ids: order.map(q => q.id), perm: {} }] }, 'all', true, { noQr: true });
  };
  /* bài làm lần gần nhất của 1 HS: từng câu đúng/sai, phương án em chọn */
  const studentView = (x, r) => {
    const ct = r.ct || {};
    return `<div class="hint" style="margin-bottom:6px">Lần ${r.lan} · ${dt(r.t)} · ${fmt(r.diem)} điểm · đúng ${r.dung}/${r.tong} · ${mmss(r.giay)}</div><div class="stuans">${order.map(q => {
      const a = ct[q.id], ok = !r.sai.includes(q.id), ans = normAns(q);
      const txt = q.t === 'M' ? (a ? a : '–') : (a ? String(a).split('').map((v, i) => 'abcd'[i] + ')' + (v === '-' ? '–' : v)).join(' ') : '–');
      return `<span class="sa ${a ? (ok ? 'ok' : 'bad') : 'skip'}" title="${esc(plainQ(q.s).slice(0, 140))}"><b>${posOf(q)}</b> ${esc(txt)}${!ok ? ` <i>(đúng: ${esc(q.t === 'M' ? ans : ans.split('').map((v, i) => 'abcd'[i] + ')' + v).join(' '))})</i>` : ''}</span>`;
    }).join('')}</div><p class="hint">Xanh: đúng · Đỏ: sai · Xám: bỏ trống. Chữ cái là phương án theo đề gốc.</p>`;
  };
  draw();
});
/** nội dung câu hỏi dạng chữ thường (bỏ thẻ HTML, ảnh) để hiện tóm tắt */
function plainQ(h) { return String(h || '').replace(/<img[^>]*>/gi, ' [hình] ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(); }

/* ================= 📁 Bộ đề luyện thi tốt nghiệp THPT (khối 12) ================= */
route(/^\/thitn$/, () => {
  const g = getStudentGrade(), is12 = g === '12' || isGV();
  const exams = deList();
  const hist = store.get('hist_' + uid(), []);
  const num = d => (/(\d+)\s*$/.exec(d) || [])[1] || '';
  const stat = d => { const m = hist.filter(h => h.key === 'DE:' + d); return { n: m.length, best: m.length ? Math.max(...m.map(h => h.diem)) : null, last: m.length ? m[m.length - 1].diem : null }; };
  const done = exams.filter(d => stat(d).n), avg = done.length ? done.reduce((a, d) => a + stat(d).best, 0) / done.length : null;
  setView(`<a href="${isGV() ? '#/gv' : '#/onluyen'}">← ${isGV() ? 'Trang giáo viên' : 'Ôn luyện'}</a>
    <h1>🎓 Luyện thi tốt nghiệp THPT</h1>
    <p class="sub">Môn Công nghệ công nghiệp · ${exams.length} đề, mỗi đề <b>28 câu</b> đúng cấu trúc thi từ 2025: Phần I 24 câu nhiều lựa chọn, Phần II 4 câu Đúng/Sai · 50 phút.</p>
    ${is12 ? '' : '<div class="card note">💡 Bộ đề tổng hợp kiến thức chủ yếu Lớp 12. HS Lớp ' + esc(g) + ' nên luyện ở mục <a href="#/de?tab=bai">Làm nguyên bài</a> trước.</div>'}
    <div class="kpis"><div class="kpi"><b>${done.length}/${exams.length}</b><span>đề đã làm</span></div><div class="kpi"><b>${avg == null ? '–' : fmt(avg)}</b><span>điểm TB (cao nhất mỗi đề)</span></div>
      <div class="kpi"><b>${done.length ? fmt(Math.max(...done.map(d => stat(d).best))) : '–'}</b><span>điểm cao nhất</span></div></div>
    <div class="card hint" style="margin:10px 0">📌 Mỗi đề đủ <b>28 câu</b>. <b>Mỗi lần mở đề</b>, app <b>đảo vị trí các câu</b> trong từng phần và <b>đảo thứ tự phương án A, B, C, D</b>, nên em không thể nhớ vị trí đáp án mà phải hiểu bài. Phần Đúng/Sai giữ thứ tự ý a, b, c, d như đề thi thật.</div>
    <div class="degrid">${exams.map(d => { const st = stat(d), cls = st.best == null ? '' : st.best >= 8 ? ' good' : st.best >= 5 ? ' ok' : ' low';
      return `<div class="decard${cls}"><div class="row" style="align-items:flex-start"><div class="deno">${esc(num(d))}</div><div class="grow"><b>${esc(d)}</b>
          <div class="meta">${st.n ? `Đã làm ${st.n} lần · cao nhất <b>${fmt(st.best)}</b>${st.n > 1 ? ' · lần gần nhất ' + fmt(st.last) : ''}` : 'Chưa làm'}</div></div></div>
        <div class="row" style="margin-top:8px;gap:6px;flex-wrap:wrap"><button class="btn sm" data-re="${esc(d)}">${st.n ? '🔀 Làm lại' : '▶ Làm đề'} (50 phút)</button>
          ${st.n && !DEMO ? `<a class="btn ghost sm" href="#/bxh?key=${encodeURIComponent('DE:' + d)}&t=${encodeURIComponent(d)}" title="Bảng xếp hạng">🏆</a>` : ''}
          ${isGV() ? `<button class="btn ghost sm" data-pr="${esc(d)}" title="In / lưu PDF đề kèm đáp án">🖨️</button>` : ''}</div></div>`; }).join('')}</div>`);
  const ids = d => bank.q.filter(q => q.de === d).map(q => q.id);
  $$('[data-re]').forEach(b => b.onclick = () => startQuiz({ title: b.dataset.re, key: 'DE:' + b.dataset.re, loai: 'de', ids: ids(b.dataset.re), minutes: 50 }));
  $$('[data-pr]').forEach(b => b.onclick = () => printExam({ TieuDe: 'ĐỀ LUYỆN THI TỐT NGHIỆP THPT – ' + b.dataset.pr.toUpperCase(), Truong: (session && session.user.Truong) || '', Khoi: '12', ThoiGian: 50, versions: [{ ma: '', ids: ids(b.dataset.pr), perm: {} }] }, 'all', true, { noQr: true }));
});

route(/^\/chude$/, params => {
  const allowed = getAllowedGrades();
  let k = (params && allowed.includes(params.get('k'))) ? params.get('k') : (allowed.includes(getStudentGrade()) ? getStudentGrade() : allowed[0]);
  let by = (params && params.get('by')) || 'bai';
  const pre = params && params.get('dang');
  const sel = { types: new Set(pre ? pre.split(',') : ['M', 'T', 'L']), md: new Set(STD_MD), img: false };
  let chosen = null; // các bài/chủ đề đang chọn (reset khi đổi khối hoặc cách chọn)
  if (params && params.get('bai')) { by = 'bai'; chosen = new Set([params.get('bai')]); }
  const keyOf = q => by === 'bai' ? (q.k === '10' ? (q.bai || q.cd) : q.bai) : q.cd;
  const pool = () => bank.q.filter(q => q.k === k && (by === 'dang' || chosen.has(keyOf(q))) && sel.types.has(q.t)
    && (q.t === 'T' || !STD_MD.includes(q.md) || sel.md.has(q.md)) && (!sel.img || hasImg(q)));
  const draw = () => {
    const tps = by === 'cd' ? topicsOf(k) : by === 'bai' ? lessonsOf(k) : [];
    if (!chosen) chosen = new Set(by === 'cd' ? tps : tps.slice(0, 1));
    const inK = bank.q.filter(q => q.k === k);
    const gradeTabs = allowed.length > 1
      ? `<div class="tabs">${allowed.map(x => `<button data-k="${x}" class="${x === k ? 'on' : ''}">Lớp ${x}</button>`).join('')}</div>`
      : `<div class="pill info" style="margin-bottom:12px;font-size:14px;padding:8px 12px">🔒 <b>Học sinh Khối ${k}</b>: chỉ hiển thị nội dung chương trình <b>Lớp ${k}</b>.</div>`;
    setView(`<h1>Tự chọn nội dung ôn luyện</h1><p class="sub">Em chọn ôn theo <b>bài học</b>, theo <b>chủ đề</b> hoặc theo <b>dạng câu hỏi</b> (trắc nghiệm, Đúng/Sai, tự luận, câu có hình vẽ).</p>
      ${gradeTabs}
      <div class="startbar"><div class="pickinfo grow" id="cnt"></div><button class="btn" id="go">▶ Bắt đầu làm</button></div>
      <div id="msg"></div>
      <div class="card">
        <label>1. Ôn theo</label>
        <div class="tabs" style="margin-bottom:6px"><button data-by="bai" class="${by === 'bai' ? 'on' : ''}">📖 Bài học</button><button data-by="cd" class="${by === 'cd' ? 'on' : ''}">🎯 Chủ đề</button><button data-by="dang" class="${by === 'dang' ? 'on' : ''}">🧩 Dạng câu</button></div>
        ${by === 'dang' ? `<p class="hint">Lấy câu hỏi từ toàn bộ chương trình Lớp ${k}, chỉ lọc theo dạng câu và mức độ bên dưới.</p>` : `
        <div class="row" style="margin-top:6px"><b class="grow">${by === 'cd' ? 'Chủ đề' : 'Bài học (SGK)'}</b><button type="button" class="btn ghost sm" id="allTp">Chọn tất cả</button><button type="button" class="btn ghost sm" id="noTp">Bỏ chọn</button></div>
        <div class="lessonlist" id="tp">${tps.map(t => `<label class="lchk"><input type="checkbox" value="${esc(t)}" ${chosen.has(t) ? 'checked' : ''}><span class="grow">${esc(t.replace(/^Lớp \d+ – /, ''))}</span><span class="n">${inK.filter(q => keyOf(q) === t).length}</span></label>`).join('') || '<div class="empty">Chưa có câu hỏi cho khối này</div>'}</div>`}
        <label>2. Dạng câu hỏi</label>
        <div class="typegrid" id="ty">${['M', 'T', 'L'].map(t => { const n = inK.filter(q => q.t === t).length; return `<label class="tycard${sel.types.has(t) ? ' on' : ''}${n ? '' : ' none'}"><input type="checkbox" value="${t}" ${sel.types.has(t) ? 'checked' : ''}><span class="ic">${TYPE_ICON[t]}</span><b>${TYPE_NAME[t]}</b><span class="hint">${n ? n + ' câu' : 'Chưa có câu'}</span></label>`; }).join('')}</div>
        <label class="chk" style="margin-top:10px"><input type="checkbox" id="img" ${sel.img ? 'checked' : ''}>🖼️ Chỉ lấy câu có hình vẽ (bản vẽ, sơ đồ, hình minh hoạ) <span class="pill">${inK.filter(hasImg).length}</span></label>
        <label>3. Mức độ</label><div class="checks" id="md">${STD_MD.map(m => `<label class="chk"><input type="checkbox" value="${m}" ${sel.md.has(m) ? 'checked' : ''}>${m}</label>`).join('')}</div>
        <p class="hint" style="margin-top:4px">Câu Đúng/Sai gồm cả 3 mức độ (a: Biết, b: Hiểu, c–d: Vận dụng) nên luôn được tính.</p>
        <label for="n">4. Số câu</label><select id="n"><option value="all" selected>Toàn bộ câu phù hợp</option>${[10, 20, 30, 40].map(n => `<option value="${n}">${n} câu (ngẫu nhiên)</option>`).join('')}</select>
        <div style="margin-top:14px"><button class="btn block ghost" id="go2">▶ Bắt đầu làm</button></div></div>`);
    const update = () => {
      const p = pool(), c = t => p.filter(q => q.t === t).length;
      const lim = $('#n') && $('#n').value !== 'all' ? Math.min(p.length, +$('#n').value) : 0;
      $('#cnt').innerHTML = !p.length ? 'Chưa có câu nào phù hợp với lựa chọn.' : lim
        ? `Sẽ làm <b>${lim}</b> câu ngẫu nhiên (trong ${p.length} câu phù hợp)`
        : `Đã chọn <b>${p.length}</b> câu: ${['M', 'T', 'L'].filter(t => c(t)).map(t => `${TYPE_ICON[t]} ${c(t)} ${t === 'M' ? 'trắc nghiệm' : t === 'T' ? 'Đúng/Sai' : 'tự luận'}`).join(' · ')}`;
    };
    $$('[data-k]').forEach(b => b.onclick = () => { k = b.dataset.k; chosen = null; draw(); });
    $$('[data-by]').forEach(b => b.onclick = () => { by = b.dataset.by; chosen = null; draw(); });
    $$('#tp input').forEach(i => i.onchange = () => { i.checked ? chosen.add(i.value) : chosen.delete(i.value); update(); });
    if ($('#allTp')) { $('#allTp').onclick = () => { tps.forEach(t => chosen.add(t)); draw(); }; $('#noTp').onclick = () => { chosen.clear(); draw(); }; }
    $$('#ty input').forEach(i => i.onchange = () => { i.checked ? sel.types.add(i.value) : sel.types.delete(i.value); i.closest('.tycard').classList.toggle('on', i.checked); update(); });
    $$('#md input').forEach(i => i.onchange = () => { i.checked ? sel.md.add(i.value) : sel.md.delete(i.value); update(); });
    $('#img').onchange = e => { sel.img = e.target.checked; update(); };
    $('#n').onchange = update;
    update();
    if ($('#go2')) $('#go2').onclick = () => $('#go').click();
    $('#go').onclick = () => {
      const p = pool();
      if (!p.length) {
        errBox($('#msg'), sel.types.size === 1 && sel.types.has('L') && !inK.some(q => q.t === 'L') ? `Ngân hàng chưa có câu tự luận Lớp ${k}. Thầy cô có thể bổ sung ở mục "Thêm câu hỏi".` : 'Không có câu hỏi phù hợp. Hãy chọn thêm ' + (by === 'dang' ? 'dạng câu' : by === 'cd' ? 'chủ đề' : 'bài học') + ' hoặc mức độ.');
        return;
      }
      const numVal = $('#n').value;
      const ids = numVal === 'all' ? p.map(q => q.id) : shuffle(p).slice(0, +numVal).map(q => q.id);
      const names = [...sel.types].map(t => TYPE_NAME[t]).join(', ');
      const one = [...chosen || []];
      const title = by === 'dang' ? `Ôn dạng ${names.toLowerCase()} – Lớp ${k}` : (by === 'bai' && one.length === 1 ? 'Ôn ' + one[0] : (by === 'cd' && one.length === 1 ? 'Ôn chủ đề: ' + one[0].replace(/^Lớp \d+ – /, '') : (by === 'bai' ? 'Ôn bài học' : 'Ôn chủ đề') + ' – Lớp ' + k));
      startQuiz({ title: title + (sel.img ? ' (câu có hình)' : ''), key: '', loai: 'chude', ids, minutes: numVal === 'all' ? Math.min(150, estMin(ids)) : 0 });
    };
  };
  draw();
});

route(/^\/sotay$/, () => {
  const w = store.get('wrong_' + uid(), {});
  const ids = Object.keys(w).filter(id => bank.byId[id]);
  setView(`<h1>Sổ tay câu sai</h1><p class="sub">Câu nào em làm đúng 2 lần liên tiếp sẽ tự rời khỏi sổ tay.</p>
    ${ids.length ? `<div class="card"><div class="row"><div class="grow"><b>${ids.length} câu cần ôn lại</b></div><button class="btn" id="go">Ôn ${Math.min(ids.length, 30)} câu</button></div></div>
    <div class="list">${ids.slice(0, 60).map(id => { const q = bank.byId[id]; return `<div class="item"><div class="grow"><div>${esc(plain(q.s).slice(0, 140))}</div><div class="meta">${esc(q.cd)} · ${'●'.repeat(w[id])}${'○'.repeat(2 - w[id])}</div></div></div>`; }).join('')}</div>`
    : '<div class="card empty">Tuyệt vời! Sổ tay đang trống.</div>'}`);
  if (ids.length) $('#go').onclick = () => startQuiz({ title: 'Ôn lại câu sai', key: '', loai: 'causai', ids: shuffle(ids).slice(0, 30), minutes: 0 });
});

/* ================= Làm bài ================= */
function startQuiz(o) {
  const ids = o.ids.filter(id => bank.byId[id]);
  if (!ids.length) { toast('Không có câu hỏi'); return; }
  const cur = store.get('attempt_' + uid(), null);
  if (cur && !cur.done && cur.ids.length && !confirm('Em đang làm dở "' + cur.title + '". Bỏ bài đó để làm bài mới?')) { location.hash = '#/lambai'; return; }
  // Phần I (nhiều lựa chọn), Phần II (Đúng/Sai), Phần III (tự luận); đảo thứ tự câu trong từng phần
  const mc = ids.filter(id => bank.byId[id].t === 'M'), tf = ids.filter(id => bank.byId[id].t === 'T'), es = ids.filter(id => bank.byId[id].t === 'L');
  // o.keep: làm đúng đề gốc (giữ thứ tự câu và phương án); mặc định đảo câu trong từng phần và đảo phương án
  const order = o.keep ? [...mc, ...tf, ...es] : [...shuffle(mc), ...shuffle(tf), ...shuffle(es)];
  const perm = {};
  order.forEach(id => { const q = bank.byId[id]; if (q.t === 'M') perm[id] = q.nd || o.keep ? [0, 1, 2, 3] : shuffle([0, 1, 2, 3]); });
  const a = { attemptId: newId(), title: o.title, key: o.key || '', loai: o.loai, ids: order, perm, resp: {}, flags: {}, cur: 0,
    start: Date.now(), minutes: +o.minutes || 0, hints: o.hints !== false, done: false, tlw: +o.tlw || 0, note: o.note || '', dm: o.dm || '' };
  store.set('attempt_' + uid(), a);
  location.hash = '#/lambai';
}
function qHtml(q, a, i, review) {
  const total = a.ids.length;
  const r = a.resp[q.id];
  let body = '';
  if (q.t === 'L') {
    body = review ? (review.mine ? `<div class="essay-ans"><div class="lbl">Bài làm của em</div>${r && String(r).trim() ? esc(r) : '<i class="hint">(Bỏ trống)</i>'}</div>` : '')
      : `<textarea class="essay" id="essay" maxlength="3000" placeholder="Nhập câu trả lời của em… (trình bày theo ý, có thể xuống dòng)">${esc(r || '')}</textarea>
        <div class="hint" id="ecount">${String(r || '').length}/3000 ký tự · bài được AI chấm sau khi nộp</div>`;
  } else if (q.t === 'M') {
    const p = a.perm[q.id] || [0, 1, 2, 3];
    const ans = normAns(q);
    body = '<div class="opts">' + p.map((oi, j) => {
      const L = LETTERS[oi];
      let cls = r === L ? ' sel' : '';
      if (review) cls = L === ans && review.showAns ? ' right' : (r === L && L !== ans ? ' wrong' : (r === L ? ' right' : ''));
      return `<button class="opt${cls}" data-o="${L}" ${review ? 'disabled' : ''}><span class="L">${LETTERS[j]}</span><span class="tx">${sanitize(q.o[oi])}</span></button>`;
    }).join('') + '</div>';
  } else {
    const ans = normAns(q);
    body = '<div class="tf">' + [0, 1, 2, 3].map(k => {
      const v = (r || [])[k];
      let cls = '';
      if (review && v) cls = v === ans[k] ? ' right' : ' wrong';
      return `<div class="tfi${cls}"><div class="tx"><b class="k">${'abcd'[k]})</b>${sanitize(q.o[k])}</div>
        <div class="tfb"><button class="d${v === 'Đ' ? ' on' : ''}" data-k="${k}" data-v="Đ" ${review ? 'disabled' : ''}>Đúng</button><button class="s${v === 'S' ? ' on' : ''}" data-k="${k}" data-v="S" ${review ? 'disabled' : ''}>Sai</button></div>
        ${review && review.showAns && v !== ans[k] ? `<div class="hint">Đáp án: <b>${ans[k] === 'Đ' ? 'Đúng' : 'Sai'}</b></div>` : ''}</div>`;
    }).join('') + '</div>';
  }
  return `<div class="qcard"><div class="qhead"><span class="qnum">Câu ${i + 1}/${total}</span><span>${q.t === 'T' ? 'Đúng/Sai' : q.t === 'L' ? 'Tự luận' : 'Nhiều lựa chọn'}${q.md && q.t !== 'T' ? ' · ' + esc(q.md) : ''}${q.t === 'L' ? ' · ' + fmt(q.p || 1) + ' điểm' : ''}</span></div>
    <div class="stem">${sanitize(q.s)}</div>${body}</div>`;
}
route(/^\/lambai$/, () => {
  const K = 'attempt_' + uid();
  const a = store.get(K, null);
  if (!a || a.done) { const L0 = store.get('last', null); location.hash = a && a.done && L0 && L0.attemptId === a.attemptId ? '#/ketquabai' : '#/'; return; }
  let tick = null;
  const deadline = a.minutes ? a.start + a.minutes * 60000 : 0;
  const save = () => store.set(K, a);
  const answered = id => { const q = bank.byId[id], r = a.resp[id]; return q.t === 'M' ? !!r : q.t === 'L' ? !!String(r || '').trim() : (r || []).filter(Boolean).length === 4; };
  const parts = ['M', 'T', 'L'].filter(t => a.ids.some(x => bank.byId[x].t === t));
  const draw = () => {
    const id = a.ids[a.cur], q = bank.byId[id];
    const n = a.ids.filter(answered).length;
    const sectStart = a.ids.findIndex(x => bank.byId[x].t === q.t);
    setView(`<div class="qbar"><div class="title">${esc(a.title)}</div><span class="timer" id="tm">${deadline ? mmss((deadline - Date.now()) / 1000) : mmss((Date.now() - a.start) / 1000)}</span>
      <button class="btn accent sm" id="sub">Nộp bài</button></div>
      <div class="progress"><i style="width:${n / a.ids.length * 100}%"></i></div>
      ${parts.length > 1 && a.cur === sectStart ? `<div class="secttl">Phần ${['I', 'II', 'III'][parts.indexOf(q.t)]} – ${q.t === 'M' ? 'Nhiều lựa chọn' : q.t === 'T' ? 'Đúng/Sai' : 'Tự luận'}</div>` : ''}
      ${qHtml(q, a, a.cur)}
      <div class="nav"><button class="btn ghost" id="pv" ${a.cur === 0 ? 'disabled' : ''}>← Trước</button>
        <button class="btn ghost" id="fl" title="Đánh dấu xem lại">${a.flags[id] ? '★' : '☆'}</button>
        <button class="btn" id="nx">${a.cur === a.ids.length - 1 ? 'Xem lại' : 'Sau →'}</button></div>
      <div class="pal">${a.ids.map((x, i) => `<button data-j="${i}" class="${answered(x) ? 'done' : ''}${a.flags[x] ? ' flag' : ''}${i === a.cur ? ' cur' : ''}">${i + 1}</button>`).join('')}</div>`);
    $$('.opt').forEach(b => b.onclick = () => { a.resp[id] = b.dataset.o; save(); setTimeout(() => { if (a.ids[a.cur] !== id || !$('.qcard')) return; if (a.cur < a.ids.length - 1) { a.cur++; save(); } draw(); }, 180); $$('.opt').forEach(x => x.classList.toggle('sel', x === b)); });
    const ta = $('#essay');
    if (ta) ta.oninput = () => { a.resp[id] = ta.value; save(); $('#ecount').textContent = ta.value.length + '/3000 ký tự · bài được AI chấm sau khi nộp'; const pb = $(`.pal button[data-j="${a.cur}"]`); if (pb) pb.classList.toggle('done', !!ta.value.trim()); };
    $$('.tfb button').forEach(b => b.onclick = () => { const r = a.resp[id] || [null, null, null, null]; r[+b.dataset.k] = b.dataset.v; a.resp[id] = r; save(); draw(); });
    $('#pv').onclick = () => { a.cur--; save(); draw(); };
    $('#nx').onclick = () => { if (a.cur < a.ids.length - 1) { a.cur++; save(); draw(); } else { const k = a.ids.findIndex(x => !answered(x)); if (k >= 0) { a.cur = k; save(); draw(); toast('Còn câu chưa làm'); } else toast('Em đã làm hết. Bấm "Nộp bài" khi sẵn sàng.'); } };
    $('#fl').onclick = () => { a.flags[id] = !a.flags[id]; save(); draw(); };
    $$('.pal button').forEach(b => b.onclick = () => { a.cur = +b.dataset.j; save(); draw(); });
    $('#sub').onclick = () => {
      const left = a.ids.length - a.ids.filter(answered).length;
      if (confirm(left ? `Em còn ${left} câu chưa làm xong. Vẫn nộp bài?` : 'Nộp bài ngay?')) finish();
    };
  };
  let finished = false;
  const finish = () => {
    if (finished) return; finished = true;
    clearInterval(tick);
    const g = grade(a.ids, a.resp, {}, a.tlw || 0);
    const seconds = Math.round(((deadline ? Math.min(Date.now(), deadline) : Date.now()) - a.start) / 1000);
    a.done = true; save();
    // sổ tay câu sai
    const wk = 'wrong_' + uid(); const w = store.get(wk, {});
    a.ids.forEach(id => { if (!g.detail[id] || g.detail[id].pending) return; if (g.detail[id].ok) { if (w[id] != null) { w[id]++; if (w[id] >= 2) delete w[id]; } } else w[id] = 0; });
    store.set(wk, w);
    const hk = 'hist_' + uid(); const hist = store.get(hk, []);
    hist.push({ attemptId: a.attemptId, t: Date.now(), title: a.title, key: a.key, loai: a.loai, diem: g.diem, dung: g.dung, tong: g.tong, giay: seconds, dm: a.dm || '' });
    store.set(hk, hist.slice(-300));
    const dk = 'days_' + uid(); const days = store.get(dk, []); if (!days.includes(today())) { days.push(today()); store.set(dk, days.slice(-400)); }
    const answers = {}; a.ids.forEach(id => { answers[id] = respStr(bank.byId[id], a.resp[id]); });
    const last = { attemptId: a.attemptId, title: a.title, key: a.key, loai: a.loai, ids: a.ids, perm: a.perm, resp: a.resp, hints: a.hints, dm: a.dm || '',
      diem: g.diem, dung: g.dung, tong: g.tong, sai: g.sai, detail: g.detail, seconds, synced: false,
      tl: {}, tlw: a.tlw || 0, pendingTL: g.pending.length ? g.pending : null, selfTL: !!g.pending.length && (DEMO || !session || session.role !== 'hs') };
    saveLast(last);
    if (!DEMO && session && session.role === 'hs') {
      const q = store.get('queue', []);
      q.push({ attemptId: a.attemptId, key: a.key, loai: a.loai, title: a.title, seconds, answers, tlw: a.tlw || 0 });
      store.set('queue', q);
      flush();
    }
    location.hash = '#/ketquabai';
  };
  tick = setInterval(() => {
    const el = $('#tm'); if (!el) return;
    if (deadline) { const left = (deadline - Date.now()) / 1000; el.textContent = mmss(left); el.classList.toggle('low', left < 300); if (left <= 0) { toast('Hết giờ – bài đã được nộp tự động'); finish(); } }
    else el.textContent = mmss((Date.now() - a.start) / 1000);
  }, 1000);
  cleanup = () => clearInterval(tick);
  if (deadline && Date.now() >= deadline) { finish(); return; }
  draw();
});

/* ================= Kết quả & xem lại ================= */
function lbHtml(r) {
  if (!r) return '';
  if (r.hidden) return `<div class="card empty">${esc(r.hidden)}</div>`;
  if (!r.top || !r.top.length) return '<div class="card empty">Chưa có ai trong bảng xếp hạng.</div>';
  const medal = h => h === 1 ? '🥇' : h === 2 ? '🥈' : h === 3 ? '🥉' : h;
  const row = x => `<tr class="${x.la_em ? 'me' : ''}"><td class="medal">${medal(x.hang)}</td><td>${esc(x.ten)}${x.la_em ? ' ⭐' : ''}</td><td>${esc(x.lop)}</td><td class="n">${fmt(x.diem)}</td><td class="n">${mmss(x.giay)}</td></tr>`;
  const meOut = r.me && r.me.hang > 20;
  return `<div class="card"><div class="tablewrap"><table><thead><tr><th>#</th><th>Họ tên</th><th>Lớp</th><th class="n">Điểm</th><th class="n">T.gian</th></tr></thead><tbody>
    ${r.top.map(row).join('')}${meOut ? '<tr><td colspan="5" style="text-align:center;color:var(--muted)">⋯</td></tr>' + row(r.me) : ''}</tbody></table></div>
    <p class="hint">Xếp theo điểm, bằng điểm thì ai làm nhanh hơn đứng trước. ${r.total} học sinh khối ${esc(r.khoi || '')} đã tham gia.</p></div>`;
}
function saveRv(L) { const k = 'rv_' + uid(), a = store.get(k, []); const i = a.findIndex(x => x.attemptId === L.attemptId); if (i >= 0) { a[i] = L; store.set(k, a); } }
route(/^\/ketquabai$/, params => {
  const want = params && params.get('id');
  const last0 = store.get('last', null);
  const L = want && !(last0 && last0.attemptId === want) ? (store.get('rv_' + uid(), []).find(x => x.attemptId === want) || null) : last0;
  if (!L) { toast('Không tìm thấy bài làm này trên máy'); location.hash = '#/ketqua'; return; }
  const isLast = !!(last0 && last0.attemptId === L.attemptId);
  let filter = 'sai';
  const shown = {};
  const ranked = L.key && !DEMO;
  // chế độ điểm của bài giao: dapan (mặc định) | diem: chỉ biết điểm | calop: cả lớp nộp xong mới có điểm
  const dm = L.loai === 'baigiao' ? (L.dm || '') : '';
  const locked = () => dm === 'calop' && !L.released;
  const checkRelease = async btn => {
    if (DEMO || !session || session.role !== 'hs') return;
    const run = async () => {
      try {
        const l = await api('my_assignments'); store.set('asg_' + uid(), l);
        const x = l.find(b => b.MaBai === L.key);
        if (!x || !x.choDiem) { L.released = true; const hk = 'hist_' + uid(), h = store.get(hk, []), e = h.find(z => z.attemptId === L.attemptId); if (e) { e.rel = 1; store.set(hk, h); } }
        else L.cho = x.choDiem;
        if (isLast) saveLast(L); else saveRv(L);
        if (btn && !L.released) toast('Lớp chưa nộp đủ (' + L.cho.nop + '/' + L.cho.si + ' bạn). Em quay lại sau nhé.');
        if (L.released && L.synced !== false) try { L.rank = await api('leaderboard', { key: L.key }); } catch (e) {}
      } catch (e) { if (btn) toast(e.message); }
      if (V.isConnected) draw();
    };
    if (btn) await busy(btn, run); else await run();
  };
  const rankBox = () => {
    if (!ranked) return L.loai === 'chude' || L.loai === 'causai' || L.loai === 'matran' ? '<p class="hint">Bảng xếp hạng chỉ có ở bài theo đề thi thử và bài thầy cô giao.</p>' : '';
    if (L.rank) return lbHtml(L.rank);
    if (L.syncError) return `<div class="err">${esc(L.syncError)}</div>`;
    return `<div class="card empty">${navigator.onLine ? 'Đang gửi bài và xếp hạng…' : '📴 Em đang ngoại tuyến. Bài đã được lưu và sẽ tự gửi khi có mạng.'}</div>`;
  };
  const tlBanner = () => {
    if (!L.pendingTL) return '';
    const n = L.pendingTL.length;
    const failed = L.pendingTL.some(id => L.tl && L.tl[id] && L.tl[id].cho_cham);
    if (L.selfTL) return `<div class="card note">✍️ Bài có <b>${n} câu tự luận</b>. Chế độ này chưa có AI chấm: em hãy đối chiếu <b>đáp án mẫu</b> ở phần xem lại và bấm tự chấm để có điểm đầy đủ.</div>`;
    if (failed) return `<div class="card note">⚠️ AI chưa chấm được ${n} câu tự luận (có thể máy chủ chưa cài khóa Gemini hoặc hết lượt). Điểm trên chưa gồm các câu này${L.loai === 'baigiao' ? '; thầy cô sẽ xem lại bài' : ' – em có thể tự chấm theo đáp án mẫu bên dưới'}.</div>`;
    return `<div class="card note">${navigator.onLine ? `🤖 AI đang chấm <b>${n} câu tự luận</b> (khoảng 10–40 giây)…` : `📴 Đang ngoại tuyến – ${n} câu tự luận sẽ được AI chấm khi có mạng.`} Điểm hiện tại mới tính phần trắc nghiệm.</div>`;
  };
  const draw = () => {
    if (locked()) {
      setView(`<div class="hero"><div class="score"><div class="ring" style="--p:100"><div><b>✓</b><span>đã nộp</span></div></div>
        <div><h1>Em đã nộp bài! ✅</h1><p class="sub">${esc(L.title)}<br>Đã làm ${L.ids.filter(id => L.resp[id] != null && L.resp[id] !== '').length}/${L.ids.length} câu · ${mmss(L.seconds)}</p></div></div></div>
        ${L.syncError ? `<div class="err">${esc(L.syncError)}</div>` : !L.synced && !navigator.onLine ? '<div class="card note">📴 Em đang ngoại tuyến. Bài đã được lưu và sẽ tự gửi khi có mạng.</div>' : ''}
        <div class="card note">⏳ Thầy/cô cho bài này <b>chờ cả lớp nộp xong mới có điểm</b>${L.cho ? ` (lớp đã nộp <b>${L.cho.nop}/${L.cho.si}</b> bạn)` : ''}. Điểm, đáp án và bảng xếp hạng sẽ hiện khi cả lớp đã nộp, đến hạn nộp hoặc khi thầy cô công bố điểm.</div>
        <div class="row" style="margin:14px 0"><button class="btn" id="chk">🔄 Xem đã có điểm chưa</button><span class="spacer"></span><a class="btn ghost" href="#/baigiao">Bài được giao</a><a class="btn ghost" href="#/">Trang chủ</a></div>`);
      $('#chk').onclick = e => checkRelease(e.currentTarget);
      return;
    }
    const myRank = L.rank && L.rank.me;
    const list = L.ids.filter(id => filter === 'all' || !L.detail[id].ok);
    const onlyScore = dm === 'diem';
    setView(`<div class="hero"><div class="score"><div class="ring" style="--p:${L.diem * 10}"><div><b>${fmt(L.diem)}</b><span>điểm</span></div></div>
      <div><h1>${L.diem >= 8 ? 'Xuất sắc! 🎉' : L.diem >= 6.5 ? 'Làm tốt lắm! 👍' : L.diem >= 5 ? 'Đạt yêu cầu 💪' : 'Cố gắng thêm nhé 📚'}</h1>
      <p class="sub">${esc(L.title)}<br>${L.pendingTL ? 'Điểm tạm (chưa gồm tự luận) · ' : ''}Đúng ${L.dung}/${L.tong} câu · ${mmss(L.seconds)}</p>
      ${myRank ? `<p class="sub" style="margin-top:6px;font-size:16px;color:#fff">📍 Hạng của em trong khối ${esc(L.rank.khoi)}: <b>${myRank.hang} / ${L.rank.total}</b></p>` : ''}</div></div></div>
      ${tlBanner()}
      ${ranked ? `<h2>🏆 Top 20 khối ${esc((session && session.user.Khoi) || '')}</h2>` : ''}<div id="rk">${rankBox()}</div>
      ${onlyScore ? `<div class="card note" style="margin-top:18px">📌 Thầy/cô cho bài này <b>chỉ xem điểm</b>, không xem đáp án. Em xem lại kiến thức trong SGK và hỏi thầy cô ở lớp nhé.</div>
      <div class="row" style="margin:12px 0 6px"><span class="spacer"></span><a class="btn ghost" href="#/baigiao">Bài được giao</a><a class="btn ghost" href="#/">Trang chủ</a></div>` : `
      <div class="row" style="margin:18px 0 6px"><a class="btn" href="javascript:void 0" id="torv">📝 Xem lại bài làm</a><button class="btn accent" id="again" ${L.sai.length ? '' : 'disabled'}>🔁 Làm lại ${L.sai.length} câu sai</button>
        ${L.loai !== 'baigiao' ? '<button class="btn ghost" id="redo">🔀 Làm lại cả bài (đảo câu, đảo đáp án)</button>' : ''}<span class="spacer"></span><a class="btn ghost" href="#/">Trang chủ</a></div>
      <h2 id="rvh">Xem lại bài làm</h2>
      <div class="tabs"><button data-f="sai" class="${filter === 'sai' ? 'on' : ''}">Cần xem lại (${L.ids.filter(id => !L.detail[id].ok).length})</button><button data-f="all" class="${filter === 'all' ? 'on' : ''}">Tất cả (${L.ids.length})</button></div>
      <div id="rv">${list.length ? list.map(id => reviewHtml(id)).join('') : '<div class="card empty">Không có câu sai. Giỏi quá!</div>'}</div>`}`);
    if (onlyScore) return;
    $$('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; draw(); });
    $('#torv').onclick = () => { const h = $('#rvh'); if (h) window.scrollTo({ top: h.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' }); };
    $('#again').onclick = () => startQuiz({ title: 'Làm lại câu sai – ' + L.title, key: '', loai: 'causai', ids: L.sai, minutes: 0, hints: L.hints });
    if ($('#redo')) $('#redo').onclick = () => startQuiz({ title: L.title, key: L.key, loai: L.loai, ids: L.ids, minutes: L.loai === 'de' || L.loai === 'matran' ? 50 : 0 });
    $$('[data-h]').forEach(b => b.onclick = () => { shown[b.dataset.h] = Math.max(shown[b.dataset.h] || 0, +b.dataset.lv); draw(); });
    $$('[data-self]').forEach(b => b.onclick = () => {
      const id = b.dataset.self, q = bank.byId[id];
      applyTL(L, { [id]: { diem: +b.dataset.v, max: q.p || 1, self: true, nhan_xet: '' } }); if (isLast) saveLast(L); else saveRv(L); draw();
    });
  };
  const essayHtml = (q, id, i, hintAllowed) => {
    const x = (L.tl || {})[id], mx = q.p || 1;
    const canSelf = L.loai !== 'baigiao' && (L.selfTL || (x && x.cho_cham) || (x && x.self));
    const list = (arr, cls, mark) => (arr || []).length ? `<div class="${cls}">${arr.map(v => mark + ' ' + esc(v)).join('<br>')}</div>` : '';
    const ai = x && !x.cho_cham ? `<div class="expl ai"><b class="t">${x.self ? '✍️ Em tự chấm' : '🤖 AI chấm'}: ${fmt(x.diem)}/${fmt(x.max || mx)} điểm</b>${x.nhan_xet ? esc(x.nhan_xet) : ''}${list(x.y_dung, 'ok-list', '✔')}${list(x.y_thieu, 'miss-list', '✘')}</div>`
      : (x && x.cho_cham ? `<div class="hint">AI chưa chấm được câu này${x.loi ? ' (' + esc(x.loi) + ')' : ''}.</div>`
        : (L.pendingTL && !L.selfTL ? '<div class="hint">🤖 Đang chờ AI chấm…</div>' : ''));
    const model = hintAllowed ? `<div class="expl ans"><b class="t">Đáp án mẫu</b>${sanitize(q.a)}${q.e ? `<div style="margin-top:6px"><b>Hướng dẫn chấm:</b> ${sanitize(q.e)}</div>` : ''}</div>` : '';
    const self = canSelf ? `<div class="row" style="margin-top:8px"><span class="hint">Tự chấm theo đáp án mẫu:</span>${[0, 0.25, 0.5, 0.75, 1].map(f => `<button class="btn ghost sm${x && x.self && +x.diem === f * mx ? ' on' : ''}" data-self="${id}" data-v="${f * mx}">${fmt(f * mx)} đ</button>`).join('')}</div>` : '';
    return `<div style="margin-bottom:12px">${qHtml(q, { ids: L.ids, perm: L.perm, resp: L.resp }, i, { showAns: true, mine: true })}${ai}${model}${self}${sgkLink(q)}</div>`;
  };
  const reviewHtml = id => {
    const q = bank.byId[id]; if (!q) return '';
    const i = L.ids.indexOf(id), ok = L.detail[id] && L.detail[id].ok, lv = shown[id] || (ok ? 2 : 0);
    const hintAllowed = L.hints !== false;
    if (q.t === 'L') return essayHtml(q, id, i, hintAllowed);
    const expl = q.t === 'T' ? (q.e || []).map((e, k) => e ? `<div><b>${'abcd'[k]})</b> ${sanitize(e)}</div>` : '').join('') : sanitize(q.e || '');
    const hint = q.h ? sanitize(q.h) : expl;
    return `<div style="margin-bottom:12px">${qHtml(q, { ids: L.ids, perm: L.perm, resp: L.resp }, i, { showAns: lv >= 2 })}
      ${ok ? '<div class="okmsg">✔ Em làm đúng câu này</div>' : `<div class="row" style="margin-top:8px">${hintAllowed ? `${lv < 1 ? `<button class="btn ghost sm" data-h="${id}" data-lv="1">💡 Gợi ý</button>` : ''}${lv < 2 ? `<button class="btn ghost sm" data-h="${id}" data-lv="2">Xem đáp án</button>` : ''}` : '<span class="hint">Thầy/cô đã tắt gợi ý cho bài này.</span>'}</div>`}
      ${hintAllowed && lv === 1 && hint ? `<div class="expl"><b class="t">💡 Gợi ý</b>${hint}</div>` : ''}
      ${hintAllowed && lv >= 2 ? `<div class="expl ans"><b class="t">Đáp án: ${q.t === 'M' ? 'phương án có nội dung được tô xanh' : esc(normAns(q).split('').map((x, k) => 'abcd'[k] + ') ' + (x === 'Đ' ? 'Đúng' : 'Sai')).join('; '))}</b>${expl}</div>` : ''}${ok ? '' : sgkLink(q)}</div>`;
  };
  const onSync = e => {
    if (!isLast || e.detail.attemptId !== L.attemptId) return;
    const fresh = store.get('last', null);
    if (fresh && fresh.attemptId === L.attemptId) Object.assign(L, fresh);
    if (e.detail.rank) L.rank = e.detail.rank; if (e.detail.error) L.syncError = e.detail.error;
    if (locked() && e.detail.rank && !e.detail.rank.choDiem) { checkRelease(); return; }
    draw();
  };
  document.addEventListener('synced', onSync);
  cleanup = () => document.removeEventListener('synced', onSync);
  draw();
  if (locked() && navigator.onLine && (L.synced || !isLast)) checkRelease();
});

route(/^\/bxh$/, async params => {
  const key = params.get('key'), title = params.get('t') || '';
  let scope = 'khoi';
  const draw = async () => {
    setView(`<h1>🏆 Bảng xếp hạng</h1><p class="sub">${esc(title)}</p>
      <div class="tabs"><button data-s="khoi" class="${scope === 'khoi' ? 'on' : ''}">Khối</button><button data-s="lop" class="${scope === 'lop' ? 'on' : ''}">Lớp em</button></div><div id="lb"><div class="card empty">Đang tải…</div></div>`);
    $$('[data-s]').forEach(b => b.onclick = () => { scope = b.dataset.s; draw(); });
    try { ($('#lb') || {}).innerHTML = lbHtml(await api('leaderboard', { key, scope })); } catch (e) { errBox($('#lb'), e); }
  };
  draw();
});

route(/^\/ketqua$/, async () => {
  const rvs = store.get('rv_' + uid(), []).slice().reverse();
  const hid = x => x.loai === 'baigiao' && x.dm === 'calop' && !x.released && !x.rel;
  const rvHtml = rvs.length ? `<h2>📝 Xem lại bài đã làm</h2><div class="list compact">${rvs.map(x => `<a class="item" href="#/ketquabai?id=${encodeURIComponent(x.attemptId)}"><div class="grow"><b>${esc(x.title)}</b><div class="meta">${dt(x.t)} · ${hid(x) ? '⏳ chờ cả lớp nộp mới có điểm' : x.loai === 'baigiao' && x.dm === 'diem' ? fmt(x.diem) + ' điểm (chỉ xem điểm)' : fmt(x.diem) + ' điểm · đúng ' + x.dung + '/' + x.tong}</div></div><span class="btn ghost sm">${hid(x) ? 'Xem ›' : x.loai === 'baigiao' && x.dm === 'diem' ? 'Xem ›' : 'Xem lại ›'}</span></a>`).join('')}</div><h2>Điểm các lượt</h2>` : '';
  setView('<h1>Kết quả của em</h1><p class="sub">Điểm các lượt làm bài, mới nhất ở trên.</p>' + rvHtml + '<div id="r"><div class="card empty">Đang tải…</div></div>');
  let rows;
  try { rows = await api('my_results'); }
  catch (e) { rows = store.get('hist_' + uid(), []).slice().reverse().map(h => ({ t: h.t, bai: h.title, diem: h.diem, dung: h.dung, tong: h.tong, giay: h.giay, an: hid(h) ? 1 : 0 })); }
  if (!rows.length) { ($('#r') || {}).innerHTML = '<div class="card empty">Em chưa làm bài nào.<div style="margin-top:12px"><a class="btn" href="#/onluyen">Bắt đầu ôn luyện</a></div></div>'; return; }
  const ds = rows.filter(r => !r.an).map(r => +r.diem || 0), avg = ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : 0;
  ($('#r') || {}).innerHTML = `<div class="kpis"><div class="kpi"><b>${rows.length}</b><span>lượt đã làm</span></div><div class="kpi"><b>${fmt(avg)}</b><span>điểm trung bình</span></div><div class="kpi"><b>${ds.length ? fmt(Math.max(...ds)) : '–'}</b><span>điểm cao nhất</span></div></div>
    ${ds.length > 1 ? `<div class="card"><b>Điểm 20 lượt gần nhất</b><div style="margin-top:8px">${spark(ds.slice(0, 20).reverse())}</div></div>` : ''}
    <div class="card"><div class="tablewrap"><table><thead><tr><th>Thời điểm</th><th>Bài</th><th class="n">Điểm</th><th class="n">Đúng</th><th class="n">T.gian</th></tr></thead>
    <tbody>${rows.map(r => r.an ? `<tr><td>${dt(r.t)}</td><td>${esc(r.bai)}</td><td class="n" colspan="2"><span class="pill warn">⏳ Chờ cả lớp nộp</span></td><td class="n">${mmss(r.giay)}</td></tr>` : `<tr><td>${dt(r.t)}</td><td>${esc(r.bai)}</td><td class="n"><b>${fmt(r.diem)}</b></td><td class="n">${r.dung}/${r.tong}</td><td class="n">${mmss(r.giay)}</td></tr>`).join('')}</tbody></table></div></div>`;
});

route(/^\/hoso$/, () => {
  if (!session || session.role !== 'hs') { location.hash = '#/'; return; }
  const u = session.user;
  setView(`<div class="auth"><h1>Hồ sơ của em</h1><form class="card" id="f">
    <label>Tên đăng nhập</label><input type="text" value="${esc(u.TenDN)}" disabled>
    <label>Lớp</label><input type="text" value="${esc(u.TenLop + ' (khối ' + u.Khoi + ')')}" disabled>
    <label for="n">Họ và tên</label><input id="n" type="text" maxlength="60" value="${esc(u.HoTen)}">
    <label for="s">Trường</label><input id="s" type="text" maxlength="80" value="${esc(u.Truong)}">
    <label for="em">Email <span class="hint">(để lấy lại mật khẩu khi quên)</span></label><input id="em" type="email" maxlength="80" value="${esc(u.Email || '')}" placeholder="vd: an123@gmail.com">
    ${u.Email ? '' : '<div class="hint">⚠️ Em chưa có email: nếu quên mật khẩu sẽ phải nhờ thầy cô đặt lại.</div>'}
    <div id="msg"></div><div class="row" style="margin-top:14px"><button class="btn">Lưu</button><a class="btn ghost" href="#/doimk">Đổi mật khẩu</a></div></form></div>`);
  $('#f').onsubmit = async e => {
    e.preventDefault();
    await busy($('#f .btn'), async () => {
      try { session.user = await api('update_profile', { name: $('#n').value, school: $('#s').value, email: $('#em').value }); setSession(session); ($('#msg') || {}).innerHTML = '<div class="okmsg">Đã lưu</div>'; }
      catch (err) { errBox($('#msg'), err); }
    });
  };
});

/* ================= GIÁO VIÊN ================= */
function needGV() { if (!isGV()) { location.hash = '#/'; return false; } return true; }
function csv(name, rows) {
  const s = '﻿' + rows.map(r => r.map(v => { v = v == null ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const joinLink = code => location.origin + location.pathname + '#/dangky?lop=' + code;

/* ================= Trang chủ Giáo viên (gọn: Quản lý học sinh + Hỗ trợ dạy học theo khối) ================= */
const GV_APPS = k => {
  const A = (href, ic, c, t, d, who) => ({ href, ic, c, t, d, who });
  const sgk = window.STC_SGK ? [A('#/sgk?k=' + k, '📘', '', 'Sách giáo khoa ' + k, 'Mở đúng bài để trình chiếu', 'GV·HS')] : [];
  const show = {
    '10': [A('#/hcvg', '📐', 'amber', 'Bài 9. Hình chiếu vuông góc', 'Mô hình 3D: góc chiếu 1, góc chiếu 3, lật mặt phẳng', 'GV·HS'),
      A('#/hcat', '✂️', 'red', 'Bài 10. Hình cắt và mặt cắt', 'Cắt vật thể 3D, mặt cắt rời, mặt cắt chập', 'GV·HS'),
      A('#/hctd', '🧊', 'green', 'Bài 11. Hình chiếu trục đo', 'Dựng hình từng bước: vuông góc đều, xiên góc cân', 'GV·HS'),
      A('#/hcpc', '🛤️', '', 'Bài 12. Hình chiếu phối cảnh', 'Hiệu ứng điểm tụ: 1 điểm tụ, 2 điểm tụ', 'GV·HS'),
      A('#/hinhchieu', '🔄', '', 'Hình chiếu 3D', 'Xoay vật thể 360°, tìm hình chiếu đúng', 'GV·HS')],
    '11': [], '12': []
  }[k];
  const hs = [
    ...(k === '12' ? [A('#/thitn', '🎓', 'green', 'Bộ đề luyện thi TN THPT', 'Mỗi lần mở đảo câu và đáp án', 'HS')] : []),
    A('#/chude?by=bai&k=' + k, '📖', '', 'Ôn theo bài học', 'Câu hỏi từng bài SGK Lớp ' + k + ', chấm ngay', 'HS'),
    A('#/dinhki?k=' + k, '📑', 'amber', 'Đề kiểm tra định kì', 'Giữa kì, cuối kì theo ma trận', 'HS'),
    ...(k === '10' ? [A('#/gocchieu', '🎯', 'amber', 'Góc chiếu 1 & 3 – luyện thêm', 'Nhận biết, xếp hình chiếu nhiều vật thể', 'HS')] : [])
  ];
  const gv = [
    ...(k === '12' ? [A('#/gv/thitn', '📊', 'green', 'Quản lý đề luyện thi TN', 'Kết quả từng đề, câu HS hay sai', 'GV')] : []),
    A('#/gv/aisoancau?k=' + k, '🤖', 'green', 'AI soạn câu hỏi', 'Soạn câu mới theo bài, mức độ; GV duyệt', 'GV'),
    A('#/gv/matran?k=' + k, '🧾', 'amber', 'Ma trận & đề kiểm tra', 'Ma trận GK, CK; sinh đề, in đề', 'GV'),
    A('#/gv/thietke?k=' + k, '💡', 'amber', 'Bài toán thiết kế (AI)', 'Bài toán STEM gắn địa phương', 'GV'),
    ...(k === '10' ? [A('#/gv/baive?k=10', '📷', '', 'Bài vẽ – AI chấm', 'Giao bài vẽ, HS chụp nộp, AI chấm', 'GV')] : []),
    A('#/gv/themcau', '✍️', '', 'Thêm câu hỏi', 'Trắc nghiệm, Đúng/Sai, tự luận', 'GV')
  ];
  return [['🖥️ Trình chiếu trên lớp', [...show, ...sgk, A('#/trochoi?k=' + k, '🎮', 'amber', 'Trò chơi khởi động', 'Đoán từ, ô chữ, lật ô đoán tranh', 'GV·HS')]],
    ['📚 Học sinh tự ôn luyện', hs], ['🧰 Công cụ cho giáo viên', gv]];
};
const appTile = a => `<a href="${a.href}"><span class="ic ${a.c}">${a.ic}</span><span class="tx"><b>${a.t}</b><span>${a.d}</span></span>${a.who ? `<span class="who ${a.who === 'GV' ? 'gv' : a.who === 'HS' ? 'hs' : ''}">${a.who}</span>` : ''}<span class="chev">›</span></a>`;
const gvClasses = async () => { if (!window._gvCls) window._gvCls = await api('my_classes'); return window._gvCls; };

route(/^\/gv$/, async params => {
  if (!needGV()) return;
  const u = session.user;
  let k = (params && params.get('khoi')) || store.get('gv_active_khoi', '10');
  if (!['10', '11', '12'].includes(k)) k = '10';
  let classes = window._gvCls || null;
  const nameOf = s => esc(String(s || '').trim().split(' ').slice(-2).join(' '));
  const draw = () => {
    const hs = (classes || []).reduce((s, c) => s + (+c.siSo || 0), 0);
    setView(`<section class="hero">
        <div class="greet"><div><h1>Chào thầy/cô ${nameOf(u.HoTen)} 👋</h1><p class="sub">${esc(u.Truong || '')}${session.role === 'admin' ? ' – Quản trị viên' : ''}</p></div></div>
        <div class="stats"><div class="stat"><b>${classes ? classes.length : '…'}</b><span>lớp</span></div><div class="stat"><b>${classes ? hs : '…'}</b><span>học sinh</span></div><div class="stat"><b>${bank.q.length.toLocaleString('vi-VN')}</b><span>câu hỏi</span></div></div>
      </section>
      <h2>👥 Quản lý học sinh</h2>
      <div class="rows applist">${[
        { href: '#/gv/lop', ic: '🏫', c: 'green', t: 'Các lớp', d: `${classes ? classes.length + ' lớp · ' + hs + ' học sinh · ' : ''}danh sách học sinh, mã đăng ký` },
        { href: '#/gv/diem', ic: '📊', c: 'green', t: 'Điểm', d: 'Bảng điểm từng lớp, xếp hạng – xuất Excel' },
        { href: '#/gv/giaobai', ic: '📤', c: '', t: 'Giao bài', d: 'Chọn bài / ma trận, xem trước đề, mã QR cho HS' },
        { href: '#/gv/baigiao', ic: '📋', c: '', t: 'Bài đã giao', d: 'Theo dõi HS nộp bài, công bố điểm' }].map(appTile).join('')}</div>
      <h2>🎓 Hỗ trợ dạy học</h2>
      <div class="tabs">${['10', '11', '12'].map(v => `<button data-khoi="${v}" class="${k === v ? 'on' : ''}">Khối ${v}</button>`).join('')}</div>
      ${GV_APPS(k).map(([t, xs]) => xs.length ? `<div class="appgrp"><h3>${t}</h3><div class="rows applist">${xs.map(appTile).join('')}</div></div>` : '').join('')}
      <p class="hint" style="margin-top:14px">Nhãn <span class="who">GV·HS</span> dùng được cho cả thầy cô (trình chiếu) và học sinh (tự học) · <span class="who hs">HS</span> học sinh tự ôn · <span class="who gv">GV</span> chỉ giáo viên.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px"><a class="btn ghost sm" href="#/?role=hs">🎓 Xem như học sinh</a>${session.role === 'admin' ? '<a class="btn ghost sm" href="#/admin">🛡️ Quản trị</a>' : ''}</div>`);
    $$('[data-khoi]').forEach(b => b.onclick = () => { k = b.dataset.khoi; store.set('gv_active_khoi', k); draw(); });
  };
  draw();
  try { window._gvCls = null; classes = await gvClasses(); } catch (e) {}
  if (location.hash.replace(/\?.*/, '') === '#/gv') draw();
});

/* ---- Các lớp ---- */
route(/^\/gv\/lop$/, async () => {
  if (!needGV()) return;
  let classes = window._gvCls || null, err = '';
  const draw = () => {
    const ks = ['10', '11', '12'].filter(k => (classes || []).some(c => String(c.Khoi) === k));
    setView(`<a href="#/gv">← Trang chủ</a><div class="sechead"><h1 style="margin:6px 0">🏫 Các lớp</h1><a class="btn sm" href="#/gv/taolop">+ Tạo lớp</a></div>
      ${!classes ? `<div class="card empty">${err ? esc(err) : 'Đang tải danh sách lớp…'}</div>`
        : !classes.length ? '<div class="card empty">Chưa có lớp. Tạo lớp để học sinh đăng ký bằng mã lớp.<div style="margin-top:12px"><a class="btn" href="#/gv/taolop">Tạo lớp</a></div></div>'
        : ks.map(k => `<h2>Khối ${k}</h2><div class="rows">${classes.filter(c => String(c.Khoi) === k).map(c => `<a href="#/gv/lop/${c.MaLop}"><span class="ic green">🏫</span><span class="tx"><b>${esc(c.TenLop || c.MaLop)}</b><span>${c.siSo} học sinh · mã lớp ${esc(c.MaLop)}${session.role === 'admin' && !c.cuaToi ? ' · lớp của GV khác' : ''}</span></span><span class="chev">›</span></a>`).join('')}</div>`).join('')}
      <div class="card" style="margin-top:14px"><div class="row"><div class="grow"><b>Mã chung cho học sinh đăng ký</b><div class="hint">HS bấm “Đăng ký tài khoản mới”, nhập mã này, tự chọn lớp và đặt mật khẩu.</div></div><b id="mcv" style="font-size:1.3em;letter-spacing:2px">${esc(window._maChung || '…')}</b><button class="btn ghost sm" id="mccp">Sao chép</button></div></div>`);
    $('#mccp').onclick = async () => { const m = window._maChung || ''; try { await navigator.clipboard.writeText(m); toast('Đã sao chép mã chung: ' + m); } catch (e) { toast('Mã chung: ' + m, 5000); } };
  };
  draw();
  if (!window._maChung) api('get_common').then(r => { window._maChung = r.ma; const v = $('#mcv'); if (v) v.textContent = r.ma; }).catch(() => {});
  try { window._gvCls = null; classes = await gvClasses(); } catch (e) { err = e.message; }
  if (location.hash === '#/gv/lop') draw();
});

/* ---- Điểm: chọn lớp → bảng điểm, xuất Excel ---- */
route(/^\/gv\/diem$/, async params => {
  if (!needGV()) return;
  let classes = window._gvCls || null, err = '', code = (params && params.get('lop')) || store.get('gv_diem_lop', '');
  const draw = () => {
    if (classes && classes.length && !classes.some(c => c.MaLop === code)) code = classes[0].MaLop;
    const ks = ['10', '11', '12'].filter(k => (classes || []).some(c => String(c.Khoi) === k));
    setView(`<a href="#/gv">← Trang chủ</a><h1>📊 Điểm</h1><p class="sub">Chọn lớp → tích các bài / đề cần lấy điểm → <b>Xuất Excel</b>.</p>
      ${!classes ? `<div class="card empty">${err ? esc(err) : 'Đang tải…'}</div>` : !classes.length ? '<div class="card empty">Chưa có lớp.</div>'
        : `<div class="card">${ks.map(k => `<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0"><b style="width:70px">Khối ${k}</b>${classes.filter(c => String(c.Khoi) === k).map(c => `<button class="btn ${c.MaLop === code ? '' : 'ghost'} sm" data-lop="${c.MaLop}">${esc(c.TenLop || c.MaLop)}</button>`).join('')}</div>`).join('')}</div>
        <div id="bd"><div class="card empty">Đang tải bảng điểm…</div></div>`}`);
    $$('[data-lop]').forEach(b => b.onclick = () => { code = b.dataset.lop; store.set('gv_diem_lop', code); draw(); load(); });
  };
  let seq = 0;
  const load = async () => {
    if (!classes || !classes.length) return;
    const my = ++seq, c = classes.find(x => x.MaLop === code);
    try {
      const [students, results, asg] = await Promise.all([api('class_students', { code }), api('class_results', { code }), api('list_assignments')]);
      if (my !== seq || !$('#bd')) return;
      students.sort((a, b) => viNameCmp(a.HoTen, b.HoTen));
      $('#bd').innerHTML = `<div class="row" style="align-items:center"><h2 class="grow">Lớp ${esc(c.TenLop)} · ${students.length} học sinh</h2><a class="btn ghost sm" href="#/gv/lop/${code}">Mở lớp ›</a></div><div id="bds"></div>`;
      scoreSheet($('#bds'), c, students, results, asg.filter(a => a.DanhSachLop.includes(code)));
    } catch (e) { if ($('#bd')) errBox($('#bd'), e); }
  };
  draw();
  try { if (!classes) classes = await gvClasses(); } catch (e) { err = e.message; }
  if (location.hash.startsWith('#/gv/diem')) { draw(); load(); }
});

route(/^\/gv\/taolop$/, () => {
  if (!needGV()) return;
  setView(`<div class="auth"><h1>Tạo lớp mới</h1><form class="card" id="f">
    <label for="n">Tên lớp</label><input id="n" type="text" required maxlength="30" placeholder="12A3">
    <label for="k">Khối</label><select id="k"><option>10</option><option>11</option><option selected>12</option></select>
    <label for="s">Trường</label><input id="s" type="text" maxlength="80" value="${esc(session.user.Truong)}">
    <label for="p">Mật khẩu chung cho HS đăng ký</label><input id="p" type="text" required minlength="4" maxlength="30" placeholder="vd: cn12a3">
    <div class="hint">HS dùng mã lớp + mật khẩu này để đăng ký, sau đó bắt buộc đổi mật khẩu riêng.</div>
    <div id="msg"></div><div style="margin-top:14px"><button class="btn block">Tạo lớp</button></div></form></div>`);
  $('#f').onsubmit = async e => {
    e.preventDefault();
    await busy($('#f .btn'), async () => {
      try { const c = await api('create_class', { name: $('#n').value, khoi: $('#k').value, school: $('#s').value, classPw: $('#p').value }); location.hash = '#/gv/lop/' + c.MaLop; }
      catch (err) { errBox($('#msg'), err); }
    });
  };
});

function qrInto(el, text) {
  const go = () => { try { const q = window.qrcode(0, 'M'); q.addData(text); q.make(); el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2 }); } catch (e) {} };
  if (window.qrcode) return go();
  const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js'; s.onload = go; document.head.appendChild(s);
}

route(/^\/gv\/lop\/([A-Z0-9]+)$/, async (params, code) => {
  if (!needGV()) return;
  setView('<div class="card empty">Đang tải…</div>');
  let cls, students, results, asg;
  try {
    [cls, students, results, asg] = await Promise.all([api('my_classes'), api('class_students', { code }), api('class_results', { code }), api('list_assignments')]);
  } catch (e) { errBox(V, e); return; }
  const c = cls.find(x => x.MaLop === code) || { TenLop: code, Khoi: '', MaLop: code };
  students.sort((a, b) => viNameCmp(a.HoTen, b.HoTen));
  const myAsg = asg.filter(a => a.DanhSachLop.includes(code));
  // thống kê chủ đề hay sai
  const wrongTopic = {}, wrongQ = {};
  results.forEach(r => String(r.sai || '').split(',').filter(Boolean).forEach(id => { const q = bank.byId[id]; if (!q) return; wrongTopic[q.cd] = (wrongTopic[q.cd] || 0) + 1; wrongQ[id] = (wrongQ[id] || 0) + 1; }));
  const tops = Object.entries(wrongTopic).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxT = tops.length ? tops[0][1] : 1;
  const hardQ = Object.entries(wrongQ).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const now = Date.now();
  setView(`<a href="#/gv/lop">← Các lớp</a><div class="row" style="align-items:center"><h1 class="grow" style="margin:6px 0">Lớp ${esc(c.TenLop)}</h1><button class="btn ghost sm" id="lsua">✏️ Sửa lớp</button><button class="btn danger sm" id="lxoa">🗑 Xoá lớp</button></div><p class="sub">Khối ${esc(c.Khoi)} · ${esc(c.Truong || '')} · ${students.length} học sinh</p>
    <div id="ledit"></div>
    <div class="card"><div class="row"><div class="grow"><div class="hint">Mã lớp</div><div class="code">${esc(code)}</div>
      <div class="hint">Mật khẩu chung: <b>${esc(c.MatKhauLop || '')}</b></div>
      <div class="row" style="margin-top:8px"><button class="btn sm ghost" id="cp">📋 Sao chép link đăng ký</button></div></div><div id="qr" style="width:132px"></div></div></div>
    <div class="row"><h2 class="grow">Học sinh</h2><a class="btn sm" href="javascript:void 0" id="tobd">📊 Bảng điểm & xuất Excel ↓</a></div>
    <div class="card">${students.length ? `<div class="tablewrap"><table><thead><tr><th>Họ tên</th><th>Tên ĐN</th><th class="n">Lượt</th><th class="n">ĐTB</th><th>Lần cuối</th><th></th></tr></thead><tbody>
      ${students.map(s => { const idle = !s.lanCuoi || now - new Date(s.lanCuoi).getTime() > 7 * 864e5; return `<tr><td><a href="#/gv/hs/${s.MaHS}?lop=${code}">${esc(s.HoTen)}</a>${s.chuaDoiMK ? ' <span class="pill warn">chưa đổi MK</span>' : ''}${idle ? ' <span class="pill bad" title="7 ngày chưa luyện">⏰</span>' : ''}</td><td>${esc(s.TenDN)}</td>
        <td class="n">${s.soLuot}</td><td class="n">${s.diemTB == null ? '–' : fmt(s.diemTB)}</td><td>${s.lanCuoi ? dt(s.lanCuoi) : '–'}</td><td style="white-space:nowrap"><button class="btn ghost sm" data-e="${s.MaHS}" title="Sửa thông tin / chuyển lớp">✏️</button> <button class="btn ghost sm" data-r="${s.MaHS}" data-n="${esc(s.HoTen)}" title="Đặt lại mật khẩu">🔑 MK</button> <button class="btn ghost sm" data-x="${s.MaHS}" data-n="${esc(s.HoTen)}" title="Xoá học sinh khỏi lớp">🗑</button></td></tr><tr class="hsedit" id="he_${s.MaHS}" hidden><td colspan="6"></td></tr>`; }).join('')}
      </tbody></table></div><p class="hint">⏰ = 7 ngày chưa luyện tập.</p>` : '<div class="empty">Chưa có học sinh. Gửi mã lớp hoặc mã QR cho các em đăng ký.</div>'}</div>
    <h2 id="bdh">📊 Bảng điểm theo bài / chủ đề / đề thi</h2><div id="bd"></div>
    <h2>Chủ đề lớp hay sai nhất</h2>
    <div class="card">${tops.length ? '<div class="bars">' + tops.map(([t, n]) => `<div class="bar"><span>${esc(t.replace(/^Lớp \d+ – /, ''))}</span><span class="tr"><i style="width:${n / maxT * 100}%"></i></span><span class="v">${n}</span></div>`).join('') + '</div>' : '<div class="empty">Chưa có dữ liệu.</div>'}
    ${hardQ.length ? '<h3>Câu sai nhiều nhất</h3><div class="list">' + hardQ.map(([id, n]) => `<div class="item"><div class="grow">${esc(plain(bank.byId[id].s).slice(0, 150))}<div class="meta">${esc(id)} · ${n} lượt sai</div></div></div>`).join('') + '</div>' : ''}</div>
    <h2>Bài đã giao cho lớp</h2>
    <div class="list">${myAsg.map(a => `<a class="item" href="#/gv/bai/${a.MaBai}"><div class="grow"><b>${esc(a.TieuDe)}</b><div class="meta">${a.DanhSachCau.length} câu · ${results.filter(r => r.key === a.MaBai).length} lượt nộp</div></div>›</a>`).join('') || '<div class="card empty">Chưa giao bài cho lớp này.</div>'}</div>`);
  qrInto($('#qr'), joinLink(code));
  $('#cp').onclick = async () => { try { await navigator.clipboard.writeText(joinLink(code)); toast('Đã sao chép link đăng ký'); } catch (e) { prompt('Link đăng ký:', joinLink(code)); } };
  $$('[data-r]').forEach(b => b.onclick = async () => {
    if (!confirm('Đặt lại mật khẩu của ' + b.dataset.n + ' về mật khẩu chung của lớp?')) return;
    try { const r = await api('reset_pw_hs', { maHS: b.dataset.r }); alert('Đã đặt lại. Mật khẩu tạm: ' + r.matKhau + '\nHS sẽ phải đổi mật khẩu khi đăng nhập.'); } catch (e) { toast(e.message); }
  });
  const reload = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
  const others = cls.filter(x => x.MaLop !== code);
  const lopOpts = (sel) => cls.map(x => `<option value="${esc(x.MaLop)}" ${x.MaLop === sel ? 'selected' : ''}>${esc(x.TenLop)} (khối ${esc(x.Khoi)})</option>`).join('');
  $('#lsua').onclick = () => {
    const box = $('#ledit');
    if (box.innerHTML) { box.innerHTML = ''; return; }
    box.innerHTML = `<form class="card" id="lf"><h3>Sửa thông tin lớp</h3>
      <div class="row" style="gap:10px;flex-wrap:wrap"><div class="grow"><label for="ln">Tên lớp</label><input id="ln" value="${esc(c.TenLop)}" maxlength="30" placeholder="vd: 10/1"></div>
      <div><label for="lk">Khối</label><select id="lk">${['10', '11', '12'].map(k => `<option ${String(c.Khoi) === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
      <div class="grow"><label for="lp">Mật khẩu chung của lớp</label><input id="lp" value="${esc(c.MatKhauLop || '')}" maxlength="30"></div></div>
      <p class="hint">Đổi tên trùng với lớp đã có cùng khối thì app sẽ hỏi gộp hai lớp làm một.</p>
      <div id="lmsg"></div><div class="row"><button class="btn">Lưu</button><button type="button" class="btn ghost" id="lhuy">Huỷ</button></div></form>`;
    $('#lhuy').onclick = () => { box.innerHTML = ''; };
    $('#lf').onsubmit = async e => {
      e.preventDefault();
      const body = { code, name: $('#ln').value, khoi: $('#lk').value, classPw: $('#lp').value };
      await busy($('#lf .btn'), async () => {
        try {
          let r;
          try { r = await api('update_class', body); }
          catch (err) {
            const m = String(err.message || '').split('|');
            if (m[0] !== 'TRUNG_LOP') throw err;
            if (!confirm(m[2] + '\n\nGộp lớp này vào lớp đó? Toàn bộ học sinh, kết quả và bài giao sẽ chuyển sang lớp ' + m[1] + '.')) return;
            r = await api('update_class', Object.assign(body, { merge: true }));
          }
          toast(r.merged ? 'Đã gộp vào lớp ' + r.merged : 'Đã lưu thông tin lớp');
          if (r.merged) location.hash = '#/gv/lop/' + r.merged; else reload();
        } catch (err) { errBox($('#lmsg'), err); }
      });
    };
  };
  $('#lxoa').onclick = () => {
    const box = $('#ledit');
    box.innerHTML = `<div class="card note"><h3>Xoá lớp ${esc(c.TenLop)}</h3>
      ${students.length ? `<p>Lớp đang có <b>${students.length} học sinh</b>. Chọn cách xử lý:</p>
        <label class="chk" style="margin:6px 0"><input type="radio" name="xm" value="move" ${others.length ? 'checked' : 'disabled'}>Chuyển các em sang lớp: <select id="xto" ${others.length ? '' : 'disabled'}>${others.map(x => `<option value="${esc(x.MaLop)}">${esc(x.TenLop)} (khối ${esc(x.Khoi)})</option>`).join('')}</select></label>
        <label class="chk" style="margin:6px 0"><input type="radio" name="xm" value="del" ${others.length ? '' : 'checked'}>Xoá luôn tài khoản các em (kết quả cũ vẫn lưu trong Google Sheets)</label>` : '<p>Lớp chưa có học sinh.</p>'}
      <div id="xmsg"></div><div class="row"><button class="btn danger" id="xok">Xoá lớp</button><button class="btn ghost" id="xhuy">Huỷ</button></div></div>`;
    $('#xhuy').onclick = () => { box.innerHTML = ''; };
    $('#xok').onclick = async () => {
      const m = (document.querySelector('input[name=xm]:checked') || {}).value;
      const body = { code };
      if (students.length && m === 'move') body.moveTo = $('#xto').value;
      if (students.length && m === 'del') body.deleteStudents = true;
      if (!confirm(body.deleteStudents ? `Xoá lớp và XOÁ ${students.length} tài khoản học sinh? Không hoàn tác được.` : 'Xoá lớp ' + c.TenLop + '?')) return;
      await busy($('#xok'), async () => {
        try { const r = await api('delete_class', body); toast(r.moved ? `Đã chuyển ${r.moved} HS và xoá lớp` : 'Đã xoá lớp'); location.hash = body.moveTo ? '#/gv/lop/' + body.moveTo : '#/gv'; }
        catch (err) { errBox($('#xmsg'), err); }
      });
    };
  };
  $$('[data-e]').forEach(b => b.onclick = () => {
    const s = students.find(x => x.MaHS === b.dataset.e), tr = $('#he_' + s.MaHS);
    if (!tr.hidden) { tr.hidden = true; return; }
    tr.hidden = false;
    tr.firstElementChild.innerHTML = `<form class="row hsform" style="gap:8px;flex-wrap:wrap;align-items:flex-end">
      <div class="grow"><label>Họ và tên</label><input name="n" value="${esc(s.HoTen)}" maxlength="60"></div>
      <div><label>Tên đăng nhập</label><input name="u" value="${esc(s.TenDN)}" maxlength="30" autocapitalize="none"></div>
      <div><label>Lớp</label><select name="l">${lopOpts(code)}</select></div>
      <button class="btn sm">Lưu</button><button type="button" class="btn ghost sm" data-c>Huỷ</button><div class="msg" style="flex-basis:100%"></div></form>`;
    const f = tr.querySelector('form');
    f.querySelector('[data-c]').onclick = () => { tr.hidden = true; };
    f.onsubmit = async e => {
      e.preventDefault();
      await busy(f.querySelector('.btn'), async () => {
        try {
          const r = await api('update_student', { maHS: s.MaHS, name: f.n.value, username: f.u.value, toCode: f.l.value });
          toast(r.moved ? 'Đã chuyển học sinh sang lớp mới' : 'Đã lưu'); reload();
        } catch (err) { errBox(f.querySelector('.msg'), err); }
      });
    };
  });
  $$('[data-x]').forEach(b => b.onclick = async () => {
    if (!confirm('Xoá tài khoản học sinh ' + b.dataset.n + '? Em sẽ không đăng nhập được nữa (kết quả cũ vẫn lưu trong Google Sheets).')) return;
    try { await api('delete_student', { maHS: b.dataset.x }); toast('Đã xoá học sinh'); reload(); } catch (e) { toast(e.message); }
  });
  $('#tobd').onclick = () => { const h = $('#bdh'); if (h) window.scrollTo({ top: h.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' }); };
  scoreSheet($('#bd'), c, students, results, myAsg);
});

/* ---------- Bảng điểm lớp: mỗi bài / chủ đề / đề thi là 1 cột, GV tích chọn cột, cộng tổng & TB ở cuối ---------- */
const BD_GROUPS = [
  ['baigiao', '📝 Bài thầy cô giao'], ['baihoc', '📚 Nguyên bài học SGK'], ['chude', '📖 Ôn theo bài / chủ đề / dạng câu'],
  ['matran', '📑 Đề kiểm tra / đề tổng hợp'], ['de', '🎓 Đề thi thử tốt nghiệp'], ['dethi', '🖨️ Đề thi giấy (chấm bằng app)'], ['causai', '🔁 Làm lại câu sai']
];
function scoreSheet(box, cls, students, results, myAsg) {
  const ck = 'bd_' + cls.MaLop;
  const grpOf = l => BD_GROUPS.some(g => g[0] === l) ? l : 'chude';
  // gom các lượt làm thành từng "cột": bài giao / đề theo mã; ôn tập tự chọn theo tên bài
  const cols = {};
  results.forEach(r => {
    const id = r.key ? 'K:' + r.key : 'T:' + r.bai;
    const name = r.loai === 'baigiao' ? ((myAsg.find(a => a.MaBai === r.key) || {}).TieuDe || r.bai) : String(r.bai || '').replace(/^Ôn (chủ đề: )?/, '');
    if (!cols[id]) cols[id] = { id, name: name || '(không tên)', g: grpOf(r.loai), hs: new Set() };
    cols[id].hs.add(r.maHS);
  });
  myAsg.forEach(a => { const id = 'K:' + a.MaBai; if (!cols[id]) cols[id] = { id, name: a.TieuDe, g: 'baigiao', hs: new Set() }; });
  const list = Object.values(cols).sort((a, b) => BD_GROUPS.findIndex(g => g[0] === a.g) - BD_GROUPS.findIndex(g => g[0] === b.g) || a.name.localeCompare(b.name, 'vi', { numeric: true }));
  const saved = store.get(ck, null) || {};
  const sel = new Set(saved.sel || list.filter(x => ['baigiao', 'baihoc', 'matran', 'de', 'dethi'].includes(x.g)).map(x => x.id));
  let mode = saved.mode || 'max', zero = saved.zero !== false, hk = !!saved.hk, gd = null, gdErr = '';
  const pick = (s, col, R) => {
    const rs = (R || results).filter(r => r.maHS === s.MaHS && (r.key ? 'K:' + r.key : 'T:' + r.bai) === col.id);
    if (!rs.length) return null;
    if (mode === 'max') return Math.max(...rs.map(r => r.diem));
    const srt = rs.slice().sort((a, b) => new Date(a.t) - new Date(b.t));
    return (mode === 'first' ? srt[0] : srt[srt.length - 1]).diem;
  };
  const r2 = n => Math.round(n * 100) / 100;
  const build = () => {
    const chosen = list.filter(x => sel.has(x.id));
    const rows = students.map((s, i) => {
      const v = chosen.map(col => pick(s, col)), got = v.filter(x => x != null);
      const tong = got.reduce((a, b) => a + b, 0), n = zero ? chosen.length : got.length;
      return { s, i, v, tong: r2(tong), tb: n ? r2(tong / n) : null, lam: got.length };
    });
    // hạng trong lớp và trong cả khối (cùng các cột đã chọn, cùng cách lấy điểm); bằng điểm thì đồng hạng
    const rankOf = (arr, x) => 1 + arr.filter(y => y > x).length;
    const lopT = rows.map(r => r.tong);
    rows.forEach(r => { r.hl = chosen.length ? rankOf(lopT, r.tong) : null; });
    if (gd && chosen.length) {
      const byHS = {}; gd.results.forEach(r => { (byHS[r.maHS] = byHS[r.maHS] || []).push(r); });
      const khT = gd.students.map(s => r2(chosen.map(col => pick(s, col, byHS[s.MaHS] || [])).filter(x => x != null).reduce((a, b) => a + b, 0)));
      rows.forEach(r => { r.hk = rankOf(khT, r.tong); });
      rows.nk = gd.students.length;
    }
    return { chosen, rows };
  };
  const draw = () => {
    store.set(ck, { sel: [...sel], mode, zero, hk });
    const { chosen, rows } = build();
    const shortName = x => x.name.length > 28 ? x.name.slice(0, 26) + '…' : x.name;
    box.innerHTML = `<div class="card">
      <div class="row" style="gap:8px;flex-wrap:wrap"><b>Lấy điểm:</b>${[['max', 'Cao nhất'], ['first', 'Lần đầu'], ['last', 'Lần cuối']].map(([k, t]) => `<button class="btn ghost sm${mode === k ? ' on' : ''}" data-mode="${k}">${t}</button>`).join('')}
        <label class="chk" style="padding:5px 10px"><input type="checkbox" id="bdz" ${zero ? 'checked' : ''}>Bài chưa làm tính 0 khi chia TB</label>
        <label class="chk" style="padding:5px 10px"><input type="checkbox" id="bdk" ${hk ? 'checked' : ''}>🏅 Xếp hạng cùng khối ${esc(cls.Khoi)}</label></div>
      ${hk && !gd ? `<p class="hint">${gdErr ? '⚠️ ' + esc(gdErr) : 'Đang tải điểm cả khối ' + esc(cls.Khoi) + '…'}</p>` : ''}
      <p class="hint" style="margin:8px 0 4px">Tích vào bài / chủ đề / đề muốn lấy điểm. Mỗi mục được tích là một cột; cuối bảng tự cộng <b>Tổng điểm</b> và <b>Điểm TB</b>.</p>
      ${list.length ? BD_GROUPS.map(([g, title]) => { const xs = list.filter(x => x.g === g); if (!xs.length) return ''; const all = xs.every(x => sel.has(x.id)); return `<div class="bdgrp"><label class="lchk bdhead"><input type="checkbox" data-grp="${g}" ${all ? 'checked' : ''}><b class="grow">${title}</b><span class="n">${xs.length} mục</span></label>
        <div class="lessonlist" style="max-height:220px">${xs.map(x => `<label class="lchk"><input type="checkbox" data-col="${esc(x.id)}" ${sel.has(x.id) ? 'checked' : ''}><span class="grow">${esc(x.name)}</span><span class="n">${x.hs.size}/${students.length} HS</span></label>`).join('')}</div></div>`; }).join('') : '<div class="empty">Lớp chưa có bài làm nào.</div>'}
      <div class="row" style="margin-top:12px"><span class="grow hint">Đã chọn <b>${chosen.length}</b> cột · ${students.length} học sinh (xếp theo vần A–B)</span><button class="btn sm" id="bdx">⬇ Xuất Excel</button></div></div>
      ${chosen.length && students.length ? `<div class="card"><div class="tablewrap"><table class="bdtable"><thead><tr><th>STT</th><th>Họ tên</th>${chosen.map(x => `<th class="n" title="${esc(x.name)}">${esc(shortName(x))}</th>`).join('')}<th class="n">Tổng điểm</th><th class="n">Điểm TB</th><th class="n">Hạng lớp</th>${gd ? `<th class="n" title="Xếp chung ${rows.nk} HS khối ${esc(cls.Khoi)}">Hạng khối</th>` : ''}</tr></thead><tbody>
        ${rows.map(r => `<tr><td>${r.i + 1}</td><td>${esc(r.s.HoTen)}</td>${r.v.map(x => `<td class="n">${x == null ? '<span class="hint">–</span>' : fmt(x)}</td>`).join('')}<td class="n"><b>${fmt(r.tong)}</b></td><td class="n"><b>${r.tb == null ? '–' : fmt(r.tb)}</b></td><td class="n">${r.hl}/${students.length}</td>${gd ? `<td class="n"><b>${r.hk}</b>/${rows.nk}</td>` : ''}</tr>`).join('')}</tbody></table></div>
        ${gd ? `<p class="hint">Hạng khối: xếp ${rows.nk} học sinh khối ${esc(cls.Khoi)} của trường theo Tổng điểm các cột đang chọn; bằng điểm thì đồng hạng.</p>` : ''}</div>` : ''}`;
    $$('[data-mode]', box).forEach(b => b.onclick = () => { mode = b.dataset.mode; draw(); });
    $('#bdz', box).onchange = e => { zero = e.target.checked; draw(); };
    $('#bdk', box).onchange = e => { hk = e.target.checked; draw(); if (hk && !gd) loadGrade(); };
    $$('[data-col]', box).forEach(i => i.onchange = () => { i.checked ? sel.add(i.dataset.col) : sel.delete(i.dataset.col); draw(); });
    $$('[data-grp]', box).forEach(i => i.onchange = () => { list.filter(x => x.g === i.dataset.grp).forEach(x => i.checked ? sel.add(x.id) : sel.delete(x.id)); draw(); });
    $('#bdx', box).onclick = () => {
      const { chosen, rows } = build();
      if (!chosen.length) { toast('Hãy tích chọn ít nhất 1 cột điểm'); return; }
      const head = ['STT', 'Họ tên', 'Tên đăng nhập', ...chosen.map(x => x.name), 'Tổng điểm', 'Điểm TB', 'Hạng lớp', ...(gd ? ['Hạng khối'] : []), 'Số bài đã làm'];
      csv('BangDiem_' + String(cls.TenLop).replace(/[\/:*?"<>|]+/g, '-') + '.csv', [head, ...rows.map(r => [r.i + 1, r.s.HoTen, r.s.TenDN, ...r.v.map(x => x == null ? '' : x), r.tong, r.tb == null ? '' : r.tb, r.hl + '/' + students.length, ...(gd ? [r.hk + '/' + rows.nk] : []), r.lam + '/' + chosen.length])]);
    };
  };
  const loadGrade = async () => {
    gdErr = '';
    try { gd = await api('grade_results', { khoi: cls.Khoi }); } catch (e) { gdErr = e.message; }
    if (box.isConnected) draw();
  };
  draw();
  if (hk) loadGrade();
}

route(/^\/gv\/hs\/([\w]+)$/, async (params, maHS) => {
  if (!needGV()) return;
  setView('<div class="card empty">Đang tải…</div>');
  try {
    const h = await api('student_history', { maHS });
    const topic = {};
    h.forEach(r => String(r.sai || '').split(',').filter(Boolean).forEach(id => { const q = bank.byId[id]; if (q) topic[q.cd] = (topic[q.cd] || 0) + 1; }));
    const tops = Object.entries(topic).sort((a, b) => b[1] - a[1]).slice(0, 6), mx = tops.length ? tops[0][1] : 1;
    setView(`<a href="#/gv/lop/${esc(params.get('lop') || '')}">← Quay lại lớp</a><h1>Quá trình luyện tập</h1><p class="sub">${h.length} lượt làm bài</p>
      <div class="card"><h3>Điểm qua các lượt</h3>${spark(h.map(r => r.diem))}</div>
      <div class="card"><h3>Chủ đề hay sai</h3>${tops.length ? '<div class="bars">' + tops.map(([t, n]) => `<div class="bar"><span>${esc(t.replace(/^Lớp \d+ – /, ''))}</span><span class="tr"><i style="width:${n / mx * 100}%"></i></span><span class="v">${n}</span></div>`).join('') + '</div>' : '<div class="empty">Chưa có dữ liệu</div>'}</div>
      <div class="card"><div class="tablewrap"><table><thead><tr><th>Thời điểm</th><th>Bài</th><th class="n">Điểm</th><th class="n">Đúng</th><th class="n">T.gian</th></tr></thead><tbody>
      ${h.slice().reverse().map(r => `<tr><td>${dt(r.t)}</td><td>${esc(r.bai)}</td><td class="n"><b>${fmt(r.diem)}</b></td><td class="n">${r.dung}/${r.tong}</td><td class="n">${mmss(r.giay)}</td></tr>`).join('')}</tbody></table></div></div>`);
  } catch (e) { errBox(V, e); }
});
function spark(vals) {
  if (vals.length < 2) return '<div class="empty">Cần ít nhất 2 lượt để vẽ biểu đồ</div>';
  const W = 600, H = 140, p = 14, n = vals.length;
  const x = i => p + i * (W - 2 * p) / (n - 1), y = v => H - p - v / 10 * (H - 2 * p);
  const pts = vals.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Biểu đồ điểm">
    ${[0, 5, 10].map(v => `<line x1="${p}" x2="${W - p}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" stroke-opacity=".12"/><text x="2" y="${y(v) + 4}" font-size="11" fill="currentColor" fill-opacity=".5">${v}</text>`).join('')}
    <polyline points="${pts}" fill="none" stroke="var(--brand2)" stroke-width="2.5" stroke-linejoin="round"/>
    ${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="var(--accent)"><title>${fmt(v)}</title></circle>`).join('')}</svg>`;
}

const DIEM_MODES = [
  ['dapan', 'Nộp bài → biết điểm → xem đáp án, gợi ý', 'HS thấy điểm ngay và xem lại từng câu kèm đáp án, gợi ý.'],
  ['diem', 'Nộp bài → chỉ biết điểm', 'HS chỉ thấy điểm và số câu đúng; không xem được đáp án.'],
  ['calop', 'Nộp bài → cả lớp nộp xong mới có điểm', 'Điểm (và đáp án) chỉ hiện khi cả lớp đã nộp, hoặc đến hạn nộp, hoặc khi thầy cô bấm “Công bố điểm”.']];
const LV = [['b', 'Biết'], ['h', 'Hiểu'], ['v', 'Vận dụng'], ['ds', 'Đúng/Sai'], ['tl', 'Tự luận']];
const lvCount = qs => ({ b: qs.filter(q => q.t === 'M' && q.md === 'Biết').length, h: qs.filter(q => q.t === 'M' && q.md === 'Hiểu').length,
  v: qs.filter(q => q.t === 'M' && q.md === 'Vận dụng').length, ds: qs.filter(q => q.t === 'T').length, tl: qs.filter(q => q.t === 'L').length });
/** bốc ngẫu nhiên đúng số câu từng mức */
function pickLevels(qs, n) {
  const take = (f, k) => shuffle(qs.filter(f)).slice(0, Math.max(0, +k || 0));
  return [...take(q => q.t === 'M' && q.md === 'Biết', n.b), ...take(q => q.t === 'M' && q.md === 'Hiểu', n.h), ...take(q => q.t === 'M' && q.md === 'Vận dụng', n.v),
    ...take(q => q.t === 'T', n.ds), ...take(q => q.t === 'L', n.tl)].map(q => q.id);
}
const lessonNo = s => { const m = /^Bài\s*(\d+)/.exec(s || ''); return m ? +m[1] : 999; };
/** các dòng bảng ma trận của một khối: mọi bài của khối trong ngân hàng + bài có trong ma trận mẫu */
function mtLessons(k) {
  const map = new Map(), key = v => lessonNo(v) < 999 ? 'B' + lessonNo(v) : 'T:' + v;
  lessonsOf(k).forEach(v => { if (!map.has(key(v))) map.set(key(v), { key: key(v), value: v, type: 'bai', fb: [] }); });
  (window.STC_MATRAN || []).filter(t => t.khoi === k).forEach(t => t.rows.forEach(r => {
    const kk = r.type === 'bai' ? key(r.value) : 'C:' + r.value, cur = map.get(kk);
    if (!cur) map.set(kk, { key: kk, value: r.value, type: r.type, fb: (r.fb || []).slice() });
    else (r.fb || []).forEach(f => { if (!cur.fb.includes(f)) cur.fb.push(f); });
  }));
  return [...map.values()].sort((a, b) => lessonNo(a.value) - lessonNo(b.value) || a.value.localeCompare(b.value, 'vi'));
}
const mtKey = r => r.type === 'bai' && lessonNo(r.value) < 999 ? 'B' + lessonNo(r.value) : (r.type === 'bai' ? 'T:' : 'C:') + r.value;

route(/^\/gv\/giaobai$/, async params => {
  if (!needGV()) return;
  const targetK = params ? (params.get('k') || '') : '';
  setView('<div class="card empty">Đang tải…</div>');
  let cls;
  try { cls = await api('school_classes'); } catch (e) { errBox(V, e); return; }
  const mine = session.user.MaGV;
  let mode = 'de', selK = targetK || '';
  const keep = { t: targetK ? 'Kiểm tra Công nghệ ' + targetK : '', lb: 'Kiểm tra thường xuyên', cdd: 'dapan', mi: '', cl: null };
  const mt = { k: '', src: '', cells: {} };   // bảng ma trận: cells[mtKey] = {b,h,v,ds,tl}
  let schoolMx = store.get('matrices', []);
  const curK = () => { const c = $$('input[name=cl]:checked')[0]; return targetK || (c && c.dataset.k) || selK || '10'; };
  const draw = () => {
    setView(`<h1>Giao bài ${targetK ? 'Khối ' + targetK : ''}</h1><p class="sub">Có thể giao cùng một bài cho cả khối để HS xếp hạng chung.</p>
      <form class="card" id="f">
        <label for="t">Tiêu đề</label><input id="t" type="text" required maxlength="120" placeholder="${targetK ? 'Kiểm tra Công nghệ ' + targetK : 'Kiểm tra 15 phút – Mạch điện ba pha'}" value="${esc(keep.t)}">
        <label for="lbx">Loại bài (HS thấy ở mục "Bài kiểm tra")</label><select id="lbx">${ASG_TYPES.map(x => `<option ${x === keep.lb ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <label>Giao cho lớp</label>
        ${['10', '11', '12'].map(k => { const l = cls.filter(c => c.Khoi === k); return l.length ? `<div class="row" style="margin:6px 0"><b style="width:66px">Khối ${k}</b><div class="checks">${l.map(c => `<label class="chk"><input type="checkbox" name="cl" value="${c.MaLop}" data-k="${k}" ${(keep.cl ? keep.cl.includes(c.MaLop) : targetK === k) ? 'checked' : ''}>${esc(c.TenLop)}${c.MaGV === mine ? '' : ' <span class="pill">GV khác</span>'}</label>`).join('')}<button type="button" class="btn ghost sm" data-all="${k}">Cả khối</button></div></div>` : ''; }).join('') || '<div class="hint">Chưa có lớp nào trong trường.</div>'}
        <label>Cách lấy câu hỏi</label>
        <div class="tabs"><button type="button" data-m="de" class="${mode === 'de' ? 'on' : ''}">Theo đề có sẵn</button><button type="button" data-m="matran" class="${mode === 'matran' ? 'on' : ''}">Đề theo ma trận</button><button type="button" data-m="ngaunhien" class="${mode === 'ngaunhien' ? 'on' : ''}">Chủ đề & mức độ</button></div>
        <div id="mbox"></div>
        <div class="row"><div class="grow"><label for="mi">Thời gian (phút, 0 = không giới hạn)</label><input id="mi" type="number" min="0" max="180" value="${keep.mi || (mode === 'ngaunhien' ? 15 : mode === 'matran' ? 45 : 50)}"></div>
          <div class="grow"><label for="at">Số lần được làm (0 = không giới hạn)</label><input id="at" type="number" min="0" max="20" value="1"></div></div>
        <label for="dl">Hạn nộp (để trống = không hạn)</label><input id="dl" type="datetime-local">
        <label for="cdd">Sau khi nộp bài</label><select id="cdd">${DIEM_MODES.map(([v, t]) => `<option value="${v}" ${v === keep.cdd ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <p class="hint" id="cddh">${DIEM_MODES.find(x => x[0] === keep.cdd)[2]}</p>
        <label for="lb">Bảng xếp hạng (xếp hạng chung cả khối)</label><select id="lb"><option value="ngay">Hiện ngay sau khi nộp</option><option value="sau_han">Chỉ hiện sau hạn nộp</option><option value="tat">Tắt</option></select>
        <label for="no">Ghi chú cho HS</label><input id="no" type="text" maxlength="300">
        <div id="msg"></div><div style="margin-top:14px"><button class="btn block">Giao bài</button></div></form>`);
    const remember = () => { keep.t = $('#t').value; keep.lb = $('#lbx').value; keep.cdd = $('#cdd').value; keep.mi = $('#mi').value; keep.cl = $$('input[name=cl]:checked').map(i => i.value); };
    $$('[data-m]').forEach(b => b.onclick = () => { remember(); readCells(); mode = b.dataset.m; keep.mi = ''; draw(); });
    $('#cdd').onchange = () => { ($('#cddh') || {}).textContent = DIEM_MODES.find(x => x[0] === $('#cdd').value)[2]; };
    let lastK = curK();
    const onK = () => { const k = curK(); if (k !== lastK) { lastK = k; renderMode(); } };
    $$('input[name=cl]').forEach(i => i.onchange = onK);
    $$('[data-all]').forEach(b => b.onclick = () => { $$(`input[name=cl][data-k="${b.dataset.all}"]`).forEach(i => i.checked = true); onK(); });
    renderMode();
    $('#f').onsubmit = async e => {
      e.preventDefault();
      const classes = $$('input[name=cl]:checked').map(i => i.value);
      const ks = new Set($$('input[name=cl]:checked').map(i => i.dataset.k));
      if (ks.size > 1) { errBox($('#msg'), 'Mỗi bài chỉ giao cho các lớp cùng một khối'); return; }
      const cdd = $('#cdd').value;
      const a = { title: $('#t').value, classes, mode, minutes: +$('#mi').value, attempts: +$('#at').value,
        deadline: $('#dl').value ? new Date($('#dl').value).toISOString() : '', leaderboard: $('#lb').value, diemMode: cdd, hints: cdd !== 'diem', note: $('#no').value, loaiBai: $('#lbx').value };
      // bốc câu ở máy để thầy cô xem trước đúng bộ câu sẽ giao (gen() gọi lại được để bốc bộ khác)
      let gen = null;
      if (mode === 'de') {
        const src = deSource(), n = lvInputs();
        if (!src) { errBox($('#msg'), 'Hãy chọn bài học hoặc đề'); return; }
        const full = LV.every(([f]) => n[f] >= src.cnt[f]);
        a.cheDo = src.de ? (full ? 'de' : 'de_mucdo') : (full ? 'bai' : 'bai_mucdo');
        gen = () => full ? src.qs.map(q => q.id) : pickLevels(src.qs, n);
      }
      if (mode === 'matran') {
        readCells();
        if (mt.src === 'SO') { a.cheDo = 'matran'; gen = () => matrixPick().sort((x, y) => (bank.byId[x].t === 'T') - (bank.byId[y].t === 'T')); }
        else {
          const rows = mtLessons(curK()).map(r => Object.assign({}, r, mt.cells[r.key] || {})).filter(r => LV.some(([f]) => +r[f] > 0))
            .map(r => ({ value: r.value, type: r.type, fb: r.fb, b: +r.b || 0, h: +r.h || 0, v: +r.v || 0, ds: +r.ds || 0, tb: 0, th: 0, tv: +r.tl || 0 }));
          if (!rows.length) { errBox($('#msg'), 'Hãy nhập số câu Biết / Hiểu / Vận dụng cho ít nhất một bài'); return; }
          a.cheDo = 'matran_ky';
          let warned = false;
          gen = () => { const x = buildFromMatrix({ khoi: curK(), rows }); if (x.miss.length && !warned) { warned = true; a._miss = x.miss; } return x.ids; };
        }
      }
      if (mode === 'ngaunhien') {
        const tps = $$('input[name=tp]:checked').map(i => i.value), lss = $$('input[name=ls]:checked').map(i => i.value), k = curK();
        const pool = bank.q.filter(q => (!tps.length && !lss.length) ? q.k === k : (tps.includes(q.cd) || lss.includes(q.bai)));
        const n = { b: +$('#nb').value, h: +$('#nh').value, v: +$('#nv').value, ds: +$('#nd').value, tl: +$('#ntl').value };
        a.cheDo = 'ngaunhien';
        gen = () => pickLevels(pool, n);
      }
      a.mode = 'chon';
      a.ids = gen();
      if (!a.ids.length) { errBox($('#msg'), 'Không có câu hỏi phù hợp với lựa chọn'); return; }
      ($('#msg') || {}).innerHTML = '';
      preview(a, gen);
    };
  };
  /* ----- Xem trước đề: in / lưu PDF, đổi từng câu, bốc lại, rồi mới giao ----- */
  const preview = (a, gen) => {
    const f = $('#f'); f.style.display = 'none';
    let box = $('#pvw'); if (!box) { box = document.createElement('div'); box.id = 'pvw'; f.after(box); }
    let showKey = true;
    const tag = q => `${q.t === 'M' ? 'Nhiều lựa chọn' : q.t === 'T' ? 'Đúng/Sai' : 'Tự luận'}${q.t === 'M' ? ' · ' + esc(q.md) : ''} · ${esc((q.bai || q.cd || '').replace(/^Lớp \d+ – /, ''))}`;
    const keyOf = q => q.t === 'M' ? normAns(q) : q.t === 'T' ? normAns(q).split('').map((x, k) => 'abcd'[k] + ') ' + (x === 'Đ' ? 'Đúng' : 'Sai')).join('; ') : 'xem đáp án mẫu';
    const v0 = { ma: '', ids: a.ids, perm: {} };
    const render = () => {
      v0.ids = a.ids;
      const qs = a.ids.map(id => bank.byId[id]).filter(Boolean), mc = qs.filter(q => q.t === 'M'), tf = qs.filter(q => q.t === 'T'), tl = qs.filter(q => q.t === 'L');
      const c = lvCount(qs);
      const item = (q, n) => `<div class="pvq"><div class="row" style="gap:6px;align-items:flex-start"><div class="grow">${examQ(q, v0, n)}</div>
          <div class="pvact"><button type="button" class="btn ghost sm" data-sw="${q.id}" title="Thay bằng câu khác cùng bài, cùng mức">🔄 Đổi</button><button type="button" class="btn ghost sm" data-rm="${q.id}" title="Bỏ câu này">✕</button></div></div>
        <div class="hint">${tag(q)}${showKey ? ` · <b style="color:var(--ok)">Đáp án: ${esc(keyOf(q))}</b>` : ''}</div></div>`;
      box.innerHTML = `<div class="card"><div class="row"><div class="grow"><h2 style="margin:0">📄 Xem trước đề: ${esc(a.title || 'Bài kiểm tra')}</h2>
          <div class="hint">${qs.length} câu: ${mc.length} nhiều lựa chọn (Biết ${c.b} · Hiểu ${c.h} · Vận dụng ${c.v}) · ${tf.length} Đúng/Sai · ${tl.length} tự luận${a.minutes ? ' · ' + a.minutes + ' phút' : ''}</div></div></div>
        ${a._miss && a._miss.length ? `<div class="err" style="margin-top:8px">Ngân hàng chưa đủ câu ở: ${esc(a._miss.join('; '))}. App đã lấy bù câu cùng chương nếu có.</div>` : ''}
        <div class="row" style="margin-top:10px;flex-wrap:wrap"><button type="button" class="btn" id="pvp">🖨️ In / Lưu PDF đề</button><button type="button" class="btn ghost" id="pvk">🖨️ In kèm đáp án</button>
          ${a.cheDo === 'de' || a.cheDo === 'bai' ? '' : '<button type="button" class="btn ghost" id="pvr">🎲 Bốc bộ câu khác</button>'}
          <label class="chk" style="padding:5px 10px"><input type="checkbox" id="pvs" ${showKey ? 'checked' : ''}>Hiện đáp án</label></div>
        <p class="hint">HS làm trên app sẽ được đảo thứ tự câu và phương án. Bấm “In / Lưu PDF” rồi chọn “Lưu dưới dạng PDF” để có file đề.</p></div>
        <div class="card">${mc.length ? `<p class="sec"><b>PHẦN I. Trắc nghiệm nhiều phương án lựa chọn</b></p>${mc.map((q, i) => item(q, i + 1)).join('')}` : ''}
          ${tf.length ? `<p class="sec"><b>PHẦN II. Trắc nghiệm đúng sai</b></p>${tf.map((q, i) => item(q, i + 1)).join('')}` : ''}
          ${tl.length ? `<p class="sec"><b>PHẦN III. Tự luận</b></p>${tl.map((q, i) => item(q, i + 1)).join('')}` : ''}</div>
        <div class="card"><div id="pvmsg"></div><div class="row"><button type="button" class="btn ghost" id="pvb">← Quay lại sửa</button><span class="spacer"></span><button type="button" class="btn" id="pvok">✅ Đề đã ổn – Giao bài & tạo mã QR</button></div></div>`;
      math(box);
      const d = { TieuDe: a.title || 'Bài kiểm tra', Truong: session.user.Truong || '', Khoi: curK(), ThoiGian: a.minutes || '…', versions: [v0] };
      $('#pvp').onclick = () => printExam(d, 'all', false, { noQr: true });
      $('#pvk').onclick = () => printExam(d, 'all', true, { noQr: true });
      if ($('#pvr')) $('#pvr').onclick = () => { a.ids = gen(); render(); toast('Đã bốc bộ câu mới'); };
      $('#pvs').onchange = e => { showKey = e.target.checked; render(); };
      $$('[data-rm]', box).forEach(b => b.onclick = () => { if (a.ids.length <= 1) { toast('Đề phải có ít nhất 1 câu'); return; } a.ids = a.ids.filter(x => x !== b.dataset.rm); render(); });
      $$('[data-sw]', box).forEach(b => b.onclick = () => {
        const q = bank.byId[b.dataset.sw], used = new Set(a.ids);
        const same = x => !used.has(x.id) && x.k === q.k && x.t === q.t && (q.t !== 'M' || x.md === q.md);
        let c = bank.q.filter(x => same(x) && x.bai && x.bai === q.bai);
        if (!c.length) c = bank.q.filter(x => same(x) && x.cd === q.cd);
        if (!c.length) { toast('Ngân hàng không còn câu khác cùng bài, cùng mức'); return; }
        const r = c[rnd(c.length)]; a.ids = a.ids.map(x => x === q.id ? r.id : x); render(); toast('Đã đổi câu');
      });
      $('#pvb').onclick = () => { box.remove(); f.style.display = ''; window.scrollTo(0, 0); };
      $('#pvok').onclick = e => busy(e.currentTarget, async () => {
        try { const send = Object.assign({}, a); delete send._miss; const b = await api('create_assignment', { assignment: send }); toast('Đã giao bài: ' + b.DanhSachCau.length + ' câu'); location.hash = '#/gv/bai/' + b.MaBai + '?moi=1'; }
        catch (err) { errBox($('#pvmsg'), err); }
      });
    };
    render();
    window.scrollTo(0, 0);
  };
  /* ----- chọn khối (khi chưa tích lớp) ----- */
  const kChips = k => targetK ? '' : `<div class="row" style="margin:8px 0 2px;gap:6px"><span class="hint">Khối:</span>${['10', '11', '12'].map(x => `<button type="button" class="btn ghost sm${x === k ? ' on' : ''}" data-kk="${x}">Lớp ${x}</button>`).join('')}<span class="hint">(tự theo lớp đã tích)</span></div>`;
  const bindK = () => $$('[data-kk]').forEach(b => b.onclick = () => {
    const c = $$('input[name=cl]:checked');
    if (c.length && c[0].dataset.k !== b.dataset.kk) { if (!confirm('Đang tích lớp khối ' + c[0].dataset.k + '. Bỏ tích các lớp đó để chọn khối ' + b.dataset.kk + '?')) return; c.forEach(i => i.checked = false); }
    selK = b.dataset.kk; renderMode();
  });
  /* ----- Theo đề có sẵn: bài học / đề + số câu từng mức ----- */
  const deSource = () => {
    const v = ($('#de') || {}).value || '';
    if (v.startsWith('PKG:')) { const p = lessonPackages(curK()).find(x => x.id === v.slice(4)); if (!p) return null; const qs = p.ids.map(id => bank.byId[id]).filter(Boolean); return { name: p.name, qs, cnt: lvCount(qs), pkg: p }; }
    if (v.startsWith('DE:')) { const de = v.slice(3), qs = bank.q.filter(q => q.de === de); return { name: de, de, qs, cnt: lvCount(qs) }; }
    return null;
  };
  const lvInputs = () => { const n = {}; LV.forEach(([f]) => { n[f] = Math.max(0, +(($('#x_' + f) || {}).value) || 0); }); return n; };
  const fillLv = () => {
    const s = deSource(); if (!s) return;
    LV.forEach(([f]) => { const i = $('#x_' + f); if (!i) return; i.value = s.cnt[f]; i.max = s.cnt[f]; i.disabled = !s.cnt[f]; ($('#c_' + f) || {}).textContent = 'có ' + s.cnt[f]; });
    sumLv();
  };
  const sumLv = () => { const n = lvInputs(), s = deSource(); ($('#xsum') || {}).innerHTML = s ? `Sẽ giao <b>${LV.reduce((a, [f]) => a + Math.min(n[f], s.cnt[f]), 0)}</b> / ${s.qs.length} câu` : ''; };
  const deBox = k => {
    const pkgs = lessonPackages(k), exams = []; // đề thi thử TN để HS tự luyện ở thư mục Bộ đề, không giao ở đây
    return `${kChips(k)}
      <label for="de">Chọn bài học / đề giao cho lớp (Khối ${k})</label>
      <select id="de" style="width:100%">
        ${pkgs.length ? `<optgroup label="📖 Theo bài học SGK – Công nghệ ${k}">${pkgs.map(p => `<option value="PKG:${p.id}">${esc(p.shortName)} (${p.count} câu)</option>`).join('')}</optgroup>` : ''}
        ${exams.length ? `<optgroup label="🎓 Đề thi thử tốt nghiệp THPT (28 câu/đề)">${exams.map(d => `<option value="DE:${esc(d)}">${esc(d)}</option>`).join('')}</optgroup>` : ''}
      </select>
      <div class="lvgrid">${LV.map(([f, t]) => `<div><label for="x_${f}">${t}</label><input id="x_${f}" type="number" min="0"><span class="hint" id="c_${f}"></span></div>`).join('')}</div>
      <p class="hint"><span id="xsum"></span> · Mặc định lấy <b>toàn bộ</b> câu của bài. Muốn ít hơn thì sửa số câu từng mức, app bốc ngẫu nhiên đúng số đó (cả lớp làm chung, mỗi em được đảo câu và phương án).</p>`;
  };
  /* ----- Đề theo ma trận: kì + bảng số câu từng bài ----- */
  const readCells = () => $$('[data-c]').forEach(i => { const c = mt.cells[i.dataset.c] = mt.cells[i.dataset.c] || {}; c[i.dataset.f] = Math.max(0, +i.value || 0); });
  const applyTpl = (k, src) => {
    mt.src = src; mt.cells = {};
    let t = null;
    if (src.startsWith('CV')) t = (window.STC_MATRAN || []).find(x => x.id === src);
    else if (src.startsWith('MT:')) { const m = schoolMx.find(x => x.MaMT === src.slice(3)); if (m) t = { loai: m.Loai, thoiGian: m.ThoiGian, rows: m.rows, ten: m.TenMT }; }
    if (t) {
      t.rows.forEach(r => { const c = mt.cells[mtKey(r)] = mt.cells[mtKey(r)] || { b: 0, h: 0, v: 0, ds: 0, tl: 0 }; c.b += +r.b || 0; c.h += +r.h || 0; c.v += +r.v || 0; c.ds += +r.ds || 0; c.tl += (+r.tb || 0) + (+r.th || 0) + (+r.tv || 0); });
      if ($('#mi')) $('#mi').value = t.thoiGian || 45;
      const ky = t.loai || '';
      if ($('#t') && (!$('#t').value || /^Kiểm tra (Giữa|Cuối) kì|^Kiểm tra Công nghệ|^Đề TN/.test($('#t').value))) $('#t').value = 'Kiểm tra ' + ky + ' – Công nghệ ' + k;
      if ($('#lbx')) $('#lbx').value = /Giữa/.test(ky) ? 'Kiểm tra giữa kì' : /Cuối/.test(ky) ? 'Kiểm tra cuối kì' : $('#lbx').value;
    }
    if (src === 'SO') { if ($('#mi')) $('#mi').value = 50; if ($('#lbx')) $('#lbx').value = 'Thi thử'; if ($('#t') && !$('#t').value) $('#t').value = 'Đề thi thử TN THPT – Công nghệ 12'; }
  };
  const mxBox = k => {
    if (mt.k !== k) { mt.k = k; const first = (window.STC_MATRAN || []).find(t => t.khoi === k); applyTpl(k, first ? first.id : ''); }
    const tpls = (window.STC_MATRAN || []).filter(t => t.khoi === k), mine = schoolMx.filter(m => String(m.Khoi) === k);
    const rows = mtLessons(k);
    const srcBtn = (v, t) => `<button type="button" class="btn ghost sm${mt.src === v ? ' on' : ''}" data-src="${esc(v)}">${esc(t)}</button>`;
    const head = `${kChips(k)}<label>Ma trận đề kiểm tra Công nghệ ${k}</label>
      <div class="row" style="gap:6px;flex-wrap:wrap">${tpls.map(t => srcBtn(t.id, t.loai)).join('')}${mine.map(m => srcBtn('MT:' + m.MaMT, '🏫 ' + m.TenMT)).join('')}${srcBtn('', '✏️ Tự nhập')}</div>`;
    if (mt.src === 'SO') return head + '<p class="hint" style="margin-top:8px">Mỗi vị trí câu (Câu 1–24, Đúng/Sai 1–4) được bốc ngẫu nhiên từ 30 đề thi thử cùng cấu trúc ma trận của Sở. Cả lớp làm chung 1 đề, mỗi em được đảo câu và phương án.</p>';
    return head + `<p class="hint" style="margin:8px 0 4px">Bảng lấy sẵn số câu theo ma trận CV 7991 của kì đã chọn; thầy cô sửa số câu từng bài, từng mức tuỳ ý. Số nhỏ bên cạnh là số câu ngân hàng đang có. Bài để trống = không lấy.</p>
      <div class="tablewrap"><table class="mttable"><thead><tr><th>Bài học</th>${LV.map(([, t]) => `<th class="n">${t}</th>`).join('')}<th class="n">Cộng</th></tr></thead><tbody>
      ${rows.map(r => { const c = mt.cells[r.key] || {}, av = lvCount(rowPool(k, r).lesson), s = LV.reduce((a, [f]) => a + (+c[f] || 0), 0);
        return `<tr data-row="${esc(r.key)}" class="${s ? 'on' : ''}"><td>${esc(r.value)}</td>${LV.map(([f]) => `<td class="n"><input type="number" min="0" inputmode="numeric" data-c="${esc(r.key)}" data-f="${f}" value="${+c[f] || ''}" placeholder="0" class="${(+c[f] || 0) > av[f] ? 'over' : ''}"><small>/${av[f]}</small></td>`).join('')}<td class="n"><b data-s="${esc(r.key)}">${s || ''}</b></td></tr>`; }).join('')}
      </tbody><tfoot><tr><th>Tổng số câu</th>${LV.map(([f]) => `<th class="n" data-t="${f}"></th>`).join('')}<th class="n" data-t="all"></th></tr></tfoot></table></div>
      <div class="row" style="margin-top:6px"><span class="grow hint" id="mtw"></span><button type="button" class="btn ghost sm" id="mtclr">Xoá hết số</button></div>`;
  };
  const totals = () => {
    readCells();
    const k = curK(), rows = mtLessons(k), T = { b: 0, h: 0, v: 0, ds: 0, tl: 0 };
    let over = 0;
    rows.forEach(r => { const c = mt.cells[r.key] || {}; let s = 0; LV.forEach(([f]) => { T[f] += +c[f] || 0; s += +c[f] || 0; });
      const tr = $(`tr[data-row="${CSS.escape(r.key)}"]`); if (tr) { tr.classList.toggle('on', s > 0); const b = $(`[data-s="${CSS.escape(r.key)}"]`, tr); if (b) b.textContent = s || ''; } });
    $$('[data-c]').forEach(i => { const av = +i.nextElementSibling.textContent.slice(1); const o = (+i.value || 0) > av; i.classList.toggle('over', o); if (o) over++; });
    LV.forEach(([f]) => { const th = $(`[data-t="${f}"]`); if (th) th.textContent = T[f]; });
    const all = LV.reduce((a, [f]) => a + T[f], 0), th = $('[data-t="all"]'); if (th) th.textContent = all;
    const w = $('#mtw'); if (w) w.innerHTML = `${T.b + T.h + T.v} câu nhiều lựa chọn · ${T.ds} câu Đúng/Sai · ${T.tl} câu tự luận${over ? ` · <span style="color:var(--bad)">${over} ô vượt số câu đang có (app lấy bù câu cùng chương, nếu thiếu thì đề ít câu hơn)</span>` : ''}`;
  };
  /* ----- Chủ đề & mức độ ----- */
  const rndBox = k => {
    const tp = topicsOf(k), ls = lessonsOf(k);
    return `${kChips(k)}
      <label>Chủ đề – Công nghệ ${k}</label><div class="checks">${tp.map(t => `<label class="chk"><input type="checkbox" name="tp" value="${esc(t)}">${esc(t.replace(/^Lớp \d+ – /, ''))}</label>`).join('')}</div>
      ${ls.length ? `<label>Hoặc bài học SGK</label><div class="lessonlist" style="max-height:260px">${ls.map(t => `<label class="lchk"><input type="checkbox" name="ls" value="${esc(t)}"><span class="grow">${esc(t)}</span><span class="n">${bank.q.filter(q => q.k === k && q.bai === t).length}</span></label>`).join('')}</div>` : ''}
      <div class="lvgrid"><div><label for="nb">Số câu Biết</label><input id="nb" type="number" min="0" value="4"></div><div><label for="nh">Số câu Hiểu</label><input id="nh" type="number" min="0" value="4"></div>
      <div><label for="nv">Số câu Vận dụng</label><input id="nv" type="number" min="0" value="2"></div><div><label for="nd">Số câu Đúng/Sai</label><input id="nd" type="number" min="0" value="0"></div>
      <div><label for="ntl">Số câu tự luận</label><input id="ntl" type="number" min="0" value="0"></div></div>
      <p class="hint">Không chọn chủ đề/bài nào = lấy từ toàn bộ ngân hàng. Câu tự luận do AI chấm theo đáp án mẫu khi HS nộp.</p>`;
  };
  const renderMode = () => {
    const k = curK(), box = $('#mbox'); if (!box) return;
    box.innerHTML = mode === 'de' ? deBox(k) : mode === 'matran' ? mxBox(k) : rndBox(k);
    bindK();
    if (mode === 'de') {
      $('#de').onchange = () => { const s = deSource(); fillLv(); if (!s) return; $('#t').value = 'Kiểm tra ' + (s.pkg ? s.pkg.shortName : s.name); $('#mi').value = s.de ? 50 : Math.min(90, Math.ceil(s.qs.length * 1.2)); };
      LV.forEach(([f]) => { const i = $('#x_' + f); if (i) i.oninput = sumLv; });
      fillLv();
    }
    if (mode === 'matran') {
      $$('[data-src]').forEach(b => b.onclick = () => { readCells(); applyTpl(k, b.dataset.src); renderMode(); });
      $$('[data-c]').forEach(i => i.oninput = totals);
      if ($('#mtclr')) $('#mtclr').onclick = () => { mt.cells = {}; mt.src = ''; renderMode(); };
      if ($('[data-t]')) totals();
    }
    if (mode === 'ngaunhien') $$('[data-pre]').forEach(b => b.onclick = () => { const [m, nb, nh, nv] = b.dataset.pre.split(','); $('#mi').value = m; $('#nb').value = nb; $('#nh').value = nh; $('#nv').value = nv; $('#nd').value = 0; $('#ntl').value = 0; $('#lbx').value = +m >= 15 ? 'Kiểm tra 15 phút' : 'Kiểm tra thường xuyên'; if (!$('#t').value) $('#t').value = 'Kiểm tra ' + m + ' phút'; toast('Đã chọn mẫu ' + m + ' phút'); });
  };
  draw();
  api('list_matrices').then(ms => { schoolMx = ms || []; store.set('matrices', schoolMx); if (mode === 'matran' && $('#mbox')) { readCells(); renderMode(); } }).catch(() => {});
});

route(/^\/gv\/baigiao$/, async () => {
  if (!needGV()) return;
  setView('<h1>Bài đã giao</h1><div id="l"><div class="card empty">Đang tải…</div></div>');
  try {
    const l = await api('list_assignments');
    ($('#l') || {}).innerHTML = l.length ? '<div class="list">' + l.map(a => `<a class="item" href="#/gv/bai/${a.MaBai}"><div class="grow"><b>${esc(a.TieuDe)}</b> ${a.LoaiBai ? `<span class="pill">${esc(a.LoaiBai)}</span>` : ''}
      <div class="meta">Khối ${esc(a.Khoi)} · ${a.DanhSachLop.length} lớp · ${a.DanhSachCau.length} câu · ${a.soHS} HS đã nộp · ${esc(a.TenGV)} · ${dt(a.NgayTao)}</div></div>›</a>`).join('') + '</div>'
      : '<div class="card empty">Chưa giao bài nào. <a href="#/gv/giaobai">Giao bài ngay</a></div>';
  } catch (e) { errBox($('#l'), e); }
});

const asgLink = maBai => location.origin + location.pathname + '#/baigiao?mo=' + maBai;
function printQR(a, svg, lops) {
  const w = window.open('', '_blank'); if (!w) { toast('Hãy cho phép cửa sổ bật lên'); return; }
  w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Mã QR – ${esc(a.TieuDe)}</title><style>body{font-family:Arial,sans-serif;text-align:center;color:#000;margin:0}.p{padding:14mm}h1{font-size:26pt;margin:0 0 6px}h2{font-size:16pt;font-weight:normal;margin:0 0 16px}
    .qr svg{width:120mm;height:120mm}ol{display:inline-block;text-align:left;font-size:15pt;line-height:1.7}.l{font-size:11pt;color:#333;word-break:break-all}.bar{background:#0f4c45;color:#fff;padding:8px}@media print{.bar{display:none}@page{size:A4;margin:10mm}}</style></head>
    <body><div class="bar"><button onclick="print()" style="font-size:15px;padding:6px 16px">🖨️ In / Lưu PDF</button></div><div class="p"><h1>${esc(a.TieuDe)}</h1><h2>Công nghệ ${esc(a.Khoi)} · ${esc(lops)}${a.ThoiGian ? ' · ' + a.ThoiGian + ' phút' : ''}</h2>
    <div class="qr">${svg}</div><ol><li>Mở camera điện thoại, quét mã QR</li><li>Đăng nhập tài khoản học sinh SmarttechCN 2026</li><li>Bấm <b>Làm bài</b> ở bài được tô viền xanh</li></ol><p class="l">${esc(asgLink(a.MaBai))}</p></div></body></html>`);
  w.document.close();
}
route(/^\/gv\/bai\/(\w+)$/, async (params, maBai) => {
  if (!needGV()) return;
  setView('<div class="card empty">Đang tải…</div>');
  try {
    const [l, cls] = await Promise.all([api('list_assignments'), api('my_classes')]);
    const a = l.find(x => x.MaBai === maBai);
    if (!a) throw new Error('Không tìm thấy bài');
    const my = cls.filter(c => a.DanhSachLop.includes(c.MaLop));
    const [lb, st, ...res] = await Promise.all([api('leaderboard', { key: maBai, khoi: a.Khoi, full: true }), a.CheDoDiem === 'calop' ? api('assignment_status', { maBai }).catch(() => null) : null, ...my.map(c => api('class_results', { code: c.MaLop, maBai }))]);
    const hangK = {}; (lb.top || []).forEach(x => { if (x.ma) hangK[x.ma] = x.hang; });
    const lb20 = Object.assign({}, lb, { top: (lb.top || []).slice(0, 20) });
    const cddName = (DIEM_MODES.find(x => x[0] === (a.CheDoDiem || 'dapan')) || DIEM_MODES[0])[1];
    const link = asgLink(maBai), qrBig = await qrSvg(link, 6), lopNames = a.DanhSachLop.map(c => (cls.find(x => x.MaLop === c) || {}).TenLop || c).join(', ');
    if (a.DanhSachCau.some(id => !bank.byId[id])) await syncBank(true);
    res.forEach((rs, i) => rs.forEach(r => { r.maLop = my[i].MaLop; }));
    const all = res.flat().sort((x, y) => viNameCmp(x.hoTen, y.hoTen) || x.lan - y.lan);
    const first = {}; all.forEach(r => { if (!first[r.maHS] || r.lan < first[r.maHS].lan) first[r.maHS] = r; });
    const fr = Object.values(first);
    const avg = fr.length ? fr.reduce((s, r) => s + r.diem, 0) / fr.length : 0;
    const dist = [0, 0, 0, 0, 0]; fr.forEach(r => dist[Math.min(4, Math.floor(r.diem / 2))]++);
    const dmax = Math.max(1, ...dist);
    setView(`<a href="#/gv/baigiao">← Bài đã giao</a><h1>${esc(a.TieuDe)}</h1>
      <p class="sub">Khối ${esc(a.Khoi)} · ${a.DanhSachCau.length} câu${a.ThoiGian ? ' · ' + a.ThoiGian + ' phút' : ''}${a.HanNop ? ' · hạn ' + dt(a.HanNop) : ''} · Lớp: ${esc(a.DanhSachLop.map(c => (cls.find(x => x.MaLop === c) || {}).TenLop || c).join(', '))}<br>Sau khi nộp: <b>${esc(cddName)}</b></p>
      <div class="card qrcard${params && params.get('moi') ? ' fresh' : ''}"><div class="row" style="align-items:center;gap:16px;flex-wrap:wrap"><div class="qrbox">${qrBig}</div>
        <div class="grow">${params && params.get('moi') ? '<div class="okmsg" style="margin:0 0 6px">✅ Đã giao bài. HS quét mã này để mở đúng bài.</div>' : ''}<h3 style="margin:0 0 4px">📱 Mã QR cho học sinh</h3>
          <p class="hint" style="margin:0 0 8px">HS quét bằng camera điện thoại → đăng nhập tài khoản HS → bài này hiện lên đầu, bấm <b>Làm bài</b>. Chỉ HS thuộc lớp được giao mới làm được.</p>
          <div class="row" style="flex-wrap:wrap"><button class="btn sm" id="qfull">🖥️ Trình chiếu mã QR</button><button class="btn ghost sm" id="qprint">🖨️ In mã QR</button><button class="btn ghost sm" id="qcopy">🔗 Sao chép link</button></div>
          <div class="row" style="flex-wrap:wrap;margin-top:6px"><button class="btn ghost sm" id="dprint">📄 In / Lưu PDF đề</button><button class="btn ghost sm" id="dkey">📄 Đề kèm đáp án</button></div></div></div></div>
      ${a.CheDoDiem === 'calop' ? `<div class="card note"><div class="row"><div class="grow">${a.CongBo ? '📢 <b>Đã công bố điểm</b> – HS đã xem được điểm và đáp án.' : '⏳ HS chỉ thấy điểm khi <b>cả lớp đã nộp</b>, đến hạn nộp, hoặc khi thầy cô công bố.'}
        ${st ? '<div class="meta" style="margin-top:4px">' + st.map(c => `Lớp ${esc(c.TenLop)}: <b>${c.nop}/${c.si}</b> HS đã nộp${c.si && c.nop >= c.si ? ' ✅' : ''}`).join(' · ') + '</div>' : ''}</div>
        ${a.cuaToi || session.role === 'admin' ? `<button class="btn sm${a.CongBo ? ' ghost' : ''}" id="pub">${a.CongBo ? 'Ẩn điểm lại' : '📢 Công bố điểm ngay'}</button>` : ''}</div></div>` : ''}
      <div class="card"><div class="row"><div class="grow"><b>${fr.length}</b> HS lớp tôi đã nộp · điểm TB lần đầu <b>${fmt(avg)}</b></div>
        <button class="btn sm" id="ex">⬇ Xuất Excel</button>${a.cuaToi || session.role === 'admin' ? '<button class="btn sm danger" id="del">Xóa bài</button>' : ''}</div>
        <h3>Phổ điểm</h3><div class="bars">${['0–2', '2–4', '4–6', '6–8', '8–10'].map((t, i) => `<div class="bar"><span>${t} điểm</span><span class="tr"><i style="width:${dist[i] / dmax * 100}%;background:var(--brand2)"></i></span><span class="v">${dist[i]}</span></div>`).join('')}</div></div>
      <div class="card aicard"><div class="row" style="align-items:center"><div class="grow"><h3 style="margin:0">🤖 AI phân tích kết quả</h3><div class="hint">Chỉ ra nội dung lớp còn hổng, câu sai nhiều, nhóm học sinh cần kèm và gợi ý dạy lại cho tiết sau.</div></div>
        <button class="btn sm" id="aian" ${fr.length < 3 ? 'disabled title="Cần ít nhất 3 HS nộp bài"' : ''}>✨ Phân tích</button></div><div id="aiout"></div></div>
      <h2>🏆 Top 20 khối ${esc(a.Khoi)}</h2>${lbHtml(lb20)}
      <h2>Chi tiết lớp tôi</h2><div class="card"><div class="tablewrap"><table><thead><tr><th>Họ tên</th><th>Lớp</th><th class="n">Lần</th><th class="n">Điểm</th><th class="n" title="Hạng trong cả khối ${esc(a.Khoi)} (tính lần làm đầu tiên)">Hạng khối</th><th class="n">Đúng</th><th class="n">T.gian</th><th>Nộp lúc</th></tr></thead><tbody>
      ${all.map(r => { const c = my.find(x => x.MaLop === r.maLop); return `<tr><td>${esc(r.hoTen)}</td><td>${esc(c ? c.TenLop : '')}</td><td class="n">${r.lan}</td><td class="n"><b>${fmt(r.diem)}</b></td><td class="n">${first[r.maHS] === r && hangK[r.maHS] ? `<b>${hangK[r.maHS]}</b>/${lb.total}` : ''}</td><td class="n">${r.dung}/${r.tong}</td><td class="n">${mmss(r.giay)}</td><td>${dt(r.t)}</td></tr>`; }).join('') || '<tr><td colspan="8" class="empty">Chưa có bài nộp</td></tr>'}</tbody></table></div>
      <p class="hint">Hạng khối: xếp chung tất cả HS khối ${esc(a.Khoi)} đã làm bài này (theo điểm lần đầu, bằng điểm thì ai làm nhanh hơn đứng trước).</p></div>`);
    const exam = { TieuDe: a.TieuDe, Truong: session.user.Truong || '', Khoi: a.Khoi, ThoiGian: a.ThoiGian || '…', versions: [{ ma: '', ids: a.DanhSachCau.filter(id => bank.byId[id]), perm: {} }] };
    $('#dprint').onclick = () => printExam(exam, 'all', false, { link, note: 'HS quét mã QR để làm bài này trực tuyến trên SmarttechCN 2026.' });
    $('#dkey').onclick = () => printExam(exam, 'all', true, { link, note: 'HS quét mã QR để làm bài này trực tuyến trên SmarttechCN 2026.' });
    $('#qprint').onclick = () => printQR(a, qrBig, lopNames);
    $('#qcopy').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Đã sao chép link – gửi vào nhóm Zalo lớp'); } catch (e) { prompt('Link bài cho HS:', link); } };
    $('#qfull').onclick = () => {
      const ov = document.createElement('div'); ov.className = 'qrfull';
      ov.innerHTML = `<div class="qrin"><h2>${esc(a.TieuDe)}</h2><p>${esc(lopNames)} · quét mã để làm bài</p><div class="qrbig">${qrBig}</div><button class="btn">Đóng</button></div>`;
      document.body.appendChild(ov); const close = () => { ov.remove(); document.removeEventListener('keydown', esc1); }; const esc1 = e => { if (e.key === 'Escape') close(); };
      ov.onclick = close; document.addEventListener('keydown', esc1); try { ov.requestFullscreen && ov.requestFullscreen(); } catch (e) {}
    };
    const aiKey = 'ai_an_' + maBai, aiOld = store.get(aiKey, null);
    const showAi = (r, t) => { $('#aiout').innerHTML = aiReportHtml(r) + `<div class="row" style="margin-top:8px"><span class="grow hint">Phân tích lúc ${dt(t)}</span><button class="btn ghost sm" id="aipr">🖨️ In báo cáo</button></div>`;
      $('#aipr').onclick = () => { const w = window.open('', '_blank'); if (!w) return; w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phân tích kết quả – ${esc(a.TieuDe)}</title><style>body{font-family:Arial,sans-serif;max-width:190mm;margin:10mm auto;font-size:11.5pt;color:#000;line-height:1.45}h3{margin:12px 0 4px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}.bar{display:grid;grid-template-columns:1fr 2fr 50px;gap:6px;align-items:center;margin:3px 0}.tr{background:#eee;height:10px;border-radius:5px;overflow:hidden;display:block}.tr i{display:block;height:100%}.expl{border-left:3px solid #1f5bd6;padding:4px 10px;margin:6px 0}.expl .t{display:block}.hint{color:#444;font-size:10pt}.aigrp{margin:6px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media print{button{display:none}}</style></head><body><button onclick="print()">🖨️ In / Lưu PDF</button><h2>SmarttechCN 2026 – Báo cáo phân tích kết quả</h2>${aiReportHtml(r)}</body></html>`); w.document.close(); };
    };
    if (aiOld) showAi(aiOld.r, aiOld.t);
    $('#aian').onclick = e => busy(e.currentTarget, async () => {
      $('#aiout').innerHTML = '<p class="hint">🤖 AI đang phân tích (khoảng 10–60 giây, xin chờ)…</p>';
      try { const r = await api('ai_analyze', { maBai }); store.set(aiKey, { r, t: Date.now() }); showAi(r, Date.now()); }
      catch (err) { errBox($('#aiout'), err); }
    });
    if ($('#pub')) $('#pub').onclick = e => busy(e.currentTarget, async () => { try { await api('publish_scores', { maBai, on: !a.CongBo }); toast(a.CongBo ? 'Đã ẩn điểm' : 'Đã công bố điểm cho HS'); window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (err) { toast(err.message); } });
    $('#ex').onclick = () => csv('KetQua_' + a.TieuDe.replace(/[^\wÀ-ỹ]+/g, '_') + '.csv', [['Họ tên', 'Lớp', 'Lần', 'Điểm', 'Hạng khối', 'Số câu đúng', 'Tổng câu', 'Thời gian (giây)', 'Nộp lúc'], ...all.map(r => { const c = my.find(x => x.MaLop === r.maLop); return [r.hoTen, c ? c.TenLop : '', r.lan, r.diem, first[r.maHS] === r && hangK[r.maHS] ? hangK[r.maHS] + '/' + lb.total : '', r.dung, r.tong, r.giay, dt(r.t)]; })]);
    if ($('#del')) $('#del').onclick = async () => { if (!confirm('Xóa bài này? HS sẽ không thấy bài nữa (kết quả cũ vẫn giữ trong Sheets).')) return; try { await api('delete_assignment', { maBai }); location.hash = '#/gv/baigiao'; } catch (e) { toast(e.message); } };
  } catch (e) { errBox(V, e); }
});

route(/^\/gv\/nganhang$/, params => {
  if (!needGV()) return;
  const initK = params ? (params.get('k') || '') : '';
  const f = { k: initK, cd: '', md: '', de: '', s: '' }; let page = 0; const open = {};
  const draw = () => {
    const list = bank.q.filter(q => (!f.k || q.k === f.k) && (!f.cd || q.cd === f.cd) && (!f.md || (f.md === 'T' || f.md === 'L' ? q.t === f.md : f.md === 'IMG' ? hasImg(q) : q.md === f.md)) && (!f.de || q.de === f.de) && (!f.s || plain(q.s).toLowerCase().includes(f.s.toLowerCase())));
    const P = 20, pages = Math.max(1, Math.ceil(list.length / P)); page = Math.min(page, pages - 1);
    setView(`<h1>Ngân hàng câu hỏi</h1><p class="sub">${bank.q.length} câu. Sửa trực tiếp trong Google Sheets (trang NganHang) hoặc <a href="#/gv/themcau">thêm câu mới</a>.</p>
      <div class="card"><div class="row">
        <select id="fk" style="flex:1;min-width:110px"><option value="">Mọi khối</option>${['10', '11', '12'].map(k => `<option ${f.k === k ? 'selected' : ''}>${k}</option>`).join('')}</select>
        <select id="fcd" style="flex:3;min-width:180px"><option value="">Mọi chủ đề</option>${topicsOf(f.k).map(t => `<option ${f.cd === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <select id="fmd" style="flex:1;min-width:120px"><option value="">Mọi mức độ</option>${['Biết', 'Hiểu', 'Vận dụng'].map(m => `<option ${f.md === m ? 'selected' : ''}>${m}</option>`).join('')}<option value="T" ${f.md === 'T' ? 'selected' : ''}>Đúng/Sai</option><option value="L" ${f.md === 'L' ? 'selected' : ''}>Tự luận</option><option value="IMG" ${f.md === 'IMG' ? 'selected' : ''}>Câu có hình</option></select>
        <select id="fde" style="flex:2;min-width:150px"><option value="">Mọi nguồn</option>${[...new Set(bank.q.map(q => q.de))].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true })).map(d => `<option ${f.de === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>
        <input id="fs" type="text" placeholder="Tìm nội dung…" value="${esc(f.s)}" style="flex:3;min-width:180px"></div>
        <p class="hint">${list.length} câu phù hợp</p></div>
      <div class="list">${list.slice(page * P, page * P + P).map(q => `<div class="card" style="margin:0"><div class="row"><div class="grow" style="min-width:0"><b>${esc(q.id)}</b> ${q.t === 'L' ? '<span class="pill warn">Tự luận</span> ' : ''}<span class="pill">${esc(q.md)}</span>
        <div class="meta hint">${esc(q.cd)} · ${esc(q.bai)} · ${esc(q.de)}</div><div style="margin-top:4px">${esc(plain(q.s).slice(0, 180))}</div></div>
        <button class="btn ghost sm" data-o="${esc(q.id)}">${open[q.id] ? 'Ẩn' : 'Xem'}</button></div>
        ${open[q.id] ? `<div class="preview">${qHtml(q, { ids: [q.id], perm: { [q.id]: [0, 1, 2, 3] }, resp: {} }, 0, { showAns: true })}
          ${q.t === 'L' ? `<div class="expl ans"><b class="t">Đáp án mẫu (${fmt(q.p || 1)} điểm)</b>${sanitize(q.a)}${q.e ? `<div style="margin-top:6px"><b>Hướng dẫn chấm:</b> ${sanitize(q.e)}</div>` : ''}</div>`
            : `<div class="expl ans"><b class="t">Đáp án: ${esc(q.a)}</b>${q.t === 'T' ? (q.e || []).map((e, k) => e ? `<div><b>${'abcd'[k]})</b> ${sanitize(e)}</div>` : '').join('') : sanitize(q.e)}</div>`}${sgkLink(q)}</div>` : ''}</div>`).join('')}</div>
      <div class="row" style="margin-top:12px;justify-content:center"><button class="btn ghost sm" id="pp" ${page ? '' : 'disabled'}>‹ Trước</button><span>Trang ${page + 1}/${pages}</span><button class="btn ghost sm" id="np" ${page < pages - 1 ? '' : 'disabled'}>Sau ›</button></div>`);
    $('#fk').onchange = e => { f.k = e.target.value; f.cd = ''; page = 0; draw(); };
    $('#fcd').onchange = e => { f.cd = e.target.value; page = 0; draw(); };
    $('#fmd').onchange = e => { f.md = e.target.value; page = 0; draw(); };
    $('#fde').onchange = e => { f.de = e.target.value; page = 0; draw(); };
    $('#fs').onchange = e => { f.s = e.target.value; page = 0; draw(); };
    $$('[data-o]').forEach(b => b.onclick = () => { open[b.dataset.o] = !open[b.dataset.o]; draw(); });
    $('#pp').onclick = () => { page--; draw(); }; $('#np').onclick = () => { page++; draw(); };
  };
  draw();
});

/* ================= AI soạn câu hỏi mới (GV duyệt, sửa rồi thêm vào ngân hàng) ================= */
route(/^\/gv\/aisoancau$/, params => {
  if (!needGV()) return;
  const f = store.get('ai_soan_f', { k: (params && params.get('k')) || '12', bai: '', type: 'M', md: 'Hiểu', n: 5, yc: '' });
  if (params && params.get('k')) f.k = params.get('k');
  let items = [], busyGen = false;
  const cdOf = (k, bai) => { const c = {}; bank.q.filter(q => q.k === k && q.bai === bai).forEach(q => { c[q.cd] = (c[q.cd] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || bai; };
  const itemHtml = (x, i) => {
    const opt = x.type === 'M' ? `<div class="aio">${[0, 1, 2, 3].map(j => `<label class="row" style="gap:6px;align-items:center;margin:3px 0"><b style="width:18px">${LETTERS[j]}.</b><input type="text" data-i="${i}" data-o="${j}" value="${esc(x.o[j])}" class="grow"></label>`).join('')}
        <div class="row" style="gap:8px;align-items:center;margin-top:6px"><span>Đáp án đúng:</span><select data-i="${i}" data-a="1">${[...LETTERS].map(L => `<option ${L === x.answer ? 'selected' : ''}>${L}</option>`).join('')}</select></div></div>`
      : x.type === 'T' ? `<div class="aio">${[0, 1, 2, 3].map(j => `<div class="row" style="gap:6px;align-items:center;margin:3px 0"><b style="width:18px">${'abcd'[j]})</b><input type="text" data-i="${i}" data-o="${j}" value="${esc(x.o[j])}" class="grow"><select data-i="${i}" data-tf="${j}"><option value="Đ" ${x.answer[j] === 'Đ' ? 'selected' : ''}>Đúng</option><option value="S" ${x.answer[j] === 'S' ? 'selected' : ''}>Sai</option></select></div>`).join('')}</div>`
      : `<label>Đáp án mẫu</label><textarea data-i="${i}" data-f="answer" rows="3">${esc(x.answer)}</textarea>
         <div class="row" style="gap:8px;align-items:center;margin-top:6px"><span>Điểm câu này:</span><input type="number" min="0.25" max="10" step="0.25" data-i="${i}" data-f="points" value="${x.points || 1}" style="width:90px"></div>`;
    const expl = x.type === 'T' ? `<label>Giải thích từng ý</label>${[0, 1, 2, 3].map(j => `<input type="text" data-i="${i}" data-e="${j}" value="${esc(x.expl[j] || '')}" placeholder="${'abcd'[j]})" style="margin:2px 0">`).join('')}`
      : `<label>${x.type === 'L' ? 'Hướng dẫn chấm (AI dựa vào đây để chấm bài HS)' : 'Giải thích'}</label><textarea data-i="${i}" data-f="expl" rows="2">${esc(x.expl || '')}</textarea>`;
    return `<div class="card aiq${x.saved ? ' saved' : ''}" id="aiq${i}"><div class="row" style="align-items:center"><label class="chk" style="margin:0"><input type="checkbox" data-pick="${i}" ${x.pick && !x.saved ? 'checked' : ''} ${x.saved ? 'disabled' : ''}><b>Câu ${i + 1}</b></label>
        <span class="pill">${x.type === 'M' ? 'Nhiều lựa chọn · ' + esc(x.md) : x.type === 'T' ? 'Đúng/Sai' : 'Tự luận · ' + esc(x.md)}</span><span class="grow"></span>${x.saved ? '<span class="pill ok">✔ Đã thêm vào ngân hàng</span>' : ''}</div>
      <label>Nội dung câu hỏi</label><textarea data-i="${i}" data-f="stem" rows="3">${esc(x.stem)}</textarea>${opt}${expl}
      <label>Gợi ý cho HS</label><input type="text" data-i="${i}" data-f="hint" value="${esc(x.hint || '')}"></div>`;
  };
  const draw = () => {
    const ls = lessonsOf(f.k); if (!ls.includes(f.bai)) f.bai = ls[0] || '';
    const nPick = items.filter(x => x.pick && !x.saved).length;
    setView(`<a href="#/gv">← Trang giáo viên</a><h1>🤖 AI soạn câu hỏi</h1><p class="sub">AI soạn câu hỏi mới bám sát SGK Công nghệ (Kết nối tri thức) theo bài và mức độ thầy cô chọn. Thầy cô <b>đọc, sửa</b> rồi mới thêm vào ngân hàng – câu được ghi nguồn “AI soạn, GV duyệt”.</p>
      <div class="card"><div class="row"><div style="width:110px"><label for="k">Khối</label><select id="k">${['10', '11', '12'].map(k => `<option ${k === f.k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
          <div class="grow"><label for="bai">Bài học</label><select id="bai">${ls.map(t => `<option ${t === f.bai ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div></div>
        <div class="row"><div class="grow"><label for="ty">Dạng câu</label><select id="ty"><option value="M" ${f.type === 'M' ? 'selected' : ''}>Nhiều lựa chọn</option><option value="T" ${f.type === 'T' ? 'selected' : ''}>Đúng/Sai (4 ý a–d)</option><option value="L" ${f.type === 'L' ? 'selected' : ''}>Tự luận</option></select></div>
          <div class="grow" ${f.type === 'T' ? 'style="opacity:.5"' : ''}><label for="md">Mức độ</label><select id="md" ${f.type === 'T' ? 'disabled' : ''}>${['Biết', 'Hiểu', 'Vận dụng'].map(m => `<option ${m === f.md ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
          <div style="width:110px"><label for="n">Số câu</label><select id="n">${[1, 2, 3, 4, 5, 6, 8, 10].map(n => `<option ${n === +f.n ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
        <label for="yc">Yêu cầu thêm (không bắt buộc)</label><input id="yc" type="text" maxlength="300" value="${esc(f.yc)}" placeholder="vd: gắn với thiết bị điện trong gia đình ở nông thôn; câu hỏi về an toàn khi sửa chữa…">
        <p class="hint">Ngân hàng hiện có ${bank.q.filter(q => q.k === f.k && q.bai === f.bai).length} câu của bài này – AI được dặn không soạn trùng.</p>
        <div id="msg"></div><button class="btn block" id="go" ${busyGen ? 'disabled' : ''}>${busyGen ? '🤖 AI đang soạn (khoảng 10–60 giây, xin chờ)…' : '✨ AI soạn câu hỏi'}</button></div>
      ${items.length ? `<div class="card note">⚠️ AI có thể sai. Thầy cô kiểm tra kĩ <b>kiến thức, đáp án, phương án nhiễu</b> trước khi thêm. Bỏ tích những câu chưa đạt.</div>
        ${items.map(itemHtml).join('')}
        <div class="card"><div id="msg2"></div><div class="row"><span class="grow hint">Đã chọn <b>${nPick}</b> câu</span><button class="btn" id="save" ${nPick ? '' : 'disabled'}>➕ Thêm ${nPick} câu vào ngân hàng</button></div></div>` : ''}`);
    const sync = () => { f.k = $('#k').value; f.bai = $('#bai').value; f.type = $('#ty').value; f.md = $('#md').value; f.n = +$('#n').value; f.yc = $('#yc').value; store.set('ai_soan_f', f); };
    ['#k', '#ty'].forEach(s => $(s).onchange = () => { sync(); draw(); });
    ['#bai', '#md', '#n', '#yc'].forEach(s => $(s).onchange = sync);
    $$('[data-i]').forEach(el => el.oninput = el.onchange = () => {
      const x = items[+el.dataset.i]; if (!x) return;
      if (el.dataset.f) x[el.dataset.f] = el.dataset.f === 'points' ? +el.value : el.value;
      else if (el.dataset.o != null) x.o[+el.dataset.o] = el.value;
      else if (el.dataset.a) x.answer = el.value;
      else if (el.dataset.tf != null) { const a = x.answer.split(''); a[+el.dataset.tf] = el.value; x.answer = a.join(''); }
      else if (el.dataset.e != null) x.expl[+el.dataset.e] = el.value;
    });
    $$('[data-pick]').forEach(c => c.onchange = () => { items[+c.dataset.pick].pick = c.checked; draw(); });
    $('#go').onclick = async () => {
      sync(); busyGen = true; draw();
      try { const got = await api('ai_questions', { khoi: f.k, bai: f.bai, type: f.type, md: f.md, n: f.n, yeuCau: f.yc }); items = got.map(x => Object.assign(x, { pick: true, k: f.k, bai: f.bai })).concat(items.filter(x => x.saved)); }
      catch (e) { busyGen = false; draw(); errBox($('#msg'), e); return; }
      busyGen = false; draw(); const c = $('.aiq'); if (c) window.scrollTo({ top: c.getBoundingClientRect().top + scrollY - 80, behavior: 'smooth' });
    };
    if ($('#save')) $('#save').onclick = e => busy(e.currentTarget, async () => {
      let ok = 0;
      for (const x of items.filter(y => y.pick && !y.saved)) {
        const q = { type: x.type, khoi: x.k, bai: x.bai, cd: cdOf(x.k, x.bai), md: x.md, stem: x.stem, hint: x.hint, ai: true };
        if (x.type === 'M') Object.assign(q, { o: x.o, answer: x.answer, expl: x.expl });
        else if (x.type === 'T') Object.assign(q, { o: x.o, answer: x.answer, expl: x.expl.map((v, j) => 'abcd'[j] + ') ' + v).join(' || ') });
        else Object.assign(q, { answer: x.answer, expl: x.expl, points: x.points || 1 });
        try { await api('add_question', { question: q }); x.saved = true; ok++; }
        catch (err) { errBox($('#msg2'), 'Câu ' + (items.indexOf(x) + 1) + ': ' + err.message); break; }
      }
      if (ok) { toast('Đã thêm ' + ok + ' câu vào ngân hàng'); syncBank(true); }
      draw();
    });
  };
  draw();
});

/* ================= AI phân tích kết quả bài kiểm tra ================= */
function aiReportHtml(r) {
  const s = r.stats, a = r.ai || {}, li = arr => (arr || []).map(x => `<li>${esc(typeof x === 'string' ? x : JSON.stringify(x))}</li>`).join('');
  const bar = (t, p) => `<div class="bar"><span>${esc(t)}</span><span class="tr"><i style="width:${Math.max(0, p)}%;background:${p >= 70 ? 'var(--ok)' : p >= 50 ? 'var(--accent)' : 'var(--bad)'}"></i></span><span class="v">${p}%</span></div>`;
  const grp = (t, l, cls) => `<div class="aigrp ${cls}"><b>${t} (${l.length})</b><div class="hint">${l.map(x => esc(x.ten) + ' <span>' + esc(x.lop) + ' · ' + fmt(x.diem) + '</span>').join(', ') || '—'}</div></div>`;
  return `<div class="airep">
    <p><b>${esc(s.bai_kiem_tra)}</b> · ${s.so_hs} học sinh (lần làm đầu) · điểm TB <b>${fmt(s.diem_tb)}</b> · lớp ${esc(r.lop.join(', '))}</p>
    ${a.nhan_xet_chung ? `<div class="expl ai"><b class="t">🤖 Nhận xét chung</b>${esc(a.nhan_xet_chung)}</div>` : ''}
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
      <div><h3>Tỉ lệ đúng theo mức độ</h3><div class="bars">${s.theo_muc_do.map(x => bar(x.ten + ' (' + x.so_cau + ' câu)', x.ti_le_dung)).join('')}</div></div>
      <div><h3>Tỉ lệ đúng theo bài học</h3><div class="bars">${s.theo_bai.slice(0, 8).map(x => bar(x.ten.replace(/^Bài (\d+)\..*/, 'Bài $1') + ' (' + x.so_cau + ')', x.ti_le_dung)).join('')}</div></div></div>
    ${(a.diem_manh || []).length ? `<h3>✅ Học sinh làm tốt</h3><ul>${li(a.diem_manh)}</ul>` : ''}
    ${(a.lo_hong || []).length ? `<h3>⚠️ Lỗ hổng kiến thức</h3><div class="tablewrap"><table><thead><tr><th>Nội dung</th><th>Biểu hiện</th><th>Nguyên nhân có thể</th></tr></thead><tbody>${a.lo_hong.map(x => `<tr><td><b>${esc(x.noi_dung || '')}</b></td><td>${esc(x.bieu_hien || '')}</td><td>${esc(x.nguyen_nhan || '')}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${s.cau_sai_nhieu.length ? `<h3>Câu sai nhiều nhất</h3><ol class="aisai">${s.cau_sai_nhieu.slice(0, 5).map(x => `<li><b>${esc(x.ti_le_sai)} sai</b> · ${esc(x.bai.replace(/^(Bài \d+)\..*/, '$1'))} · ${esc(x.muc_do)}<div class="hint">${esc(x.cau.slice(0, 220))}${x.cau.length > 220 ? '…' : ''}</div></li>`).join('')}</ol>` : ''}
    ${(a.goi_y_day_lai || []).length ? `<h3>🧑‍🏫 Gợi ý dạy lại</h3>${a.goi_y_day_lai.map(x => `<div class="expl"><b class="t">${esc(x.hoat_dong || '')}</b>${esc(x.cach_lam || '')}</div>`).join('')}` : ''}
    <h3>👥 Nhóm học sinh</h3>
    ${grp('🔴 Cần kèm thêm – dưới 5 điểm', r.nhom.can_kem, 'bad')}${a.goi_y_nhom && a.goi_y_nhom.can_kem ? `<p class="hint">→ ${esc(a.goi_y_nhom.can_kem)}</p>` : ''}
    ${grp('🟡 Ổn định – 5 đến dưới 8 điểm', r.nhom.on_dinh, 'mid')}${a.goi_y_nhom && a.goi_y_nhom.on_dinh ? `<p class="hint">→ ${esc(a.goi_y_nhom.on_dinh)}</p>` : ''}
    ${grp('🟢 Nâng cao – từ 8 điểm', r.nhom.nang_cao, 'ok')}${a.goi_y_nhom && a.goi_y_nhom.nang_cao ? `<p class="hint">→ ${esc(a.goi_y_nhom.nang_cao)}</p>` : ''}
    ${(a.cau_hoi_on || []).length ? `<h3>❓ Câu hỏi kiểm tra lại đầu tiết sau</h3><ol>${li(a.cau_hoi_on)}</ol>` : ''}
    <p class="hint">Tên học sinh không gửi cho AI; AI chỉ nhận số liệu thống kê đã ẩn danh. Nhận xét của AI để thầy cô tham khảo.</p></div>`;
}

route(/^\/gv\/themcau$/, () => {
  if (!needGV()) return;
  let type = 'M';
  const draw = () => {
    const tps = [...new Set(bank.q.map(q => q.cd))].sort((a, b) => a.localeCompare(b, 'vi'));
    setView(`<h1>Thêm câu hỏi</h1><div class="card note">🤖 Muốn soạn nhanh nhiều câu? Dùng <a href="#/gv/aisoancau">AI soạn câu hỏi</a> – AI soạn theo bài, mức độ, thầy cô duyệt rồi thêm.</div><p class="sub">Soạn theo bản đặc tả và nội dung SGK. Có thể dùng &lt;b&gt;đậm&lt;/b&gt;, &lt;sub&gt;chỉ số&lt;/sub&gt;, dán link ảnh Google Drive (đã chia sẻ công khai) bằng &lt;img src="link"&gt;.</p>
      <form class="card" id="f">
        <div class="tabs"><button type="button" data-t="M" class="${type === 'M' ? 'on' : ''}">Nhiều lựa chọn</button><button type="button" data-t="T" class="${type === 'T' ? 'on' : ''}">Đúng/Sai</button><button type="button" data-t="L" class="${type === 'L' ? 'on' : ''}">Tự luận</button></div>
        <div class="row"><div style="width:110px"><label for="k">Khối</label><select id="k"><option>10</option><option>11</option><option selected>12</option></select></div>
          <div class="grow"><label for="cd">Chủ đề</label><input id="cd" type="text" list="tpl" required><datalist id="tpl">${tps.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div></div>
        <label for="bai">Bài học</label><input id="bai" type="text" maxlength="160">
        ${type !== 'T' ? `<label for="md">Mức độ</label><select id="md"><option>Biết</option><option ${type === 'L' ? 'selected' : ''}>Hiểu</option><option>Vận dụng</option></select>` : ''}
        <label for="s">Nội dung câu hỏi</label><textarea id="s" required></textarea>
        ${type === 'L' ? `<label for="ans">Đáp án mẫu (các ý cần có – AI dựa vào đây để chấm)</label><textarea id="ans" required style="min-height:120px" placeholder="- Ý 1: …&#10;- Ý 2: …"></textarea>
        <div class="row"><div style="width:140px"><label for="pt">Điểm tối đa</label><input id="pt" type="number" min="0.25" max="10" step="0.25" value="1"></div>
          <div class="grow hint" style="align-self:end">So với câu trắc nghiệm 0,25 điểm và câu Đúng/Sai 1 điểm.</div></div>` : ''}
        ${type === 'L' ? '' : [0, 1, 2, 3].map(i => `<label for="o${i}">${type === 'M' ? 'Phương án ' + LETTERS[i] : 'Ý ' + 'abcd'[i] + ')'}</label><div class="row"><input id="o${i}" type="text" required style="flex:1">
          ${type === 'M' ? `<label class="chk" style="margin:0"><input type="radio" name="ans" value="${LETTERS[i]}" ${i === 0 ? 'checked' : ''}>Đúng</label>` : `<select id="a${i}" style="width:100px"><option value="Đ">Đúng</option><option value="S">Sai</option></select>`}</div>`).join('')}
        <label for="e">${type === 'L' ? 'Hướng dẫn chấm / phân bố điểm (không bắt buộc)' : 'Giải thích' + (type === 'T' ? ' (mỗi ý cách nhau bởi ||)' : '')}</label><textarea id="e" ${type === 'L' ? 'placeholder="Ý 1: 0,5 điểm; Ý 2: 0,5 điểm. Chấp nhận cách diễn đạt khác đúng bản chất."' : ''}></textarea>
        <label for="h">Gợi ý ngắn (hiện trước giải thích)</label><input id="h" type="text">
        ${type === 'M' ? '<label class="chk" style="margin-top:12px"><input type="checkbox" id="nd">Không đảo phương án (có “Cả A và B”…)</label>' : ''}
        <h3>Xem trước</h3><div id="pv" class="preview"></div>
        <div id="msg"></div><div style="margin-top:14px"><button class="btn block">Lưu vào ngân hàng</button></div></form>`);
    $$('[data-t]').forEach(b => b.onclick = () => { type = b.dataset.t; draw(); });
    const collect = () => type === 'L'
      ? { type, khoi: $('#k').value, cd: $('#cd').value, bai: $('#bai').value, md: $('#md').value, stem: $('#s').value, answer: $('#ans').value, expl: $('#e').value, hint: $('#h').value, points: +$('#pt').value || 1 }
      : { type, khoi: $('#k').value, cd: $('#cd').value, bai: $('#bai').value, md: type === 'M' ? $('#md').value : '', stem: $('#s').value,
      o: [0, 1, 2, 3].map(i => $('#o' + i).value), answer: type === 'M' ? ($('input[name=ans]:checked') || {}).value : [0, 1, 2, 3].map(i => $('#a' + i).value).join(','),
      expl: $('#e').value, hint: $('#h').value, noShuffle: type === 'M' && $('#nd').checked };
    const pv = () => { const c = collect(); const q = { id: 'xem', t: type, s: c.stem, o: c.o || [], a: c.answer, md: c.md, p: c.points }; ($('#pv') || {}).innerHTML = qHtml(q, { ids: ['xem'], perm: { xem: [0, 1, 2, 3] }, resp: {} }, 0, type === 'L' ? undefined : { showAns: false }) + (type === 'L' && c.answer ? `<div class="expl ans"><b class="t">Đáp án mẫu</b>${sanitize(c.answer).replace(/\n/g, '<br>')}</div>` : ''); math($('#pv')); };
    $('#f').oninput = pv; pv();
    $('#f').onsubmit = async e => {
      e.preventDefault();
      await busy($('#f .btn'), async () => {
        try { const r = await api('add_question', { question: collect() }); await syncBank(true); toast('Đã thêm câu ' + r.id); draw(); }
        catch (err) { errBox($('#msg'), err); }
      });
    };
  };
  draw();
});

route(/^\/admin$/, async () => {
  if (!session || session.role !== 'admin') { location.hash = '#/'; return; }
  setView('<h1>Quản trị</h1><div id="a"><div class="card empty">Đang tải…</div></div>');
  const load = async () => {
    try {
      const l = await api('list_gv');
      const st = { cho_duyet: '<span class="pill warn">Chờ duyệt</span>', hoat_dong: '<span class="pill ok">Hoạt động</span>', khoa: '<span class="pill bad">Đã khóa</span>' };
      ($('#a') || {}).innerHTML = `<div class="card"><div class="row"><div class="grow"><b>Ngân hàng câu hỏi</b><div class="hint">Phiên bản ${esc(bank.v)} · ${bank.q.length} câu</div></div><button class="btn sm" id="bb">Cập nhật ngân hàng cho HS</button></div></div>
        <div class="card"><div class="row"><div class="grow"><b>Mã chung cho học sinh đăng ký</b><div class="hint" id="mcc">Đổi mã khi cần; tài khoản đã đăng ký không bị ảnh hưởng.</div></div><input id="mcn" type="text" maxlength="20" style="max-width:160px;text-transform:uppercase" placeholder="Mã mới"><button class="btn sm" id="mcs">Lưu mã</button></div></div>
        <h2>Giáo viên (${l.length})</h2><div class="card"><div class="tablewrap"><table><thead><tr><th>Họ tên</th><th>Email</th><th>Trường</th><th>Trạng thái</th><th></th></tr></thead><tbody>
        ${l.map(g => `<tr><td>${esc(g.HoTen)}${g.VaiTro === 'admin' ? ' <span class="pill">Admin</span>' : ''}</td><td>${esc(g.Email)}</td><td>${esc(g.Truong)}</td><td>${st[g.TrangThai] || esc(g.TrangThai)}</td>
          <td>${g.VaiTro === 'admin' ? '' : g.TrangThai === 'hoat_dong' ? `<button class="btn ghost sm" data-g="${g.MaGV}" data-a="0">Khóa</button>` : `<button class="btn sm" data-g="${g.MaGV}" data-a="1">Duyệt</button>`}</td></tr>`).join('')}</tbody></table></div></div>`;
      $$('[data-g]').forEach(b => b.onclick = async () => { try { await api('approve_gv', { maGV: b.dataset.g, approve: b.dataset.a === '1' }); load(); } catch (e) { toast(e.message); } });
      api('get_common').then(r => { $('#mcn').value = r.ma; $('#mcc').textContent = 'Mã hiện tại: ' + r.ma + ' · Đổi mã khi cần; tài khoản đã đăng ký không bị ảnh hưởng.'; }).catch(() => {});
      $('#mcs').onclick = async () => { try { const r = await api('set_common', { ma: $('#mcn').value }); window._maChung = r.ma; $('#mcc').textContent = 'Mã hiện tại: ' + r.ma; toast('Đã lưu mã chung: ' + r.ma); } catch (e) { toast(e.message); } };
      $('#bb').onclick = async () => { try { await api('bump_bank'); await syncBank(true); toast('Đã cập nhật: ' + bank.q.length + ' câu'); load(); } catch (e) { toast(e.message); } };
    } catch (e) { errBox($('#a'), e); }
  };
  load();
});

/* ================= BÀI VẼ – AI CHẤM QUA ẢNH CHỤP ================= */
const DRAW_TYPES = { hinhchieu: 'Bản vẽ hình chiếu vuông góc', trucdo: 'Hình chiếu trục đo', hinhcat: 'Hình cắt, mặt cắt', banve: 'Bản vẽ kĩ thuật (chi tiết, lắp, xây dựng)', machdien: 'Sơ đồ mạch điện (nguyên lí, lắp đặt)', machdientu: 'Sơ đồ mạch điện tử', thietke: 'Bản phác thảo thiết kế kĩ thuật (dự án STEM)' };
const DRAW_SAMPLE = {
  hinhchieu: 'Vẽ đúng vị trí 3 hình chiếu (đứng, bằng, cạnh) – 3 điểm\nĐúng hình dạng từng hình chiếu – 3 điểm\nĐúng loại nét: nét liền đậm, nét đứt cạnh khuất, nét gạch chấm đường tâm – 2 điểm\nGhi kích thước đúng quy ước – 1 điểm\nBản vẽ sạch, rõ, có khung tên – 1 điểm',
  trucdo: 'Đặt đúng hệ trục đo (hình chiếu trục đo vuông góc đều: 3 trục lệch nhau 120°; xiên góc cân: trục O′x′ ⊥ O′z′, trục O′y′ lệch 135°) – 2 điểm\nĐúng hệ số biến dạng (vuông góc đều p = q = r = 1; xiên góc cân p = r = 1, q = 0,5) – 2 điểm\nĐúng hình dạng vật thể, các cạnh song song với trục được vẽ song song với trục đo tương ứng – 3 điểm\nLỗ tròn, cung tròn trên mặt phẳng vẽ thành elip đúng hướng – 1 điểm\nNét vẽ đúng quy ước (nét liền đậm cạnh thấy; xoá nét dựng hình), bản vẽ sạch, rõ – 2 điểm',
  hinhcat: 'Chọn đúng vị trí mặt phẳng cắt, có kí hiệu vết mặt phẳng cắt, hướng chiếu và tên (A–A) – 2 điểm\nĐúng loại hình cắt/mặt cắt theo đề (toàn bộ, một nửa, cục bộ; mặt cắt chập hoặc rời) – 2 điểm\nĐúng hình dạng phần vật thể sau mặt phẳng cắt, không vẽ thừa/thiếu cạnh – 3 điểm\nĐường gạch gạch: nét liền mảnh, nghiêng 45°, cách đều, chỉ vẽ ở phần đặc bị cắt – 2 điểm\nNét vẽ đúng quy ước, bản vẽ sạch, rõ – 1 điểm',
  banve: 'Đủ hình biểu diễn cần thiết – 3 điểm\nHình cắt, mặt cắt đúng quy ước – 3 điểm\nGhi kích thước đầy đủ, đúng quy ước – 2 điểm\nKhung tên, yêu cầu kĩ thuật – 2 điểm',
  machdien: 'Đủ phần tử (nguồn, aptomat/cầu chì, công tắc, ổ cắm, đèn…) – 3 điểm\nKí hiệu đúng tiêu chuẩn – 2 điểm\nNối dây đúng nguyên lí (công tắc trên dây pha, phần tử mắc đúng) – 4 điểm\nSơ đồ rõ ràng, có chú thích – 1 điểm',
  machdientu: 'Đủ linh kiện theo yêu cầu (ví dụ: biến áp, 4 diode cầu, tụ lọc, tải) – 3 điểm\nKí hiệu linh kiện đúng, đúng cực tính – 3 điểm\nNối mạch đúng nguyên lí – 3 điểm\nGhi trị số linh kiện – 1 điểm',
  thietke: 'Giải pháp đáp ứng đúng vấn đề và yêu cầu – 3 điểm\nBản phác thảo rõ ràng, có hình chiếu hoặc sơ đồ – 3 điểm\nGhi kích thước, vật liệu, chú thích bộ phận – 2 điểm\nTính khả thi và an toàn – 2 điểm'
};
async function compressImage(file, max = 1600, q = 0.82) {
  let src;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) { src = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = URL.createObjectURL(file); }); }
  const w = src.width, h = src.height, k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q);
}
function aiHtml(sub, max) {
  const ai = sub.AI;
  if (!ai) return `<div class="expl">${esc(sub.AINhanXet || 'Chưa có nhận xét AI. Thầy/cô sẽ chấm trực tiếp.')}</div>`;
  if (ai.doc_duoc === false) return `<div class="err"><b>AI chưa đọc được ảnh.</b> ${esc(ai.nhan_xet_chung || '')}${(ai.goi_y_sua || []).length ? '<br>' + ai.goi_y_sua.map(esc).join('<br>') : ''}</div>`;
  const li = a => (a || []).filter(Boolean);
  return `<div class="expl ans"><b class="t">🤖 AI đề xuất: ${fmt(ai.diem)} / ${max} điểm</b>${esc(ai.nhan_xet_chung || '')}</div>
    ${li(ai.diem_dung).length ? `<h3>✔ Em làm đúng</h3><ul>${li(ai.diem_dung).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${li(ai.loi).length ? `<h3>✘ Cần sửa</h3><ul>${li(ai.loi).map(x => `<li>${esc(x.mo_ta || x)}${x.tieu_chi ? ` <span class="hint">(${esc(x.tieu_chi)})</span>` : ''}${x.tru_diem ? ` <b style="color:var(--bad)">−${fmt(x.tru_diem)}</b>` : ''}</li>`).join('')}</ul>` : ''}
    ${li(ai.goi_y_sua).length ? `<h3>💡 Gợi ý</h3><ul>${li(ai.goi_y_sua).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`;
}
function subStatus(s, max) {
  if (s.TrangThai === 'da_cham') return `<span class="pill ok">Điểm chính thức: ${fmt(s.GVDiem)}/${max}</span>`;
  if (s.AIDiem != null) return `<span class="pill warn">AI đề xuất ${fmt(s.AIDiem)}/${max} · chờ thầy cô xác nhận</span>`;
  return '<span class="pill warn">Chờ thầy cô chấm</span>';
}
route(/^\/baive\/(\w+)$/, async (params, maBV) => {
  if (!session || session.role !== 'hs') { location.hash = '#/'; return; }
  setView('<div class="card empty">Đang tải…</div>');
  let list;
  try { list = await api('my_drawing_tasks'); store.set('drw_' + uid(), list); } catch (e) { list = store.get('drw_' + uid(), []); }
  const t = (list || []).find(x => x.MaBV === maBV);
  if (!t) { errBox(V, 'Không tìm thấy bài vẽ'); return; }
  let img = null;
  const late = t.HanNop && new Date(t.HanNop) < new Date();
  const out = t.SoLan && t.bai.length >= t.SoLan;
  const draw = () => {
    const isTK = t.Loai === 'thietke';
    setView(`<a href="#/">← Trang chủ</a><h1>${isTK ? '💡 ' : '✏️ '}${esc(t.TieuDe)}</h1><p class="sub">${esc(isTK ? 'Bài thiết kế kĩ thuật' : t.LoaiTen)} · thang ${t.DiemToiDa} điểm${t.SoLan ? ' · nộp tối đa ' + t.SoLan + ' lần' : ''}${t.HanNop ? ' · hạn ' + dt(t.HanNop) : ''}</p>
      <div class="card"><h3>${isTK ? 'Bài toán thiết kế' : 'Đề bài'}</h3><div style="white-space:pre-wrap">${esc(t.DeBai)}</div>
        ${isTK && window.STC_SGK && STC_SGK.books['10'] ? `<a class="sgklink" href="${sgkHref('10', STC_SGK.books['10'].bai[17].pdf)}">📘 Ôn lại Quy trình thiết kế kĩ thuật – SGK Công nghệ 10, Bài 18</a>` : ''}<h3>Tiêu chí chấm</h3><div style="white-space:pre-wrap" class="hint">${esc(t.TieuChi)}</div></div>
      ${late || out ? `<div class="card empty">${late ? 'Đã hết hạn nộp.' : 'Em đã dùng hết số lần nộp.'}</div>` : `<div class="card"><h3>Nộp bài vẽ</h3>
        <p class="hint">Vẽ trên giấy trắng bằng bút chì đậm hoặc bút mực. Chụp thẳng từ trên xuống, đủ sáng, không bóng tay, thấy trọn bản vẽ.</p>
        <label class="btn ghost block" style="margin:8px 0">📷 Chụp / chọn ảnh ${isTK ? 'bản phác thảo' : 'bài vẽ'}<input id="file" type="file" accept="image/*" capture="environment" hidden></label>
        ${img ? `<img src="${img}" alt="Ảnh bài vẽ" style="width:100%;border-radius:10px;border:1px solid var(--line)">` : ''}
        <div id="msg"></div><button class="btn block" id="send" ${img ? '' : 'disabled'} style="margin-top:10px">Nộp bài cho AI nhận xét</button></div>`}
      <h2>Các lần nộp</h2><div id="subs">${t.bai.length ? t.bai.map(s => `<div class="card"><div class="row"><b class="grow">${dt(s.ThoiDiem)}</b>${subStatus(s, t.DiemToiDa)}</div>
        ${aiHtml(s, t.DiemToiDa)}${s.GVNhanXet ? `<div class="expl"><b class="t">👩‍🏫 Thầy/cô nhận xét</b>${esc(s.GVNhanXet)}</div>` : ''}
        <button class="btn ghost sm" data-img="${s.MaNop}">Xem ảnh đã nộp</button><div id="im_${s.MaNop}"></div></div>`).join('') : '<div class="card empty">Chưa nộp lần nào.</div>'}</div>
      <p class="hint">Điểm AI chỉ là đề xuất. Điểm chính thức do thầy cô xác nhận.</p>`);
    if ($('#file')) $('#file').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { img = await compressImage(f); draw(); } catch (err) { toast('Không đọc được ảnh, hãy chụp lại'); } };
    if ($('#send')) $('#send').onclick = async () => {
      if (!navigator.onLine) { errBox($('#msg'), 'Cần có mạng để nộp ảnh và nhận xét AI'); return; }
      const b = $('#send'); b.disabled = true; b.textContent = '🤖 AI đang xem bài vẽ (khoảng 10–30 giây)…';
      try { const s = await api('submit_drawing', { maBV, image: img }); t.bai.unshift(s); img = null; draw(); toast('Đã nộp bài'); window.scrollTo(0, $('#subs').offsetTop - 80); }
      catch (err) { b.disabled = false; b.textContent = 'Nộp bài cho AI nhận xét'; errBox($('#msg'), err); }
    };
    $$('[data-img]').forEach(b => b.onclick = async () => {
      const box = $('#im_' + b.dataset.img); box.innerHTML = '<div class="hint">Đang tải ảnh…</div>';
      try { const r = await api('get_drawing_image', { maNop: b.dataset.img }); box.innerHTML = `<img src="data:${r.mime};base64,${r.data}" alt="" style="width:100%;margin-top:8px;border-radius:10px">`; }
      catch (e) { errBox(box, e); }
    });
  };
  draw();
});

route(/^\/gv\/baive$/, async () => {
  if (!needGV()) return;
  setView(`<div class="row"><h1 class="grow">📷 Bài vẽ – AI chấm</h1><a class="btn sm" href="#/gv/baive/moi">+ Tạo bài vẽ</a></div>
    <p class="sub">HS vẽ tay hình chiếu, bản vẽ hoặc sơ đồ mạch, chụp ảnh nộp. AI nhận xét theo tiêu chí của thầy cô và quy ước TCVN; thầy cô xem lại và xác nhận điểm.</p><div id="l"><div class="card empty">Đang tải…</div></div>`);
  try {
    const l = await api('list_drawing_tasks');
    ($('#l') || {}).innerHTML = l.length ? '<div class="list">' + l.map(t => `<a class="item" href="#/gv/baive/${t.MaBV}"><div class="grow"><b>${esc(t.TieuDe)}</b>
      <div class="meta">${esc(t.LoaiTen)} · khối ${esc(t.Khoi)} · ${t.soBai} bài nộp · ${esc(t.TenGV)}</div></div>${t.choCham ? `<span class="pill warn">${t.choCham} chờ xác nhận</span>` : ''}›</a>`).join('') + '</div>'
      : '<div class="card empty">Chưa có bài vẽ nào.</div>';
  } catch (e) { errBox($('#l'), e); }
});

route(/^\/gv\/baive\/moi$/, async params => {
  if (!needGV()) return;
  setView('<div class="card empty">Đang tải…</div>');
  let cls; try { cls = await api('school_classes'); } catch (e) { errBox(V, e); return; }
  const reqK = params ? (params.get('k') || '') : '';
  const defLoai = (params && params.get('loai')) || (reqK === '12' ? 'mach' : (reqK === '11' ? 'khac' : 'hinhchieu'));
  let loai = defLoai, anh = null;
  const keep = {};
  const pre = store.get('prefill_draw', null);
  if (pre) { store.del('prefill_draw'); loai = pre.loai || loai; keep.t = pre.t; keep.db = pre.db; keep.tc = pre.tc; }
  const draw = () => {
    setView(`<a href="#/gv/baive">← Bài vẽ</a><h1>Tạo bài vẽ</h1><form class="card" id="f">
      <label for="t">Tiêu đề</label><input id="t" type="text" required maxlength="120" value="${esc(keep.t || '')}" placeholder="Vẽ 3 hình chiếu vuông góc của gối đỡ">
      <label>Giao cho lớp</label>
      ${['10', '11', '12'].map(k => { const l = cls.filter(c => c.Khoi === k); return l.length ? `<div class="row" style="margin:6px 0"><b style="width:66px">Khối ${k}</b><div class="checks">${l.map(c => `<label class="chk"><input type="checkbox" name="cl" value="${c.MaLop}" data-k="${k}" ${(keep.cl || []).includes(c.MaLop) || k === reqK ? 'checked' : ''}>${esc(c.TenLop)}</label>`).join('')}</div></div>` : ''; }).join('')}
      <label for="lo">Loại bài vẽ</label><select id="lo">${Object.entries(DRAW_TYPES).map(([k, v]) => `<option value="${k}" ${k === loai ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <label for="db">Đề bài</label><textarea id="db" required placeholder="Cho vật thể như hình trong SGK trang… Em hãy vẽ 3 hình chiếu vuông góc theo tỉ lệ 1:1 và ghi kích thước.">${esc(keep.db || '')}</textarea>
      <label for="tc">Tiêu chí chấm (mỗi dòng một tiêu chí – số điểm)</label><textarea id="tc" required style="min-height:130px">${esc(keep.tc || DRAW_SAMPLE[loai])}</textarea>
      <div class="hint">Tiêu chí càng cụ thể, AI chấm càng sát. Mẫu tự đổi theo loại bài vẽ.</div>
      <div class="row"><div class="grow"><label for="mx">Thang điểm</label><input id="mx" type="number" min="1" max="10" value="${keep.mx || 10}"></div>
        <div class="grow"><label for="at">Số lần nộp (0 = không giới hạn)</label><input id="at" type="number" min="0" max="10" value="${keep.at == null ? 3 : keep.at}"></div></div>
      <label for="dl">Hạn nộp</label><input id="dl" type="datetime-local" value="${keep.dl || ''}">
      <label>Ảnh đáp án mẫu (không bắt buộc – giúp AI so sánh chính xác hơn; HS không xem được)</label>
      <label class="btn ghost block">🖼️ Chọn ảnh đáp án mẫu<input id="am" type="file" accept="image/*" hidden></label>
      ${anh ? `<img src="${anh}" alt="" style="width:100%;margin-top:8px;border-radius:10px">` : ''}
      <div id="msg"></div><div style="margin-top:14px"><button class="btn block" id="go">Giao bài vẽ</button></div></form>`);
    const save = () => { keep.t = $('#t').value; keep.db = $('#db').value; keep.tc = $('#tc').value; keep.mx = $('#mx').value; keep.at = $('#at').value; keep.dl = $('#dl').value; keep.cl = $$('input[name=cl]:checked').map(i => i.value); };
    $('#lo').onchange = e => { save(); if (keep.tc === DRAW_SAMPLE[loai]) keep.tc = ''; loai = e.target.value; if (!keep.tc) keep.tc = DRAW_SAMPLE[loai]; draw(); };
    $('#am').onchange = async e => { save(); const f = e.target.files[0]; if (f) { anh = await compressImage(f); draw(); } };
    $('#f').onsubmit = async e => {
      e.preventDefault();
      const classes = $$('input[name=cl]:checked').map(i => i.value);
      if (new Set($$('input[name=cl]:checked').map(i => i.dataset.k)).size > 1) { errBox($('#msg'), 'Mỗi bài chỉ giao cho các lớp cùng một khối'); return; }
      await busy($('#go'), async () => {
        try {
          const t = await api('create_drawing_task', { task: { title: $('#t').value, classes, loai, deBai: $('#db').value, tieuChi: $('#tc').value,
            diemToiDa: +$('#mx').value, attempts: +$('#at').value, deadline: $('#dl').value ? new Date($('#dl').value).toISOString() : '', anhMau: anh } });
          toast('Đã giao bài vẽ'); location.hash = '#/gv/baive/' + t.MaBV;
        } catch (err) {
          const msg = (tab === 'hs' && (err.message || '').includes('Sai tên đăng nhập hoặc mật khẩu'))
            ? 'Sai tên đăng nhập hoặc mật khẩu. Lưu ý: Tên đăng nhập là tài khoản cá nhân của em (không phải mã lớp). Nếu em chưa có tài khoản, hãy bấm “Đăng ký tài khoản mới” bên dưới.'
            : err;
          errBox($('#msg'), msg);
        }
      });
    };
  };
  draw();
});

route(/^\/gv\/baive\/(V\w+)$/, async (params, maBV) => {
  if (!needGV()) return;
  setView('<div class="card empty">Đang tải…</div>');
  let d; try { d = await api('drawing_submissions', { maBV }); } catch (e) { errBox(V, e); return; }
  d.items.sort((a, b) => String(a.TenLop).localeCompare(String(b.TenLop), 'vi', { numeric: true }) || viNameCmp(a.HoTen, b.HoTen));
  const t = d.task, max = t.DiemToiDa;
  let open = null;
  const draw = () => {
    const pending = d.items.filter(s => s.TrangThai !== 'da_cham').length;
    setView(`<a href="#/gv/baive">← Bài vẽ</a><h1>${esc(t.TieuDe)}</h1><p class="sub">${esc(t.LoaiTen)} · khối ${esc(t.Khoi)} · lớp ${esc(t.DanhSachLop.join(', '))} · ${d.items.length} bài nộp, ${pending} chờ xác nhận</p>
      <div class="card"><h3>Đề bài</h3><div style="white-space:pre-wrap">${esc(t.DeBai)}</div><h3>Tiêu chí</h3><div style="white-space:pre-wrap" class="hint">${esc(t.TieuChi)}</div>
        <div class="row" style="margin-top:10px">${t.CoAnhMau ? '<button class="btn ghost sm" id="mau">Xem đáp án mẫu</button>' : ''}<button class="btn sm" id="ex">⬇ Xuất điểm</button><button class="btn danger sm" id="del">Xóa bài</button></div><div id="mauimg"></div></div>
      <div class="list">${d.items.map(s => `<div class="card" style="margin:0"><div class="row"><div class="grow"><b>${esc(s.HoTen)}</b> <span class="hint">${esc(s.TenLop)} · ${dt(s.ThoiDiem)}</span></div>${subStatus(s, max)}
        <button class="btn ghost sm" data-o="${s.MaNop}">${open === s.MaNop ? 'Đóng' : 'Xem & chấm'}</button></div>
        ${open === s.MaNop ? `<div id="img_${s.MaNop}" class="hint" style="margin-top:8px">Đang tải ảnh…</div>${aiHtml(s, max)}
          <div class="row"><div style="width:130px"><label for="gd">Điểm xác nhận</label><input id="gd" type="number" step="0.25" min="0" max="${max}" value="${s.GVDiem != null ? s.GVDiem : (s.AIDiem != null ? s.AIDiem : '')}"></div>
          <div class="grow"><label for="gn">Nhận xét thêm của thầy/cô</label><input id="gn" type="text" value="${esc(s.GVNhanXet || '')}"></div></div>
          <div class="row" style="margin-top:10px"><button class="btn" id="ok">✔ Xác nhận điểm</button></div>` : ''}</div>`).join('') || '<div class="card empty">Chưa có HS nộp bài.</div>'}</div>`);
    $$('[data-o]').forEach(b => b.onclick = () => { open = open === b.dataset.o ? null : b.dataset.o; draw(); });
    if (open) {
      api('get_drawing_image', { maNop: open }).then(r => { const el = $('#img_' + open); if (el) el.innerHTML = `<img src="data:${r.mime};base64,${r.data}" alt="Bài vẽ" style="width:100%;border-radius:10px;border:1px solid var(--line)">`; })
        .catch(e => { const el = $('#img_' + open); if (el) errBox(el, e); });
      $('#ok').onclick = async () => {
        const s = d.items.find(x => x.MaNop === open);
        try { const r = await api('grade_drawing', { maNop: open, diem: $('#gd').value, nhanXet: $('#gn').value });
          s.GVDiem = r.diem; s.GVNhanXet = $('#gn').value; s.TrangThai = 'da_cham';
          const next = d.items.find(x => x.TrangThai !== 'da_cham'); open = next ? next.MaNop : null; toast('Đã xác nhận điểm'); draw(); }
        catch (e) { toast(e.message); }
      };
    }
    if ($('#mau')) $('#mau').onclick = async () => { try { const r = await api('get_drawing_image', { maBV }); ($('#mauimg') || {}).innerHTML = `<img src="data:${r.mime};base64,${r.data}" alt="" style="width:100%;margin-top:8px;border-radius:10px">`; } catch (e) { toast(e.message); } };
    $('#ex').onclick = () => csv('BaiVe_' + t.TieuDe.replace(/[^\wÀ-ỹ]+/g, '_') + '.csv', [['Họ tên', 'Lớp', 'Nộp lúc', 'Điểm AI đề xuất', 'Điểm chính thức', 'Thang điểm', 'Nhận xét GV'],
      ...d.items.map(s => [s.HoTen, s.TenLop, dt(s.ThoiDiem), s.AIDiem == null ? '' : s.AIDiem, s.GVDiem == null ? '' : s.GVDiem, max, s.GVNhanXet || ''])]);
    $('#del').onclick = async () => { if (!confirm('Xóa bài vẽ này? Ảnh HS đã nộp vẫn giữ trong Drive.')) return; try { await api('delete_drawing_task', { maBV }); location.hash = '#/gv/baive'; } catch (e) { toast(e.message); } };
  };
  draw();
});


/* ================= MA TRẬN & SINH ĐỀ KIỂM TRA ================= */
const ASG_TYPES = ['Kiểm tra thường xuyên', 'Kiểm tra 15 phút', 'Bài tập về nhà', 'Ôn luyện', 'Kiểm tra giữa kì', 'Kiểm tra cuối kì'];
const EXAM_TYPES = ['Giữa kì I', 'Cuối kì I', 'Giữa kì II', 'Cuối kì II', 'Kiểm tra thường xuyên', 'Thi thử'];
function loadScript(src) { return new Promise((ok, no) => { if ([...document.scripts].some(s => s.src === src)) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
async function qrSvg(text, cell = 3) {
  try { if (!window.qrcode) await loadScript('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js'); const q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: cell, margin: 1 }); }
  catch (e) { return ''; }
}
const chamLink = (maDT, ma) => location.origin + location.pathname + '#/cham/' + maDT + '/' + ma;
/** câu của một dòng ma trận (giống máy chủ): đúng bài trước, thiếu thì bù từ chủ đề cấp chương (fb) */
function rowPool(k, row) {
  const inK = bank.q.filter(q => q.k === String(k));
  const n = row.type === 'bai' ? (/^Bài\s*(\d+)/.exec(row.value) || [])[1] : null;
  const re = n ? new RegExp('^Bài\\s*' + n + '\\.') : null;
  const lesson = inK.filter(q => row.type === 'bai' ? (q.bai === row.value || (re && re.test(q.bai))) : q.cd === row.value);
  const fbs = row.fb || [];
  const fb = fbs.length ? inK.filter(q => !lesson.includes(q) && (fbs.includes(q.bai) || fbs.includes(String(q.cd).replace(/^Lớp \d+ – /, '')))) : [];
  return { lesson, fb, all: lesson.concat(fb) };
}
function poolCount(k, row) {
  const p = rowPool(k, row).all;
  return { b: p.filter(q => q.t === 'M' && q.md === 'Biết').length, h: p.filter(q => q.t === 'M' && q.md === 'Hiểu').length, v: p.filter(q => q.t === 'M' && q.md === 'Vận dụng').length, ds: p.filter(q => q.t === 'T').length,
    tb: p.filter(q => q.t === 'L').length, th: p.filter(q => q.t === 'L').length, tv: p.filter(q => q.t === 'L').length, tl: p.filter(q => q.t === 'L').length };
}
/** bốc một đề từ ma trận ngay trên máy (HS luyện đề định kì) */
function buildFromMatrix(m) {
  const used = new Set(), mc = [], tf = [], tl = [], miss = [];
  const take = (pool, test, n) => {
    const out = [];
    for (const arr of [pool.lesson, pool.fb]) { if (out.length >= n) break; out.push(...shuffle(arr.filter(q => test(q) && !used.has(q.id))).slice(0, n - out.length)); }
    out.forEach(q => used.add(q.id)); return out;
  };
  m.rows.forEach(r => {
    const pool = rowPool(m.khoi, r), short = (what, n, got) => { if (got < n) miss.push(`${r.value.replace(/^(Bài \d+)\..*/, '$1')} – ${what}: thiếu ${n - got}`); };
    [['b', 'Biết'], ['h', 'Hiểu'], ['v', 'Vận dụng']].forEach(([k, md]) => { const n = +r[k] || 0; if (!n) return; const x = take(pool, q => q.t === 'M' && q.md === md, n); short('TN ' + md, n, x.length); mc.push(...x); });
    if (+r.ds) { const x = take(pool, q => q.t === 'T', +r.ds); short('Đúng/Sai', +r.ds, x.length); tf.push(...x); }
    [['tb', 'Biết'], ['th', 'Hiểu'], ['tv', 'Vận dụng']].forEach(([k, md]) => {
      const n = +r[k] || 0; if (!n) return;
      let x = take(pool, q => q.t === 'L' && q.md === md, n); if (x.length < n) x = x.concat(take(pool, q => q.t === 'L', n - x.length));
      short('Tự luận', n, x.length); tl.push(...x);
    });
  });
  return { ids: [...mc, ...tf, ...tl].map(q => q.id), miss, nTL: tl.length };
}
const mxTotals = rows => rows.reduce((a, r) => { ['b', 'h', 'v', 'ds', 'tb', 'th', 'tv'].forEach(k => a[k] += +r[k] || 0); return a; }, { b: 0, h: 0, v: 0, ds: 0, tb: 0, th: 0, tv: 0 });

route(/^\/gv\/matran$/, async params => {
  if (!needGV()) return;
  const filterK = params ? (params.get('k') || '') : '';
  setView(`<div class="row"><h1 class="grow">📑 Ma trận & đề kiểm tra ${filterK ? 'Khối ' + filterK : ''}</h1><a class="btn sm" href="#/gv/matran/sua${filterK ? '?k=' + filterK : ''}">+ Ma trận mới</a></div>
    <p class="sub">Nhập ma trận theo văn bản của Sở một lần, sau đó mỗi lần bấm “Sinh đề” app tạo bộ đề mới gồm nhiều mã đề, có đáp án và mã QR chấm nhanh.</p>
    <h2>Ma trận của trường</h2><div id="mt"><div class="card empty">Đang tải…</div></div>
    ${(window.STC_MATRAN || []).length ? `<h2>📌 Ma trận mẫu theo CV 7991/BGDĐT</h2><p class="hint">12 câu TN nhiều lựa chọn (3 điểm) – 4 câu Đúng/Sai (4 điểm) – tự luận (3 điểm). Bấm “Dùng mẫu” để lưu thành ma trận của trường rồi sinh đề; có thể chỉnh trước khi lưu.</p>
      <div class="list">${STC_MATRAN.filter(t => !filterK || t.khoi === filterK).map(t => { const s = mxTotals(t.rows); return `<div class="item"><div class="grow"><b>${esc(t.ten)}</b><div class="meta">${t.rows.length} bài · ${s.b + s.h + s.v} TN + ${s.ds} Đ/S + ${s.tb + s.th + s.tv} tự luận · ${t.thoiGian} phút</div></div><a class="btn sm" href="#/gv/matran/sua?mau=${t.id}">Dùng mẫu</a></div>`; }).join('')}</div>` : ''}
    <h2>Đề đã sinh</h2><div id="dt"><div class="card empty">Đang tải…</div></div>`);
  try {
    const [ms, ds] = await Promise.all([api('list_matrices'), api('list_exams')]);
    ($('#mt') || {}).innerHTML = ms.length ? '<div class="list">' + ms.map(m => {
      const s = mxTotals(m.rows), ntl = s.tb + s.th + s.tv;
      return `<div class="item"><div class="grow"><b>${esc(m.TenMT)}</b><div class="meta">Lớp ${esc(m.Khoi)} · ${esc(m.Loai)} · ${m.ThoiGian} phút · ${s.b + s.h + s.v} câu nhiều lựa chọn + ${s.ds} câu Đúng/Sai${ntl ? ' + ' + ntl + ' câu tự luận' : ''} · ${esc(m.TenGV)}</div></div>
        <a class="btn ghost sm" href="#/gv/matran/sua?id=${m.MaMT}">Sửa</a><a class="btn sm" href="#/gv/sinhde?mt=${m.MaMT}">Sinh đề</a></div>`;
    }).join('') + '</div>' : '<div class="card empty">Chưa có ma trận. Bấm “+ Ma trận mới”.</div>';
    store.set('matrices', ms);
    ($('#dt') || {}).innerHTML = ds.length ? '<div class="list">' + ds.map(d => `<a class="item" href="#/gv/dethi/${d.MaDT}"><div class="grow"><b>${esc(d.TieuDe)}</b><div class="meta">Lớp ${esc(d.Khoi)} · ${d.SoMaDe} mã đề · ${esc(d.TenGV)} · ${dt(d.NgayTao)}</div></div>›</a>`).join('') + '</div>' : '<div class="card empty">Chưa sinh đề nào.</div>';
  } catch (e) { errBox($('#mt'), e); }
});

route(/^\/gv\/matran\/sua$/, async params => {
  if (!needGV()) return;
  let m = { ten: '', khoi: (params && params.get('k')) || '12', loai: 'Cuối kì I', thoiGian: 45, rows: [] };
  const id = params.get('id');
  if (id) { const ms = store.get('matrices', []); const f = ms.find(x => x.MaMT === id); if (f) m = { id, ten: f.TenMT, khoi: f.Khoi, loai: f.Loai, thoiGian: f.ThoiGian, rows: f.rows }; }
  const mau = params.get('mau') && (window.STC_MATRAN || []).find(t => t.id === params.get('mau'));
  if (mau) m = { ten: mau.ten, khoi: mau.khoi, loai: EXAM_TYPES.includes(mau.loai) ? mau.loai : m.loai, thoiGian: mau.thoiGian, rows: JSON.parse(JSON.stringify(mau.rows)) };
  if (!m.rows.length) m.rows = [{ type: 'bai', value: '', b: 0, h: 0, v: 0, ds: 0 }];
  const draw = () => {
    const opts = [...lessonsOf(m.khoi).map(x => ['bai', x]), ...topicsOf(m.khoi).map(x => ['cd', x])];
    m.rows.forEach(r => { if (r.value && r.type === 'bai' && !opts.some(([t, v]) => t === 'bai' && v === r.value)) opts.unshift(['bai', r.value]); });
    const tot = mxTotals(m.rows);
    const mc = tot.b + tot.h + tot.v, ntl = tot.tb + tot.th + tot.tv, raw = mc * 0.25 + tot.ds;
    setView(`<a href="#/gv/matran">← Ma trận & đề</a><h1>${id ? 'Sửa' : 'Tạo'} ma trận</h1>
      <div class="card"><label for="tn">Tên ma trận</label><input id="tn" type="text" value="${esc(m.ten)}" placeholder="Ma trận cuối kì I – Công nghệ 12 (theo CV … của Sở)">
        <div class="row"><div style="width:110px"><label for="kh">Khối</label><select id="kh">${['10', '11', '12'].map(k => `<option ${k === m.khoi ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
        <div class="grow"><label for="lo">Loại</label><select id="lo">${EXAM_TYPES.map(x => `<option ${x === m.loai ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div style="width:120px"><label for="tg">Thời gian (phút)</label><input id="tg" type="number" min="5" max="120" value="${m.thoiGian}"></div></div></div>
      ${(window.STC_MATRAN || []).some(t => t.khoi === m.khoi) ? `<div class="card row"><label for="mau" class="grow" style="margin:0">Nạp ma trận mẫu CV 7991</label><select id="mau" style="max-width:320px"><option value="">— chọn —</option>${STC_MATRAN.filter(t => t.khoi === m.khoi).map(t => `<option value="${t.id}">${esc(t.ten)}</option>`).join('')}</select></div>` : ''}
      <div class="card"><div class="tablewrap"><table><thead><tr><th>Bài học / chủ đề</th><th class="n">TN Biết</th><th class="n">TN Hiểu</th><th class="n">TN V.dụng</th><th class="n">Đ/S</th><th class="n">TL Hiểu</th><th class="n">TL V.dụng</th><th></th></tr></thead><tbody>
        ${m.rows.map((r, i) => { const c = r.value ? poolCount(m.khoi, r) : null; const warn = k => c && (+r[k] || 0) > c[k] ? ' style="border-color:var(--bad)"' : '';
          return `<tr><td style="min-width:220px"><select data-r="${i}" data-f="value"><option value="">— chọn —</option>${opts.map(([t, v]) => `<option value="${t}|${esc(v)}" ${r.type === t && r.value === v ? 'selected' : ''}>${t === 'cd' ? '[Chủ đề] ' : ''}${esc(v)}</option>`).join('')}</select>
            ${c ? `<div class="hint">Có sẵn: ${c.b} biết · ${c.h} hiểu · ${c.v} vận dụng · ${c.ds} Đ/S · ${c.tl} tự luận${(r.fb || []).length ? ' (gồm câu bù cấp chương)' : ''}</div>` : ''}</td>
            ${['b', 'h', 'v', 'ds', 'th', 'tv'].map(k => `<td class="n"><input data-r="${i}" data-f="${k}" type="number" min="0" value="${+r[k] || 0}" style="width:64px"${warn(k)}></td>`).join('')}
            <td><button class="btn ghost sm" data-del="${i}" title="Xóa dòng">✕</button></td></tr>`; }).join('')}
        <tr><td><b>Tổng</b></td>${['b', 'h', 'v', 'ds', 'th', 'tv'].map(k => `<td class="n"><b>${tot[k]}</b></td>`).join('')}<td></td></tr></tbody></table></div>
        <button class="btn ghost sm" id="add" style="margin-top:8px">+ Thêm dòng</button>
        <p class="hint">${mc} câu nhiều lựa chọn (0,25 điểm/câu) + ${tot.ds} câu Đúng/Sai (1 điểm/câu) = ${fmt(raw)} điểm${ntl ? ` + ${ntl} câu tự luận (${fmt(Math.max(0, 10 - raw))} điểm, GV chấm tay trên giấy)` : ', quy về thang 10'}. Tỉ lệ: Biết ${mc ? Math.round(tot.b / mc * 100) : 0}% · Hiểu ${mc ? Math.round(tot.h / mc * 100) : 0}% · Vận dụng ${mc ? Math.round(tot.v / mc * 100) : 0}%. Ô viền đỏ = ngân hàng chưa đủ câu.</p></div>
      <div id="msg"></div><div class="row"><button class="btn" id="sv">Lưu ma trận</button>${id ? '<button class="btn danger" id="dl">Xóa</button>' : ''}</div>`);
    const sync = () => { m.ten = $('#tn').value; m.loai = $('#lo').value; m.thoiGian = +$('#tg').value; };
    $('#kh').onchange = e => { sync(); m.khoi = e.target.value; m.rows = [{ type: 'bai', value: '', b: 0, h: 0, v: 0, ds: 0 }]; draw(); };
    if ($('#mau')) $('#mau').onchange = e => { const t = STC_MATRAN.find(x => x.id === e.target.value); if (!t) return; m = Object.assign(m, { ten: t.ten, loai: EXAM_TYPES.includes(t.loai) ? t.loai : m.loai, thoiGian: t.thoiGian, rows: JSON.parse(JSON.stringify(t.rows)) }); draw(); toast('Đã nạp ' + t.ten); };
    $$('[data-r]').forEach(el => el.onchange = () => { sync(); const r = m.rows[+el.dataset.r]; if (el.dataset.f === 'value') { const [t, ...v] = el.value.split('|'); r.type = t || 'bai'; r.value = v.join('|'); r.fb = []; } else r[el.dataset.f] = +el.value || 0; draw(); });
    $$('[data-del]').forEach(b => b.onclick = () => { sync(); m.rows.splice(+b.dataset.del, 1); if (!m.rows.length) m.rows.push({ type: 'bai', value: '', b: 0, h: 0, v: 0, ds: 0 }); draw(); });
    $('#add').onclick = () => { sync(); m.rows.push({ type: 'bai', value: '', b: 0, h: 0, v: 0, ds: 0 }); draw(); };
    $('#sv').onclick = async () => { sync(); await busy($('#sv'), async () => { try { await api('save_matrix', { matrix: m }); toast('Đã lưu ma trận'); location.hash = '#/gv/matran'; } catch (e) { errBox($('#msg'), e); } }); };
    if ($('#dl')) $('#dl').onclick = async () => { if (!confirm('Xóa ma trận này?')) return; try { await api('delete_matrix', { maMT: id }); location.hash = '#/gv/matran'; } catch (e) { toast(e.message); } };
  };
  draw();
});

route(/^\/gv\/sinhde$/, params => {
  if (!needGV()) return;
  const ms = store.get('matrices', []); const mt = params.get('mt');
  const m = ms.find(x => x.MaMT === mt);
  if (!m) { location.hash = '#/gv/matran'; return; }
  setView(`<a href="#/gv/matran">← Ma trận & đề</a><h1>Sinh đề từ ma trận</h1><p class="sub">${esc(m.TenMT)} · lớp ${esc(m.Khoi)} · ${m.ThoiGian} phút</p>
    <div class="card"><label for="td">Tiêu đề in trên đề</label><input id="td" type="text" value="KIỂM TRA ${esc(m.Loai.toUpperCase())} – NĂM HỌC 2026–2027">
      <div class="row"><div class="grow"><label for="sm">Số mã đề</label><input id="sm" type="number" min="1" max="12" value="4"></div><div class="grow"><label for="mb">Mã đề bắt đầu</label><input id="mb" type="number" value="101"></div></div>
      <label>Cách tạo các mã đề</label><div class="checks"><label class="chk"><input type="radio" name="cd" value="khac_cau" checked>Mỗi mã đề một bộ câu khác nhau</label><label class="chk"><input type="radio" name="cd" value="dao_cau">Cùng bộ câu, chỉ đảo câu và phương án</label></div>
      <p class="hint">Mỗi lần bấm “Sinh đề” là một bộ đề mới. Dùng “Cùng bộ câu” khi cần các mã đề tương đương tuyệt đối về độ khó.</p>
      <div id="msg"></div><button class="btn block" id="go" style="margin-top:12px">Sinh đề</button></div>`);
  $('#go').onclick = () => busy($('#go'), async () => {
    try { const d = await api('generate_exam', { maMT: mt, tieuDe: $('#td').value, soMaDe: +$('#sm').value, maBatDau: +$('#mb').value, cheDo: $('input[name=cd]:checked').value });
      store.set('exam_' + d.MaDT, d); if (d.thieu.length) alert('Ngân hàng chưa đủ câu cho:\n' + d.thieu.join('\n') + '\nApp đã lấy lặp câu ở các mã đề để đủ số lượng.'); location.hash = '#/gv/dethi/' + d.MaDT; }
    catch (e) { errBox($('#msg'), e); }
  });
});

function examQ(q, v, n) {
  if (q.t === 'L') return `<div class="q"><b>Câu ${n}.</b> <i>(${fmt(q.p || 1)} điểm)</i> ${sanitize(q.s)}</div>`;
  if (q.t === 'M') {
    const p = v.perm[q.id] || [0, 1, 2, 3];
    return `<div class="q"><b>Câu ${n}.</b> ${sanitize(q.s)}<div class="ops">${p.map((oi, j) => `<div><b>${LETTERS[j]}.</b> ${sanitize(q.o[oi])}</div>`).join('')}</div></div>`;
  }
  return `<div class="q"><b>Câu ${n}.</b> ${sanitize(q.s)}<div>${[0, 1, 2, 3].map(k => `<div><b>${'abcd'[k]})</b> ${sanitize(q.o[k])}</div>`).join('')}</div></div>`;
}
function printedKey(q, v) {
  if (q.t === 'M') { const p = v.perm[q.id] || [0, 1, 2, 3]; return LETTERS[p.indexOf(LETTERS.indexOf(normAns(q)))]; }
  return normAns(q).split('').join('');
}
async function printExam(d, which, withKey, o = {}) {
  const w = window.open('', '_blank');
  if (!w) { toast('Trình duyệt chặn cửa sổ in, hãy cho phép cửa sổ bật lên'); return; }
  const base = location.origin + location.pathname.replace(/[^/]*$/, '');
  const vs = which === 'all' ? d.versions : d.versions.filter(v => v.ma === which);
  const parts = [];
  for (const v of vs) {
    const mc = v.ids.filter(id => bank.byId[id] && bank.byId[id].t === 'M'), tf = v.ids.filter(id => bank.byId[id] && bank.byId[id].t === 'T'), tl = v.ids.filter(id => bank.byId[id] && bank.byId[id].t === 'L');
    const qr = o.noQr ? '' : await qrSvg(o.link || chamLink(d.MaDT, v.ma), 2);
    parts.push(`<section class="page"><table class="hd"><tr><td><b>SỞ GD&amp;ĐT THÀNH PHỐ HUẾ</b><br><b>${esc((d.Truong || '').toUpperCase())}</b><br><i>(Đề có ${v.ids.length} câu)</i></td>
      <td style="text-align:center"><b>${esc(d.TieuDe)}</b><br><b>MÔN: CÔNG NGHỆ ${esc(d.Khoi)}</b><br><i>Thời gian: ${d.ThoiGian} phút</i></td>
      <td style="text-align:right">${qr}${v.ma ? `<br><b>Mã đề: ${v.ma}</b>` : ''}</td></tr></table>
      <p>Họ và tên: ……………………………………… Lớp: ………… Số báo danh: …………</p>
      ${mc.length ? `<p class="sec"><b>PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.</b> Thí sinh trả lời từ câu 1 đến câu ${mc.length}. Mỗi câu chỉ chọn một phương án.</p>${mc.map((id, i) => examQ(bank.byId[id], v, i + 1)).join('')}` : ''}
      ${tf.length ? `<p class="sec"><b>PHẦN II. Câu trắc nghiệm đúng sai.</b> Thí sinh trả lời từ câu 1 đến câu ${tf.length}. Trong mỗi ý a), b), c), d) ở mỗi câu, chọn đúng hoặc sai.</p>${tf.map((id, i) => examQ(bank.byId[id], v, i + 1)).join('')}` : ''}
      ${tl.length ? `<p class="sec"><b>PHẦN III. Tự luận</b> (${fmt(Math.max(0, 10 - mc.length * 0.25 - tf.length))} điểm).</p>${tl.map((id, i) => examQ(bank.byId[id], v, i + 1)).join('')}` : ''}
      <p style="text-align:center">----- HẾT -----</p>${o.noQr ? '' : `<p class="hint">${o.note || 'Quét mã QR để nhập đáp án và chấm điểm ngay trên SmarttechCN 2026.'}</p>`}</section>`);
  }
  if (withKey) {
    parts.push(`<section class="page"><h2 style="text-align:center">ĐÁP ÁN – ${esc(d.TieuDe)}</h2>${vs.map(v => {
      const mc = v.ids.filter(id => bank.byId[id].t === 'M'), tf = v.ids.filter(id => bank.byId[id].t === 'T'), tl = v.ids.filter(id => bank.byId[id].t === 'L');
      return `${v.ma ? `<h3>Mã đề ${v.ma}</h3>` : ''}${tl.length ? `<div class="essaykey"><b>Phần III – Tự luận (đáp án mẫu)</b>${tl.map((id, i) => `<p><b>Câu ${i + 1}.</b> ${sanitize(bank.byId[id].a)}${bank.byId[id].e ? `<br><i>Hướng dẫn chấm: ${sanitize(bank.byId[id].e)}</i>` : ''}</p>`).join('')}</div>` : ''}<table class="key"><tr>${mc.map((id, i) => `<td><b>${i + 1}</b><br>${printedKey(bank.byId[id], v)}</td>`).join('')}</tr></table>
        ${tf.length ? `<table class="key"><tr>${tf.map((id, i) => `<td><b>Câu ${i + 1}</b><br>${printedKey(bank.byId[id], v).split('').map((x, k) => 'abcd'[k] + ')' + x).join(' ')}</td>`).join('')}</tr></table>` : ''}`;
    }).join('')}</section>`);
  }
  w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><base href="${base}"><title>${esc(d.TieuDe)}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
    <style>body{font-family:"Times New Roman",serif;font-size:13pt;line-height:1.35;margin:0;color:#000;background:#fff}.page{padding:12mm 15mm;page-break-after:always}
    .hd{width:100%;border-collapse:collapse;margin-bottom:6px}.hd td{vertical-align:top;font-size:12pt}.q{margin:6px 0;page-break-inside:avoid}.ops{display:grid;grid-template-columns:1fr 1fr;gap:2px 16px}
    img.pic{display:block;max-width:80%;max-height:70mm;margin:4px auto}img.f{vertical-align:middle}.sec{margin-top:10px}.hint{font-size:10pt;color:#444}
    table.key{border-collapse:collapse;margin:4px 0 10px}.essaykey{margin:4px 0 12px;font-size:12pt}.essaykey p{margin:4px 0}table.key td{border:1px solid #000;padding:3px 6px;text-align:center;font-size:11pt}
    .bar{position:sticky;top:0;background:#0f4c45;color:#fff;padding:8px 14px;font-family:sans-serif}.bar button{font-size:14px;padding:6px 14px}
    @media print{.bar{display:none}.page{padding:0}@page{size:A4;margin:15mm}}</style></head>
    <body><div class="bar"><button onclick="print()">🖨️ In / Lưu PDF</button> &nbsp;Mẹo: chọn “Lưu dưới dạng PDF”, khổ A4.</div>${parts.join('').replace(/ loading="lazy"/g, '')}
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"><\/script><script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"><\/script>
    <script>window.onload=function(){try{renderMathInElement(document.body,{delimiters:[{left:'\\\\(',right:'\\\\)',display:false},{left:'\\\\[',right:'\\\\]',display:true}],throwOnError:false,strict:false})}catch(e){}}<\/script></body></html>`);
  w.document.close();
}

route(/^\/gv\/dethi\/(D\w+)$/, async (params, maDT) => {
  if (!needGV()) return;
  let d = store.get('exam_' + maDT, null);
  if (!d) { setView('<div class="card empty">Đang tải…</div>'); try { d = await api('get_exam', { maDT }); store.set('exam_' + maDT, d); } catch (e) { errBox(V, e); return; } }
  if (d.versions.some(v => v.ids.some(id => !bank.byId[id]))) await syncBank(true);
  const qrs = {};
  for (const v of d.versions) qrs[v.ma] = await qrSvg(chamLink(maDT, v.ma), 3);
  setView(`<a href="#/gv/matran">← Ma trận & đề</a><h1>${esc(d.TieuDe)}</h1><p class="sub">Lớp ${esc(d.Khoi)} · ${d.ThoiGian} phút · ${d.versions.length} mã đề · ${d.versions[0].ids.length} câu/đề</p>
    ${d.thieu && d.thieu.length ? `<div class="err">Ngân hàng chưa đủ câu: ${esc(d.thieu.join('; '))}</div>` : ''}
    <div class="card"><div class="row"><button class="btn" id="pa">🖨️ In tất cả mã đề</button><button class="btn ghost" id="pk">In kèm đáp án</button><button class="btn ghost" id="ex">⬇ Đáp án Excel (nhập TNMaker)</button></div>
      <p class="hint">Mỗi đề in kèm mã QR: HS quét, đăng nhập rồi chọn đáp án đã tô trên giấy để biết điểm ngay. Kết quả được lưu vào bảng điểm.</p></div>
    <div class="grid">${d.versions.map(v => `<div class="card"><div class="row"><div class="grow"><b class="code" style="font-size:18px">Mã ${v.ma}</b><div class="hint">${v.ids.length} câu</div></div><div style="width:110px">${qrs[v.ma]}</div></div>
      <div class="row" style="margin-top:8px"><button class="btn ghost sm" data-p="${v.ma}">In mã này</button><button class="btn ghost sm" data-c="${v.ma}">Sao chép link chấm</button></div></div>`).join('')}</div>
    <h2>Xem trước mã ${d.versions[0].ma}</h2><div class="card" id="pv">${(() => { const v = d.versions[0]; let n1 = 0, n2 = 0; let n3 = 0; return v.ids.filter(id => bank.byId[id]).map(id => { const q = bank.byId[id]; return examQ(q, v, q.t === 'M' ? ++n1 : q.t === 'T' ? ++n2 : ++n3); }).join('<hr style="border:0;border-top:1px solid var(--line)">'); })()}</div>`);
  $('#pa').onclick = () => printExam(d, 'all', false);
  $('#pk').onclick = () => printExam(d, 'all', true);
  $$('[data-p]').forEach(b => b.onclick = () => printExam(d, b.dataset.p, false));
  $$('[data-c]').forEach(b => b.onclick = async () => { const l = chamLink(maDT, b.dataset.c); try { await navigator.clipboard.writeText(l); toast('Đã sao chép'); } catch (e) { prompt('Link chấm nhanh:', l); } });
  $('#ex').onclick = () => {
    const rows = [];
    d.versions.forEach(v => { const mc = v.ids.filter(id => bank.byId[id].t === 'M'), tf = v.ids.filter(id => bank.byId[id].t === 'T');
      rows.push(['Mã đề ' + v.ma, ...mc.map(id => printedKey(bank.byId[id], v)), ...tf.flatMap(id => printedKey(bank.byId[id], v).split(''))]); });
    const v0 = d.versions[0], nmc = v0.ids.filter(id => bank.byId[id].t === 'M').length, ntf = v0.ids.filter(id => bank.byId[id].t === 'T').length;
    csv('DapAn_' + maDT + '.csv', [['Mã đề', ...Array.from({ length: nmc }, (_, i) => 'Câu ' + (i + 1)), ...Array.from({ length: ntf }, (_, i) => 'abcd'.split('').map(x => 'II.' + (i + 1) + x)).flat()], ...rows]);
  };
});

/* HS quét QR: nhập đáp án đã làm trên giấy để chấm ngay */
route(/^\/cham\/(D\w+)\/(\d+)$/, async (params, maDT, ma) => {
  if (!session || session.role !== 'hs') { setView('<div class="card empty">Hãy đăng nhập bằng tài khoản học sinh để chấm bài.</div>'); return; }
  setView('<div class="card empty">Đang tải đề…</div>');
  let d; try { d = await api('get_exam', { maDT, ma }); } catch (e) { errBox(V, e); return; }
  const v = d.versions[0];
  if (v.ids.some(id => !bank.byId[id])) await syncBank(true);
  const mc = v.ids.filter(id => bank.byId[id] && bank.byId[id].t === 'M'), tf = v.ids.filter(id => bank.byId[id] && bank.byId[id].t === 'T');
  const ans = {};
  const draw = () => {
    setView(`<h1>Chấm nhanh – mã đề ${esc(ma)}</h1><p class="sub">${esc(d.TieuDe)}. Chọn đúng các đáp án em đã tô trên giấy.</p>
      <div class="card"><h3>Phần I</h3>${mc.map((id, i) => `<div class="row" style="margin:4px 0"><b style="width:64px">Câu ${i + 1}</b><div class="tfb" style="flex:1">${LETTERS.split('').map(L => `<button data-q="${id}" data-v="${L}" class="${ans[id] === L ? 'on d' : ''}">${L}</button>`).join('')}</div></div>`).join('')}
      ${tf.length ? '<h3>Phần II</h3>' + tf.map((id, i) => `<div style="margin:6px 0"><b>Câu ${i + 1}</b>${[0, 1, 2, 3].map(k => `<div class="row" style="margin:3px 0"><span style="width:30px">${'abcd'[k]})</span><div class="tfb" style="flex:1"><button data-q="${id}" data-k="${k}" data-v="Đ" class="d ${(ans[id] || [])[k] === 'Đ' ? 'on' : ''}">Đúng</button><button data-q="${id}" data-k="${k}" data-v="S" class="s ${(ans[id] || [])[k] === 'S' ? 'on' : ''}">Sai</button></div></div>`).join('')}</div>`).join('') : ''}
      <div id="msg"></div><button class="btn block accent" id="go" style="margin-top:12px">Chấm điểm</button></div>`);
    $$('[data-q]').forEach(b => b.onclick = () => { const id = b.dataset.q; if (b.dataset.k != null) { const r = ans[id] || [null, null, null, null]; r[+b.dataset.k] = b.dataset.v; ans[id] = r; } else ans[id] = b.dataset.v; draw(); });
    $('#go').onclick = () => {
      const left = mc.filter(id => !ans[id]).length + tf.filter(id => (ans[id] || []).filter(Boolean).length < 4).length;
      if (left && !confirm('Còn ' + left + ' câu chưa chọn. Vẫn chấm?')) return;
      // đổi chữ cái in trên đề về đáp án gốc
      const resp = {};
      mc.forEach(id => { const p = v.perm[id] || [0, 1, 2, 3]; resp[id] = ans[id] ? LETTERS[p[LETTERS.indexOf(ans[id])]] : ''; });
      tf.forEach(id => { resp[id] = ans[id] || [null, null, null, null]; });
      const ids = [...mc, ...tf], g = grade(ids, resp);
      const answers = {}; ids.forEach(id => { answers[id] = respStr(bank.byId[id], resp[id]); });
      const last = { attemptId: newId(), title: d.TieuDe + ' – mã ' + ma, key: 'DT:' + maDT, loai: 'dethi', ids, perm: v.perm, resp, hints: true,
        diem: g.diem, dung: g.dung, tong: g.tong, sai: g.sai, detail: g.detail, seconds: 0, synced: false };
      store.set('last', last);
      const q = store.get('queue', []); q.push({ attemptId: last.attemptId, key: last.key, loai: 'dethi', title: last.title, seconds: 0, answers }); store.set('queue', q); flush();
      location.hash = '#/ketquabai';
    };
  };
  draw();
});

/* ================= HÌNH CHIẾU 3D (lớp 10) =================
 * Vật thể ghép từ các khối lập phương. App tự tính 3 hình chiếu theo phương pháp chiếu góc thứ nhất (TCVN):
 * hình chiếu đứng (nhìn từ trước), hình chiếu bằng (từ trên, đặt dưới HCĐ), hình chiếu cạnh (từ trái, đặt bên phải HCĐ).
 * Nét thấy: nét liền đậm; cạnh khuất: nét đứt. */
const SHAPES = [
  // mỗi vật thể: các lớp từ dưới lên; mỗi lớp là các hàng nhìn từ trên, hàng đầu = phía SAU, hàng cuối = phía TRƯỚC
  { ten: 'Khối chữ L', L: [['###', '###'], ['###', '...']] },
  { ten: 'Khối bậc thang', L: [['###', '###'], ['##.', '##.'], ['#..', '#..']] },
  { ten: 'Khối có rãnh chữ U', L: [['###', '###'], ['#.#', '#.#']] },
  { ten: 'Khối chữ T ngược', L: [['###', '###'], ['.#.', '.#.'], ['.#.', '.#.']] },
  { ten: 'Khối có rãnh phía sau', L: [['###', '###', '###'], ['#.#', '###', '###']] },
  { ten: 'Khối có lỗ vuông xuyên suốt', L: [['###', '###'], ['#.#', '#.#'], ['###', '###']] },
  { ten: 'Giá đỡ chữ L có gân', L: [['###', '###', '###'], ['###', '.#.', '...'], ['###', '...', '...']] },
  { ten: 'Khối có rãnh vuông phía trước', L: [['###', '###', '###'], ['###', '###', '#.#']] },
  { ten: 'Khối bậc hai phía', L: [['####', '####'], ['.##.', '.##.']] },
  { ten: 'Khối có lỗ khuất phía trong', L: [['###', '###', '###'], ['###', '#.#', '###'], ['###', '###', '###']] },
  { ten: 'Gối đỡ chữ U', L: [['####', '####'], ['#..#', '#..#'], ['#..#', '#..#']] },
  { ten: 'Khối vát bậc phía trước', L: [['###', '###', '###'], ['###', '###', '...'], ['###', '...', '...']] }
];
function shapeVox(L) {
  const Z = L.length, Y = L[0].length, X = L[0][0].length, v = [];
  for (let z = 0; z < Z; z++) for (let r = 0; r < Y; r++) for (let x = 0; x < X; x++) if (L[z][r][x] === '#') v.push([x, Y - 1 - r, z]);
  return { X, Y, Z, v, set: new Set(v.map(p => p.join(','))) };
}
function randomShape() {
  for (let t = 0; t < 50; t++) {
    const X = 3 + rnd(2), Y = 2 + rnd(2), Z = 3, L = [];
    const h = Array.from({ length: Y }, () => Array.from({ length: X }, () => 1 + rnd(3)));
    if (rnd(2)) { const x = rnd(X); for (let y = 0; y < Y; y++) h[y][x] = Math.max(1, h[y][x] - 1 - rnd(2)); }
    for (let z = 0; z < Z; z++) L.push(Array.from({ length: Y }, (_, r) => Array.from({ length: X }, (_, x) => h[r][x] > z ? '#' : '.').join('')));
    if (rnd(3) === 0) { const zz = rnd(Z - 1) + 1, xx = 1 + rnd(X - 2); L[zz] = L[zz].map(row => row.slice(0, xx) + (row[xx] === '#' && L.slice(zz + 1).some(l => l.some(rw => rw[xx] === '#')) ? '.' : row[xx]) + row.slice(xx + 1)); }
    const s = shapeVox(L);
    if (s.v.length >= 5) return { ten: 'Vật thể ngẫu nhiên', L };
  }
  return SHAPES[0];
}
/* ---- tính hình chiếu: trả về danh sách đoạn {x1,y1,x2,y2,an} trên lưới ---- */
function projView(s, view) {
  const map = p => view === 'front' ? [p[0], p[2], p[1]] : view === 'top' ? [p[0], p[1], s.Z - 1 - p[2]] : view === 'side' ? [s.Y - 1 - p[1], p[2], p[0]]
    : view === 'back' ? [s.X - 1 - p[0], p[2], s.Y - 1 - p[1]] : [p[1], p[2], s.X - 1 - p[0]];
  const W = view === 'side' || view === 'right' ? s.Y : s.X, H = view === 'top' ? s.Y : s.Z;
  const col = {};
  s.v.forEach(p => { const [u, w, d] = map(p); (col[u + ',' + w] = col[u + ',' + w] || []).push(d); });
  const info = (u, w) => { const c = col[u + ',' + w]; return c ? { f: Math.min(...c), k: c.slice().sort().join('.') } : null; };
  const seg = {};
  const add = (key, an) => { if (seg[key] === undefined || (seg[key] && !an)) seg[key] = an; };
  for (let u = -1; u < W; u++) for (let w = -1; w < H; w++) {
    const a = info(u, w);
    [[1, 0], [0, 1]].forEach(([du, dw]) => {
      const b = info(u + du, w + dw);
      if (!a && !b) return;
      let an;
      if (!a || !b || a.f !== b.f) an = false; else if (a.k !== b.k) an = true; else return;
      const key = du ? `${u + 1},${w},${u + 1},${w + 1}` : `${u},${w + 1},${u + 1},${w + 1}`;
      add(key, an);
    });
  }
  // gộp các đoạn thẳng hàng cùng loại
  const out = [];
  const keys = Object.keys(seg).map(k => { const [x1, y1, x2, y2] = k.split(',').map(Number); return { x1, y1, x2, y2, an: seg[k] }; });
  const vert = keys.filter(s => s.x1 === s.x2).sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1), hor = keys.filter(s => s.y1 === s.y2).sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);
  [vert, hor].forEach((arr, isH) => arr.forEach(sg => {
    const last = out[out.length - 1];
    if (last && last.an === sg.an && (isH ? last.y1 === sg.y1 && last.y2 === sg.y2 && last.x2 === sg.x1 : last.x1 === sg.x1 && last.x2 === sg.x2 && last.y2 === sg.y1)) { last.x2 = sg.x2; last.y2 = sg.y2; }
    else out.push(Object.assign({}, sg));
  }));
  return { W, H, segs: out };
}
const viewKey = p => p.segs.map(s => [s.x1, s.y1, s.x2, s.y2, s.an ? 1 : 0].join(',')).sort().join('|') + '#' + p.W + 'x' + p.H;
function viewSvg(p, size = 150) {
  const c = Math.min((size - 20) / Math.max(p.W, p.H, 1), 34), w = p.W * c + 20, h = p.H * c + 20;
  const Y = y => 10 + (p.H - y) * c, X = x => 10 + x * c;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Hình chiếu" style="max-width:100%;height:auto;background:#fff;border-radius:8px">
    ${p.segs.map(s => `<line x1="${X(s.x1)}" y1="${Y(s.y1)}" x2="${X(s.x2)}" y2="${Y(s.y2)}" stroke="#111" stroke-width="${s.an ? 1.6 : 2.6}" ${s.an ? 'stroke-dasharray="6 4"' : ''} stroke-linecap="round"/>`).join('')}</svg>`;
}
const mirrorView = p => ({ W: p.W, H: p.H, segs: p.segs.map(s => ({ x1: p.W - s.x2, y1: s.y1, x2: p.W - s.x1, y2: s.y2, an: s.an })) });
const flipHidden = (p, mode) => ({ W: p.W, H: p.H, segs: mode === 'drop' ? p.segs.filter(s => !s.an) : p.segs.map(s => Object.assign({}, s, { an: false })) });
const VIEW_NAME = { front: 'hình chiếu đứng', top: 'hình chiếu bằng', side: 'hình chiếu cạnh' };
function make3DQuestion(sh) {
  const s = shapeVox(sh.L);
  const ask = ['front', 'top', 'side'][rnd(3)];
  const V = { front: projView(s, 'front'), top: projView(s, 'top'), side: projView(s, 'side'), back: projView(s, 'back'), right: projView(s, 'right') };
  const correct = V[ask];
  const pool = [...['front', 'top', 'side'].filter(k => k !== ask).map(k => ({ p: V[k], why: 'Đây là ' + VIEW_NAME[k] + '.' })),
    { p: flipHidden(correct, 'drop'), why: 'Thiếu nét đứt thể hiện cạnh khuất.' }, { p: flipHidden(correct, 'solid'), why: 'Cạnh khuất phải vẽ bằng nét đứt, không phải nét liền.' },
    { p: mirrorView(correct), why: 'Hình bị lật ngược trái – phải.' }, { p: ask === 'side' ? V.right : V.back, why: ask === 'side' ? 'Đây là hình nhìn từ phải, không phải từ trái.' : 'Đây là hình nhìn từ phía sau.' }];
  const seen = new Set([viewKey(correct)]), opts = [{ p: correct, ok: true }];
  for (const c of shuffle(pool)) { const k = viewKey(c.p); if (!seen.has(k) && c.p.segs.length) { seen.add(k); opts.push(c); } if (opts.length === 4) break; }
  return { sh, s, ask, opts: shuffle(opts) };
}
/* ---- bộ vẽ 3D bằng Canvas ---- */
function Viewer3D(canvas, s) {
  const ctx = canvas.getContext('2d');
  const st = { yaw: -0.65, pitch: 0.55, zoom: 1, target: null };
  const cx = s.X / 2, cy = s.Y / 2, cz = s.Z / 2;
  const faces = [];
  let PF = null;
  const has = (x, y, z) => s.set.has(x + ',' + y + ',' + z);
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  s.v.forEach(([x, y, z]) => DIRS.forEach(n => {
    if (has(x + n[0], y + n[1], z + n[2])) return;
    const ax = n.map(Math.abs), i = ax.indexOf(1), [a, b] = [0, 1, 2].filter(k => k !== i);
    const o = [x, y, z]; o[i] += n[i] > 0 ? 1 : 0;
    const corner = (da, db) => { const p = o.slice(); p[a] += da; p[b] += db; return p; };
    const pts = [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)];
    // cạnh nào là cạnh đặc trưng (không có mặt đồng phẳng liền kề)
    const nb = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([da, db]) => { const q = [x, y, z]; q[a] += da; q[b] += db; const q2 = q.slice(); q2[0] += n[0]; q2[1] += n[1]; q2[2] += n[2]; return has(...q) && !has(...q2); });
    faces.push({ pts, n, edge: [!nb[0], !nb[1], !nb[2], !nb[3]] });
  }));
  const rot = p => {
    let [x, y, z] = [p[0] - cx, p[1] - cy, p[2] - cz];
    const cyw = Math.cos(st.yaw), syw = Math.sin(st.yaw); [x, y] = [x * cyw - y * syw, x * syw + y * cyw];
    const cp = Math.cos(st.pitch), sp = Math.sin(st.pitch); [y, z] = [y * cp - z * sp, y * sp + z * cp];
    return [x, y, z];
  };
  const draw = () => {
    const W = canvas.width, H = canvas.height, R = Math.hypot(s.X, s.Y, s.Z);
    const k = Math.min(W, H) / (R * 1.35) * st.zoom;
    ctx.clearRect(0, 0, W, H);
    const P = p => { const r = rot(p); return [W / 2 + r[0] * k, H / 2 - r[2] * k, r[1]]; };
    // vẽ bằng bộ vẽ chung: các khối liền nhau không có đường ghép, cạnh thấy nét liền đậm
    if (!PF) PF = HC.G.prep(faces.map(f => ({ pts: f.pts.map(p => p.slice()), holes: [], n: f.n.slice() })));
    const dp0 = window.devicePixelRatio || 1, V = [Math.sin(st.yaw) * Math.cos(st.pitch), Math.cos(st.yaw) * Math.cos(st.pitch), -Math.sin(st.pitch)];
    hcPaint(ctx, W | 0, H | 0, PF, P, V, dp0, { k });
    // mũi tên hướng chiếu từ trước
    const a1 = P([cx, -1.6, cz]), a2 = P([cx, -0.35, cz]);
    ctx.strokeStyle = '#e89a2c'; ctx.fillStyle = '#c97c12'; ctx.lineWidth = 3 * (window.devicePixelRatio || 1);
    ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.stroke();
    const ang = Math.atan2(a2[1] - a1[1], a2[0] - a1[0]);
    ctx.beginPath(); ctx.moveTo(a2[0], a2[1]); ctx.lineTo(a2[0] - 12 * Math.cos(ang - 0.45), a2[1] - 12 * Math.sin(ang - 0.45)); ctx.lineTo(a2[0] - 12 * Math.cos(ang + 0.45), a2[1] - 12 * Math.sin(ang + 0.45)); ctx.fill();
    const dp = window.devicePixelRatio || 1; ctx.font = `600 ${Math.round(14 * dp)}px system-ui,sans-serif`; const lbl = 'Hướng chiếu từ trước', tw = ctx.measureText(lbl).width; const tx = Math.max(6 * dp, Math.min(W - tw - 6 * dp, a1[0] - tw / 2)), ty = Math.max(20 * dp, Math.min(H - 8 * dp, a1[1] + 18 * dp)); ctx.fillText(lbl, tx, ty);
  };
  const fit = () => { const r = canvas.getBoundingClientRect(), d = window.devicePixelRatio || 1; canvas.width = Math.max(200, r.width * d); canvas.height = Math.max(200, r.height * d); draw(); };
  let drag = null; const pts = new Map();
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); drag = { x: e.clientX, y: e.clientY, d: null }; st.target = null; });
  canvas.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [p, q] = [...pts.values()]; const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (drag.d) st.zoom = Math.max(0.5, Math.min(3, st.zoom * d / drag.d)); drag.d = d; draw(); return; }
    st.yaw += (e.clientX - drag.x) * 0.01; st.pitch = Math.max(-1.55, Math.min(1.55, st.pitch + (e.clientY - drag.y) * 0.01)); drag.x = e.clientX; drag.y = e.clientY; draw();
  });
  const up = e => { pts.delete(e.pointerId); if (!pts.size) drag = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); st.zoom = Math.max(0.5, Math.min(3, st.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); draw(); }, { passive: false });
  const anim = (yaw, pitch) => {
    const y0 = st.yaw, p0 = st.pitch, t0 = performance.now();
    let dy = yaw - y0; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const step = t => { const k = Math.min(1, (t - t0) / 600), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; st.yaw = y0 + dy * e; st.pitch = p0 + (pitch - p0) * e; draw(); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  window.addEventListener('resize', fit);
  setTimeout(fit, 0);
  return { draw, fit, front: () => anim(0, 0), top: () => anim(0, 1.5707), side: () => anim(Math.PI / 2, 0), iso: () => anim(-0.65, 0.55), destroy: () => window.removeEventListener('resize', fit) };
}

route(/^\/hinhchieu$/, () => {
  let qs = [], i = 0, score = 0, picked = null, viewer = null;
  const start = n => { qs = shuffle([...SHAPES, ...Array.from({ length: 6 }, randomShape)]).slice(0, n).map(make3DQuestion); i = 0; score = 0; picked = null; draw(); };
  const intro = () => {
    setView(`<h1>🧊 Hình chiếu vuông góc – xoay vật thể 3D</h1>
      <p class="sub">Dùng chuột hoặc ngón tay xoay vật thể 360°, lăn chuột hoặc chụm hai ngón để phóng to. Quan sát các góc khuất rồi chọn hình chiếu đúng. Hình chiếu theo phương pháp chiếu góc thứ nhất: hình chiếu đứng nhìn từ trước, hình chiếu bằng nhìn từ trên, hình chiếu cạnh nhìn từ trái.</p>
      <div class="grid">${[5, 10, 15].map(n => `<button class="tile" data-n="${n}"><span class="ic">🎯</span><b>${n} câu</b><span>${n === 5 ? 'Khởi động nhanh' : n === 10 ? 'Luyện tập' : 'Thử thách'}</span></button>`).join('')}</div>`);
    $$('[data-n]').forEach(b => b.onclick = () => start(+b.dataset.n));
  };
  const draw = () => {
    if (viewer) viewer.destroy();
    if (i >= qs.length) {
      const hk = 'hist_' + uid(), hist = store.get(hk, []); hist.push({ t: Date.now(), title: 'Hình chiếu 3D', key: '', loai: '3d', diem: Math.round(score / qs.length * 1000) / 100, dung: score, tong: qs.length, giay: 0 }); store.set(hk, hist.slice(-300));
      setView(`<div class="hero"><h1>Hoàn thành! 🎉</h1><p class="sub">Em đúng ${score}/${qs.length} câu.</p></div><div class="row"><button class="btn" id="again">Chơi lại (vật thể mới)</button><a class="btn ghost" href="#/">Trang chủ</a></div>`);
      $('#again').onclick = () => start(qs.length); return;
    }
    const q = qs[i];
    setView(`<div class="qbar"><div class="title">🧊 Câu ${i + 1}/${qs.length} · ${esc(q.sh.ten)}</div><span class="timer">✔ ${score}</span></div>
      <div class="qcard"><div class="stem">Quan sát vật thể. <b>${VIEW_NAME[q.ask].replace(/^./, c => c.toUpperCase())}</b> của vật thể là hình nào?</div>
        <canvas id="cv" style="width:100%;height:min(60vh,380px);touch-action:none;background:linear-gradient(#f4f7f7,#e6eeee);border-radius:12px;margin-top:10px;cursor:grab"></canvas>
        <div class="row" style="margin-top:8px"><button class="btn ghost sm" data-v="iso">Trục đo</button><button class="btn ghost sm" data-v="front">Nhìn từ trước</button><button class="btn ghost sm" data-v="top">Từ trên</button><button class="btn ghost sm" data-v="side">Từ trái</button></div>
        <div class="grid" style="grid-template-columns:repeat(2,1fr);margin-top:12px">${q.opts.map((o, k) => `<button class="opt ${picked != null ? (o.ok ? 'right' : (picked === k ? 'wrong' : '')) : ''}" data-k="${k}" style="flex-direction:column;align-items:center" ${picked != null ? 'disabled' : ''}><span class="L">${LETTERS[k]}</span>${viewSvg(o.p)}</button>`).join('')}</div>
        ${picked != null ? `<div class="expl ${q.opts[picked].ok ? 'ans' : ''}"><b class="t">${q.opts[picked].ok ? '✔ Chính xác!' : '✘ Chưa đúng.'}</b>${q.opts[picked].ok ? 'Bấm nút hướng nhìn tương ứng để đối chiếu.' : esc(q.opts[picked].why) + ' Đáp án đúng là ' + LETTERS[q.opts.findIndex(o => o.ok)] + '.'} Nét đứt thể hiện cạnh bị che khuất.</div>
          <button class="btn block" id="nx" style="margin-top:10px">${i < qs.length - 1 ? 'Câu tiếp →' : 'Xem kết quả'}</button>` : ''}</div>`);
    viewer = Viewer3D($('#cv'), q.s);
    if (picked != null) setTimeout(() => viewer[q.ask](), 300);
    $$('[data-v]').forEach(b => b.onclick = () => viewer[b.dataset.v]());
    $$('[data-k]').forEach(b => b.onclick = () => { picked = +b.dataset.k; if (q.opts[picked].ok) score++; draw(); });
    if ($('#nx')) $('#nx').onclick = () => { i++; picked = null; draw(); };
  };
  cleanup = () => { if (viewer) viewer.destroy(); };
  intro();
});

/* ================= TRÒ CHƠI: PHƯƠNG PHÁP CHIẾU GÓC THỨ NHẤT & GÓC THỨ BA (CN10 – Bài 9) =================
 * Theo SGK Công nghệ 10: hình chiếu cạnh là hình nhìn từ trái ở cả hai phương pháp.
 * Góc thứ nhất: HCB đặt DƯỚI HCĐ, HCC đặt bên PHẢI HCĐ. Góc thứ ba: HCB đặt TRÊN HCĐ, HCC đặt bên TRÁI HCĐ. */
const GC = {
  1: { ten: 'phương pháp chiếu góc thứ nhất', top: 'below', side: 'right' },
  3: { ten: 'phương pháp chiếu góc thứ ba', top: 'above', side: 'left' }
};
const GC_COL = { front: '#e53935', top: '#1e63d6', side: '#c026d3' };
const GC_SHAPES = SHAPES.concat([
  { ten: 'Khối ba bậc', L: [['###', '###'], ['.##', '.##'], ['..#', '..#']] },
  { ten: 'Khối chữ U ngửa', L: [['###', '###'], ['#.#', '#.#'], ['#.#', '#.#']] },
  { ten: 'Khối hộp có rãnh trên', L: [['####', '####', '####'], ['#..#', '#..#', '#..#']] },
  { ten: 'Khối chữ L có tấm đứng', L: [['###', '###', '###'], ['#..', '#..', '#..'], ['#..', '#..', '#..']] },
  { ten: 'Khối chữ T đứng', L: [['.#.', '.#.'], ['.#.', '.#.'], ['###', '###']] },
  { ten: 'Khối bậc có rãnh', L: [['####', '####', '####'], ['##.#', '##.#', '....']] },
  { ten: 'Khối bậc cao phía sau', L: [['###', '###', '###'], ['###', '###', '...'], ['#..', '#..', '...']] },
  { ten: 'Khối có bậc hai bên', L: [['###', '###', '###'], ['.#.', '###', '.#.']] }
]);
/* hình mẫu của thầy cô (ảnh) dùng trong Tìm hiểu và luyện tập */
const GC_IMG = { hop1: ['img/GC_hop_goc1.webp', 'Hộp chiếu – phương pháp chiếu góc thứ nhất'], hop3: ['img/GC_hop_goc3.webp', 'Hộp chiếu – phương pháp chiếu góc thứ ba'],
  giado: ['img/GC_giado_3d.webp', 'Giá đỡ (hình 3D)'], giado3: ['img/GC_giado_3hc.webp', 'Giá đỡ – ba hình chiếu'] };
const gcGiaDo = () => `<div class="gcimgs"><figure><img src="img/GC_giado_3d.webp" alt="Giá đỡ"><figcaption>Giá đỡ</figcaption></figure>${['A', 'B', 'C'].map((k, i) => `<figure><img src="img/GC_giado_${k}.webp" alt="Hình ${i + 1}"><figcaption>Hình ${i + 1}</figcaption></figure>`).join('')}</div>`;
const GC_FIXED = [
  { fig: () => `<img class="gcbig" src="img/GC_hop_goc1.webp" alt="Hộp chiếu">`, stem: 'Hình bên mô tả cách xây dựng ba hình chiếu của vật thể theo phương pháp nào?', opts: ['Phương pháp chiếu góc thứ nhất', 'Phương pháp chiếu góc thứ ba', 'Phương pháp chiếu trục đo', 'Phương pháp chiếu phối cảnh'], why: 'Vật thể nằm giữa người quan sát và các mặt phẳng chiếu (mặt phẳng đứng phía sau, mặt phẳng bằng phía dưới, mặt phẳng cạnh bên phải). Trải phẳng ra: hình chiếu bằng nằm dưới, hình chiếu cạnh nằm bên phải hình chiếu đứng.' },
  { fig: () => `<img class="gcbig" src="img/GC_hop_goc3.webp" alt="Hộp chiếu">`, stem: 'Hình bên mô tả cách xây dựng ba hình chiếu của vật thể theo phương pháp nào?', opts: ['Phương pháp chiếu góc thứ ba', 'Phương pháp chiếu góc thứ nhất', 'Phương pháp chiếu trục đo', 'Phương pháp chiếu phối cảnh'], why: 'Các mặt phẳng chiếu nằm giữa người quan sát và vật thể (mặt phẳng đứng phía trước, mặt phẳng bằng phía trên, mặt phẳng cạnh bên trái). Trải phẳng ra: hình chiếu bằng nằm trên, hình chiếu cạnh nằm bên trái hình chiếu đứng.' },
  { fig: gcGiaDo, stem: 'Cho giá đỡ và ba hình chiếu 1, 2, 3 của nó. Biết hình 2 là hình chiếu đứng. Hình nào là hình chiếu bằng?', opts: ['Hình 1', 'Hình 3', 'Hình 2'], why: 'Hình 1 là hình nhìn từ trên xuống: thấy đế có hai lỗ tròn, gân ở giữa và tấm đứng ở bên phải.' },
  { fig: gcGiaDo, stem: 'Cho giá đỡ và ba hình chiếu 1, 2, 3 của nó. Biết hình 2 là hình chiếu đứng. Hình nào là hình chiếu cạnh?', opts: ['Hình 3', 'Hình 1', 'Hình 2'], why: 'Hình 3 là hình nhìn từ trái (từ phía đế sang tấm đứng): thấy tấm đứng có đầu tròn, lỗ tròn và gân; các lỗ ở đế bị che nên vẽ nét đứt.' },
  { fig: gcGiaDo, stem: 'Vẽ giá đỡ theo phương pháp chiếu góc thứ nhất thì hình 1 (hình chiếu bằng) phải đặt ở đâu so với hình 2 (hình chiếu đứng)?', opts: ['Phía dưới hình 2', 'Phía trên hình 2', 'Bên trái hình 2', 'Bên phải hình 2'], why: 'Phương pháp chiếu góc thứ nhất: hình chiếu bằng đặt dưới, hình chiếu cạnh đặt bên phải hình chiếu đứng.' },
  { fig: gcGiaDo, stem: 'Vẽ giá đỡ theo phương pháp chiếu góc thứ ba thì hình 3 (hình chiếu cạnh) phải đặt ở đâu so với hình 2 (hình chiếu đứng)?', opts: ['Bên trái hình 2', 'Bên phải hình 2', 'Phía trên hình 2', 'Phía dưới hình 2'], why: 'Phương pháp chiếu góc thứ ba: hình chiếu bằng đặt trên, hình chiếu cạnh đặt bên trái hình chiếu đứng.' },
  { fig: gcGiaDo, stem: 'Trong hình 3, các nét đứt ở phần đế thể hiện điều gì?', opts: ['Các lỗ ở đế bị che khuất (cạnh khuất)', 'Đường tâm của lỗ', 'Đường gạch gạch của mặt cắt', 'Đường giới hạn của ren'], why: 'Nét đứt dùng để vẽ cạnh khuất: hai lỗ ở đế nằm phía trong, bị che nên không nhìn thấy. Đường tâm vẽ bằng nét gạch chấm mảnh.' }
];
/** ghép 3 hình chiếu thành một bản vẽ: pos = { top: 'above'|'below', side: 'left'|'right' }; o.frame: khung màu, o.label: ghi tên, o.mark: chỉ đánh dấu 1 hình */
function gcLayoutSvg(V, pos, o = {}) {
  const lab = o.label || o.mark, c = o.cell || 26, gap = Math.max(c * 1.5, lab ? 44 : 26), pad = lab ? 40 : 16;
  const box = p => ({ w: p.W * c, h: p.H * c });
  const F = box(V.front), T = box(V.top), S = box(V.side);
  const colL = pos.side === 'left' ? S.w + gap : 0, rowT = pos.top === 'above' ? T.h + gap : 0;
  const fx = pad + colL, fy = pad + rowT + (lab ? 14 : 0);
  const place = { front: [fx, fy], top: [fx, pos.top === 'above' ? fy - gap - T.h : fy + F.h + gap], side: [pos.side === 'left' ? fx - gap - S.w : fx + F.w + gap, fy] };
  const W = pad * 2 + colL + F.w + (pos.side === 'right' ? gap + S.w : 0), H = pad * 2 + rowT + F.h + (pos.top === 'below' ? gap + T.h : 0) + (lab ? 30 : 0);
  const NAME = { front: 'Hình chiếu đứng', top: 'Hình chiếu bằng', side: 'Hình chiếu cạnh' };
  const draw = (k, p) => {
    const [x0, y0] = place[k], b = box(p), X = x => x0 + x * c, Y = y => y0 + (p.H - y) * c, on = o.frame || o.mark === k;
    const fr = on ? `<rect x="${x0 - 9}" y="${y0 - 9}" width="${b.w + 18}" height="${b.h + 18}" rx="8" fill="${GC_COL[k]}" fill-opacity="0.07" stroke="${GC_COL[k]}" stroke-width="2.6"/>` : '';
    let lb = '';
    if (o.label || o.mark === k) {
      const t = c >= 26 ? NAME[k] : NAME[k].replace('Hình chiếu', 'HC'), tw = t.length * 6.6 + 16, ly = k === 'top' && pos.top === 'below' ? y0 + b.h + 14 : y0 - 32;
      lb = `<g transform="translate(${x0 + b.w / 2 - tw / 2},${ly})"><rect width="${tw}" height="19" rx="9.5" fill="${on ? GC_COL[k] : '#64748b'}"/><text x="${tw / 2}" y="13.5" text-anchor="middle" font-size="11.5" font-weight="700" fill="#fff">${t}</text></g>`;
    }
    return fr + lb + p.segs.map(s => `<line x1="${X(s.x1)}" y1="${Y(s.y1)}" x2="${X(s.x2)}" y2="${Y(s.y2)}" stroke="#0f172a" stroke-width="${s.an ? 1.7 : 3}" ${s.an ? 'stroke-dasharray="6 4"' : ''} stroke-linecap="round"/>`).join('');
  };
  // đường dóng: HCĐ – HCB thẳng cột, HCĐ – HCC thẳng hàng
  const [x0, y0] = place.front, [tx, ty] = place.top, [sx] = place.side, dash = 'stroke="#94a3b8" stroke-width="1" stroke-dasharray="7 3 1.5 3"';
  const dong = o.dong === false ? '' : [0, F.w].map(dx => `<line x1="${x0 + dx}" y1="${pos.top === 'above' ? ty + T.h + 9 : y0 + F.h + 9}" x2="${x0 + dx}" y2="${pos.top === 'above' ? y0 - 9 : ty - 9}" ${dash}/>`).join('')
    + [0, F.h].map(dy => `<line x1="${pos.side === 'left' ? sx + S.w + 9 : x0 + F.w + 9}" y1="${y0 + dy}" x2="${pos.side === 'left' ? x0 - 9 : sx - 9}" y2="${y0 + dy}" ${dash}/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;height:auto;background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(15,23,42,.08)" role="img" aria-label="Bản vẽ ba hình chiếu">${dong}${draw('front', V.front) + draw('top', V.top) + draw('side', V.side)}</svg>`;
}
/** Hộp chiếu (giống hình SGK): vật thể, ba mặt phẳng chiếu, ba hình chiếu trên đó và hướng chiếu, vẽ bằng phép chiếu xiên.
 *  m = 1: vật thể nằm giữa người quan sát và các mặt phẳng chiếu (mp đứng phía sau, mp bằng phía dưới, mp cạnh bên phải).
 *  m = 3: các mặt phẳng chiếu nằm giữa người quan sát và vật thể (mp đứng phía trước, mp bằng phía trên, mp cạnh bên trái). */
let gcBoxN = 0;
function gcBoxSvg(s, m, o = {}) {
  const U = o.unit || 26, K = 0.62, CS = Math.cos(Math.PI / 4), SN = Math.sin(Math.PI / 4), g = 1.5, G = 2.4, id = 'gb' + (++gcBoxN);
  const X = s.X, Y = s.Y, Z = s.Z;
  const P = (x, y, z) => [x * U + K * U * (-y) * CS, -z * U + K * U * (-y) * SN];
  const pts = [], add = p => { pts.push(p); return p; };
  const V = { front: projView(s, 'front'), top: projView(s, 'top'), side: projView(s, 'side') };
  let planes, maps, arrows;
  if (m === 1) {
    const yb = Y + g, zb = -g, xr = X + g;
    planes = { front: [[-g, yb, -g], [X + g, yb, -g], [X + g, yb, Z + g], [-g, yb, Z + g]],
      top: [[-g, -G, zb], [X + g, -G, zb], [X + g, yb, zb], [-g, yb, zb]],
      side: [[xr, -G, -g], [xr, yb, -g], [xr, yb, Z + g], [xr, -G, Z + g]] };
    maps = { front: (u, w) => [u, yb, w], top: (u, w) => [u, w, zb], side: (u, w) => [xr, Y - u, w] };
    arrows = { front: [[X * 0.5, -G - 1.8, Z * 0.55], [X * 0.5, -0.6, Z * 0.55]], top: [[X * 0.3, Y * 0.5, Z + 2.3], [X * 0.3, Y * 0.5, Z + 0.5]], side: [[-2.8, Y * 0.5, Z * 0.5], [-0.6, Y * 0.5, Z * 0.5]] };
  } else {
    const yf = -g, zt = Z + g, xl = -g;
    planes = { front: [[-g, yf, -g], [X + g, yf, -g], [X + g, yf, Z + g], [-g, yf, Z + g]],
      top: [[-g, yf, zt], [X + g, yf, zt], [X + g, Y + G, zt], [-g, Y + G, zt]],
      side: [[xl, yf, -g], [xl, Y + G, -g], [xl, Y + G, Z + g], [xl, yf, Z + g]] };
    maps = { front: (u, w) => [u, yf, w], top: (u, w) => [u, w, zt], side: (u, w) => [xl, Y - u, w] };
    arrows = { front: [[X * 0.5, yf - 2.6, Z * 0.2], [X * 0.5, yf - 0.3, Z * 0.2]], top: [[X + g + 1.2, Y * 0.5, zt + 2.3], [X + g + 1.2, Y * 0.5, zt + 0.3]], side: [[xl - 2.6, Y + G * 0.7, Z * 0.5], [xl - 0.3, Y + G * 0.7, Z * 0.5]] };
  }
  Object.values(planes).forEach(q => q.forEach(p => add(P(...p))));
  Object.values(arrows).forEach(q => q.forEach(p => add(P(...p))));
  const has = (x, y, z) => s.set.has(x + ',' + y + ',' + z), faces = [];
  const W3 = [-K * CS, -1, K * SN];
  s.v.forEach(([x, y, z]) => [[-1, 0, 0], [0, -1, 0], [0, 0, 1]].forEach(n => {
    if (has(x + n[0], y + n[1], z + n[2])) return;
    const i = n.findIndex(v => v !== 0), [a, b] = [0, 1, 2].filter(k => k !== i), o0 = [x, y, z]; if (n[i] > 0) o0[i] += 1;
    const c = (da, db) => { const p = o0.slice(); p[a] += da; p[b] += db; return p; };
    const q = [c(0, 0), c(1, 0), c(1, 1), c(0, 1)], ctr = q.reduce((A, p) => A.map((v, k) => v + p[k] / 4), [0, 0, 0]);
    const edge = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([da, db]) => { const r = [x, y, z]; r[a] += da; r[b] += db; const r2 = [r[0] + n[0], r[1] + n[1], r[2] + n[2]]; return !(has(...r) && !has(...r2)); });
    faces.push({ q, n, edge, d: ctr[0] * W3[0] + ctr[1] * W3[1] + ctr[2] * W3[2] });
  }));
  faces.sort((A, B) => A.d - B.d);
  faces.forEach(f => f.q.forEach(p => add(P(...p))));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), pad = 22, x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  const T = p => [p[0] - x0, p[1] - y0], W = Math.max(...xs) - x0 + pad, H = Math.max(...ys) - y0 + pad;
  const f1 = v => v.toFixed(1);
  const poly = (q, attr) => `<polygon points="${q.map(p => T(P(...p)).map(f1).join(',')).join(' ')}" ${attr}/>`;
  const line = (a, b, attr) => { const A = T(P(...a)), B = T(P(...b)); return `<line x1="${f1(A[0])}" y1="${f1(A[1])}" x2="${f1(B[0])}" y2="${f1(B[1])}" ${attr}/>`; };
  const viewOn = k => V[k].segs.map(sg => line(maps[k](sg.x1, sg.y1), maps[k](sg.x2, sg.y2), `stroke="#0f172a" stroke-width="${sg.an ? 1.4 : 2.6}" ${sg.an ? 'stroke-dasharray="4 3"' : ''} stroke-linecap="round"`)).join('');
  const NAME = { front: 'MP chiếu đứng', top: 'MP chiếu bằng', side: 'MP chiếu cạnh' };
  const frame = k => poly(planes[k], `fill="url(#${id}${k})" stroke="${GC_COL[k]}" stroke-width="2.8" stroke-linejoin="round"`);
  // chú thích màu dưới hình
  const LG = [['front', 'MP chiếu đứng'], ['top', 'MP chiếu bằng'], ['side', 'MP chiếu cạnh']], LH = 26;
  const legend = `<g transform="translate(${f1(W / 2 - 165)},${f1(H + 4)})">${LG.map(([k, t], i) => `<g transform="translate(${i * 112},0)"><rect width="104" height="19" rx="9.5" fill="${GC_COL[k]}"/><text x="52" y="13.5" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${t}</text></g>`).join('')}</g>`
    + `<text x="${f1(W / 2)}" y="${f1(H + LH + 12)}" text-anchor="middle" font-size="10.5" fill="#475569">Mũi tên: hướng chiếu · Nét chấm: đường chiếu</text>`;
  const cor = [[0, 0, Z], [X, 0, Z], [0, Y, Z], [X, 0, 0], [0, 0, 0]];
  const proj = c => [maps.front(c[0], c[2]), maps.top(c[0], c[1]), maps.side(Y - c[1], c[2])];
  const rays = cor.map(c => proj(c).map(p => line(c, p, 'stroke="#64748b" stroke-width="1.2" stroke-dasharray="1.5 4" stroke-linecap="round"')).join('')).join('');
  const shade = n => n[2] ? '#ffe7ad' : n[0] ? '#e0a03a' : '#f6c15a';
  const obj = faces.map(f => poly(f.q, `fill="${shade(f.n)}" stroke="${shade(f.n)}" stroke-width="1.1" stroke-linejoin="round"`) + f.edge.map((e, i) => e ? line(f.q[i], f.q[(i + 1) % 4], 'stroke="#3b2a0c" stroke-width="2.4" stroke-linecap="round"') : '').join('')).join('');
  const arrow = k => { const [a, b] = arrows[k]; return line(a, b, `stroke="${GC_COL[k]}" stroke-width="3.2" stroke-linecap="round" marker-end="url(#${id}a${k})"`); };
  const back = m === 1 ? ['front', 'top', 'side'] : ['top', 'side'], fore = m === 1 ? [] : ['front'];
  const grad = (k, c) => `<linearGradient id="${id}${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="0.16"/><stop offset="1" stop-color="${c}" stop-opacity="0.04"/></linearGradient>`;
  const og = (k, c1, c2) => `<linearGradient id="${id}${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
  const defs = `<defs>${grad('front', GC_COL.front)}${grad('top', GC_COL.top)}${grad('side', GC_COL.side)}${og('t', '#fff4d6', '#ffe6a8')}${og('f', '#ffd27a', '#f5b94b')}${og('l', '#e9a93c', '#d38f22')}${Object.keys(GC_COL).map(k => `<marker id="${id}a${k}" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L9,4.5 L0,9 z" fill="${GC_COL[k]}"/></marker>`).join('')}</defs>`;
  const HH = H + (o.legend === false ? 0 : LH + 22), WW = Math.max(W, 360);
  return `<svg viewBox="${f1((W - WW) / 2)} 0 ${f1(WW)} ${f1(HH)}" width="${f1(WW)}" height="${f1(HH)}" style="max-width:100%;height:auto;background:linear-gradient(#ffffff,#f8fafc);border-radius:12px;box-shadow:0 1px 4px rgba(15,23,42,.08)" role="img" aria-label="Hộp chiếu">${defs}${back.map(k => frame(k) + viewOn(k)).join('')}${rays}${obj}${fore.map(k => frame(k) + viewOn(k)).join('')}${['front', 'top', 'side'].map(arrow).join('')}${o.legend === false ? '' : legend}</svg>`;
}
const gcViews = s => ({ front: projView(s, 'front'), top: projView(s, 'top'), side: projView(s, 'side'), right: projView(s, 'right'), back: projView(s, 'back') });
/** sơ đồ góc chiếu: vị trí vật thể, mặt phẳng chiếu và người quan sát (nhìn từ cạnh) */
function gcSchema(m) {
  const eye = '<g transform="translate(18,92)"><ellipse cx="0" cy="0" rx="13" ry="8" fill="#fff" stroke="#333" stroke-width="2"/><circle cx="2" cy="0" r="4" fill="#333"/></g>';
  const obj = x => `<g transform="translate(${x},70)"><polygon points="0,44 34,44 34,18 18,18 18,0 0,0" fill="#f5c26b" stroke="#333" stroke-width="2"/></g>`;
  const plane = (x, col, t) => `<line x1="${x}" y1="38" x2="${x}" y2="138" stroke="${col}" stroke-width="5"/><text x="${x}" y="28" text-anchor="middle" font-size="11" fill="${col}" font-weight="700">${t}</text>`;
  const ray = (x1, x2) => `<line x1="${x1}" y1="92" x2="${x2}" y2="92" stroke="#e89a2c" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#ar${m})"/>`;
  const body = m === 1 ? `${eye}${ray(34, 238)}${obj(120)}${plane(255, GC_COL.front, 'Mặt phẳng chiếu')}`
    : `${eye}${ray(34, 176)}${plane(130, GC_COL.front, 'Mặt phẳng chiếu')}${obj(190)}`;
  return `<svg viewBox="0 0 320 150" width="320" height="150" style="max-width:100%;height:auto;background:#fff;border-radius:10px"><defs><marker id="ar${m}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#e89a2c"/></marker></defs>${body}
    <text x="8" y="146" font-size="10.5" fill="#555">Người quan sát</text><text x="${m === 1 ? 122 : 192}" y="132" font-size="10.5" fill="#555">Vật thể</text></svg>`;
}

route(/^\/gocchieu$/, () => {
  let mode = 'hoc', m = 1, sh = SHAPES[0], viewer = null, qs = [], qi = 0, score = 0, picked = null, slots = {}, held = null, done = false;
  const pool = () => shuffle(GC_SHAPES.slice());
  let fig = '';   // hình mẫu của thầy cô đang mở trong Tìm hiểu
  const finish = (ten, n) => {
    const hk = 'hist_' + uid(), hist = store.get(hk, []);
    hist.push({ t: Date.now(), title: ten, key: '', loai: 'game', diem: Math.round(score / n * 1000) / 100, dung: score, tong: n, giay: 0 }); store.set(hk, hist.slice(-300));
    setView(`<div class="hero"><h1>Hoàn thành! 🎉</h1><p class="sub">${esc(ten)}: đúng <b>${score}/${n}</b> câu.</p></div>
      <div class="row"><button class="btn" id="again">Chơi lại</button><button class="btn ghost" id="menu">Chọn trò khác</button></div>`);
    $('#again').onclick = () => mode === 'nhanbiet' ? startNB() : startXH(); $('#menu').onclick = () => { mode = 'hoc'; draw(); };
  };
  const tabs = () => `<div class="tabs">${[['hoc', '📘 Tìm hiểu'], ['nhanbiet', '🔍 Nhận biết góc chiếu'], ['xephinh', '🧩 Xếp hình chiếu']].map(([k, t]) => `<button data-mode="${k}" class="${mode === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const bind = () => $$('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; if (mode === 'nhanbiet') startNB(); else if (mode === 'xephinh') startXH(); else draw(); });

  /* ---- 1. Tìm hiểu: xoay vật thể, đổi góc chiếu, xem cách bố trí ---- */
  const draw = () => {
    if (viewer) { viewer.destroy(); viewer = null; }
    const s = shapeVox(sh.L), V = gcViews(s), g = GC[m];
    setView(`<h1>📐 Phương pháp chiếu góc thứ nhất & góc thứ ba</h1>
      <p class="sub">Công nghệ 10 – Bài 9. Hình chiếu vuông góc (HC: hình chiếu). Xoay vật thể, đổi phương pháp chiếu để thấy vị trí các hình chiếu thay đổi thế nào.</p>${tabs()}
      <div class="card"><b>🧊 Chọn vật thể</b> <span class="hint">– bấm vào tên vật thể để xem</span>
        <div class="gcpick">${GC_SHAPES.map((x, i) => `<button class="${x === sh ? 'on' : ''}" data-sh="${i}">${esc(x.ten)}</button>`).join('')}</div></div>
      <div class="gcwrap"><div class="card"><div class="row" style="align-items:center"><b class="grow">🧊 ${esc(sh.ten)}</b></div>
          <canvas id="cv" style="width:100%;height:300px;touch-action:none;background:linear-gradient(#f4f7f7,#e6eeee);border-radius:12px;margin-top:8px;cursor:grab"></canvas>
          <div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn ghost sm" data-v="iso">Trục đo</button><button class="btn ghost sm" data-v="front">Nhìn từ trước</button><button class="btn ghost sm" data-v="top">Nhìn từ trên</button><button class="btn ghost sm" data-v="side">Nhìn từ trái</button></div></div>
        <div class="card"><div class="tabs" style="margin-top:0"><button data-m="1" class="${m === 1 ? 'on' : ''}">Góc chiếu thứ nhất</button><button data-m="3" class="${m === 3 ? 'on' : ''}">Góc chiếu thứ ba</button></div>
          <div style="text-align:center;margin:6px 0">${gcLayoutSvg(V, g, { frame: true, label: true, cell: 30 })}</div>
          <div class="expl"><b class="t">${m === 1 ? 'Góc chiếu thứ nhất' : 'Góc chiếu thứ ba'}</b>
            • Vật thể đặt ${m === 1 ? '<b>giữa người quan sát và mặt phẳng chiếu</b>' : 'sau mặt phẳng chiếu, <b>mặt phẳng chiếu nằm giữa người quan sát và vật thể</b>'}.<br>
            • <b style="color:${GC_COL.front}">Hình chiếu đứng</b> (nhìn từ trước) là hình chính, đặt ở giữa.<br>
            • <b style="color:${GC_COL.top}">Hình chiếu bằng</b> (nhìn từ trên) đặt <b>${m === 1 ? 'dưới' : 'trên'}</b> hình chiếu đứng.<br>
            • <b style="color:${GC_COL.side}">Hình chiếu cạnh</b> (nhìn từ trái) đặt bên <b>${m === 1 ? 'phải' : 'trái'}</b> hình chiếu đứng.<br>
            • Các hình chiếu phải <b>dóng thẳng hàng</b> với nhau; cạnh khuất vẽ bằng nét đứt.</div>
          <div style="text-align:center;margin-top:6px"><b>Hộp chiếu và cách trải phẳng</b><div style="margin-top:6px">${gcBoxSvg(s, m, { unit: 22 })}</div></div>
          <div style="text-align:center">${gcSchema(m)}</div>
          <p class="hint">Việt Nam (TCVN) và nhiều nước châu Âu dùng phương pháp chiếu góc thứ nhất; phương pháp chiếu góc thứ ba được dùng ở Mỹ và một số nước khác. Đọc bản vẽ nước ngoài cần xem kí hiệu phương pháp chiếu trên khung tên.</p></div></div>
      <div class="card"><b>🖼️ Hình mẫu của thầy cô</b> <span class="hint">– bấm để mở hình</span>
        <div class="gcpick">${Object.entries(GC_IMG).map(([k, v]) => `<button class="${fig === k ? 'on' : ''}" data-fig="${k}">${esc(v[1])}</button>`).join('')}</div>
        ${fig ? `<div style="text-align:center;margin-top:10px">${fig === 'giado3' ? gcGiaDo() : `<img class="gcbig" src="${GC_IMG[fig][0]}" alt="${esc(GC_IMG[fig][1])}">`}</div>` : ''}</div>
      <div class="card"><b>🎯 Luyện tập</b><div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn" data-mode="nhanbiet">🔍 Nhận biết góc chiếu (12 câu)</button><button class="btn accent" data-mode="xephinh">🧩 Xếp hình chiếu đúng vị trí (5 câu)</button>${isGV() ? '<button class="btn ghost" id="fs">🖥️ Trình chiếu toàn màn hình</button>' : ''}</div></div>`);
    bind();
    viewer = Viewer3D($('#cv'), s);
    $$('[data-v]').forEach(b => b.onclick = () => viewer[b.dataset.v]());
    $$('[data-m]').forEach(b => b.onclick = () => { m = +b.dataset.m; draw(); });
    $$('[data-sh]').forEach(b => b.onclick = () => { sh = GC_SHAPES[+b.dataset.sh]; draw(); });
    $$('[data-fig]').forEach(b => b.onclick = () => { fig = fig === b.dataset.fig ? '' : b.dataset.fig; draw(); });
    if ($('#fs')) $('#fs').onclick = () => { try { (document.querySelector('main') || document.documentElement).requestFullscreen(); } catch (e) {} };
  };

  /* ---- 2. Nhận biết: bản vẽ dùng góc chiếu nào? ---- */
  const startNB = () => {
    if (viewer) { viewer.destroy(); viewer = null; }
    const P = [[1, GC[1]], [1, GC[1]], [3, GC[3]], [3, GC[3]], [0, { top: 'below', side: 'left' }], [0, { top: 'above', side: 'right' }]];
    const gen = pool().slice(0, 5).map((x, i) => { const s = shapeVox(x.L); if (i % 2 === 0) { const mm = rnd(2) ? 1 : 3; return { box: true, sh: x, s, ans: mm }; } const [ans, pos] = P[rnd(P.length)]; return { sh: x, V: gcViews(s), ans, pos }; });
    const fix = GC_FIXED.map(f => ({ fixed: f, order: shuffle(f.opts.map((t, k) => ({ t, ok: k === 0 }))) }));
    qs = shuffle(fix.concat(gen));
    qi = 0; score = 0; picked = null; drawNB();
  };
  const drawNB = () => {
    if (qi >= qs.length) return finish('Nhận biết góc chiếu', qs.length);
    const q = qs[qi];
    if (q.fixed || q.box) return drawNB2(q);
    const lab = { 1: 'Góc chiếu thứ nhất', 3: 'Góc chiếu thứ ba', 0: 'Bố trí sai, không theo phương pháp nào' };
    const why = q.ans ? `Hình chiếu bằng nằm <b>${q.pos.top === 'below' ? 'dưới' : 'trên'}</b>, hình chiếu cạnh nằm bên <b>${q.pos.side === 'right' ? 'phải' : 'trái'}</b> hình chiếu đứng → <b>${GC[q.ans].ten}</b>.`
      : `Hình chiếu bằng nằm <b>${q.pos.top === 'below' ? 'dưới' : 'trên'}</b> nhưng hình chiếu cạnh lại nằm bên <b>${q.pos.side === 'right' ? 'phải' : 'trái'}</b>. Góc thứ nhất: dưới – phải; góc thứ ba: trên – trái. Bản vẽ này trộn lẫn hai cách nên sai.`;
    setView(`<h1>🔍 Nhận biết góc chiếu</h1>${tabs()}
      <div class="qbar"><div class="title">Câu ${qi + 1}/${qs.length}</div><span class="timer">✔ ${score}</span></div>
      <div class="qcard"><div class="stem">Bản vẽ ba hình chiếu dưới đây được bố trí theo phương pháp nào? <span class="hint">(Hình có khung đỏ là hình chiếu đứng)</span></div>
        <div style="text-align:center;margin:10px 0">${gcLayoutSvg(q.V, q.pos, { cell: 24, frame: picked != null, label: picked != null, mark: 'front' })}</div>
        ${[1, 3, 0].map(k => `<button class="opt ${picked != null ? (k === q.ans ? 'right' : picked === k ? 'wrong' : '') : ''}" data-k="${k}" ${picked != null ? 'disabled' : ''}><span class="L">${{ 1: 'A', 3: 'B', 0: 'C' }[k]}</span><span class="tx">${lab[k]}</span></button>`).join('')}
        ${picked != null ? `<div class="expl ${picked === q.ans ? 'ans' : ''}"><b class="t">${picked === q.ans ? '✔ Chính xác!' : '✘ Chưa đúng.'}</b>${why}</div><button class="btn block" id="nx" style="margin-top:10px">${qi < qs.length - 1 ? 'Câu tiếp →' : 'Xem kết quả'}</button>` : ''}</div>`);
    bind();
    $$('[data-k]').forEach(b => b.onclick = () => { picked = +b.dataset.k; if (picked === q.ans) score++; drawNB(); });
    if ($('#nx')) $('#nx').onclick = () => { qi++; picked = null; drawNB(); };
  };

  /* câu hỏi có hình mẫu của thầy cô hoặc hình hộp chiếu sinh từ vật thể */
  const drawNB2 = q => {
    const opts = q.fixed ? q.order : [{ t: 'Phương pháp chiếu góc thứ nhất', ok: q.ans === 1 }, { t: 'Phương pháp chiếu góc thứ ba', ok: q.ans === 3 }];
    const stem = q.fixed ? q.fixed.stem : 'Hình hộp chiếu dưới đây mô tả cách xây dựng ba hình chiếu của vật thể theo phương pháp nào?';
    const fig = q.fixed ? q.fixed.fig() : gcBoxSvg(q.s, q.ans, { unit: 24 });
    const why = q.fixed ? q.fixed.why : (q.ans === 1 ? 'Vật thể nằm giữa người quan sát và các mặt phẳng chiếu: mặt phẳng chiếu đứng ở phía sau, mặt phẳng chiếu bằng ở dưới, mặt phẳng chiếu cạnh bên phải.' : 'Các mặt phẳng chiếu nằm giữa người quan sát và vật thể: mặt phẳng chiếu đứng ở phía trước, mặt phẳng chiếu bằng ở trên, mặt phẳng chiếu cạnh bên trái.');
    setView(`<h1>🔍 Nhận biết góc chiếu</h1>${tabs()}
      <div class="qbar"><div class="title">Câu ${qi + 1}/${qs.length}</div><span class="timer">✔ ${score}</span></div>
      <div class="qcard"><div class="stem">${esc(stem)}</div><div style="text-align:center;margin:10px 0">${fig}</div>
        ${opts.map((o, k) => `<button class="opt ${picked != null ? (o.ok ? 'right' : picked === k ? 'wrong' : '') : ''}" data-k="${k}" ${picked != null ? 'disabled' : ''}><span class="L">${LETTERS[k]}</span><span class="tx">${esc(o.t)}</span></button>`).join('')}
        ${picked != null ? `<div class="expl ${opts[picked].ok ? 'ans' : ''}"><b class="t">${opts[picked].ok ? '✔ Chính xác!' : '✘ Chưa đúng.'}</b>${esc(why)}</div>
          ${q.box ? `<div style="text-align:center;margin-top:8px">${gcLayoutSvg(gcViews(q.s), GC[q.ans], { frame: true, label: true, cell: 20 })}</div>` : ''}
          <button class="btn block" id="nx" style="margin-top:10px">${qi < qs.length - 1 ? 'Câu tiếp →' : 'Xem kết quả'}</button>` : ''}</div>`);
    bind();
    $$('[data-k]').forEach(b => b.onclick = () => { picked = +b.dataset.k; if (opts[picked].ok) score++; drawNB(); });
    if ($('#nx')) $('#nx').onclick = () => { qi++; picked = null; drawNB(); };
  };

  /* ---- 3. Xếp hình: đặt hình chiếu bằng, hình chiếu cạnh vào đúng ô quanh hình chiếu đứng ---- */
  const startXH = () => { qs = pool().slice(0, 5).map(x => ({ sh: x, s: shapeVox(x.L), m: rnd(2) ? 1 : 3 })); qi = 0; score = 0; newXH(); };
  const newXH = () => {
    const q = qs[qi]; q.V = gcViews(q.s);
    const cards = [{ id: 'top', p: q.V.top, ok: 'top' }, { id: 'side', p: q.V.side, ok: 'side' }];
    const k1 = viewKey(q.V.side), k2 = viewKey(q.V.right);
    cards.push(k1 !== k2 ? { id: 'right', p: q.V.right, ok: null, why: 'Đây là hình nhìn từ phải, không phải hình chiếu cạnh (nhìn từ trái).' } : { id: 'back', p: q.V.back, ok: null, why: 'Đây là hình nhìn từ phía sau.' });
    q.cards = shuffle(cards); slots = {}; held = null; done = false; drawXH();
  };
  const drawXH = () => {
    if (viewer) { viewer.destroy(); viewer = null; }
    if (qi >= qs.length) return finish('Xếp hình chiếu đúng vị trí', qs.length);
    const q = qs[qi], g = GC[q.m], need = { [g.top]: 'top', [g.side]: 'side' };
    const cardOf = id => q.cards.find(c => c.id === id);
    const slot = pos => { const id = slots[pos], c = id && cardOf(id), st = done ? (need[pos] ? (id === need[pos] ? 'ok' : 'bad') : (id ? 'bad' : '')) : '';
      return `<button class="gcslot ${st} ${held ? 'can' : ''}" data-slot="${pos}">${c ? viewSvg(c.p, 110) : `<span class="hint">${{ above: 'Ô trên', below: 'Ô dưới', left: 'Ô trái', right: 'Ô phải' }[pos]}</span>`}</button>`; };
    setView(`<h1>🧩 Xếp hình chiếu</h1>${tabs()}
      <div class="qbar"><div class="title">Câu ${qi + 1}/${qs.length} · ${esc(q.sh.ten)}</div><span class="timer">✔ ${score}</span></div>
      <div class="qcard"><div class="stem">Vẽ theo <b>${g.ten}</b>: đặt <b style="color:${GC_COL.top}">hình chiếu bằng</b> và <b style="color:${GC_COL.side}">hình chiếu cạnh</b> vào đúng ô quanh hình chiếu đứng. <span class="hint">Bấm chọn một thẻ bên dưới rồi bấm vào ô; bấm vào ô đã đặt để gỡ thẻ ra. Có một thẻ thừa.</span></div>
        <canvas id="cv" style="width:100%;height:220px;touch-action:none;background:linear-gradient(#f4f7f7,#e6eeee);border-radius:12px;margin-top:8px;cursor:grab"></canvas>
        <div class="gcgrid"><div></div>${slot('above')}<div></div>${slot('left')}<div class="gcfront">${viewSvg(q.V.front, 110)}<span>Hình chiếu đứng</span></div>${slot('right')}<div></div>${slot('below')}<div></div></div>
        <div class="row" style="justify-content:center;gap:10px;flex-wrap:wrap;margin-top:8px">${q.cards.filter(c => !Object.values(slots).includes(c.id)).map(c => `<button class="gccard ${held === c.id ? 'on' : ''}" data-card="${c.id}" ${done ? 'disabled' : ''}>${viewSvg(c.p, 100)}</button>`).join('') || '<span class="hint">Đã đặt hết thẻ</span>'}</div>
        ${done ? `<div class="expl ${q.ok ? 'ans' : ''}"><b class="t">${q.ok ? '✔ Chính xác!' : '✘ Chưa đúng.'}</b>${g.ten[0].toUpperCase() + g.ten.slice(1)}: hình chiếu bằng đặt <b>${q.m === 1 ? 'dưới' : 'trên'}</b>, hình chiếu cạnh (nhìn từ trái) đặt bên <b>${q.m === 1 ? 'phải' : 'trái'}</b> hình chiếu đứng. ${q.cards.filter(c => !c.ok).map(c => esc(c.why)).join(' ')}</div>
          <div style="text-align:center;margin-top:8px">${gcLayoutSvg(q.V, g, { frame: true, label: true, cell: 20 })}</div>
          <button class="btn block" id="nx" style="margin-top:10px">${qi < qs.length - 1 ? 'Câu tiếp →' : 'Xem kết quả'}</button>`
        : `<button class="btn block" id="ck" style="margin-top:12px" ${Object.keys(slots).length ? '' : 'disabled'}>Kiểm tra</button>`}</div>`);
    bind();
    viewer = Viewer3D($('#cv'), q.s);
    $$('[data-card]').forEach(b => b.onclick = () => { held = held === b.dataset.card ? null : b.dataset.card; drawXH(); });
    $$('[data-slot]').forEach(b => b.onclick = () => { if (done) return; const p = b.dataset.slot; if (held) { slots[p] = held; held = null; } else if (slots[p]) delete slots[p]; drawXH(); });
    if ($('#ck')) $('#ck').onclick = () => { q.ok = ['above', 'below', 'left', 'right'].every(p => (slots[p] || null) === (need[p] || null)); if (q.ok) score++; done = true; drawXH(); };
    if ($('#nx')) $('#nx').onclick = () => { qi++; if (qi < qs.length) newXH(); else drawXH(); };
  };
  cleanup = () => { if (viewer) viewer.destroy(); };
  draw();
});

/* ================= KHỐI 10 – HÌNH CHIẾU VUÔNG GÓC: xây dựng PPCG thứ nhất & thứ ba bằng mô hình 3D =================
 * Vật thể dựng từ khối hộp / khối đùn (có lỗ tròn, mặt cong). Ba hình chiếu vẽ theo đúng quy ước (nét thấy, nét khuất, đường tâm).
 * Góc thứ nhất: MP đứng sau vật, MP bằng dưới, MP cạnh bên phải → lật: HCB xuống dưới, HCC sang phải.
 * Góc thứ ba: MP đứng trước vật, MP bằng trên, MP cạnh bên trái → lật: HCB lên trên, HCC sang trái. */
const HC = (() => {
  const area = L => { let a = 0; L.forEach((p, i) => { const q = L[(i + 1) % L.length]; a += p[0] * q[1] - q[0] * p[1]; }); return a / 2; };
  const circ = (cx, cy, r, n = 28) => Array.from({ length: n }, (_, i) => { const t = i / n * Math.PI * 2; return [cx + r * Math.cos(t), cy + r * Math.sin(t), 1]; });
  const arcPts = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const t = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [cx + r * Math.cos(t), cy + r * Math.sin(t), 1]; });
  const AX = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  const to3 = (ax, p, q, c) => ax === 'z' ? [p, q, c] : ax === 'x' ? [c, p, q] : [q, c, p];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
  const orient = (L, ccw) => { if ((area(L) > 0) === ccw) return L; const n = L.length; return L.map((_, j) => { const v = L[n - 1 - j]; return [v[0], v[1], L[(n - 2 - j + n) % n][2] || 0]; }); };
  /** đùn đa giác (p,q) dọc trục ax từ c0 đến c1; mỗi điểm [p,q,s], s=1: cạnh tới điểm sau thuộc mặt cong */
  function extrude(ax, outer, holes, c0, c1, keep = 'tbsh') {
    const O = orient(outer.map(v => [v[0], v[1], v[2] || 0]), true), H = (holes || []).map(h => orient(h.map(v => [v[0], v[1], v[2] || 0]), false));
    const A = AX[ax], F = [];
    F.push({ pts: O.map(v => to3(ax, v[0], v[1], c1)), holes: H.map(h => h.map(v => to3(ax, v[0], v[1], c1))), n: A, t: 't' });
    F.push({ pts: O.map(v => to3(ax, v[0], v[1], c0)).reverse(), holes: H.map(h => h.map(v => to3(ax, v[0], v[1], c0)).reverse()), n: A.map(x => -x), t: 'b' });
    [O, ...H].forEach((L, li) => L.forEach((a, i) => {
      const b = L[(i + 1) % L.length], a0 = to3(ax, a[0], a[1], c0), b0 = to3(ax, b[0], b[1], c0);
      F.push({ pts: [a0, b0, to3(ax, b[0], b[1], c1), to3(ax, a[0], a[1], c1)], holes: [], n: norm(cross(sub(b0, a0), A)), smooth: !!a[2], t: li ? 'h' : 's' });
    }));
    return F.filter(f => keep.indexOf(f.t) >= 0 && (f.t === 't' || f.t === 'b' || c1 !== c0));
  }
  const xz = L => L.map(v => [v[1], v[0], v[2] || 0]);       // đùn theo y: đổi (x,z) → (z,x)
  const box = (x0, x1, y0, y1, z0, z1) => extrude('z', [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], [], z0, z1);
  /** chuẩn bị cạnh: bỏ đường ghép giữa các mặt đồng phẳng liền nhau */
  function prep(faces) {
    const fx = v => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(3);
    const key = (f, s = 1) => { const d = f.n[0] * f.pts[0][0] + f.n[1] * f.pts[0][1] + f.n[2] * f.pts[0][2]; return f.n.map(v => fx(v * s)).join(',') + '|' + fx(d * s); };
    faces.forEach(f => { f.k = key(f); f.ko = key(f, -1); f.loops = [f.pts, ...f.holes]; });
    /** điểm m nằm trong mặt g (cùng mặt phẳng) */
    const inside = (g, m) => { const ax = [0, 1, 2].sort((i, j) => Math.abs(g.n[j]) - Math.abs(g.n[i]))[0], u = (ax + 1) % 3, w = (ax + 2) % 3; let c = false; g.loops.forEach(L => L.forEach((a, i) => { const b = L[(i + 1) % L.length]; if ((a[w] > m[w]) !== (b[w] > m[w]) && m[u] < (b[u] - a[u]) * (m[w] - a[w]) / (b[w] - a[w]) + a[u]) c = !c; })); return c; };
    const onB = (g, m) => g.loops.some(L => L.some((a, i) => { const b = L[(i + 1) % L.length], ab = sub(b, a), am = sub(m, a), l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2; if (!l2) return false; const t = Math.max(0, Math.min(1, (am[0] * ab[0] + am[1] * ab[1] + am[2] * ab[2]) / l2)); const d = sub(am, ab.map(v => v * t)); return Math.hypot(...d) < 1e-4; }));
    faces.forEach(f => {
      f.edges = [];
      if (f.smooth) return;
      const mates = faces.filter(g => g !== f && g.k === f.k);
      // mặt áp sát nhau (cùng mặt phẳng, ngược chiều) là chỗ hai khối liền nhau: cạnh nằm trên đó không phải cạnh thật
      const opp = faces.filter(g => g !== f && g.k === f.ko);
      f.loops.forEach(L => L.forEach((a, i) => {
        const b = L[(i + 1) % L.length], len = Math.hypot(...sub(b, a)), n = Math.max(1, Math.ceil(len / 0.05));
        let st = null;
        for (let j = 0; j < n; j++) {
          const p0 = a.map((v, k) => v + (b[k] - v) * j / n), p1 = a.map((v, k) => v + (b[k] - v) * (j + 1) / n), m = p0.map((v, k) => (v + p1[k]) / 2);
          const seam = mates.some(g => onB(g, m)) || opp.some(g => onB(g, m) || inside(g, m));
          if (!seam) { if (!st) st = p0; } else if (st) { f.edges.push([st, p0]); st = null; }
          if (j === n - 1 && st) f.edges.push([st, p1]);
        }
      }));
    });
    // đường bao (silhouette) của mặt cong: cạnh chung giữa hai dải mặt cong liền nhau
    const sk = (p, q) => [p, q].map(v => v.map(x => x.toFixed(3)).join(',')).sort().join('|'), mp = {};
    faces.forEach(f => { if (!f.smooth) return; f.sil = []; const P = f.pts; [[P[0], P[1]], [P[1], P[2]], [P[2], P[3]], [P[3], P[0]]].forEach(([p, q]) => { const kk = sk(p, q); (mp[kk] = mp[kk] || []).push({ f, p, q }); }); });
    Object.values(mp).forEach(v => { if (v.length === 2) v[0].f.sil.push({ a: v[0].p, b: v[0].q, g: v[1].f }); });
    // cạnh giữa mặt phẳng và mặt cong: tiếp tuyến (góc nhỏ) thì không vẽ cạnh, chỉ vẽ khi là đường bao
    const onSeg = (m, p, q) => { const ab = sub(q, p), am = sub(m, p), l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2; if (!l2) return false; const t = Math.max(0, Math.min(1, (am[0] * ab[0] + am[1] * ab[1] + am[2] * ab[2]) / l2)); return Math.hypot(...sub(am, ab.map(v => v * t))) < 1e-4; };
    faces.forEach(f => {
      if (f.smooth) return;
      f.loops.forEach(Lp => Lp.forEach((p, i) => {
        const q = Lp[(i + 1) % Lp.length], v = mp[sk(p, q)];
        if (!v || v.length !== 1) return;
        const g = v[0].f;
        if (f.n[0] * g.n[0] + f.n[1] * g.n[1] + f.n[2] * g.n[2] > 0.9) f.edges = f.edges.filter(([s, e]) => !onSeg(s.map((x, j) => (x + e[j]) / 2), p, q));
        g.sil.push({ a: p, b: q, g: f });
      }));
    });
    return faces;
  }
  /* ---------- các vật thể: mô hình 3D + 3 hình chiếu vẽ theo quy ước (đơn vị lưới) ----------
   * item: {p:[[u,v]...], k:'v'|'h'|'c', z:đóng} đường gấp khúc · {c:[u,v,r],k} đường tròn · {a:[u,v,r,a0,a1],k} cung (độ) · k: v=nét thấy, h=nét khuất, c=đường tâm */
  const L = (x1, y1, x2, y2, k = 'v') => ({ p: [[x1, y1], [x2, y2]], k });
  const OBJ = [
    { id: 'bacvat', ten: 'Khối bậc có vát (hình mẫu của cô)', anh: 'img/GC_hop_goc1.webp', W: 4, D: 3, H: 3,
      faces: () => [...extrude('x', [[0, 0], [3, 0], [3, 3], [0.8, 3], [0, 2.2]], [], 0, 2.4), ...box(2.4, 4, 0, 3, 0, 1)],
      views: {
        front: { W: 4, H: 3, it: [{ p: [[0, 0], [4, 0], [4, 1], [2.4, 1], [2.4, 3], [0, 3]], z: 1, k: 'v' }, L(0, 2.2, 2.4, 2.2)] },
        top: { W: 4, H: 3, it: [{ p: [[0, 0], [4, 0], [4, 3], [0, 3]], z: 1, k: 'v' }, L(2.4, 0, 2.4, 3), L(0, 0.8, 2.4, 0.8)] },
        side: { W: 3, H: 3, it: [{ p: [[0, 0], [3, 0], [3, 2.2], [2.2, 3], [0, 3]], z: 1, k: 'v' }, L(0, 1, 3, 1, 'h')] },
        right: { W: 3, H: 3, it: [{ p: [[0, 0], [3, 0], [3, 3], [0.8, 3], [0, 2.2]], z: 1, k: 'v' }, L(0, 1, 3, 1)], why: 'Đây là hình nhìn từ phải (bậc thấp ở gần nên thấy rõ, phần vát ở bên trái).' },
        back: { W: 4, H: 3, it: [{ p: [[0, 0], [4, 0], [4, 3], [1.6, 3], [1.6, 1], [0, 1]], z: 1, k: 'v' }, L(1.6, 2.2, 4, 2.2, 'h')], why: 'Đây là hình nhìn từ phía sau.' }
      }, dis: ['right', 'back'] },
    { id: 'giado', ten: 'Gối đỡ (SGK H.9.9 – hình mẫu của cô)', anh: 'img/GC_giado_3d.webp', W: 4, D: 3, H: 4.2,
      faces: () => [
        ...extrude('z', [[1, 0], [3.3, 0], [3.3, 3], [1, 3], ...arcPts(1, 2, 1, 90, 180, 8).slice(1, 8), [0, 2, 0], [0, 1, 1], ...arcPts(1, 1, 1, 180, 270, 8).slice(1, 8)], [circ(0.8, 0.85, 0.3, 20), circ(0.8, 2.15, 0.3, 20)], 0, 0.8),
        ...extrude('x', [[0, 0], [3, 0], [3, 2.7, 1], ...arcPts(1.5, 2.7, 1.5, 0, 180, 16).slice(1, 16), [0, 2.7]], [circ(1.5, 2.75, 0.65, 24)], 3.3, 4),
        ...extrude('y', xz([[1.6, 0.8], [3.3, 0.8], [3.3, 2.0]]), [], 1.25, 1.75)],
      views: {
        front: { W: 4, H: 4.2, it: [{ p: [[0, 0], [4, 0], [4, 4.2], [3.3, 4.2], [3.3, 0.8], [0, 0.8]], z: 1, k: 'v' }, L(1.6, 0.8, 3.3, 2.0), L(0.5, 0, 0.5, 0.8, 'h'), L(1.1, 0, 1.1, 0.8, 'h'), L(3.3, 2.1, 4, 2.1, 'h'), L(3.3, 3.4, 4, 3.4, 'h'), L(0.8, -0.35, 0.8, 1.15, 'c'), L(2.95, 2.75, 4.35, 2.75, 'c')] },
        top: { W: 4, H: 3, it: [{ p: [[1, 0], [4, 0], [4, 3], [1, 3]], k: 'v' }, { a: [1, 2, 1, 90, 180], k: 'v' }, L(0, 2, 0, 1), { a: [1, 1, 1, 180, 270], k: 'v' }, L(3.3, 0, 3.3, 3), L(1.6, 1.25, 3.3, 1.25), L(1.6, 1.75, 3.3, 1.75), L(1.6, 1.25, 1.6, 1.75), { c: [0.8, 0.85, 0.3], k: 'v' }, { c: [0.8, 2.15, 0.3], k: 'v' }, L(0.8, 0.3, 0.8, 2.7, 'c'), L(0.3, 0.85, 1.3, 0.85, 'c'), L(0.3, 2.15, 1.3, 2.15, 'c')] },
        side: { W: 3, H: 4.2, it: [{ p: [[0, 2.7], [0, 0], [3, 0], [3, 2.7]], k: 'v' }, { a: [1.5, 2.7, 1.5, 0, 180], k: 'v' }, L(0, 0.8, 3, 0.8), { c: [1.5, 2.75, 0.65], k: 'v' }, { p: [[1.25, 0.8], [1.25, 2.0], [1.75, 2.0], [1.75, 0.8]], k: 'v' }, L(0.55, 0, 0.55, 0.8, 'h'), L(1.15, 0, 1.15, 0.8, 'h'), L(1.85, 0, 1.85, 0.8, 'h'), L(2.45, 0, 2.45, 0.8, 'h'), L(1.5, -0.35, 1.5, 3.6, 'c'), L(0.65, 2.75, 2.35, 2.75, 'c'), L(0.85, -0.35, 0.85, 1.15, 'c'), L(2.15, -0.35, 2.15, 1.15, 'c')] },
        right: { W: 3, H: 4.2, it: [{ p: [[0, 2.7], [0, 0], [3, 0], [3, 2.7]], k: 'v' }, { a: [1.5, 2.7, 1.5, 0, 180], k: 'v' }, L(0, 0.8, 3, 0.8, 'h'), { c: [1.5, 2.75, 0.65], k: 'v' }, { p: [[1.25, 0.8], [1.25, 2.0], [1.75, 2.0], [1.75, 0.8]], k: 'h' }, L(0.55, 0, 0.55, 0.8, 'h'), L(1.15, 0, 1.15, 0.8, 'h'), L(1.85, 0, 1.85, 0.8, 'h'), L(2.45, 0, 2.45, 0.8, 'h'), L(1.5, -0.35, 1.5, 3.6, 'c'), L(0.65, 2.75, 2.35, 2.75, 'c')], why: 'Đây là hình nhìn từ phải: tấm đứng che mất gân và đế nên gân, đế vẽ nét đứt.' },
        top2: { W: 4, H: 3, it: [{ p: [[0, 0], [3, 0], [3, 3], [0, 3]], k: 'v' }, { a: [3, 2, 1, 0, 90], k: 'v' }, L(4, 2, 4, 1), { a: [3, 1, 1, 270, 360], k: 'v' }, L(0.7, 0, 0.7, 3), L(0.7, 1.25, 2.4, 1.25), L(0.7, 1.75, 2.4, 1.75), L(2.4, 1.25, 2.4, 1.75), { c: [3.2, 0.85, 0.3], k: 'v' }, { c: [3.2, 2.15, 0.3], k: 'v' }, L(3.2, 0.3, 3.2, 2.7, 'c')], why: 'Hình này bị lật ngược trái – phải so với hình chiếu bằng.' }
      }, dis: ['right', 'top2'] },
    { id: 'uchu', ten: 'Gối đỡ chữ U', W: 4, D: 2, H: 3,
      faces: () => extrude('y', xz([[0, 0], [4, 0], [4, 3], [2.8, 3], [2.8, 1.4], [1.2, 1.4], [1.2, 3], [0, 3]]), [], 0, 2),
      views: {
        front: { W: 4, H: 3, it: [{ p: [[0, 0], [4, 0], [4, 3], [2.8, 3], [2.8, 1.4], [1.2, 1.4], [1.2, 3], [0, 3]], z: 1, k: 'v' }] },
        top: { W: 4, H: 2, it: [{ p: [[0, 0], [4, 0], [4, 2], [0, 2]], z: 1, k: 'v' }, L(1.2, 0, 1.2, 2), L(2.8, 0, 2.8, 2)] },
        side: { W: 2, H: 3, it: [{ p: [[0, 0], [2, 0], [2, 3], [0, 3]], z: 1, k: 'v' }, L(0, 1.4, 2, 1.4, 'h')] },
        sideX: { W: 2, H: 3, it: [{ p: [[0, 0], [2, 0], [2, 3], [0, 3]], z: 1, k: 'v' }, L(0, 1.4, 2, 1.4)], why: 'Đáy rãnh bị che khi nhìn từ trái nên phải vẽ nét đứt, không phải nét liền.' },
        topX: { W: 4, H: 2, it: [{ p: [[0, 0], [4, 0], [4, 2], [0, 2]], z: 1, k: 'v' }, L(1.2, 0, 1.2, 2, 'h'), L(2.8, 0, 2.8, 2, 'h')], why: 'Nhìn từ trên thấy rõ hai thành rãnh nên phải vẽ nét liền.' }
      }, dis: ['sideX', 'topX'] },
    { id: 'lco', ten: 'Khối chữ L có lỗ', W: 4, D: 3, H: 3.5,
      faces: () => [...extrude('z', [[0, 0], [4, 0], [4, 3], [0, 3]], [circ(2.6, 1.5, 0.5, 24)], 0, 1), ...box(0, 1, 0, 3, 1, 3.5)],
      views: {
        front: { W: 4, H: 3.5, it: [{ p: [[0, 0], [4, 0], [4, 1], [1, 1], [1, 3.5], [0, 3.5]], z: 1, k: 'v' }, L(2.1, 0, 2.1, 1, 'h'), L(3.1, 0, 3.1, 1, 'h'), L(2.6, -0.35, 2.6, 1.35, 'c')] },
        top: { W: 4, H: 3, it: [{ p: [[0, 0], [4, 0], [4, 3], [0, 3]], z: 1, k: 'v' }, L(1, 0, 1, 3), { c: [2.6, 1.5, 0.5], k: 'v' }, L(2.6, 0.75, 2.6, 2.25, 'c'), L(1.85, 1.5, 3.35, 1.5, 'c')] },
        side: { W: 3, H: 3.5, it: [{ p: [[0, 0], [3, 0], [3, 3.5], [0, 3.5]], z: 1, k: 'v' }, L(0, 1, 3, 1, 'h'), L(1, 0, 1, 1, 'h'), L(2, 0, 2, 1, 'h'), L(1.5, -0.35, 1.5, 1.35, 'c')] },
        right: { W: 3, H: 3.5, it: [{ p: [[0, 0], [3, 0], [3, 3.5], [0, 3.5]], z: 1, k: 'v' }, L(0, 1, 3, 1), L(1, 0, 1, 1, 'h'), L(2, 0, 2, 1, 'h'), L(1.5, -0.35, 1.5, 1.35, 'c')], why: 'Đây là hình nhìn từ phải: mặt trên của đế ở gần nên thấy rõ (nét liền).' },
        back: { W: 4, H: 3.5, it: [{ p: [[0, 0], [4, 0], [4, 3.5], [3, 3.5], [3, 1], [0, 1]], z: 1, k: 'v' }, L(0.9, 0, 0.9, 1, 'h'), L(1.9, 0, 1.9, 1, 'h'), L(1.4, -0.35, 1.4, 1.35, 'c')], why: 'Đây là hình nhìn từ phía sau (tấm đứng nằm bên phải).' }
      }, dis: ['right', 'back'] },
    /* ---- theo SGK Công nghệ 10 ---- */
    { id: 'chuL91', ten: 'Khối chữ L có hai lỗ (SGK H.9.1)', W: 5, D: 4, H: 6,
      faces: () => [...extrude('x', [[0, 0], [4, 0], [4, 6], [0, 6]], [circ(2, 4, 0.75, 24)], 0, 1.5), ...extrude('z', [[1.5, 0], [5, 0], [5, 4], [1.5, 4]], [circ(3.25, 2, 1, 28)], 0, 2)],
      views: {
        front: { W: 5, H: 6, it: [{ p: [[0, 0], [5, 0], [5, 2], [1.5, 2], [1.5, 6], [0, 6]], z: 1, k: 'v' }, L(2.25, 0, 2.25, 2, 'h'), L(4.25, 0, 4.25, 2, 'h'), L(0, 3.25, 1.5, 3.25, 'h'), L(0, 4.75, 1.5, 4.75, 'h'), L(3.25, -0.35, 3.25, 2.35, 'c'), L(-0.35, 4, 1.85, 4, 'c')] },
        top: { W: 5, H: 4, it: [{ p: [[0, 0], [5, 0], [5, 4], [0, 4]], z: 1, k: 'v' }, L(1.5, 0, 1.5, 4), { c: [3.25, 2, 1], k: 'v' }, L(0, 1.25, 1.5, 1.25, 'h'), L(0, 2.75, 1.5, 2.75, 'h'), L(3.25, 0.65, 3.25, 3.35, 'c'), L(-0.35, 2, 4.6, 2, 'c')] },
        side: { W: 4, H: 6, it: [{ p: [[0, 0], [4, 0], [4, 6], [0, 6]], z: 1, k: 'v' }, { c: [2, 4, 0.75], k: 'v' }, L(0, 2, 4, 2, 'h'), L(1, 0, 1, 2, 'h'), L(3, 0, 3, 2, 'h'), L(2, -0.35, 2, 5.1, 'c'), L(0.9, 4, 3.1, 4, 'c')] },
        right: { W: 4, H: 6, it: [{ p: [[0, 0], [4, 0], [4, 6], [0, 6]], z: 1, k: 'v' }, L(0, 2, 4, 2), { c: [2, 4, 0.75], k: 'v' }, L(1, 0, 1, 2, 'h'), L(3, 0, 3, 2, 'h'), L(2, -0.35, 2, 5.1, 'c')], why: 'Đây là hình nhìn từ phải: mặt trên của đế ở gần nên thấy rõ (nét liền).' },
        topX: { W: 5, H: 4, it: [{ p: [[0, 0], [5, 0], [5, 4], [0, 4]], z: 1, k: 'v' }, L(1.5, 0, 1.5, 4), { c: [3.25, 2, 1], k: 'v' }, L(0, 1.25, 1.5, 1.25), L(0, 2.75, 1.5, 2.75), L(3.25, 0.65, 3.25, 3.35, 'c')], why: 'Lỗ trên tấm đứng bị che khi nhìn từ trên nên phải vẽ nét đứt.' }
      }, dis: ['right', 'topX'] },
    { id: 'giado910', ten: 'Giá đỡ (SGK H.9.10)', W: 7.8, D: 3.6, H: 6.6,
      faces: () => [...extrude('z', [[0, 0], [6, 0], [6, 3.6], [0, 3.6], [0, 2.4], [1.8, 2.4], [1.8, 1.2], [0, 1.2]], [], 0, 2.4), ...extrude('x', [[0, 0], [3.6, 0], [3.6, 6.6], [0, 6.6]], [circ(1.8, 4.5, 1.2, 28)], 6, 7.8)],
      views: {
        front: { W: 7.8, H: 6.6, it: [{ p: [[0, 0], [7.8, 0], [7.8, 6.6], [6, 6.6], [6, 2.4], [0, 2.4]], z: 1, k: 'v' }, L(1.8, 0, 1.8, 2.4, 'h'), L(6, 3.3, 7.8, 3.3, 'h'), L(6, 5.7, 7.8, 5.7, 'h'), L(5.6, 4.5, 8.2, 4.5, 'c')] },
        top: { W: 7.8, H: 3.6, it: [{ p: [[0, 0], [7.8, 0], [7.8, 3.6], [0, 3.6]], z: 1, k: 'v' }, { p: [[0, 1.2], [1.8, 1.2], [1.8, 2.4], [0, 2.4]], k: 'v' }, L(6, 0, 6, 3.6), L(6, 0.6, 7.8, 0.6, 'h'), L(6, 3, 7.8, 3, 'h'), L(5.6, 1.8, 8.2, 1.8, 'c')] },
        side: { W: 3.6, H: 6.6, it: [{ p: [[0, 0], [3.6, 0], [3.6, 6.6], [0, 6.6]], z: 1, k: 'v' }, L(0, 2.4, 3.6, 2.4), L(1.2, 0, 1.2, 2.4), L(2.4, 0, 2.4, 2.4), { c: [1.8, 4.5, 1.2], k: 'v' }, L(1.8, 2.95, 1.8, 6.05, 'c'), L(0.25, 4.5, 3.35, 4.5, 'c')] },
        right: { W: 3.6, H: 6.6, it: [{ p: [[0, 0], [3.6, 0], [3.6, 6.6], [0, 6.6]], z: 1, k: 'v' }, L(0, 2.4, 3.6, 2.4, 'h'), L(1.2, 0, 1.2, 2.4, 'h'), L(2.4, 0, 2.4, 2.4, 'h'), { c: [1.8, 4.5, 1.2], k: 'v' }, L(1.8, 2.95, 1.8, 6.05, 'c')], why: 'Đây là hình nhìn từ phải: tấm đứng che hết phần đế nên đế và rãnh phải vẽ nét đứt.' },
        topX: { W: 7.8, H: 3.6, it: [{ p: [[0, 0], [7.8, 0], [7.8, 3.6], [0, 3.6]], z: 1, k: 'v' }, { p: [[0, 1.2], [1.8, 1.2], [1.8, 2.4], [0, 2.4]], k: 'h' }, L(6, 0, 6, 3.6), L(6, 0.6, 7.8, 0.6, 'h'), L(6, 3, 7.8, 3, 'h')], why: 'Nhìn từ trên thấy rõ rãnh ở đầu đế nên phải vẽ nét liền.' }
      }, dis: ['right', 'topX'] },
    { id: 'vat1114', ten: 'Khối hộp vát góc có lỗ (SGK H.11.14)', W: 5, D: 2.4, H: 3.2,
      faces: () => extrude('y', xz([[0, 0], [5, 0], [5, 3.2], [1.4, 3.2], [0, 2]]), [xz(circ(2.9, 1.6, 0.8, 28))], 0, 2.4),
      views: {
        front: { W: 5, H: 3.2, it: [{ p: [[0, 0], [5, 0], [5, 3.2], [1.4, 3.2], [0, 2]], z: 1, k: 'v' }, { c: [2.9, 1.6, 0.8], k: 'v' }, L(2.9, 0.45, 2.9, 2.75, 'c'), L(1.75, 1.6, 4.05, 1.6, 'c')] },
        top: { W: 5, H: 2.4, it: [{ p: [[0, 0], [5, 0], [5, 2.4], [0, 2.4]], z: 1, k: 'v' }, L(1.4, 0, 1.4, 2.4), L(2.1, 0, 2.1, 2.4, 'h'), L(3.7, 0, 3.7, 2.4, 'h'), L(2.9, -0.35, 2.9, 2.75, 'c')] },
        side: { W: 2.4, H: 3.2, it: [{ p: [[0, 0], [2.4, 0], [2.4, 3.2], [0, 3.2]], z: 1, k: 'v' }, L(0, 2, 2.4, 2), L(0, 0.8, 2.4, 0.8, 'h'), L(0, 2.4, 2.4, 2.4, 'h'), L(-0.35, 1.6, 2.75, 1.6, 'c')] },
        right: { W: 2.4, H: 3.2, it: [{ p: [[0, 0], [2.4, 0], [2.4, 3.2], [0, 3.2]], z: 1, k: 'v' }, L(0, 0.8, 2.4, 0.8, 'h'), L(0, 2.4, 2.4, 2.4, 'h'), L(-0.35, 1.6, 2.75, 1.6, 'c')], why: 'Đây là hình nhìn từ phải: mặt vát ở phía trái nên không thấy cạnh vát.' },
        topX: { W: 5, H: 2.4, it: [{ p: [[0, 0], [5, 0], [5, 2.4], [0, 2.4]], z: 1, k: 'v' }, L(1.4, 0, 1.4, 2.4), L(2.1, 0, 2.1, 2.4), L(3.7, 0, 3.7, 2.4)], why: 'Lỗ trụ nằm bên trong, nhìn từ trên bị che nên phải vẽ nét đứt.' }
      }, dis: ['right', 'topX'] }
  ];
  OBJ.forEach(o => { o.F = prep(o.faces()); });
  /* ---------- vẽ hình chiếu (SVG) ---------- */
  let hpN = 0;
  const ST = { n: 'stroke="#0f172a" stroke-width="1.2"', m: 'stroke="#0f172a" stroke-width="4.2"', v: 'stroke="#0f172a" stroke-width="2.8"', h: 'stroke="#0f172a" stroke-width="1.6" stroke-dasharray="6 4"', c: 'stroke="#dc2626" stroke-width="1.1" stroke-dasharray="12 3 2 3"' };
  function svg(v, cell = 34, o = {}) {
    const u0 = v.u0 || 0, v0 = v.v0 || 0, pad = cell * 0.55, W = v.W * cell + pad * 2, H = v.H * cell + pad * 2, X = u => pad + (u - u0) * cell, Y = w => pad + (v0 + v.H - w) * cell;
    const hp = 'hp' + (++hpN);
    const el = it => {
      if (it.f) return `<path d="${it.f.map(L => 'M' + L.map(q => X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1)).join(' L') + 'Z').join(' ')}" fill="url(#${hp})" fill-rule="evenodd" stroke="none"/>`;
      if (it.tx) return `<text x="${X(it.tx[0]).toFixed(1)}" y="${Y(it.tx[1]).toFixed(1)}" font-size="${(it.fs || 0.42) * cell}" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="#0f172a" font-family="system-ui,sans-serif">${it.tx[2]}</text>`;
      if (it.ar) { const [x, y, dx, dy] = it.ar, x1 = X(x), y1 = Y(y), x2 = X(x + dx), y2 = Y(y + dy), an = Math.atan2(y2 - y1, x2 - x1), h = cell * 0.28;
        return `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#0f172a" stroke-width="1.4"/><path d="M${x2} ${y2} L${x2 - h * Math.cos(an - 0.4)} ${y2 - h * Math.sin(an - 0.4)} L${x2 - h * Math.cos(an + 0.4)} ${y2 - h * Math.sin(an + 0.4)}Z" fill="#0f172a"/>`; }
      const st = ST[it.k] + ' fill="none" stroke-linecap="round" stroke-linejoin="round"';
      if (it.p) return `<path d="M${it.p.map(q => X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1)).join(' L')}${it.z ? 'Z' : ''}" ${st}/>`;
      if (it.c) return `<circle cx="${X(it.c[0])}" cy="${Y(it.c[1])}" r="${it.c[2] * cell}" ${st}/>`;
      const [cx, cy, r, a0, a1] = it.a, P = a => [X(cx + r * Math.cos(a * Math.PI / 180)), Y(cy + r * Math.sin(a * Math.PI / 180))], [x0, y0] = P(a0), [x1, y1] = P(a1);
      return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r * cell} ${r * cell} 0 ${a1 - a0 > 180 ? 1 : 0} 0 ${x1.toFixed(1)} ${y1.toFixed(1)}" ${st}/>`;
    };
    return `<svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}" style="max-width:100%;height:auto;background:#fff;border-radius:8px" role="img" aria-label="Hình chiếu"><defs><pattern id="${hp}" patternUnits="userSpaceOnUse" width="${(cell * 0.22).toFixed(1)}" height="${(cell * 0.22).toFixed(1)}" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${(cell * 0.22).toFixed(1)}" stroke="#334155" stroke-width="1.1"/></pattern></defs>${v.it.filter(i => i.f).map(el).join('')}${v.it.filter(i => !i.f).map(el).join('')}</svg>`;
  }
  /** đổi item hình chiếu thành các đoạn thẳng (để vẽ lên mặt phẳng 3D) */
  function segs(v) {
    const out = [];
    v.it.forEach(it => {
      if (it.f || it.tx || it.ar) return;
      let P = it.p ? it.p.slice() : it.c ? Array.from({ length: 33 }, (_, i) => [it.c[0] + it.c[2] * Math.cos(i / 32 * 2 * Math.PI), it.c[1] + it.c[2] * Math.sin(i / 32 * 2 * Math.PI)])
        : Array.from({ length: 17 }, (_, i) => { const a = (it.a[3] + (it.a[4] - it.a[3]) * i / 16) * Math.PI / 180; return [it.a[0] + it.a[2] * Math.cos(a), it.a[1] + it.a[2] * Math.sin(a)]; });
      if (it.z) P.push(P[0]);
      for (let i = 0; i < P.length - 1; i++) out.push({ a: P[i], b: P[i + 1], k: it.k });
    });
    return out;
  }
  return { OBJ, svg, segs, G: { extrude, box, prep, circ, arcPts, xz } };
})();

/* ---------- cảnh 3D: vật thể, 3 mặt phẳng chiếu, chiếu và lật mặt phẳng ---------- */
function HCScene(canvas, opt) {
  const ctx = canvas.getContext('2d');
  const st = { yaw: 0.62, pitch: 0.42, zoom: 1, t: 0, show: opt.show || 'object' };   // show: object | planes | project | unfold
  let O = opt.obj, m = opt.m || 1, fitR = 1, fitC = [0, 0, 0], fitB = null, fitP = [], raf = 0, zb = null;
  const g = 1.4;
  const COL = { front: '#e53935', top: '#1e63d6', side: '#c026d3' };
  const geo = () => {
    const { W, D, H } = O;
    if (m === 1) return {
      planes: { front: { c: [[-g, D + g, -g], [W + g, D + g, -g], [W + g, D + g, H + g], [-g, D + g, H + g]] }, top: { c: [[-g, -g, -g], [W + g, -g, -g], [W + g, D + g, -g], [-g, D + g, -g]], piv: [0, D + g, -g], ax: 'x' }, side: { c: [[W + g, -g, -g], [W + g, D + g, -g], [W + g, D + g, H + g], [W + g, -g, H + g]], piv: [W + g, D + g, 0], ax: 'z' } },
      map: { front: (u, v) => [u, D + g, v], top: (u, v) => [u, v, -g], side: (u, v) => [W + g, D - u, v] } };
    return {
      planes: { front: { c: [[-g, -g, -g], [W + g, -g, -g], [W + g, -g, H + g], [-g, -g, H + g]] }, top: { c: [[-g, -g, H + g], [W + g, -g, H + g], [W + g, D + g, H + g], [-g, D + g, H + g]], piv: [0, -g, H + g], ax: 'x' }, side: { c: [[-g, -g, -g], [-g, D + g, -g], [-g, D + g, H + g], [-g, -g, H + g]], piv: [-g, -g, 0], ax: 'z' } },
      map: { front: (u, v) => [u, -g, v], top: (u, v) => [u, v, H + g], side: (u, v) => [-g, D - u, v] } };
  };
  let G = geo();
  const turn = (p, k, t) => {        // lật mặt phẳng k quanh bản lề một góc t·90°
    const pl = G.planes[k]; if (!pl.piv || !t) return p;
    const th = t * Math.PI / 2, c = Math.cos(th), s = Math.sin(th), r = sub3(p, pl.piv);
    const q = pl.ax === 'x' ? [r[0], r[1] * c - r[2] * s, r[1] * s + r[2] * c] : [r[0] * c - r[1] * s, r[0] * s + r[1] * c, r[2]];
    return [q[0] + pl.piv[0], q[1] + pl.piv[1], q[2] + pl.piv[2]];
  };
  function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  const refit = () => {
    const pts = [], fl = [];
    ['front', 'top', 'side'].forEach(k => G.planes[k].c.forEach(p => { pts.push(p); fl.push(turn(p, k, 1)); }));
    const mn = [0, 1, 2].map(i => Math.min(...pts.map(p => p[i]))), mx = [0, 1, 2].map(i => Math.max(...pts.map(p => p[i])));
    fitC = mn.map((v, i) => (v + mx[i]) / 2); fitR = Math.max(...pts.map(p => Math.hypot(p[0] - fitC[0], p[1] - fitC[1], p[2] - fitC[2])));
    const x0 = Math.min(...fl.map(p => p[0])), x1 = Math.max(...fl.map(p => p[0])), z0 = Math.min(...fl.map(p => p[2])), z1 = Math.max(...fl.map(p => p[2]));
    fitB = { c: [(x0 + x1) / 2, fl[0][1], (z0 + z1) / 2], w: x1 - x0, h: z1 - z0 };
    fitP = pts;
    if (st.show === 'object') { const { W, D, H } = O; fitC = [W / 2, D / 2, H / 2]; fitR = Math.hypot(W, D, H) * 0.62; fitP = [0, 1].flatMap(i => [0, 1].flatMap(j => [0, 1].map(l => [i * W, j * D, l * H]))).concat([[W * 0.5, -2.6, H * 0.45]]); }
  };
  let cC = fitC;
  const rot = p => {
    let [x, y, z] = [p[0] - cC[0], p[1] - cC[1], p[2] - cC[2]];
    const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw); [x, y] = [x * cy - y * sy, x * sy + y * cy];
    const cp = Math.cos(st.pitch), sp = Math.sin(st.pitch); [y, z] = [y * cp - z * sp, y * sp + z * cp];
    return [x, y, z];
  };
  const draw = () => {
    const Wc = canvas.width, Hc = canvas.height, dp = window.devicePixelRatio || 1;
    // tỉ lệ vừa khung, tính ở góc nhìn trục đo mặc định (không đổi khi xoay)
    const cy_ = Math.cos(0.62), sy_ = Math.sin(0.62), cp_ = Math.cos(0.42), sp_ = Math.sin(0.42);
    let ex = 0.1, ez = 0.1;
    fitP.forEach(p => { const x = p[0] - fitC[0], y = p[1] - fitC[1], z = p[2] - fitC[2], X = x * cy_ - y * sy_, Y = x * sy_ + y * cy_, Z = Y * sp_ + z * cp_; ex = Math.max(ex, Math.abs(X)); ez = Math.max(ez, Math.abs(Z)); });
    const kA = Math.min(Wc / (ex * 2.25), (Hc - 30 * dp) / (ez * 2.25));
    let k = kA; cC = fitC;
    if (st.show === 'unfold' && fitB) { const e = st.t * st.t * (3 - 2 * st.t), kB = Math.min(Wc / (fitB.w * 1.12), Hc / (fitB.h * 1.18 + 1.2)); k = kA + (kB - kA) * e; cC = fitC.map((v, i) => v + (fitB.c[i] - v) * e); }
    k *= st.zoom;
    const P = p => { const r = rot(p); return [Wc / 2 + r[0] * k, Hc / 2 - r[2] * k, r[1]]; };
    ctx.clearRect(0, 0, Wc, Hc);
    const poly = (loops, fill, alpha, stroke, lw) => { ctx.beginPath(); loops.forEach(L => { L.forEach((p, i) => { const q = P(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); }); if (fill) { ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fill('evenodd'); ctx.globalAlpha = 1; } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw * dp; ctx.stroke(); } };
    const line = (a, b, col, lw, dash, alpha = 1) => { const A = P(a), B = P(b); ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = lw * dp; ctx.setLineDash(dash ? dash.map(v => v * dp) : []); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; };
    const t = st.t, showPl = st.show !== 'object', showV = st.show === 'project' || st.show === 'unfold';
    const objA = st.show === 'unfold' ? Math.max(0, 1 - t * 1.6) : 1;
    const drawPlanes = () => {
      const ks = ['front', 'top', 'side'].map(kk => ({ kk, d: G.planes[kk].c.map(p => P(turn(p, kk, t))[2]).reduce((a, b) => a + b, 0) / 4 })).sort((a, b) => b.d - a.d);
      ks.forEach(({ kk }) => {
        const C = G.planes[kk].c.map(p => turn(p, kk, t));
        poly([C], COL[kk], m === 3 && t < 0.98 ? 0.10 : 0.13, COL[kk], 2.6);
        if (showV) HC.segs(O.views[kk]).forEach(sg => { const mp = G.map[kk]; line(turn(mp(...sg.a), kk, t), turn(mp(...sg.b), kk, t), sg.k === 'c' ? '#dc2626' : '#0f172a', sg.k === 'v' ? 2.6 : sg.k === 'h' ? 1.5 : 1, sg.k === 'h' ? [5, 3.5] : sg.k === 'c' ? [10, 3, 2, 3] : null); });
      });
    };
    const drawObj = () => {
      if (objA <= 0) return;
      const V = [Math.sin(st.yaw) * Math.cos(st.pitch), Math.cos(st.yaw) * Math.cos(st.pitch), -Math.sin(st.pitch)];
      hcPaint(ctx, Wc | 0, Hc | 0, O.F, P, V, dp, { alpha: objA, k });
    };
    const drawRays = () => {
      if (st.show !== 'project' && !(st.show === 'unfold' && t < 0.05)) return;
      const { W, D, H } = O, cs = [[0, 0, 0], [W, 0, 0], [0, 0, H], [W, 0, H], [0, D, H], [W, D, H]];
      cs.forEach(p => {
        line(p, G.map.front(p[0], p[2]), '#64748b', 1, [1.5, 4]);
        line(p, G.map.top(p[0], p[1]), '#64748b', 1, [1.5, 4]);
        line(p, G.map.side(D - p[1], p[2]), '#64748b', 1, [1.5, 4]);
      });
    };
    const arrow = (a, b, col, label) => {
      const A = P(a), B = P(b), ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3 * dp; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(B[0], B[1]); ctx.lineTo(B[0] - 12 * dp * Math.cos(ang - 0.45), B[1] - 12 * dp * Math.sin(ang - 0.45)); ctx.lineTo(B[0] - 12 * dp * Math.cos(ang + 0.45), B[1] - 12 * dp * Math.sin(ang + 0.45)); ctx.fill();
      if (label) { ctx.font = `700 ${Math.round(12 * dp)}px system-ui,sans-serif`; ctx.fillText(label, A[0] + 4 * dp, A[1] - 6 * dp); }
    };
    const labels = () => {
      ctx.font = `700 ${Math.round(12.5 * dp)}px system-ui,sans-serif`; ctx.textAlign = 'center';
      const NAME = t > 0.95 ? { front: 'Hình chiếu đứng', top: 'Hình chiếu bằng', side: 'Hình chiếu cạnh' } : { front: 'MP chiếu đứng', top: 'MP chiếu bằng', side: 'MP chiếu cạnh' };
      const PL = ['front', 'top', 'side'].map(kk => { const C = G.planes[kk].c.map(p => turn(p, kk, t)).map(P); return { kk, C, c: [C.reduce((a, b) => a + b[0], 0) / 4, C.reduce((a, b) => a + b[1], 0) / 4] }; });
      const sc0 = [PL.reduce((a, b) => a + b.c[0], 0) / 3, PL.reduce((a, b) => a + b.c[1], 0) / 3];
      PL.forEach(({ kk, C, c }) => {
        const far = C.reduce((a, b) => Math.hypot(b[0] - sc0[0], b[1] - sc0[1]) > Math.hypot(a[0] - sc0[0], a[1] - sc0[1]) ? b : a);
        const tw = ctx.measureText(NAME[kk]).width + 14 * dp;
        let x = c[0] + (far[0] - c[0]) * 0.62, y = c[1] + (far[1] - c[1]) * 0.78 + 5 * dp;
        x = Math.max(tw / 2 + 4, Math.min(Wc - tw / 2 - 4, x)); y = Math.max(18 * dp, Math.min(Hc - 6 * dp, y));
        ctx.globalAlpha = 0.95; ctx.fillStyle = COL[kk]; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - tw / 2, y - 15 * dp, tw, 20 * dp, 10 * dp) : ctx.rect(x - tw / 2, y - 15 * dp, tw, 20 * dp); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff'; ctx.fillText(NAME[kk], x, y);
      });
      ctx.textAlign = 'left';
    };
    if (showPl && m === 1) drawPlanes();
    if (showPl) drawRays();
    drawObj();
    if (st.show === 'object' || (showPl && t < 0.05)) { const { W, D, H } = O; arrow([W * 0.5, -2.6, H * 0.45], [W * 0.5, -0.4, H * 0.45], '#e89a2c', st.show === 'object' ? 'Hướng chiếu từ trước' : ''); }
    if (showPl && m === 3) drawPlanes();
    if (showPl) labels();
  };
  const fit = () => { const r = canvas.getBoundingClientRect(), d = window.devicePixelRatio || 1; canvas.width = Math.max(200, r.width * d); canvas.height = Math.max(200, r.height * d); draw(); };
  let drag = null; const pts = new Map();
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); drag = { x: e.clientX, y: e.clientY, d: null }; cancelAnimationFrame(raf); });
  canvas.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [p, q] = [...pts.values()], d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (drag.d) st.zoom = Math.max(0.5, Math.min(3, st.zoom * d / drag.d)); drag.d = d; draw(); return; }
    st.yaw += (e.clientX - drag.x) * 0.01; st.pitch = Math.max(-1.55, Math.min(1.55, st.pitch + (e.clientY - drag.y) * 0.01)); drag.x = e.clientX; drag.y = e.clientY; draw();
  });
  const up = e => { pts.delete(e.pointerId); if (!pts.size) drag = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); st.zoom = Math.max(0.5, Math.min(3, st.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); draw(); }, { passive: false });
  const anim = (to, ms, done) => {
    cancelAnimationFrame(raf);
    const from = { yaw: st.yaw, pitch: st.pitch, t: st.t }, t0 = performance.now();
    let dy = (to.yaw ?? from.yaw) - from.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const step = now => { const k = Math.min(1, (now - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      st.yaw = from.yaw + dy * e; if (to.pitch != null) st.pitch = from.pitch + (to.pitch - from.pitch) * e; if (to.t != null) st.t = from.t + (to.t - from.t) * e;
      if (opt.onT) opt.onT(st.t); draw(); if (k < 1) raf = requestAnimationFrame(step); else if (done) done(); };
    raf = requestAnimationFrame(step);
  };
  window.addEventListener('resize', fit);
  refit(); setTimeout(fit, 0);
  return {
    set(o) { if (o.obj) O = o.obj; if (o.m) m = o.m; if (o.show) st.show = o.show; if (o.t != null) st.t = o.t; G = geo(); refit(); draw(); },
    unfold(ms = 2600) { st.show = 'unfold'; refit(); anim({ t: 1, yaw: 0, pitch: 0 }, ms); },
    view(yaw, pitch) { anim({ yaw, pitch }, 600); },
    setT(t) { st.t = t; if (t > 0) st.show = 'unfold'; draw(); },
    iso() { anim({ yaw: 0.62, pitch: 0.42 }, 600); },
    destroy() { cancelAnimationFrame(raf); window.removeEventListener('resize', fit); }
  };
}

/** ô 3×3 đặt ba hình chiếu theo phương pháp m (1 hoặc 3) */
function hcLayoutHtml(O, m, o = {}) {
  const c = o.cell || 30, V = O.views, card = (k, t) => `<div class="hccell hc-${k}"><span class="hctag hc-${k}">${t}</span>${HC.svg(V[k], c)}</div>`;
  const F = card('front', 'Hình chiếu đứng'), T = card('top', 'Hình chiếu bằng'), S = card('side', 'Hình chiếu cạnh'), E = '<div></div>';
  return `<div class="hclayout m${m}">${m === 1 ? F + S + T + E : E + T + S + F}</div>`;
}

route(/^\/hcvg$/, params => {
  const OBJ = HC.OBJ;
  let tab = (params && params.get('tab')) || 'g1', oi = 0, sc = null, step = 'object';
  let qs = [], qi = 0, qm = 1, slots = {}, held = null, done = false, score = 0, cards = [];
  const TABS = [['g1', '① Góc chiếu thứ nhất'], ['g3', '② Góc chiếu thứ ba'], ['ss', '③ So sánh'], ['lt', '④ Luyện tập']];
  const head = () => `<a href="#/onluyen">← Ôn luyện</a>${k10nav('#/hcvg')}<h1>📁 Khối 10 · Hình chiếu vuông góc</h1>
    <p class="sub">Công nghệ 10 – Bài 9. Xây dựng ba hình chiếu bằng phương pháp chiếu góc thứ nhất và góc thứ ba, so sánh cách bố trí, rồi tự tìm hình chiếu cho các vật thể.</p>
    <div class="tabs hctabs">${TABS.map(([k, t]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const pickObj = () => `<div class="gcpick">${OBJ.map((o, i) => `<button class="${i === oi ? 'on' : ''}" data-o="${i}">Hình ${i + 1}. ${esc(o.ten)}</button>`).join('')}</div>`;
  const bindTop = () => {
    $$('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; step = 'object'; if (tab === 'lt') startLT(); else draw(); });
    $$('[data-o]').forEach(b => b.onclick = () => { oi = +b.dataset.o; step = 'object'; draw(); });
  };
  const kill = () => { if (sc) { sc.destroy(); sc = null; } };
  const draw = () => {
    kill();
    if (tab === 'ss') return drawSS();
    const m = tab === 'g1' ? 1 : 3, O = OBJ[oi];
    const STEPS = [['object', '1. Quan sát vật thể'], ['planes', '2. Đặt vào 3 mặt phẳng chiếu'], ['project', '3. Chiếu lên các mặt phẳng'], ['unfold', '4. Lật thành một mặt phẳng']];
    const txt = {
      object: 'Xoay vật thể (kéo chuột hoặc vuốt) để quan sát. Mũi tên cam là <b>hướng chiếu từ trước</b>.',
      planes: m === 1 ? 'Đặt vật thể vào góc tạo bởi 3 mặt phẳng vuông góc từng đôi: <b style="color:#e53935">mặt phẳng chiếu đứng</b> ở <b>phía sau</b>, <b style="color:#1e63d6">mặt phẳng chiếu bằng</b> ở <b>phía dưới</b>, <b style="color:#c026d3">mặt phẳng chiếu cạnh</b> ở <b>bên phải</b> vật thể. <b>Vật thể nằm giữa người quan sát và mặt phẳng chiếu.</b>'
        : 'Đặt 3 mặt phẳng chiếu <b>giữa người quan sát và vật thể</b>: <b style="color:#e53935">mặt phẳng chiếu đứng</b> ở <b>phía trước</b>, <b style="color:#1e63d6">mặt phẳng chiếu bằng</b> ở <b>phía trên</b>, <b style="color:#c026d3">mặt phẳng chiếu cạnh</b> ở <b>bên trái</b> vật thể (các mặt phẳng coi như trong suốt).',
      project: 'Chiếu vuông góc vật thể lên từng mặt phẳng: nhìn <b>từ trước</b> được hình chiếu đứng, nhìn <b>từ trên</b> được hình chiếu bằng, nhìn <b>từ trái</b> được hình chiếu cạnh. Cạnh thấy vẽ nét liền đậm, cạnh khuất vẽ nét đứt, đường tâm vẽ nét gạch chấm.',
      unfold: m === 1 ? 'Giữ nguyên mặt phẳng chiếu đứng; <b>lật mặt phẳng chiếu bằng xuống dưới</b> và <b>mặt phẳng chiếu cạnh sang phải</b> 90° cho trùng với mặt phẳng chiếu đứng. Kết quả: <b>hình chiếu bằng ở dưới</b>, <b>hình chiếu cạnh ở bên phải</b> hình chiếu đứng.'
        : 'Giữ nguyên mặt phẳng chiếu đứng; <b>lật mặt phẳng chiếu bằng lên trên</b> và <b>mặt phẳng chiếu cạnh sang trái</b> 90° cho trùng với mặt phẳng chiếu đứng. Kết quả: <b>hình chiếu bằng ở trên</b>, <b>hình chiếu cạnh ở bên trái</b> hình chiếu đứng.'
    };
    setView(`${head()}
      <div class="card"><b>Chọn vật thể</b>${pickObj()}</div>
      <div class="card"><div class="hcsteps">${STEPS.map(([k, t]) => `<button data-step="${k}" class="${step === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <canvas id="hc3d" class="hc3d"></canvas>
        <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center">
          ${step === 'unfold' ? `<label class="grow" style="display:flex;align-items:center;gap:8px;margin:0">Lật mặt phẳng <input id="tt" type="range" min="0" max="100" value="100" style="flex:1"></label><button class="btn ghost sm" id="replay">▶ Lật lại</button>` : '<span class="grow"></span>'}
          <button class="btn ghost sm" id="iso">Góc nhìn ban đầu</button><button class="btn ghost sm" id="fr">Nhìn thẳng từ trước</button>${isGV() ? '<button class="btn ghost sm" id="fs">🖥️ Toàn màn hình</button>' : ''}</div>
        <div class="expl" style="margin-top:10px"><b class="t">${STEPS.find(s => s[0] === step)[1]}</b>${txt[step]}</div>
        ${step !== 'unfold' ? `<button class="btn block" id="next" style="margin-top:8px">${step === 'object' ? 'Tiếp: Đặt vào 3 mặt phẳng →' : step === 'planes' ? 'Tiếp: Chiếu lên các mặt phẳng →' : 'Tiếp: Lật thành một mặt phẳng →'}</button>`
          : `<div style="margin-top:12px"><b>Bản vẽ ba hình chiếu sau khi lật (${m === 1 ? 'góc chiếu thứ nhất' : 'góc chiếu thứ ba'})</b>${hcLayoutHtml(O, m)}</div>
             <div class="row" style="margin-top:8px"><button class="btn" data-tab="${m === 1 ? 'g3' : 'ss'}">${m === 1 ? 'Tiếp: Phương pháp chiếu góc thứ ba →' : 'Tiếp: So sánh hai phương pháp →'}</button></div>`}
        ${O.anh ? `<details style="margin-top:10px"><summary>🖼️ Hình mẫu của thầy cô</summary><img class="gcbig" src="${O.anh}" alt="Hình mẫu" style="margin-top:8px"></details>` : ''}</div>`);
    bindTop();
    sc = HCScene($('#hc3d'), { obj: O, m, show: step === 'unfold' ? 'planes' : step, onT: t => { const r = $('#tt'); if (r) r.value = Math.round(t * 100); } });
    if (step === 'unfold') setTimeout(() => sc && sc.unfold(), 350);
    $$('[data-step]').forEach(b => b.onclick = () => { step = b.dataset.step; draw(); });
    if ($('#next')) $('#next').onclick = () => { step = step === 'object' ? 'planes' : step === 'planes' ? 'project' : 'unfold'; draw(); };
    if ($('#tt')) $('#tt').oninput = e => sc.setT(+e.target.value / 100);
    if ($('#replay')) $('#replay').onclick = () => { sc.set({ show: 'planes', t: 0 }); sc.iso(); setTimeout(() => sc.unfold(), 700); };
    $('#iso').onclick = () => sc.iso(); $('#fr').onclick = () => sc.view(0, 0);
    if ($('#fs')) $('#fs').onclick = () => { try { $('#hc3d').requestFullscreen(); } catch (e) {} };
  };
  /* ---- So sánh ---- */
  const drawSS = () => {
    const O = OBJ[oi];
    setView(`${head()}<div class="card"><b>Chọn vật thể</b>${pickObj()}</div>
      <div class="hccompare"><div class="card"><h3 style="margin-top:0;color:#0f766e">Phương pháp chiếu góc thứ nhất</h3>${hcLayoutHtml(O, 1, { cell: 26 })}</div>
        <div class="card"><h3 style="margin-top:0;color:#7c3aed">Phương pháp chiếu góc thứ ba</h3>${hcLayoutHtml(O, 3, { cell: 26 })}</div></div>
      <div class="card"><div class="tablewrap"><table><thead><tr><th></th><th>Góc chiếu thứ nhất</th><th>Góc chiếu thứ ba</th></tr></thead><tbody>
        <tr><td><b>Vị trí vật thể</b></td><td>Vật thể nằm <b>giữa</b> người quan sát và mặt phẳng chiếu</td><td>Mặt phẳng chiếu nằm <b>giữa</b> người quan sát và vật thể</td></tr>
        <tr><td><b>Mặt phẳng chiếu đứng</b></td><td>Phía sau vật thể</td><td>Phía trước vật thể</td></tr>
        <tr><td><b>Mặt phẳng chiếu bằng</b></td><td>Phía dưới vật thể → lật xuống</td><td>Phía trên vật thể → lật lên</td></tr>
        <tr><td><b>Mặt phẳng chiếu cạnh</b></td><td>Bên phải vật thể → lật sang phải</td><td>Bên trái vật thể → lật sang trái</td></tr>
        <tr><td><b>Hình chiếu bằng</b></td><td>Đặt <b>dưới</b> hình chiếu đứng</td><td>Đặt <b>trên</b> hình chiếu đứng</td></tr>
        <tr><td><b>Hình chiếu cạnh</b></td><td>Đặt bên <b>phải</b> hình chiếu đứng</td><td>Đặt bên <b>trái</b> hình chiếu đứng</td></tr>
        <tr><td><b>Giống nhau</b></td><td colspan="2">Ba hình chiếu giống hệt nhau (cùng nhìn từ trước, từ trên, từ trái); chỉ <b>khác vị trí đặt</b>. Các hình chiếu luôn dóng thẳng hàng; cạnh khuất vẽ nét đứt.</td></tr>
        <tr><td><b>Nơi sử dụng</b></td><td>Việt Nam (TCVN) và nhiều nước châu Âu</td><td>Mỹ và một số nước khác</td></tr></tbody></table></div>
        <p class="hint">Mẹo nhớ: <b>Góc thứ nhất</b> – hình nằm ở phía <b>đối diện</b> hướng nhìn (nhìn từ trên → vẽ ở dưới; nhìn từ trái → vẽ bên phải). <b>Góc thứ ba</b> – hình nằm ở <b>cùng phía</b> hướng nhìn (nhìn từ trên → vẽ ở trên; nhìn từ trái → vẽ bên trái).</p></div>
      <div class="card"><button class="btn block" data-tab="lt">Tiếp: Luyện tập tìm hình chiếu →</button></div>`);
    bindTop();
  };
  /* ---- Luyện tập: mỗi hình làm theo 2 phương pháp ---- */
  const startLT = () => { qs = []; OBJ.forEach((o, i) => { qs.push({ i, m: 1 }); qs.push({ i, m: 3 }); }); qi = 0; score = 0; newQ(); };
  const newQ = () => { const q = qs[qi], O = OBJ[q.i]; cards = shuffle(['top', 'side', ...O.dis]); slots = {}; held = null; done = false; drawLT(); };
  const drawLT = () => {
    kill();
    if (qi >= qs.length) {
      const hk = 'hist_' + uid(), hist = store.get(hk, []); hist.push({ t: Date.now(), title: 'Hình chiếu vuông góc – luyện tập', key: '', loai: 'game', diem: Math.round(score / qs.length * 1000) / 100, dung: score, tong: qs.length, giay: 0 }); store.set(hk, hist.slice(-300));
      setView(`${head()}<div class="hero"><h1>Hoàn thành! 🎉</h1><p class="sub">Em xếp đúng <b>${score}/${qs.length}</b> bản vẽ.</p></div><div class="row"><button class="btn" id="again">Làm lại</button></div>`);
      bindTop(); $('#again').onclick = startLT; return;
    }
    const q = qs[qi], O = OBJ[q.i], need = q.m === 1 ? { below: 'top', right: 'side' } : { above: 'top', left: 'side' };
    const slot = pos => { const id = slots[pos], st = done ? (need[pos] ? (id === need[pos] ? 'ok' : 'bad') : (id ? 'bad' : '')) : '';
      return `<button class="gcslot ${st} ${held ? 'can' : ''}" data-slot="${pos}">${id ? HC.svg(O.views[id], 22) : `<span class="hint">${{ above: 'Ô trên', below: 'Ô dưới', left: 'Ô trái', right: 'Ô phải' }[pos]}</span>`}</button>`; };
    setView(`${head()}
      <div class="qbar"><div class="title">Bài ${qi + 1}/${qs.length} · Hình ${q.i + 1}. ${esc(O.ten)}</div><span class="timer">✔ ${score}</span></div>
      <div class="qcard"><div class="stem">Quan sát vật thể rồi vẽ ba hình chiếu theo <b style="color:${q.m === 1 ? '#0f766e' : '#7c3aed'}">phương pháp chiếu góc thứ ${q.m === 1 ? 'nhất' : 'ba'}</b>: chọn đúng <b>hình chiếu bằng</b> và <b>hình chiếu cạnh</b> rồi đặt vào đúng ô quanh hình chiếu đứng. <span class="hint">Bấm chọn thẻ, rồi bấm vào ô. Có thẻ thừa gây nhiễu.</span></div>
        <div class="hcpractice"><div><canvas id="hc3d" class="hc3d" style="height:260px"></canvas><div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap"><button class="btn ghost sm" data-v="iso">Trục đo</button><button class="btn ghost sm" data-v="fr">Từ trước</button><button class="btn ghost sm" data-v="tp">Từ trên</button><button class="btn ghost sm" data-v="lf">Từ trái</button></div>
          ${O.anh ? `<details style="margin-top:6px"><summary>🖼️ Hình mẫu của thầy cô</summary><img class="gcbig" src="${O.anh}" alt="Hình mẫu"></details>` : ''}</div>
          <div><div class="gcgrid"><div></div>${slot('above')}<div></div>${slot('left')}<div class="gcfront">${HC.svg(O.views.front, 22)}<span>Hình chiếu đứng</span></div>${slot('right')}<div></div>${slot('below')}<div></div></div>
          <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap;margin-top:10px">${cards.filter(c => !Object.values(slots).includes(c)).map(c => `<button class="gccard ${held === c ? 'on' : ''}" data-card="${c}" ${done ? 'disabled' : ''}>${HC.svg(O.views[c], 18)}</button>`).join('') || '<span class="hint">Đã đặt hết thẻ</span>'}</div></div></div>
        ${done ? `<div class="expl ${q.ok ? 'ans' : ''}"><b class="t">${q.ok ? '✔ Chính xác!' : '✘ Chưa đúng.'}</b>Góc chiếu thứ ${q.m === 1 ? 'nhất' : 'ba'}: hình chiếu bằng đặt <b>${q.m === 1 ? 'dưới' : 'trên'}</b>, hình chiếu cạnh đặt bên <b>${q.m === 1 ? 'phải' : 'trái'}</b> hình chiếu đứng. <br><span class="hint">Thẻ thừa: ${O.dis.map(d => O.views[d].why).join(' ')}</span></div>
          <div style="margin-top:8px"><b>Đáp án</b>${hcLayoutHtml(O, q.m, { cell: 22 })}</div>
          <button class="btn block" id="nx" style="margin-top:10px">${qi < qs.length - 1 ? 'Bài tiếp →' : 'Xem kết quả'}</button>`
        : `<button class="btn block" id="ck" style="margin-top:12px" ${Object.keys(slots).length ? '' : 'disabled'}>Kiểm tra</button>`}</div>`);
    bindTop();
    sc = HCScene($('#hc3d'), { obj: O, m: q.m, show: 'object' });
    $$('[data-v]').forEach(b => b.onclick = () => ({ iso: () => sc.iso(), fr: () => sc.view(0, 0), tp: () => sc.view(0, 1.5707), lf: () => sc.view(Math.PI / 2, 0) })[b.dataset.v]());
    $$('[data-card]').forEach(b => b.onclick = () => { held = held === b.dataset.card ? null : b.dataset.card; drawLT(); });
    $$('[data-slot]').forEach(b => b.onclick = () => { if (done) return; const p = b.dataset.slot; if (held) { slots[p] = held; held = null; } else if (slots[p]) delete slots[p]; drawLT(); });
    if ($('#ck')) $('#ck').onclick = () => { q.ok = ['above', 'below', 'left', 'right'].every(p => (slots[p] || null) === (need[p] || null)); if (q.ok) score++; done = true; drawLT(); };
    if ($('#nx')) $('#nx').onclick = () => { qi++; if (qi < qs.length) newQ(); else drawLT(); };
  };
  cleanup = kill;
  if (tab === 'lt') startLT(); else draw();
});

/* ================= KHỐI 10 – BỘ VẼ 3D CHUNG (z-buffer) ================= */
/** vẽ các mặt bằng bộ đệm độ sâu rồi vẽ cạnh thấy và đường bao mặt cong.
 * P: điểm 3D → [x, y, độ sâu] (pixel); V: hướng nhìn (đơn vị); o: {alpha, k (pixel/đơn vị), color:[r,g,b]} */
function hcPaint(ctx, w, h, faces, P, V, dp, o = {}) {
  let B = hcPaint.buf;
  if (!B || B.w !== w || B.h !== h) B = hcPaint.buf = { w, h, img: ctx.createImageData(w, h), dep: new Float32Array(w * h), ids: new Int32Array(w * h), cv: Object.assign(document.createElement('canvas'), { width: w, height: h }) };
  const { img, dep, ids } = B, px = img.data; dep.fill(Infinity); px.fill(0); ids.fill(0);
  const Lt = [0.35, -0.6, 0.72], ln = Math.hypot(...Lt), base = o.color || [1, 0.85, 0.52];
  const hs = Math.max(6, Math.round(7 * dp)), hw = Math.max(1, Math.round(1.3 * dp));
  const front = o.front || (f => f.n[0] * V[0] + f.n[1] * V[1] + f.n[2] * V[2] < -1e-3);
  const vis = [];
  faces.forEach((f, fi) => {
    if (!front(f)) return;
    const loops = f.loops.map(L => L.map(P)), Q = loops[0];
    let best = 0, i1 = 1, i2 = 2;
    for (let i = 1; i < Q.length; i++) for (let j = i + 1; j < Q.length; j++) { const ar = Math.abs((Q[i][0] - Q[0][0]) * (Q[j][1] - Q[0][1]) - (Q[j][0] - Q[0][0]) * (Q[i][1] - Q[0][1])); if (ar > best) { best = ar; i1 = i; i2 = j; } }
    if (best < 1e-6) return;
    const A = Q[0], Bq = Q[i1], C = Q[i2], bx = Bq[0] - A[0], by = Bq[1] - A[1], cx = C[0] - A[0], cy = C[1] - A[1], det = bx * cy - cx * by;
    const ga = ((Bq[2] - A[2]) * cy - (C[2] - A[2]) * by) / det, gb = (bx * (C[2] - A[2]) - cx * (Bq[2] - A[2])) / det;
    const dAt = (x, y) => A[2] + ga * (x - A[0]) + gb * (y - A[1]);
    const lam = Math.max(0, (f.n[0] * Lt[0] + f.n[1] * Lt[1] + f.n[2] * Lt[2]) / ln), cc = 178 + 70 * lam;
    const R = o.draft ? 255 : f.cut ? 252 : cc * base[0], G = o.draft ? 255 : f.cut ? 214 : cc * base[1], Bc = o.draft ? 255 : f.cut ? 200 : cc * base[2], HC0 = o.draft ? 30 : 150, HC1 = o.draft ? 41 : 36, HC2 = o.draft ? 59 : 36;
    let y0 = Infinity, y1 = -Infinity; Q.forEach(q => { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
    y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(h - 1, Math.ceil(y1));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5, xs = [];
      loops.forEach(Lp => { for (let q = 0; q < Lp.length; q++) { const a = Lp[q], b = Lp[(q + 1) % Lp.length]; if ((a[1] <= yc) !== (b[1] <= yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); } });
      xs.sort((u, v) => u - v);
      for (let s = 0; s + 1 < xs.length; s += 2) {
        const xa = Math.max(0, Math.round(xs[s])), xb = Math.min(w, Math.round(xs[s + 1]));
        if (xb <= xa) continue;
        let d = dAt(xa + 0.5, yc);
        for (let x = xa; x < xb; x++, d += ga) {
          const id = y * w + x;
          if (d < dep[id]) { dep[id] = d; ids[id] = fi + 1; const p4 = id * 4; if (f.cut && (x + y) % hs < hw) { px[p4] = HC0; px[p4 + 1] = HC1; px[p4 + 2] = HC2; } else { px[p4] = R; px[p4 + 1] = G; px[p4 + 2] = Bc; } px[p4 + 3] = 255; }
        }
      }
    }
    vis.push(f);
  });
  B.cv.getContext('2d').putImageData(img, 0, 0);
  const al = o.alpha == null ? 1 : o.alpha;
  ctx.globalAlpha = al; ctx.drawImage(B.cv, 0, 0); ctx.globalAlpha = 1;
  const bias = o.bias != null ? o.bias : Math.max(0.15, 5 * dp / (o.k || 40));
  let own1 = 0, own2 = 0;
  const seen = (sx, sy, d) => { const x = sx | 0, y = sy | 0; let mn = Infinity; for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (xx >= 0 && yy >= 0 && xx < w && yy < h) { const id = yy * w + xx, fid = ids[id]; if (fid && (fid === own1 || fid === own2)) return true; mn = Math.min(mn, dep[id]); } return d <= mn + bias; };
  ctx.globalAlpha = al; ctx.strokeStyle = o.edge || '#3b2a0c'; ctx.lineWidth = (o.lw || 2.3) * dp; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  const HID = [];
  const seg = (a, b, onlyHid) => {
    const A = P(a), Bp = P(b), n = Math.max(2, Math.ceil(Math.hypot(Bp[0] - A[0], Bp[1] - A[1]) / (2 * dp)));
    let on = false, hs0 = null, last = null;
    for (let s = 0; s <= n; s++) {
      const t = s / n, x = A[0] + (Bp[0] - A[0]) * t, y = A[1] + (Bp[1] - A[1]) * t, v = seen(x, y, A[2] + (Bp[2] - A[2]) * t);
      if (!onlyHid) { if (v && !on) { ctx.moveTo(x, y); on = true; } else if (v) ctx.lineTo(x, y); else on = false; }
      if (o.hidden) { if (!v) { if (!hs0) hs0 = [x, y]; last = [x, y]; } else if (hs0) { HID.push([hs0, last]); hs0 = null; } }
    }
    if (hs0) HID.push([hs0, last]);
  };
  const idx = new Map(faces.map((f, i) => [f, i + 1]));
  vis.forEach(f => { own1 = idx.get(f); own2 = 0; f.edges.forEach(([a, b]) => seg(a, b)); });
  if (!o.front) { own1 = own2 = 0; faces.forEach(f => { if (Math.abs(f.n[0] * V[0] + f.n[1] * V[1] + f.n[2] * V[2]) <= 1e-3) f.edges.forEach(([a, b]) => seg(a, b)); }); }
  faces.forEach(f => f.sil && f.sil.forEach(s => { if (front(f) !== front(s.g)) { own1 = idx.get(f); own2 = idx.get(s.g) || 0; seg(s.a, s.b); } }));
  if (o.hidden) { own1 = own2 = 0; faces.forEach(f => { if (!vis.includes(f)) f.edges.forEach(([a, b]) => seg(a, b, true)); }); }
  ctx.stroke();
  if (HID.length) {
    ctx.lineWidth = 1.3 * dp; ctx.setLineDash([5 * dp, 3.5 * dp]); ctx.beginPath();
    HID.forEach(([p, q]) => { if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 3 * dp) { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); } });
    ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
  return vis;
}
let hcHatch = null;
function hcHatchPat(ctx, dp) {
  if (hcHatch && hcHatch.dp === dp) return ctx.createPattern(hcHatch.cv, 'repeat');
  const s = Math.round(8 * dp), cv = Object.assign(document.createElement('canvas'), { width: s, height: s }), c = cv.getContext('2d');
  c.fillStyle = '#fde3d8'; c.fillRect(0, 0, s, s); c.strokeStyle = '#9b1c1c'; c.lineWidth = 1.3 * dp;
  c.beginPath(); c.moveTo(0, s); c.lineTo(s, 0); c.moveTo(-s / 2, s / 2); c.lineTo(s / 2, -s / 2); c.moveTo(s / 2, s * 1.5); c.lineTo(s * 1.5, s / 2); c.stroke();
  hcHatch = { dp, cv }; return ctx.createPattern(cv, 'repeat');
}
/** đa giác 3D (vẽ phủ): fill = màu | 'hatch' */
function hcPoly3(ctx, P, pts, dp, fill, alpha, stroke, lw, dash) {
  ctx.beginPath(); pts.forEach((p, i) => { const q = P(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath();
  if (fill) { ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.fillStyle = fill === 'hatch' ? hcHatchPat(ctx, dp) : fill; ctx.fill(); ctx.globalAlpha = 1; }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw * dp; ctx.setLineDash(dash ? dash.map(v => v * dp) : []); ctx.stroke(); ctx.setLineDash([]); }
}
function hcTag(ctx, x, y, text, col, dp) {
  ctx.font = `700 ${Math.round(12.5 * dp)}px system-ui,sans-serif`; ctx.textAlign = 'center';
  const tw = ctx.measureText(text).width + 14 * dp;
  x = Math.max(tw / 2 + 2, Math.min(ctx.canvas.width - tw / 2 - 2, x));
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - tw / 2, y - 15 * dp, tw, 20 * dp, 10 * dp) : ctx.rect(x - tw / 2, y - 15 * dp, tw, 20 * dp); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(text, x, y); ctx.textAlign = 'left';
}

/** khung nhìn 3D xoay được: nhiều lớp vật thể (vật thể, phần bị cắt bỏ…) + lớp vẽ phủ */
function HCView(canvas, opt) {
  const ctx = canvas.getContext('2d');
  const st = { yaw: opt.yaw == null ? 0.62 : opt.yaw, pitch: opt.pitch == null ? 0.42 : opt.pitch, zoom: 1 };
  const o = Object.assign({ layers: [], fit: [] }, opt);
  let raf = 0;
  const rows = (yw, pt) => { const cy = Math.cos(yw), sy = Math.sin(yw), cp = Math.cos(pt), sp = Math.sin(pt); return { R1: [cy, -sy, 0], R2: [sy * sp, cy * sp, cp], V: [sy * cp, cy * cp, -sp] }; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const draw = () => {
    const Wc = canvas.width, Hc = canvas.height, dp = window.devicePixelRatio || 1;
    const F0 = rows(o.yaw0 == null ? (opt.yaw == null ? 0.62 : opt.yaw) : o.yaw0, o.pitch0 == null ? (opt.pitch == null ? 0.42 : opt.pitch) : o.pitch0);
    const pts = o.fit.length ? o.fit : [[0, 0, 0], [1, 1, 1]];
    const mn = [0, 1, 2].map(i => Math.min(...pts.map(p => p[i]))), mx = [0, 1, 2].map(i => Math.max(...pts.map(p => p[i]))), cen = mn.map((v, i) => (v + mx[i]) / 2);
    const corners = [0, 1].flatMap(i => [0, 1].flatMap(j => [0, 1].map(l => [[mn, mx][i][0], [mn, mx][j][1], [mn, mx][l][2]])));
    let ex = 0.1, ez = 0.1; corners.forEach(p => { const d = [p[0] - cen[0], p[1] - cen[1], p[2] - cen[2]]; ex = Math.max(ex, Math.abs(dot(F0.R1, d))); ez = Math.max(ez, Math.abs(dot(F0.R2, d))); });
    const k = Math.min(Wc / (ex * 2.25), (Hc - 26 * dp) / (ez * 2.25)) * st.zoom, M = rows(st.yaw, st.pitch);
    const P = p => { const d = [p[0] - cen[0], p[1] - cen[1], p[2] - cen[2]]; return [Wc / 2 + dot(M.R1, d) * k, Hc / 2 - dot(M.R2, d) * k, dot(M.V, d)]; };
    ctx.clearRect(0, 0, Wc, Hc);
    if (o.under) o.under(ctx, P, dp, k);
    o.layers.forEach(L => {
      const al = L.alpha == null ? 1 : L.alpha; if (!L.F || al <= 0.01) return;
      const off = L.off, PP = off ? p => P([p[0] + off[0], p[1] + off[1], p[2] + off[2]]) : P;
      hcPaint(ctx, Wc | 0, Hc | 0, L.F, PP, M.V, dp, { alpha: al, k });
    });
    if (o.over) o.over(ctx, P, dp, k);
  };
  const fit = () => { const r = canvas.getBoundingClientRect(), d = window.devicePixelRatio || 1; canvas.width = Math.max(200, r.width * d); canvas.height = Math.max(160, r.height * d); draw(); };
  let drag = null; const pts = new Map();
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); drag = { x: e.clientX, y: e.clientY, d: null }; });
  canvas.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [p, q] = [...pts.values()], d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (drag.d) st.zoom = Math.max(0.5, Math.min(3, st.zoom * d / drag.d)); drag.d = d; draw(); return; }
    st.yaw += (e.clientX - drag.x) * 0.01; st.pitch = Math.max(-1.55, Math.min(1.55, st.pitch + (e.clientY - drag.y) * 0.01)); drag.x = e.clientX; drag.y = e.clientY; draw();
  });
  const up = e => { pts.delete(e.pointerId); if (!pts.size) drag = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); st.zoom = Math.max(0.5, Math.min(3, st.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); draw(); }, { passive: false });
  window.addEventListener('resize', fit);
  setTimeout(fit, 0);
  const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  return {
    st,
    set(p) { Object.assign(o, p); draw(); },
    put(p) { Object.assign(o, p); },
    redraw: draw,
    /** chạy hoạt cảnh: fn(e) với e từ 0→1 (đã làm mượt) */
    anim(fn, ms, done) { cancelAnimationFrame(raf); const t0 = performance.now(); const step = now => { const kk = Math.min(1, (now - t0) / ms); fn(ease(kk)); draw(); if (kk < 1) raf = requestAnimationFrame(step); else if (done) done(); }; raf = requestAnimationFrame(step); },
    view(yaw, pitch, ms = 700, done) { const y0 = st.yaw, p0 = st.pitch; let dy = yaw - y0; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.anim(e => { st.yaw = y0 + dy * e; st.pitch = p0 + (pitch - p0) * e; }, ms, done); },
    destroy() { cancelAnimationFrame(raf); window.removeEventListener('resize', fit); }
  };
}

/* ================= KHỐI 10 – VẬT THỂ CHO HÌNH CẮT, MẶT CẮT ================= */
const K10_NAV = [['#/hcvg', 'Bài 9. Hình chiếu vuông góc'], ['#/hcat', 'Bài 10. Hình cắt và mặt cắt'], ['#/hctd', 'Bài 11. Hình chiếu trục đo'], ['#/hcpc', 'Bài 12. Hình chiếu phối cảnh']];
const k10nav = cur => `<div class="k10nav">${K10_NAV.map(([h, t]) => `<a href="${h}" class="${h === cur ? 'on' : ''}">📁 ${t}</a>`).join('')}</div>`;
const HCC = (() => {
  const { extrude, prep, circ, arcPts } = HC.G;
  const R4 = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const fl = A => A.map((p, i) => [p[0], p[1], i < A.length - 1 ? 1 : 0]);
  const sect = (cx, cy, ri, ro, a0, a1, n = 24) => [...fl(arcPts(cx, cy, ro, a0, a1, n)), ...fl(arcPts(cx, cy, ri, a1, a0, n))];
  const notch = (x0, x1, c, y1, N) => { const P = [[x0, c, 0]]; N.forEach(({ cx, r }) => P.push(...fl(arcPts(cx, c, r, 180, 0, 14)))); P.push([x1, c, 0], [x1, y1, 0], [x0, y1, 0]); return P; };
  const cp = f => ({ pts: f.pts.map(p => p.slice()), holes: f.holes.map(h => h.map(p => p.slice())), n: f.n.slice(), smooth: f.smooth, t: f.t, cut: f.cut });
  const mirY = (F, c) => F.map(cp).map(f => ({ ...f, pts: f.pts.map(p => [p[0], 2 * c - p[1], p[2]]).reverse(), holes: f.holes.map(h => h.map(p => [p[0], 2 * c - p[1], p[2]]).reverse()), n: [f.n[0], -f.n[1], f.n[2]], cut: 0 }));
  const mirX = (F, W) => F.map(cp).map(f => ({ ...f, pts: f.pts.map(p => [W - p[0], p[1], p[2]]).reverse(), holes: f.holes.map(h => h.map(p => [W - p[0], p[1], p[2]]).reverse()), n: [-f.n[0], f.n[1], f.n[2]], cut: 0 }));
  const mark = (F, c, cx) => { F.forEach(f => { const a = Math.abs(f.n[1] + 1) < 1e-6 && f.pts.every(p => Math.abs(p[1] - c) < 1e-6), b = cx != null && Math.abs(f.n[0] - 1) < 1e-6 && f.pts.every(p => Math.abs(p[0] - cx) < 1e-6); if (a || b) f.cut = 1; }); return F; };
  const L = (x1, y1, x2, y2, k = 'v') => ({ p: [[x1, y1], [x2, y2]], k }), PG = (p, k = 'v') => ({ p, z: 1, k });
  const trace = (W, c) => [L(-0.75, c, -0.15, c, 'm'), L(W + 0.15, c, W + 0.75, c, 'm'), { ar: [-0.45, c, 0, 0.7] }, { ar: [W + 0.45, c, 0, 0.7] }, { tx: [-0.82, c + 0.55, 'A'] }, { tx: [W + 0.82, c + 0.55, 'A'] }];
  const O = {};
  /* 1. Tấm có lỗ bậc */
  {
    const c = 1.5, W = 4, D = 3, H = 1.6;
    const full = () => [...extrude('z', R4(0, 0, W, D), [circ(2, c, 0.45)], 0, 0.9, 'bsh'), ...extrude('z', R4(0, 0, W, D), [circ(2, c, 0.8)], 0.9, H, 'tsh'), ...extrude('z', circ(2, c, 0.8), [circ(2, c, 0.45)], 0.9, 0.9, 't')];
    const cut = () => mark([...extrude('z', notch(0, W, c, D, [{ cx: 2, r: 0.45 }]), [], 0, 0.9, 'bs'), ...extrude('z', notch(0, W, c, D, [{ cx: 2, r: 0.8 }]), [], 0.9, H, 'ts'), ...extrude('z', sect(2, c, 0.45, 0.8, 0, 180, 14), [], 0.9, 0.9, 't')], c);
    const hole = k => [L(1.55, 0, 1.55, 0.9, k), L(2.45, 0, 2.45, 0.9, k), L(1.2, 0.9, 1.2, H, k), L(2.8, 0.9, 2.8, H, k), L(1.2, 0.9, 2.8, 0.9, k)];
    const HL = [[0, 0], [1.55, 0], [1.55, 0.9], [1.2, 0.9], [1.2, H], [0, H]], HR = [[2.45, 0], [W, 0], [W, H], [2.8, H], [2.8, 0.9], [2.45, 0.9]];
    const bx = PG(R4(0, 0, W, H)), cl = L(2, -0.35, 2, 1.95, 'c'), AA = { tx: [2, 2.25, 'A – A'] };
    const topIt = [PG(R4(0, 0, W, D)), { c: [2, c, 0.8], k: 'v' }, { c: [2, c, 0.45], k: 'v' }, L(2, 0.4, 2, 2.6, 'c'), L(0.9, c, 3.1, c, 'c')];
    O.tamlo = { id: 'tamlo', ten: 'Tấm có lỗ bậc', lv: 'Cơ bản', W, D, H, c, full, cut, ghost: () => mirY(cut(), c),
      views: {
        front: { W, H: 2.5, it: [bx, ...hole('h'), cl] },
        sec: { W, H: 2.5, it: [{ f: [HL, HR] }, bx, ...hole('v'), cl, AA] },
        x1: { W, H: 2.5, it: [{ f: [R4(0, 0, W, H)] }, bx, ...hole('v'), cl, AA], why: 'Lỗ là khoảng trống (không có vật liệu) nên không được kẻ gạch gạch.' },
        x2: { W, H: 2.5, it: [bx, ...hole('h'), cl, AA], why: 'Đây vẫn là hình chiếu đứng (lỗ vẽ nét đứt), chưa có mặt cắt kẻ gạch.' },
        x3: { W, H: 2.5, it: [{ f: [HL, HR] }, bx, ...hole('h'), cl, AA], why: 'Sau khi cắt, đường bao của lỗ đã thấy được nên phải vẽ nét liền đậm, không vẽ nét đứt.' },
        top: { u0: -1.2, W: W + 2.4, H: D, it: [...topIt, ...trace(W, c)] },
        top0: { W, H: D, it: topIt },
        side: { W: D, H, it: [PG(R4(0, 0, D, H)), L(1.05, 0, 1.05, 0.9, 'h'), L(1.95, 0, 1.95, 0.9, 'h'), L(0.7, 0.9, 0.7, H, 'h'), L(2.3, 0.9, 2.3, H, 'h'), L(0.7, 0.9, 2.3, 0.9, 'h'), L(1.5, -0.35, 1.5, 1.95, 'c')] }
      } };
  }
  /* 2. Khối chữ L có lỗ */
  {
    const c = 1.5, W = 4, D = 3, H = 3.5;
    const full = () => [...extrude('z', R4(0, 0, W, D), [circ(2.6, c, 0.5)], 0, 1, 'bsh'), ...extrude('z', R4(1, 0, W, D), [circ(2.6, c, 0.5)], 1, 1, 't'), ...extrude('z', R4(0, 0, 1, D), [], 1, H, 'ts')];
    const cut = () => mark([...extrude('z', notch(0, W, c, D, [{ cx: 2.6, r: 0.5 }]), [], 0, 1, 'bs'), ...extrude('z', notch(1, W, c, D, [{ cx: 2.6, r: 0.5 }]), [], 1, 1, 't'), ...extrude('z', R4(0, c, 1, D), [], 1, H, 'ts')], c);
    const OL = [[0, 0], [W, 0], [W, 1], [1, 1], [1, H], [0, H]], hole = k => [L(2.1, 0, 2.1, 1, k), L(3.1, 0, 3.1, 1, k)], cl = L(2.6, -0.35, 2.6, 1.35, 'c'), AA = { tx: [2.4, 3.95, 'A – A'] };
    const HL = [[0, 0], [2.1, 0], [2.1, 1], [1, 1], [1, H], [0, H]], HR = [[3.1, 0], [W, 0], [W, 1], [3.1, 1]];
    const topIt = HC.OBJ[3].views.top.it;
    O.lco = { id: 'lco', ten: 'Khối chữ L có lỗ', lv: 'Cơ bản', W, D, H, c, full, cut, ghost: () => mirY(cut(), c),
      views: {
        front: { W, H: 4.3, it: [PG(OL), ...hole('h'), cl] },
        sec: { W, H: 4.3, it: [{ f: [HL, HR] }, PG(OL), ...hole('v'), cl, AA] },
        x1: { W, H: 4.3, it: [{ f: [HL, HR, [[2.1, 0], [3.1, 0], [3.1, 1], [2.1, 1]]] }, PG(OL), ...hole('v'), cl, AA], why: 'Lỗ là khoảng trống (không có vật liệu) nên không được kẻ gạch gạch.' },
        x2: { W, H: 4.3, it: [PG(OL), ...hole('h'), cl, AA], why: 'Đây vẫn là hình chiếu đứng (lỗ vẽ nét đứt), chưa có mặt cắt kẻ gạch.' },
        x3: { W, H: 4.3, it: [{ f: [HL, HR] }, PG(OL), ...hole('h'), cl, AA], why: 'Sau khi cắt, đường bao của lỗ đã thấy được nên phải vẽ nét liền đậm, không vẽ nét đứt.' },
        top: { u0: -1.2, W: W + 2.4, H: D, it: [...topIt, ...trace(W, c)] }
      } };
  }
  /* 3. Ống lót có vai (đối xứng – dùng cho hình cắt một nửa) */
  {
    const c = 1.5, W = 3, D = 3, H = 2.4, X = 1.5;
    const full = () => [...extrude('z', circ(X, c, 1.5, 32), [circ(X, c, 0.55)], 0, 0.6, 'bs'), ...extrude('z', circ(X, c, 1.5, 32), [circ(X, c, 1)], 0.6, 0.6, 't'), ...extrude('z', circ(X, c, 1), [circ(X, c, 0.55)], 0.6, H, 'ts'), ...extrude('z', circ(X, c, 1.5, 32), [circ(X, c, 0.55)], 0, H, 'h')];
    const part = (a0, a1) => [...extrude('z', sect(X, c, 0.55, 1.5, a0, a1), [], 0, 0.6, 'bs'), ...extrude('z', sect(X, c, 1, 1.5, a0, a1), [], 0.6, 0.6, 't'), ...extrude('z', sect(X, c, 0.55, 1, a0, a1), [], 0.6, H, 'ts')];
    const OL = [[0, 0], [W, 0], [W, 0.6], [2.5, 0.6], [2.5, H], [0.5, H], [0.5, 0.6], [0, 0.6]], bore = k => [L(0.95, 0, 0.95, H, k), L(2.05, 0, 2.05, H, k)], cl = L(X, -0.35, X, 2.75, 'c'), AA = { tx: [X, 3.15, 'A – A'] };
    const HL = [[0, 0], [0.95, 0], [0.95, H], [0.5, H], [0.5, 0.6], [0, 0.6]], HR = [[2.05, 0], [W, 0], [W, 0.6], [2.5, 0.6], [2.5, H], [2.05, H]];
    const topIt = [{ c: [X, c, 1.5], k: 'v' }, { c: [X, c, 1], k: 'v' }, { c: [X, c, 0.55], k: 'v' }, L(X, -0.25, X, 3.25, 'c'), L(-0.25, c, 3.25, c, 'c')];
    O.ongvai = { id: 'ongvai', ten: 'Ống lót có vai', lv: 'Cơ bản', W, D, H, c, cx: X, full, cut: () => mark(part(0, 180), c), ghost: () => part(180, 360), half: () => mark(part(0, 270), c, X), ghostHalf: () => part(270, 360),
      views: {
        front: { W, H: 3.4, it: [PG(OL), ...bore('h'), cl] },
        sec: { W, H: 3.4, it: [{ f: [HL, HR] }, PG(OL), ...bore('v'), cl, AA], why: 'Đây là hình cắt toàn bộ (cả hai nửa đều kẻ gạch), không phải hình cắt một nửa.' },
        x1: { W, H: 3.4, it: [{ f: [[[0, 0], [W, 0], [W, 0.6], [2.5, 0.6], [2.5, H], [0.5, H], [0.5, 0.6], [0, 0.6]]] }, PG(OL), ...bore('v'), cl, AA], why: 'Lỗ là khoảng trống (không có vật liệu) nên không được kẻ gạch gạch.' },
        x2: { W, H: 3.4, it: [PG(OL), ...bore('h'), cl, AA], why: 'Đây vẫn là hình chiếu đứng (lỗ vẽ nét đứt), chưa có mặt cắt kẻ gạch.' },
        x3: { W, H: 3.4, it: [{ f: [HL, HR] }, PG(OL), ...bore('h'), cl, AA], why: 'Sau khi cắt, đường bao của lỗ đã thấy được nên phải vẽ nét liền đậm, không vẽ nét đứt.' },
        half: { W, H: 3.4, it: [{ f: [HR] }, PG(OL), L(2.05, 0, 2.05, H), cl] },
        hx1: { W, H: 3.4, it: [{ f: [HR] }, PG(OL), L(2.05, 0, 2.05, H), L(0.95, 0, 0.95, H, 'h'), cl], why: 'Ở nửa hình chiếu không vẽ nét đứt, vì phần bên trong đã thể hiện rõ ở nửa hình cắt.' },
        hx3: { W, H: 3.4, it: [{ f: [HR, [[X, 0], [2.05, 0], [2.05, H], [X, H]]] }, PG(OL), L(2.05, 0, 2.05, H), cl], why: 'Lỗ là khoảng trống nên không được kẻ gạch gạch.' },
        top: { u0: -1.2, W: W + 2.4, H: D, it: [...topIt, ...trace(W, c)] },
        top0: { W, H: D, it: topIt },
        side: { W, H: 3.4, it: [PG(OL), ...bore('h'), cl] }
      } };
  }
  /* ---- vật thể ghép từ các lớp đùn theo trục đứng; tự sinh phần bị cắt (y ≥ c) và phần bỏ đi (y ≤ c) ---- */
  const area2 = P => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  const clipUp = (P, c) => { const o = []; P.forEach((A, i) => { const B = P[(i + 1) % P.length], a = A[1] >= c - 1e-9, b = B[1] >= c - 1e-9; if (a) o.push([A[0], A[1], A[2] || 0]); if (a !== b) { const t = (c - A[1]) / (B[1] - A[1]); o.push([A[0] + (B[0] - A[0]) * t, c, 0]); } }); return o; };
  function clipPart(p, c, side) {
    const fy = side > 0 ? (y => y) : (y => 2 * c - y);
    const out0 = p.out.map(q => [q[0], fy(q[1]), q[2] || 0]);
    let Q = clipUp(out0, c); if (Q.length < 3 || Math.abs(area2(Q)) < 1e-9) return null;
    if (area2(Q) < 0) Q = Q.reverse().map(q => [q[0], q[1], 0]);
    const holes = [], notches = [];
    (p.holes || []).forEach(h => {
      if (h.c) { const [cx, cy0, r] = h.c, cy = fy(cy0); if (Math.abs(cy - c) < 1e-6) notches.push({ a: cx - r, b: cx + r, path: fl(arcPts(cx, c, r, 180, 0, 14)) }); else if (cy - r > c) holes.push(circ(cx, cy, r)); }
      else { let [x0, y0, x1, y1] = h.r; [y0, y1] = [fy(y0), fy(y1)].sort((u, v) => u - v); if (y0 < c - 1e-9 && y1 > c + 1e-9) notches.push({ a: x0, b: x1, path: [[x0, c, 0], [x0, y1, 0], [x1, y1, 0], [x1, c, 0]] }); else if (y0 >= c - 1e-9) holes.push(R4(x0, y0, x1, y1)); }
    });
    notches.sort((u, v) => u.a - v.a);
    const R = [];
    Q.forEach((A, i) => { const B = Q[(i + 1) % Q.length]; R.push(A); if (Math.abs(A[1] - c) < 1e-6 && Math.abs(B[1] - c) < 1e-6 && B[0] > A[0]) notches.filter(n => n.a > A[0] - 1e-6 && n.b < B[0] + 1e-6).forEach(n => R.push(...n.path)); });
    const un = L => L.map(q => [q[0], fy(q[1]), q[2] || 0]);
    return { out: side > 0 ? R : un(R), holes: side > 0 ? holes : holes.map(un) };
  }
  const gen = (o) => {
    const ext = (L, h, z0, z1) => extrude('z', L, h, z0, z1);
    o.full = () => o.parts.flatMap(p => ext(p.out, (p.holes || []).map(h => h.c ? circ(...h.c) : R4(...h.r)), p.z[0], p.z[1]));
    o.cut = () => mark(o.parts.flatMap(p => { const r = clipPart(p, o.c, 1); return r ? ext(r.out, r.holes, p.z[0], p.z[1]) : []; }), o.c);
    o.ghost = () => o.parts.flatMap(p => { const r = clipPart(p, o.c, -1); return r ? ext(r.out, r.holes, p.z[0], p.z[1]) : []; });
    O[o.id] = o; return o;
  };
  gen({ id: 'sgk101', ten: 'Khối hộp có lỗ vuông (SGK Hình 10.1)', lv: 'SGK', W: 5, D: 3.6, H: 4.6, c: 1.5,
    parts: [{ out: R4(0, 3, 5, 3.6), z: [0, 4.6] }, { out: R4(1, 0, 4, 3), z: [0.8, 2.8] }, { out: R4(1, 0, 4, 3), holes: [{ r: [2, 1, 3, 2] }], z: [2.8, 3.8] }] });
  gen({ id: 'hoclo', ten: 'Khối có hốc chữ nhật và lỗ trụ', lv: 'Nâng cao', W: 4, D: 3, H: 2, c: 1.5,
    parts: [{ out: R4(0, 0, 4, 3), holes: [{ c: [2, 1.5, 0.6] }], z: [0, 1.3] }, { out: R4(0, 0, 4, 3), holes: [{ r: [0.6, 0.6, 3.4, 2.4] }], z: [1.3, 2] }] });
  gen({ id: 'de', ten: 'Đế có rãnh hở và lỗ trụ', lv: 'Nâng cao', W: 5, D: 3, H: 2.5, c: 1.5,
    parts: [{ out: [[0, 0], [5, 0], [5, 3], [0, 3], [0, 2.1], [1, 2.1], [1, 0.9], [0, 0.9]], holes: [{ c: [3, 1.5, 0.75] }], z: [0, 1] }, { out: R4(1.8, 0.3, 4.2, 2.7), holes: [{ c: [3, 1.5, 0.75] }], z: [1, 2.5] }] });
  gen({ id: 'goido', ten: 'Gối đỡ có ba lỗ', lv: 'Nâng cao', W: 5, D: 3, H: 2.5, c: 1.5,
    parts: [{ out: R4(0, 0, 5, 3), holes: [{ c: [0.6, 1.5, 0.45] }, { c: [2.5, 1.5, 0.75] }, { c: [4.4, 1.5, 0.45] }], z: [0, 1] }, { out: R4(1.4, 0, 3.6, 3), holes: [{ c: [2.5, 1.5, 0.75] }], z: [1, 2.5] }] });
  gen({ id: 'tam5lo', ten: 'Tấm có gờ và nhiều lỗ', lv: 'Nâng cao', W: 5, D: 3.6, H: 1.7, c: 1.8,
    parts: [{ out: R4(0, 0, 5, 3.6), holes: [{ c: [0.9, 0.6, 0.3] }, { c: [4.1, 0.6, 0.3] }, { c: [0.9, 1.8, 0.3] }, { c: [2.5, 1.8, 0.65] }, { c: [4.1, 1.8, 0.3] }, { c: [0.9, 3, 0.3] }, { c: [4.1, 3, 0.3] }], z: [0, 1.1] }, { out: R4(1.6, 0.9, 3.4, 2.7), holes: [{ c: [2.5, 1.8, 0.65] }], z: [1.1, 1.7] }] });
  gen({ id: 'lokin', ten: 'Khối có lỗ kín đáy và rãnh hở', lv: 'Nâng cao', W: 4.2, D: 3.2, H: 1.4, c: 1.6,
    parts: [{ out: [[0, 0], [4.2, 0], [4.2, 1], [3.2, 1], [3.2, 2.2], [4.2, 2.2], [4.2, 3.2], [0, 3.2]], z: [0, 0.7] }, { out: [[0, 0], [4.2, 0], [4.2, 1], [3.2, 1], [3.2, 2.2], [4.2, 2.2], [4.2, 3.2], [0, 3.2]], holes: [{ c: [1.4, 1.6, 0.8] }], z: [0.7, 1.4] }] });
  /* 4. Trục có rãnh then và đầu vuông (mặt cắt) */
  {
    const th = Math.acos(0.25 / 0.9) * 180 / Math.PI;
    const K = [...fl(arcPts(1, 1, 0.9, 180 - th, 360 + th, 40)), [1.25, 1.55, 0], [0.75, 1.55, 0]];
    const faces = () => [...extrude('x', K, [], 0, 2.5), ...extrude('x', circ(1, 1, 0.65), [], 2.5, 4, 'ts'), ...extrude('x', R4(0.45, 0.45, 1.55, 1.55), [], 4, 5.5, 'ts')];
    const prof = (cx, cz, P2) => P2.map(([y, z]) => [cx + (y - 1), cz + (z - 1)]);
    const KA = (cx, cz) => prof(cx, cz, K), SQ = (cx, cz) => prof(cx, cz, R4(0.45, 0.45, 1.55, 1.55));
    const frontIt = [PG([[0, 0.1], [2.5, 0.1], [2.5, 1.864], [0, 1.864]]), L(0, 1.55, 2.5, 1.55, 'h'), PG(R4(2.5, 0.35, 4, 1.65)), PG(R4(4, 0.45, 5.5, 1.55)), L(4, 0.45, 5.5, 1.55, 'n'), L(4, 1.55, 5.5, 0.45, 'n'), L(-0.35, 1, 5.85, 1, 'c')];
    const sec = (pts, k = 'v') => [{ f: [pts] }, PG(pts, k)];
    const sm = pts => ({ W: 2.4, H: 2.4, u0: -0.2, v0: -0.2, it: [...sec(pts), L(1, -0.15, 1, 2.15, 'c'), L(-0.15, 1, 2.15, 1, 'c')] });
    O.truc = { id: 'truc', ten: 'Trục có rãnh then', W: 5.5, D: 2, H: 2, cA: 1.25, cB: 4.75, K, SQ: R4(0.45, 0.45, 1.55, 1.55), full: faces,
      views: {
        front: { u0: -0.4, W: 6.35, v0: -0.1, H: 2.2, it: frontIt },
        roi: { u0: -0.4, W: 6.35, v0: -2.55, H: 4.95, it: [...frontIt, L(1.25, -2.5, 1.25, 2.3, 'c'), L(4.75, -2.5, 4.75, 2.3, 'c'), ...sec(KA(1.25, -1.45)), ...sec(SQ(4.75, -1.45)), L(0.15, -1.45, 2.35, -1.45, 'c'), L(3.95, -1.45, 5.55, -1.45, 'c')] },
        chap: { u0: -0.4, W: 6.35, v0: -0.1, H: 2.2, it: [...frontIt, ...sec(KA(1.25, 1), 'n'), ...sec(SQ(4.75, 1), 'n')] },
        sA: sm(K), sX1: { ...sm(HC.G.circ(1, 1, 0.9, 40).map(p => [p[0], p[1]])), why: 'Hình tròn đầy đủ là mặt cắt của đoạn trục trơn, ở vị trí A còn có rãnh then.' },
        sX2: { ...sm(K.map(([y, z]) => [y, 2 - z])), why: 'Rãnh then nằm ở phía trên của trục, không phải phía dưới.' },
        sX3: { ...sm(R4(0.45, 0.45, 1.55, 1.55)), why: 'Hình vuông là mặt cắt tại vị trí B (đầu vuông), không phải tại A.' }
      } };
  }
  /* 5. SGK Hình 10.6 – Khay chữ nhật có lỗ ở đáy (hình cắt toàn bộ) */
  {
    const c = 1.6, W = 5, D = 3.2, H = 1.6, t = 0.3, f = 0.4, X = 2.5, r = 0.4;
    const full = () => [...extrude('z', R4(0, 0, W, D), [circ(X, c, r)], 0, f, 'bsh'), ...extrude('z', R4(t, t, W - t, D - t), [circ(X, c, r)], f, f, 't'), ...extrude('z', R4(0, 0, W, D), [R4(t, t, W - t, D - t)], f, H, 'tsh')];
    const cut = () => mark([...extrude('z', notch(0, W, c, D, [{ cx: X, r }]), [], 0, f, 'bs'), ...extrude('z', notch(t, W - t, c, D - t, [{ cx: X, r }]), [], f, f, 't'),
      ...extrude('z', [[0, c], [t, c], [t, D - t], [W - t, D - t], [W - t, c], [W, c], [W, D], [0, D]], [], f, H, 'ts')], c);
    const OL = R4(0, 0, W, H), inner = k => [L(t, f, t, H, k), L(W - t, f, W - t, H, k), L(t, f, X - r, f, k), L(X + r, f, W - t, f, k), L(X - r, 0, X - r, f, k), L(X + r, 0, X + r, f, k)];
    const HL = [[0, 0], [X - r, 0], [X - r, f], [t, f], [t, H], [0, H]], HR = [[X + r, 0], [W, 0], [W, H], [W - t, H], [W - t, f], [X + r, f]];
    const cl = L(X, -0.35, X, 1.95, 'c'), AA = { tx: [X, 2.3, 'A – A'] };
    const topIt = [PG(R4(0, 0, W, D)), PG(R4(t, t, W - t, D - t)), { c: [X, c, r], k: 'v' }, L(X, c - 0.75, X, c + 0.75, 'c'), L(X - 0.75, c, X + 0.75, c, 'c')];
    O.khay = { id: 'khay', ten: 'Khay có lỗ đáy (SGK H.10.6)', W, D, H, c, full, cut, ghost: () => mirY(cut(), c),
      views: {
        front: { W, H: 2.6, it: [PG(OL), ...inner('h'), cl] },
        sec: { W, H: 2.6, it: [{ f: [HL, HR] }, PG(OL), ...inner('v'), cl, AA] },
        x1: { W, H: 2.6, it: [{ f: [OL] }, PG(OL), ...inner('v'), cl, AA], why: 'Lòng khay và lỗ đáy là khoảng trống (không có vật liệu) nên không được kẻ gạch.' },
        x2: { W, H: 2.6, it: [PG(OL), ...inner('h'), cl, AA], why: 'Đây vẫn là hình chiếu đứng (nét đứt), chưa có mặt cắt kẻ gạch.' },
        x3: { W, H: 2.6, it: [{ f: [HL, HR] }, PG(OL), ...inner('h'), cl, AA], why: 'Sau khi cắt, thành trong của khay và lỗ đã thấy được nên phải vẽ nét liền đậm.' },
        top: { u0: -1.2, W: W + 2.4, H: D, it: [...topIt, ...trace(W, c)] }
      } };
  }
  /* 6. SGK Hình 10.16 – Vật thể có rãnh, khối hộp và lỗ suốt (Thực hành 1 – hình cắt toàn bộ A – A) */
  {
    const c = 1.5, W = 5, D = 3, H = 2.5, X = 3, r = 0.75, b0 = 1.8, b1 = 4.2;
    const B = [[0, 0], [W, 0], [W, D], [0, D], [0, 2.1], [1, 2.1], [1, 0.9], [0, 0.9]];
    const full = () => [...extrude('z', B, [circ(X, c, r)], 0, 1, 'b'), ...extrude('z', B, [], 0, 1, 's'), ...extrude('z', B, [R4(b0, 0.3, b1, 2.7)], 1, 1, 't'),
      ...extrude('z', R4(b0, 0.3, b1, 2.7), [circ(X, c, r)], 1, H, 'ts'), ...extrude('z', R4(0, 0, W, D), [circ(X, c, r)], 0, H, 'h')];
    const BC = [...notch(1, W, c, D, [{ cx: X, r }]).slice(0, -1), [0, D, 0], [0, 2.1, 0], [1, 2.1, 0]];
    const cut = () => mark([...extrude('z', BC, [], 0, 1, 'bs'), ...extrude('z', [[1, c], [b0, c], [b0, 2.7], [b1, 2.7], [b1, c], [W, c], [W, D], [0, D], [0, 2.1], [1, 2.1]], [], 1, 1, 't'),
      ...extrude('z', notch(b0, b1, c, 2.7, [{ cx: X, r }]), [], 1, H, 'ts')], c);
    const OL = [[0, 0], [W, 0], [W, 1], [b1, 1], [b1, H], [b0, H], [b0, 1], [0, 1]];
    const hole = k => [L(X - r, 0, X - r, H, k), L(X + r, 0, X + r, H, k)];
    const HL = [[1, 0], [X - r, 0], [X - r, H], [b0, H], [b0, 1], [1, 1]], HR = [[X + r, 0], [W, 0], [W, 1], [b1, 1], [b1, H], [X + r, H]];
    const cl = L(X, -0.35, X, 2.85, 'c'), AA = { tx: [2.5, 3.2, 'A – A'] };
    const topIt = [PG(B), PG(R4(b0, 0.3, b1, 2.7)), { c: [X, c, r], k: 'v' }, L(X, 0.1, X, 2.9, 'c'), L(1.4, c, 4.6, c, 'c')];
    O.td16 = { id: 'td16', ten: 'Vật thể có rãnh và lỗ (SGK H.10.16)', W, D, H, c, full, cut, ghost: () => mirY(cut(), c),
      views: {
        front: { W, H: 3.5, it: [PG(OL), L(1, 0, 1, 1, 'h'), ...hole('h'), cl] },
        sec: { W, H: 3.5, it: [{ f: [HL, HR] }, PG(OL), L(1, 0, 1, 1), ...hole('v'), cl, AA] },
        x1: { W, H: 3.5, it: [{ f: [HL, HR, R4(X - r, 0, X + r, H)] }, PG(OL), L(1, 0, 1, 1), ...hole('v'), cl, AA], why: 'Lỗ trụ là khoảng trống (không có vật liệu) nên không được kẻ gạch.' },
        x2: { W, H: 3.5, it: [PG(OL), L(1, 0, 1, 1, 'h'), ...hole('h'), cl, AA], why: 'Đây vẫn là hình chiếu đứng (nét đứt), chưa có mặt cắt kẻ gạch.' },
        x3: { W, H: 3.5, it: [{ f: [HL, HR] }, PG(OL), L(1, 0, 1, 1, 'h'), ...hole('h'), cl, AA], why: 'Sau khi cắt, đường bao của lỗ và rãnh đã thấy được nên phải vẽ nét liền đậm.' },
        x4: { W, H: 3.5, it: [{ f: [[[0, 0], [X - r, 0], [X - r, H], [b0, H], [b0, 1], [0, 1]], HR] }, PG(OL), ...hole('v'), cl, AA], why: 'Mặt phẳng cắt đi qua rãnh bên trái – rãnh là khoảng trống nên phần đó không được kẻ gạch.' },
        top: { u0: -1.2, W: W + 2.4, H: D, it: [...topIt, ...trace(W, c)] }
      } };
  }
  /* 7. SGK Hình 10.17 – Gối đỡ (Thực hành 2 – hình cắt một nửa B – B) */
  {
    const c = 1.5, W = 5, D = 3, H = 2.5, X = 2.5, r = 0.75, rn = 0.5;
    const nR = (a0, a1) => fl(arcPts(W, c, rn, a0, a1, 10)), nL = fl(arcPts(0, c, rn, 90, -90, 10)), hA = (a0, a1) => fl(arcPts(X, c, r, a0, a1, 18));
    const B = [[0, 0], [W, 0], ...nR(270, 90), [W, D], [0, D], [0, 2, 1], ...nL.slice(1, -1), [0, 1, 0]];
    const TL = [[0, 0], [1, 0], [1, D], [0, D], [0, 2, 1], ...nL.slice(1, -1), [0, 1, 0]], TR = [[4, 0], [W, 0], ...nR(270, 90), [W, D], [4, D]];
    const full = () => [...extrude('z', B, [circ(X, c, r)], 0, 1, 'b'), ...extrude('z', B, [], 0, 1, 's'), ...extrude('z', TL, [], 1, 1, 't'), ...extrude('z', TR, [], 1, 1, 't'),
      ...extrude('z', R4(1, 0, 4, D), [circ(X, c, r)], 1, H, 'ts'), ...extrude('z', R4(0, 0, W, D), [circ(X, c, r)], 0, H, 'h')];
    const BH = [[0, 0], [X, 0], [X, c - r, 1], ...hA(270, 0).slice(1), [4.5, c, 1], ...nR(180, 90).slice(1), [W, D], [0, D], [0, 2, 1], ...nL.slice(1, -1), [0, 1, 0]];
    const half = () => mark([...extrude('z', BH, [], 0, 1, 'bs'), ...extrude('z', TL, [], 1, 1, 't'), ...extrude('z', [[4, c], [4.5, c, 1], ...nR(180, 90).slice(1), [W, D], [4, D]], [], 1, 1, 't'),
      ...extrude('z', [[1, 0], [X, 0], [X, c - r, 1], ...hA(270, 0).slice(1), [4, c, 0], [4, D], [1, D]], [], 1, H, 'ts')], c, X);
    const ghostHalf = () => [...extrude('z', [[X, 0], [W, 0], [W, 1], ...nR(270, 180).slice(1), [X + r, c, 1], ...hA(360, 270).slice(1)], [], 0, 1, 'bs'),
      ...extrude('z', [[4, 0], [W, 0], [W, 1], ...nR(270, 180).slice(1), [4, c, 0]], [], 1, 1, 't'), ...extrude('z', [[X, 0], [4, 0], [4, c], [X + r, c, 1], ...hA(360, 270).slice(1)], [], 1, H, 'ts')];
    const OL = [[0, 0], [W, 0], [W, 1], [4, 1], [4, H], [1, H], [1, 1], [0, 1]], cl = L(X, -0.35, X, 2.85, 'c');
    const HRp = [[X + r, 0], [4.5, 0], [4.5, 1], [4, 1], [4, H], [X + r, H]];
    O.goido = { id: 'goido', ten: 'Gối đỡ (SGK H.10.17)', W, D, H, c, cx: X, full, half, ghostHalf,
      views: {
        front: { W, H: 3.2, it: [PG(OL), L(0.5, 0, 0.5, 1, 'h'), L(4.5, 0, 4.5, 1, 'h'), L(X - r, 0, X - r, H, 'h'), L(X + r, 0, X + r, H, 'h'), cl] },
        half: { W, H: 3.2, it: [{ f: [HRp] }, PG(OL), L(X + r, 0, X + r, H), L(4.5, 0, 4.5, 1), cl] },
        hx1: { W, H: 3.2, it: [{ f: [HRp] }, PG(OL), L(X + r, 0, X + r, H), L(4.5, 0, 4.5, 1), L(0.5, 0, 0.5, 1, 'h'), L(X - r, 0, X - r, H, 'h'), cl], why: 'Ở nửa hình chiếu không vẽ nét đứt, vì phần bên trong đã thể hiện ở nửa hình cắt.' },
        hx2: { W, H: 3.2, it: [{ f: [HRp, [[0.5, 0], [X - r, 0], [X - r, H], [1, H], [1, 1], [0.5, 1]]] }, PG(OL), L(X + r, 0, X + r, H), L(X - r, 0, X - r, H), L(4.5, 0, 4.5, 1), L(0.5, 0, 0.5, 1), cl], why: 'Đây là hình cắt toàn bộ (cả hai nửa đều kẻ gạch), không phải hình cắt một nửa.' },
        hx3: { W, H: 3.2, it: [{ f: [[[X + r, 0], [W, 0], [W, 1], [4, 1], [4, H], [X + r, H]]] }, PG(OL), L(X + r, 0, X + r, H), cl], why: 'Tại vị trí cắt, rãnh bán nguyệt bên phải là khoảng trống nên không kẻ gạch và phải vẽ đường bao của rãnh.' }
      } };
  }
  /* các vật thể dùng cho hình chiếu trục đo */
  const TD = [...HC.OBJ.map(o => ({ id: o.id, ten: o.ten, W: o.W, D: o.D, H: o.H, F: o.F, views: o.views, anh: o.anh })),
    { id: 'tamlo', ten: O.tamlo.ten, W: 4, D: 3, H: 1.6, raw: O.tamlo.full, views: { front: O.tamlo.views.front, top: O.tamlo.views.top0, side: O.tamlo.views.side } },
    { id: 'ongvai', ten: O.ongvai.ten, W: 3, D: 3, H: 2.4, raw: O.ongvai.full, views: { front: O.ongvai.views.front, top: O.ongvai.views.top0, side: O.ongvai.views.side } }];
  const cache = {};
  const get = (id, kind) => { const kk = id + ':' + kind; if (!cache[kk]) { const ob = O[id] || TD.find(t => t.id === id); const src = kind === 'full' ? (ob.raw || ob.full) : ob[kind]; cache[kk] = prep(src()); } return cache[kk]; };
  const tdF = t => t.F || get(t.id, 'full');
  const mirror = t => { const kk = t.id + ':mir'; if (!cache[kk]) cache[kk] = prep(mirX(tdF(t), t.W)); return cache[kk]; };
  return { O, TD, get, tdF, mirror, R4 };
})();

/** vẽ hình chiếu trục đo theo từng bước (1: trục, 2: hộp bao, 3: từng phần, 4: hoàn thiện) */
function hctdDraw(canvas, T, type, step, frac = 1, o = {}) {
  const ctx = canvas.getContext('2d'), Wc = canvas.width, Hc = canvas.height, dp = window.devicePixelRatio || 1;
  const q = 0.5, c45 = Math.SQRT1_2, c30 = Math.cos(Math.PI / 6), { W, D, H } = T;
  const M = type === 'xien' ? { R1: [1, q * c45, 0], R2: [0, q * c45, 1], org: [0, D, 0], ax: [[1, 0, 0], [0, -1, 0], [0, 0, 1]] }
    : { R1: [c30, -c30, 0], R2: [0.5, 0.5, 1], org: [W, D, 0], ax: [[-1, 0, 0], [0, -1, 0], [0, 0, 1]] };
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  let V = cr(M.R1, M.R2); if (V[1] < 0) V = V.map(v => -v); const vl = Math.hypot(...V); V = V.map(v => v / vl);
  const dims = [W, D, H], ext = o.axes === false ? 0 : 1.3, axEnd = M.ax.map((a, i) => M.org.map((v, j) => v + a[j] * (dims[i] + ext)));
  const corners = [0, 1].flatMap(i => [0, 1].flatMap(j => [0, 1].map(l => [i * W, j * D, l * H])));
  const fitPts = o.axes === false ? corners : [...corners, ...axEnd];
  const sx = p => dot(M.R1, p), sy = p => dot(M.R2, p);
  const x0 = Math.min(...fitPts.map(sx)), x1 = Math.max(...fitPts.map(sx)), y0 = Math.min(...fitPts.map(sy)), y1 = Math.max(...fitPts.map(sy));
  const pad = (o.pad || 34) * dp, k = Math.min((Wc - 2 * pad) / (x1 - x0), (Hc - 2 * pad) / (y1 - y0));
  const ox = Wc / 2 - (x0 + x1) / 2 * k, oy = Hc / 2 + (y0 + y1) / 2 * k;
  const P = p => [ox + sx(p) * k, oy - sy(p) * k, dot(V, p)];
  const line = (a, b, col, lw, dash, al = 1) => { const A = P(a), B = P(b); ctx.globalAlpha = al; ctx.strokeStyle = col; ctx.lineWidth = lw * dp; ctx.setLineDash(dash ? dash.map(v => v * dp) : []); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; };
  const txt = (s, x, y, col, sz = 13, al = 1) => { ctx.globalAlpha = al; ctx.font = `700 ${Math.round(sz * dp)}px system-ui,sans-serif`; ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1; };
  ctx.clearRect(0, 0, Wc, Hc);
  const F = o.F || HCC.tdF(T);
  // 1. trục đo
  if (o.axes !== false) {
    const al = step >= 4 ? 0.35 : 1, Og = P(M.org);
    M.ax.forEach((a, i) => {
      line(M.org, axEnd[i], '#0f766e', 1.8, null, al);
      const E = P(axEnd[i]), an = Math.atan2(E[1] - Og[1], E[0] - Og[0]), hh = 10 * dp;
      ctx.globalAlpha = al; ctx.fillStyle = '#0f766e'; ctx.beginPath(); ctx.moveTo(E[0], E[1]); ctx.lineTo(E[0] - hh * Math.cos(an - 0.38), E[1] - hh * Math.sin(an - 0.38)); ctx.lineTo(E[0] - hh * Math.cos(an + 0.38), E[1] - hh * Math.sin(an + 0.38)); ctx.fill(); ctx.globalAlpha = 1;
      txt(['X′', 'Y′', 'Z′'][i], E[0] + 14 * dp * Math.cos(an), E[1] + 14 * dp * Math.sin(an), '#0f766e', 14, al);
    });
    txt('O′', Og[0] + 14 * dp, Og[1] - 12 * dp, '#0f766e', 13, al);
    if (step === 1) {
      const dirs = M.ax.map(a => { const E = P(M.org.map((v, j) => v + a[j])); return Math.atan2(E[1] - Og[1], E[0] - Og[0]); });
      const lab = type === 'xien' ? [[0, 2, '90°'], [0, 1, '135°'], [1, 2, '135°']] : [[0, 2, '120°'], [0, 1, '120°'], [1, 2, '120°']];
      lab.forEach(([i, j, s], n) => {
        let d = dirs[j] - dirs[i]; d = Math.atan2(Math.sin(d), Math.cos(d));
        const r = (34 + n * 6) * dp; ctx.strokeStyle = '#e11d48'; ctx.lineWidth = 1.6 * dp; ctx.beginPath(); ctx.arc(Og[0], Og[1], r, dirs[i], dirs[i] + d, d < 0); ctx.stroke();
        const mid = dirs[i] + d / 2; txt(s, Og[0] + (r + 16 * dp) * Math.cos(mid), Og[1] + (r + 16 * dp) * Math.sin(mid), '#e11d48', 13);
      });
    }
  }
  // 2. hộp bao
  if (step >= 2 && step <= 3) {
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    E.forEach(([a, b]) => line(corners[a], corners[b], '#2563eb', 1.3, [5, 4], step === 3 ? 0.55 : 1));
    if (step === 2) {
      const lab = [`${W * 10}`, type === 'xien' ? `${D * 10} × 0,5` : `${D * 10}`, `${H * 10}`];
      M.ax.forEach((a, i) => { const m = M.org.map((v, j) => v + a[j] * dims[i] / 2), Pm = P(m), C = P([W / 2, D / 2, H / 2]); const dx = Pm[0] - C[0], dy = Pm[1] - C[1], l = Math.hypot(dx, dy) || 1; txt(lab[i], Pm[0] + dx / l * 30 * dp, Pm[1] + dy / l * 30 * dp, '#1d4ed8', 13); });
    }
  }
  // 3. từng phần bằng nét mảnh
  if (step === 3) {
    const all = []; F.forEach(f => f.edges.forEach(e => all.push(e)));
    const n = Math.round(all.length * frac);
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.3 * dp; ctx.beginPath();
    all.slice(0, n).forEach(([a, b]) => { const A = P(a), B = P(b); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); });
    F.forEach(f => f.sil && f.sil.forEach(s => { if ((f.n[0] * V[0] + f.n[1] * V[1] + f.n[2] * V[2] < 0) !== (s.g.n[0] * V[0] + s.g.n[1] * V[1] + s.g.n[2] * V[2] < 0) && frac > 0.95) { const A = P(s.a), B = P(s.b); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); } }));
    ctx.stroke();
  }
  // 4. hoàn thiện
  if (step >= 4) hcPaint(ctx, Wc | 0, Hc | 0, F, P, V, dp, { k, lw: o.lw || 2.4 });
}

/* ================= BÀI 10. HÌNH CẮT VÀ MẶT CẮT ================= */
route(/^\/hcat$/, params => {
  const O = HCC.O, G = HCC.get;
  let tab = (params && params.get('tab')) || 'tb', oid = 'tamlo', hid = 'ongvai', step = 'obj', sc = null, qi = 0, qs = [], score = 0, ans = null, lt = null;
  const TABS = [['tb', '① Hình cắt toàn bộ'], ['mn', '② Hình cắt một nửa'], ['mc', '③ Mặt cắt'], ['lt', '④ Luyện tập']];
  const head = () => `<a href="#/onluyen">← Ôn luyện</a>${k10nav('#/hcat')}<h1>✂️ Hình cắt và mặt cắt</h1>
    <p class="sub">Dùng mặt phẳng cắt tưởng tượng để “nhìn” vào bên trong vật thể: hình cắt cho thấy cấu tạo bên trong rõ ràng, không phải vẽ nhiều nét đứt.</p>
    <div class="tabs hctabs">${TABS.map(([k, t]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const kill = () => { if (sc) { sc.destroy(); sc = null; } };
  const bindTop = () => $$('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; step = 'obj'; if (tab === 'lt') startLT(); else draw(); });
  const stepBar = S => `<div class="hcsteps" style="grid-template-columns:repeat(${S.length},minmax(0,1fr))">${S.map(([k, t]) => `<button data-step="${k}" class="${step === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const ctrl = () => `<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px"><button class="btn ghost sm" id="iso">Góc nhìn ban đầu</button><button class="btn ghost sm" id="fr">Nhìn thẳng từ trước</button><button class="btn ghost sm" id="rp">▶ Xem lại</button></div>`;
  const fig = (v, cap, cell = 36) => `<figure class="hcfig">${HC.svg(v, cell)}<figcaption>${cap}</figcaption></figure>`;
  const plane = (ob, al = 0.2) => (ctx, P, dp) => {
    // mặt phẳng cắt đặt chính giữa vật thể, vừa khít từ đáy đến mặt trên
    const { W, H, c } = ob, C = [[0, c, 0], [W, c, 0], [W, c, H], [0, c, H]];
    hcPoly3(ctx, P, C, dp, '#e11d48', al, '#e11d48', 2.2);
    const T = P([0, c, H]); hcTag(ctx, T[0] + 56 * dp, T[1] - 8 * dp, 'Mặt phẳng cắt A', '#e11d48', dp);
  };
  const fitOf = (ob, extra = []) => { const { W, D, H } = ob; return [[-0.7, -0.3, -0.6], [W + 0.7, D, H + 0.6], ...extra]; };
  const draw = () => {
    kill();
    if (tab === 'mc') return drawMC();
    const half = tab === 'mn', ob = half ? O[hid] : O[oid], V = ob.views;
    const S = half ? [['obj', '1. Vật thể đối xứng'], ['cut', '2. Cắt bỏ 1/4 vật thể'], ['res', '3. Hình cắt một nửa']]
      : [['obj', '1. Quan sát vật thể'], ['plane', '2. Đặt mặt phẳng cắt'], ['cut', '3. Bỏ phần phía trước'], ['res', '4. Chiếu → hình cắt']];
    const TXT = {
      obj: half ? esc(ob.ten.replace(/ \(.*\)$/, '')) + ' là vật thể <b>đối xứng</b>. Với vật thể đối xứng, ta chỉ cần cắt <b>một nửa</b>: nửa này thể hiện hình dạng bên ngoài, nửa kia thể hiện cấu tạo bên trong.'
        : 'Vật thể có lỗ bên trong. Trên hình chiếu đứng, các đường bao của lỗ bị che khuất nên phải vẽ <b>nét đứt</b> – càng nhiều lỗ, rãnh thì bản vẽ càng rối, khó đọc.',
      plane: 'Dùng một <b>mặt phẳng cắt tưởng tượng A</b> song song với mặt phẳng chiếu đứng, đi qua tâm lỗ, cắt vật thể làm hai phần.',
      cut: half ? 'Dùng hai mặt phẳng cắt vuông góc với nhau, cắt bỏ <b>1/4 vật thể</b> ở phía trước, bên phải. Các phần vật thể tiếp xúc với mặt phẳng cắt chính là <b>mặt cắt</b> (tô gạch đỏ).'
        : 'Tưởng tượng <b>bỏ đi phần vật thể ở giữa người quan sát và mặt phẳng cắt</b>. Phần vật thể tiếp xúc với mặt phẳng cắt gọi là <b>mặt cắt</b> (tô gạch đỏ).',
      res: half ? '<b>Hình cắt một nửa</b> (bán phần) gồm <b>nửa hình chiếu</b> ghép với <b>nửa hình cắt</b>, ranh giới là <b>đường trục đối xứng</b> (nét chấm gạch mảnh). Nửa hình cắt thường đặt bên phải; ở nửa hình chiếu <b>không vẽ nét đứt</b>.<br><span class="hint">Ngoài ra còn có <b>hình cắt cục bộ</b>: chỉ cắt một phần nhỏ của vật thể để thể hiện cấu tạo chỗ đó; ranh giới với phần hình chiếu vẽ bằng <b>nét lượn sóng</b>.</span>'
        : 'Chiếu phần vật thể còn lại lên mặt phẳng chiếu đứng được <b>hình cắt</b>. <b>Mặt cắt kẻ gạch gạch</b> (nét liền mảnh, nghiêng 45°); phần lỗ là khoảng trống nên <b>không kẻ gạch</b>; đường bao của lỗ nay đã thấy nên vẽ <b>nét liền đậm</b>. Vị trí mặt phẳng cắt ghi trên hình chiếu bằng bằng <b>nét cắt</b>, <b>mũi tên</b> chỉ hướng chiếu và chữ <b>A</b>; trên hình cắt ghi <b>A – A</b>.'
    };
    const extraFig = step === 'obj' && !half ? `<div class="hcfigs">${fig(V.front, 'Hình chiếu đứng: lỗ vẽ bằng nét đứt')}</div>`
      : step === 'res' ? (half ? `<div class="hcfigs">${fig(V.front, 'Hình chiếu đứng (nét đứt)')}${fig(V.half, '<b>Hình cắt một nửa</b>')}</div>`
        : `<div class="hcfigs">${fig(V.front, 'Hình chiếu đứng (nét đứt)')}${fig(V.sec, '<b>Hình cắt A – A</b>')}${fig(V.top, 'Hình chiếu bằng – vị trí mặt phẳng cắt A', 28)}</div>`) : '';
    setView(`${head()}
      <div class="card"><b>Chọn vật thể</b><div class="gcpick">${(half ? ['ongvai', 'goido'] : ['tamlo', 'khay', 'lco', 'ongvai', 'td16']).map((k, i) => `<button class="${k === (half ? hid : oid) ? 'on' : ''}" data-o="${k}">Hình ${i + 1}. ${O[k].ten}</button>`).join('')}</div></div>
      <div class="card">${stepBar(S)}<canvas id="hc3d" class="hc3d"></canvas>${ctrl()}
        <div class="expl" style="margin-top:10px"><b class="t">${S.find(s => s[0] === step)[1]}</b>${TXT[step]}</div>${extraFig}
        ${step !== 'res' ? `<button class="btn block" id="next" style="margin-top:8px">Tiếp: ${S[S.findIndex(s => s[0] === step) + 1][1].replace(/^\d\. /, '')} →</button>`
          : `<button class="btn block" data-tab="${half ? 'mc' : 'mn'}" style="margin-top:10px">Tiếp: ${half ? 'Mặt cắt' : 'Hình cắt một nửa'} →</button>`}</div>`);
    bindTop();
    $$('[data-o]').forEach(b => b.onclick = () => { if (half) hid = b.dataset.o; else oid = b.dataset.o; step = 'obj'; draw(); });
    $$('[data-step]').forEach(b => b.onclick = () => { step = b.dataset.step; draw(); });
    if ($('#next')) $('#next').onclick = () => { step = S[S.findIndex(s => s[0] === step) + 1][0]; draw(); };
    const yaw0 = half ? -0.62 : 0.62, full = G(ob.id, 'full');
    const cutF = half ? G(ob.id, 'half') : G(ob.id, 'cut'), ghost = half ? G(ob.id, 'ghostHalf') : G(ob.id, 'ghost');
    const gdir = half ? [1, -1, 0] : [0, -1, 0];
    sc = HCView($('#hc3d'), { yaw: yaw0, fit: fitOf(ob, step === 'cut' ? [[ob.W + (half ? 2.5 : 0), -3, 0]] : []), layers: [] });
    const play = () => {
      if (step === 'obj') sc.set({ layers: [{ F: full }], over: null });
      else if (step === 'plane') sc.set({ layers: [{ F: full }], over: plane(ob) });
      else if (step === 'cut') {
        sc.set({ layers: [{ F: cutF }, { F: ghost, alpha: 1, off: [0, 0, 0] }], over: half ? null : plane(ob, 0.08) });
        setTimeout(() => sc && sc.anim(e => sc.put({ layers: [{ F: cutF }, { F: ghost, alpha: 1 - e, off: gdir.map(v => v * e * 3) }] }), 1800), 500);
      } else { sc.set({ layers: [{ F: cutF }], over: null }); setTimeout(() => sc && sc.view(0, 0, 1100), 400); }
    };
    play();
    $('#iso').onclick = () => sc.view(yaw0, 0.42); $('#fr').onclick = () => sc.view(0, 0);
    $('#rp').onclick = () => { sc.st.yaw = yaw0; sc.st.pitch = 0.42; play(); };
  };
  /* ---- Mặt cắt ---- */
  const drawMC = () => {
    const ob = O.truc, V = ob.views;
    const S = [['obj', '1. Quan sát vật thể'], ['plane', '2. Mặt phẳng cắt ⟂ trục'], ['sec', '3. Lấy mặt cắt'], ['rot', '4. Xoay mặt cắt → bản vẽ']];
    const TXT = {
      obj: 'Trục có <b>rãnh then</b> (đoạn A) và <b>đầu vuông</b> (đoạn B). Chỉ nhìn hình chiếu đứng khó biết tiết diện của trục có hình dạng gì.',
      plane: 'Dùng các <b>mặt phẳng cắt vuông góc với trục</b> tại A và B.',
      sec: '<b>Mặt cắt</b> là hình biểu diễn <b>chỉ phần vật thể tiếp xúc với mặt phẳng cắt</b> (không vẽ phần vật thể phía sau như hình cắt). Mặt cắt dùng để thể hiện <b>hình dạng tiết diện</b> của vật thể.',
      rot: 'Xoay mặt cắt về song song với mặt phẳng hình chiếu rồi vẽ. <b>Mặt cắt rời</b>: vẽ ở <b>ngoài hình chiếu</b>, đường bao vẽ <b>nét liền đậm</b>, thường đặt trên đường kéo dài của vết mặt phẳng cắt. <b>Mặt cắt chập</b>: vẽ <b>ngay trên hình chiếu</b>, đường bao vẽ <b>nét liền mảnh</b>.'
    };
    const extra = step === 'obj' ? `<div class="hcfigs">${fig(V.front, 'Hình chiếu đứng của trục', 44)}</div>`
      : step === 'rot' ? `<div class="hcfigs">${fig(V.roi, '<b>Mặt cắt rời</b> – vẽ ngoài hình chiếu, nét liền đậm', 44)}${fig(V.chap, '<b>Mặt cắt chập</b> – vẽ trên hình chiếu, nét liền mảnh', 44)}</div>` : '';
    setView(`${head()}<div class="card">${stepBar(S)}<canvas id="hc3d" class="hc3d"></canvas>${ctrl()}
      <div class="expl" style="margin-top:10px"><b class="t">${S.find(s => s[0] === step)[1]}</b>${TXT[step]}</div>${extra}
      ${step !== 'rot' ? `<button class="btn block" id="next" style="margin-top:8px">Tiếp: ${S[S.findIndex(s => s[0] === step) + 1][1].replace(/^\d\. /, '')} →</button>` : '<button class="btn block" data-tab="lt" style="margin-top:10px">Tiếp: Luyện tập →</button>'}</div>`);
    bindTop();
    $$('[data-step]').forEach(b => b.onclick = () => { step = b.dataset.step; draw(); });
    if ($('#next')) $('#next').onclick = () => { step = S[S.findIndex(s => s[0] === step) + 1][0]; draw(); };
    const F = G('truc', 'full'), secs = [[ob.cA, ob.K, 'A'], [ob.cB, ob.SQ, 'B']];
    let e = 0;
    const over = (ctx, P, dp) => {
      if (step === 'obj') return;
      secs.forEach(([c, pr, lab]) => {
        if (step === 'plane' || step === 'sec') {
          hcPoly3(ctx, P, [[c, -0.6, -0.6], [c, 2.6, -0.6], [c, 2.6, 2.6], [c, -0.6, 2.6]], dp, '#e11d48', step === 'plane' ? 0.16 : 0.08, '#e11d48', 2);
          const T = P([c, -0.6, 2.6]); hcTag(ctx, T[0], T[1] - 4 * dp, lab, '#e11d48', dp);
        }
        if (step === 'sec' || step === 'rot') {
          const th = e * Math.PI / 2, pts = pr.map(([y, z]) => [c - (y - 1) * Math.sin(th), 1 + (y - 1) * Math.cos(th) - 2.2 * e, z - 2.6 * e]);
          hcPoly3(ctx, P, pts, dp, 'hatch', 1, '#7f1d1d', 2.4);
          if (step === 'rot' && e > 0.98) { const T = P([c, -1.2, -1.7]); hcTag(ctx, T[0], T[1] + 26 * dp, 'Mặt cắt ' + lab, '#7f1d1d', dp); }
        }
      });
    };
    sc = HCView($('#hc3d'), { fit: [[-0.4, -1.4, -2], [5.9, 2.4, 2.6]], layers: [{ F }], over });
    const play = () => {
      e = 0;
      if (step === 'sec') sc.set({ layers: [{ F, alpha: 0.3 }] });
      else if (step === 'rot') { sc.set({ layers: [{ F, alpha: 0.35 }] }); setTimeout(() => sc && sc.anim(t => { e = t; sc.st.yaw = 0.62 * (1 - t); sc.st.pitch = 0.42 * (1 - t); }, 2200, () => sc && sc.set({ layers: [{ F, alpha: 1 }] })), 400); }
      else sc.set({ layers: [{ F }] });
    };
    play();
    $('#iso').onclick = () => sc.view(0.62, 0.42); $('#fr').onclick = () => sc.view(0, 0);
    $('#rp').onclick = () => { sc.st.yaw = 0.62; sc.st.pitch = 0.42; play(); };
  };
  /* ---- Luyện tập: HS chọn hình, bấm Cắt, rồi chọn hình cắt đúng ---- */
  const LT = [
    { id: 'tamlo', kind: 'full', lv: 1, ds: ['x1', 'x2', 'x3'] }, { id: 'khay', kind: 'full', lv: 1, ds: ['x1', 'x2', 'x3'] },
    { id: 'lco', kind: 'full', lv: 2, ds: ['x1', 'x2', 'x3'] }, { id: 'ongvai', kind: 'full', lv: 2, ds: ['x1', 'x2', 'x3'] },
    { id: 'td16', kind: 'full', lv: 3, ds: ['x1', 'x3', 'x4', 'x2'] }, { id: 'ongvai', kind: 'half', lv: 2, ds: ['hx1', 'sec', 'hx3'] },
    { id: 'goido', kind: 'half', lv: 3, ds: ['hx1', 'hx2', 'hx3'] }, { id: 'truc', kind: 'mc', lv: 2, ds: ['sX1', 'sX2', 'sX3'] }
  ];
  const ltName = t => (t.kind === 'half' ? 'Hình cắt một nửa – ' : t.kind === 'mc' ? 'Mặt cắt – ' : '') + O[t.id].ten;
  const ltDone = () => store.get('hcat_lt_' + uid(), {});
  const startLT = () => { lt = { i: lt ? lt.i : 0, phase: 'pre', ans: null, opts: null }; drawLT(); };
  const drawLT = () => {
    kill();
    const t = LT[lt.i], ob = O[t.id], V = ob.views, done = ltDone(), nOk = LT.filter((x, i) => done[i]).length;
    if (!lt.opts) { const key = t.kind === 'half' ? 'half' : t.kind === 'mc' ? 'sA' : 'sec'; lt.opts = shuffle([{ v: V[key], ok: true }, ...shuffle(t.ds).slice(0, 3).map(k => ({ v: V[k] }))]); }
    const ph = lt.phase, ch = lt.ans != null ? lt.opts[lt.ans] : null;
    const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);
    const STEM = { full: 'Bấm <b>✂️ Cắt vật thể</b> để cắt bằng mặt phẳng cắt A (đi qua chính giữa vật thể) và bỏ phần phía trước. Sau đó chọn <b>hình cắt A – A</b> đúng.', half: 'Bấm <b>✂️ Cắt vật thể</b> để cắt bỏ 1/4 vật thể phía trước, bên phải. Sau đó chọn <b>hình cắt một nửa</b> đúng.', mc: 'Bấm <b>✂️ Cắt vật thể</b> để cắt trục bằng mặt phẳng vuông góc với trục tại A. Sau đó chọn <b>mặt cắt</b> đúng.' }[t.kind];
    setView(`${head()}
      <div class="card"><div class="row" style="align-items:center"><b class="grow">Chọn hình để luyện tập</b><span class="pill">Đúng ${nOk}/${LT.length} hình</span></div>
        <div class="gcpick">${LT.map((x, i) => `<button class="${i === lt.i ? 'on' : ''}" data-lt="${i}">${done[i] ? '✔ ' : ''}Hình ${i + 1}. ${esc(ltName(x))} <span style="color:#d97706">${stars(x.lv)}</span></button>`).join('')}
          <button data-lt="txt">📝 Câu hỏi lý thuyết</button></div></div>
      <div class="qcard"><div class="stem"><b>Hình ${lt.i + 1}. ${esc(ltName(t))}</b> <span style="color:#d97706">${stars(t.lv)}</span><br>${STEM}</div>
        <canvas id="hc3d" class="hc3d" style="height:300px"></canvas>
        <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">${ph === 'pre' ? '<button class="btn" id="cut">✂️ Cắt vật thể</button>' : '<button class="btn ghost sm" id="again">↺ Xem lại vật thể</button><button class="btn ghost sm" id="fr">Nhìn thẳng từ trước</button>'}</div>
        ${ph !== 'pre' ? `<div class="stem" style="margin-top:12px">Chọn <b>${t.kind === 'half' ? 'hình cắt một nửa' : t.kind === 'mc' ? 'mặt cắt tại A' : 'hình cắt A – A'}</b> đúng:</div>
          <div class="hcopts">${lt.opts.map((o, i) => `<button class="hcopt ${ch ? (o.ok ? 'ok' : i === lt.ans ? 'bad' : '') : ''}" data-a="${i}" ${ch ? 'disabled' : ''}><span class="hcoptl">${'ABCD'[i]}</span>${HC.svg(o.v, t.kind === 'mc' ? 40 : 30)}</button>`).join('')}</div>` : ''}
        ${ch ? `<div class="expl ${ch.ok ? 'ans' : ''}"><b class="t">${ch.ok ? '✔ Chính xác!' : '✘ Chưa đúng.'}</b>${ch.ok ? 'Mặt cắt kẻ gạch gạch, chỗ trống (lỗ, rãnh) không kẻ gạch, đường bao thấy vẽ nét liền đậm.' : (ch.v.why || '') + ' Đáp án đúng là ' + 'ABCD'[lt.opts.findIndex(o => o.ok)] + '.'}</div>
          <div class="row" style="gap:8px;margin-top:10px"><button class="btn ghost" id="redo">↺ Làm lại hình này</button><button class="btn grow" id="nx">${lt.i < LT.length - 1 ? 'Hình tiếp →' : 'Về Hình 1'}</button></div>` : ''}</div>`);
    bindTop();
    $$('[data-lt]').forEach(b => b.onclick = () => { if (b.dataset.lt === 'txt') return startTxt(); lt = { i: +b.dataset.lt, phase: 'pre', ans: null, opts: null }; drawLT(); });
    // cảnh 3D
    if (t.kind === 'mc') {
      let e = 0;
      const sec = (ctx, P, dp) => {
        hcPoly3(ctx, P, [[ob.cA, -0.6, -0.6], [ob.cA, 2.6, -0.6], [ob.cA, 2.6, 2.6], [ob.cA, -0.6, 2.6]], dp, '#e11d48', 0.14, '#e11d48', 2);
        const T = P([ob.cA, -0.6, 2.6]); hcTag(ctx, T[0], T[1] - 4 * dp, 'A', '#e11d48', dp);
        if (ph !== 'pre' || e > 0) hcPoly3(ctx, P, ob.K.map(([y, z]) => [ob.cA, y - 2.2 * e, z]), dp, 'hatch', 1, '#7f1d1d', 2.4);
      };
      sc = HCView($('#hc3d'), { fit: [[-0.4, -2.6, -0.6], [5.9, 2.6, 2.6]], layers: [{ F: G('truc', 'full'), alpha: ph === 'pre' ? 1 : 0.35 }], over: sec });
      if (ph === 'cut') { e = 0; setTimeout(() => sc && sc.anim(x => { e = x; sc.put({ layers: [{ F: G('truc', 'full'), alpha: 1 - 0.65 * x }] }); }, 1300, () => { lt.phase = 'ask'; }), 200); }
      else if (ph === 'ask') e = 1;
    } else {
      const half = t.kind === 'half', full = G(ob.id, 'full'), cutF = G(ob.id, half ? 'half' : 'cut'), ghost = G(ob.id, half ? 'ghostHalf' : 'ghost'), gdir = half ? [1, -1, 0] : [0, -1, 0];
      sc = HCView($('#hc3d'), { yaw: half ? -0.62 : 0.62, fit: [[0, -0.3, 0], [ob.W, ob.D, ob.H], [ob.W + (half ? 2.2 : 0), -2.6, 0]], layers: [{ F: ph === 'pre' ? full : cutF }], over: ph === 'pre' && !half ? plane(ob, 0.2) : null });
      if (ph === 'cut') { sc.set({ layers: [{ F: cutF }, { F: ghost, alpha: 1 }], over: half ? null : plane(ob, 0.08) }); setTimeout(() => sc && sc.anim(e => sc.put({ layers: [{ F: cutF }, { F: ghost, alpha: 1 - e, off: gdir.map(v => v * e * 2.6) }] }), 1500, () => { lt.phase = 'ask'; sc && sc.set({ over: null }); }), 250); }
    }
    if ($('#cut')) $('#cut').onclick = () => { lt.phase = 'cut'; drawLT(); };
    if ($('#again')) $('#again').onclick = () => { lt.phase = 'pre'; lt.ans = null; drawLT(); };
    if ($('#fr')) $('#fr').onclick = () => sc && sc.view(0, 0);
    $$('[data-a]').forEach(b => b.onclick = () => {
      lt.ans = +b.dataset.a; lt.phase = 'ask';
      const d = ltDone(); if (lt.opts[lt.ans].ok) d[lt.i] = 1; store.set('hcat_lt_' + uid(), d);
      const hk = 'hist_' + uid(), hist = store.get(hk, []); hist.push({ t: Date.now(), title: 'Hình cắt – ' + ltName(t), key: '', loai: 'game', diem: lt.opts[lt.ans].ok ? 10 : 0, dung: lt.opts[lt.ans].ok ? 1 : 0, tong: 1, giay: 0 }); store.set(hk, hist.slice(-300));
      drawLT();
    });
    if ($('#redo')) $('#redo').onclick = () => { lt = { i: lt.i, phase: 'pre', ans: null, opts: null }; drawLT(); };
    if ($('#nx')) $('#nx').onclick = () => { lt = { i: (lt.i + 1) % LT.length, phase: 'pre', ans: null, opts: null }; drawLT(); };
  };
  /* câu hỏi lý thuyết */
  const startTxt = () => {
    qs = [
      { stem: 'Trên hình cắt, phần nào được kẻ gạch gạch?', opts: shuffle([{ t: 'Phần vật thể tiếp xúc với mặt phẳng cắt', ok: true }, { t: 'Phần vật thể ở sau mặt phẳng cắt', why: 'Phần sau mặt phẳng cắt chỉ vẽ đường bao, không kẻ gạch.' }, { t: 'Các lỗ, rãnh của vật thể', why: 'Lỗ, rãnh là khoảng trống, không kẻ gạch.' }, { t: 'Toàn bộ hình biểu diễn', why: 'Chỉ mặt cắt mới kẻ gạch.' }]) },
      { stem: 'Hình cắt một nửa thường dùng để biểu diễn vật thể nào?', opts: shuffle([{ t: 'Vật thể đối xứng', ok: true }, { t: 'Vật thể chỉ cần thể hiện một phần rất nhỏ bên trong', why: 'Trường hợp này dùng hình cắt cục bộ.' }, { t: 'Vật thể đặc, không có phần rỗng', why: 'Vật thể đặc không cần hình cắt.' }, { t: 'Mọi vật thể', why: 'Chỉ dùng được khi vật thể đối xứng.' }]) },
      { stem: 'Đường bao của mặt cắt chập được vẽ bằng nét gì?', opts: shuffle([{ t: 'Nét liền mảnh', ok: true }, { t: 'Nét liền đậm', why: 'Nét liền đậm dùng cho đường bao mặt cắt rời.' }, { t: 'Nét đứt mảnh', why: 'Nét đứt dùng cho đường bao khuất.' }, { t: 'Nét lượn sóng', why: 'Nét lượn sóng dùng cho giới hạn hình cắt cục bộ.' }]) },
      { stem: 'Vị trí mặt phẳng cắt trên bản vẽ được thể hiện bằng', opts: shuffle([{ t: 'nét cắt (nét gạch dài chấm đậm) kèm mũi tên và chữ hoa', ok: true }, { t: 'nét liền mảnh', why: 'Nét liền mảnh dùng cho đường kích thước, đường gạch gạch.' }, { t: 'nét lượn sóng', why: 'Nét lượn sóng dùng cho giới hạn hình cắt cục bộ.' }, { t: 'nét đứt mảnh', why: 'Nét đứt dùng cho đường bao khuất.' }]) }
    ];
    qi = 0; score = 0; ans = null; drawTxt();
  };
  const drawTxt = () => {
    kill();
    if (qi >= qs.length) { setView(`${head()}<div class="hero"><h1>Hoàn thành! 🎉</h1><p class="sub">Em làm đúng <b>${score}/${qs.length}</b> câu lý thuyết.</p></div><div class="row"><button class="btn" id="back">← Quay lại luyện tập hình</button></div>`); bindTop(); $('#back').onclick = () => drawLT(); return; }
    const q = qs[qi], ch = ans != null ? q.opts[ans] : null;
    setView(`${head()}<div class="qbar"><div class="title">Câu lý thuyết ${qi + 1}/${qs.length}</div><span class="timer">✔ ${score}</span></div>
      <div class="qcard"><div class="stem">${q.stem}</div><div class="hcopts txt">${q.opts.map((o, i) => `<button class="hcopt ${ch ? (o.ok ? 'ok' : i === ans ? 'bad' : '') : ''}" data-a="${i}" ${ch ? 'disabled' : ''}><span class="hcoptl">${'ABCD'[i]}</span><span>${o.t}</span></button>`).join('')}</div>
      ${ch ? `<div class="expl ${ch.ok ? 'ans' : ''}"><b class="t">${ch.ok ? '✔ Chính xác!' : '✘ Chưa đúng.'}</b>${ch.ok ? '' : ch.why || ''}</div><button class="btn block" id="nx" style="margin-top:10px">${qi < qs.length - 1 ? 'Câu tiếp →' : 'Xem kết quả'}</button>` : ''}</div>`);
    bindTop();
    $$('[data-a]').forEach(b => b.onclick = () => { ans = +b.dataset.a; if (q.opts[ans].ok) score++; drawTxt(); });
    if ($('#nx')) $('#nx').onclick = () => { qi++; ans = null; drawTxt(); };
  };
  cleanup = kill;
  if (tab === 'lt') startLT(); else draw();
});

/* ================= BÀI 11. HÌNH CHIẾU TRỤC ĐO ================= */
route(/^\/hctd$/, params => {
  const TD = HCC.TD;
  let tab = (params && params.get('tab')) || 'vgd', ti = 0, step = 1, raf = 0, qs = [], qi = 0, score = 0, ans = null;
  const TABS = [['vgd', '① Vuông góc đều'], ['xgc', '② Xiên góc cân'], ['ss', '③ So sánh'], ['lt', '④ Luyện tập']];
  const head = () => `<a href="#/onluyen">← Ôn luyện</a>${k10nav('#/hctd')}<h1>🧊 Hình chiếu trục đo</h1>
    <p class="sub">Hình chiếu trục đo là hình biểu diễn <b>ba chiều</b> của vật thể trên một mặt phẳng, giúp hình dung nhanh hình dạng vật thể từ bản vẽ ba hình chiếu.</p>
    <div class="tabs hctabs">${TABS.map(([k, t]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const kill = () => cancelAnimationFrame(raf);
  const bindTop = () => $$('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; step = 1; if (tab === 'lt') startLT(); else draw(); });
  const sizeCv = cv => { const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1; cv.width = Math.max(200, r.width * d); cv.height = Math.max(160, r.height * d); };
  const draw = () => {
    kill();
    if (tab === 'ss') return drawSS();
    const type = tab === 'xgc' ? 'xien' : 'vgd', T = TD[ti];
    const S = [[1, 'B1. Vẽ trục đo'], [2, 'B2. Vẽ hình hộp bao'], [3, 'B3. Vẽ từng phần'], [4, 'B4. Tô đậm, hoàn thiện']];
    const P1 = type === 'xien' ? 'Góc trục đo: <b>X′O′Z′ = 90°</b>, <b>X′O′Y′ = Y′O′Z′ = 135°</b>. Hệ số biến dạng: <b>p = r = 1</b>, <b>q = 0,5</b>. Mặt phẳng X′O′Z′ song song với mặt phẳng hình chiếu nên mặt trước của vật thể <b>giữ nguyên hình dạng thật</b>.'
      : 'Góc trục đo: <b>X′O′Y′ = Y′O′Z′ = X′O′Z′ = 120°</b>, trục O′Z′ thẳng đứng. Hệ số biến dạng (quy ước): <b>p = q = r = 1</b>.';
    const TXT = {
      1: 'Vẽ hệ trục đo O′X′Y′Z′. ' + P1,
      2: `Đọc kích thước <b>dài × rộng × cao = ${T.W * 10} × ${T.D * 10} × ${T.H * 10}</b> (mm) trên bản vẽ ba hình chiếu. Đặt các kích thước theo các trục (nhân với hệ số biến dạng${type === 'xien' ? `: chiều rộng chỉ vẽ ${T.D * 10} × 0,5 = ${T.D * 5}` : ''}) rồi vẽ <b>hình hộp bao ngoài</b> vật thể bằng nét mảnh.`,
      3: 'Dựa vào ba hình chiếu, xác định và vẽ <b>từng phần</b> của vật thể (bậc, vát, rãnh, lỗ…) bằng nét mảnh trong hình hộp. Các cạnh song song với trục nào thì vẽ song song với trục đo đó. <b>Đường tròn</b> nằm trên các mặt nghiêng thành <b>hình elip</b>.',
      4: 'Xóa các nét dựng hình và các nét bị che khuất, <b>tô đậm các cạnh thấy</b>. Hình chiếu trục đo thường <b>không vẽ nét đứt</b>.'
    };
    setView(`${head()}
      <div class="card"><b>Chọn vật thể</b><div class="gcpick">${TD.map((t, i) => `<button class="${i === ti ? 'on' : ''}" data-t="${i}">Hình ${i + 1}. ${esc(t.ten.replace(/ \(hình mẫu của cô\)/, ''))}</button>`).join('')}</div></div>
      <div class="hcpractice">
        <div class="card"><b>Bản vẽ ba hình chiếu</b>${hcLayoutHtml(T, 1, { cell: 22 })}</div>
        <div class="card"><div class="hcsteps">${S.map(([k, t]) => `<button data-step="${k}" class="${step === k ? 'on' : ''}">${t}</button>`).join('')}</div>
          <canvas id="td" class="hc3d" style="height:340px;cursor:default"></canvas>
          <div class="expl" style="margin-top:10px"><b class="t">${S[step - 1][1]}</b>${TXT[step]}</div>
          ${step < 4 ? `<button class="btn block" id="next" style="margin-top:8px">Tiếp: ${S[step][1]} →</button>` : `<button class="btn block" data-tab="${type === 'xien' ? 'ss' : 'xgc'}" style="margin-top:10px">Tiếp: ${type === 'xien' ? 'So sánh hai loại' : 'Hình chiếu trục đo xiên góc cân'} →</button>`}</div></div>`);
    bindTop();
    $$('[data-t]').forEach(b => b.onclick = () => { ti = +b.dataset.t; step = 1; draw(); });
    $$('[data-step]').forEach(b => b.onclick = () => { step = +b.dataset.step; draw(); });
    if ($('#next')) $('#next').onclick = () => { step++; draw(); };
    const cv = $('#td');
    setTimeout(() => {
      sizeCv(cv);
      if (step === 3) { const t0 = performance.now(); const go = now => { const f = Math.min(1, (now - t0) / 1800); hctdDraw(cv, T, type, 3, f); if (f < 1) raf = requestAnimationFrame(go); }; raf = requestAnimationFrame(go); }
      else hctdDraw(cv, T, type, step);
    }, 0);
  };
  const drawSS = () => {
    const T = TD[ti];
    setView(`${head()}<div class="card"><b>Chọn vật thể</b><div class="gcpick">${TD.map((t, i) => `<button class="${i === ti ? 'on' : ''}" data-t="${i}">Hình ${i + 1}</button>`).join('')}</div></div>
      <div class="hccompare"><div class="card"><h3 style="margin-top:0;color:#0f766e">Vuông góc đều</h3><canvas id="c1" class="hc3d" style="height:280px;cursor:default"></canvas></div>
        <div class="card"><h3 style="margin-top:0;color:#7c3aed">Xiên góc cân</h3><canvas id="c2" class="hc3d" style="height:280px;cursor:default"></canvas></div></div>
      <div class="card"><div class="tablewrap"><table><thead><tr><th></th><th>Vuông góc đều</th><th>Xiên góc cân</th></tr></thead><tbody>
        <tr><td><b>Phương chiếu</b></td><td>Vuông góc với mặt phẳng hình chiếu</td><td>Xiên góc với mặt phẳng hình chiếu</td></tr>
        <tr><td><b>Góc trục đo</b></td><td>X′O′Y′ = Y′O′Z′ = X′O′Z′ = 120°</td><td>X′O′Z′ = 90°; X′O′Y′ = Y′O′Z′ = 135°</td></tr>
        <tr><td><b>Hệ số biến dạng</b></td><td>p = q = r = 1 (quy ước)</td><td>p = r = 1; q = 0,5</td></tr>
        <tr><td><b>Đặc điểm</b></td><td>Ba mặt của vật thể biến dạng như nhau; đường tròn ở cả ba mặt đều thành elip</td><td>Mặt song song với X′O′Z′ giữ nguyên hình dạng thật → thuận lợi khi vật thể có nhiều đường tròn ở mặt trước</td></tr>
        <tr><td><b>Giống nhau</b></td><td colspan="2">Đều là hình biểu diễn ba chiều trên một mặt phẳng, vẽ theo các bước: trục đo → hình hộp bao → từng phần → tô đậm; các cạnh song song trên vật thể vẫn song song trên hình chiếu trục đo.</td></tr></tbody></table></div></div>
      <div class="card"><button class="btn block" data-tab="lt">Tiếp: Luyện tập →</button></div>`);
    bindTop();
    $$('[data-t]').forEach(b => b.onclick = () => { ti = +b.dataset.t; drawSS(); });
    setTimeout(() => { [['#c1', 'vgd'], ['#c2', 'xien']].forEach(([s, ty]) => { const cv = $(s); sizeCv(cv); hctdDraw(cv, T, ty, 4); }); }, 0);
  };
  const startLT = () => {
    const asym = { bacvat: 1, giado: 1, lco: 1, chuL91: 1, giado910: 1, vat1114: 1 };
    qs = shuffle(TD.map((t, i) => {
      const others = shuffle(TD.filter((u, j) => j !== i));
      const opts = [{ T: t, ok: true }];
      if (asym[t.id]) opts.push({ T: t, F: HCC.mirror(t), why: 'Hình này bị lật trái – phải so với bản vẽ ba hình chiếu.' });
      while (opts.length < 3) { const u = others.shift(); opts.push({ T: u, why: 'Hình dạng vật thể này không khớp với ba hình chiếu.' }); }
      return { t, type: Math.random() < 0.5 ? 'vgd' : 'xien', opts: shuffle(opts) };
    }));
    qi = 0; score = 0; ans = null; drawLT();
  };
  const drawLT = () => {
    kill();
    if (qi >= qs.length) {
      const hk = 'hist_' + uid(), hist = store.get(hk, []); hist.push({ t: Date.now(), title: 'Hình chiếu trục đo – luyện tập', key: '', loai: 'game', diem: Math.round(score / qs.length * 1000) / 100, dung: score, tong: qs.length, giay: 0 }); store.set(hk, hist.slice(-300));
      setView(`${head()}<div class="hero"><h1>Hoàn thành! 🎉</h1><p class="sub">Em làm đúng <b>${score}/${qs.length}</b> câu.</p></div><div class="row"><button class="btn" id="again">Làm lại</button></div>`);
      bindTop(); $('#again').onclick = startLT; return;
    }
    const q = qs[qi], done = ans != null, ch = done ? q.opts[ans] : null;
    setView(`${head()}<div class="qbar"><div class="title">Câu ${qi + 1}/${qs.length}</div><span class="timer">✔ ${score}</span></div>
      <div class="qcard"><div class="stem">Quan sát bản vẽ ba hình chiếu (phương pháp chiếu góc thứ nhất). Chọn <b>hình chiếu trục đo ${q.type === 'xien' ? 'xiên góc cân' : 'vuông góc đều'}</b> đúng của vật thể.</div>
        ${hcLayoutHtml(q.t, 1, { cell: 20 })}
        <div class="hcopts td">${q.opts.map((o, i) => `<button class="hcopt ${done ? (o.ok ? 'ok' : i === ans ? 'bad' : '') : ''}" data-a="${i}" ${done ? 'disabled' : ''}><span class="hcoptl">${'ABC'[i]}</span><canvas data-cv="${i}" style="width:100%;height:170px;display:block"></canvas></button>`).join('')}</div>
        ${done ? `<div class="expl ${ch.ok ? 'ans' : ''}"><b class="t">${ch.ok ? '✔ Chính xác!' : '✘ Chưa đúng.'}</b>${ch.ok ? 'Hình chiếu trục đo khớp với cả ba hình chiếu.' : ch.why + ' Đáp án đúng là ' + 'ABC'[q.opts.findIndex(o => o.ok)] + '.'}</div><button class="btn block" id="nx" style="margin-top:10px">${qi < qs.length - 1 ? 'Câu tiếp →' : 'Xem kết quả'}</button>` : ''}</div>`);
    bindTop();
    setTimeout(() => $$('[data-cv]').forEach(cv => { const o = q.opts[+cv.dataset.cv]; sizeCv(cv); hctdDraw(cv, o.T, q.type, 4, 1, { axes: false, F: o.F, pad: 14, lw: 2 }); }), 0);
    $$('[data-a]').forEach(b => b.onclick = () => { ans = +b.dataset.a; if (q.opts[ans].ok) score++; drawLT(); });
    if ($('#nx')) $('#nx').onclick = () => { qi++; ans = null; drawLT(); };
  };
  cleanup = kill;
  if (tab === 'lt') startLT(); else draw();
});

/* ================= BÀI 12. HÌNH CHIẾU PHỐI CẢNH (1 điểm tụ, 2 điểm tụ) ================= */
const PC_OBJ = [
  { ten: 'Giá chữ L (SGK H.12.5)', W: 2.8, D: 3, out: [[0, 0], [2.8, 0], [2.8, 1.4], [1.2, 1.4], [1.2, 4], [0, 4]] },
  { ten: 'Khối chữ L', W: 4, D: 3, out: [[0, 0], [4, 0], [4, 1.2], [1.4, 1.2], [1.4, 3], [0, 3]] },
  { ten: 'Khối bậc thang', W: 4.2, D: 3, out: [[0, 0], [4.2, 0], [4.2, 1], [2.8, 1], [2.8, 2], [1.4, 2], [1.4, 3], [0, 3]] },
  { ten: 'Ngôi nhà (SGK H.12.7a)', W: 4, D: 4.6, out: [[0, 0], [4, 0], [4, 2.2], [2, 3.6], [0, 2.2]] },
  { ten: 'Gối đỡ chữ U', W: 4, D: 2.4, out: [[0, 0], [4, 0], [4, 3], [2.8, 3], [2.8, 1.4], [1.2, 1.4], [1.2, 3], [0, 3]] },
  { ten: 'Khối chữ T ngược', W: 4.4, D: 2.6, out: [[0, 0], [4.4, 0], [4.4, 1], [2.8, 1], [2.8, 3], [1.6, 3], [1.6, 1], [0, 1]] }
];
PC_OBJ.forEach(o => { o.H = Math.max(...o.out.map(p => p[1])); });
const pcFaces = o => o.F || (o.F = HC.G.prep(HC.G.extrude('y', HC.G.xz(o.out), [], 0, o.D)));
/** máy chiếu phối cảnh: mắt ở (ex, −dist, ez), mặt tranh y = 0; vật thể xoay góc th quanh trục đứng tại gốc rồi dời (ox, oy) */
function pcCam(c) {
  const cs = Math.cos(c.th), sn = Math.sin(c.th);
  const T = p => [p[0] * cs - p[1] * sn + c.ox, p[0] * sn + p[1] * cs + c.oy, p[2]];
  const Pp = p => { const q = T(p), t = c.dist / (q[1] + c.dist); return [c.ex + (q[0] - c.ex) * t, c.ez + (q[2] - c.ez) * t, -1 / (q[1] + c.dist)]; };
  const vp = u => Math.abs(u[1]) < 1e-6 ? null : c.ex + c.dist * u[0] / u[1];
  return { T, Pp, F1: vp([cs, sn]), F2: vp([-sn, cs]), rot: n => [n[0] * cs - n[1] * sn, n[0] * sn + n[1] * cs, n[2]] };
}
/** vẽ cảnh phối cảnh lên canvas. o: {obj, mode:1|2, ex, ez, th, step(1-5), g (0-1 tiến độ bước), box, guides} */
function pcDraw(cv, o) {
  const ctx = cv.getContext('2d'), Wc = cv.width, Hc = cv.height, dp = window.devicePixelRatio || 1;
  const O = o.obj, c = { th: o.mode === 2 ? o.th : 0, dist: o.dist || 9, ex: o.ex, ez: o.ez, ox: o.ox || 0, oy: o.oy || 0 }, C = pcCam(c);
  const B = o.box, k = Math.min(Wc / (B[2] - B[0]), Hc / (B[3] - B[1]));
  const ox = (Wc - (B[2] - B[0]) * k) / 2, oy = (Hc - (B[3] - B[1]) * k) / 2;
  const S = (X, Z) => [ox + (X - B[0]) * k, Hc - oy - (Z - B[1]) * k];
  const P = p => { const q = C.Pp(p), s = S(q[0], q[1]); return [s[0], s[1], q[2]]; };
  const line = (a, b, col, lw, dash, al = 1, g = 1) => { ctx.globalAlpha = al; ctx.strokeStyle = col; ctx.lineWidth = lw * dp; ctx.setLineDash(dash ? dash.map(v => v * dp) : []); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + (b[0] - a[0]) * g, a[1] + (b[1] - a[1]) * g); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; };
  const dot = (p, col, r = 6) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p[0], p[1], r * dp, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * dp; ctx.stroke(); };
  const txt = (s, x, y, col, sz = 13, al = 'center') => { ctx.font = `700 ${Math.round(sz * dp)}px system-ui,sans-serif`; ctx.fillStyle = col; ctx.textAlign = al; ctx.fillText(s, x, y); ctx.textAlign = 'left'; };
  ctx.clearRect(0, 0, Wc, Hc);
  const st = o.step, g = o.g == null ? 1 : o.g, gs = n => st > n ? 1 : st === n ? g : 0;
  const hz = S(0, c.ez)[1], F1 = C.F1 != null ? S(C.F1, c.ez) : null, F2 = C.F2 != null ? S(C.F2, c.ez) : null;
  // mặt đất nhẹ phía dưới đường chân trời
  if (o.ground !== false) { const gr = ctx.createLinearGradient(0, hz, 0, Hc); gr.addColorStop(0, 'rgba(148,163,184,.10)'); gr.addColorStop(1, 'rgba(148,163,184,.0)'); ctx.fillStyle = gr; ctx.fillRect(0, hz, Wc, Hc - hz); }
  // B1: đường chân trời + điểm tụ
  if (o.guides !== false) {
    line([0, hz], [Wc, hz], '#0f766e', 2, null, 1, gs(1));
    if (gs(1) > 0.6) {
      // đặt chữ ở phía xa các điểm tụ để không đè lên nhau
      const vx = [F1, F2].filter(Boolean).map(F => F[0]), dl = Math.min(Infinity, ...vx.map(x => Math.abs(x - 80 * dp))), dr = Math.min(Infinity, ...vx.map(x => Math.abs(x - (Wc - 80 * dp))));
      const mid = Math.min(Infinity, ...vx.map(x => Math.abs(x - Wc / 2)));
      if (Math.max(dl, dr) > 110 * dp) dl >= dr ? txt('Đường chân trời tt', 10 * dp, hz - 8 * dp, '#0f766e', 12.5, 'left') : txt('Đường chân trời tt', Wc - 10 * dp, hz - 8 * dp, '#0f766e', 12.5, 'right');
      else if (mid > 80 * dp) txt('Đường chân trời tt', Wc / 2, hz - 8 * dp, '#0f766e', 12.5);
      else txt('tt', 10 * dp, hz - 8 * dp, '#0f766e', 13, 'left');
    }
  }
  const VP = o.mode === 2 ? [F1, F2] : [F2];
  if (o.guides !== false && gs(1) > 0.8) VP.forEach((F, i) => { if (!F) return; dot(F, '#e11d48', 7); txt(o.mode === 2 ? 'F' + (i + 1) : 'F', F[0], F[1] - 12 * dp, '#e11d48', 14); });
  const out = O.out, D = O.D;
  const P0 = out.map(([x, z]) => P([x, 0, z])), P1 = out.map(([x, z]) => P([x, D, z]));
  const poly = (Q, col, lw, g2 = 1, dash) => { const n = Q.length, m = g2 * n; ctx.strokeStyle = col; ctx.lineWidth = lw * dp; ctx.setLineDash(dash ? dash.map(v => v * dp) : []); ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(Q[0][0], Q[0][1]); for (let i = 1; i <= Math.floor(m) && i <= n; i++) ctx.lineTo(Q[i % n][0], Q[i % n][1]); if (m < n) { const i = Math.floor(m), f = m - i, a = Q[i % n], b = Q[(i + 1) % n]; ctx.lineTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f); } ctx.stroke(); ctx.setLineDash([]); };
  const fin = st >= 5, gl = fin ? 0.35 : 1;
  if (o.guides === false) {} else if (o.mode === 1) {
    if (gs(2) > 0) poly(P0, '#1d4ed8', 2.6, gs(2));
    if (gs(3) > 0 && F2) P0.forEach(p => line(p, F2, '#64748b', 1.1, [5, 4], gl, gs(3)));
    if (gs(4) > 0) { poly(P1, '#1d4ed8', 1.8, gs(4), [6, 4]); if (gs(4) > 0.9) out.forEach((_, i) => line(P0[i], P1[i], '#1d4ed8', 1.8, null, gl)); }
  } else {
    const h0 = Math.max(...out.filter(p => p[0] === 0).map(p => p[1])), hW = Math.max(...out.filter(p => Math.abs(p[0] - O.W) < 1e-6).map(p => p[1]));
    const A = P([0, 0, 0]), Bt = P([0, 0, h0]);
    if (gs(2) > 0) { line(A, Bt, '#1d4ed8', 3, null, 1, gs(2)); if (gs(2) > 0.9 && !fin) txt('Cạnh đứng gần nhất', A[0] + 6 * dp, A[1] + 18 * dp, '#1d4ed8', 12, 'left'); }
    if (gs(3) > 0) [A, Bt].forEach(p => { if (F1) line(p, F1, '#64748b', 1.1, [5, 4], gl, gs(3)); if (F2) line(p, F2, '#64748b', 1.1, [5, 4], gl, gs(3)); });
    if (gs(4) > 0) {
      const a1 = P([O.W, 0, 0]), b1 = P([O.W, 0, hW]), a2 = P([0, D, 0]), b2 = P([0, D, h0]);
      line(a1, b1, '#1d4ed8', 2.4, null, 1, gs(4)); line(a2, b2, '#1d4ed8', 2.4, null, 1, gs(4));
      if (gs(4) > 0.9) { poly(P0, '#1d4ed8', 1.8, 1); if (F2) P0.forEach(p => line(p, F2, '#94a3b8', 0.9, [3, 4], gl)); }
    }
  }
  // B5: vẽ hoàn chỉnh, tô đậm
  if (gs(5) > 0) {
    const F = pcFaces(O), eye = [c.ex, -c.dist, c.ez];
    const front = f => { const n = C.rot(f.n), q = C.T(f.pts[0]); return n[0] * (q[0] - eye[0]) + n[1] * (q[1] - eye[1]) + n[2] * (q[2] - eye[2]) < -1e-6; };
    hcPaint(ctx, Wc | 0, Hc | 0, F, P, [0, 1, 0], dp, { front, bias: 0.0025, alpha: gs(5), lw: 2.6 });
  }
  if (o.guides !== false && gs(1) > 0.8 && o.handles) VP.forEach(F => { if (F) dot(F, '#e11d48', 7); });
  return { S, hz, F1, F2, k };
}
/** khung nhìn cố định cho một vật thể và phương pháp */
function pcBox(O, mode, ez, th, dist) {
  if (mode === 1) return [-2.6, -1.4, O.W + 5.2, Math.max(O.H, ez) + 1.6];
  const cs = Math.cos(th), sn = Math.sin(th), ex = 0.4, F1 = ex + dist * cs / sn, F2 = ex - dist * sn / cs;
  return [F2 - 1.2, -1.6, F1 + 1.2, Math.max(O.H, ez) + 1.4];
}

route(/^\/hcpc$/, params => {
  let tab = (params && params.get('tab')) || 'kn', oi = 0, step = 1, raf = 0, qs = [], qi = 0, score = 0, ans = null;
  let ex1 = null, ez = null, th = 38 * Math.PI / 180;
  const TABS = [['kn', '① Khái niệm & điểm tụ'], ['p1', '② Phối cảnh 1 điểm tụ'], ['p2', '③ Phối cảnh 2 điểm tụ'], ['lt', '④ Luyện tập']];
  const head = () => `<a href="#/onluyen">← Ôn luyện</a>${k10nav('#/hcpc')}<h1>🛤️ Hình chiếu phối cảnh</h1>
    <p class="sub">Hình chiếu phối cảnh biểu diễn vật thể giống như mắt ta nhìn thấy: vật ở xa trông nhỏ hơn, các đường song song chạy ra xa như gặp nhau tại <b>điểm tụ</b>.</p>
    <div class="tabs hctabs">${TABS.map(([k, t]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const kill = () => cancelAnimationFrame(raf);
  const bindTop = () => $$('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; step = 1; ex1 = ez = null; if (tab === 'lt') startLT(); else draw(); });
  const sizeCv = cv => { const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1; cv.width = Math.max(200, r.width * d); cv.height = Math.max(160, r.height * d); };
  const draw = () => { kill(); if (tab === 'kn') return drawKN(); drawPC(tab === 'p2' ? 2 : 1); };
  /* ---- ① Khái niệm: hiệu ứng con đường, đường ray chạy về điểm tụ ---- */
  const drawKN = () => {
    setView(`${head()}<div class="card"><canvas id="road" class="hc3d" style="height:360px;cursor:grab"></canvas>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px"><button class="btn ghost sm" id="pp">⏸ Dừng</button><span class="hint">Kéo chuột/vuốt ngang để dời điểm tụ, kéo dọc để nâng hạ tầm mắt.</span></div>
      <div class="expl" style="margin-top:10px"><b class="t">Quan sát</b>Mép đường, đường ray, hàng cột điện đều song song với nhau, nhưng càng ra xa chúng càng chụm lại và <b>gặp nhau tại một điểm F</b> nằm trên <b>đường chân trời</b> (ngang tầm mắt). Cột ở gần trông cao, cột ở xa trông thấp dần.</div></div>
      <div class="card"><h3 style="margin-top:0">Các khái niệm</h3><div class="pcdefs">
        <div><b>Hình chiếu phối cảnh</b> là hình biểu diễn được xây dựng bằng <b>phép chiếu xuyên tâm</b>, tâm chiếu là <b>mắt người quan sát</b> (điểm nhìn).</div>
        <div><b>Mặt tranh</b>: mặt phẳng thẳng đứng, giữa người quan sát và vật thể, trên đó vẽ hình phối cảnh.</div>
        <div><b>Mặt phẳng tầm mắt</b>: mặt phẳng nằm ngang đi qua điểm nhìn. Giao tuyến của nó với mặt tranh là <b>đường chân trời tt</b>.</div>
        <div><b>Mặt phẳng vật thể</b>: mặt phẳng nằm ngang đặt vật thể (mặt đất).</div>
        <div><b>Điểm tụ F</b>: điểm trên đường chân trời, nơi các đường song song (không song song với mặt tranh) hội tụ.</div>
        <div><b>Ứng dụng</b>: vẽ kiến trúc, nội thất, quảng cáo, minh họa sản phẩm – thường đặt cạnh các hình chiếu vuông góc để người xem dễ hình dung.</div></div></div>
      <div class="hccompare"><div class="card"><h3 style="margin-top:0;color:#0f766e">Phối cảnh 1 điểm tụ</h3><canvas id="k1" class="hc3d" style="height:220px;cursor:default"></canvas><p class="hint">Mặt tranh <b>song song</b> với một mặt của vật thể → mặt đó giữ nguyên hình dạng; các cạnh vuông góc mặt tranh chạy về <b>1 điểm tụ</b>. Hay dùng vẽ đường phố, hành lang, nội thất.</p></div>
        <div class="card"><h3 style="margin-top:0;color:#7c3aed">Phối cảnh 2 điểm tụ</h3><canvas id="k2" class="hc3d" style="height:220px;cursor:default"></canvas><p class="hint">Mặt tranh <b>không song song</b> với mặt nào của vật thể (chỉ song song cạnh thẳng đứng) → hai hướng cạnh nằm ngang chạy về <b>2 điểm tụ</b>. Hình sinh động, hay dùng vẽ ngôi nhà, công trình.</p></div></div>
      <div class="card"><button class="btn block" data-tab="p1">Tiếp: Vẽ phối cảnh 1 điểm tụ →</button></div>`);
    bindTop();
    const cv = $('#road');
    let fx = 0.5, fy = 0.42, off = 0, run = true, drag = null;
    cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); drag = [e.clientX, e.clientY]; };
    cv.onpointermove = e => { if (!drag) return; const r = cv.getBoundingClientRect(); fx = Math.max(0.15, Math.min(0.85, fx + (e.clientX - drag[0]) / r.width)); fy = Math.max(0.2, Math.min(0.7, fy + (e.clientY - drag[1]) / r.height)); drag = [e.clientX, e.clientY]; if (!run) paint(); };
    cv.onpointerup = cv.onpointercancel = () => { drag = null; };
    const paint = () => {
      const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, dp = window.devicePixelRatio || 1, F = [W * fx, H * fy];
      const sky = ctx.createLinearGradient(0, 0, 0, F[1]); sky.addColorStop(0, '#bfdbfe'); sky.addColorStop(1, '#eff6ff'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, F[1]);
      const gr = ctx.createLinearGradient(0, F[1], 0, H); gr.addColorStop(0, '#d9f99d'); gr.addColorStop(1, '#86efac'); ctx.fillStyle = gr; ctx.fillRect(0, F[1], W, H - F[1]);
      // mặt đường
      const bl = [W * 0.08, H], br = [W * 0.92, H];
      ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(F[0], F[1]); ctx.lineTo(br[0], br[1]); ctx.lineTo(bl[0], bl[1]); ctx.closePath(); ctx.fill();
      // vị trí theo độ sâu: s ∈ (0,1] (1 = sát người xem), phối cảnh y = F + (bottom − F)·s
      const at = (bx, s) => [F[0] + (bx - F[0]) * s, F[1] + (H - F[1]) * s];
      // vạch giữa đường chạy về phía người xem
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 14; i++) { const z = ((i + off) % 14) / 14, s0 = Math.pow(z, 2.2), s1 = Math.pow(Math.min(1, z + 0.035), 2.2); const a = at(W * 0.5 - 6 * dp, s0), b = at(W * 0.5 + 6 * dp, s0), c2 = at(W * 0.5 + 6 * dp, s1), d2 = at(W * 0.5 - 6 * dp, s1); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(d2[0], d2[1]); ctx.fill(); }
      // cột điện hai bên
      for (let i = 0; i < 10; i++) {
        const z = ((i + off * 0.7) % 10) / 10, s = Math.pow(z, 2.2); if (s < 0.01) continue;
        [W * -0.05, W * 1.05].forEach(bx => { const p = at(bx, s), h = (H - F[1]) * 1.6 * s; ctx.strokeStyle = '#78350f'; ctx.lineWidth = Math.max(1, 9 * s * dp); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - h); ctx.stroke(); ctx.lineWidth = Math.max(1, 5 * s * dp); ctx.beginPath(); ctx.moveTo(p[0] - h * 0.18, p[1] - h * 0.92); ctx.lineTo(p[0] + h * 0.18, p[1] - h * 0.92); ctx.stroke(); });
      }
      // đường dóng về điểm tụ
      ctx.setLineDash([6 * dp, 5 * dp]); ctx.strokeStyle = '#e11d48'; ctx.lineWidth = 1.6 * dp;
      [bl, br, [W * -0.05, H], [W * 1.05, H], [W * -0.05, H - (H - F[1]) * 1.6], [W * 1.05, H - (H - F[1]) * 1.6]].forEach(p => { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(F[0], F[1]); ctx.stroke(); });
      ctx.setLineDash([]);
      ctx.strokeStyle = '#0f766e'; ctx.lineWidth = 2 * dp; ctx.beginPath(); ctx.moveTo(0, F[1]); ctx.lineTo(W, F[1]); ctx.stroke();
      ctx.font = `700 ${Math.round(13 * dp)}px system-ui,sans-serif`; ctx.fillStyle = '#0f766e'; ctx.fillText('Đường chân trời tt (ngang tầm mắt)', 10 * dp, F[1] - 8 * dp);
      ctx.fillStyle = '#e11d48'; ctx.beginPath(); ctx.arc(F[0], F[1], 7 * dp, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * dp; ctx.stroke();
      ctx.fillStyle = '#e11d48'; ctx.textAlign = 'center'; ctx.fillText('Điểm tụ F', F[0], F[1] - 14 * dp); ctx.textAlign = 'left';
    };
    const loop = () => { if (run) off = (off + 0.03) % 140; paint(); raf = requestAnimationFrame(loop); };
    setTimeout(() => {
      sizeCv(cv); loop();
      const O = PC_OBJ[2];
      [['#k1', 1], ['#k2', 2]].forEach(([s, m]) => { const c = $(s); sizeCv(c); const e = O.H + 1.6, ex = m === 1 ? O.W + 1.8 : 0.4; pcDraw(c, { obj: O, mode: m, ex, ez: e, th, dist: m === 1 ? 9 : 8, step: 5, box: pcBox(O, m, e, th, 8) }); });
    }, 0);
    $('#pp').onclick = () => { run = !run; $('#pp').textContent = run ? '⏸ Dừng' : '▶ Chạy'; };
  };
  /* ---- ② ③ Vẽ phối cảnh từng bước ---- */
  const drawPC = mode => {
    const O = PC_OBJ[oi], dist = mode === 1 ? 9 : 8;
    if (ez == null) ez = O.H + 1.4;
    if (ex1 == null) ex1 = O.W + 1.8;
    const S1 = [[1, 'B1. Đường chân trời, điểm tụ'], [2, 'B2. Vẽ mặt trước'], [3, 'B3. Nối các đỉnh với F'], [4, 'B4. Xác định chiều sâu'], [5, 'B5. Tô đậm, hoàn thiện']];
    const S2 = [[1, 'B1. Đường chân trời, 2 điểm tụ'], [2, 'B2. Cạnh đứng gần nhất'], [3, 'B3. Nối với F1, F2'], [4, 'B4. Chiều dài, chiều rộng'], [5, 'B5. Tô đậm, hoàn thiện']];
    const S = mode === 1 ? S1 : S2;
    const T1 = {
      1: 'Vẽ <b>đường chân trời tt</b> (ngang tầm mắt) và chọn <b>điểm tụ F</b> trên đó. <i>Kéo điểm F đỏ</i> trên hình để đổi vị trí nhìn.',
      2: 'Vẽ <b>mặt trước</b> của vật thể đúng hình dạng thật (giống hình chiếu đứng), vì mặt này song song với mặt tranh.',
      3: 'Nối các đỉnh của mặt trước với điểm tụ <b>F</b> bằng nét mảnh – đó là phương của các cạnh chạy ra xa.',
      4: 'Trên các đường nối, xác định <b>chiều sâu</b> của vật thể (ước lượng bằng mắt) rồi vẽ <b>mặt sau</b> song song với mặt trước.',
      5: 'Xóa nét thừa, <b>tô đậm các cạnh thấy</b>. Thử kéo F lên cao hoặc xuống thấp để thấy vật thể được nhìn <b>từ trên</b>, <b>ngang tầm</b> hay <b>từ dưới</b>.'
    };
    const T2 = {
      1: 'Vẽ <b>đường chân trời tt</b> và chọn <b>hai điểm tụ F1, F2</b> trên đó. Vật thể được xoay xiên so với mặt tranh.',
      2: 'Vẽ <b>cạnh thẳng đứng gần người quan sát nhất</b> với chiều cao thật – đây là cạnh duy nhất không bị thu nhỏ.',
      3: 'Nối hai đầu của cạnh đứng với <b>F1</b> và <b>F2</b> bằng nét mảnh.',
      4: 'Trên các đường nối, xác định <b>chiều dài</b> (về phía F1) và <b>chiều rộng</b> (về phía F2), vẽ các cạnh thẳng đứng còn lại.',
      5: 'Vẽ các chi tiết theo các đường chạy về F1, F2, xóa nét thừa, <b>tô đậm</b>. Đổi góc xoay để thấy điểm tụ dịch chuyển.'
    };
    setView(`${head()}
      <div class="card"><b>Chọn vật thể</b><div class="gcpick">${PC_OBJ.map((t, i) => `<button class="${i === oi ? 'on' : ''}" data-o="${i}">Hình ${i + 1}. ${t.ten}</button>`).join('')}</div></div>
      <div class="card"><div class="hcsteps" style="grid-template-columns:repeat(5,minmax(0,1fr))">${S.map(([k, t]) => `<button data-step="${k}" class="${step === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <canvas id="pc" class="hc3d" style="height:400px;cursor:default;touch-action:none"></canvas>
        <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center">
          <button class="btn ghost sm" data-eye="hi">⬆ Nhìn từ trên</button><button class="btn ghost sm" data-eye="mid">↔ Ngang tầm</button><button class="btn ghost sm" data-eye="lo">⬇ Nhìn từ dưới</button>
          ${mode === 2 ? '<label style="display:flex;align-items:center;gap:6px;margin:0">Góc xoay <input id="th" type="range" min="20" max="70" value="' + Math.round(th * 180 / Math.PI) + '"></label>' : ''}
          <span class="grow"></span><button class="btn sm" id="play">▶ Dựng tự động</button></div>
        <div class="expl" style="margin-top:10px"><b class="t">${S[step - 1][1]}</b>${(mode === 1 ? T1 : T2)[step]}</div>
        ${step < 5 ? `<button class="btn block" id="next" style="margin-top:8px">Tiếp: ${S[step][1]} →</button>` : `<button class="btn block" data-tab="${mode === 1 ? 'p2' : 'lt'}" style="margin-top:8px">Tiếp: ${mode === 1 ? 'Phối cảnh 2 điểm tụ' : 'Luyện tập'} →</button>`}</div>`);
    bindTop();
    $$('[data-o]').forEach(b => b.onclick = () => { oi = +b.dataset.o; ex1 = ez = null; step = 1; draw(); });
    $$('[data-step]').forEach(b => b.onclick = () => { step = +b.dataset.step; draw(); });
    if ($('#next')) $('#next').onclick = () => { step++; draw(); };
    const cv = $('#pc');
    let box = null, info = null;
    const opts = (g = 1) => ({ obj: O, mode, ex: mode === 1 ? ex1 : 0.4, ez, th, dist, step, g, box, handles: true });
    const render = g => { info = pcDraw(cv, opts(g)); };
    const anim = (ms = 1100) => { kill(); const t0 = performance.now(); const go = now => { const g = Math.min(1, (now - t0) / ms); render(g); if (g < 1) raf = requestAnimationFrame(go); }; raf = requestAnimationFrame(go); };
    const reBox = () => { box = pcBox(O, mode, Math.max(ez, O.H + 2.4), th, dist); };
    // kéo điểm tụ / đường chân trời
    let drag = null;
    cv.onpointerdown = e => {
      if (!info) return; const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1, x = (e.clientX - r.left) * d, y = (e.clientY - r.top) * d;
      const near = [info.F1, info.F2].filter(Boolean).some(F => Math.hypot(F[0] - x, F[1] - y) < 26 * d) || Math.abs(y - info.hz) < 14 * d;
      if (near) { drag = { x, y }; cv.setPointerCapture(e.pointerId); }
    };
    cv.onpointermove = e => {
      const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1, x = (e.clientX - r.left) * d, y = (e.clientY - r.top) * d;
      if (!drag) { if (info) cv.style.cursor = ([info.F1, info.F2].filter(Boolean).some(F => Math.hypot(F[0] - x, F[1] - y) < 26 * d) || Math.abs(y - info.hz) < 14 * d) ? 'grab' : 'default'; return; }
      const k = info.k;
      ez = Math.max(-0.8, Math.min(box[3] - 0.4, ez - (y - drag.y) / k));
      if (mode === 1) ex1 = Math.max(box[0] + 0.4, Math.min(box[2] - 0.4, ex1 + (x - drag.x) / k));
      drag = { x, y }; kill(); render(1);
    };
    cv.onpointerup = cv.onpointercancel = () => { drag = null; };
    $$('[data-eye]').forEach(b => b.onclick = () => { const to = { hi: O.H + 1.6, mid: O.H * 0.5, lo: -0.6 }[b.dataset.eye], from = ez, t0 = performance.now(); kill(); const go = now => { const g = Math.min(1, (now - t0) / 600); ez = from + (to - from) * (g * (2 - g)); render(1); if (g < 1) raf = requestAnimationFrame(go); }; raf = requestAnimationFrame(go); });
    if ($('#th')) $('#th').oninput = e => { th = +e.target.value * Math.PI / 180; reBox(); kill(); render(1); };
    $('#play').onclick = () => { kill(); let s = 1; const t0 = performance.now(), per = 1300; const go = now => { const t = (now - t0) / per; s = Math.min(5, 1 + Math.floor(t)); step = s; const g = Math.min(1, t - (s - 1)); render(s === 5 && t >= 5 ? 1 : g); $$('[data-step]').forEach(b => b.classList.toggle('on', +b.dataset.step === s)); if (t < 5) raf = requestAnimationFrame(go); else draw(); }; raf = requestAnimationFrame(go); };
    setTimeout(() => { sizeCv(cv); reBox(); anim(); }, 0);
  };
  /* ---- ④ Luyện tập ---- */
  const startLT = () => {
    const types = shuffle(['p1', 'p2', 'td', 'p1', 'p2', 'td']).slice(0, 4);
    const eyes = shuffle(['hi', 'mid', 'lo']).slice(0, 2);
    qs = [
      ...types.map(t => ({ kind: 'type', t, obj: PC_OBJ[rnd(PC_OBJ.length)], opts: shuffle([{ k: 'p1', t: 'Phối cảnh 1 điểm tụ' }, { k: 'p2', t: 'Phối cảnh 2 điểm tụ' }, { k: 'td', t: 'Hình chiếu trục đo' }]).map(o => ({ ...o, ok: o.k === t })),
        why: { p1: 'Mặt trước giữ nguyên hình dạng, các cạnh chạy ra xa hội tụ về một điểm → phối cảnh 1 điểm tụ.', p2: 'Chỉ các cạnh thẳng đứng còn song song; hai hướng cạnh nằm ngang chụm về hai phía → phối cảnh 2 điểm tụ.', td: 'Các cạnh song song trên vật thể vẫn song song trên hình (không chụm lại) → hình chiếu trục đo.' }[t] })),
      ...eyes.map(e => ({ kind: 'eye', e, obj: PC_OBJ[rnd(PC_OBJ.length)], m: 1 + rnd(2), opts: shuffle([{ k: 'hi', t: 'Từ trên xuống (tầm mắt cao hơn vật thể)' }, { k: 'mid', t: 'Ngang tầm vật thể' }, { k: 'lo', t: 'Từ dưới lên (tầm mắt thấp hơn mặt đất)' }]).map(o => ({ ...o, ok: o.k === e })),
        why: { hi: 'Thấy được mặt trên của vật thể → đường chân trời (tầm mắt) cao hơn vật thể: nhìn từ trên xuống.', mid: 'Không thấy mặt trên lẫn mặt dưới, đường chân trời cắt ngang vật thể → nhìn ngang tầm.', lo: 'Thấy được mặt đáy của vật thể → tầm mắt thấp hơn mặt đất: nhìn từ dưới lên.' }[e] })),
      { kind: 'txt', stem: 'Hình chiếu phối cảnh được xây dựng bằng phép chiếu nào?', opts: shuffle([{ t: 'Phép chiếu xuyên tâm', ok: true }, { t: 'Phép chiếu vuông góc', why: 'Phép chiếu vuông góc dùng cho hình chiếu vuông góc, hình chiếu trục đo vuông góc đều.' }, { t: 'Phép chiếu song song xiên', why: 'Phép chiếu song song xiên dùng cho hình chiếu trục đo xiên góc cân.' }]) },
      { kind: 'txt', stem: 'Đường chân trời là giao tuyến của', opts: shuffle([{ t: 'mặt phẳng tầm mắt với mặt tranh', ok: true }, { t: 'mặt phẳng vật thể với mặt tranh', why: 'Giao tuyến này là đường nền (đường đáy tranh), không phải đường chân trời.' }, { t: 'mặt phẳng tầm mắt với mặt phẳng vật thể', why: 'Hai mặt phẳng này song song nên không cắt nhau.' }]) },
      { kind: 'txt', stem: 'Phối cảnh một điểm tụ nhận được khi mặt tranh', opts: shuffle([{ t: 'song song với một mặt của vật thể', ok: true }, { t: 'không song song với mặt nào của vật thể', why: 'Khi đó ta được phối cảnh hai điểm tụ.' }, { t: 'nằm ngang, song song với mặt đất', why: 'Mặt tranh luôn thẳng đứng.' }]) },
      { kind: 'txt', stem: 'Các điểm tụ của hình phối cảnh luôn nằm trên', opts: shuffle([{ t: 'đường chân trời', ok: true }, { t: 'cạnh đứng gần nhất của vật thể', why: 'Cạnh đứng gần nhất là cạnh không bị thu nhỏ, không chứa điểm tụ.' }, { t: 'mép dưới của mặt tranh', why: 'Điểm tụ của các đường nằm ngang luôn ở ngang tầm mắt.' }]) }
    ];
    qi = 0; score = 0; ans = null; drawLT();
  };
  const drawLT = () => {
    kill();
    if (qi >= qs.length) {
      const hk = 'hist_' + uid(), hist = store.get(hk, []); hist.push({ t: Date.now(), title: 'Hình chiếu phối cảnh – luyện tập', key: '', loai: 'game', diem: Math.round(score / qs.length * 1000) / 100, dung: score, tong: qs.length, giay: 0 }); store.set(hk, hist.slice(-300));
      setView(`${head()}<div class="hero"><h1>Hoàn thành! 🎉</h1><p class="sub">Em làm đúng <b>${score}/${qs.length}</b> câu.</p></div><div class="row"><button class="btn" id="again">Làm lại</button></div>`);
      bindTop(); $('#again').onclick = startLT; return;
    }
    const q = qs[qi], done = ans != null, ch = done ? q.opts[ans] : null;
    const stem = q.kind === 'type' ? 'Hình dưới đây là loại hình biểu diễn nào?' : q.kind === 'eye' ? 'Quan sát hình phối cảnh. Người quan sát đang nhìn vật thể <b>từ đâu</b>?' : q.stem;
    setView(`${head()}<div class="qbar"><div class="title">Câu ${qi + 1}/${qs.length}</div><span class="timer">✔ ${score}</span></div>
      <div class="qcard"><div class="stem">${stem}</div>
        ${q.kind !== 'txt' ? '<canvas id="qc" class="hc3d" style="height:280px;cursor:default"></canvas>' : ''}
        <div class="hcopts txt" style="grid-template-columns:1fr">${q.opts.map((o, i) => `<button class="hcopt ${done ? (o.ok ? 'ok' : i === ans ? 'bad' : '') : ''}" data-a="${i}" ${done ? 'disabled' : ''}><span class="hcoptl">${'ABC'[i]}</span><span>${o.t}</span></button>`).join('')}</div>
        ${done ? `<div class="expl ${ch.ok ? 'ans' : ''}"><b class="t">${ch.ok ? '✔ Chính xác!' : '✘ Chưa đúng.'}</b>${q.why || (ch.ok ? '' : ch.why || '')}</div><button class="btn block" id="nx" style="margin-top:10px">${qi < qs.length - 1 ? 'Câu tiếp →' : 'Xem kết quả'}</button>` : ''}</div>`);
    bindTop();
    if (q.kind !== 'txt') setTimeout(() => {
      const cv = $('#qc'); sizeCv(cv); const O = q.obj;
      if (q.kind === 'type' && q.t === 'td') { hctdDraw(cv, { W: O.W, D: O.D, H: O.H }, 'vgd', 4, 1, { axes: false, F: pcFaces(O), pad: 30 }); return; }
      const m = q.kind === 'type' ? (q.t === 'p1' ? 1 : 2) : q.m, e = q.kind === 'eye' ? { hi: O.H + 1.8, mid: O.H * 0.5, lo: -0.7 }[q.e] : O.H + 1.6, dist = m === 1 ? 9 : 8;
      pcDraw(cv, { obj: O, mode: m, ex: m === 1 ? O.W + 1.6 : 0.4, ez: e, th, dist, step: 5, guides: false, ground: false, box: pcBox(O, m, Math.max(e, O.H + 2.4), th, dist) });
    }, 0);
    $$('[data-a]').forEach(b => b.onclick = () => { ans = +b.dataset.a; if (q.opts[ans].ok) score++; drawLT(); });
    if ($('#nx')) $('#nx').onclick = () => { qi++; ans = null; drawLT(); };
  };
  cleanup = kill;
  if (tab === 'lt') startLT(); else draw();
});

/* ================= TRÒ CHƠI KHỞI ĐỘNG ================= */
const gnorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'D').toUpperCase().replace(/[^A-Z0-9]/g, '');
const B2 = 'Bài 2. Ngành nghề trong lĩnh vực kĩ thuật điện', B9 = 'Bài 9. Thiết bị điện trong hệ thống điện gia đình', B14 = 'Bài 14. Ngành nghề và dịch vụ trong lĩnh vực kĩ thuật điện tử';
const GAME_SEEDS = [
  { id: 'S-B9-OC', ten: 'Ô chữ – Thiết bị điện gia đình', loai: 'ochu', khoi: '12', bai: B9, tuKhoa: 'CAUDAO', hienTuKhoa: 'CẦU DAO', goiYTuKhoa: 'Thiết bị đóng – cắt điện bằng tay', items: [
    { tu: 'CONGTAC', hien: 'CÔNG TẮC', goiY: 'Thiết bị đóng – cắt điện cho đồ dùng điện, thiết bị điện công suất nhỏ' },
    { tu: 'APTOMAT', hien: 'APTOMAT', goiY: 'Thiết bị đóng – cắt điện và tự động cắt điện để bảo vệ quá tải, ngắn mạch' },
    { tu: 'QUATAI', hien: 'QUÁ TẢI', goiY: 'Hiện tượng dòng điện vượt quá giá trị định mức, aptomat sẽ tự cắt để bảo vệ' },
    { tu: 'DAYDAN', hien: 'DÂY DẪN', goiY: 'Kết nối các thiết bị trong mạng điện và dẫn điện từ nguồn tới tải tiêu thụ' },
    { tu: 'NGANMACH', hien: 'NGẮN MẠCH', goiY: 'Sự cố làm dòng điện tăng rất lớn; dòng ___ là giá trị lớn nhất aptomat có thể cắt' },
    { tu: 'OCAM', hien: 'Ổ CẮM', goiY: 'Thiết bị kết nối nguồn điện với các thiết bị tiêu thụ điện' }] },
  { id: 'S-B2-OC', ten: 'Ô chữ – Ngành nghề kĩ thuật điện', loai: 'ochu', khoi: '12', bai: B2, tuKhoa: 'LAPDAT', hienTuKhoa: 'LẮP ĐẶT', goiYTuKhoa: 'Nhóm nghề thi công, kết nối đường dây và thiết bị điện theo hồ sơ thiết kế', items: [
    { tu: 'DIENLUC', hien: 'ĐIỆN LỰC', goiY: 'Phòng điều hành, quản lí điện của các công ti ___ là nơi làm việc của nghề vận hành điện' },
    { tu: 'BAODUONG', hien: 'BẢO DƯỠNG', goiY: 'Hoạt động thường kì nhằm duy trì hệ thống điện, thiết bị điện hoạt động ổn định' },
    { tu: 'PHANMEM', hien: 'PHẦN MỀM', goiY: 'Người thiết kế điện phải thành thạo kĩ năng sử dụng các ___ thiết kế điện' },
    { tu: 'DAIHOC', hien: 'ĐẠI HỌC', goiY: 'Trình độ cần có của kĩ sư thiết kế điện' },
    { tu: 'VANHANH', hien: 'VẬN HÀNH', goiY: 'Các hoạt động nhằm duy trì chế độ làm việc bình thường của hệ thống điện' },
    { tu: 'THODIEN', hien: 'THỢ ĐIỆN', goiY: 'Vị trí trong nhóm nghề lắp đặt điện, cần trình độ sơ cấp nghề điện' }] },
  { id: 'S-B14-OC', ten: 'Ô chữ – Ngành nghề kĩ thuật điện tử', loai: 'ochu', khoi: '12', bai: B14, tuKhoa: 'SUACHUA', hienTuKhoa: 'SỬA CHỮA', goiYTuKhoa: 'Cùng với bảo dưỡng, đây là nhóm công việc khắc phục hư hỏng của thiết bị điện tử', items: [
    { tu: 'SOCAP', hien: 'SƠ CẤP', goiY: 'Thợ điện tử trong nhóm nghề lắp đặt thiết bị điện tử cần trình độ ___ nghề điện tử' },
    { tu: 'CHATLUONG', hien: 'CHẤT LƯỢNG', goiY: 'Kĩ sư quản lí ___ có trách nhiệm kiểm soát sản phẩm trong nhóm nghề sản xuất, chế tạo' },
    { tu: 'LAPDAT', hien: 'LẮP ĐẶT', goiY: 'Công việc kết nối và kiểm tra hoạt động của thiết bị điện tử riêng lẻ theo tiêu chuẩn' },
    { tu: 'CAODANG', hien: 'CAO ĐẲNG', goiY: 'Thợ sản xuất thiết bị điện tử cần trình độ trung cấp hoặc ___ nghề kĩ thuật điện tử' },
    { tu: 'THIETKE', hien: 'THIẾT KẾ', goiY: 'Nhóm nghề tạo ra bản thiết kế mạch nguyên lí và thử nghiệm hoạt động của mạch' },
    { tu: 'DUYTRI', hien: 'DUY TRÌ', goiY: 'Vận hành thiết bị điện tử là hoạt động nhằm ___ chế độ làm việc bình thường của thiết bị' },
    { tu: 'NHAMAY', hien: 'NHÀ MÁY', goiY: 'Môi trường làm việc của thợ sản xuất thiết bị điện tử: các ___, xưởng sản xuất' }] },
  { id: 'S-B9-DT', ten: 'Đoán từ – Thiết bị điện gia đình', loai: 'doantu', khoi: '12', bai: B9, items: [
    { tu: 'CONGTODIEN', hien: 'CÔNG TƠ ĐIỆN', goiY: 'Dụng cụ đo lường điện năng tiêu thụ của mạng điện' },
    { tu: 'APTOMAT', hien: 'APTOMAT', goiY: 'Tự động cắt điện khi quá tải, ngắn mạch' },
    { tu: 'CAUDAO', hien: 'CẦU DAO', goiY: 'Đóng – cắt điện bằng tay, dòng định mức thường từ 6 A đến 60 A' },
    { tu: 'OCAMNOIDAI', hien: 'Ổ CẮM NỐI DÀI', goiY: 'Nối với ổ cắm cố định để đưa ổ lấy điện tới vị trí thuận lợi' },
    { tu: 'CONGTAC', hien: 'CÔNG TẮC', goiY: 'Đóng – cắt điện cho thiết bị điện công suất nhỏ' }] },
  { id: 'S-B2-DT', ten: 'Đoán từ – Ngành nghề kĩ thuật điện', loai: 'doantu', khoi: '12', bai: B2, items: [
    { tu: 'BANVE', hien: 'BẢN VẼ', goiY: 'Sản phẩm của công việc thiết kế điện: các ___ sơ đồ mạch điện và tài liệu kĩ thuật' },
    { tu: 'VANHANH', hien: 'VẬN HÀNH', goiY: 'Duy trì chế độ làm việc bình thường của hệ thống điện' },
    { tu: 'BAODUONG', hien: 'BẢO DƯỠNG', goiY: 'Hoạt động thường kì giữ cho thiết bị điện hoạt động ổn định' },
    { tu: 'SOCAP', hien: 'SƠ CẤP', goiY: 'Trình độ tối thiểu của thợ điện trong nhóm nghề lắp đặt điện: ___ nghề điện' },
    { tu: 'KISU', hien: 'KĨ SƯ', goiY: 'Vị trí việc làm trong nghề thiết kế điện, cần trình độ đại học ngành kĩ thuật điện' }] },
  { id: 'S-B14-DT', ten: 'Đoán từ – Ngành nghề kĩ thuật điện tử', loai: 'doantu', khoi: '12', bai: B14, items: [
    { tu: 'THIETKE', hien: 'THIẾT KẾ', goiY: 'Tạo ra bản thiết kế mạch nguyên lí, thử nghiệm hoạt động của mạch' },
    { tu: 'KITHUATVIEN', hien: 'KĨ THUẬT VIÊN', goiY: 'Vị trí cài đặt và vận hành các thiết bị điện tử' },
    { tu: 'NHAMAY', hien: 'NHÀ MÁY', goiY: 'Nơi làm việc của thợ sản xuất, chế tạo thiết bị điện tử' },
    { tu: 'LAPDAT', hien: 'LẮP ĐẶT', goiY: 'Kết nối và kiểm tra hoạt động của thiết bị điện tử theo tiêu chuẩn' },
    { tu: 'SUACHUA', hien: 'SỬA CHỮA', goiY: 'Khắc phục hư hỏng để thiết bị điện tử hoạt động trở lại' }] },
  { id: 'S-B9-LT', ten: 'Lật ô đoán tranh – Thiết bị điện', loai: 'latranh', khoi: '12', bai: B9, anh: 'img/L12B9_image6.webp', tuKhoa: 'CAUDAO', hienTuKhoa: 'CẦU DAO', goiYTuKhoa: 'Một thiết bị trong hệ thống điện gia đình', soO: 6 },
  { id: 'S-B14-LT', ten: 'Lật ô đoán tranh – Nghề điện tử', loai: 'latranh', khoi: '12', bai: B14, anh: 'img/L12B14_image1.webp', tuKhoa: 'THIETKE', hienTuKhoa: 'THIẾT KẾ (thiết bị điện tử)', goiYTuKhoa: 'Nhóm nghề của người trong tranh', soO: 6 },
  { id: 'S-B2-LT', ten: 'Lật ô đoán tranh – Nghề điện', loai: 'latranh', khoi: '12', bai: B2, anh: 'img/L12B2_image1.webp', tuKhoa: 'NGANHNGHEDIEN', hienTuKhoa: 'NGÀNH NGHỀ KĨ THUẬT ĐIỆN', goiYTuKhoa: 'Các công việc trong tranh thuộc lĩnh vực nào?', soO: 9 }
];
const GAME_TYPE = { doantu: '🔤 Đoán từ', ochu: '🧩 Giải ô chữ', latranh: '🖼️ Lật ô đoán tranh' };
function ochuLayout(g) {
  const K = gnorm(g.tuKhoa).split('');
  const rows = g.items.map((it, r) => { const a = gnorm(it.tu); return { a, p: a.indexOf(K[r]) }; });
  const bad = rows.map((x, r) => x.p < 0 ? r + 1 : 0).filter(Boolean);
  const P = Math.max(0, ...rows.map(x => x.p));
  return { rows: rows.map(x => Object.assign(x, { off: P - Math.max(0, x.p) })), col: P, W: Math.max(...rows.map(x => P - Math.max(0, x.p) + x.a.length)), bad, K };
}
async function allGames() {
  let mine = store.get('games', []);
  if (session) { try { mine = await api('list_games'); store.set('games', mine); } catch (e) {} }
  return [...mine, ...GAME_SEEDS];
}
function fullBtn() { return '<button class="btn ghost sm" id="fs">⛶ Toàn màn hình</button>'; }
function bindFull() { const b = $('#fs'); if (b) b.onclick = () => { const el = document.documentElement; if (!document.fullscreenElement) (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); else document.exitFullscreen(); }; }

route(/^\/trochoi$/, async params => {
  setView('<div class="card empty">Đang tải…</div>');
  const games = await allGames();
  const allowed = (session && session.role === 'hs') ? getAllowedGrades() : ['10', '11', '12'];
  let k = (params && params.get('k')) || ((session && session.role === 'hs') ? getStudentGrade() : '');
  let type = '';
  const draw = () => {
    const list = games.filter(g => (!k || g.khoi === k) && (!type || g.loai === type) && (isGV() || allowed.includes(g.khoi || '12')));
    const gradeTabs = allowed.length > 1
      ? `<div class="tabs">${[['', 'Tất cả'], ['10', 'Lớp 10'], ['11', 'Lớp 11'], ['12', 'Lớp 12']].filter(([v]) => !v || allowed.includes(v)).map(([v, t]) => `<button data-k="${v}" class="${k === v ? 'on' : ''}">${t}</button>`).join('')}</div>`
      : `<div class="pill info" style="margin-bottom:10px">🎮 Trò chơi dành riêng cho <b>Khối ${k}</b></div>`;
    setView(`<div class="row"><h1 class="grow">🎮 Trò chơi khởi động</h1>${isGV() ? '<a class="btn sm" href="#/trochoi/soan">+ Soạn trò chơi</a>' : ''}</div>
      <p class="sub">Dùng đầu tiết để khởi động hoặc cuối tiết để củng cố. Bấm “Toàn màn hình” khi chiếu lên máy chiếu.</p>
      ${gradeTabs}
      <div class="tabs">${[['', 'Mọi trò'], ...Object.entries(GAME_TYPE)].map(([v, t]) => `<button data-t="${v}" class="${type === v ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="grid">${list.map(g => `<a class="tile" href="#/trochoi/choi/${encodeURIComponent(g.id)}"><span class="ic">${GAME_TYPE[g.loai].split(' ')[0]}</span><b>${esc(g.ten)}</b><span>${esc(g.bai || '')}</span>
        <span>${g.id.startsWith('S-') ? 'Bộ mẫu SmarttechCN' : 'Soạn bởi ' + esc(g.tenGV || '')}</span></a>`).join('') || '<div class="card empty">Chưa có trò chơi cho lựa chọn này.</div>'}</div>`);
    $$('[data-k]').forEach(b => b.onclick = () => { k = b.dataset.k; draw(); });
    $$('[data-t]').forEach(b => b.onclick = () => { type = b.dataset.t; draw(); });
  };
  draw();
});

route(/^\/trochoi\/choi\/(.+)$/, async (params, id) => {
  const g = (await allGames()).find(x => x.id === id);
  if (!g) { errBox(V, 'Không tìm thấy trò chơi'); return; }
  const head = `<div class="row"><a href="#/trochoi" class="grow">← Trò chơi</a>${fullBtn()}${isGV() && !g.id.startsWith('S-') ? `<a class="btn ghost sm" href="#/trochoi/soan?id=${g.id}">Sửa</a>` : ''}</div><h1>${GAME_TYPE[g.loai]} – ${esc(g.ten)}</h1><p class="sub">${esc(g.bai || '')}</p>`;
  const big = 'font-size:clamp(18px,3.2vw,30px)';
  if (g.loai === 'doantu') {
    let i = 0, got = new Set(), wrong = 0, score = 0, shown = false;
    const MAXW = 6;
    const draw = () => {
      const it = g.items[i], w = gnorm(it.tu), done = w.split('').every(c => got.has(c)) || shown, lost = wrong >= MAXW && !done;
      setView(`${head}<div class="card"><div class="row"><b class="grow">Từ ${i + 1}/${g.items.length}</b><span class="pill">Điểm: ${score}</span><span class="pill ${wrong >= 4 ? 'bad' : 'warn'}">Sai: ${wrong}/${MAXW}</span></div>
        <p style="${big};font-weight:600;margin:14px 0">💡 ${esc(it.goiY)}</p>
        <div class="row" style="justify-content:center;gap:6px;margin:18px 0">${w.split('').map(c => `<span style="width:clamp(30px,6vw,56px);height:clamp(38px,7vw,64px);border-bottom:4px solid var(--brand2);display:flex;align-items:center;justify-content:center;font-weight:800;${big}">${got.has(c) || done || lost ? c : ''}</span>`).join('')}</div>
        <p class="hint" style="text-align:center">${w.length} chữ cái (viết không dấu)${done || lost ? ' · Đáp án: <b>' + esc(it.hien || it.tu) + '</b>' : ''}</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:6px;margin-top:10px">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => `<button class="btn ${got.has(c) ? (w.includes(c) ? '' : 'danger') : 'ghost'}" data-c="${c}" ${got.has(c) || done || lost ? 'disabled' : ''} style="padding:8px 0;font-size:18px">${c}</button>`).join('')}</div>
        <div class="row" style="margin-top:14px">${!done && !lost ? '<button class="btn ghost" id="sh">Mở đáp án</button>' : ''}<span class="spacer"></span>${done || lost ? `<button class="btn" id="nx">${i < g.items.length - 1 ? 'Từ tiếp theo →' : 'Kết thúc'}</button>` : ''}</div></div>`);
      bindFull();
      $$('[data-c]').forEach(b => b.onclick = () => { const c = b.dataset.c; got.add(c); if (!w.includes(c)) wrong++; else if (w.split('').every(x => got.has(x))) score += Math.max(1, MAXW - wrong); draw(); });
      if ($('#sh')) $('#sh').onclick = () => { shown = true; draw(); };
      if ($('#nx')) $('#nx').onclick = () => { if (i < g.items.length - 1) { i++; got = new Set(); wrong = 0; shown = false; draw(); } else { setView(`${head}<div class="hero"><h1>Hoàn thành! Tổng điểm: ${score}</h1></div><a class="btn" href="#/trochoi/choi/${encodeURIComponent(id)}">Chơi lại</a>`); bindFull(); } };
    };
    draw(); return;
  }
  if (g.loai === 'ochu') {
    const L = ochuLayout(g);
    if (L.bad.length) { errBox(V, 'Hàng ' + L.bad.join(', ') + ' không chứa chữ cái của từ khóa'); return; }
    const open = new Set(); let cur = -1, keyOpen = false, timer = null, left = 0;
    const draw = () => {
      clearInterval(timer);
      const cell = 'clamp(26px,4.6vw,46px)';
      setView(`${head}<div class="card" style="overflow-x:auto"><div style="display:grid;grid-template-columns:auto repeat(${L.W},${cell});gap:4px;justify-content:center">
        ${L.rows.map((r, ri) => `<button class="btn ${open.has(ri) ? '' : 'ghost'} sm" data-r="${ri}" style="min-height:0;height:${cell}">${ri + 1}</button>${Array.from({ length: L.W }, (_, x) => { const k = x - r.off; if (k < 0 || k >= r.a.length) return '<span></span>'; const key = x === L.col;
          return `<span style="height:${cell};border:2px solid ${key ? 'var(--accent)' : 'var(--line)'};background:${key ? 'var(--accent-soft)' : 'var(--card)'};border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:clamp(14px,2.6vw,24px)">${open.has(ri) || (keyOpen && key) ? r.a[k] : ''}</span>`; }).join('')}`).join('')}</div>
        ${cur >= 0 ? `<div class="expl" style="margin-top:14px"><b class="t">Hàng ${cur + 1} (${L.rows[cur].a.length} chữ cái) <span id="tm" class="pill warn">${left}s</span></b><span style="${big}">${esc(g.items[cur].goiY)}</span></div>
          <div class="row" style="margin-top:8px"><button class="btn" id="op">Mở hàng ${cur + 1}</button></div>` : '<p class="hint" style="margin-top:12px">Bấm số thứ tự hàng để xem câu hỏi. Ô viền cam là từ khóa.</p>'}
        <div class="row" style="margin-top:14px"><input id="kw" type="text" placeholder="Đoán từ khóa (${L.K.length} chữ cái)…" style="flex:1"><button class="btn accent" id="gk">Đoán</button><button class="btn ghost" id="ok2">Mở từ khóa</button></div>
        ${keyOpen ? `<div class="okmsg" style="${big}">🔑 Từ khóa: <b>${esc(g.hienTuKhoa || g.tuKhoa)}</b> – ${esc(g.goiYTuKhoa || '')}</div>` : (g.goiYTuKhoa ? `<p class="hint">Gợi ý từ khóa: ${esc(g.goiYTuKhoa)}</p>` : '')}</div>`);
      bindFull();
      $$('[data-r]').forEach(b => b.onclick = () => { cur = +b.dataset.r; left = 20; draw(); timer = setInterval(() => { left--; const t = $('#tm'); if (t) t.textContent = left > 0 ? left + 's' : 'Hết giờ'; if (left <= 0) clearInterval(timer); }, 1000); });
      if ($('#op')) $('#op').onclick = () => { open.add(cur); cur = -1; draw(); };
      $('#ok2').onclick = () => { keyOpen = true; draw(); };
      $('#gk').onclick = () => { if (gnorm($('#kw').value) === gnorm(g.tuKhoa)) { keyOpen = true; L.rows.forEach((_, r) => open.add(r)); toast('🎉 Chính xác!'); draw(); } else toast('Chưa đúng, thử lại!'); };
    };
    cleanup = () => clearInterval(timer);
    draw(); return;
  }
  // lật ô đoán tranh: mỗi ô là một câu hỏi “Biết” của bài
  const n = [4, 6, 9].includes(+g.soO) ? +g.soO : 6, cols = n === 4 ? 2 : 3;
  let pool = bank.q.filter(q => q.t === 'M' && q.bai === g.bai && q.md === 'Biết' && !/class="pic"/.test(q.s));
  if (pool.length < n) pool = bank.q.filter(q => q.t === 'M' && q.bai === g.bai);
  const qs = shuffle(pool).slice(0, n);
  let src = g.anh || '';
  if (g.anhId) { try { const r = await api('get_game_image', { id: g.id }); src = `data:${r.mime};base64,${r.data}`; } catch (e) {} }
  const state = qs.map(() => 0); let cur = -1, picked = null, keyOpen = false;
  const draw = () => {
    const q = cur >= 0 ? qs[cur] : null;
    setView(`${head}<div class="card"><div style="position:relative;display:table;margin:0 auto;border-radius:12px;overflow:hidden;background:#000">
        <img src="${esc(src)}" alt="" style="display:block;max-width:100%;max-height:62vh;min-height:200px">
        <div style="position:absolute;inset:0;display:grid;grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${Math.ceil(n / cols)},1fr)">
          ${qs.map((_, k) => `<button data-o="${k}" style="border:2px solid #fff;font-size:clamp(22px,5vw,44px);font-weight:800;color:#fff;cursor:pointer;transition:opacity .5s;background:${['#0f4c45', '#16695f', '#1f7d6f'][k % 3]};opacity:${state[k] === 1 || keyOpen ? 0 : 1};pointer-events:${state[k] === 1 || keyOpen ? 'none' : 'auto'}">${state[k] === 2 ? '✕' : k + 1}</button>`).join('')}</div></div>
      ${q ? `<div style="margin-top:14px"><div class="stem" style="${big}"><b>Ô số ${cur + 1}:</b> ${sanitize(q.s)}</div><div class="opts">${[0, 1, 2, 3].map(j => { const ok = LETTERS[j] === normAns(q); const cls = picked == null ? '' : ok ? ' right' : (picked === j ? ' wrong' : '');
          return `<button class="opt${cls}" data-a="${j}" ${picked != null ? 'disabled' : ''}><span class="L">${LETTERS[j]}</span><span class="tx">${sanitize(q.o[j])}</span></button>`; }).join('')}</div>
        ${picked != null ? `<button class="btn block" id="bk" style="margin-top:10px">${LETTERS[picked] === normAns(q) ? '🎉 Đúng – mở ô!' : 'Chưa đúng – quay lại'}</button>` : ''}</div>` : '<p class="hint" style="margin-top:10px">Chọn một ô số và trả lời đúng để lật ô. Đoán được bức tranh là thắng!</p>'}
      <div class="row" style="margin-top:14px"><input id="kw" type="text" placeholder="Đoán từ khóa của bức tranh…" style="flex:1"><button class="btn accent" id="gk">Đoán</button><button class="btn ghost" id="ok2">Mở tranh</button></div>
      ${keyOpen ? `<div class="okmsg" style="${big}">🔑 <b>${esc(g.hienTuKhoa || g.tuKhoa)}</b></div>` : (g.goiYTuKhoa ? `<p class="hint">Gợi ý: ${esc(g.goiYTuKhoa)}</p>` : '')}</div>`);
    bindFull(); math(V);
    $$('[data-o]').forEach(b => b.onclick = () => { cur = +b.dataset.o; picked = null; draw(); });
    $$('[data-a]').forEach(b => b.onclick = () => { picked = +b.dataset.a; draw(); });
    if ($('#bk')) $('#bk').onclick = () => { state[cur] = LETTERS[picked] === normAns(qs[cur]) ? 1 : 2; cur = -1; picked = null; draw(); };
    $('#ok2').onclick = () => { keyOpen = true; draw(); };
    $('#gk').onclick = () => { if (gnorm($('#kw').value) === gnorm(g.tuKhoa)) { keyOpen = true; toast('🎉 Chính xác!'); draw(); } else toast('Chưa đúng, thử lại!'); };
  };
  draw();
});

route(/^\/trochoi\/soan$/, async params => {
  if (!needGV()) return;
  const id = params.get('id');
  let g = { loai: 'ochu', ten: '', khoi: '12', bai: '', tuKhoa: '', hienTuKhoa: '', goiYTuKhoa: '', items: [{ tu: '', goiY: '' }, { tu: '', goiY: '' }, { tu: '', goiY: '' }], soO: 6 };
  if (id) { const f = (store.get('games', [])).find(x => x.id === id); if (f) g = JSON.parse(JSON.stringify(f)); }
  let anhMoi = null;
  const draw = () => {
    const L = g.loai === 'ochu' && g.tuKhoa ? ochuLayout(g) : null;
    setView(`<a href="#/trochoi">← Trò chơi</a><h1>${id ? 'Sửa' : 'Soạn'} trò chơi</h1><div class="card">
      <div class="tabs">${Object.entries(GAME_TYPE).map(([v, t]) => `<button data-l="${v}" class="${g.loai === v ? 'on' : ''}">${t}</button>`).join('')}</div>
      <label for="tn">Tên trò chơi</label><input id="tn" type="text" value="${esc(g.ten)}">
      <div class="row"><div style="width:110px"><label for="kh">Khối</label><select id="kh">${['10', '11', '12'].map(k => `<option ${k === g.khoi ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
        <div class="grow"><label for="bh">Bài học</label><select id="bh"><option value="">—</option>${lessonsOf(g.khoi).map(b => `<option ${b === g.bai ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></div></div>
      ${g.loai !== 'doantu' ? `<label for="tk">Từ khóa (không dấu, viết liền)</label><input id="tk" type="text" value="${esc(g.tuKhoa)}" placeholder="CAUDAO">
        <label for="htk">Từ khóa hiển thị (có dấu)</label><input id="htk" type="text" value="${esc(g.hienTuKhoa)}" placeholder="CẦU DAO">
        <label for="gtk">Gợi ý từ khóa</label><input id="gtk" type="text" value="${esc(g.goiYTuKhoa)}">` : ''}
      ${g.loai === 'latranh' ? `<label for="so">Số ô</label><select id="so">${[4, 6, 9].map(n => `<option ${+g.soO === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <p class="hint">Mỗi ô là một câu hỏi mức Biết lấy ngẫu nhiên từ bài học đã chọn.</p>
        <label class="btn ghost block" style="margin-top:8px">🖼️ Chọn ảnh bức tranh<input id="im" type="file" accept="image/*" hidden></label>${anhMoi ? `<img src="${anhMoi}" alt="" style="width:100%;margin-top:8px;border-radius:10px">` : ''}`
      : `<h3>${g.loai === 'ochu' ? 'Các hàng ngang (hàng thứ n phải chứa chữ cái thứ n của từ khóa)' : 'Các từ cần đoán'}</h3>
        ${g.items.map((it, i) => `<div class="row" style="margin:6px 0"><b style="width:28px">${i + 1}</b><input data-i="${i}" data-f="tu" type="text" value="${esc(it.tu)}" placeholder="Đáp án" style="width:160px"><input data-i="${i}" data-f="goiY" type="text" value="${esc(it.goiY)}" placeholder="Câu hỏi / gợi ý" style="flex:1">${L && L.rows[i] && L.rows[i].p < 0 ? '<span class="pill bad">thiếu chữ ' + (L.K[i] || '') + '</span>' : ''}<button class="btn ghost sm" data-x="${i}">✕</button></div>`).join('')}
        <button class="btn ghost sm" id="add">+ Thêm hàng</button>`}
      <div id="msg"></div><div class="row" style="margin-top:14px"><button class="btn" id="sv">Lưu trò chơi</button>${id ? '<button class="btn danger" id="dl">Xóa</button>' : ''}</div></div>`);
    const sync = () => { g.ten = $('#tn').value; g.khoi = $('#kh').value; g.bai = $('#bh').value; if ($('#tk')) { g.tuKhoa = $('#tk').value; g.hienTuKhoa = $('#htk').value; g.goiYTuKhoa = $('#gtk').value; } if ($('#so')) g.soO = +$('#so').value; $$('[data-i]').forEach(el => { g.items[+el.dataset.i][el.dataset.f] = el.value; }); };
    $$('[data-l]').forEach(b => b.onclick = () => { sync(); g.loai = b.dataset.l; draw(); });
    $('#kh').onchange = () => { sync(); g.bai = ''; draw(); };
    if ($('#tk')) $('#tk').onchange = () => { sync(); draw(); };
    $$('[data-i]').forEach(el => el.onchange = () => { sync(); if (g.loai === 'ochu') draw(); });
    $$('[data-x]').forEach(b => b.onclick = () => { sync(); g.items.splice(+b.dataset.x, 1); draw(); });
    if ($('#add')) $('#add').onclick = () => { sync(); g.items.push({ tu: '', goiY: '' }); draw(); };
    if ($('#im')) $('#im').onchange = async e => { sync(); const f = e.target.files[0]; if (f) { anhMoi = await compressImage(f, 1400); draw(); } };
    $('#sv').onclick = async () => {
      sync();
      g.items = g.items.filter(it => gnorm(it.tu)).map(it => ({ tu: gnorm(it.tu), hien: it.hien || it.tu.toUpperCase(), goiY: it.goiY }));
      if (g.loai === 'ochu') { if (g.items.length !== gnorm(g.tuKhoa).length) { errBox($('#msg'), 'Số hàng ngang phải bằng số chữ cái của từ khóa (' + gnorm(g.tuKhoa).length + ')'); draw(); return; } const l = ochuLayout(g); if (l.bad.length) { errBox($('#msg'), 'Hàng ' + l.bad.join(', ') + ' không chứa chữ cái tương ứng của từ khóa'); return; } }
      if (g.loai === 'latranh' && !anhMoi && !g.anhId && !g.anh) { errBox($('#msg'), 'Hãy chọn ảnh bức tranh'); return; }
      if (g.loai === 'latranh' && !g.bai) { errBox($('#msg'), 'Hãy chọn bài học để lấy câu hỏi cho các ô'); return; }
      await busy($('#sv'), async () => { try { const r = await api('save_game', { game: Object.assign({}, g, { anhMoi }) }); toast('Đã lưu'); location.hash = '#/trochoi/choi/' + r.id; } catch (e) { errBox($('#msg'), e); } });
    };
    if ($('#dl')) $('#dl').onclick = async () => { if (!confirm('Xóa trò chơi này?')) return; try { await api('delete_game', { id }); location.hash = '#/trochoi'; } catch (e) { toast(e.message); } };
  };
  draw();
});

/* ================= AI TẠO BÀI TOÁN THIẾT KẾ KĨ THUẬT (STEM – địa phương) ================= */
const DESIGN_FIELDS = ['Nông nghiệp – chế biến nông sản (sen Huế, tinh bột sắn…)', 'Cơ khí & tự động hoá (đóng gói mè xửng, băng tải…)', 'Điện tử – IoT (cảnh báo lũ, ngập lụt…)',
  'Điện dân dụng & tiết kiệm điện', 'Làng nghề truyền thống (đúc đồng, nón lá…)', 'Môi trường & phòng chống thiên tai', 'Du lịch – dịch vụ thông minh'];
function designHtml(d, k) {
  const li = a => (a || []).filter(Boolean).map(x => `<li>${esc(typeof x === 'string' ? x : JSON.stringify(x))}</li>`).join('');
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">💡 ${esc(d.ten)}</h2><span class="pill">${esc(d.linh_vuc || '')}</span></div>
    <h3>Bối cảnh</h3><p>${esc(d.boi_canh || '')}</p><h3>Vấn đề cần giải quyết</h3><p>${esc(d.van_de || '')}</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
      <div><h3>Yêu cầu</h3><ul>${li(d.yeu_cau)}</ul></div><div><h3>Ràng buộc</h3><ul>${li(d.rang_buoc)}</ul></div>
      <div><h3>Sản phẩm cần nộp</h3><ul>${li(d.san_pham)}</ul></div><div><h3>Gợi ý các bước</h3><ol>${li(d.goi_y_buoc)}</ol></div></div>
    <h3>Tiêu chí đánh giá</h3><table><tbody>${(d.tieu_chi || []).map(c => `<tr><td>${esc(c.tieu_chi || c)}</td><td class="n"><b>${esc(c.diem == null ? '' : c.diem)}</b></td></tr>`).join('')}</tbody></table>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))"><div><h3>Kiến thức liên quan</h3><ul>${li(d.kien_thuc)}</ul></div><div><h3>Nghề nghiệp liên quan</h3><ul>${li(d.nghe_nghiep)}</ul></div></div>
    ${(d.an_toan || []).length ? `<div class="expl"><b class="t">⚠️ An toàn</b><ul style="margin:4px 0 0">${li(d.an_toan)}</ul></div>` : ''}
    <div class="row" style="margin-top:12px">${k != null ? `<button class="btn ghost sm" data-save="${k}">💾 Lưu</button>` : ''}<button class="btn ghost sm" data-print="${k == null ? d.id : k}">🖨️ In phiếu dự án</button>
      <button class="btn sm" data-assign="${k == null ? d.id : k}">📷 Giao HS nộp bản phác thảo</button>${k == null ? `<button class="btn danger sm" data-del="${d.id}">Xóa</button>` : ''}</div></div>`;
}
function designCriteria(d) { return (d.tieu_chi || []).map(c => (c.tieu_chi || c) + (c.diem != null ? ' – ' + c.diem + ' điểm' : '')).join('\n'); }
function designText(d) {
  const L = (t, a) => (a || []).filter(Boolean).length ? t + ':\n' + a.filter(Boolean).map(x => '• ' + (typeof x === 'string' ? x : JSON.stringify(x))).join('\n') : '';
  return [d.ten ? '💡 ' + d.ten : '', d.boi_canh ? 'Bối cảnh: ' + d.boi_canh : '', 'Vấn đề cần giải quyết: ' + (d.van_de || ''), L('Yêu cầu', d.yeu_cau), L('Ràng buộc', d.rang_buoc),
    L('Sản phẩm cần có', d.san_pham), L('Gợi ý các bước (quy trình thiết kế kĩ thuật)', d.goi_y_buoc), L('Lưu ý an toàn', d.an_toan),
    'Nộp qua app: ảnh chụp bản phác thảo thiết kế (hình vẽ, sơ đồ, chú thích kích thước, vật liệu).'].filter(Boolean).join('\n\n');
}
function printDesign(d) {
  const w = window.open('', '_blank'); if (!w) { toast('Hãy cho phép cửa sổ bật lên'); return; }
  w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(d.ten)}</title><style>body{font-family:"Times New Roman",serif;font-size:13pt;line-height:1.4;max-width:180mm;margin:12mm auto;color:#000}h1{font-size:17pt;text-align:center}h3{margin:10px 0 4px}table{width:100%;border-collapse:collapse}td{border:1px solid #000;padding:4px 8px}.bar{font-family:sans-serif;margin-bottom:10px}@media print{.bar{display:none}}</style></head><body>
    <div class="bar"><button onclick="print()">🖨️ In / Lưu PDF</button></div><p><b>PHIẾU DỰ ÁN THIẾT KẾ KĨ THUẬT – CÔNG NGHỆ ${esc(d.khoi || '')}</b><br>Nhóm: …………………… Lớp: ………</p>${designHtml(d).replace(/<div class="row" style="margin-top:12px">[\s\S]*?<\/div><\/div>$/, '</div>')}</body></html>`);
  w.document.close();
}
route(/^\/gv\/thietke$/, async params => {
  if (!needGV()) return;
  const defK = params ? (params.get('k') || '12') : '12';
  const defLv = defK === '10' ? DESIGN_FIELDS[0] : (defK === '11' ? DESIGN_FIELDS[1] : DESIGN_FIELDS[2]);
  let results = [], saved = [], f = { khoi: defK, linhVuc: defLv || DESIGN_FIELDS[2], diaPhuong: 'Thành phố Huế', mucDo: 'coban', soLuong: 2, yeuCau: '' };
  const load = async () => { try { saved = await api('list_designs'); } catch (e) { saved = []; } draw(); };
  const draw = () => {
    setView(`<h1>💡 AI tạo bài toán thiết kế kĩ thuật</h1><p class="sub">AI soạn bài toán STEM gắn thực tiễn địa phương, đúng phạm vi kiến thức từng khối, có tiêu chí đánh giá và nghề nghiệp liên quan. Thầy cô đọc lại và chỉnh sửa trước khi giao.</p>
      <div class="card"><div class="row"><div style="width:110px"><label for="kh">Khối</label><select id="kh">${['10', '11', '12'].map(k => `<option ${k === f.khoi ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
        <div class="grow"><label for="lv">Lĩnh vực</label><select id="lv">${DESIGN_FIELDS.map(x => `<option ${x === f.linhVuc ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div></div>
        <div class="row"><div class="grow"><label for="dp">Địa phương</label><input id="dp" type="text" value="${esc(f.diaPhuong)}"></div>
        <div style="width:150px"><label for="md">Mức độ</label><select id="md"><option value="coban" ${f.mucDo === 'coban' ? 'selected' : ''}>Cơ bản</option><option value="nangcao" ${f.mucDo === 'nangcao' ? 'selected' : ''}>Nâng cao</option></select></div>
        <div style="width:110px"><label for="sl">Số bài</label><select id="sl">${[1, 2, 3].map(n => `<option ${n === f.soLuong ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
        <label for="yc">Ý tưởng thêm (không bắt buộc)</label><textarea id="yc" placeholder="Ví dụ: mạch cảnh báo lũ dùng cảm biến siêu âm gửi thông báo về điện thoại; tay gắp sản phẩm đóng gói mè xửng…">${esc(f.yeuCau)}</textarea>
        <div id="msg"></div><button class="btn block" id="go" style="margin-top:12px">✨ Tạo bài toán</button></div>
      <div id="res">${results.map((d, k) => designHtml(d, k)).join('')}</div>
      <h2>Bài toán đã lưu (${saved.length})</h2>${saved.map(d => designHtml(d, null)).join('') || '<div class="card empty">Chưa lưu bài toán nào.</div>'}`);
    const sync = () => { f = { khoi: $('#kh').value, linhVuc: $('#lv').value, diaPhuong: $('#dp').value, mucDo: $('#md').value, soLuong: +$('#sl').value, yeuCau: $('#yc').value }; };
    $('#go').onclick = () => { sync(); busy($('#go'), async () => {
      $('#go').textContent = '🤖 AI đang soạn (khoảng 10–60 giây, xin chờ)…';
      try { results = (await api('ai_design_problems', f)).map(d => Object.assign(d, { khoi: f.khoi })); draw(); window.scrollTo(0, $('#res').offsetTop - 70); }
      catch (e) { errBox($('#msg'), e); }
    }); };
    const get = key => results[+key] || saved.find(d => d.id === key);
    $$('[data-save]').forEach(b => b.onclick = async () => { try { const d = await api('save_design', { design: results[+b.dataset.save] }); saved.unshift(d); results.splice(+b.dataset.save, 1); toast('Đã lưu'); draw(); } catch (e) { toast(e.message); } });
    $$('[data-print]').forEach(b => b.onclick = () => printDesign(get(b.dataset.print)));
    $$('[data-assign]').forEach(b => b.onclick = () => { const d = get(b.dataset.assign); store.set('prefill_draw', { t: d.ten, db: designText(d), tc: designCriteria(d), loai: 'thietke' }); location.hash = '#/gv/baive/moi'; });
    $$('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Xóa bài toán này?')) return; try { await api('delete_design', { id: b.dataset.del }); saved = saved.filter(d => d.id !== b.dataset.del); draw(); } catch (e) { toast(e.message); } });
  };
  draw(); load();
});


/* ================= HS luyện đề kiểm tra định kì theo ma trận CV 7991 ================= */
route(/^\/dinhki$/, params => {
  const all = window.STC_MATRAN || [];
  const ks = [...new Set(all.map(t => t.khoi))].filter(k => isGV() || getAllowedGrades().includes(k));
  if (!ks.length) { setView('<h1>Luyện đề định kì</h1><div class="card empty">Chưa có ma trận cho khối của em.</div>'); return; }
  let k = (params && ks.includes(params.get('k'))) ? params.get('k') : (ks.includes(getStudentGrade()) ? getStudentGrade() : ks[ks.length - 1]);
  const hist = store.get('hist_' + uid(), []);
  const draw = () => {
    setView(`<h1>📑 Luyện đề kiểm tra định kì</h1><p class="sub">Mỗi lần bấm là một đề mới bốc ngẫu nhiên từ ngân hàng, đúng ma trận theo Công văn 7991/BGDĐT: <b>12 câu trắc nghiệm</b> (3 điểm) · <b>4 câu Đúng/Sai</b> (4 điểm) · <b>tự luận</b> (3 điểm, AI chấm theo đáp án mẫu).</p>
      ${ks.length > 1 ? `<div class="tabs">${ks.map(x => `<button data-k="${x}" class="${x === k ? 'on' : ''}">Công nghệ ${x}</button>`).join('')}</div>` : ''}
      <div class="list">${all.filter(t => t.khoi === k).map(t => {
        const s = mxTotals(t.rows), ntl = s.tb + s.th + s.tv, b = buildFromMatrix(t);
        const mine = hist.filter(h => h.key === 'DK:' + t.id), best = mine.length ? Math.max(...mine.map(h => h.diem)) : null;
        const lessons = t.rows.map(r => r.value.replace(/^(Bài \d+)\..*/, '$1')).join(', ');
        return `<div class="item"><div class="grow"><b>${esc(t.loai)} – Công nghệ ${esc(t.khoi)}</b>
          <div class="meta">${s.b + s.h + s.v} TN + ${s.ds} Đ/S + ${ntl} tự luận · ${t.thoiGian} phút · ${esc(lessons)}</div>
          <div class="row" style="margin-top:4px">${best != null ? `<span class="pill ok">Đã luyện ${mine.length} đề · cao nhất ${fmt(best)}</span>` : ''}${b.miss.length ? `<span class="pill warn" title="${esc(b.miss.join('; '))}">Ngân hàng còn thiếu ${b.miss.length} vị trí – đề sẽ ít câu hơn</span>` : '<span class="pill">Đủ câu theo ma trận</span>'}</div></div>
          <button class="btn sm" data-t="${t.id}">Làm đề</button></div>`;
      }).join('')}</div>
      <p class="hint" style="margin-top:12px">Câu nào chưa có trong ngân hàng ở đúng bài học, app lấy bù câu cùng chương. Thầy cô bổ sung câu hỏi ở mục “Thêm câu hỏi” hoặc trang NganHang trong Google Sheets.</p>`);
    $$('[data-k]').forEach(b => b.onclick = () => { k = b.dataset.k; draw(); });
    $$('[data-t]').forEach(b => b.onclick = () => {
      const t = all.find(x => x.id === b.dataset.t), x = buildFromMatrix(t);
      if (!x.ids.length) { toast('Ngân hàng chưa có câu cho ma trận này'); return; }
      const s = mxTotals(t.rows), want = s.tb + s.th + s.tv;
      // CV 7991: phần tự luận luôn 3 điểm, chia đều cho các câu tự luận của đề
      startQuiz({ title: `Đề luyện ${t.loai} – Công nghệ ${t.khoi}`, key: 'DK:' + t.id, loai: 'dinhki', ids: x.ids, minutes: t.thoiGian, tlw: x.nTL && want ? 3 * x.nTL / want : 0 });
    });
  };
  draw();
});

/* ================= Sách giáo khoa: bài học ↔ trang SGK, đọc ngay trong app ================= */
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const sgkDocs = {};
function sgkLesson(q) {
  const S = window.STC_SGK; if (!S || !q) return null;
  const b = S.books[q.k]; if (!b) return null;
  const m = /^Bài\s*(\d+)/i.exec(q.bai || '');
  const n = m ? +m[1] : (S.alias[q.k + '|' + (q.bai || '')] || S.alias[q.k + '|' + (q.cd || '').replace(/^Lớp \d+ – /, '')]);
  const l = n && b.bai.find(x => x.so === n);
  return l ? { b, l, exact: !!m } : null;
}
const sgkHref = (k, pdf) => `#/sgk/doc?k=${k}&p=${pdf}`;
/** mã file Google Drive từ link chia sẻ (…/file/d/ID/…, ?id=ID) */
function driveId(u) { const m = /\/d\/([\w-]{20,})|[?&]id=([\w-]{20,})/.exec(String(u || '')); return m ? (m[1] || m[2]) : ''; }
function sgkLink(q) {
  const r = sgkLesson(q); if (!r) return '';
  return `<a class="sgklink" href="${sgkHref(r.b.k, r.l.pdf)}">📘 Xem lại lí thuyết: SGK Công nghệ ${r.b.k}, ${r.exact ? 'Bài ' + r.l.so + '. ' + esc(r.l.ten) : esc(r.l.chuong)} (tr. ${r.l.trang})</a>`;
}
/** tên bài trong ngân hàng ứng với bài số n của SGK khối k */
function bankLessonName(k, n) { return lessonsOf(k).find(t => new RegExp('^Bài\\s*' + n + '\\.').test(t)) || null; }

route(/^\/sgk$/, params => {
  const S = window.STC_SGK; if (!S) { location.hash = '#/'; return; }
  const ks = Object.keys(S.books).filter(k => isGV() || getAllowedGrades().includes(k));
  if (!ks.length) { setView('<h1>Sách giáo khoa</h1><div class="card empty">Chưa có SGK cho khối của em.</div>'); return; }
  let k = (params && ks.includes(params.get('k'))) ? params.get('k') : (ks.includes(getStudentGrade()) ? getStudentGrade() : ks[0]);
  const draw = () => {
    const b = S.books[k], chs = [...new Set(b.bai.map(l => l.chuong))];
    setView(`<h1>📘 Sách giáo khoa</h1><p class="sub">${esc(b.ten)} · Đọc lại lí thuyết rồi ôn ngay câu hỏi của bài.</p>
      ${ks.length > 1 ? `<div class="tabs">${ks.map(x => `<button data-k="${x}" class="${x === k ? 'on' : ''}">Công nghệ ${x}</button>`).join('')}</div>` : ''}
      <div class="row" style="margin-bottom:10px"><a class="btn sm" href="${sgkHref(k, 1)}">📖 Đọc từ đầu sách</a></div>
      ${chs.map(ch => `<h2>${esc(ch)}</h2><div class="list">${b.bai.filter(l => l.chuong === ch).map(l => {
        const name = bankLessonName(k, l.so), qs = name ? bank.q.filter(q => q.k === k && q.bai === name) : [];
        const nL = qs.filter(q => q.t === 'L').length;
        return `<div class="item"><div class="grow"><b>Bài ${l.so}. ${esc(l.ten)}</b><div class="meta">Trang ${l.trang}${qs.length ? ` · ${qs.length} câu ôn tập${nL ? ' (' + nL + ' tự luận)' : ''}` : ''}</div></div>
          <div class="row"><a class="btn ghost sm" href="${sgkHref(k, l.pdf)}">📖 Đọc</a>${qs.length ? `<a class="btn sm" href="#/chude?by=bai&k=${k}&bai=${encodeURIComponent(name)}">🎯 Ôn bài</a>` : ''}</div></div>`;
      }).join('')}</div>`).join('')}`);
    $$('[data-k]').forEach(x => x.onclick = () => { k = x.dataset.k; draw(); });
  };
  draw();
});

route(/^\/sgk\/doc$/, async params => {
  const S = window.STC_SGK, k = params.get('k'), b = S && S.books[k];
  if (!b) { location.hash = '#/sgk'; return; }
  let p = Math.max(1, Math.min(b.soTrang, +params.get('p') || 1)), zoom = 1, doc = null, busyR = false, want = 0;
  const lessonAt = pg => b.bai.filter(l => l.pdf <= pg).pop();
  const did = driveId(b.drive);
  if (did) {
    // SGK lưu trên Google Drive: dùng trình xem của Drive (không nhảy trang được) và chỉ dẫn trang cần mở
    const drawDrive = () => {
      const l = lessonAt(p), name = l && bankLessonName(k, l.so), tr = p - b.lech;
      setView(`<div class="pdfbar"><a class="btn ghost sm" href="#/sgk?k=${k}">☰ Mục lục</a>
          <select id="ls" class="grow" aria-label="Chọn bài">${b.bai.map(x => `<option value="${x.pdf}" ${l && x.so === l.so ? 'selected' : ''}>Bài ${x.so}. ${esc(x.ten)}</option>`).join('')}</select></div>
        <div class="card note pagehint">📖 <b>${l ? 'Bài ' + l.so + '. ' + esc(l.ten) : esc(b.ten)}</b> – em lật tới <b>trang ${tr}</b> của sách${tr !== p ? ` (trang ${p} trên thanh trang của trình xem)` : ''}.
          <a class="btn ghost sm" href="https://drive.google.com/file/d/${did}/view" target="_blank" rel="noopener">↗ Mở trong tab mới</a></div>
        <div class="pdfwrap drive"><iframe src="https://drive.google.com/file/d/${did}/preview" title="${esc(b.ten)}" allow="autoplay" loading="lazy"></iframe></div>
        <p class="hint">Nếu không hiện sách: hãy đăng nhập tài khoản Google được thầy cô chia sẻ, hoặc bấm “Mở trong tab mới”.</p>
        ${name ? `<div class="card row" style="margin-top:12px"><div class="grow">Đọc xong <b>Bài ${l.so}</b>? Ôn ngay câu hỏi của bài này.</div><a class="btn sm" href="#/chude?by=bai&k=${k}&bai=${encodeURIComponent(name)}">🎯 Ôn bài ${l.so}</a></div>` : ''}`);
      $('#ls').onchange = e => { p = +e.target.value; history.replaceState(null, '', `#/sgk/doc?k=${k}&p=${p}`); const f = $('iframe'); drawDrive(); };
    };
    drawDrive();
    return;
  }
  setView(`<div class="pdfbar">
      <a class="btn ghost sm" href="#/sgk?k=${k}">☰ Mục lục</a>
      <select id="ls" class="grow" aria-label="Chọn bài">${b.bai.map(l => `<option value="${l.pdf}">Bài ${l.so}. ${esc(l.ten)}</option>`).join('')}</select>
    </div>
    <div class="pdfbar">
      <button class="btn ghost sm" id="pv" aria-label="Trang trước">‹</button>
      <span class="pg">Trang <input id="pn" type="number" min="0" max="${b.soTrang - b.lech}" inputmode="numeric"> / ${b.soTrang - b.lech}</span>
      <button class="btn ghost sm" id="nx" aria-label="Trang sau">›</button>
      <span class="spacer"></span>
      <button class="btn ghost sm" id="zo" aria-label="Thu nhỏ">−</button><button class="btn ghost sm" id="zi" aria-label="Phóng to">+</button>
      <a class="btn ghost sm" id="raw" target="_blank" rel="noopener">⤓ File gốc</a>
    </div>
    <div class="pdfwrap" id="pw"><div class="hint" id="pst">Đang mở sách…</div><canvas id="pc"></canvas></div>
    <div id="act"></div>`);
  const show = async () => {
    want = p;
    $('#pn').value = p - b.lech; $('#raw').href = b.file + '#page=' + p;
    const l = lessonAt(p); if (l) $('#ls').value = l.pdf;
    const name = l && bankLessonName(k, l.so);
    $('#act').innerHTML = name ? `<div class="card row" style="margin-top:12px"><div class="grow">Đọc xong <b>Bài ${l.so}</b>? Ôn ngay câu hỏi của bài này.</div><a class="btn sm" href="#/chude?by=bai&k=${k}&bai=${encodeURIComponent(name)}">🎯 Ôn bài ${l.so}</a></div>` : '';
    history.replaceState(null, '', `#/sgk/doc?k=${k}&p=${p}`);
    if (!doc || busyR) return;
    busyR = true;
    try {
      const page = await doc.getPage(p);
      const cv = $('#pc'); if (!cv) return;
      const w = $('#pw').clientWidth || 360, base = page.getViewport({ scale: 1 });
      const scale = w / base.width * zoom, dpr = Math.min(2, window.devicePixelRatio || 1);
      const vp = page.getViewport({ scale: scale * dpr });
      cv.width = vp.width; cv.height = vp.height; cv.style.width = (vp.width / dpr) + 'px';
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      if ($('#pst')) $('#pst').textContent = '';
    } catch (e) { if ($('#pst')) $('#pst').textContent = 'Không hiển thị được trang này.'; }
    finally { busyR = false; if (want !== p) show(); }
  };
  const go = n => { p = Math.max(1, Math.min(b.soTrang, n)); show(); window.scrollTo(0, 0); };
  $('#pv').onclick = () => go(p - 1); $('#nx').onclick = () => go(p + 1);
  $('#pn').onchange = e => go((+e.target.value || 0) + b.lech);
  $('#ls').onchange = e => go(+e.target.value);
  $('#zi').onclick = () => { zoom = Math.min(3, zoom + 0.25); show(); }; $('#zo').onclick = () => { zoom = Math.max(0.5, zoom - 0.25); show(); };
  const key = e => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; if (e.key === 'ArrowLeft') go(p - 1); if (e.key === 'ArrowRight') go(p + 1); };
  let sx = null; const ts = e => { sx = e.touches[0].clientX; }, te = e => { if (sx == null || zoom > 1) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 70) go(p + (dx < 0 ? 1 : -1)); sx = null; };
  document.addEventListener('keydown', key); $('#pw').addEventListener('touchstart', ts, { passive: true }); $('#pw').addEventListener('touchend', te);
  cleanup = () => document.removeEventListener('keydown', key);
  show();
  try {
    await loadScript(PDFJS + 'pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
    doc = sgkDocs[k] || (sgkDocs[k] = await window.pdfjsLib.getDocument({ url: b.file, rangeChunkSize: 262144, disableAutoFetch: true }).promise);
    show();
  } catch (e) {
    delete sgkDocs[k];
    if ($('#pst')) $('#pst').innerHTML = `Không mở được sách trong app${navigator.onLine ? '' : ' (đang ngoại tuyến)'}. <a href="${b.file}#page=${p}" target="_blank" rel="noopener">Mở file PDF</a>`;
  }
});


/* ================= Khởi động ================= */
(async () => {
  renderMenu(); netBadge();
  await loadBank();
  render();
  flush();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
})();
