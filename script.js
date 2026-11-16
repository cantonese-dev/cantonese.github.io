// cantonese — playground and page behaviour. No dependencies.
'use strict';

const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ───────────────────────────── settings

const DEFAULTS = {
  endpoint: 'http://127.0.0.1:8888/v1/audio/speech',
  apiKey: '',
  model: '',
  format: 'mp3',
  seed: '',
  language: '',
  maxDuration: '',
  stream: false,
};
const STORE = 'cantonese-settings';

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}
let settings = loadSettings();

function saveSettings(next) {
  settings = { ...DEFAULTS, ...next };
  try {
    localStorage.setItem(STORE, JSON.stringify(settings));
  } catch {}
}

// http://host:8888/v1/audio/speech -> http://host:8888/v1 (models, voices live next to it)
function apiBase(endpoint) {
  const trimmed = endpoint.replace(/\/+$/, '');
  if (/\/audio\/speech$/.test(trimmed)) return trimmed.replace(/\/audio\/speech$/, '');
  try {
    return new URL(endpoint).origin + '/v1';
  } catch {
    return trimmed;
  }
}

function authHeaders(s = settings) {
  return s.apiKey ? { Authorization: 'Bearer ' + s.apiKey } : {};
}

function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(label || 'Copied');
}

// ───────────────────────────── connection status

async function fetchJson(url, s, timeoutMs = 4000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: authHeaders(s), signal: ctl.signal });
    const data = await res.json().catch(() => null);
    return { res, data };
  } finally {
    clearTimeout(timer);
  }
}

// Why a request to the endpoint cannot even leave the browser, in words.
function unreachableReason(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return 'That endpoint is not a valid URL. Open Settings to fix it.';
  }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (location.protocol === 'https:' && url.protocol === 'http:' && !local) {
    return 'This page is served over HTTPS, and browsers block plain http:// requests to other machines. Use an https:// endpoint (a tunnel or gateway), or open this page from your own machine.';
  }
  if (local) {
    return 'If the server is running, your browser may be asking for permission to reach devices on your local network: allow it for this site. Safari blocks local servers from HTTPS pages altogether.';
  }
  return 'Check the address, that the server is running, and that it allows requests from web pages (CORS).';
}

// { ok, label, detail, voices[] }
async function probe(s = settings) {
  const base = apiBase(s.endpoint);
  try {
    const { res, data } = await fetchJson(base + '/models', s);
    if (res.status === 401 || res.status === 403) return { ok: false, label: 'key rejected', detail: 'The server answered, but refused the API key. Set it in Settings.' };
    if (!res.ok) return { ok: false, label: 'error ' + res.status, detail: `The server answered ${res.status} for ${base}/models.` };
    const model = data && Array.isArray(data.data) ? data.data[0] : null;
    const isTts = !!(model && model.meta && model.meta.type === 'tts');
    let voices = [];
    try {
      const v = await fetchJson(base + '/audio/voices', s, 2500);
      if (v.res.ok && v.data && Array.isArray(v.data.data)) voices = v.data.data.map((x) => x.name || x.id).filter(Boolean);
    } catch {}
    return {
      ok: true,
      label: model ? String(model.id) : 'connected',
      detail: model && !isTts ? 'Connected, but the model there does not look like a speech model.' : '',
      voices,
    };
  } catch {
    return { ok: false, label: 'offline', detail: unreachableReason(s.endpoint) };
  }
}

async function refreshConnection() {
  $('endpoint-label').textContent = settings.endpoint;
  const conn = $('conn');
  conn.className = 'conn';
  $('conn-text').textContent = 'checking';
  const state = await probe();
  conn.className = 'conn ' + (state.ok ? 'ok' : 'bad');
  $('conn-text').textContent = state.label.length > 28 ? state.label.slice(0, 27) + '…' : state.label;
  conn.title = state.ok ? `Connected to ${settings.endpoint}` : `Cannot reach ${settings.endpoint}`;
  $('offline').hidden = state.ok;
  $('offline-detail').textContent = state.ok ? '' : state.detail;

  const select = $('saved-voice');
  const current = select.value;
  select.length = 1;
  for (const name of state.voices || []) select.add(new Option(name, name));
  select.value = (state.voices || []).includes(current) ? current : '';
  $('saved-wrap').hidden = !(state.voices || []).length;
  return state;
}

// ───────────────────────────── settings dialog

const dlg = $('dlg-settings');
const form = $('settings-form');

