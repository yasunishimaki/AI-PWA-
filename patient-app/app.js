// ============================================
// AI事前問診メモ - デモ版（7月2日 クレアスクリニック）
// 自由発話 → AIが不足項目を音声で追加質問 → メモ確定 → QR表示
//
// 【多言語対応】
// 患者が日本語以外の言語で話しても、Whisperが言語を自動検出し、
// AIが内容を「日本語」に変換して問診メモを生成する。
// 追加質問は患者が検出された言語で表示される（メモ自体は常に日本語）。
// ============================================

// ---------- 状態管理 ----------
const state = {
  apiKey: null,
  template: null,          // 現在のクリニックテンプレート
  activeItems: [],         // 今回の問診で確認する項目（コア＋主訴別）
  memoData: {},            // key -> 値（"不明"含む）
  queue: [],               // これから質問する不足項目
  currentItem: null,       // 質問中の項目
  attemptCount: 0,         // 現項目への追加質問回数
  fullTranscript: '',      // 最初の自由発話の全文

  mediaRecorder: null,
  audioChunks: [],
  audioBlob: null,
  recordingStartTime: null,
  recordingTimerId: null,
  isRecording: false,
  recordingHandler: null,  // 録音停止時に呼ぶ関数（初回 or 回答）

  currentMemo: null,
  editingItemKey: null,
  _mockPattern: null,

  // ---------- 多言語対応 ----------
  patientLang: null,       // 検出された患者の言語コード（'ja' / 'en' / 'zh' など）。未検出時 null
  patientLangName: '',     // 表示用の言語名（'English' / '中文' など）
  _i18nCache: {},          // 日本語→患者言語の翻訳キャッシュ（同じ文を二度翻訳しない）
};

// ---------- 言語情報（Whisperのlanguage値→コード/表示名） ----------
// Whisperのverbose_jsonはlanguageを英語名（小文字）で返す（例: "english"）
const LANG_INFO = {
  japanese:   { code: 'ja', native: '日本語',     en: 'Japanese' },
  english:    { code: 'en', native: 'English',    en: 'English' },
  chinese:    { code: 'zh', native: '中文',        en: 'Chinese' },
  korean:     { code: 'ko', native: '한국어',      en: 'Korean' },
  vietnamese: { code: 'vi', native: 'Tiếng Việt', en: 'Vietnamese' },
  portuguese: { code: 'pt', native: 'Português',  en: 'Portuguese' },
  spanish:    { code: 'es', native: 'Español',    en: 'Spanish' },
  tagalog:    { code: 'tl', native: 'Tagalog',    en: 'Tagalog' },
  thai:       { code: 'th', native: 'ไทย',         en: 'Thai' },
  indonesian: { code: 'id', native: 'Bahasa Indonesia', en: 'Indonesian' },
  french:     { code: 'fr', native: 'Français',   en: 'French' },
  nepali:     { code: 'ne', native: 'नेपाली',       en: 'Nepali' },
};

// Whisperが返す言語名から言語情報を引く（未知の言語はその名前をそのまま使う）
function resolveLang(whisperLangName) {
  if (!whisperLangName) return { code: 'ja', native: '日本語', en: 'Japanese' };
  const key = String(whisperLangName).trim().toLowerCase();
  if (LANG_INFO[key]) return LANG_INFO[key];
  // 未登録の言語：名前を表示名・翻訳先として使う
  return { code: key, native: whisperLangName, en: whisperLangName };
}

function isJapaneseLang() {
  return !state.patientLang || state.patientLang === 'ja';
}

const MAX_FOLLOWUP_ATTEMPTS = 2; // 1項目につき最大2回まで聞き直す

