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
  const timer = setTimeout(() => ctl.abort(), 30000);
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
    ? [['#/gv', 'grid', 'Tổng quan', /^\/gv$/], ['#/gv/giaobai', 'send', 'Giao bài', /^\/gv\/(giaobai|matran|sinhde|dethi|baive|thietke)/], ['#/gv/baigiao', 'task', 'Bài đã giao', /^\/gv\/(baigiao|bai\/|lop|hs)/], ['#/gv/nganhang', 'bank', 'Ngân hàng', /^\/gv\/(nganhang|themcau)/]]
    : [['#/', 'home', 'Trang chủ', /^\/$/], ['#/onluyen', 'learn', 'Ôn luyện', /^\/(onluyen|chude|de|dinhki|sgk|sotay|hinhchieu|trochoi)/], ['#/baigiao', 'task', 'Bài giao', /^\/(baigiao|baive)/], ['#/ketqua', 'chart', 'Kết quả', /^\/(ketqua|ketquabai|bxh)/]];
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
      <div class="hero"><h1>SmarttechCN 2026</h1><p class="sub herosub"><b>Trợ lý dạy học và kiểm tra, đánh giá môn CNCN cấp THPT</b><span>🤖 AI chấm bài · HS tự luyện · GV giao bài, xếp hạng</span></p></div>
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
      <a class="qa green" href="${is12 ? '#/de?tab=de' : '#/de?tab=bai'}"><span class="ic">🎓</span>${is12 ? 'Thi thử TN' : 'Làm nguyên bài'}</a>
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
    <h2>Theo nội dung</h2><div class="rows">
      ${row('#/chude?by=bai', '📖', '', 'Theo bài học', 'Chọn bài trong SGK Lớp ' + (is12 ? '10, 11, 12' : g))}
      ${row('#/chude?by=cd', '🎯', '', 'Theo chủ đề', 'Gộp nhiều bài cùng chủ đề')}
      ${row('#/chude?by=dang', '🧩', '', 'Theo dạng câu', 'Trắc nghiệm, Đúng/Sai, tự luận, câu có hình vẽ')}
      ${row('#/de?tab=bai', '📚', '', 'Làm nguyên bài', 'Toàn bộ câu hỏi của một bài, có bấm giờ')}
    </div>
    <h2>Luyện đề</h2><div class="rows">
      ${window.STC_MATRAN ? row('#/dinhki', '📑', 'amber', 'Đề kiểm tra định kì', 'Giữa kì, cuối kì đúng ma trận CV 7991') : ''}
      ${row('#/de?tab=de', '🎓', 'green', 'Đề thi thử tốt nghiệp', is12 ? '30 đề chuẩn cấu trúc, có xếp hạng khối' : 'Dành cho HS lớp 12, tổng hợp 3 khối')}
      ${row('', '🧪', 'green', is12 ? 'Đề tổng hợp theo ma trận' : 'Đề tổng hợp Lớp ' + g, 'Mỗi lần làm là một đề mới', 'id="mx"')}
    </div>
    <h2>Công cụ học tập</h2><div class="rows">
      ${window.STC_SGK ? row('#/sgk', '📘', '', 'Sách giáo khoa', 'Đọc lại lí thuyết từng bài') : ''}
      ${row('#/sotay', '📕', 'red', 'Sổ tay câu sai', 'Làm lại những câu em từng sai')}
      ${row('#/hinhchieu', '🧊', '', 'Hình chiếu 3D', 'Xoay vật thể, tìm hình chiếu đúng')}
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
        <button type="button" data-tab="de" class="${!isBai ? 'on' : ''}">🎓 Đề thi thử tốt nghiệp THPT (30 đề)</button>
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
  const order = [...shuffle(mc), ...shuffle(tf), ...shuffle(es)];
  const perm = {};
  order.forEach(id => { const q = bank.byId[id]; if (q.t === 'M') perm[id] = q.nd ? [0, 1, 2, 3] : shuffle([0, 1, 2, 3]); });
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
        ${L.loai !== 'baigiao' ? '<button class="btn ghost" id="redo">Làm lại cả bài (đảo mới)</button>' : ''}<span class="spacer"></span><a class="btn ghost" href="#/">Trang chủ</a></div>
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

