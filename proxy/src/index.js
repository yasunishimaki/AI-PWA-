// ============================================
// AI事前問診メモ — OpenAI プロキシ (Cloudflare Worker)
// ============================================
// 患者アプリ → このWorker → OpenAI
// OpenAI APIキーはサーバー側の Secret (OPENAI_API_KEY) に保管し、
// クライアント（公開URL）には一切埋め込まない。
//
// エンドポイント:
//   POST /api/transcribe  … Whisper（音声→文字 + 言語自動検出）へ中継
//   POST /api/chat        … GPT-4o（要約・翻訳・抽出）へ中継
//
// 設定（wrangler）:
//   npx wrangler secret put OPENAI_API_KEY   … 必須
//   npx wrangler secret put APP_TOKEN        … 任意（合言葉。設定すると x-app-token 必須に）
//   vars: ALLOWED_ORIGINS = "https://<user>.github.io" （CORS許可。"*" も可）
// ============================================

const OPENAI_BASE = 'https://api.openai.com/v1';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    // プリフライト
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, cors);
    }

    // 簡易アクセス制御（合言葉）。APP_TOKEN 未設定なら無効。
    if (env.APP_TOKEN) {
      if (request.headers.get('x-app-token') !== env.APP_TOKEN) {
        return json({ error: 'Unauthorized' }, 401, cors);
      }
    }
    if (!env.OPENAI_API_KEY) {
      return json({ error: 'Server is not configured (OPENAI_API_KEY missing)' }, 500, cors);
    }

    try {
      if (url.pathname === '/api/transcribe') {
        // multipart をそのまま中継（language は指定せず自動検出、response_format はクライアント指定）
        const upstream = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
            'Content-Type': request.headers.get('Content-Type') || 'multipart/form-data',
          },
          body: request.body,
        });
        return passthrough(upstream, cors);
      }

      if (url.pathname === '/api/chat') {
        const bodyText = await request.text();
        const upstream = await fetch(`${OPENAI_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: bodyText,
        });
        return passthrough(upstream, cors);
      }

      return json({ error: 'Not found' }, 404, cors);
    } catch (err) {
      return json({ error: 'Proxy error', detail: String(err) }, 502, cors);
    }
  },
};

// ---------- ヘルパー ----------
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
  const allowOrigin = allowed.includes('*')
    ? '*'
    : (allowed.includes(origin) ? origin : (allowed[0] || '*'));
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-app-token',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

async function passthrough(upstream, cors) {
  const headers = new Headers(cors);
  headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
  return new Response(upstream.body, { status: upstream.status, headers });
}

function json(obj, status, cors) {
  const headers = new Headers(cors);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(obj), { status, headers });
}