// ---------- モックデータ（APIキー未設定時） ----------
// わざと一部の項目を欠落させ、追加質問フローを体験できるようにしている
const MOCK_PATTERNS = [
  {
    transcript: '昨日の夜寝る前くらいから、頭がズキズキ痛むんです。吐き気もあります。降圧薬は毎日飲んでます。',
    filled: {
      chiefComplaint: '後頭部のズキズキする頭痛',
      onset: '昨日の夜、寝る前ごろから',
      quality: '後頭部が拍動するようにズキズキ痛む。吐き気を伴う',
      medication: '降圧薬を毎日服用',
      // allergy / history / fever / travel / family は未回答 → 追加質問
    },
    mockAnswers: {
      allergy: '特にありません',
      history: '高血圧で近所の病院に通っています',
      fever: '熱はないと思います',
      travel: '行っていません',
      family: '家族は元気です',
      pain_onset: '急にではなく、だんだん痛くなりました',
      pain_provoke: '体を動かすと少しひびきます',
      pain_quality: 'ズキズキする感じです',
      pain_region: '後頭部です。首のあたりにも少し',
      pain_severity: '10段階だと6くらい',
      pain_timing: 'ずっと続いていて、夜に強くなります',
    },
  },
  {
    transcript: '3日前に重い荷物を持ち上げてから、腰が痛くて。動くと痛みます。お薬は飲んでいません。',
    filled: {
      chiefComplaint: '腰の痛み',
      onset: '3日前、重い荷物を持ち上げたとき',
      quality: '腰が鈍く痛む。体を動かすと強くなる',
      medication: '内服薬はなし（湿布を使用中）',
    },
    mockAnswers: {
      allergy: 'アレルギーはありません',
      history: '特に持病はありません',
      fever: '熱はありません',
      travel: '海外には行っていません',
      family: '家族は大丈夫です',
      pain_onset: '荷物を持った時に急に痛めました',
      pain_provoke: '前かがみになると痛いです。横になると楽です',
      pain_quality: '鈍い痛みです',
      pain_region: '腰の真ん中あたりです',
      pain_severity: '7くらいです',
      pain_timing: '動かなければ大丈夫ですが、動くと痛みます',
    },
  },
  // ---------- 英語の患者（多言語デモ用） ----------
  // 患者は英語で話すが、メモは日本語で生成される様子を体験できる
  {
    lang: 'english',
    transcript: "Since last night, just before I went to bed, I've had a throbbing headache. I also feel a bit nauseous. I take my blood pressure medicine every day.",
    // Whisperの文字起こしを日本語化したもの（実APIではGPT-4oが翻訳）
    jaTranscript: '昨日の夜、寝る前くらいから、頭がズキズキ痛みます。少し吐き気もあります。降圧薬は毎日飲んでいます。',
    filled: {
      chiefComplaint: '後頭部のズキズキする頭痛',
      onset: '昨日の夜、寝る前ごろから',
      quality: '頭が拍動するようにズキズキ痛む。軽い吐き気を伴う',
      medication: '降圧薬を毎日服用',
    },
    // 追加質問への回答（患者が英語で答える＝Whisperの文字起こし）
    mockAnswers: {
      allergy: 'No, I have no allergies.',
      history: 'I have high blood pressure and see a doctor near my home.',
      fever: "I don't think I have a fever.",
      travel: "No, I haven't been abroad.",
      family: 'My family is fine.',
      pain_onset: 'It started gradually, not suddenly.',
      pain_provoke: 'It hurts a bit more when I move my body.',
      pain_quality: 'A throbbing kind of pain.',
      pain_region: "The back of my head, and a little around my neck.",
      pain_severity: 'About 6 out of 10.',
      pain_timing: "It's constant, and gets worse at night.",
    },
    // 回答から抽出した日本語のメモ値（実APIではGPT-4oが抽出・翻訳）
    mockValues: {
      allergy: '薬・食物ともにアレルギーはなし',
      history: '高血圧で近所の病院に通院中',
      fever: '熱はない',
      travel: '海外渡航なし',
      family: '同居家族に同様の症状なし',
      pain_onset: '急ではなく、だんだん痛くなった',
      pain_provoke: '体を動かすと少し強くなる',
      pain_quality: 'ズキズキする拍動性の痛み',
      pain_region: '後頭部。首のあたりにも少し',
      pain_severity: '10段階で6程度',
      pain_timing: 'ずっと続き、夜に強くなる',
    },
  },
];

