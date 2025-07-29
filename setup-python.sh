#!/bin/bash
echo "🔧 Setting up Python environment..."

# Check if pip is available
if ! command -v pip &> /dev/null; then
    echo "⚠️  pip not found, trying to install pip..."
    # Try to install pip using get-pip.py
    curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
    python3 get-pip.py --user
    export PATH="$HOME/.local/bin:$PATH"
fi

# Check if pip is now available
if command -v pip &> /dev/null; then
    echo "✅ pip is available"
    echo "🔧 Installing Python dependencies..."
    pip install -r python/requirements.txt
else
    echo "❌ pip is still not available, trying alternative methods..."
    # Try using python3 -m pip
    if python3 -m pip --version &> /dev/null; then
        echo "✅ python3 -m pip is available"
        python3 -m pip install -r python/requirements.txt
    else
        echo "❌ Failed to install Python dependencies"
        echo "Available Python packages:"
        python3 -c "import sys; print('\\n'.join(sys.path))" 2>/dev/null || echo "Could not list Python path"
    fi
fi

echo "🔧 Installing Node.js dev dependencies..."
npm install --save-dev concurrently