function fillSettingsForm(s) {
  form.endpoint.value = s.endpoint;
  form.apiKey.value = s.apiKey;
  form.model.value = s.model;
  form.format.value = s.format;
  form.seed.value = s.seed;
  form.language.value = s.language;
  form.maxDuration.value = s.maxDuration;
  form.stream.checked = !!s.stream;
  $('test-result').textContent = '';
  $('test-result').className = 'status';
}

function readSettingsForm() {
  return {
    endpoint: form.endpoint.value.trim() || DEFAULTS.endpoint,
    apiKey: form.apiKey.value.trim(),
    model: form.model.value.trim(),
    format: form.format.value,
    seed: form.seed.value.trim(),
    language: form.language.value.trim(),
    maxDuration: form.maxDuration.value.trim(),
    stream: form.stream.checked,
  };
}

function openSettings() {
  fillSettingsForm(settings);
  dlg.showModal();
}
$('btn-settings').addEventListener('click', openSettings);
$$('[data-open-settings]').forEach((b) => b.addEventListener('click', openSettings));
$$('[data-close]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close()));
dlg.addEventListener('click', (e) => {
  if (e.target === dlg) dlg.close(); // click on the backdrop
});

$('btn-reset').addEventListener('click', () => fillSettingsForm(DEFAULTS));

$('btn-test').addEventListener('click', async () => {
  const out = $('test-result');
  out.className = 'status spin';
  out.textContent = 'Connecting…';
  const state = await probe(readSettingsForm());
  out.className = 'status ' + (state.ok ? 'ok' : 'bad');
  out.textContent = state.ok ? `Connected: ${state.label}${state.detail ? ' — ' + state.detail : ''}` : state.detail;
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const next = readSettingsForm();
  try {
    new URL(next.endpoint);
  } catch {
    $('test-result').className = 'status bad';
    $('test-result').textContent = 'The endpoint is not a valid URL.';
    return;
  }
  saveSettings(next);
  dlg.close();
  toast('Settings saved');
  refreshConnection();
});

// ───────────────────────────── playground

const textEl = $('tts-text');
const player = $('player');
let controller = null;
let lastRequest = null;
const takes = []; // { text, url, label }

function updateCount() {
  $('count').textContent = [...textEl.value].length + ' chars';
}
textEl.addEventListener('input', updateCount);
updateCount();

$('samples').addEventListener('click', (e) => {
  if (!e.target.matches('.chip')) return;
  textEl.value = e.target.textContent;
  updateCount();
  textEl.focus();
});
$('presets').addEventListener('click', (e) => {
  if (e.target.matches('.chip')) $('voice-desc').value = e.target.textContent;
});

const mode = () => document.querySelector('input[name="mode"]:checked').value;
$$('input[name="mode"]').forEach((r) =>
  r.addEventListener('change', () => {
    $$('.mode-panel').forEach((p) => (p.hidden = p.dataset.mode !== mode()));
  })
);

$('ref-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  const preview = $('ref-preview');
  if (preview.src) URL.revokeObjectURL(preview.src);
  preview.hidden = !file;
  if (file) {
    preview.src = URL.createObjectURL(file);
    $('saved-voice').value = '';
  }
});

function setStatus(text, cls = '') {
  const el = $('status');
  el.className = 'status ' + cls;
  el.textContent = text;
}

// The request as the playground will send it: { fields, file } - JSON unless a recording is attached.
function buildRequest() {
  const text = textEl.value.trim();
  if (!text) throw new Error('Type something to say first.');
  const fields = {};
  if (settings.model) fields.model = settings.model;
  fields.input = text;
  let file = null;

  const m = mode();
  if (m === 'design') {
    const desc = $('voice-desc').value.trim();
    if (!desc) throw new Error('Describe the voice, or switch to Default.');
    fields.voice = desc;
  } else if (m === 'clone') {
    const saved = $('saved-voice').value;
    file = $('ref-file').files[0] || null;
    if (saved && !file) {
      fields.voice = saved;
    } else if (file) {
      if (file.size > 20 * 1024 * 1024) throw new Error('That recording is over 20 MB. A short clip of 5–15 seconds is enough.');
      const transcript = $('ref-text').value.trim();
      if (transcript) fields.reference_text = transcript;
    } else {
      throw new Error('Choose a recording of the voice to clone.');
    }
  }

  fields.response_format = settings.format;
  if ($('opt-random').checked) fields.seed = -1;
  else if (settings.seed !== '') fields.seed = Number(settings.seed);
  if (settings.language) fields.language = settings.language;
  if (settings.maxDuration !== '') fields.max_duration = Number(settings.maxDuration);
  // a streamed WAV has no length in its header, which players dislike: stream MP3 only
  if (settings.stream && settings.format === 'mp3') fields.stream = true;
  return { fields, file };
}