// ---------- モック用の日本語→各言語 辞書 ----------
// 実APIではGPT-4oが翻訳するため、モック（APIキー未設定）時のみ使用する。
// 英語デモで表示される追加質問・ラベル・案内文を網羅。
const MOCK_I18N = {
  en: {
    // 追加質問（コア）
    '薬や食べ物で、アレルギーはありますか？': 'Do you have any allergies to medicines or foods?',
    'これまでにかかった大きな病気や、通院中の持病はありますか？': 'Have you had any major illnesses, or do you have any ongoing medical conditions?',
    '熱はありますか？ある場合は、何度くらいですか？': 'Do you have a fever? If so, what is your temperature?',
    '最近2週間以内に、海外へ行かれましたか？': 'Have you traveled abroad within the last two weeks?',
    '一緒に住んでいるご家族で、同じような症状の方はいますか？': 'Is anyone living with you having similar symptoms?',
    // 追加質問（痛み系）
    'その痛みは、急に始まりましたか？それともだんだんですか？': 'Did the pain start suddenly, or gradually?',
    'どんな時に痛みが強くなったり、楽になったりしますか？': 'When does the pain get worse or better?',
    'どんな痛みですか？（ズキズキ／鈍い／刺すような など）': 'What kind of pain is it? (throbbing / dull / stabbing, etc.)',
    'どこが痛みますか？他の場所に広がる感じはありますか？': 'Where does it hurt? Does it spread anywhere else?',
    '痛みの強さは10段階でどのくらいですか？（10が最も強い）': 'On a scale of 1 to 10, how strong is the pain? (10 is the strongest)',
    '痛みはずっと続きますか？波がありますか？': 'Is the pain constant, or does it come and go?',
    // ラベル
    'アレルギー': 'Allergies',
    '既往歴': 'Medical history',
    '発熱の有無': 'Fever',
    '海外渡航歴': 'Overseas travel',
    '同居家族の体調': "Household members' health",
    '発症のしかた': 'How it started',
    '増悪・軽快因子': 'Aggravating / relieving factors',
    '痛みの性質': 'Nature of the pain',
    '部位・放散': 'Location / radiation',
    '痛みの強さ': 'Pain intensity',
    '時間経過': 'Time course',
    // 案内文
    'もう少し具体的に教えていただけますか？': 'Could you tell me a little more specifically?',
    'マイクを押して、お答えください。': 'Press the microphone and answer.',
    'もう少し具体的に教えてください。わからない場合はそのままお話しください。': "Please tell me a bit more. If you're not sure, just say so.",
  },
};

// ---------- 初期化 ----------
window.addEventListener('DOMContentLoaded', () => {
  state.template = CLINIC_TEMPLATES[ACTIVE_CLINIC_ID];
  loadApiKey();
  applyClinicBranding();
  updateModeBadge();
  registerServiceWorker();
});

function applyClinicBranding() {
  const t = state.template;
  document.querySelectorAll('.clinic-name').forEach(el => { el.textContent = t.clinicName; });
  setText('clinic-dept', t.department);
  setText('opening-prompt', t.openingPrompt);
}

// アクティブな画面内の要素を取得（mic等は画面ごとに重複するためクラスで絞る）
function activeEl(selector) {
  const screen = document.querySelector('.screen.active');
  return screen ? screen.querySelector(selector) : null;
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(err => {
      console.log('Service Worker登録失敗:', err);
    });
  }
}

// ---------- 画面切替 ----------
function showScreen(screenName) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const target = document.getElementById('screen-' + screenName);
  if (target) target.classList.add('active');
  if (screenName === 'history') renderHistory();
  if (screenName === 'settings') {
    document.getElementById('apikey-input').value = state.apiKey || '';
  }
}

// ---------- APIキー管理 ----------
function loadApiKey() {
  state.apiKey = localStorage.getItem('openai_api_key') || null;
}

function saveApiKey() {
  const input = document.getElementById('apikey-input').value.trim();
  if (input) {
    localStorage.setItem('openai_api_key', input);
    state.apiKey = input;
    showToast('APIキーを保存しました');
  } else {
    showToast('APIキーを入力してください');
  }
  updateModeBadge();
}

function clearApiKey() {
  localStorage.removeItem('openai_api_key');
  state.apiKey = null;
  document.getElementById('apikey-input').value = '';
  showToast('APIキーを削除しました');
  updateModeBadge();
}

function updateModeBadge() {
  const badge = document.getElementById('mode-badge');
  const modeText = document.getElementById('current-mode');
  if (state.apiKey) {
    if (badge) { badge.textContent = '本番API'; badge.className = 'mode-badge api'; }
    if (modeText) modeText.textContent = '🟢 OpenAI API';
  } else {
    if (badge) { badge.textContent = 'モック'; badge.className = 'mode-badge mock'; }
    if (modeText) modeText.textContent = '🟡 モック動作';
  }
}

