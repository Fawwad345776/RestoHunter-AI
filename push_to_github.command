#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "============================================================"
echo "🚀 RESTOHUNTER AI — GITHUB PUSH & LIVE DEPLOYMENT HELPER"
echo "============================================================"
echo "Repository: https://github.com/Fawwad345776/RestoHunter-AI"
echo "Target Branch: main"
echo "============================================================"
echo ""
echo "NOTE: GitHub requires a Personal Access Token (Classic) with 'repo' scope."
echo "If you don't have one yet, generate it at:"
echo "👉 https://github.com/settings/tokens (Select 'Generate new token (classic)' -> Check 'repo')"
echo ""
read -p "Enter your GitHub Personal Access Token (ghp_...): " GITHUB_TOKEN

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: Token cannot be empty."
    exit 1
fi

echo ""
echo "[1/3] Adding files and creating commit..."
git add .
git commit -m "feat: RestoHunter AI Universal Acquisition Engine with Auth Gate (Fawwad97)" --allow-empty

echo "[2/3] Setting remote with authentication token..."
git remote set-url origin "https://Fawwad345776:${GITHUB_TOKEN}@github.com/Fawwad345776/RestoHunter-AI.git"

echo "[3/3] Pushing to main branch on GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "============================================================"
    echo "✅ SUCCESS! Repository pushed to GitHub:"
    echo "👉 https://github.com/Fawwad345776/RestoHunter-AI"
    echo ""
    echo "🌐 TO MAKE SITE LIVE ON GITHUB PAGES:"
    echo "1. Open https://github.com/Fawwad345776/RestoHunter-AI/settings/pages"
    echo "2. Under 'Build and deployment' -> 'Branch', select 'main' -> '/ (root)'"
    echo "3. Click 'Save'"
    echo "Your live site will be ready at:"
    echo "👉 https://fawwad345776.github.io/RestoHunter-AI/"
    echo "============================================================"
else
    echo ""
    echo "❌ Push failed. Please verify that:"
    echo "1. The repository 'RestoHunter-AI' has been created on your GitHub account."
    echo "2. Your Personal Access Token has 'repo' permissions."
fi