const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

function asCurl({ fields, file }) {
  const lines = [`curl ${shq(settings.endpoint)}`];
  if (settings.apiKey) lines.push('  -H "Authorization: Bearer $API_KEY"');
  if (file) {
    for (const [k, v] of Object.entries(fields)) lines.push(`  -F ${shq(k + '=' + v)}`);
    lines.push(`  -F ${shq('reference_audio=@' + file.name)}`);
  } else {
    lines.push('  -H "Content-Type: application/json"');
    lines.push(`  -d ${shq(JSON.stringify(fields))}`);
  }
  lines.push(`  --output speech.${fields.response_format}`);
  return lines.join(' \\\n');
}

function fmtSeconds(s) {
  return Number.isFinite(s) ? s.toFixed(s < 10 ? 2 : 1) + ' s' : '–';
}
function fmtBytes(n) {
  return n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
}

function showMeta(items) {
  $('meta').innerHTML = '';
  for (const [k, v] of items) {
    const div = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = k;
    dd.textContent = v;
    div.append(dt, dd);
    $('meta').append(div);
  }
}

function renderHistory() {
  const list = $('history');
  list.innerHTML = '';
  takes.slice(1).forEach((take) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '▶';
    btn.setAttribute('aria-label', 'Play this take');
    btn.addEventListener('click', () => {
      player.src = take.url;
      player.play().catch(() => {});
    });
    const text = document.createElement('span');
    text.className = 'h-text';
    text.lang = 'zh-HK';
    text.textContent = take.text;
    const meta = document.createElement('span');
    meta.className = 'h-meta';
    meta.textContent = take.label;
    li.append(btn, text, meta);
    list.append(li);
  });
}

// Plays an MP3 response while it is still arriving. Resolves false if the browser cannot.
function streamingPlayer(audio) {
  const MS = window.ManagedMediaSource || window.MediaSource;
  if (!MS || !MS.isTypeSupported || !MS.isTypeSupported('audio/mpeg')) return null;
  const ms = new MS();
  const queue = [];
  let sb = null;
  let ended = false;
  let failed = false;
  const pump = () => {
    if (!sb || sb.updating || failed) return;
    try {
      if (queue.length) sb.appendBuffer(queue.shift());
      else if (ended && ms.readyState === 'open') ms.endOfStream();
    } catch {
      failed = true;
    }
  };
  ms.addEventListener('sourceopen', () => {
    try {
      sb = ms.addSourceBuffer('audio/mpeg');
      sb.addEventListener('updateend', pump);
      pump();
    } catch {
      failed = true;
    }
  });
  if (window.ManagedMediaSource && ms instanceof window.ManagedMediaSource) audio.disableRemotePlayback = true;
  audio.src = URL.createObjectURL(ms);
  return {
    push(chunk) {
      queue.push(chunk);
      pump();
    },
    end() {
      ended = true;
      pump();
    },
    get failed() {
      return failed;
    },
  };
}

