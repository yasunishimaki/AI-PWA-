#!/bin/bash
# AI事前問診メモ ローカルサーバー起動スクリプト

PORT=8000

# リポジトリ直下から配信し、患者用・受付用の両方にアクセスできるようにする
cd "$(dirname "$0")/.." || exit 1

echo "🚀 AI事前問診メモ（デモ版）を起動します..."
echo ""
echo "📱 アクセスURL:"
echo "   患者用: http://localhost:$PORT/patient-app/"
echo "   受付用: http://localhost:$PORT/reception-app/"
echo ""

# IPアドレスを取得（Mac/Linux対応）
if command -v ifconfig > /dev/null; then
  IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
elif command -v ip > /dev/null; then
  IP=$(ip addr show 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | cut -d/ -f1 | head -n 1)
fi

if [ -n "$IP" ]; then
  echo "   スマホ (同じWi-Fi): http://$IP:$PORT"
  echo ""
  echo "   ⚠️  スマホで試す場合、マイク機能はHTTPS必要のためngrok等が必要です"
fi

echo ""
echo "⏹  終了するには Ctrl+C を押してください"
echo ""

# Python3 で HTTP サーバー起動
python3 -m http.server $PORT
