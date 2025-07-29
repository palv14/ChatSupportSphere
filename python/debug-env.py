#!/usr/bin/env python3
"""
Debug script to check Python environment and package installation
"""

import sys
import os
import subprocess

def main():
    print("=== Python Environment Debug ===")
    print(f"Python version: {sys.version}")
    print(f"Python executable: {sys.executable}")
    print(f"Current working directory: {os.getcwd()}")
    
    print("\n=== Python Path ===")
    for i, path in enumerate(sys.path):
        print(f"  {i}: {path}")
    
    print("\n=== Environment Variables ===")
    relevant_vars = ['PYTHONPATH', 'PYTHON_PATH', 'PATH', 'VIRTUAL_ENV', 'CONDA_DEFAULT_ENV']
    for var in relevant_vars:
        value = os.getenv(var)
        if value:
            print(f"  {var}: {value}")
        else:
            print(f"  {var}: Not set")
    
    print("\n=== Checking Package Installation ===")
    packages_to_check = [
        'azure.identity',
        'azure.ai.projects', 
        'azure.ai.agents',
        'dotenv'
    ]
    
    for package in packages_to_check:
        try:
            if package == 'dotenv':
                import dotenv
                print(f"  ✓ {package} - Version: {dotenv.__version__}")
            elif package == 'azure.identity':
                import azure.identity
                print(f"  ✓ {package} - Available")
            elif package == 'azure.ai.projects':
                import azure.ai.projects
                print(f"  ✓ {package} - Available")
            elif package == 'azure.ai.agents':
                import azure.ai.agents
                print(f"  ✓ {package} - Available")
        except ImportError as e:
            print(f"  ✗ {package} - Import Error: {e}")
        except Exception as e:
            print(f"  ? {package} - Other Error: {e}")
    
    print("\n=== Pip List ===")
    try:
        result = subprocess.run([sys.executable, '-m', 'pip', 'list'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print(result.stdout)
        else:
            print(f"Error running pip list: {result.stderr}")
    except Exception as e:
        print(f"Failed to run pip list: {e}")
    
    print("\n=== Test Import ===")
    try:
        from azure.identity import DefaultAzureCredential
        print("  ✓ Successfully imported DefaultAzureCredential")
    except ImportError as e:
        print(f"  ✗ Failed to import DefaultAzureCredential: {e}")
    
    try:
        from azure.ai.projects import AIProjectClient
        print("  ✓ Successfully imported AIProjectClient")
    except ImportError as e:
        print(f"  ✗ Failed to import AIProjectClient: {e}")
    
    try:
        from azure.ai.agents.models import ListSortOrder
        print("  ✓ Successfully imported azure.ai.agents.models")
    except ImportError as e:
        print(f"  ✗ Failed to import azure.ai.agents.models: {e}")

if __name__ == "__main__":
    main() 