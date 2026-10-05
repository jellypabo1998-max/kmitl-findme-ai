// KMITL map view; the initial center is a view, never an auto-selected report pin.
const CAMPUS_CENTER = [13.727478, 100.775952];
const overviewMaps = new Map();
const pendingMapItems = new Map();

function createCampusMap(id) {
  if (!window.L) return null;
  const map = L.map(id, {scrollWheelZoom: false}).setView(CAMPUS_CENTER, 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  return map;
}

function setupLocationPicker() {
  const container = document.getElementById('reportMap');
  const form = document.querySelector('[data-report-form]');
  if (!container || !form) return;
  const status = document.getElementById('pinStatus');
  const latField = form.elements.namedItem('latitude');
  const lngField = form.elements.namedItem('longitude');
  const manualLat = document.getElementById('pinLatitude');
  const manualLng = document.getElementById('pinLongitude');
  const link = document.getElementById('pinGoogleLink');
  const map = createCampusMap('reportMap');
  let marker, accuracyCircle, locationRequest = 0;
  if (!map) {
    container.textContent = 'โหลดแผนที่ไม่ได้ เปิด “กรอกพิกัดเอง” เพื่อเลือกตำแหน่ง หรือรีเฟรชเมื่อมีอินเทอร์เน็ต';
    container.classList.add('map-unavailable');
    document.querySelector('.coordinate-details').open = true;
  }
  function selectPoint(point, pan = false, accuracy = null) {
    latField.value = point.lat.toFixed(6);
    lngField.value = point.lng.toFixed(6);
    manualLat.value = latField.value;
    manualLng.value = lngField.value;
    status.textContent = `ปักหมุดแล้ว: ${latField.value}, ${lngField.value}` + (accuracy ? ` · GPS คลาดเคลื่อนประมาณ ${Math.round(accuracy)} ม.` : ' · ลากหมุดเพื่อแก้ตำแหน่ง');
    link.href = googleMapsLink(point); link.hidden = false;
    const locationInput = form.elements.namedItem('location');
    if (!locationInput.value.trim() || locationInput.dataset.pinGenerated === locationInput.value) {
      locationInput.value = `Pinned location (${latField.value}, ${lngField.value})`;
      locationInput.dataset.pinGenerated = locationInput.value;
    }
    if (!map) return;
    if (accuracyCircle) { map.removeLayer(accuracyCircle); accuracyCircle = null; }
    if (accuracy) accuracyCircle = L.circle(point, {radius: accuracy, color: '#2b6cb0', weight: 1, fillOpacity: 0.1}).addTo(map);
    if (marker) marker.setLatLng(point);
    else {
      marker = L.marker(point, {draggable: true, title: 'Selected report location', alt: 'หมุดตำแหน่งที่เลือก'}).addTo(map);
      marker.on('dragend', () => { locationRequest++; selectPoint(marker.getLatLng()); });
    }
    if (pan) map.setView(point, 17);
  }
  map?.on('click', event => { locationRequest++; selectPoint(event.latlng); });
  document.getElementById('applyCoordinates').addEventListener('click', () => {
    const point = validCoordinates(manualLat.value, manualLng.value);
    if (!point) { status.textContent = 'พิกัดไม่ถูกต้อง: Latitude -90 ถึง 90 และ Longitude -180 ถึง 180'; return; }
    locationRequest++; selectPoint(point, true);
  });
  document.getElementById('resetCampus').addEventListener('click', () => map?.setView(CAMPUS_CENTER, 16));
  document.getElementById('useMyLocation').addEventListener('click', () => {
    if (!navigator.geolocation) { status.textContent = 'อุปกรณ์นี้ไม่รองรับตำแหน่ง GPS กรุณาแตะเลือกจุดเอง'; return; }
    const request = ++locationRequest;
    status.textContent = 'กำลังขอตำแหน่งจากอุปกรณ์…';
    navigator.geolocation.getCurrentPosition(position => {
      if (request !== locationRequest) return;
      const point = validCoordinates(position.coords.latitude, position.coords.longitude);
      if (point) selectPoint(point, true, position.coords.accuracy);
    }, error => {
      if (request !== locationRequest) return;
      status.textContent = error.code === 1 ? 'ไม่ได้รับอนุญาตใช้ตำแหน่ง — แตะบนแผนที่หรือกรอกพิกัดเองได้' : 'หาตำแหน่งไม่สำเร็จ — แตะบนแผนที่หรือกรอกพิกัดเองได้';
    }, {enableHighAccuracy: true, timeout: 12000, maximumAge: 30000});
  });
}

function updateOverviewMap(id, items) {
  pendingMapItems.set(id, items);
  const state = overviewMaps.get(id);
  if (!state) return;
  state.markers.clearLayers();
  const pinned = items.map(item => ({item, point: validCoordinates(item.latitude, item.longitude)})).filter(row => row.point);
  pinned.forEach(({item, point}) => {
    const popup = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = item.name || 'Untitled item';
    const details = document.createElement('p'); details.textContent = `${item.type} · ${item.location || ''}`;
    const link = document.createElement('a'); link.href = googleMapsLink(point); link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'เปิด Google Maps ↗';
    popup.append(title, details, link);
    L.circleMarker(point, {
      radius: 9, color: '#fff', weight: 2,
      fillColor: item.type === 'Found' ? '#f05a24' : '#2563eb', fillOpacity: 1
    }).bindPopup(popup).addTo(state.markers);
  });
  if (pinned.length) state.map.fitBounds(state.markers.getBounds().pad(0.25), {maxZoom: 17});
  else state.map.setView(CAMPUS_CENTER, 16);
  const status = document.getElementById(id + 'Status');
  if (status) status.textContent = pinned.length ? `${pinned.length} หมุดจากรายงานที่บันทึกในเบราว์เซอร์นี้ · แตะหมุดเพื่อดูรายละเอียด` : 'ยังไม่มีหมุดในรายการนี้ — แจ้งของหายหรือของที่พบพร้อมปักตำแหน่งเพื่อเริ่ม';
}

function setupOverviewMaps() {
  ['homeMap', 'browseMap'].forEach(id => {
    const container = document.getElementById(id);
    if (!container) return;
    const map = createCampusMap(id);
    if (!map) { container.textContent = 'แผนที่โหลดไม่สำเร็จ คุณยังดูพิกัดจากลิงก์ในรายการได้'; container.classList.add('map-unavailable'); return; }
    overviewMaps.set(id, {map, markers: L.featureGroup().addTo(map)});
    updateOverviewMap(id, pendingMapItems.get(id) || allBrowseItems());
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupLocationPicker();
  setupOverviewMaps();
});
