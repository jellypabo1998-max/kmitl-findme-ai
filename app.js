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
    <h2 id="itemDetailsTitle">${escapeHTML(item.name||item.itemName||'Untitled item')}</h2>
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
    const saveAndRedirect = (photo = '') => {
      try {
        // Parse before writing so malformed existing data is never overwritten.
        const list = readReports();
        const report = {
          ...data, photo, id: Date.now(), kind: form.dataset.kind,
          status: form.dataset.kind === 'lost' ? 'Searching' : 'Submitted'
        };
        localStorage.setItem('kmitl_reports', JSON.stringify([report, ...list]));
        window.FindMeNavigate('matches.html?report=' + encodeURIComponent(report.id));
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
        input.setCustomValidity(input.required && !input.value.trim() ? 'กรุณากรอกข้อมูลนี้' : '');
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
    const rows = [['Item name','itemName'],['Category','category'],['Description','description'],['Date lost','date'],['Approx. time','time'],['Location','location']];
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
