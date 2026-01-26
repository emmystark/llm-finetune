#!/bin/bash

# Sentinel Financial App - Quick Deployment Script
# This script helps deploy both frontend and backend to Vercel

echo "🚀 Sentinel Financial App - Vercel Deployment"
echo "=============================================="
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Check git status
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not a git repository"
    echo "Initialize git: git init && git add . && git commit -m 'Initial commit'"
    exit 1
fi

echo "✅ Git repository detected"
echo ""

# Get backend URL if deployed
read -p "📝 Enter your backend Vercel URL (or press Enter to skip): " BACKEND_URL

if [ ! -z "$BACKEND_URL" ]; then
    echo "Setting NEXT_PUBLIC_BACKEND_URL=$BACKEND_URL"
    echo "NEXT_PUBLIC_BACKEND_URL=$BACKEND_URL" > .env.production.local
fi

echo ""
echo "🚀 Starting deployment..."
echo ""

# Deploy
echo "1️⃣  Deploying to Vercel..."
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📍 Your frontend is now live!"
echo "📍 Make sure to:"
echo "   1. Note your frontend URL"
echo "   2. Update backend FRONTEND_URL env var"
echo "   3. Deploy backend with new FRONTEND_URL"
echo "   4. Update frontend NEXT_PUBLIC_BACKEND_URL with backend URL"
echo "   5. Redeploy frontend"
echo ""
echo "For detailed instructions, see DEPLOYMENT.md"