// ============================================
// 問診フロー
// ============================================

// ---------- ① 問診開始（自由発話） ----------
function startInterview() {
  state.activeItems = [];
  state.memoData = {};
  state.queue = [];
  state.currentItem = null;
  state.fullTranscript = '';
  state._mockPattern = null;
  state.patientLang = null;
  state.patientLangName = '';
  state._i18nCache = {};
  state.recordingHandler = handleInitialAudio;
  showScreen('recording');
  resetRecording();
}

// ---------- ② 録音まわり（汎用） ----------
function resetRecording() {
  state.isRecording = false;
  state.audioChunks = [];
  state.audioBlob = null;
  const mic = activeEl('.mic-button');
  if (mic) { mic.classList.remove('recording'); mic.innerHTML = '🎤'; }
  const timer = activeEl('.recording-timer');
  if (timer) timer.style.display = 'none';
  const wave = activeEl('.wave-bars');
  if (wave) wave.style.display = 'none';
}

async function toggleRecording() {
  if (state.isRecording) {
    stopRecording();
  } else {
    await beginRecording();
  }
}

async function beginRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true }
    });

    let mimeType = 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    }

    state.mediaRecorder = new MediaRecorder(stream, { mimeType });
    state.audioChunks = [];

    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) state.audioChunks.push(e.data);
    };

    state.mediaRecorder.onstop = () => {
      state.audioBlob = new Blob(state.audioChunks, { type: mimeType });
      stream.getTracks().forEach(track => track.stop());
      if (typeof state.recordingHandler === 'function') {
        state.recordingHandler(state.audioBlob);
      }
    };

    state.mediaRecorder.start();
    state.isRecording = true;
    state.recordingStartTime = Date.now();

    const mic = activeEl('.mic-button');
    if (mic) { mic.classList.add('recording'); mic.innerHTML = '⏸'; }
    const timer = activeEl('.recording-timer');
    if (timer) timer.style.display = 'block';
    const wave = activeEl('.wave-bars');
    if (wave) wave.style.display = 'flex';

    state.recordingTimerId = setInterval(updateTimer, 100);
  } catch (err) {
    console.error('録音開始エラー:', err);
    if (err.name === 'NotAllowedError') {
      alert('マイクへのアクセスが許可されていません。\nブラウザの設定でマイクを許可してください。');
    } else {
      alert('録音を開始できませんでした: ' + err.message);
    }
    showScreen('start');
  }
}

function stopRecording() {
  if (state.mediaRecorder && state.isRecording) {
    state.mediaRecorder.stop();
    state.isRecording = false;
    clearInterval(state.recordingTimerId);
  }
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - state.recordingStartTime) / 1000);
  const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');
  const timer = activeEl('.recording-timer');
  if (timer) timer.textContent = `${m}:${s}`;
}

// ---------- ③ 最初の発話を処理 ----------
async function handleInitialAudio(audioBlob) {
  showScreen('loading');
  setLoadingText('お話を聞き取っています', '音声を文字に変換中...');
  try {
    // 文字起こし（言語は自動検出 → state.patientLang に保存される）
    const originalTranscript = await transcribeAudio(audioBlob);
    state.originalTranscript = originalTranscript;

    // 日本語以外なら日本語へ翻訳（以降の処理・メモはすべて日本語で行う）
    let jaTranscript = originalTranscript;
    if (!isJapaneseLang()) {
      setLoadingText('日本語に翻訳しています', `${state.patientLangName} → 日本語`);
      jaTranscript = await translateToJapanese(originalTranscript);
    }
    state.fullTranscript = jaTranscript;

    // 主訴別グループの判定（日本語化した発話にキーワードが含まれるか）
    buildActiveItems(jaTranscript);

    setLoadingText('内容を整理しています', '不足している項目を確認中...');
    const filled = await analyzeInitial(jaTranscript, state.activeItems);

    // 結果を memoData に反映し、不足項目を queue に積む
    state.queue = [];
    state.activeItems.forEach(item => {
      const v = filled[item.key];
      if (v && String(v).trim() && !isUnknown(v)) {
        state.memoData[item.key] = String(v).trim();
      } else {
        state.queue.push(item);
      }
    });

    startFollowup();
  } catch (err) {
    console.error('処理エラー:', err);
    alert('処理中にエラーが発生しました:\n' + err.message);
    showScreen('start');
  }
}

