#!/bin/bash

# Simple server launcher for macOS
# This script tries multiple methods to start a local server

echo "🚀 Starting Continuous Game of Life server..."
echo ""

# Try method 1: Python 3
if command -v python3 &> /dev/null; then
    echo "✅ Using Python 3"
    echo "📡 Server running at: http://localhost:8080"
    echo "Press Ctrl+C to stop"
    echo ""
    python3 -m http.server 8080
    exit 0
fi

# Try method 2: Python 2
if command -v python &> /dev/null; then
    echo "✅ Using Python 2"
    echo "📡 Server running at: http://localhost:8080"
    echo "Press Ctrl+C to stop"
    echo ""
    python -m SimpleHTTPServer 8080
    exit 0
fi

# Try method 3: PHP
if command -v php &> /dev/null; then
    echo "✅ Using PHP"
    echo "📡 Server running at: http://localhost:8080"
    echo "Press Ctrl+C to stop"
    echo ""
    php -S localhost:8080
    exit 0
fi

echo "❌ No suitable server found."
echo ""
echo "Please install one of: python3, python, or php"
echo "Or use an IDE extension like 'Live Server' for VS Code"

exit 1
