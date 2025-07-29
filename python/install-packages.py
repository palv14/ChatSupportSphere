#!/usr/bin/env python3
"""
Runtime package installer for Azure Web Apps
"""

import sys
import os
import subprocess
import importlib

def install_package(package_name):
    """Install a package if it's not available"""
    try:
        importlib.import_module(package_name)
        print(f"✅ {package_name} is already available")
        return True
    except ImportError:
        print(f"📦 Installing {package_name}...")
        try:
            # Try using pip
            subprocess.check_call([sys.executable, "-m", "pip", "install", 
                                 "--target=/home/site/wwwroot/.python_packages/lib/site-packages", 
                                 package_name])
            print(f"✅ {package_name} installed successfully")
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to install {package_name}: {e}")
            return False

def main():
    print("🔧 Checking and installing Python packages...")
    
    # Add the packages directory to Python path
    packages_dir = "/home/site/wwwroot/.python_packages/lib/site-packages"
    if packages_dir not in sys.path:
        sys.path.insert(0, packages_dir)
    
    # Create packages directory if it doesn't exist
    os.makedirs(packages_dir, exist_ok=True)
    
    # List of packages to install
    packages = [
        "azure-identity",
        "azure-ai-projects", 
        "azure-ai-agents",
        "python-dotenv"
    ]
    
    success_count = 0
    for package in packages:
        if install_package(package):
            success_count += 1
    
    print(f"\n📊 Installation Summary: {success_count}/{len(packages)} packages installed")
    
    # Test imports
    print("\n🔍 Testing imports...")
    try:
        import azure.identity
        print("✅ azure.identity imported successfully")
    except ImportError as e:
        print(f"❌ azure.identity import failed: {e}")
    
    try:
        import azure.ai.projects
        print("✅ azure.ai.projects imported successfully")
    except ImportError as e:
        print(f"❌ azure.ai.projects import failed: {e}")
    
    try:
        import azure.ai.agents
        print("✅ azure.ai.agents imported successfully")
    except ImportError as e:
        print(f"❌ azure.ai.agents import failed: {e}")
    
    try:
        import dotenv
        print("✅ dotenv imported successfully")
    except ImportError as e:
        print(f"❌ dotenv import failed: {e}")

if __name__ == "__main__":
    main() 