function buildActiveItems(transcript) {
  const t = state.template;
  const items = [...t.coreItems];
  t.conditionalGroups.forEach(group => {
    if (group.match.some(kw => transcript.includes(kw))) {
      group.items.forEach(it => items.push(it));
    }
  });
  state.activeItems = items;
}

// ---------- ④ 不足項目を1つずつ追加質問 ----------
function startFollowup() {
  updateProgress();
  if (state.queue.length === 0) {
    finishInterview();
    return;
  }
  askNextItem();
}

async function askNextItem() {
  state.currentItem = state.queue.shift();
  state.attemptCount = 0;
  state.recordingHandler = handleFollowupAudio;
  // 翻訳中はローディング表示（日本語の場合は即時なのでほぼ表示されない）
  if (!isJapaneseLang()) {
    setLoadingText('質問を準備しています', `日本語 → ${state.patientLangName}`);
    showScreen('followup-loading');
  }
  await renderFollowupQuestion(state.currentItem.question, false);
  showScreen('followup');
  resetRecording();
  updateProgress();
}

// 質問・ラベル・案内文を患者の言語に翻訳して表示する（日本語話者はそのまま）
async function renderFollowupQuestion(questionJa, isReprompt) {
  const hintJa = isReprompt
    ? 'もう少し具体的に教えてください。わからない場合はそのままお話しください。'
    : 'マイクを押して、お答えください。';
  const [label, question, hint] = await Promise.all([
    localizeForPatient(state.currentItem.label),
    localizeForPatient(questionJa),
    localizeForPatient(hintJa),
  ]);
  setText('followup-label', label);
  setText('followup-question', question);
  const hintEl = document.getElementById('followup-hint');
  if (hintEl) hintEl.textContent = hint;
}

function updateProgress() {
  const total = state.activeItems.length;
  const answered = state.activeItems.filter(it => state.memoData[it.key]).length;
  const bar = document.getElementById('progress-fill');
  const txt = document.getElementById('progress-text');
  if (bar) bar.style.width = total ? `${Math.round((answered / total) * 100)}%` : '0%';
  if (txt) txt.textContent = `${answered} / ${total} 項目`;
}

async function handleFollowupAudio(audioBlob) {
  showScreen('followup-loading');
  try {
    const answer = await transcribeAudio(audioBlob, state.currentItem);
    const value = await evaluateAnswer(state.currentItem, answer);

    if (value && !isUnknown(value)) {
      state.memoData[state.currentItem.key] = String(value).trim();
      askOrFinish();
    } else {
      state.attemptCount++;
      if (state.attemptCount < MAX_FOLLOWUP_ATTEMPTS) {
        // もう1回だけ聞き直す
        state.recordingHandler = handleFollowupAudio;
        await renderFollowupQuestion('もう少し具体的に教えていただけますか？', true);
        showScreen('followup');
        resetRecording();
      } else {
        // 2回試して埋まらなければ「不明」で記録し次へ
        state.memoData[state.currentItem.key] = '不明';
        askOrFinish();
      }
    }
  } catch (err) {
    console.error('回答処理エラー:', err);
    // 失敗時は不明扱いにして進める（デモを止めない）
    state.memoData[state.currentItem.key] = '不明';
    askOrFinish();
  }
}

function askOrFinish() {
  updateProgress();
  if (state.queue.length === 0) {
    finishInterview();
  } else {
    askNextItem();
  }
}

// 質問をスキップ（患者が答えたくない場合）
function skipCurrentItem() {
  if (!state.currentItem) return;
  state.memoData[state.currentItem.key] = '不明';
  askOrFinish();
}

// ---------- ⑤ メモ確定 ----------
function finishInterview() {
  const items = state.activeItems.map(it => ({
    key: it.key, label: it.label, icon: it.icon || '•',
    value: state.memoData[it.key] || '不明',
    highlight: !!it.highlight,
  }));
  // 日本語以外で話した場合は、原文の言語を先頭に明記（受付・医師向け）
  if (!isJapaneseLang()) {
    items.unshift({
      key: '_sourceLang', label: '使用言語（原文）', icon: '🌐',
      value: `${state.patientLangName}（自動検出 → 日本語に翻訳済み）`,
      highlight: true,
    });
  }
  state.currentMemo = {
    clinicId: state.template.clinicId,
    clinicName: state.template.clinicName,
    items,
    transcript: state.fullTranscript,          // 日本語（受付・医師が読む）
    originalTranscript: state.originalTranscript || '', // 患者が話した原文
    sourceLang: state.patientLang || 'ja',
    sourceLangName: state.patientLangName || '日本語',
    createdAt: new Date().toISOString(),
  };
  renderMemo();
  showScreen('memo');
}

