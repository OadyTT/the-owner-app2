// ═══════════════════════════════════════════════════════════════
// THE OWNER — Google Apps Script Backend (code.gs)
// Version: 2.0 | Deploy as Web App (Anyone can access)
// ═══════════════════════════════════════════════════════════════

const SHEETS = {
  MEMBERS:  'Members',
  CLASSES:  'Classes',
  BOOKINGS: 'Bookings',
  CHECKINS: 'CheckIns',
  FINES:    'Fines',
  ADMINS:   'Admins',
  SETTINGS: 'Settings',
};

// ════════════════════════════════════════════════════════════
// ENTRY POINTS
// ════════════════════════════════════════════════════════════

function doGet(e)  { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    let p = {};
    if (e.postData && e.postData.contents) {
      p = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      p = e.parameter;
    }

    const action = p.action;
    let result = { success: false, message: 'Unknown action: ' + action };

    switch (action) {
      case 'register':      result = registerMember(p); break;
      case 'login':         result = loginMember(p); break;
      case 'adminLogin':    result = adminLogin(p); break;
      case 'lineLogin':     result = lineLogin(p); break;
      case 'getMembers':    result = getMembers(); break;
      case 'addMember':     result = registerMember(p); break;
      case 'updateProfile': result = updateProfile(p); break;
      case 'deleteMember':  result = deleteMember(p); break;
      case 'searchMembers': result = searchMembers(p); break;
      case 'getClasses':    result = getClasses(); break;
      case 'addClass':      result = addClass(p); break;
      case 'updateClass':   result = updateClass(p); break;
      case 'deleteClass':   result = deleteClass(p); break;
      case 'booking':       result = createBooking(p); break;
      case 'cancelBooking': result = cancelBooking(p); break;
      case 'getBookings':   result = getBookings(p); break;
      case 'checkin':       result = processCheckin(p); break;
      case 'getCheckins':   result = getCheckins(p); break;
      case 'getFines':      result = getFines(p); break;
      case 'addFine':       result = addFine(p); break;
      case 'payFine':       result = markFinePaid(p); break;
      case 'getStats':      result = getStats(); break;
      case 'getReports':    result = getReports(p); break;
      case 'addAdmin':      result = addAdmin(p); break;
      case 'getAdmins':     result = getAdmins(); break;
      case 'setupSheets':   result = setupAllSheets(); break;
    }

    output.setContent(JSON.stringify(result));
  } catch (err) {
    output.setContent(JSON.stringify({ success: false, message: err.message }));
  }

  return output;
}

// ════════════════════════════════════════════════════════════
// SHEET HELPERS
// ════════════════════════════════════════════════════════════

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    initSheetHeaders(sheet, name);
  }
  return sheet;
}

function initSheetHeaders(sheet, name) {
  const headers = {
    Members:  ['ID','FirstName','LastName','Email','Phone','LineId','Password','Plan','Status','StartDate','ExpiryDate','TotalSessions','Fines','CreatedAt'],
    Classes:  ['ID','Name','Day','Time','Type','MaxSeats','BookedSeats','Status','ZoomLink','CreatedAt'],
    Bookings: ['ID','MemberID','ClassID','ClassName','BookDate','ClassDate','ClassTime','Type','Status','CheckedIn','CreatedAt'],
    CheckIns: ['ID','MemberID','MemberName','ClassID','ClassName','CheckInTime','Method','AdminID'],
    Fines:    ['ID','MemberID','MemberName','ClassID','ClassName','Date','Amount','Status','PaidDate'],
    Admins:   ['Username','Password','Name','Role','CreatedAt'],
    Settings: ['Key','Value'],
  };
  if (!headers[name]) return;
  sheet.appendRow(headers[name]);
  sheet.getRange(1,1,1,headers[name].length)
    .setFontWeight('bold')
    .setBackground('#C9A84C')
    .setFontColor('#0D0D0D');
  sheet.setFrozenRows(1);

  if (name === 'Admins') {
    sheet.appendRow(['admin', hashPw('admin1234'), 'Super Admin', 'super', now()]);
  }
  if (name === 'Settings') {
    [['fine_online','20'],['fine_onsite','50'],['fine_hybrid','100'],['cancel_hours','2']].forEach(r => sheet.appendRow(r));
  }
  if (name === 'Classes') {
    sheet.appendRow([genId('CLS'),'Business Model Canvas','จันทร์','09:00-11:00','hybrid',12,0,'active','',now()]);
    sheet.appendRow([genId('CLS'),'Digital Marketing','อังคาร','19:00-21:00','online',30,0,'active','https://zoom.us/j/example',now()]);
    sheet.appendRow([genId('CLS'),'Financial Planning','พุธ','09:00-12:00','onsite',10,0,'active','',now()]);
    sheet.appendRow([genId('CLS'),'Sales Psychology','พฤหัสบดี','19:00-21:00','online',50,0,'active','https://meet.google.com/example',now()]);
    sheet.appendRow([genId('CLS'),'Leadership Workshop','ศุกร์','10:00-12:00','hybrid',8,0,'active','',now()]);
  }
}

