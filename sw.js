/* SmarttechCN 2026 – Service Worker: chạy offline, tải nhanh */
const VER = 'stc-2026.10.31-4';
const SHELL = ['./', 'index.html', 'app.js', 'style.css', 'config.js', 'sgk.js', 'matran.js', 'manifest.webmanifest', 'bank.json', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VER && k.startsWith('stc-')).map(k => caches.delete(k)));
    await self.clients.claim();
    // lưu sẵn thư viện hiển thị công thức để dùng offline
    try {
      const c = await caches.open(VER);
      await Promise.all(['katex.min.css', 'katex.min.js', 'contrib/auto-render.min.js'].map(async f => {
        const url = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/' + f;
        if (!(await c.match(url))) { try { const r = await fetch(url, { mode: 'no-cors' }); await c.put(url, r); } catch (err) {} }
      }));
    } catch (err) {}
    // tải trước toàn bộ ảnh để làm bài offline (chạy nền)
    try {
      const list = await (await fetch('img-list.json')).json();
      const c = await caches.open(VER);
      for (let i = 0; i < list.length; i += 20) {
        await Promise.all(list.slice(i, i + 20).map(async f => {
          const url = 'img/' + f;
          if (!(await c.match(url))) { try { const r = await fetch(url); if (r.ok) await c.put(url, r); } catch (err) {} }
        }));
      }
    } catch (err) {}
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                          // gửi bài lên máy chủ: không lưu
  const url = new URL(req.url);
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com') && url.pathname.includes('macros')) return;
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && url.pathname.includes('/sgk/')) return;   // file SGK lớn: tải từng phần, không lưu cả file
  const isCdn = /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|lh3\.googleusercontent\.com/.test(url.hostname);
  if (!sameOrigin && !isCdn) return;
  // ảnh và thư viện: lấy từ bộ nhớ trước (nhanh nhất)
  if (sameOrigin && url.pathname.includes('/img/') || isCdn) {
    e.respondWith(caches.open(VER).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') c.put(req, r.clone());
      return r;
    }));
    return;
  }
  // khung app: dùng bản đã lưu, đồng thời cập nhật bản mới ở nền
  e.respondWith(caches.open(VER).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const r = await net;
    return r || (req.mode === 'navigate' ? c.match('index.html') : Response.error());
  }));
});
