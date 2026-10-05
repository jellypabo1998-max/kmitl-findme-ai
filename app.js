const ITEMS = [
  {
    name: 'House Keys',
    type: 'Found',
    category: 'Keys',
    location: 'Science Building',
    time: 'Today 14:20',
    icon: '🔑'
  },
  {
    name: 'Black Wallet',
    type: 'Found',
    category: 'Wallet',
    location: 'Library',
    time: 'Today 11:05',
    icon: '👛'
  },
  {
    name: 'Reading Glasses',
    type: 'Lost',
    category: 'Glasses',
    location: 'Cafeteria',
    time: 'Yesterday',
    icon: '👓'
  },
  {
    name: 'Dorm Keys',
    type: 'Lost',
    category: 'Keys',
    location: 'Dormitory',
    time: 'Yesterday',
    icon: '🔑'
  },
  {
    name: 'Water Bottle',
    type: 'Found',
    category: 'Bottle',
    location: 'Sports Complex',
    time: '2 days ago',
    icon: '🧴'
  },
  {
    name: 'Smartphone',
    type: 'Lost',
    category: 'Phone',
    location: 'Engineering Building',
    time: '2 days ago',
    icon: '📱'
  }
];
/* =========================================
   BROWSE ITEMS
========================================= */
function allBrowseItems() {
  let saved = [];
  try { saved = readReports(); } catch { /* Keep the demo catalog usable. */ }
  return [...saved.filter(r => r.status !== 'Returned').map(r => ({...r,
    name: r.itemName, type: reportKind(r) === 'found' ? 'Found' : 'Lost',
    time: [r.date, r.time].filter(Boolean).join(' '), icon: getIcon(r.category)
  })), ...ITEMS.map(item => ({...item, isDemo: true}))];
}
function card(item) {
  const photo = safePhoto(item.photo);
  const point = validCoordinates(item.latitude, item.longitude);
  return `<article class="item-card">
    <div class="item-photo">${photo ? `<img src="${escapeHTML(photo)}" alt="${escapeHTML(item.name)}" style="width:100%;height:100%;object-fit:cover">` : item.icon}</div>
    <div class="item-top"><h3>${escapeHTML(item.name)}</h3><span class="badge ${item.type === 'Found' ? 'found' : 'lost'}">${item.type}</span></div>
    <div class="meta">${escapeHTML(item.category)} • ${escapeHTML(item.location)}</div>
    <div class="meta">${escapeHTML(item.time)}</div>
    <div class="meta">${item.isDemo ? 'ข้อมูลตัวอย่าง' : 'รายงานที่บันทึก'}</div>
    ${point ? `<a class="text-link" href="${googleMapsLink(point)}" target="_blank" rel="noopener noreferrer">📍 ดูตำแหน่งจริง ↗</a><br>` : '<div class="meta">ยังไม่มีพิกัด</div>'}
    <a class="text-link" href="${item.id ? reportLink(item) : item.type === 'Found' ? 'verify.html' : 'matches.html'}">View details →</a>
  </article>`;
}
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
  list = ITEMS
) {
  const el =
    document.getElementById(target);
  if (!el) return;
  el.innerHTML =
    list.map(card).join('');
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
  const items = allBrowseItems();
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
  run();
}
/* =========================================
   IMAGE UPLOAD
========================================= */
function validKeysClassification(value) {
  return value && value.modelId === 'keys-hog-svm-v1'
    && ['keys','not_keys'].includes(value.label)
    && typeof value.margin === 'number' && Number.isFinite(value.margin);
}
function setupUpload() {
  document.querySelectorAll('[data-upload]').forEach(input => {
    const box = input.closest('.upload-box');
    const preview = box?.querySelector('.upload-preview');
    const status = box?.querySelector('[data-keys-status]');
    const note = box?.querySelector('[data-keys-note]');
    const apply = box?.querySelector('[data-keys-apply]');
    let generation = 0;
    apply?.addEventListener('click', () => {
      if (validKeysClassification(input._keysResult) && input._keysResult.label === 'keys') {
        const category = input.form?.querySelector('[name="category"]');
        if (category) { category.value = 'Keys'; category.dispatchEvent(new Event('input', {bubbles:true})); }
        apply.hidden = true;
        note.textContent = 'เลือกหมวด Keys แล้ว — ตรวจสอบและแก้หมวดเองได้';
      }
    });
    input.addEventListener('change', () => {
      const current = ++generation;
      const file = input.files?.[0];
      input._keysResult = null; input._keysTask = Promise.resolve(null);
      if (preview) preview.replaceChildren();
      if (apply) apply.hidden = true;
      if (!file) { if (status) status.textContent = 'เลือกรูปเพื่อลองตรวจว่าเป็นกุญแจไหม'; return; }
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) {
        if (status) status.textContent = 'ใช้รูป JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB';
        if (note) note.textContent = 'ยังไม่ได้ตรวจรูปนี้ กรุณาเลือกไฟล์ใหม่';
        return;
      }
      if (status) status.textContent = 'กำลังตรวจรูป…';
      if (note) note.textContent = 'โมเดลทดลองกำลังประมวลผลในเบราว์เซอร์';
      input._keysTask = new Promise(resolve => {
        const reader = new FileReader();
        const failed = () => {
          if (current === generation) {
            if (status) status.textContent = 'ตรวจรูปไม่ได้';
            if (note) note.textContent = 'ลองรูปอื่น หรือเลือกหมวดด้วยตัวเองแล้วแจ้งรายงานได้';
          }
          resolve(null);
        };
        reader.onerror = failed;
        reader.onload = async () => {
          if (current !== generation) { resolve(null); return; }
          const image = document.createElement('img');
          image.src = reader.result; image.alt = 'Uploaded item preview'; image.className = 'uploaded-item-preview';
          preview?.append(image);
          try {
            if (!window.FindMeKeys) throw new Error('Model unavailable');
            const result = await window.FindMeKeys.classifyDataUrl(reader.result);
            if (current !== generation) { resolve(null); return; }
            if (!validKeysClassification(result)) throw new Error('Invalid result');
            input._keysResult = result;
            if (status) status.textContent = result.label === 'keys' ? '🔑 โมเดลคาดว่าเป็นกุญแจ · Keys' : 'โมเดลคาดว่าไม่ใช่กุญแจ · Not keys';
            if (note) note.textContent = result.label === 'keys'
              ? 'ตรวจสอบรูปอีกครั้ง แล้วกดใช้หมวด Keys ได้ ผลนี้ยังอาจผิด'
              : 'เลือกหมวดของด้วยตัวเองได้ หากเป็นกุญแจจริง โมเดลอาจทายผิด';
            if (apply) apply.hidden = result.label !== 'keys';
            resolve(result);
          } catch (_) { failed(); }
        };
        reader.readAsDataURL(file);
      });
    });
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
    const photoInput = form.querySelector('[data-upload]');
    const photoFile = photoInput?.files?.[0];
    const classificationTask = photoInput?._keysTask || Promise.resolve(null);
    if (photoFile && (!/^image\/(jpeg|png|webp)$/.test(photoFile.type) || photoFile.size > 2 * 1024 * 1024)) {
      fail('กรุณาใช้รูป JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB'); return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const saveAndRedirect = async (photo = '') => {
      const predicted = photo ? await classificationTask.catch(() => null) : null;
      const keysClassification = validKeysClassification(predicted) ? predicted : null;
      try {
        // Parse before writing so malformed existing data is never overwritten.
        const list = readReports();
        const report = {
          ...data, photo, keysClassification, id: Date.now(), kind: form.dataset.kind,
          status: form.dataset.kind === 'lost' ? 'Searching' : 'Submitted'
        };
        localStorage.setItem('kmitl_reports', JSON.stringify([report, ...list]));
        location.href = 'matches.html?report=' + encodeURIComponent(report.id);
      } catch (err) {
        button.disabled = false;
        fail('บันทึกไม่สำเร็จ พื้นที่เก็บข้อมูลอาจเต็มหรือข้อมูลเดิมอ่านไม่ได้ ลองใช้รูปที่เล็กลง ข้อมูลเดิมยังอยู่');
      }
    };
    if (photoFile) {
      const reader = new FileReader();
      reader.onload = () => saveAndRedirect(reader.result);
      reader.onerror = () => { button.disabled = false; fail('อ่านรูปไม่สำเร็จ กรุณาเลือกรูปใหม่'); };
      reader.readAsDataURL(photoFile);
    } else saveAndRedirect();
  });
}
function readReports() {
  const saved = JSON.parse(localStorage.getItem('kmitl_reports') || '[]');
  if (!Array.isArray(saved)) throw new Error('Invalid reports');
  return saved.filter(report => report && typeof report === 'object');
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
  const actual = saved.filter(r => String(r.id) !== String(report.id) && r.status !== 'Returned'
    && (reportKind(r) === 'found' ? 'Found' : 'Lost') === targetType)
    .map(r => ({...r, name: r.itemName, type: targetType, time: [r.date, r.time].filter(Boolean).join(' '), icon: getIcon(r.category)}));
  const demos = ITEMS.filter(item => item.type === targetType).map(item => ({...item, isDemo: true}));
  return [...actual, ...demos].map(item => ({item, ...calculateMatch(report, item)}))
    .sort((a, b) => b.score - a.score).slice(0, 3);
}
/* =========================================
   HELPER FUNCTIONS
========================================= */
function normalize(value) {
  return String(
    value || ''
  )
  .trim()
  .toLowerCase();
}
function locationScore(
  a,
  b
) {
  const x =
    normalize(a);
  const y =
    normalize(b);
  if (!x || !y) {
    return 55;
  }
  if (x === y) {
    return 100;
  }
  if (
    x.includes(y) ||
    y.includes(x)
  ) {
    return 92;
  }
  const words =
    x.split(
      /[\s,.-]+/
    )
    .filter(Boolean);
  const hits =
    words.filter(
      word =>
        word.length > 2 &&
        y.includes(word)
    );
  if (hits.length) {
    return Math.min(
      88,
      70 + hits.length * 8
    );
  }
  return 55;
}
function categoryScore(
  a,
  b
) {
  return normalize(a) ===
    normalize(b)
    ? 100
    : 25;
}
function descriptionScore(
  description,
  itemName
) {
  const a =
    normalize(description);
  const b =
    normalize(itemName);
  if (!a) {
    return 55;
  }
  const words =
    b
      .split(/\s+/)
      .filter(
        word =>
          word.length > 2
      );
  const hits =
    words.filter(
      word =>
        a.includes(word)
    );
  if (hits.length) {
    return Math.min(
      95,
      72 + hits.length * 10
    );
  }
  return 58;
}
/* =========================================
   AI MATCH CALCULATION
========================================= */
function calculateMatch(
  report,
  item
) {
  const category =
    categoryScore(
      report.category,
      item.category
    );
  const location =
    locationScore(
      report.location,
      item.location
    );
  const description =
    descriptionScore(
      report.description,
      item.name
    );
  /*
   * Prototype image score.
   *
   * ตอนนี้เป็น Demo
   * ยังไม่ได้เชื่อม Computer Vision Model
   */
  const image =
    category === 100
      ? 88
      : 62;
  /*
   * Weighted AI score
   */
  const score =
    Math.round(
      image * 0.40 +
      category * 0.25 +
      location * 0.20 +
      description * 0.15
    );
  return {
    score,
    image,
    category,
    location,
    description
  };
}
/* =========================================
   GET LATEST REPORT
========================================= */
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
  if (validKeysClassification(report.keysClassification)) {
    const line = document.createElement('p');
    line.className = 'keys-ai-saved';
    line.textContent = report.keysClassification.label === 'keys'
      ? 'AI ตรวจรูป: คาดว่าเป็นกุญแจ (Keys) · รุ่นทดลอง แยกประเภทภาพเท่านั้น'
      : 'AI ตรวจรูป: คาดว่าไม่ใช่กุญแจ (Not keys) · รุ่นทดลอง แยกประเภทภาพเท่านั้น';
    target.append(line);
  }

}
/* =========================================
   RENDER AI MATCHES
========================================= */
function renderMatches() {
  const listEl =
    document.getElementById(
      'matchList'
    );
  const summaryEl =
    document.getElementById(
      'matchSummary'
    );
  if (!listEl) return;
  const report =
    (() => { try { return getLatestReport(); } catch { return null; } })();
  renderSubmittedItem(
    report
  );
  if (!report) {
    listEl.innerHTML = '';
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div
          class="form-card"
          style="
            margin-bottom:20px;
          "
        >
          <p>
            Please submit a report first.
          </p>
        </div>
      `;
    }
    return;
  }
  const point = validCoordinates(report.latitude, report.longitude);
  if (point) {
    const pin = document.createElement('a'); pin.className = 'text-link';
    pin.href = googleMapsLink(point); pin.target = '_blank'; pin.rel = 'noopener noreferrer';
    pin.textContent = `📍 ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)} — เปิด Google Maps ↗`;
    document.getElementById('submittedItemContent')?.append(pin);
  }
  const candidates = getMatchCandidates(report);
  const another = document.getElementById('reportAnother');
  if (another) {
    another.href = reportKind(report) === 'found' ? 'report-found.html' : 'report-lost.html';
    another.textContent = reportKind(report) === 'found' ? '← Report another found item' : '← Report another lost item';
  }
  const top =
    candidates[0];
  /* =====================================
     AI SUMMARY
  ===================================== */
  if (
    summaryEl &&
    top
  ) {
    summaryEl.innerHTML = `
      <div
        class="form-card"
        style="
          margin-bottom:20px;
        "
      >
        <div class="kicker">
          AI RESULT
        </div>
        <h2
          style="
            margin:4px 0 8px;
          "
        >
          ${top.score}%
          potential match
        </h2>
        <p
          class="meta"
          style="margin:0;"
        >
          พบ ${
            candidates.length
          }
          รายการที่มีความเป็นไปได้
          จากข้อมูลที่คุณแจ้ง
        </p>
      </div>
    `;
  }
  /* =====================================
     MATCH CARDS
  ===================================== */
  listEl.innerHTML =
    candidates
      .map(
        (result,index) => {
          const item =
            result.item;
          const icon =
            item.icon ||
            getIcon(
              item.category
            );
          const imageHTML =
            safePhoto(item.photo)
              ? `
                <img
                  src="${safePhoto(item.photo)}"
                  alt="${escapeHTML(item.name)}"
                  style="
                    width:100%;
                    height:100%;
                    object-fit:cover;
                  "
                >
              `
              : icon;
          return `
            <article
              class="match-card"
            >
              <!-- IMAGE -->
              <div
                class="match-photo"
              >
                ${imageHTML}
              </div>
              <!-- INFORMATION -->
              <div>
                <div
                  class="kicker"
                >
                  ${
                    index === 0
                      ? 'TOP MATCH'
                      : 'POSSIBLE MATCH'
                  }
                </div>
                <p class="meta">${item.isDemo ? "Sample report / ข้อมูลตัวอย่าง" : "Saved report / รายงานที่บันทึก"}</p>
                <h3>
                  ${
                    escapeHTML(
                      item.name
                    )
                  }
                </h3>
                <p>
                  ${
                    escapeHTML(
                      item.category
                    )
                  }
                  •
                  ${
                    escapeHTML(
                      item.location
                    )
                  }
                  •
                  ${
                    escapeHTML(
                      item.time
                    )
                  }
                </p>
                <!-- METRICS -->
                <div
                  class="metrics"
                >
                  <div
                    class="metric"
                  >
                    <span>
                      Image (demo)
                    </span>
                    <b>
                      ${
                        result.image
                      }%
                    </b>
                  </div>
                  <div
                    class="metric"
                  >
                    <span>
                      Category
                    </span>
                    <b>
                      ${
                        result.category
                      }%
                    </b>
                  </div>
                  <div
                    class="metric"
                  >
                    <span>
                      Location
                    </span>
                    <b>
                      ${
                        result.location
                      }%
                    </b>
                  </div>
                  <div
                    class="metric"
                  >
                    <span>
                      Description
                    </span>
                    <b>
                      ${
                        result.description
                      }%
                    </b>
                  </div>
                </div>
                <!-- WHY MATCH -->
                <p
                  class="meta"
                  style="
                    margin-top:12px;
                  "
                >
                  ${
                    result.category >= 80
                      ? '✓ Same category'
                      : '✗ Different category'
                  }
                  •
                  ${
                    result.location >= 80
                      ? '✓ Similar location'
                      : 'Location differs'
                  }
                  •
                  ${
                    result.description >= 70
                      ? '✓ Similar description'
                      : 'Description is less similar'
                  }
                </p>
              </div>
              <!-- SCORE -->
              <div
                class="score"
              >
                <strong>
                  ${
                    result.score
                  }%
                </strong>
                <a
                  class="btn ${
                    index === 0
                      ? 'btn-dark'
                      : 'btn-light'
                  }"
                  href="verify.html"
                >
                  View match
                </a>
              </div>
            </article>
          `;
        }
      )
      .join('');
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
  const demo = [
    {
      itemName:
        'House Keys',
      location:
        'Science Building',
      status:
        'Searching'
    },
    {
      itemName:
        'Black Wallet',
      location:
        'Library',
      status:
        'Potential Match'
    },
    {
      itemName:
        'Umbrella',
      location:
        'Engineering Building',
      status:
        'Returned'
    }
  ];
  const rows =
    [
      ...saved,
      ...demo
    ];
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
   START APP
========================================= */
document.addEventListener(
  'DOMContentLoaded',
  () => {
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