// Run once to setup all sheets
function setupAllSheets() {
  Object.values(SHEETS).forEach(name => getSheet(name));
  return { success: true, message: 'All sheets created successfully!' };
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function genId(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMddHHmmss') + Math.floor(Math.random()*100);
}

function now() {
  return new Date().toISOString();
}

function hashPw(pw) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw)
    .map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2,'0')).join('');
}

function thaiDate(d) {
  return Utilities.formatDate(d || new Date(), 'Asia/Bangkok', 'dd/MM/yyyy');
}

function todayStr() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
}

// ════════════════════════════════════════════════════════════
// AUTH — MEMBER
// ════════════════════════════════════════════════════════════

function registerMember(p) {
  if (!p.firstName || !p.email || !p.password)
    return { success: false, message: 'กรุณากรอกข้อมูลให้ครบ' };

  const sheet = getSheet(SHEETS.MEMBERS);
  const members = sheetToObjects(sheet);

  if (members.find(m => m.Email === p.email))
    return { success: false, message: 'อีเมลนี้ถูกใช้งานแล้ว' };

  const id = 'THE-' + String(Date.now()).slice(-5);
  sheet.appendRow([
    id, p.firstName, p.lastName||'', p.email, p.phone||'', p.lineId||'',
    hashPw(p.password), p.plan||'trial', 'active', '', '', 0, 0, now()
  ]);

  return {
    success: true,
    user: { id, firstName:p.firstName, lastName:p.lastName||'', email:p.email,
            phone:p.phone||'', lineId:p.lineId||'', plan:p.plan||'trial',
            sessions:0, fines:0, expiry:'นับจาก Check-in แรก' }
  };
}

