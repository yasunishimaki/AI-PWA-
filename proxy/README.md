# OpenAI プロキシ（Cloudflare Worker）

患者用URLを**他の人に配布して本番動作**させるための、最小のバックエンドです。
OpenAI APIキーを**サーバー側に隠し**、患者アプリはこのWorker経由でOpenAIを呼びます。

```
患者アプリ（公開URL）
   │  POST /api/transcribe（音声）
   │  POST /api/chat（要約・翻訳・抽出）
   ▼
Cloudflare Worker（このフォルダ）── OPENAI_API_KEY（Secret）──▶ OpenAI
```

## 必要なもの
- Cloudflare アカウント（無料）
- Node.js（`npx` が使えればOK）
- OpenAI APIキー

## デプロイ手順

```bash
cd proxy
npm install                          # wrangler を入れる
npx wrangler login                   # ブラウザでCloudflareにログイン

# 必須：OpenAIキーをサーバー側のSecretに保存（プロンプトに貼り付け）
npx wrangler secret put OPENAI_API_KEY

# 任意：合言葉（設定すると x-app-token ヘッダー必須になる）
npx wrangler secret put APP_TOKEN

# CORS許可先を patient-app の公開元に絞る（推奨）
#   wrangler.toml の ALLOWED_ORIGINS を編集
#   例: ALLOWED_ORIGINS = "https://yasunishimaki.github.io"

npx wrangler deploy
```

デプロイ後に表示されるURL（例 `https://ai-prediagnosis-proxy.xxxxx.workers.dev`）を控えます。

## 患者アプリ側の設定

`patient-app/app.js` 冒頭の定数を編集してコミット／再デプロイします。

```js
const API_PROXY_BASE = 'https://ai-prediagnosis-proxy.xxxxx.workers.dev';
const API_APP_TOKEN  = '';   // APP_TOKEN を設定した場合のみ同じ合言葉を入れる
```

これで、URLを開いた**全員が（各自でキーを入れなくても）本番動作**します。
画面のモード表示が「🟢 本番API（サーバー）」になれば成功です。

## 動作確認（任意）

```bash
# chat エンドポイントの疎通（APP_TOKEN 未設定の場合）
curl -X POST "https://<your-worker-url>/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"ping"}]}'
```

## ⚠️ コスト・不正利用への注意（公開配布する前に必読）

- このプロキシを使うと、利用1回ごとに **あなたのOpenAIアカウントに課金**されます。
- クライアントは公開コードなので、`APP_TOKEN` も**閲覧すれば分かります**（小規模・限定配布の軽い抑止にはなりますが、完全な防御ではありません）。
- 公開前に必ず以下を行ってください：
  - **OpenAI 側で使用上限（Usage limits / 予算アラート）を設定**する
  - Cloudflare の **Rate Limiting / WAF** でアクセス回数を制限する
  - `ALLOWED_ORIGINS` を自分の公開URLだけに絞る
- 不特定多数の健康情報がOpenAIへ送られるため、**同意・利用目的の明示**などプライバシー対応も別途必要です（本番サービス化時）。
