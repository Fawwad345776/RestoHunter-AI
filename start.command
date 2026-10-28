#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "============================================================"
echo "🚀 RESTOHUNTER AI — UNIVERSAL B2B CLIENT ACQUISITION ENGINE"
echo "============================================================"
echo "📱 Connected WhatsApp: +923376568003"
echo "📧 Outreach Email:     info.mfsoft@gmail.com"
echo "🌐 Local Web App:      http://127.0.0.1:8765"
echo "============================================================"

# Find Python executable
if [ -f "/Users/apple/.local/bin/python3.11" ]; then
    /Users/apple/.local/bin/python3.11 "$DIR/server.py"
elif command -v python3 >/dev/null 2>&1; then
    python3 "$DIR/server.py"
else
    echo "[!] Opening RestoHunter AI directly in default browser..."
    open "$DIR/index.html"
fi