function loginMember(p) {
  const sheet = getSheet(SHEETS.MEMBERS);
  const members = sheetToObjects(sheet);
  const hashed = hashPw(p.password);
  const m = members.find(x => x.Email === p.email && x.Password === hashed);

  if (!m) return { success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
  if (m.Status !== 'active') return { success: false, message: 'บัญชีถูกระงับ กรุณาติดต่อ Admin' };

  return {
    success: true,
    user: {
      id: m.ID, firstName: m.FirstName, lastName: m.LastName,
      email: m.Email, phone: m.Phone, lineId: m.LineId,
      plan: m.Plan, sessions: Number(m.TotalSessions)||0,
      fines: Number(m.Fines)||0,
      expiry: m.ExpiryDate || 'นับจาก Check-in แรก'
    }
  };
}

function lineLogin(p) {
  if (!p.lineUserId) return { success: false, message: 'ไม่มี LINE User ID' };
  const sheet = getSheet(SHEETS.MEMBERS);
  const members = sheetToObjects(sheet);
  const m = members.find(x => x.LineId === p.lineUserId);

  if (!m) return { success: false, message: 'ไม่พบสมาชิก', needRegister: true, displayName: p.displayName };

  return {
    success: true,
    user: {
      id: m.ID, firstName: m.FirstName, lastName: m.LastName,
      email: m.Email, phone: m.Phone, lineId: m.LineId,
      plan: m.Plan, sessions: Number(m.TotalSessions)||0,
      fines: Number(m.Fines)||0, expiry: m.ExpiryDate||'นับจาก Check-in แรก'
    }
  };
}

// ════════════════════════════════════════════════════════════
// AUTH — ADMIN
// ════════════════════════════════════════════════════════════

function adminLogin(p) {
  const sheet = getSheet(SHEETS.ADMINS);
  const admins = sheetToObjects(sheet);
  const hashed = hashPw(p.password);
  const a = admins.find(x => x.Username === p.username && x.Password === hashed);

  if (!a) return { success: false, message: 'Username หรือ Password ไม่ถูกต้อง' };
  return { success: true, admin: { username: a.Username, name: a.Name, role: a.Role } };
}

function addAdmin(p) {
  if (!p.username || !p.password) return { success: false, message: 'กรอก Username และ Password' };
  const sheet = getSheet(SHEETS.ADMINS);
  const admins = sheetToObjects(sheet);
  if (admins.find(a => a.Username === p.username))
    return { success: false, message: 'Username นี้มีอยู่แล้ว' };
  sheet.appendRow([p.username, hashPw(p.password), p.name||p.username, p.role||'staff', now()]);
  return { success: true };
}

function getAdmins() {
  const sheet = getSheet(SHEETS.ADMINS);
  const admins = sheetToObjects(sheet).map(a => ({
    username: a.Username, name: a.Name, role: a.Role, createdAt: a.CreatedAt
  }));
  return { success: true, admins };
}

// ════════════════════════════════════════════════════════════
// MEMBERS CRUD
// ════════════════════════════════════════════════════════════

function getMembers() {
  const sheet = getSheet(SHEETS.MEMBERS);
  const members = sheetToObjects(sheet).map(m => ({
    id: m.ID, firstName: m.FirstName, lastName: m.LastName,
    email: m.Email, phone: m.Phone, plan: m.Plan,
    status: m.Status, expiry: m.ExpiryDate,
    sessions: Number(m.TotalSessions)||0, fines: Number(m.Fines)||0
  }));
  return { success: true, members };
}

function updateProfile(p) {
  const sheet = getSheet(SHEETS.MEMBERS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === p.id) {
      if (p.firstName) sheet.getRange(i+1,2).setValue(p.firstName);
      if (p.lastName)  sheet.getRange(i+1,3).setValue(p.lastName);
      if (p.phone)     sheet.getRange(i+1,5).setValue(p.phone);
      return { success: true };
    }
  }
  return { success: false, message: 'ไม่พบสมาชิก' };
}

function deleteMember(p) {
  const sheet = getSheet(SHEETS.MEMBERS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === p.id) {
      sheet.getRange(i+1,9).setValue('deleted');
      return { success: true };
    }
  }
  return { success: false };
}

function searchMembers(p) {
  const q = (p.query||'').toLowerCase();
  const sheet = getSheet(SHEETS.MEMBERS);
  const result = sheetToObjects(sheet)
    .filter(m => m.Status !== 'deleted')
    .filter(m => (m.FirstName+' '+m.LastName+m.Email+m.ID).toLowerCase().includes(q))
    .map(m => ({ id:m.ID, name:m.FirstName+' '+m.LastName, plan:m.Plan }));
  return { success: true, members: result };
}

// ════════════════════════════════════════════════════════════
// CLASSES CRUD
// ════════════════════════════════════════════════════════════

function getClasses() {
  const sheet = getSheet(SHEETS.CLASSES);
  const classes = sheetToObjects(sheet)
    .filter(c => c.Status === 'active')
    .map(c => ({
      id: c.ID, name: c.Name, day: c.Day, time: c.Time,
      type: c.Type, maxSeats: Number(c.MaxSeats)||0,
      bookedSeats: Number(c.BookedSeats)||0, zoomLink: c.ZoomLink||''
    }));
  return { success: true, classes };
}

function addClass(p) {
  const sheet = getSheet(SHEETS.CLASSES);
  const id = genId('CLS');
  sheet.appendRow([id, p.name, p.day, p.time, p.type||'onsite', p.maxSeats||10, 0, 'active', p.zoomLink||'', now()]);
  return { success: true, id };
}

