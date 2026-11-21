/* SmarttechCN 2026 – ghi lượt thực hành (cập nhật 21/11/2026)
   Bài học gọi STC_LOG({ bai, phan, ten, lop, diem, max, key }) mỗi khi HS chấm điểm / nộp bài.
   Mở trong app: chuyển cho app (lưu + gửi thầy cô). Mở riêng tệp bài học: lưu trên máy này (localStorage). */
(function () {
  function local(o) {
    try {
      var k = 'stc_thuchanh', all = JSON.parse(localStorage.getItem(k) || '[]');
      var n = function (v) { return String(v || '').replace(/\s+/g, ' ').trim(); };
      var ten = n(o.ten) || 'Chưa ghi tên', bai = n(o.bai) || document.title, phan = n(o.phan);
      var rec = o.key ? all.filter(function (r) { return r.key === o.key; })[0] : null;
      if (rec) { rec.diem = +o.diem; rec.t = Date.now(); rec.sent = 0; }
      else {
        var lan = all.filter(function (r) { return r.bai === bai && r.phan === phan && n(r.ten).toLowerCase() === ten.toLowerCase(); }).length + 1;
        all.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), key: o.key || '', t: Date.now(), bai: bai, phan: phan, ten: ten, lop: n(o.lop), diem: +o.diem, max: +o.max || 10, lan: lan, sent: 0 });
      }
      localStorage.setItem(k, JSON.stringify(all.slice(-800)));
    } catch (e) {}
  }
  window.STC_LOG = function (o) {
    o = o || {};
    if (!isFinite(+o.diem)) return;
    try { if (window.parent && window.parent !== window && window.parent.STC_LOG) return window.parent.STC_LOG(o); } catch (e) {}
    local(o);
  };
})();
