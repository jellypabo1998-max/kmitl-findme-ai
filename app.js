/* =========================================
   BROWSE ITEMS
========================================= */
function allBrowseItems() {
  let saved = [];
  try { saved = readReports(); } catch { /* Leave saved data untouched if it cannot be read. */ }
  return [...saved.filter(r => r.status !== 'Returned').map(r => ({...r,
    name: r.itemName, type: reportKind(r) === 'found' ? 'Found' : 'Lost',
    time: [r.date, r.time].filter(Boolean).join(' '), icon: getIcon(r.category)
  }))];
}
function card(item) {
  const photo = safePhoto(item.photo);
  const point = validCoordinates(item.latitude, item.longitude);
  return `<article class="item-card">
    <div class="item-photo">${photo ? `<img src="${escapeHTML(photo)}" alt="${escapeHTML(item.name)}" style="width:100%;height:100%;object-fit:cover">` : item.icon}</div>
    <div class="item-top"><h3>${escapeHTML(item.name)}</h3><span class="badge ${item.type === 'Found' ? 'found' : 'lost'}">${item.type}</span></div>
    <div class="meta">${escapeHTML(item.category)} • ${escapeHTML(item.location)}</div>
    <div class="meta">${escapeHTML(item.time)}</div>
    <div class="meta">รายงานที่บันทึก</div>
    ${point ? `<a class="text-link" href="${googleMapsLink(point)}" target="_blank" rel="noopener noreferrer">📍 ดูตำแหน่งจริง ↗</a><br>` : '<div class="meta">ยังไม่มีพิกัด</div>'}
    <a class="text-link" ${item.id ? `data-item-details="${escapeHTML(item.id)}"` : ''} href="${item.id ? reportLink(item) : item.type === 'Found' ? 'verify.html' : 'matches.html'}">View details →</a>
  </article>`;
}

// Shared item details for cards and map markers.
window.FindMeOpenItem = function(item) {
  let dialog = document.getElementById('itemDetailsDialog');
  if (!dialog) {
    dialog = document.createElement('dialog'); dialog.id='itemDetailsDialog'; dialog.className='item-details-dialog';
    dialog.setAttribute('aria-labelledby','itemDetailsTitle'); document.body.append(dialog);
    dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
  }
  const photo=safePhoto(item.photo), point=validCoordinates(item.latitude,item.longitude);
  dialog.innerHTML=`<div class="item-details-head"><span class="badge ${item.type==='Found'?'found':'lost'}">${item.type==='Found'?'Found':'Lost'}</span><button class="btn btn-light" type="button" data-close-item aria-label="ปิดรายละเอียด">✕</button></div>
    ${photo?`<img class="item-details-image" src="${escapeHTML(photo)}" alt="${escapeHTML(item.name||item.itemName||'รูปสิ่งของ')}">`:`<div class="item-details-placeholder">${getIcon(item.category)}</div>`}
    ${window.FindMeReports?.contactHTML(item)||''}<h2 id="itemDetailsTitle">${escapeHTML(item.name||item.itemName||'Untitled item')}</h2>
    <p class="meta">${escapeHTML(item.category||'Other')} • ${escapeHTML(item.location||'ไม่ระบุสถานที่')}</p>
    <p class="meta">${escapeHTML(item.time||[item.date,item.time].filter(Boolean).join(' ')||'')}</p>
    <p class="item-details-description">${escapeHTML(item.description||'ไม่มีรายละเอียดเพิ่มเติม')}</p>
    <div class="form-actions">${point?`<a class="btn btn-light" href="${googleMapsLink(point)}" target="_blank" rel="noopener noreferrer">เปิดตำแหน่งใน Google Maps ↗</a>`:''}${item.id?`<a class="btn btn-dark" href="${reportLink(item)}">ดูรายการที่ตรงกัน</a>`:''}</div>`;
  dialog.querySelector('[data-close-item]').addEventListener('click',()=>dialog.close());
  if(!dialog.open)dialog.showModal();
};
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-item-details]');if(!button)return;
  const item=allBrowseItems().find(row=>String(row.id)===button.dataset.itemDetails);
  if(item){event.preventDefault();window.FindMeOpenItem(item);}
});

