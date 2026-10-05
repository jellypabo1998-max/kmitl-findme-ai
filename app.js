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
function card(item) {
  return `
    <article class="item-card">
      <div class="item-photo">
        ${item.icon}
      </div>
      <div class="item-top">
        <h3>
          ${item.name}
        </h3>
        <span
          class="badge ${
            item.type === 'Found'
              ? 'found'
              : 'lost'
          }"
        >
          ${item.type}
        </span>
      </div>
      <div class="meta">
        ${item.category} • ${item.location}
      </div>
      <div class="meta">
        ${item.time}
      </div>
      <a
        class="text-link"
        href="${
          item.type === 'Found'
            ? 'verify.html'
            : 'matches.html'
        }"
      >
        View details →
      </a>
    </article>
  `;
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
  const search =
    document.getElementById('search');
  const type =
    document.getElementById('type');
  const category =
    document.getElementById('categoryFilter');
  const run = () => {
    const q =
      (search?.value || '')
      .toLowerCase();
    const t =
      type?.value || '';
    const c =
      category?.value || '';
    const out =
      ITEMS.filter(item =>
        (
          !q ||
          (
            `${item.name}
             ${item.category}
             ${item.location}`
          )
          .toLowerCase()
          .includes(q)
        )
        &&
        (
          !t ||
          item.type === t
        )
        &&
        (
          !c ||
          item.category === c
        )
      );
    renderItems(
      'itemsGrid',
      out
    );
  };
  [
    search,
    type,
    category
  ]
  .forEach(element => {
    if (element) {
      element.addEventListener(
        'input',
        run
      );
    }
  });
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
      ITEMS.slice(0,6)
    );
    setupBrowse();
    setupUpload();
    setupReportForm();
    renderReports();
    setupVerify();
    renderMatches();
  }
);