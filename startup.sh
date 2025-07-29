#!/bin/bash
echo "🚀 Starting Chat Support Widget..."

# Set up Python environment
echo "🔧 Setting up Python environment..."

# Create Python packages directory
mkdir -p /home/site/wwwroot/.python_packages/lib/site-packages

# Set up environment variables
export PYTHONPATH="/home/site/wwwroot/.python_packages/lib/site-packages:$PYTHONPATH"
export PATH="/home/site/wwwroot/.python_packages/bin:$PATH"

# Try to install Python packages
echo "📦 Installing Python packages..."

# Method 1: Try python3 -m pip
if python3 -m pip --version &> /dev/null; then
    echo "✅ Using python3 -m pip"
    python3 -m pip install --target=/home/site/wwwroot/.python_packages/lib/site-packages -r /home/site/wwwroot/python/requirements.txt
    echo "✅ Python packages installed successfully"
else
    echo "❌ python3 -m pip not available"
fi

# Verify installation
echo "🔍 Verifying Python installation..."
python3 -c "
import sys
sys.path.insert(0, '/home/site/wwwroot/.python_packages/lib/site-packages')
try:
    import azure.identity
    print('✅ azure.identity imported successfully')
except ImportError as e:
    print(f'❌ azure.identity import failed: {e}')

try:
    import azure.ai.projects
    print('✅ azure.ai.projects imported successfully')
except ImportError as e:
    print(f'❌ azure.ai.projects import failed: {e}')

try:
    import azure.ai.agents
    print('✅ azure.ai.agents imported successfully')
except ImportError as e:
    print(f'❌ azure.ai.agents import failed: {e}')

try:
    import dotenv
    print('✅ dotenv imported successfully')
except ImportError as e:
    print(f'❌ dotenv import failed: {e}')
"

# Start the Node.js application
echo "🚀 Starting Node.js application..."
cd /home/site/wwwroot
npm start 