function updateClass(p) {
  const sheet = getSheet(SHEETS.CLASSES);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === p.id) {
      if (p.name)     sheet.getRange(i+1,2).setValue(p.name);
      if (p.day)      sheet.getRange(i+1,3).setValue(p.day);
      if (p.time)     sheet.getRange(i+1,4).setValue(p.time);
      if (p.maxSeats) sheet.getRange(i+1,6).setValue(p.maxSeats);
      if (p.status)   sheet.getRange(i+1,8).setValue(p.status);
      if (p.zoomLink) sheet.getRange(i+1,9).setValue(p.zoomLink);
      return { success: true };
    }
  }
  return { success: false };
}

function deleteClass(p) {
  const sheet = getSheet(SHEETS.CLASSES);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === p.id) {
      sheet.getRange(i+1,8).setValue('deleted');
      return { success: true };
    }
  }
  return { success: false };
}

// ════════════════════════════════════════════════════════════
// BOOKINGS
// ════════════════════════════════════════════════════════════

function createBooking(p) {
  if (!p.memberId || !p.className)
    return { success: false, message: 'ข้อมูลไม่ครบ' };

  const sheet = getSheet(SHEETS.BOOKINGS);
  const bookings = sheetToObjects(sheet);

  const dup = bookings.find(b =>
    b.MemberID === p.memberId &&
    b.ClassName === p.className &&
    b.Status !== 'cancelled'
  );
  if (dup) return { success: false, message: 'คุณจองคลาสนี้แล้ว' };

  // Check seat availability
  if (p.classId) {
    const classSheet = getSheet(SHEETS.CLASSES);
    const classes = sheetToObjects(classSheet);
    const cls = classes.find(c => c.ID === p.classId);
    if (cls && Number(cls.BookedSeats) >= Number(cls.MaxSeats))
      return { success: false, message: 'ที่นั่งเต็มแล้ว' };
  }

  const id = genId('BKG');
  sheet.appendRow([
    id, p.memberId, p.classId||'', p.className,
    now(), p.classDate||'', p.time||'', p.type||'',
    'pending', false, now()
  ]);

  // Increment booked seats
  if (p.classId) {
    const classSheet = getSheet(SHEETS.CLASSES);
    const data = classSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === p.classId) {
        classSheet.getRange(i+1,7).setValue(Number(data[i][6]||0)+1);
        break;
      }
    }
  }

  return { success: true, bookingId: id };
}

function cancelBooking(p) {
  const sheet = getSheet(SHEETS.BOOKINGS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === p.bookingId) {
      sheet.getRange(i+1,9).setValue('cancelled');
      // Decrement seat count
      if (data[i][2]) {
        const classSheet = getSheet(SHEETS.CLASSES);
        const cd = classSheet.getDataRange().getValues();
        for (let j = 1; j < cd.length; j++) {
          if (cd[j][0] === data[i][2]) {
            classSheet.getRange(j+1,7).setValue(Math.max(0, Number(cd[j][6]||0)-1));
            break;
          }
        }
      }
      return { success: true };
    }
  }
  return { success: false };
}

function getBookings(p) {
  const sheet = getSheet(SHEETS.BOOKINGS);
  let bookings = sheetToObjects(sheet);
  if (p.memberId) bookings = bookings.filter(b => b.MemberID === p.memberId);
  if (p.status)   bookings = bookings.filter(b => b.Status === p.status);
  return { success: true, bookings };
}

// ════════════════════════════════════════════════════════════
// CHECK-IN
// ════════════════════════════════════════════════════════════

