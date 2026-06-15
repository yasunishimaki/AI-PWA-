// ============================================
// 受付アプリ（iPad/Safari用）デモ版
// QR読み取り → 問診メモ表示 → AirPrintで印刷
// ============================================

const rState = {
  stream: null,
  scanning: false,
  rafId: null,
  memo: null,
};

window.addEventListener('DOMContentLoaded', () => {
  showView('home');
});

// ---------- 画面切替 ----------
function showView(name) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  const el = document.getElementById('view-' + name);
  if (el) el.classList.add('active');
}

// ---------- QRスキャン開始 ----------
async function startScan() {
  showView('scan');
  setScanStatus('カメラを起動しています...');
  try {
    rState.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }, // 背面カメラ優先
      audio: false,
    });
    const video = document.getElementById('scan-video');
    video.srcObject = rState.stream;
    video.setAttribute('playsinline', true); // iOS Safari
    await video.play();
    rState.scanning = true;
    setScanStatus('患者さんのQRコードをカメラに写してください');
    tick();
  } catch (err) {
    console.error('カメラエラー:', err);
    setScanStatus('');
    alert('カメラを起動できませんでした。\nSafariのカメラ許可を確認してください。\n\n' + err.message);
    showView('home');
  }
}

function stopScan() {
  rState.scanning = false;
  if (rState.rafId) cancelAnimationFrame(rState.rafId);
  if (rState.stream) {
    rState.stream.getTracks().forEach(t => t.stop());
    rState.stream = null;
  }
}

function cancelScan() {
  stopScan();
  showView('home');
}

// ---------- フレーム解析ループ ----------
function tick() {
  if (!rState.scanning) return;
  const video = document.getElementById('scan-video');
  const canvas = document.getElementById('scan-canvas');

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      handleQRData(code.data);
      return; // ループ停止
    }
  }
  rState.rafId = requestAnimationFrame(tick);
}

// ---------- QRデータを解釈 ----------
function handleQRData(raw) {
  let payload = null;
  try {
    const json = LZString.decompressFromEncodedURIComponent(raw);
    payload = JSON.parse(json);
  } catch (e) {
    // 圧縮なしの素のJSONも一応試す
    try { payload = JSON.parse(raw); } catch (e2) { payload = null; }
  }

  if (!payload || !payload.items) {
    setScanStatus('このQRコードは問診メモではありません。もう一度お試しください。');
    rState.rafId = requestAnimationFrame(tick); // 読み取り継続
    return;
  }

  stopScan();
  rState.memo = payload;
  renderMemo(payload);
  showView('memo');
}

// ---------- メモ表示 ----------
function renderMemo(payload) {
  setText('memo-clinic', payload.cn || '');
  const created = payload.t ? new Date(payload.t) : new Date();
  setText('memo-date', formatDate(created));
  setText('memo-print-clinic', payload.cn || '');
  setText('memo-print-date', formatDate(created));

  const tbody = document.getElementById('memo-rows');
  tbody.innerHTML = '';
  payload.items.forEach(([label, value, highlight]) => {
    const tr = document.createElement('tr');
    if (highlight) tr.className = 'highlight';
    tr.innerHTML = `<th>${escapeHtml(label)}</th><td>${escapeHtml(value || '不明')}</td>`;
    tbody.appendChild(tr);
  });
}

// ---------- 印刷（AirPrint） ----------
function printMemo() {
  window.print();
}

// 次の患者へ
function nextPatient() {
  rState.memo = null;
  startScan();
}

// ---------- ユーティリティ ----------
function setScanStatus(text) { setText('scan-status', text); }

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function formatDate(date) {
  return `${date.getFullYear()}/${(date.getMonth()+1).toString().padStart(2,'0')}/${date.getDate().toString().padStart(2,'0')} ` +
         `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
