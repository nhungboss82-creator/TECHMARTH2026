/* =====================================================================
 * SmarttechCN 2026 – TỆP BỔ SUNG MÁY CHỦ (cập nhật 21/11/2026)
 * Cách cài: Apps Script → dấu + cạnh "Tệp" → Tập lệnh → đặt tên CapNhat_21_11
 *           → dán toàn bộ nội dung này → Lưu → Triển khai → Quản lý các bản triển khai
 *           → bút chì → Phiên bản mới → Triển khai.
 * Tệp này phải nằm DƯỚI tệp Mã.gs (Code.gs) trong danh sách tệp (tệp mới tạo tự nằm cuối).
 * Không cần sửa Mã.gs. Tệp chỉ bổ sung / thay thế một số chức năng:
 *   1. list_schools   : danh sách trường (trường của GV đã đăng ký + trường có lớp) cho mục "Chọn trường".
 *   2. Lớp HS tự khai : tạo đúng trường của HS (trước đây luôn gán vào trường của Admin → THPT Phong Điền
 *                       hiện cả lớp của trường khác). Cùng tên lớp nhưng khác trường là 2 lớp riêng.
 *   3. common_classes / my_classes / school_classes: kèm cờ TuTao (lớp HS tự khai), lọc theo trường chuẩn.
 *   4. update_class   : GV/Admin chuyển lớp sang đúng trường; kiểm tra trùng tên lớp trong CÙNG trường.
 *   5. practice_log / practice_logs: lưu lượt làm bài thực hành (tên, số lần, điểm/số lỗi từng lần) để GV xem;
 *                       gồm cả mọi lượt HS tự nhờ AI chấm bài vẽ (số lần nộp, số lần sửa).
 *  15. practice_my: HS xem nhật ký lượt luyện (bài vẽ AI chấm…) của mình; GV chấm hộ HS được ghi đúng trường.
 *  14. drawPrompt_ : AI chấm theo từng tiêu chí (bang_diem), nhận bài vẽ tay hoặc vẽ máy.
 *  13. gv_regrade_drawing: AI chấm lại một bài đã nộp.
 *  12. gv_submit_drawing: GV chụp/gửi bài vẽ của HS (vẽ tay hoặc vẽ máy) để AI chấm, lưu như một lần nộp.
 *  11. ontn_candidates / set_ontn_gv: GV thêm, bớt HS lớp 12 trường mình vào danh sách ôn thi TN.
 *  10. set_ontn/get_ontn: HS tích "Đăng kí ôn thi TN" (cột OnTN trong HocSinh) → GV thấy em trong Quản lý ôn thi TN.
 *   9. tn_results     : Quản lý đề luyện thi TN theo trường (GV: trường mình; Admin: chọn trường) + lượt luyện thi theo bài.
 *   8. update_student : GV sửa HS – đổi trường, chọn lớp của trường đó hoặc gõ tên lớp mới (tạo đúng trường).
 *   7. fix_schools    : chuyển HS bị xếp nhầm trường (HS khai trường khác) về lớp cùng tên ở đúng trường.
 *   6. list_gv / approve_gv: GV đang hoạt động duyệt, từ chối, khoá giáo viên MỚI CÙNG TRƯỜNG (Admin vẫn duyệt tất cả).
 * ===================================================================== */

var CN2111_VER = '2026-11-21';
var CUR_SCHOOL_ = '';

/** lớp do học sinh tự khai (máy chủ tạo hộ, mật khẩu ngẫu nhiên 8 kí tự hex, chủ lớp là Admin) */
function cn2111AdminIds_() {
  if (!cn2111AdminIds_.c) cn2111AdminIds_.c = rows_('GiaoVien').filter(r => r.VaiTro === 'admin').map(r => r.MaGV);
  return cn2111AdminIds_.c;
}
function cn2111IsSelf_(c) {
  if (String(c.TuTao || '') === '1') return true;
  return /^[0-9a-f]{8}$/.test(String(c.MatKhauLop || '')) && (!c.MaGV || cn2111AdminIds_().indexOf(c.MaGV) >= 0);
}

/* ---------- thay thế: lớp HS tự khai đúng trường của HS ---------- */
function selfClass_(name, khoi, school) {
  const ten = lopName_(clean_(name, 30));
  const k = String(khoi || '');
  if (['10', '11', '12'].indexOf(k) < 0) throw new Error('Hãy chọn khối 10, 11 hoặc 12');
  if (!/^[0-9A-ZÀ-Ỹ.\-\/]{2,15}$/i.test(ten)) throw new Error('Tên lớp chưa hợp lệ (vd: 10A1 hoặc 10/1)');
  const admin = rows_('GiaoVien').find(r => r.VaiTro === 'admin') || {};
  const truong = clean_(school || CUR_SCHOOL_ || admin.Truong || '', 80);
  const sk = schoolKey_(truong);
  const all = rows_('Lop');
  // cùng TRƯỜNG + cùng khối + cùng tên lớp (10/1 = 10/01 = 10-1) thì vào chung một lớp; ưu tiên lớp do GV tạo
  const same = all.filter(r => String(r.Khoi) === k && lopName_(r.TenLop) === ten && schoolKey_(r.Truong) === sk)
    .sort((a, b) => (cn2111IsSelf_(a) ? 1 : 0) - (cn2111IsSelf_(b) ? 1 : 0) || a._r - b._r)[0];
  if (same) return same;
  const existing = all.map(r => r.MaLop);
  let code; do { code = classCode_(); } while (existing.indexOf(code) >= 0);
  const c = { MaLop: code, TenLop: ten, Khoi: k, Truong: truong, MaGV: admin.MaGV || '',
    MatKhauLop: Utilities.getUuid().slice(0, 8), NgayTao: new Date() };
  append_('Lop', c);
  return c;
}