function renderMemo() {
  const memo = state.currentMemo;
  const date = new Date(memo.createdAt);
  setText('memo-date', formatDate(date));
  setText('memo-clinic', memo.clinicName);

  const list = document.getElementById('memo-list');
  list.innerHTML = '';
  memo.items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'memo-item' + (item.highlight ? ' highlight' : '');
    li.onclick = () => openEditModal(item.key, item.label, item.value);
    li.innerHTML = `
      <div class="memo-item-icon">${item.icon}</div>
      <div class="memo-item-body">
        <div class="memo-item-label">${escapeHtml(item.label)}</div>
        <div class="memo-item-value">${escapeHtml(item.value || '不明')}</div>
      </div>`;
    list.appendChild(li);
  });
}

// ---------- 編集モーダル ----------
function openEditModal(key, label, currentValue) {
  state.editingItemKey = key;
  setText('modal-title', label + ' を編集');
  document.getElementById('modal-input').value = (currentValue === '不明') ? '' : (currentValue || '');
  document.getElementById('modal-edit').classList.add('active');
  setTimeout(() => document.getElementById('modal-input').focus(), 100);
}

function closeEditModal() {
  document.getElementById('modal-edit').classList.remove('active');
  state.editingItemKey = null;
}

function saveEditModal() {
  const value = document.getElementById('modal-input').value.trim();
  if (state.editingItemKey && state.currentMemo) {
    const item = state.currentMemo.items.find(i => i.key === state.editingItemKey);
    if (item) item.value = value || '不明';
    state.memoData[state.editingItemKey] = value || '不明';
    renderMemo();
    closeEditModal();
    showToast('変更を保存しました');
  } else {
    closeEditModal();
  }
}

// ---------- ⑥ QRコード生成 ----------
function showQR() {
  // 履歴にも保存しておく
  saveMemo(true);

  const payload = buildQRPayload(state.currentMemo);
  const json = JSON.stringify(payload);
  const compressed = LZString.compressToEncodedURIComponent(json);

  const container = document.getElementById('qrcode');
  container.innerHTML = '';

  // QRに直接データを埋め込む（デモはサーバー不要方式）
  const len = compressed.length;
  const level = len < 700 ? 'M' : 'L';
  try {
    new QRCode(container, {
      text: compressed,
      width: 280,
      height: 280,
      correctLevel: QRCode.CorrectLevel[level],
    });
    setText('qr-size-note', `データ量: ${len} 文字`);
  } catch (e) {
    container.innerHTML = '<p style="color:#E55353;padding:20px;">QRの生成に失敗しました。メモの文字数が多すぎる可能性があります。項目を短く編集してください。</p>';
    console.error(e);
  }

  setText('qr-clinic', state.currentMemo.clinicName);
  showScreen('qr');
}

// QRに入れるデータ（受付アプリが解釈する形式）
function buildQRPayload(memo) {
  return {
    v: 1,                         // フォーマットバージョン
    c: memo.clinicId,             // クリニックID
    cn: memo.clinicName,          // クリニック名
    t: memo.createdAt,            // 作成日時
    // ラベルと値の配列（受付側で表示）
    items: memo.items.map(i => [i.label, i.value, i.highlight ? 1 : 0]),
  };
}

// ============================================
// OpenAI API 呼び出し（キー未設定時はモック）
// ============================================

