/* TẠM THỜI – chạy một lần: thay toàn bộ câu hỏi Khối 10 Bài 8–15 bằng bộ câu mới (giữ câu thuộc "Đề thi thử").
   Câu cũ được sao lưu sang trang "NganHang_cu_B8-15". */
function stcNhapB8_15() {
  const rows = JSON.parse(UrlFetchApp.fetch('https://raw.githubusercontent.com/nhungboss82-creator/TECHMARTH2026/__SHA__/tmp/k10_b8_15.json').getContentText());
  const BAIS = {}; rows.forEach(r => BAIS[r.BaiHoc] = 1);
  ensureCols_('NganHang', true);
  const ss = SpreadsheetApp.getActive(), sh = sheet_('NganHang');
  const lastCol = sh.getLastColumn(), n = sh.getLastRow() - 1;
  const head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const iK = head.indexOf('Khoi'), iB = head.indexOf('BaiHoc'), iN = head.indexOf('NguonDe'), iM = head.indexOf('MaCau');
  const data = sh.getRange(2, 1, n, lastCol).getValues();
  const del = [], keep = [];
  data.forEach(r => {
    const old = String(r[iK]).trim() === '10' && BAIS[String(r[iB]).trim()] && !/^Đề thi thử/.test(String(r[iN]));
    (old ? del : keep).push(r);
  });
  const newIds = {}; rows.forEach(r => newIds[r.MaCau] = 1);
  const keep2 = keep.filter(r => !newIds[String(r[iM]).trim()]);       // phòng chạy lại 2 lần
  let bk = ss.getSheetByName('NganHang_cu_B8-15');
  if (!bk) { bk = ss.insertSheet('NganHang_cu_B8-15'); bk.getRange(1, 1, 1, lastCol).setValues([head]); }
  if (del.length) bk.getRange(bk.getLastRow() + 1, 1, del.length, lastCol).setValues(del);
  const add = rows.map(o => head.map(h => o[h] === undefined || o[h] === null ? '' : o[h]));
  const all = keep2.concat(add);
  sh.getRange(2, 1, n, lastCol).clearContent();
  sh.getRange(2, 1, all.length, lastCol).setValues(all);
  bumpBank_();
  const delIds = {}; del.forEach(r => delIds[String(r[iM]).trim()] = 1);
  const bg = rows_('BaiGiao').filter(b => String(b.DanhSachCau || '').split(/[,;\s]+/).some(id => delIds[id]));
  console.log('Xoá ' + del.length + ' câu cũ (đã sao lưu sang NganHang_cu_B8-15); giữ ' + keep2.length + ' câu khác; thêm ' + add.length + ' câu mới. Tổng ' + all.length + '.');
  console.log('Bài giao có dùng câu cũ đã xoá: ' + bg.length + (bg.length ? ' – ' + bg.map(b => b.TieuDe + ' (' + b.TenGV + ')').join('; ') : ''));
}