/* ---------- thay thế: thông tin lớp gửi về giao diện có thêm cờ TuTao ---------- */
function publicClass_(c) {
  const o = { MaLop: c.MaLop, TenLop: c.TenLop, Khoi: String(c.Khoi), Truong: c.Truong, MatKhauLop: c.MatKhauLop, MaGV: c.MaGV, TuTao: cn2111IsSelf_(c) };
  if (typeof rosterOf_ === 'function') { try { o.DanhSach = rosterOf_(c); } catch (e) {} }
  return o;
}

/* ---------- các chức năng API bổ sung / thay thế ---------- */
function cn2111Patch_() {
  if (typeof API === 'undefined') return;

  API.cn2111 = () => ({ ver: CN2111_VER });

  /* 1. danh sách trường cho mục chọn trường (không cần đăng nhập) */
  API.list_schools = () => {
    const m = {};
    const add = s => { s = clean_(s, 80); const k = schoolKey_(s); if (k && !m[k]) m[k] = s; };
    rows_('GiaoVien').filter(g => ['khoa', 'tu_choi'].indexOf(String(g.TrangThai)) < 0).forEach(g => add(g.Truong));
    rows_('Lop').filter(c => !cn2111IsSelf_(c)).forEach(c => add(c.Truong));
    return Object.keys(m).map(k => m[k]).sort((a, b) => a.localeCompare(b, 'vi'));
  };

  /* 3. lớp cho HS đăng ký bằng mã chung: kèm cờ TuTao để giao diện chỉ hiện lớp chính thức của trường đã chọn */
  API.common_classes = req => {
    checkCommon_(req.common);
    return rows_('Lop').filter(c => String(c.MaLop || '').trim())
      .map(c => ({ MaLop: c.MaLop, TenLop: c.TenLop, Khoi: String(c.Khoi), Truong: c.Truong, TuTao: cn2111IsSelf_(c) }))
      .sort((a, b) => a.Khoi.localeCompare(b.Khoi) || String(a.TenLop).localeCompare(String(b.TenLop), 'vi', { numeric: true }));
  };
  API.school_classes = req => {
    const t = auth_(req, 'gv');
    const sk = schoolKey_(t.r === 'admin' && req.truong ? req.truong : teacher_(t).Truong);
    return rows_('Lop').filter(c => String(c.MaLop || '').trim() && sk && schoolKey_(c.Truong) === sk).map(publicClass_);
  };

  /* 2. HS đăng ký / vào lớp tự khai: lớp mới thuộc đúng trường của HS */
  const reg = API.register_hs;
  if (reg) API.register_hs = req => { CUR_SCHOOL_ = clean_(req.school, 80); try { return reg(req); } finally { CUR_SCHOOL_ = ''; } };
  const join = API.join_class;
  if (join) API.join_class = req => {
    try { const t = auth_(req, 'hs'); const hs = rows_('HocSinh').find(r => r.MaHS === t.u); CUR_SCHOOL_ = hs ? String(hs.Truong || '') : ''; } catch (e) {}
    try { return join(req); } finally { CUR_SCHOOL_ = ''; }
  };

  /* 4. sửa lớp: đổi tên / khối / mật khẩu / TRƯỜNG; trùng tên chỉ xét trong cùng trường */
  API.update_class = req => withLock_(() => {
    const t = auth_(req, 'gv');
    const c = ownClass_(t, req.code);
    const ten = lopName_(clean_(req.name == null ? c.TenLop : req.name, 30)), khoi = String(req.khoi || c.Khoi);
    if (!ten) throw new Error('Hãy nhập tên lớp');
    if (['10', '11', '12'].indexOf(khoi) < 0) throw new Error('Khối phải là 10, 11 hoặc 12');
    const truong = req.school != null && String(req.school).trim() ? clean_(req.school, 80) : String(c.Truong || '');
    const pw = String(req.classPw == null ? c.MatKhauLop : req.classPw).trim();
    if (pw.length < 4) throw new Error('Mật khẩu chung của lớp tối thiểu 4 ký tự');
    const sk = schoolKey_(truong);
    const dup = rows_('Lop').find(r => r.MaLop !== c.MaLop && String(r.Khoi) === khoi && lopName_(r.TenLop) === ten && schoolKey_(r.Truong) === sk);
    if (dup) {
      if (!req.merge) throw new Error('TRUNG_LOP|' + dup.MaLop + '|' + (truong || 'Trường') + ' – khối ' + khoi + ' đã có lớp ' + ten + ' (mã ' + dup.MaLop + ').');
      ownClass_(t, dup.MaLop);
      moveClass_(c, dup);
      sheet_('Lop').deleteRow(c._r);
      return { merged: dup.MaLop };
    }
    const patch = { TenLop: ten, Khoi: khoi, MatKhauLop: pw, Truong: truong };
    // lớp HS tự khai được GV/Admin xác nhận (đổi trường hoặc bấm "Giữ lớp này") → thành lớp chính thức
    if (req.confirm || truong !== String(c.Truong || '')) { patch.MaGV = t.r === 'admin' && !req.toMe ? c.MaGV : teacher_(t).MaGV; if (cn2111IsSelf_(c) && pw === String(c.MatKhauLop)) patch.MatKhauLop = pw + '#'; }
    update_('Lop', c._r, patch);
    patchWhere_('HocSinh', 'MaLop', [c.MaLop], { TenLop: ten, Khoi: khoi, Truong: truong });
    patchWhere_('KetQua', 'MaLop', [c.MaLop], { TenLop: ten, Khoi: khoi });
    try { patchWhere_('NopVe', 'MaLop', [c.MaLop], { TenLop: ten, Khoi: khoi }); } catch (e) {}
    return publicClass_(Object.assign(c, patch));
  });

  /* 10. HS tích / bỏ tích "Đăng kí ôn thi tốt nghiệp" (ONTN) → hiện trong Quản lý ôn thi TN của GV */
  API.set_ontn = req => withLock_(() => {
    const t = auth_(req, 'hs');
    const sh = sheet_('HocSinh');
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    if (head.indexOf('OnTN') < 0) sh.getRange(1, head.length + 1).setValue('OnTN');
    const h = rows_('HocSinh').find(r => r.MaHS === t.u);
    if (!h) throw new Error('Tài khoản không còn tồn tại');
    update_('HocSinh', h._r, { OnTN: req.on ? '1' : '' });
    return { on: !!req.on };
  });
  API.get_ontn = req => { const t = auth_(req, 'hs'); const h = rows_('HocSinh').find(r => r.MaHS === t.u); return { on: !!h && String(h.OnTN || '') === '1' }; };

  /* 12. GV chấm hộ bài vẽ: GV chụp / gửi ảnh bài làm của một HS (vẽ tay hoặc vẽ máy) → AI chấm, lưu như một lần nộp */
  API.gv_submit_drawing = req => {
    const t = auth_(req, 'gv');
    const b = rows_('BaiVe').find(r => r.MaBV === req.maBV && r.TrangThai !== 'xoa');
    if (!b) throw new Error('Bài vẽ không tồn tại');
    if (!req.image) throw new Error('Chưa có ảnh bài làm');
    let hs = null;
    if (req.maHS) { hs = rows_('HocSinh').find(r => r.MaHS === req.maHS); if (!hs) throw new Error('Không tìm thấy học sinh'); ownClass_(t, hs.MaLop); }
    const lop = hs ? null : (req.maLop ? ownClass_(t, req.maLop) : null);
    const ten = hs ? hs.HoTen : clean_(req.ten, 60);
    if (!ten) throw new Error('Chọn học sinh hoặc nhập họ tên');
    const prev = rows_('NopVe').filter(r => r.MaBV === b.MaBV && (hs ? r.MaHS === hs.MaHS : r.HoTen === ten));
    const img = saveImage_(req.image, b.MaBV + '_' + (hs ? hs.TenDN : 'gv_' + shortId_()) + '_' + (prev.length + 1) + '.jpg');
    let ai = null, aiErr = '';
    try {
      const parts = [{ text: drawPrompt_(b, !!b.AnhMau, !!b.AnhDe) }];
      if (b.AnhDe) parts.push({ text: 'ẢNH ĐỀ BÀI (vật thể hoặc yêu cầu của giáo viên):' }, imagePart_(b.AnhDe));
      parts.push({ text: 'ẢNH BÀI LÀM CỦA HỌC SINH (vẽ tay hoặc vẽ máy; toạ độ vi_tri tính trên ảnh này):' }, { inline_data: { mime_type: img.mime, data: img.b64 } });
      if (b.AnhMau) parts.push({ text: 'ẢNH ĐÁP ÁN MẪU của giáo viên (chỉ để so sánh, KHÔNG phải bài làm):' }, imagePart_(b.AnhMau));
      ai = geminiCall_(parts);
      ai.diem = clampScore_(ai.diem, b.DiemToiDa);
    } catch (e) { aiErr = e.message; }
    const row = { ThoiDiem: new Date(), MaNop: 'N' + shortId_(), MaBV: b.MaBV, MaHS: hs ? hs.MaHS : '', HoTen: ten,
      MaLop: hs ? hs.MaLop : (lop ? lop.MaLop : ''), TenLop: hs ? hs.TenLop : (lop ? lopName_(lop.TenLop) : ''), Khoi: String(hs ? hs.Khoi : b.Khoi), Truong: hs ? hs.Truong : (lop ? lop.Truong : ''), AnhId: img.id,
      AIDiem: ai && ai.doc_duoc !== false ? ai.diem : '', AINhanXet: ai ? clean_(ai.nhan_xet_chung, 1500) : 'Chưa có nhận xét AI: ' + aiErr,
      AIChiTiet: ai ? JSON.stringify(ai).slice(0, 40000) : '', GVDiem: '', GVNhanXet: '', TrangThai: ai ? 'ai_da_cham' : 'cho_gv' };
    withLock_(() => append_('NopVe', row));
    return publicSubmission_(row);
  };

  /* 14. (22/11/2026) Lời nhắc chấm bài vẽ: bài vẽ tay HOẶC vẽ máy; AI trả thêm "bang_diem" – điểm từng tiêu chí */
  var DRAW_CHECK_ = {
    chung: '(1) đúng loại bản vẽ đề yêu cầu; (2) đủ mọi cạnh, mọi đường bao của vật thể – không thiếu, không thừa; (3) đúng loại nét; (4) đúng yêu cầu riêng của đề.',
    hinhchieu: '(1) đủ 3 hình chiếu, đúng vị trí: bằng ở DƯỚI đứng, cạnh ở BÊN PHẢI đứng; (2) các hình chiếu dóng thẳng, cùng chiều dài/cao/rộng; (3) từng hình chiếu đủ đường bao và cạnh thấy, không thiếu/thừa; (4) mọi lỗ, rãnh, phần khuất đều có nét đứt ở các hình chiếu thấy nó bị che; (5) đường tâm, trục đối xứng bằng nét gạch chấm (đường tròn có 2 đường tâm vuông góc); (6) đúng loại nét (liền đậm/đứt/gạch chấm).',
    trucdo: '(1) đúng loại trục đo đề yêu cầu (vuông góc đều: các trục lệch 120°; xiên góc cân: x ⊥ z, y lệch 135°, cạnh theo y vẽ bằng 0,5); (2) ĐẾM SỐ CẠNH THẤY TRÊN ẢNH: liệt kê từng đỉnh thấy của vật thể và với mỗi đỉnh, đếm các đoạn thẳng THỰC SỰ ĐƯỢC VẼ xuất phát từ đỉnh đó (không tự hình dung thêm cạnh mà ảnh không có). Với khối hộp nhìn từ trên: đỉnh gần người xem nhất (đỉnh thấp nhất ở giữa hình) phải có 3 cạnh – 2 cạnh đáy và 1 cạnh đứng đi lên tới mặt trên; toàn hình phải có đủ 9 cạnh thấy (4 cạnh mặt trên, 3 cạnh đứng, 2 cạnh đáy). Thiếu cạnh nào là lỗi nghiêm trọng; (3) các cạnh song song ngoài thực tế phải song song trên hình; (4) không vẽ nét khuất; (5) đường tròn trên các mặt vẽ thành elip đúng hướng.',
    hinhcat: '(1) có vết mặt phẳng cắt, mũi tên hướng chiếu, chữ tên và tên hình cắt (A–A) nếu đề yêu cầu; (2) đúng loại hình cắt/mặt cắt theo đề; (3) KIỂM TRA ĐƯỜNG GẠCH GẠCH TỪNG VÙNG: chia hình cắt thành các vùng giữa các nét liền; đối chiếu với hình chiếu còn lại để biết vùng nào là vật liệu đặc, vùng nào là LỖ RỖNG (ví dụ lỗ tròn trên hình chiếu bằng ứng với dải giữa hai nét liền trên hình cắt). Vùng đặc phải có gạch; vùng lỗ rỗng phải để TRẮNG. Ghi rõ vùng nào đang có gạch. Có gạch trong vùng lỗ rỗng là lỗi nghiêm trọng; gạch là nét liền mảnh nghiêng 45°, cách đều, cùng hướng trên cùng một chi tiết; (4) phần sau mặt phẳng cắt vẽ đủ, cạnh lỗ bị cắt vẽ nét liền đậm (không còn nét đứt); (5) đường tâm lỗ bằng nét gạch chấm.',
    phoicanh: '(1) có đường chân trời và điểm tụ trên đường chân trời, đúng số điểm tụ đề yêu cầu; (2) KÉO DÀI TỪNG CẠNH LÙI xem có đi qua đúng điểm tụ không – các cạnh lùi song song với nhau (không hội tụ) là lỗi nghiêm trọng; (3) cạnh thẳng đứng vẽ thẳng đứng; với 1 điểm tụ, mặt trước là hình thật (cạnh ngang nằm ngang); (4) đủ các cạnh thấy, không vẽ cạnh khuất; (5) nét thấy tô đậm; nét dựng hình (đường kéo về điểm tụ) vẽ mảnh hoặc đã xoá – giữ lại nét dựng hình mảnh là CHẤP NHẬN, không coi là lỗi.'
  };
  drawPrompt_ = function (t, hasRef, hasDe) {
    const ten = (typeof DRAW_TYPES !== 'undefined' && DRAW_TYPES[t.Loai]) || (typeof DRAW_TYPES_CU !== 'undefined' && DRAW_TYPES_CU[t.Loai]) || t.Loai;
    const hint = (typeof DRAW_HINT !== 'undefined' && DRAW_HINT[t.Loai]) || '';
    return [
      'Em là giáo viên Công nghệ THPT ở Việt Nam, đang chấm bài vẽ kĩ thuật của học sinh lớp ' + t.Khoi + '. Bài làm có thể là ảnh chụp bản vẽ tay hoặc ảnh bản vẽ bằng máy tính (vẽ máy).',
      'Loại bài: ' + ten + '.', hint,
      /* HS tự luyện (không có mã bài GV giao): đề tự chọn → chỉ bắt lỗi những gì đề yêu cầu */
      !t.MaBV ? 'ĐÂY LÀ BÀI HỌC SINH TỰ LUYỆN VỚI ĐỀ TỰ CHỌN. Chỉ áp dụng những tiêu chí phù hợp với đề; tiêu chí nào đề không yêu cầu (ví dụ đề không yêu cầu ghi kích thước, khung tên, kí hiệu mặt cắt…) thì cho đủ điểm tiêu chí đó và KHÔNG coi là lỗi. "loi" chỉ gồm những chỗ vẽ SAI THẬT so với đề và quy ước bản vẽ kĩ thuật; không đưa gợi ý trình bày cho đẹp vào "loi" (đưa vào "y_tuong"). Bài vẽ đúng yêu cầu của đề thì "loi" = [] và "dat_yeu_cau" = true. Nếu bài làm rõ ràng là một loại bản vẽ khác với loại bài đã chọn (ví dụ chọn hình chiếu trục đo nhưng bài vẽ 3 hình chiếu vuông góc) thì đặt "doc_duoc": false và ghi trong "nhan_xet_chung": em đã chọn nhầm loại bài, bài của em là …' : '',
      'Đề bài (yêu cầu của giáo viên): ' + t.DeBai,
      'Bảng chấm điểm của giáo viên (thang ' + t.DiemToiDa + ' điểm; mỗi dòng: tiêu chí – số điểm tối đa):\n' + t.TieuChi,
      hasDe ? 'Có kèm ẢNH ĐỀ BÀI (vật thể hoặc yêu cầu) của giáo viên; đối chiếu bài làm với vật thể và yêu cầu trong ảnh đề.' : '',
      hasRef ? 'Có kèm ẢNH ĐÁP ÁN MẪU của giáo viên; so sánh bài học sinh với đáp án mẫu (đáp án mẫu KHÔNG phải bài làm).' : '',
      'Yêu cầu khi chấm:',
      '- Chấm theo TỪNG tiêu chí trong bảng chấm điểm; ghi vào "bang_diem" đúng thứ tự và đủ số tiêu chí: tieu_chi (chép ngắn gọn), toi_da, dat (điểm đạt, bội của 0,25), nhan_xet (1 câu đánh giá cụ thể em đã làm được gì / sai ở đâu), huong_dan (tiêu chí chưa đạt đủ điểm: hướng dẫn cụ thể em cần sửa thế nào; đạt đủ thì để ""). "diem" = tổng các "dat".',
      '- Đối chiếu quy ước bản vẽ kĩ thuật theo TCVN (nét liền đậm, nét đứt cạnh khuất, nét gạch chấm mảnh đường tâm/trục; vị trí các hình chiếu; hình cắt, mặt cắt, đường gạch gạch; ghi kích thước). Chỉ nêu số hiệu TCVN khi chắc chắn.',
      '- Mỗi lỗi sai: mô tả cụ thể vị trí trên bản vẽ, tiêu chí bị trừ, số điểm trừ, và "cach_sua": yêu cầu em sửa lại như thế nào. Xưng "em" với học sinh, giọng khích lệ.',
      '- Với MỖI lỗi, khoanh vị trí lỗi trên ẢNH BÀI LÀM bằng "vi_tri": [ymin, xmin, ymax, xmax] theo thang 0–1000 (gốc góc trên bên trái ảnh bài làm); không xác định được thì để [].',
      '- Nếu ảnh mờ, nghiêng, thiếu sáng hoặc không phải bài vẽ theo đề thì đặt "doc_duoc": false, diem = 0 và hướng dẫn chụp lại.',
      '- Không khẳng định chắc chắn khi không nhìn rõ; ghi "có thể" khi chưa chắc.',
      '- "dat_yeu_cau": true nếu đạt từ 50% thang điểm và không có lỗi nghiêm trọng.',
      'BẮT BUỘC TỰ KIỂM TRA TRƯỚC KHI KẾT LUẬN – điền vào "kiem_tra" từng mục dưới đây (nhìn kĩ bản vẽ, không đoán): ' + (DRAW_CHECK_[t.Loai] || DRAW_CHECK_.chung),
      '"ghi_chu" của mỗi mục phải nêu BẰNG CHỨNG cụ thể nhìn thấy trên ảnh (ví dụ: liệt kê các cạnh đếm được, vùng nào có gạch, vùng nào để trắng, cạnh nào kéo dài có/không qua điểm tụ) – không được ghi chung chung "đúng". Mỗi mục "kiem_tra" có ket_qua "sai" thì PHẢI có một lỗi tương ứng trong "loi". Không được chấm đạt nếu còn mục sai.',
      'Trả lời DUY NHẤT một đối tượng JSON, không thêm chữ nào khác, theo mẫu (ghi "kiem_tra" TRƯỚC):',
      '{"kiem_tra": [{"muc": "…", "ket_qua": "đúng|sai|không áp dụng", "ghi_chu": "…"}], "doc_duoc": true, "dat_yeu_cau": false, "diem": 7.5, "bang_diem": [{"tieu_chi": "…", "toi_da": 3, "dat": 2.5, "nhan_xet": "…", "huong_dan": "…"}], "nhan_xet_chung": "…", "diem_dung": ["…"], "loi": [{"mo_ta": "…", "tieu_chi": "…", "tru_diem": 0.5, "vi_tri": [120, 340, 260, 520], "cach_sua": "…"}], "goi_y_sua": ["…"], "y_tuong": ["…"]}'
    ].filter(String).join('\n');
  };

  /* 13. GV bấm "AI chấm lại" cho một bài đã nộp (khi lần trước AI lỗi / chưa trả kết quả) */
  API.gv_regrade_drawing = req => {
    const t = auth_(req, 'gv');
    const s = rows_('NopVe').find(r => r.MaNop === req.maNop);
    if (!s) throw new Error('Không tìm thấy bài nộp');
    if (s.MaLop) ownClass_(t, s.MaLop);
    const b = rows_('BaiVe').find(r => r.MaBV === s.MaBV);
    if (!b) throw new Error('Bài vẽ không tồn tại');
    const parts = [{ text: drawPrompt_(b, !!b.AnhMau, !!b.AnhDe) }];
    if (b.AnhDe) parts.push({ text: 'ẢNH ĐỀ BÀI (vật thể hoặc yêu cầu của giáo viên):' }, imagePart_(b.AnhDe));
    parts.push({ text: 'ẢNH BÀI LÀM CỦA HỌC SINH (vẽ tay hoặc vẽ máy; toạ độ vi_tri tính trên ảnh này):' }, imagePart_(s.AnhId));
    if (b.AnhMau) parts.push({ text: 'ẢNH ĐÁP ÁN MẪU của giáo viên (chỉ để so sánh, KHÔNG phải bài làm):' }, imagePart_(b.AnhMau));
    const ai = geminiCall_(parts);
    ai.diem = clampScore_(ai.diem, b.DiemToiDa);
    const patch = { AIDiem: ai.doc_duoc !== false ? ai.diem : '', AINhanXet: clean_(ai.nhan_xet_chung, 1500), AIChiTiet: JSON.stringify(ai).slice(0, 40000) };
    if (s.TrangThai !== 'da_cham') patch.TrangThai = 'ai_da_cham';
    withLock_(() => update_('NopVe', s._r, patch));
    return publicSubmission_(Object.assign({}, s, patch));
  };

  /* 11. GV thêm / bớt học sinh vào danh sách ôn thi TN (đặt cờ OnTN) – HS lớp 12 thuộc trường của GV */
  API.ontn_candidates = req => {
    const t = auth_(req, 'gv'), g = teacher_(t);
    const sk = t.r === 'admin' && req.school != null ? schoolKey_(req.school) : schoolKey_(g.Truong);
    const lop = {}; rows_('Lop').forEach(c => { if (String(c.Khoi) === '12' && (!sk || schoolKey_(c.Truong) === sk)) lop[c.MaLop] = lopName_(c.TenLop); });
    return rows_('HocSinh').filter(h => lop[h.MaLop]).map(h => ({ maHS: h.MaHS, hoTen: h.HoTen, lop: lop[h.MaLop], ontn: String(h.OnTN || '') === '1' }));
  };
  API.set_ontn_gv = req => withLock_(() => {
    const t = auth_(req, 'gv');
    const ids = (Array.isArray(req.ids) ? req.ids : [req.maHS]).filter(Boolean).slice(0, 300);
    const sh = sheet_('HocSinh');
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    if (head.indexOf('OnTN') < 0) sh.getRange(1, head.length + 1).setValue('OnTN');
    const hs = rows_('HocSinh'); let n = 0;
    ids.forEach(id => { const h = hs.find(r => r.MaHS === id); if (!h) return; ownClass_(t, h.MaLop); update_('HocSinh', h._r, { OnTN: req.on === false ? '0' : '1' }); n++; });
    return { done: n };
  });

  /* 9. Quản lý đề luyện thi TN: theo TRƯỜNG (GV: trường mình; Admin: chọn trường), kèm lượt "Luyện thi TN theo bài" (LT:) */
  API.tn_results = req => {
    const t = auth_(req, 'gv');
    const g = teacher_(t);
    const allLop = rows_('Lop');
    const schools = {}; allLop.forEach(c => { const k = schoolKey_(c.Truong); if (k && !schools[k]) schools[k] = String(c.Truong).trim(); });
    const sk = t.r === 'admin' && req.school != null ? schoolKey_(req.school) : schoolKey_(g.Truong);
    const codes = {};
    allLop.forEach(c => { if (!sk || schoolKey_(c.Truong) === sk) codes[c.MaLop] = lopName_(c.TenLop); });
    if (req.code && codes[req.code]) { const one = {}; one[req.code] = codes[req.code]; Object.keys(codes).forEach(k => delete codes[k]); Object.assign(codes, one); }
    const out = { classes: codes, rows: [], lt: [], schools: Object.keys(schools).map(k => schools[k]).sort(), school: sk ? (schools[sk] || '') : '' };
    // HS đã tích "Đăng kí ôn thi TN" (cột OnTN) thuộc các lớp trên
    const hsAll = rows_('HocSinh').filter(h => codes[h.MaLop]);
    out.ontn = hsAll.filter(h => String(h.OnTN || '') === '1').map(h => ({ maHS: h.MaHS, hoTen: h.HoTen, lop: codes[h.MaLop] || lopName_(h.TenLop) }));
    out.ontnOut = hsAll.filter(h => String(h.OnTN || '') === '0').map(h => h.MaHS); // GV đã xoá khỏi danh sách ôn thi
    const key = req.key ? String(req.key) : '';
    const sh = sheet_('KetQua'), n = sh.getLastRow() - 1;
    if (n < 1) return out;
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    const col = name => head.indexOf(name);
    const iKey = col('MaBai'), iLop = col('MaLop');
    const keys = sh.getRange(2, iKey + 1, n, 1).getValues(), lops = sh.getRange(2, iLop + 1, n, 1).getValues();
    const hit = [], hitLt = [];
    for (let i = 0; i < n; i++) {
      const k = String(keys[i][0]);
      if (!codes[String(lops[i][0])]) continue;
      if (k.indexOf('DE:') === 0) { if (!key || k === key) hit.push(i); }
      else if (!key && k.indexOf('LT:') === 0) hitLt.push(i);
    }
    const all = hit.concat(hitLt).sort((a, b) => a - b);
    if (!all.length) return out;
    const lo = all[0], hi = all[all.length - 1];
    const ncol = key ? head.length : Math.min(head.length, col('ChiTiet') < 0 ? head.length : col('ChiTiet'));
    const vals = sh.getRange(lo + 2, 1, hi - lo + 1, ncol).getValues();
    const one = (i, full) => {
      const r = vals[i - lo], v = name => r[col(name)];
      const o = { maHS: v('MaHS'), hoTen: v('HoTen'), lop: codes[String(v('MaLop'))] || lopName_(v('TenLop')), key: String(v('MaBai')),
        diem: Number(v('Diem')), dung: Number(v('SoDung')), tong: Number(v('TongCau')), giay: Number(v('ThoiGianLam')) || 0,
        lan: Number(v('LanThu')) || 1, t: v('ThoiDiem') instanceof Date ? v('ThoiDiem').toISOString() : String(v('ThoiDiem')) };
      if (full) o.sai = String(v('CauSai') || '').split(',').filter(String);
      if (full && key) { try { const ct = JSON.parse(v('ChiTiet') || '{}'); delete ct._tl; o.ct = ct; } catch (e) { o.ct = {}; } }
      return o;
    };
    out.rows = hit.map(i => one(i, true));
    out.lt = hitLt.map(i => one(i, false));
    return out;
  };

  /* 8. GV sửa học sinh: đổi họ tên, tên đăng nhập, TRƯỜNG và LỚP cho phù hợp
        – chọn lớp có sẵn của trường đó (req.toCode) hoặc gõ tên lớp mới (req.newClass, tạo trong đúng trường)
        – đổi trường mà vẫn giữ lớp cũ → chuyển sang lớp cùng tên ở trường mới. Kết quả làm bài chuyển theo. */
  const updHs0 = API.update_student;
  API.update_student = req => {
    const t = auth_(req, 'gv');
    const h = rows_('HocSinh').find(r => r.MaHS === req.maHS);
    if (!h) throw new Error('Không tìm thấy học sinh');
    const cur = ownClass_(t, h.MaLop);
    const school = req.school ? clean_(req.school, 80) : ''; // chỉ đổi trường khi GV chọn trường
    const schoolNew = school || String(h.Truong || cur.Truong || '');
    let target = null;
    if (req.newClass && String(req.newClass).trim()) target = withLock_(() => selfClass_(req.newClass, req.khoi || h.Khoi, schoolNew));
    else if (req.toCode && req.toCode !== h.MaLop) target = findClass_(req.toCode);
    else if (school && schoolKey_(school) !== schoolKey_(cur.Truong)) target = withLock_(() => selfClass_(cur.TenLop, cur.Khoi, school));
    // họ tên, tên đăng nhập: dùng chức năng gốc (giữ nguyên lớp)
    const r = updHs0 ? updHs0(Object.assign({}, req, { toCode: h.MaLop, school: undefined, newClass: undefined })) : { done: true };
    if (target && target.MaLop !== h.MaLop) withLock_(() => {
      const ten = lopName_(target.TenLop), k = String(target.Khoi);
      patchWhere_('HocSinh', 'MaHS', [h.MaHS], { MaLop: target.MaLop, TenLop: ten, Khoi: k, Truong: target.Truong });
      patchWhere_('KetQua', 'MaHS', [h.MaHS], { MaLop: target.MaLop, TenLop: ten, Khoi: k });
      try { patchWhere_('NopVe', 'MaHS', [h.MaHS], { MaLop: target.MaLop, TenLop: ten, Khoi: k }); } catch (e) {}
    });
    return Object.assign({}, r, { moved: !!(target && target.MaLop !== h.MaLop), toLop: target ? lopName_(target.TenLop) : '', toTruong: target ? target.Truong : '', cn2111: 1 });
  };

  /* 7. Rà soát: HS nằm trong lớp bị gán nhầm trường (HS khai trường khác trường của lớp) → chuyển về lớp cùng tên ở đúng trường.
        req.dry = 1: chỉ xem trước. Admin: mọi lớp; GV: lớp thuộc trường mình. */
  API.fix_schools = req => {
    const t = auth_(req, 'gv');
    const mySk = t.r === 'admin' ? '' : schoolKey_(teacher_(t).Truong);
    const lop = rows_('Lop').filter(c => !mySk || schoolKey_(c.Truong) === mySk), hs = rows_('HocSinh');
    const plan = [];
    lop.forEach(c => {
      const ck = schoolKey_(c.Truong), g = {};
      hs.filter(h => h.MaLop === c.MaLop && String(h.Truong || '').trim() && schoolKey_(h.Truong) !== ck)
        .forEach(h => { const k = schoolKey_(h.Truong); (g[k] = g[k] || { to: clean_(h.Truong, 80), ids: [] }).ids.push(h.MaHS); });
      Object.keys(g).forEach(k => plan.push({ MaLop: c.MaLop, TenLop: lopName_(c.TenLop), Khoi: String(c.Khoi), from: c.Truong, to: g[k].to, n: g[k].ids.length, ids: g[k].ids }));
    });
    if (req.dry) return plan.map(x => ({ MaLop: x.MaLop, TenLop: x.TenLop, Khoi: x.Khoi, from: x.from, to: x.to, n: x.n }));
    return withLock_(() => {
      let moved = 0;
      plan.forEach(x => {
        const to = selfClass_(x.TenLop, x.Khoi, x.to), ten = lopName_(to.TenLop);
        patchWhere_('HocSinh', 'MaHS', x.ids, { MaLop: to.MaLop, TenLop: ten, Khoi: String(to.Khoi), Truong: to.Truong });
        patchWhere_('KetQua', 'MaHS', x.ids, { MaLop: to.MaLop, TenLop: ten, Khoi: String(to.Khoi) });
        try { patchWhere_('NopVe', 'MaHS', x.ids, { MaLop: to.MaLop, TenLop: ten, Khoi: String(to.Khoi) }); } catch (e) {}
        moved += x.n;
      });
      return { moved: moved, groups: plan.length };
    });
  };

  /* 6. GV cùng trường tự duyệt / từ chối / khoá – mở khoá tài khoản GV mới của trường mình (Admin vẫn quản lý tất cả) */
  const listGv0 = API.list_gv, approve0 = API.approve_gv;
  const pubGv = g => ({ MaGV: g.MaGV, Email: g.Email, HoTen: g.HoTen, Truong: g.Truong, VaiTro: g.VaiTro, TrangThai: g.TrangThai });
  API.list_gv = req => {
    const t = auth_(req, 'gv');
    if (t.r === 'admin') return listGv0 ? listGv0(req) : rows_('GiaoVien').map(pubGv);
    const me = teacher_(t), sk = schoolKey_(me.Truong);
    return rows_('GiaoVien').filter(g => sk && schoolKey_(g.Truong) === sk && g.VaiTro !== 'admin').map(pubGv);
  };
  API.approve_gv = req => {
    const t = auth_(req, 'gv');
    if (t.r === 'admin') return approve0(req);
    return withLock_(() => {
      const me = teacher_(t), sk = schoolKey_(me.Truong);
      const g = rows_('GiaoVien').find(r => r.MaGV === req.maGV);
      if (!g) throw new Error('Không tìm thấy GV');
      if (g.VaiTro === 'admin' || !sk || schoolKey_(g.Truong) !== sk) throw new Error('Thầy/cô chỉ duyệt được giáo viên cùng trường');
      if (g.MaGV === me.MaGV) throw new Error('Không tự đổi trạng thái tài khoản của mình');
      const st = ['hoat_dong', 'khoa', 'tu_choi'].indexOf(req.status) >= 0 ? req.status : (req.approve === false ? 'khoa' : 'hoat_dong');
      update_('GiaoVien', g._r, { TrangThai: st, DuyetBoi: me.Email });
      return { done: true };
    });
  };

  /* 5. lượt làm bài thực hành (bài học có ô Họ và tên) */
  API.practice_log = req => {
    let hs = null, gvTruong = '';
    try { const t = auth_(req, 'hs'); hs = rows_('HocSinh').find(r => r.MaHS === t.u) || null; } catch (e) {}
    if (!hs) { try { gvTruong = String(teacher_(auth_(req, 'gv')).Truong || ''); } catch (e) {} }
    const list = (Array.isArray(req.items) ? req.items : [req]).slice(0, 50);
    const sh = cn2111Sheet_();
    const rows = list.map(x => [new Date(x.t || Date.now()), clean_(x.id, 40), hs ? hs.MaHS : '', clean_(x.ten || (hs && hs.HoTen) || '', 60),
      clean_(x.lop || (hs && hs.TenLop) || '', 20), hs ? hs.MaLop : '', hs ? String(hs.Truong || '') : gvTruong, clean_(x.bai, 120), clean_(x.phan, 120),
      Number(x.lan) || 1, isFinite(+x.diem) ? Math.round(+x.diem * 100) / 100 : '', Number(x.max) || 10,
      x.soLoi == null || x.soLoi === '' ? '' : Number(x.soLoi) || 0]);
    if (rows.length) withLock_(() => { const ids = cn2111LogIds_(sh); const fresh = rows.filter(r => !r[1] || ids.indexOf(r[1]) < 0); if (fresh.length) sh.getRange(sh.getLastRow() + 1, 1, fresh.length, fresh[0].length).setValues(fresh); });
    return { saved: rows.length };
  };
  API.practice_my = req => {
    const t = auth_(req, 'hs'), bai = String(req.bai || '');
    const sh = cn2111Sheet_(), last = sh.getLastRow(); if (last < 2) return [];
    const head = CN2111_LOG_HEAD;
    return sh.getRange(2, 1, last - 1, head.length).getValues().filter(r => r[2] === t.u && (!bai || String(r[7]).indexOf(bai) === 0))
      .map(r => { const o = {}; head.forEach((h, j) => { o[h] = r[j] instanceof Date ? r[j].toISOString() : r[j]; }); return o; }).slice(-300);
  };
  API.practice_logs = req => {
    const t = auth_(req, 'gv');
    const c = req.code ? ownClass_(t, req.code) : null;
    const sk = t.r === 'admin' ? '' : schoolKey_(teacher_(t).Truong), bai = String(req.bai || '');
    const sh = cn2111Sheet_();
    const last = sh.getLastRow(); if (last < 2) return [];
    const head = CN2111_LOG_HEAD;
    return sh.getRange(2, 1, last - 1, head.length).getValues()
      .filter(r => c ? r[5] === c.MaLop : (!sk || schoolKey_(r[6]) === sk))
      .filter(r => !bai || String(r[7]).indexOf(bai) === 0)
      .map(r => { const o = {}; head.forEach((h, j) => { o[h] = r[j] instanceof Date ? r[j].toISOString() : r[j]; }); return o; })
      .slice(-3000);
  };
}
var CN2111_LOG_HEAD = ['ThoiDiem', 'MaLuot', 'MaHS', 'HoTen', 'TenLop', 'MaLop', 'Truong', 'Bai', 'Phan', 'Lan', 'Diem', 'DiemToiDa', 'SoLoi'];
function cn2111Sheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('ThucHanh');
  if (!sh) { sh = ss.insertSheet('ThucHanh'); sh.getRange(1, 1, 1, CN2111_LOG_HEAD.length).setValues([CN2111_LOG_HEAD]).setFontWeight('bold'); sh.setFrozenRows(1); }
  else if (sh.getLastColumn() < CN2111_LOG_HEAD.length) sh.getRange(1, 1, 1, CN2111_LOG_HEAD.length).setValues([CN2111_LOG_HEAD]).setFontWeight('bold');
  return sh;
}
function cn2111LogIds_(sh) {
  const last = sh.getLastRow(); if (last < 2) return [];
  return sh.getRange(Math.max(2, last - 400), 2, Math.min(last - 1, 401), 1).getValues().map(r => String(r[0]));
}

