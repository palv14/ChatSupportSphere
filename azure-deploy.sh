#!/bin/bash

echo "🚀 Starting Azure Web App deployment..."

# Install Python dependencies
echo "📦 Installing Python dependencies..."
python3 -m pip install --user -r python/requirements.txt

# Set Python path for Azure
export PYTHON_PATH=$(which python3)
echo "🐍 Python path set to: $PYTHON_PATH"

# Create uploads directory if it doesn't exist
mkdir -p uploads

# Set proper permissions
chmod 755 uploads

echo "✅ Azure deployment setup complete!"
echo "📝 Remember to configure these environment variables in Azure Web App:"
echo "   - ALLOWED_ORIGINS: Comma-separated list of allowed origins"
echo "   - PYTHON_PATH: Path to Python executable (auto-detected)"
echo "   - NODE_ENV: Set to 'production'" 