function processCheckin(p) {
  if (!p.memberId) return { success: false, message: 'ไม่มี Member ID' };

  // 1. Validate member
  const memberSheet = getSheet(SHEETS.MEMBERS);
  const memberData = memberSheet.getDataRange().getValues();
  let memberRow = -1, member = null;

  for (let i = 1; i < memberData.length; i++) {
    if (memberData[i][0] === p.memberId) {
      memberRow = i + 1;
      member = {
        id: memberData[i][0], firstName: memberData[i][1], lastName: memberData[i][2],
        plan: memberData[i][7], status: memberData[i][8],
        startDate: memberData[i][9], expiryDate: memberData[i][10],
        sessions: Number(memberData[i][11])||0
      };
      break;
    }
  }

  if (!member) return { success: false, message: 'ไม่พบ Member ID: ' + p.memberId };
  if (member.status !== 'active') return { success: false, message: 'สมาชิกถูกระงับ' };

  // 2. Check membership not expired
  if (member.expiryDate) {
    const expiry = new Date(member.expiryDate);
    if (expiry < new Date()) return { success: false, message: 'แพ็กเกจหมดอายุแล้ว กรุณาต่ออายุ' };
  }

  // 3. Find today's confirmed booking
  const bookingSheet = getSheet(SHEETS.BOOKINGS);
  const bookingData = bookingSheet.getDataRange().getValues();
  let bookingRow = -1, bookingName = p.className || 'Walk-in';

  for (let i = 1; i < bookingData.length; i++) {
    if (bookingData[i][1] === p.memberId &&
        bookingData[i][8] === 'confirmed' &&
        !bookingData[i][9]) {
      bookingRow = i + 1;
      bookingName = bookingData[i][3] || bookingName;
      bookingSheet.getRange(bookingRow, 10).setValue(true);
      break;
    }
  }

  // 4. Log check-in
  const checkinSheet = getSheet(SHEETS.CHECKINS);
  checkinSheet.appendRow([
    genId('CHK'),
    member.id,
    member.firstName + ' ' + member.lastName,
    '',
    bookingName,
    new Date().toISOString(),
    p.method || 'qr',
    p.adminId || ''
  ]);

  // 5. Start membership period on first check-in
  if (!member.startDate) {
    const startDate = new Date();
    const expiryDate = new Date();
    if (member.plan === 'quarter') expiryDate.setDate(expiryDate.getDate() + 90);
    else expiryDate.setDate(expiryDate.getDate() + 1);
    memberSheet.getRange(memberRow, 10).setValue(Utilities.formatDate(startDate,'Asia/Bangkok','yyyy-MM-dd'));
    memberSheet.getRange(memberRow, 11).setValue(Utilities.formatDate(expiryDate,'Asia/Bangkok','yyyy-MM-dd'));
  }

  // 6. Increment session count
  memberSheet.getRange(memberRow, 12).setValue(member.sessions + 1);

  return {
    success: true,
    memberName: member.firstName + ' ' + member.lastName,
    memberId: member.id,
    plan: member.plan,
    className: bookingName,
    sessions: member.sessions + 1,
    checkinTime: Utilities.formatDate(new Date(),'Asia/Bangkok','HH:mm')
  };
}

function getCheckins(p) {
  const sheet = getSheet(SHEETS.CHECKINS);
  let checkins = sheetToObjects(sheet);
  if (p.today) checkins = checkins.filter(c => String(c.CheckInTime).startsWith(todayStr()));
  if (p.memberId) checkins = checkins.filter(c => c.MemberID === p.memberId);
  return { success: true, checkins };
}

// ════════════════════════════════════════════════════════════
// FINES
// ════════════════════════════════════════════════════════════

const FINE_AMOUNTS = { online: 20, onsite: 50, hybrid: 100 };

function getFines(p) {
  const sheet = getSheet(SHEETS.FINES);
  let fines = sheetToObjects(sheet);
  if (p.memberId) fines = fines.filter(f => f.MemberID === p.memberId);
  if (p.status)   fines = fines.filter(f => f.Status === p.status);
  const totalPending = fines.filter(f=>f.Status==='pending').reduce((s,f)=>s+Number(f.Amount||0),0);
  return { success: true, fines, totalPending };
}

function addFine(p) {
  const sheet = getSheet(SHEETS.FINES);
  const amount = p.amount || FINE_AMOUNTS[p.type||'onsite'] || 50;
  const id = genId('FNE');
  sheet.appendRow([id, p.memberId, p.memberName||'', p.classId||'', p.className||'', todayStr(), amount, 'pending', '']);

  // Update member fines total
  const mSheet = getSheet(SHEETS.MEMBERS);
  const mData = mSheet.getDataRange().getValues();
  for (let i = 1; i < mData.length; i++) {
    if (mData[i][0] === p.memberId) {
      mSheet.getRange(i+1,13).setValue(Number(mData[i][12]||0) + amount);
      break;
    }
  }
  return { success: true, id, amount };
}

function markFinePaid(p) {
  const sheet = getSheet(SHEETS.FINES);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === p.fineId) {
      sheet.getRange(i+1,8).setValue('paid');
      sheet.getRange(i+1,9).setValue(todayStr());
      return { success: true };
    }
  }
  return { success: false };
}