route(/^\/gv$/, async params => {
  if (!needGV()) return;
  const u = session.user;
  let k = (params && params.get('khoi')) || store.get('gv_active_khoi', 'all');
  let classes = null, err = '';
  const nameOf = s => esc(String(s || '').trim().split(' ').slice(-2).join(' '));
  const row = (href, ic, c, t, d) => `<a href="${href}"><span class="ic ${c}">${ic}</span><span class="tx"><b>${t}</b><span>${d}</span></span><span class="chev">›</span></a>`;
  const draw = () => {
    const kq = k === 'all' ? '' : '?k=' + k;
    const cls = (classes || []).filter(c => k === 'all' || String(c.Khoi) === k);
    const hs = cls.reduce((s, c) => s + (+c.siSo || 0), 0);
    const nq = bank.q.filter(q => k === 'all' || q.k === k).length, nTL = bank.q.filter(q => q.t === 'L' && (k === 'all' || q.k === k)).length;
    setView(`<section class="hero">
        <div class="greet"><div><h1>Chào thầy/cô ${nameOf(u.HoTen)} 👋</h1><p class="sub">${esc(u.Truong || '')}${session.role === 'admin' ? ' – Quản trị viên' : ''}</p></div></div>
        <div class="stats"><div class="stat"><b>${classes ? cls.length : '…'}</b><span>lớp</span></div><div class="stat"><b>${classes ? hs : '…'}</b><span>học sinh</span></div><div class="stat"><b>${nq.toLocaleString('vi-VN')}</b><span>câu hỏi (${nTL} tự luận)</span></div></div>
      </section>
      <div class="tabs">${[['all', 'Tất cả'], ['10', 'Khối 10'], ['11', 'Khối 11'], ['12', 'Khối 12']].map(([v, t]) => `<button data-khoi="${v}" class="${k === v ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="quick">
        <a class="qa" href="#/gv/giaobai${kq}"><span class="ic">📤</span>Giao bài</a>
        <a class="qa amber" href="#/gv/matran${kq}"><span class="ic">📑</span>Ma trận & đề</a>
        <a class="qa green" href="#/gv/baigiao"><span class="ic">📊</span>Điểm số</a>
        <a class="qa" href="#/gv/baive${kq}"><span class="ic">📷</span>Bài vẽ AI chấm</a>
        <a class="qa amber" href="#/gv/thietke${kq}"><span class="ic">💡</span>Bài toán thiết kế</a>
        <a class="qa green" href="#/gv/aisoancau${kq}"><span class="ic">🤖</span>AI soạn câu hỏi</a>
        <a class="qa" href="#/gv/nganhang${kq}"><span class="ic">🗂️</span>Ngân hàng</a>
      </div>
      <div class="sechead"><h2>Lớp của tôi</h2><a href="#/gv/taolop">+ Tạo lớp</a></div>
      <div id="cl">${!classes ? `<div class="card empty">${err ? esc(err) : 'Đang tải danh sách lớp…'}</div>`
        : cls.length ? '<div class="rows">' + cls.map(c => `<a href="#/gv/lop/${c.MaLop}"><span class="ic green">🏫</span><span class="tx"><b>${esc(c.TenLop || c.MaLop)}</b><span>Khối ${esc(c.Khoi)} – ${c.siSo} học sinh – mã lớp ${esc(c.MaLop)}${session.role === 'admin' && !c.cuaToi ? ' – lớp của GV khác' : ''}</span></span><span class="chev">›</span></a>`).join('') + '</div>'
        : `<div class="card empty">Chưa có lớp${k === 'all' ? '' : ' khối ' + k}. Tạo lớp để học sinh đăng ký bằng mã lớp.<div style="margin-top:12px"><a class="btn" href="#/gv/taolop">Tạo lớp</a></div></div>`}</div>
      <div class="card" style="margin-top:12px"><div class="row"><div class="grow"><b>Mã chung cho học sinh đăng ký</b><div class="hint">HS bấm “Đăng ký tài khoản mới”, nhập mã này, tự chọn lớp và đặt mật khẩu.</div></div><b id="mcv" style="font-size:1.3em;letter-spacing:2px">${esc(window._maChung || '…')}</b><button class="btn ghost sm" id="mccp">Sao chép</button></div></div>
      <h2>Công cụ trên lớp</h2><div class="rows">
        ${row('#/gv/aisoancau' + kq, '🤖', 'green', 'AI soạn câu hỏi', 'AI soạn câu mới theo bài, mức độ – thầy cô duyệt rồi thêm vào ngân hàng')}
        ${row('#/gv/themcau', '✍️', '', 'Thêm câu hỏi', 'Trắc nghiệm, Đúng/Sai hoặc tự luận có đáp án mẫu')}
        ${row('#/hinhchieu', '🧊', '', 'Hình chiếu 3D', 'Trình chiếu vật thể xoay 360°, tìm hình chiếu đúng')}
        ${row('#/trochoi' + kq, '🎮', 'amber', 'Trò chơi khởi động', 'Đoán từ, ô chữ, lật ô đoán tranh')}
        ${window.STC_SGK ? row('#/sgk', '📘', '', 'Sách giáo khoa', 'Mở SGK đúng bài để trình chiếu') : ''}
        ${row('#/?role=hs', '🎓', 'green', 'Xem như học sinh', 'Thử giao diện học sinh đang dùng')}
        ${session.role === 'admin' ? row('#/admin', '🛡️', 'red', 'Quản trị', 'Duyệt giáo viên, cập nhật ngân hàng') : ''}
      </div>`);
    $$('[data-khoi]').forEach(b => b.onclick = () => { k = b.dataset.khoi; store.set('gv_active_khoi', k); draw(); });
    $('#mccp').onclick = async () => { const m = window._maChung || ''; try { await navigator.clipboard.writeText(m); toast('Đã sao chép mã chung: ' + m); } catch (e) { toast('Mã chung: ' + m, 5000); } };
  };
  draw();
  if (!window._maChung) api('get_common').then(r => { window._maChung = r.ma; const v = $('#mcv'); if (v) v.textContent = r.ma; }).catch(() => {});
  try { classes = await api('my_classes'); } catch (e) { err = e.message; }
  if (location.hash.startsWith('#/gv') && !/#\/gv\//.test(location.hash)) draw();
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
  setView(`<a href="#/gv">← Lớp của tôi</a><div class="row" style="align-items:center"><h1 class="grow" style="margin:6px 0">Lớp ${esc(c.TenLop)}</h1><button class="btn ghost sm" id="lsua">✏️ Sửa lớp</button><button class="btn danger sm" id="lxoa">🗑 Xoá lớp</button></div><p class="sub">Khối ${esc(c.Khoi)} · ${esc(c.Truong || '')} · ${students.length} học sinh</p>
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
    const pkgs = lessonPackages(k), exams = k === '12' ? deList() : [];
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
      <div class="row" style="gap:6px;flex-wrap:wrap">${tpls.map(t => srcBtn(t.id, t.loai)).join('')}${mine.map(m => srcBtn('MT:' + m.MaMT, '🏫 ' + m.TenMT)).join('')}${k === '12' ? srcBtn('SO', '🎓 Đề TN THPT (ma trận Sở)') : ''}${srcBtn('', '✏️ Tự nhập')}</div>`;
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
    return `${kChips(k)}<label>Kiểm tra thường xuyên nhanh</label><div class="row">${[[5, 2, 2, 1], [10, 4, 4, 2], [15, 6, 6, 3]].map(([m, b, h, v]) => `<button type="button" class="btn ghost sm" data-pre="${m},${b},${h},${v}">${m} phút · ${b + h + v} câu</button>`).join('')}</div>
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
      $('#aiout').innerHTML = '<p class="hint">🤖 AI đang phân tích (10–40 giây)…</p>';
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
        <div id="msg"></div><button class="btn block" id="go" ${busyGen ? 'disabled' : ''}>${busyGen ? '🤖 AI đang soạn (10–40 giây)…' : '✨ AI soạn câu hỏi'}</button></div>
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
const DRAW_TYPES = { hinhchieu: 'Bản vẽ hình chiếu vuông góc', banve: 'Bản vẽ kĩ thuật (chi tiết, lắp, xây dựng)', machdien: 'Sơ đồ mạch điện (nguyên lí, lắp đặt)', machdientu: 'Sơ đồ mạch điện tử', thietke: 'Bản phác thảo thiết kế kĩ thuật (dự án STEM)' };
const DRAW_SAMPLE = {
  hinhchieu: 'Vẽ đúng vị trí 3 hình chiếu (đứng, bằng, cạnh) – 3 điểm\nĐúng hình dạng từng hình chiếu – 3 điểm\nĐúng loại nét: nét liền đậm, nét đứt cạnh khuất, nét gạch chấm đường tâm – 2 điểm\nGhi kích thước đúng quy ước – 1 điểm\nBản vẽ sạch, rõ, có khung tên – 1 điểm',
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
const ASG_TYPES = ['Kiểm tra thường xuyên', 'Kiểm tra 15 phút', 'Bài tập về nhà', 'Ôn luyện', 'Kiểm tra giữa kì', 'Kiểm tra cuối kì', 'Thi thử'];
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
    const L = [0.35, -0.55, 0.75], ln = Math.hypot(...L);
    const list = faces.map(f => { const q = f.pts.map(P); return { f, q, d: q.reduce((a, b) => a + b[2], 0) / 4 }; }).sort((a, b) => b.d - a.d);
    list.forEach(({ f, q }) => {
      const nr = rot([f.n[0] + cx, f.n[1] + cy, f.n[2] + cz]);
      if (nr[1] > 0.001) return;  // mặt quay ra sau
      const lam = Math.max(0, (f.n[0] * L[0] + f.n[1] * L[1] + f.n[2] * L[2]) / ln);
      const c = Math.round(150 + 90 * lam);
      ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
      ctx.fillStyle = `rgb(${c - 40},${c - 10},${c})`; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = '#1b2a30'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      f.edge.forEach((e, i) => { if (!e) return; const p1 = q[i], p2 = q[(i + 1) % 4]; ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke(); });
    });
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
      $('#go').textContent = '🤖 AI đang soạn (10–40 giây)…';
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