function validCoordinates(latitude, longitude) {
  if (latitude === '' || longitude === '' || latitude == null || longitude == null) return null;
  const lat = Number(latitude), lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? {lat, lng} : null;
}
function googleMapsLink(point) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(point.lat + ',' + point.lng);
}
function renderItems(
  target = 'itemsGrid',
  list = allBrowseItems()
) {
  const el =
    document.getElementById(target);
  if (!el) return;
  el.innerHTML =
    list.length ? list.map(card).join('') : '<p class="meta" role="status">ยังไม่มีรายงานที่ตรงกับการค้นหา รายงานใหม่จะแชร์แก่สมาชิกเว็บ</p>';
}
/* =========================================
   SEARCH / BROWSE
========================================= */
function setupBrowse() {
  const search = document.getElementById('search');
  const type = document.getElementById('type');
  const category = document.getElementById('categoryFilter');
  const locationFilter = document.getElementById('locationFilter');
  if (!search) return;
  let items = allBrowseItems();
  search.value = new URLSearchParams(location.search).get('q') || '';
  if (locationFilter) {
    const locations = [...new Set(items.map(item => item.location).filter(Boolean))].sort();
    locations.forEach(value => { const option = document.createElement('option'); option.value = value; option.textContent = value; locationFilter.append(option); });
  }
  const run = () => {
    const q = search.value.trim().toLowerCase();
    const out = items.filter(item => (!q || `${item.name} ${item.category} ${item.location}`.toLowerCase().includes(q))
      && (!type?.value || item.type === type.value)
      && (!category?.value || item.category === category.value)
      && (!locationFilter?.value || item.location === locationFilter.value));
    renderItems('itemsGrid', out);
    const count = document.getElementById('browseCount');
    if (count) count.textContent = `${out.length} รายการ · ${out.filter(i => validCoordinates(i.latitude, i.longitude)).length} รายการมีหมุด`;
    if (!out.length) document.getElementById('itemsGrid').innerHTML = '<p class="empty-state">ไม่พบรายการ ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p>';
    if (typeof updateOverviewMap === 'function') updateOverviewMap('browseMap', out);
  };
  [search, type, category, locationFilter].forEach(element => element?.addEventListener('input', run));
  window.addEventListener('findme-reports-updated',()=>{items=allBrowseItems();run();});
  run();
}
/* =========================================
   IMAGE UPLOAD
========================================= */
function setupUpload() {
  document
    .querySelectorAll('[data-upload]')
    .forEach(input => {
      input.addEventListener(
        'change',
        () => {
          const file =
            input.files?.[0];
          const preview =
            input
              .closest('.upload-box')
              ?.querySelector(
                '.upload-preview'
              );
          if (
            !file ||
            !preview
          ) {
            return;
          }
          const reader =
            new FileReader();
          reader.onload = () => {
            preview.innerHTML = `
              <img
                src="${reader.result}"
                alt="Uploaded item preview"
                style="
                  max-width:100%;
                  max-height:240px;
                  border-radius:14px;
                  display:block;
                  margin-top:14px;
                "
              >
            `;
          };
          reader.readAsDataURL(file);
        }
      );
    });
}
/* =========================================
   REPORT FORM
========================================= */
function setupReportForm() {
  const form = document.querySelector('[data-report-form]');
  if (!form) return;
  const error = document.createElement('p');
  error.setAttribute('role', 'alert');
  error.style.color = '#b42318';
  error.hidden = true;
  form.append(error);
  const fail = message => { error.textContent = message; error.hidden = false; };
  form.addEventListener('submit', event => {
    event.preventDefault();
    error.hidden = true;
    const data = Object.fromEntries(new FormData(form).entries());
    for (const field of ['itemName', 'description', 'location']) {
      data[field] = String(data[field] || '').trim();
      if (!data[field]) { fail('กรุณากรอกชื่อ รายละเอียด และสถานที่ให้ครบ'); return; }
    }
    const point = validCoordinates(data.latitude, data.longitude);
    if (!point) { fail('กรุณาปักหมุดบนแผนที่ หรือกรอกพิกัดให้ถูกต้องก่อนส่งรายงาน'); return; }
    data.latitude = point.lat; data.longitude = point.lng;
    const photoFile = form.querySelector('[data-upload]')?.files?.[0];
    if (photoFile && (!/^image\/(jpeg|png|webp)$/.test(photoFile.type) || photoFile.size > 2 * 1024 * 1024)) {
      fail('กรุณาใช้รูป JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB'); return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const saveAndRedirect = async (photo = '') => {
      try {
        const report = await window.FindMeReports.create({...data,photo,kind:form.dataset.kind,
          contactConsent:form.elements.contactConsent.checked,clientKey:form.dataset.clientKey||(form.dataset.clientKey=crypto.randomUUID())});
        window.FindMeNavigate('matches.html?report=' + encodeURIComponent(report.id));
      } catch (err) {
        button.disabled = false;
        fail(err.message || 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง');
      }
    };
    if (photoFile) {
      window.FindMeReports.photo(photoFile).then(saveAndRedirect).catch(err=>{button.disabled=false;fail(err.message||'อ่านรูปไม่สำเร็จ');});
    } else saveAndRedirect();
  });
}
function readReports() {
  const shared = window.FindMeReports?.list() || [];
  let saved;
  try { saved = JSON.parse(localStorage.getItem('kmitl_reports') || '[]'); if (!Array.isArray(saved)) throw new Error('Invalid reports'); }
  catch (error) { if (shared.length) return shared; throw error; }
  return [...shared, ...saved.filter(report => report && typeof report === 'object' && !report.sharedReportId)];
}
function reportKind(report) {
  // Support reports saved before the kind field was added.
  return report.kind || (report.status === 'Submitted' ? 'found' : 'lost');
}
function reportLink(report) {
  return 'matches.html?report=' + encodeURIComponent(report.id);
}
function safePhoto(photo) {
  return typeof photo === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(photo) ? photo : '';
}
function getMatchCandidates(report, saved = readReports()) {
  const targetType = reportKind(report) === 'found' ? 'Lost' : 'Found';
  return saved.filter(r => String(r.id) !== String(report.id) && r.status !== 'Returned'
    && (reportKind(r) === 'found' ? 'Found' : 'Lost') === targetType
    && String(r.category || '').trim().toLowerCase() === String(report.category || '').trim().toLowerCase())
    .map(r => ({item: {...r, name: r.itemName, type: targetType,
      time: [r.date, r.time].filter(Boolean).join(' '), icon: getIcon(r.category)}}));
}
/* รายการหมวดเดียวกันเป็นการกรองข้อมูลจริง ไม่ใช่คะแนนความคล้ายของภาพ */
function getLatestReport() {
  const saved = readReports();
  const id = new URLSearchParams(location.search).get('report');
  return id ? saved.find(report => String(report.id) === id) || null : saved[0] || null;
}
/* =========================================
   ICON
========================================= */
function getIcon(category) {
  const icons = {
    Keys: '🔑',
    Wallet: '👛',
    Phone: '📱',
    Bag: '👜',
    Bottle: '🧴',
    Glasses: '👓'
  };
  return (
    icons[category] ||
    '📦'
  );
}
/* =========================================
   SECURITY / HTML ESCAPE
========================================= */
function escapeHTML(
  value
) {
  return String(
    value || ''
  )
  .replace(
    /&/g,
    '&amp;'
  )
  .replace(
    /</g,
    '&lt;'
  )
  .replace(
    />/g,
    '&gt;'
  )
  .replace(
    /"/g,
    '&quot;'
  )
  .replace(
    /'/g,
    '&#039;'
  );
}
/* =========================================
   SHOW SUBMITTED ITEM
========================================= */
function renderSubmittedItem(
  report
) {
  const target =
    document.getElementById(
      'submittedItemContent'
    );
  if (!target) return;
  if (!report) {
    target.innerHTML = `
      <h3>
        No submitted item found
      </h3>
      <p class="meta">
        ลองกลับไปแจ้งของที่พบก่อน
        แล้วระบบจะนำข้อมูลมาแสดงที่หน้านี้
      </p>
    `;
    return;
  }
  let image;
  if (safePhoto(report.photo)) {
    image = `
      <img
        src="${safePhoto(report.photo)}"
        alt="Reported item"
        style="
          width:110px;
          height:110px;
          object-fit:cover;
          border-radius:16px;
        "
      >
    `;
  }
  else {
    image = `
      <div
        style="
          width:110px;
          height:110px;
          border-radius:16px;
          background:#f1f1ef;
          display:grid;
          place-items:center;
          font-size:42px;
        "
      >
        ${getIcon(report.category)}
      </div>
    `;
  }
  target.innerHTML = `
    <div
      style="
        display:flex;
        gap:18px;
        align-items:center;
        flex-wrap:wrap;
      "
    >
      ${image}
      <div>
        <div class="kicker">
          YOUR REPORT
        </div>
        <h2
          style="
            margin:4px 0 6px;
          "
        >
          ${
            escapeHTML(
              report.itemName ||
              'Untitled item'
            )
          }
        </h2>
        <p
          class="meta"
          style="margin:0;"
        >
          ${
            escapeHTML(
              report.category ||
              'Other'
            )
          }
          •
          ${
            escapeHTML(
              report.location ||
              'KMITL Campus'
            )
          }
        </p>
        ${
          report.description
            ? `
              <p
                class="meta"
                style="
                  margin:8px 0 0;
                "
              >
                ${
                  escapeHTML(
                    report.description
                  )
                }
              </p>
            `
            : ''
        }
      </div>
    </div>
  `;
}
/* =========================================
   RENDER AI MATCHES
========================================= */
function renderMatches() {
  const listEl = document.getElementById('matchList');
  const summaryEl = document.getElementById('matchSummary');
  if (!listEl) return;
  let report, candidates;
  try {
    report = getLatestReport();
    candidates = report ? getMatchCandidates(report) : [];
  } catch {
    if (summaryEl) summaryEl.textContent = 'อ่านรายงานที่บันทึกไม่ได้ ข้อมูลเดิมยังอยู่';
    listEl.replaceChildren();
    return;
  }
  renderSubmittedItem(report);
  if (!report) {
    listEl.replaceChildren();
    if (summaryEl) summaryEl.textContent = 'กรุณาส่งรายงานก่อนดูรายการที่เกี่ยวข้อง';
    return;
  }
  document.getElementById('submittedItemContent')?.insertAdjacentHTML('beforeend',window.FindMeReports?.contactHTML(report)||'');
  const point = validCoordinates(report.latitude, report.longitude);
  if (point) {
    const pin = document.createElement('a'); pin.className = 'text-link';
    pin.href = googleMapsLink(point); pin.target = '_blank'; pin.rel = 'noopener noreferrer';
    pin.textContent = `📍 ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)} — เปิด Google Maps ↗`;
    document.getElementById('submittedItemContent')?.append(pin);
  }
  const another = document.getElementById('reportAnother');
  if (another) {
    another.href = reportKind(report) === 'found' ? 'report-found.html' : 'report-lost.html';
    another.textContent = reportKind(report) === 'found' ? '← Report another found item' : '← Report another lost item';
  }
  if (summaryEl) summaryEl.innerHTML = `<div class="form-card" style="margin-bottom:20px">
    <h2>${candidates.length ? `พบ ${candidates.length} รายงานในหมวดเดียวกัน` : 'ยังไม่มีรายงานหมวดเดียวกัน'}</h2>
    <p class="meta">รายงานที่แชร์บนเว็บและรายงานเก่าบนเครื่องนี้ กรุณาตรวจรูป รายละเอียด และสถานที่ด้วยตัวเอง</p></div>`;
  listEl.innerHTML = candidates.map(({item}) => `<article class="match-card">
    <div class="match-photo">${safePhoto(item.photo) ? `<img src="${escapeHTML(safePhoto(item.photo))}" alt="${escapeHTML(item.name)}" style="width:100%;height:100%;object-fit:contain">` : getIcon(item.category)}</div>
    <div><div class="kicker">SAVED REPORT</div><h3>${escapeHTML(item.name)}</h3>
    <p>${escapeHTML(item.category)} • ${escapeHTML(item.location)} • ${escapeHTML(item.time)}</p>
    <p>${escapeHTML(item.description || '')}</p>${window.FindMeReports?.contactHTML(item)||''}</div>
    <div><a class="btn btn-light" href="${reportLink(item)}" data-item-details="${escapeHTML(item.id)}">ดูรายละเอียด</a></div>
    </article>`).join('');
}
/* =========================================
   MY REPORTS
========================================= */
function renderReports() {
  const grid =
    document.getElementById(
      'reportsGrid'
    );
  if (!grid) return;
  const saved = (() => { try { return readReports(); } catch { return []; } })();
  const rows = saved;
  grid.innerHTML =
    rows
      .map(
        r => `
          <article
            class="report-card"
          >
            <span
              class="badge ${
                r.status === 'Returned'
                  ? 'resolved'
                  : r.status ===
                    'Potential Match'
                    ? 'found'
                    : 'lost'
              }"
            >
              ${
                escapeHTML(r.status)
              }
            </span>
            <h3>
              ${
                escapeHTML(r.itemName || 'Untitled item')
              }
            </h3>
            <p class="meta">
              ${
                escapeHTML(r.location || 'KMITL Campus')
              }
            </p>
            <a
              class="btn btn-light"
              href="${
                r.id ? reportLink(r) : 'browse.html'
              }"
            >
              Open report
            </a>
          </article>
        `
      )
      .join('');
}
/* =========================================
   VERIFY
========================================= */
function setupVerify() {
  const form =
    document.getElementById(
      'verifyForm'
    );
  if (!form) return;
  form.addEventListener(
    'submit',
    event => {
      event.preventDefault();
      const success =
        document.getElementById(
          'verifySuccess'
        );
      if (success) {
        success.hidden =
          false;
      }
    }
  );
}

/* =========================================
   AUTH SYSTEM (PROTOTYPE)
========================================= */
function readUser() { return window.FindMeUser || null; }
function setupAuth() {
  const user = readUser();
  const userJSON = user ? JSON.stringify(user) : null;
  const isLoginPage = /\/(login|register)\.html$/.test(location.pathname);
  // 2. จัดการเมนู Dropdown
  if (!isLoginPage) {
    const navActionsList = document.querySelectorAll('.nav-actions');
    navActionsList.forEach(nav => {
      if (userJSON) {
        const user = JSON.parse(userJSON);
        
        nav.innerHTML = `
          <a class="btn btn-light" href="browse.html">Search Items</a>
          <div style="position: relative; display: inline-block;">
            <button class="btn btn-dark" id="userMenuBtn">👤 ${escapeHTML(user.name)} ▾</button>
            <div class="user-dropdown" id="userDropdown">
              <div class="user-info">
                <b>${escapeHTML(user.name)}</b>
                <small>${escapeHTML(user.email)}</small>
              </div>
              <a class="btn btn-light btn-block" href="account.html" style="justify-content:center;">My Account</a>
              <a class="btn btn-light btn-block" href="my-reports.html" style="justify-content:center;">My Reports</a>
              <button class="btn btn-light btn-block" id="logoutBtn" style="color: #c8432f; border-color: #f5c6cb; justify-content:center;">Log out</button>
            </div>
          </div>
        `;

        const menuBtn = nav.querySelector('#userMenuBtn');
        const dropdown = nav.querySelector('#userDropdown');
        const logoutBtn = nav.querySelector('#logoutBtn');

        menuBtn?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
          if (dropdown && !dropdown.contains(e.target) && e.target !== menuBtn) {
            dropdown.classList.remove('show');
          }
        });

        logoutBtn?.addEventListener('click', async () => {
          logoutBtn.disabled = true;
          try { await window.FindMeLogout(); }
          catch (err) { logoutBtn.disabled = false; logoutBtn.textContent = 'ลองออกจากระบบอีกครั้ง'; }
        });
      }
    });
  }
  return true;
}
/* =========================================
   MULTI-STEP REPORT FORM
========================================= */
function setupReportSteps() {
  const form = document.querySelector('[data-report-form]');
  const steps = form?.querySelectorAll('.form-step');
  if (!steps?.length) return;
  form.noValidate = true;
  const buttons = form.querySelectorAll('[data-step-button]');
  let currentStep = 1;
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.className = 'step-error';
  message.hidden = true;
  form.querySelector('.progress').after(message);

  function showStep(step) {
    currentStep = step;
    steps.forEach(section => section.classList.toggle('active', Number(section.dataset.step) === step));
    buttons.forEach(button => {
      const n = Number(button.dataset.stepButton);
      button.classList.toggle('active', n === step);
      button.classList.toggle('completed', n < step);
      if (n === step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    if (step === 4) updateReview();
  }

  function validateThrough(last) {
    message.hidden = true;
    for (const section of steps) {
      const n = Number(section.dataset.step);
      if (n > last) continue;
      for (const input of section.querySelectorAll('input:not([type="file"]), textarea, select')) {
        input.setCustomValidity(input.required && input.type !== 'checkbox' && !input.value.trim() ? 'กรุณากรอกข้อมูลนี้' : '');
        if (!input.checkValidity()) {
          showStep(n);
          input.reportValidity();
          return false;
        }
      }
      if (n === 2) {
        const file = form.querySelector('[data-upload]')?.files?.[0];
        if (file && (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024)) {
          showStep(2);
          message.textContent = 'กรุณาใช้รูป JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB';
          message.hidden = false;
          return false;
        }
      }
      if (n === 3 && !validCoordinates(form.elements.latitude.value, form.elements.longitude.value)) {
        showStep(3);
        message.textContent = 'กรุณาปักหมุดบนแผนที่ หรือกรอกพิกัดก่อนตรวจทานรายงาน';
        message.hidden = false;
        return false;
      }
    }
    return true;
  }
  function moveTo(target) {
    if (target < currentStep || validateThrough(target - 1)) showStep(target);
  }
  form.querySelectorAll('[data-next], [data-prev], [data-step-button]').forEach(button => {
    button.addEventListener('click', () => moveTo(Number(button.dataset.next || button.dataset.prev || button.dataset.stepButton)));
  });
  form.addEventListener('input', event => {
    if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
  });
  form.addEventListener('submit', event => {
    const wasReview = currentStep === 4;
    if (!validateThrough(3) || !wasReview) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (message.hidden && form.checkValidity() && validCoordinates(form.elements.latitude.value, form.elements.longitude.value)) showStep(4);
    }
  }, true);

  function updateReview() {
    const review = document.getElementById('reviewBox');
    if (!review) return;
    const value = name => form.elements[name]?.value || '-';
    const photo = form.querySelector('.upload-preview img');
    const image = photo && safePhoto(photo.src) ? `<img class="review-image" src="${escapeHTML(photo.src)}" alt="รูปสำหรับตรวจทานรายงาน">` : '<span class="meta">No photo selected</span>';
    const rows = [['Item name','itemName'],['Category','category'],['Description','description'],[form.dataset.kind === 'found' ? 'Date found' : 'Date lost','date'],['Approx. time','time'],['Location','location'],['Contact method','contactMethod'],['Contact','contactValue']];
    review.innerHTML = rows.map(([label,name]) => `<div class="review-row"><span class="review-label">${label}</span><span class="review-value">${escapeHTML(value(name))}</span></div>`).join('')
      + `<div class="review-row"><span class="review-label">Coordinates</span><span class="review-value">${escapeHTML(value('latitude'))}, ${escapeHTML(value('longitude'))}</span></div>`
      + `<div class="review-row"><span class="review-label">Photo</span><span class="review-value">${image}</span></div>`;
  }
  showStep(1);
}
/* =========================================
   START APP lalana
========================================= */
document.addEventListener(
  'DOMContentLoaded',
  async () => {
    await window.FindMeAuthReady;
    if (!window.FindMeUser) return;
    await window.FindMeReportsReady;
    setupAuth();
    setupReportSteps(); 
    renderItems(
      'recentGrid',
      allBrowseItems().slice(0,6)
    );
    setupBrowse();
    setupUpload();
    setupReportForm();
    renderReports();
    setupVerify();
    renderMatches();
  }
);