async function generate() {
  let request;
  try {
    request = buildRequest();
  } catch (e) {
    setStatus(e.message, 'bad');
    return;
  }
  lastRequest = request;

  const { fields, file } = request;
  const headers = authHeaders();
  let body;
  if (file) {
    body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.append(k, String(v));
    body.append('reference_audio', file, file.name);
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(fields);
  }

  controller = new AbortController();
  $('btn-go').disabled = true;
  $('btn-stop').hidden = false;
  setStatus('Generating…', 'spin');
  const t0 = performance.now();

  try {
    const res = await fetch(settings.endpoint, { method: 'POST', headers, body, signal: controller.signal });
    if (!res.ok) {
      let message = `The server answered ${res.status}.`;
      try {
        const err = await res.json();
        if (err && err.error && err.error.message) message = err.error.message;
      } catch {}
      if (res.status === 401 || res.status === 403) message += ' Check the API key in Settings.';
      throw new Error(message);
    }

    const type = (res.headers.get('content-type') || '').split(';')[0] || 'audio/mpeg';
    const live = fields.stream ? streamingPlayer(player) : null;
    if (live) {
      $('out-empty').hidden = true;
      $('out').hidden = false;
    }
    const reader = res.body.getReader();
    const chunks = [];
    let bytes = 0;
    let firstByte = null;
    let started = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (firstByte === null) firstByte = performance.now() - t0;
      chunks.push(value);
      bytes += value.length;
      if (live && !live.failed) {
        live.push(value);
        if (!started) {
          started = true;
          player.play().catch(() => {});
        }
      }
      setStatus(`Receiving audio… ${fmtBytes(bytes)}`, 'spin');
    }
    if (live) live.end();
    const total = performance.now() - t0;

    const blob = new Blob(chunks, { type });
    const url = URL.createObjectURL(blob);
    $('out-empty').hidden = true;
    $('out').hidden = false;
    if (!live || live.failed) {
      player.src = url;
      player.play().catch(() => {});
    }
    const ext = type.includes('wav') ? 'wav' : 'mp3';
    $('download').href = url;
    $('download').download = `cantonese-${Date.now()}.${ext}`;
    $('req-view').textContent = asCurl(request);

    // the duration comes from the finished file, not from a stream still being appended to
    const probeAudio = new Audio();
    probeAudio.preload = 'metadata';
    const cost = res.headers.get('x-gateway-cost-usd');
    const meta = (duration) => {
      const items = [['audio', fmtSeconds(duration)], ['took', fmtSeconds(total / 1000)], ['size', fmtBytes(bytes)]];
      if (fields.stream && firstByte !== null) items.push(['first audio', fmtSeconds(firstByte / 1000)]);
      if (cost !== null) items.push(['cost', '$' + cost]);
      showMeta(items);
    };
    meta(NaN);
    probeAudio.addEventListener('loadedmetadata', () => meta(probeAudio.duration));
    probeAudio.src = url;

    const label = mode() === 'clone' ? 'clone' : mode() === 'design' ? 'design' : 'default';
    takes.unshift({ text: fields.input, url, label: `${label} · ${fmtSeconds(total / 1000)}` });
    while (takes.length > 6) URL.revokeObjectURL(takes.pop().url);
    renderHistory();
    setStatus('Done in ' + fmtSeconds(total / 1000), 'ok');
  } catch (e) {
    if (e.name === 'AbortError') {
      setStatus('Stopped.');
    } else if (e instanceof TypeError) {
      // fetch() itself failed: the request never got an answer
      setStatus('Could not reach the server. ' + unreachableReason(settings.endpoint), 'bad');
      refreshConnection();
    } else {
      setStatus(e.message, 'bad');
    }
  } finally {
    controller = null;
    $('btn-go').disabled = false;
    $('btn-stop').hidden = true;
  }
}

$('play').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!controller) generate();
});
textEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('play').requestSubmit();
});
$('btn-stop').addEventListener('click', () => controller && controller.abort());
$('btn-copy-curl').addEventListener('click', () => lastRequest && copyText(asCurl(lastRequest), 'curl command copied'));
$('btn-retry').addEventListener('click', refreshConnection);

// ───────────────────────────── docs: runtime switch, tabs, copy buttons

function setRuntime(rt) {
  $$('.rt').forEach((el) => (el.textContent = rt));
  $$('.pkg').forEach((el) => (el.textContent = rt === 'gguf' ? 'gguf-core' : 'ggk'));
  const radio = document.querySelector(`input[name="runtime"][value="${rt}"]`);
  if (radio) radio.checked = true;
  try {
    localStorage.setItem('cantonese-runtime', rt);
  } catch {}
}
$$('input[name="runtime"]').forEach((r) => r.addEventListener('change', () => setRuntime(r.value)));
try {
  if (localStorage.getItem('cantonese-runtime') === 'gguf') setRuntime('gguf');
} catch {}

$$('.tabs button').forEach((tab) =>
  tab.addEventListener('click', () => {
    $$('.tabs button').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    $$('.examples [role="tabpanel"]').forEach((p) => (p.hidden = p.id !== tab.dataset.tab));
  })
);

$$('main pre').forEach((pre) => {
  if (pre.closest('.req') || pre.closest('.prompt-card')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'copy';
  btn.textContent = 'copy';
  btn.addEventListener('click', () => copyText(pre.querySelector('code').textContent, 'Copied'));
  pre.append(btn);
});

// ───────────────────────────── for agents

const guideUrl = new URL('llms-full.txt', location.href).href;
if (/^https?:/.test(location.protocol)) $$('.abs-guide').forEach((el) => (el.textContent = guideUrl));

$('btn-copy-prompt').addEventListener('click', () => copyText($('agent-prompt').textContent, 'Prompt copied'));
$('btn-copy-guide').addEventListener('click', async () => {
  try {
    const res = await fetch(guideUrl);
    if (!res.ok) throw new Error();
    await copyText(await res.text(), 'Guide copied: paste it into your agent');
  } catch {
    window.open(guideUrl, '_blank', 'noopener');
  }
});

// ───────────────────────────── theme

$('btn-theme').addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try {
    localStorage.setItem('cantonese-theme', root.dataset.theme);
  } catch {}
});

refreshConnection();