// ---------- Whisper（文字起こし＋言語自動検出） ----------
// language は固定せず、Whisperに言語を自動検出させる。
// 初回の発話で検出した言語を state.patientLang に保存する。
async function transcribeAudio(audioBlob, item) {
  if (!state.apiKey) {
    await sleep(1500);
    if (state.recordingHandler === handleInitialAudio || !state._mockPattern) {
      // 初回：モックパターンを1つ選ぶ
      const p = MOCK_PATTERNS[Math.floor(Math.random() * MOCK_PATTERNS.length)];
      state._mockPattern = p;
      setDetectedLang(p.lang || 'japanese');
      return p.transcript;
    }
    // 追加質問への回答（モック）
    if (item && state._mockPattern.mockAnswers[item.key]) {
      return state._mockPattern.mockAnswers[item.key];
    }
    return state.patientLang === 'en' ? "I'm not sure." : 'わかりません';
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'whisper-1');
  // language は指定しない（Whisperが話者の言語を自動検出する）
  formData.append('response_format', 'verbose_json'); // 検出言語を取得するため

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${state.apiKey}` },
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`Whisper API エラー: ${response.status} - ${await response.text()}`);
  }
  const result = await response.json();
  // 初回の発話で検出した言語を保存（追加質問もこの言語で表示する）
  if (!state.patientLang && result.language) {
    setDetectedLang(result.language);
  }
  return result.text;
}

// 検出した言語を state に反映する
function setDetectedLang(whisperLangName) {
  const info = resolveLang(whisperLangName);
  state.patientLang = info.code;
  state.patientLangName = info.native;
}

// ---------- 患者の発話を日本語に翻訳（メモは常に日本語で作る） ----------
async function translateToJapanese(text) {
  if (!text || isJapaneseLang()) return text;

  if (!state.apiKey) {
    await sleep(800);
    // モック：パターンに用意した日本語訳を返す
    return (state._mockPattern && state._mockPattern.jaTranscript) || text;
  }

  const systemPrompt = `あなたは医療通訳です。患者が話した内容を、意味を変えずに自然な日本語へ翻訳してください。
- 症状・時間・数値・固有名詞は省略せず正確に訳す。
- 要約・解釈・診断はしない。話された情報だけを日本語にする。
- 翻訳文のみを出力する（前置きや注釈は不要）。`;

  try {
    const result = await chatCompletion(systemPrompt, `患者の発話:\n「${text}」`, false);
    return (result || text).trim();
  } catch (err) {
    console.error('日本語翻訳エラー:', err);
    return text; // 翻訳失敗時は原文のまま進める（フローを止めない）
  }
}

// ---------- AIの質問・案内文を患者の言語に翻訳して表示 ----------
// 日本語話者にはそのまま日本語を返す。翻訳結果はキャッシュする。
async function localizeForPatient(jaText) {
  if (!jaText || isJapaneseLang()) return jaText;
  if (state._i18nCache[jaText]) return state._i18nCache[jaText];

  let translated;
  if (!state.apiKey) {
    // モック：辞書から引く（無ければ原文のまま）
    const dict = MOCK_I18N[state.patientLang] || {};
    translated = dict[jaText] || jaText;
  } else {
    const systemPrompt = `あなたは医療通訳です。医療機関の問診アプリに表示する文を、${state.patientLangName}（言語コード: ${state.patientLang}）へ自然に翻訳してください。
- 患者にやさしく丁寧な口調にする。
- 医療用語は分かりやすく訳す。
- 翻訳文のみを出力する（注釈や原文は不要）。`;
    try {
      translated = (await chatCompletion(systemPrompt, jaText, false) || jaText).trim();
    } catch (err) {
      console.error('質問翻訳エラー:', err);
      translated = jaText; // 翻訳失敗時は日本語のまま表示（フローを止めない）
    }
  }
  state._i18nCache[jaText] = translated;
  return translated;
}

// ---------- Chat Completions 共通ヘルパー ----------
// jsonMode=true のとき response_format を json_object にする。
async function chatCompletion(systemPrompt, userContent, jsonMode) {
  const body = {
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: 0.2,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${state.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`GPT-4o API エラー: ${response.status} - ${await response.text()}`);
  }
  const result = await response.json();
  return result.choices[0].message.content;
}

// ---------- 初回発話の分析（どの項目が埋まっているか） ----------
async function analyzeInitial(transcript, items) {
  if (!state.apiKey) {
    await sleep(1500);
    return (state._mockPattern && state._mockPattern.filled) || {};
  }

  const itemList = items.map(i => `- ${i.key}: ${i.label}（${i.question}）`).join('\n');
  const systemPrompt = `あなたは医療事前問診の補助AIです。患者の最初の自由な発話から、以下の問診項目それぞれについて、発話内で語られている情報を抽出します。

【問診項目】
${itemList}

【ルール】
- 各項目について、発話から読み取れる内容を「医師が読んで分かる必要十分な文」でまとめる。単語ではなく具体的に。
- 数値・固有名詞・時間表現（「38.5度」「昨夜21時ごろ」など）はそのまま残す。
- 発話内に該当する情報が無い項目は、値を null にする（推測で埋めない）。
- 診断・治療の提案はしない。患者の言葉を尊重する。
- 抽出する値は、患者が何語で話していても【必ず日本語】で記述する。

【出力】
キーを項目key、値を抽出文字列または null とする JSON オブジェクトのみを返す。`;

  const content = await chatCompletion(systemPrompt, `患者の発話:\n「${transcript}」`, true);
  return JSON.parse(content);
}

// ---------- 追加質問への回答を評価して値を抽出 ----------
async function evaluateAnswer(item, answerTranscript) {
  if (!state.apiKey) {
    await sleep(1000);
    // モック（多言語）：用意した日本語の抽出値を返す
    if (state._mockPattern && state._mockPattern.mockValues && state._mockPattern.mockValues[item.key]) {
      return state._mockPattern.mockValues[item.key];
    }
    // モック（日本語）：回答がそのまま値になる（「わかりません」系は null）
    if (/わかりません|わからない|不明|not sure|don't know/i.test(answerTranscript)) return null;
    return answerTranscript;
  }

  const systemPrompt = `あなたは医療事前問診の補助AIです。
問診項目「${item.label}」について、AIが「${item.question}」と質問し、患者が音声で回答しました。
その回答から、この項目に記載すべき内容を抽出してください。

【ルール】
- 回答が項目に答えている場合：医師が読んで分かる必要十分な文で value にまとめる（数値や固有名詞は残す）。「特にない」旨ならその内容（例:「特になし」）を value に入れる。
- 回答が質問に答えていない／「わからない」等で内容が不明な場合：value を null にする。
- 推測で補わない。診断・治療提案はしない。
- value は、患者が何語で答えても【必ず日本語】で記述する。

【出力】 {"value": 文字列 または null} の JSON のみ。`;

  const content = await chatCompletion(systemPrompt, `患者の回答:\n「${answerTranscript}」`, true);
  const parsed = JSON.parse(content);
  return parsed.value;
}

// ============================================
// 履歴
// ============================================
function saveMemo(silent) {
  if (!state.currentMemo) return;
  const history = JSON.parse(localStorage.getItem('memo_history') || '[]');
  // 同一メモの二重保存を避ける
  if (!history.some(h => h.createdAt === state.currentMemo.createdAt)) {
    history.unshift({ ...state.currentMemo, id: Date.now().toString() });
    if (history.length > 50) history.length = 50;
    localStorage.setItem('memo_history', JSON.stringify(history));
  }
  if (!silent) showToast('メモを保存しました');
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem('memo_history') || '[]');
  const container = document.getElementById('history-container');
  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div>まだメモがありません</div>
      </div>`;
    return;
  }
  const list = document.createElement('ul');
  list.className = 'history-list';
  history.forEach(memo => {
    const chief = (memo.items && memo.items[0] && memo.items[0].value) || '無題';
    const li = document.createElement('li');
    li.className = 'history-item';
    li.onclick = () => { state.currentMemo = memo; renderMemo(); showScreen('memo'); };
    li.innerHTML = `
      <div class="history-item-date">${formatDate(new Date(memo.createdAt))}</div>
      <div class="history-item-title">${escapeHtml(chief)}</div>
      <div class="history-item-preview">${escapeHtml(memo.clinicName || '')}</div>`;
    list.appendChild(li);
  });
  container.innerHTML = '';
  container.appendChild(list);
}

function clearHistory() {
  if (confirm('全ての履歴を削除します。よろしいですか？')) {
    localStorage.removeItem('memo_history');
    showToast('履歴を削除しました');
  }
}

// ============================================
// ユーティリティ
// ============================================
function isUnknown(v) {
  return ['不明', '聞き取れず', 'null', 'なし', '特になし'].includes(String(v).trim());
}

function formatDate(date) {
  return `${date.getFullYear()}/${(date.getMonth()+1).toString().padStart(2,'0')}/${date.getDate().toString().padStart(2,'0')} ` +
         `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
}

function setLoadingText(title, sub) {
  setText('loading-text', title);
  setText('loading-sub', sub);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