// Auto-fine for no-shows (run via Time Trigger, e.g. every night 23:00)
function autoFineNoShows() {
  const bookingSheet = getSheet(SHEETS.BOOKINGS);
  const bookings = sheetToObjects(bookingSheet);
  const classSheet = getSheet(SHEETS.CLASSES);
  const classes = sheetToObjects(classSheet);

  bookings.forEach(b => {
    if (b.Status === 'confirmed' && !b.CheckedIn && b.ClassDate === todayStr()) {
      const cls = classes.find(c => c.ID === b.ClassID);
      const type = cls ? cls.Type : 'onsite';
      addFine({
        memberId: b.MemberID,
        memberName: b.MemberID,
        classId: b.ClassID,
        className: b.ClassName,
        type: type
      });
      // Cancel the booking
      const bData = bookingSheet.getDataRange().getValues();
      for (let i = 1; i < bData.length; i++) {
        if (bData[i][0] === b.ID) { bookingSheet.getRange(i+1,9).setValue('no-show'); break; }
      }
    }
  });
}

// ════════════════════════════════════════════════════════════
// STATS & REPORTS
// ════════════════════════════════════════════════════════════

function getStats() {
  const members = sheetToObjects(getSheet(SHEETS.MEMBERS));
  const checkins = sheetToObjects(getSheet(SHEETS.CHECKINS));
  const fines = sheetToObjects(getSheet(SHEETS.FINES));
  const bookings = sheetToObjects(getSheet(SHEETS.BOOKINGS));

  const today = todayStr();
  const todayCI = checkins.filter(c => String(c.CheckInTime).startsWith(today));
  const pendingFines = fines.filter(f=>f.Status==='pending').reduce((s,f)=>s+Number(f.Amount||0),0);
  const pendingBk = bookings.filter(b=>b.Status==='confirmed'&&!b.CheckedIn);

  return {
    success: true,
    totalMembers: members.filter(m=>m.Status==='active').length,
    quarterMembers: members.filter(m=>m.Plan==='quarter'&&m.Status==='active').length,
    trialMembers: members.filter(m=>m.Plan==='trial'&&m.Status==='active').length,
    todayCheckins: todayCI.length,
    pendingFines,
    pendingBookings: pendingBk.length,
    recentCheckins: todayCI.slice(-5).reverse().map(c => ({
      name: c.MemberName, class: c.ClassName,
      time: c.CheckInTime ? new Date(c.CheckInTime).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}) : '—'
    })),
    pendingCheckins: pendingBk.slice(0,10).map(b => ({
      name: b.MemberID, class: b.ClassName, memberId: b.MemberID
    }))
  };
} 

function getReports(p) {
  const month = p.month || Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM');
  const members = sheetToObjects(getSheet(SHEETS.MEMBERS));
  const checkins = sheetToObjects(getSheet(SHEETS.CHECKINS));
  const fines = sheetToObjects(getSheet(SHEETS.FINES));

  const newMembers = members.filter(m => String(m.CreatedAt).startsWith(month));
  const monthSessions = checkins.filter(c => String(c.CheckInTime).startsWith(month));
  const newQ = newMembers.filter(m=>m.Plan==='quarter').length;
  const newT = newMembers.filter(m=>m.Plan==='trial').length;
  const fineRevenue = fines.filter(f=>f.Status==='paid'&&String(f.PaidDate).startsWith(month)).reduce((s,f)=>s+Number(f.Amount||0),0);

  return {
    success: true,
    monthRevenue: (newQ * 600) + (newT * 150) + fineRevenue,
    newMembers: newMembers.length,
    sessions: monthSessions.length,
    quarterRevenue: newQ * 600,
    trialRevenue: newT * 150,
    fineRevenue
  };
}

// ════════════════════════════════════════════════════════════
// SETUP TRIGGER (run once manually)
// ════════════════════════════════════════════════════════════

function createTriggers() {
  // Auto-fine no-shows every night at 23:00
  ScriptApp.newTrigger('autoFineNoShows')
    .timeBased()
    .atHour(23)
    .everyDays(1)
    .create();
  Logger.log('Triggers created!');
}
