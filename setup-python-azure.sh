#!/bin/bash
echo "🔧 Setting up Python environment for Azure..."

# Set up environment variables for Azure
export PYTHONPATH="/home/site/wwwroot/.python_packages/lib/site-packages:$PYTHONPATH"
export PATH="/home/site/wwwroot/.python_packages/bin:$PATH"

# Create Python packages directory
mkdir -p /home/site/wwwroot/.python_packages/lib/site-packages

# Try multiple methods to install pip and packages
echo "🔍 Checking Python and pip availability..."

# Method 1: Try python3 -m pip
if python3 -m pip --version &> /dev/null; then
    echo "✅ Using python3 -m pip"
    python3 -m pip install --target=/home/site/wwwroot/.python_packages/lib/site-packages -r python/requirements.txt
    echo "✅ Python packages installed successfully"
    
# Method 2: Try installing pip first
elif ! command -v pip &> /dev/null; then
    echo "⚠️  pip not found, installing pip..."
    curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
    python3 get-pip.py --target=/home/site/wwwroot/.python_packages/lib/site-packages
    export PATH="/home/site/wwwroot/.python_packages/bin:$PATH"
    
    if command -v pip &> /dev/null; then
        echo "✅ pip installed, installing packages..."
        pip install --target=/home/site/wwwroot/.python_packages/lib/site-packages -r python/requirements.txt
        echo "✅ Python packages installed successfully"
    else
        echo "❌ Failed to install pip"
    fi
    
# Method 3: Try using apt-get (if available)
elif command -v apt-get &> /dev/null; then
    echo "⚠️  Installing pip via apt-get..."
    apt-get update && apt-get install -y python3-pip
    pip3 install --target=/home/site/wwwroot/.python_packages/lib/site-packages -r python/requirements.txt
    echo "✅ Python packages installed successfully"
    
else
    echo "❌ Could not install Python packages"
    echo "Available Python packages:"
    python3 -c "import sys; print('\\n'.join(sys.path))" 2>/dev/null || echo "Could not list Python path"
fi

# Verify installation
echo "🔍 Verifying installation..."
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

echo "🔧 Python setup complete!" 