try { cn2111Patch_(); } catch (e) { console.error('CapNhat_21_11: ' + e); }

/* ===== Cập nhật 22/11: thời gian BẮT ĐẦU cho bài giao (BaiGiao.BatDau) ===== */
function cn2211BatDau_() {
  if (typeof API === 'undefined' || typeof SHEETS === 'undefined') return;
  if (SHEETS.BaiGiao.indexOf('BatDau') < 0) SHEETS.BaiGiao.push('BatDau');
  const iso = v => v instanceof Date ? v.toISOString() : String(v || '');
  const map = () => { const m = {}; rows_('BaiGiao').forEach(b => { if (b.BatDau) m[b.MaBai] = iso(b.BatDau); }); return m; };
  const ca = API.create_assignment;
  if (ca) API.create_assignment = req => {
    const a = (req && req.assignment) || {};
    const st = a.startAt && !isNaN(new Date(a.startAt)) ? new Date(a.startAt).toISOString() : '';
    if (st && a.deadline && new Date(a.deadline) <= new Date(st)) throw new Error('Thời gian kết thúc phải sau thời gian bắt đầu');
    const o = ca(req);
    if (st) { ensureCols_('BaiGiao'); const r = rows_('BaiGiao').find(x => x.MaBai === o.MaBai); if (r) update_('BaiGiao', r._r, { BatDau: st }); o.BatDau = st; }
    return o;
  };
  const my = API.my_assignments;
  if (my) API.my_assignments = req => {
    const l = my(req), m = map(), now = new Date();
    l.forEach(o => { if (m[o.MaBai]) { o.BatDau = m[o.MaBai]; if (now < new Date(o.BatDau)) { o.chuaMo = true; o.soCau = o.DanhSachCau.length; o.DanhSachCau = []; } } });
    return l;
  };
  const la = API.list_assignments;
  if (la) API.list_assignments = req => { const l = la(req), m = map(); (l || []).forEach(o => { if (o && m[o.MaBai]) o.BatDau = m[o.MaBai]; }); return l; };
  const sb = API.submit;
  if (sb) API.submit = req => {
    const s = (req && req.result) || {};
    if (s.loai === 'baigiao') { const st = map()[String(s.key || '')]; if (st && new Date() < new Date(st)) throw new Error('Bài chưa đến giờ bắt đầu'); }
    return sb(req);
  };
}
try { cn2211BatDau_(); } catch (e) { console.error('CapNhat_22_11 BatDau: ' + e); }
