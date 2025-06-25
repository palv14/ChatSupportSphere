#!/usr/bin/env python3
"""
Chat Support Widget - Python Processing Script

This script receives chat messages and file attachments from the widget
and returns a JSON response. Customize this script to integrate with your
AI models, automation systems, or custom logic.

Input format:
{
    "message": "User message text",
    "files": [
        {
            "path": "/path/to/uploaded/file",
            "originalName": "document.pdf",
            "mimetype": "application/pdf"
        }
    ],
    "sessionId": "unique-session-id",
    "timestamp": "2024-01-01T12:00:00.000Z"
}

Output format:
{
    "response": "Response message to display to user",
    "confidence": 0.95,
    "intent": "detected_intent",
    "entities": ["extracted", "entities"],
    "actions": ["action1", "action2"],
    "metadata": {}
}
"""

import json
import sys
import os
from datetime import datetime
import mimetypes

def analyze_message(message_text):
    """
    Analyze the user's message and extract intent/entities.
    Replace this with your AI/NLP model integration.
    """
    message_lower = message_text.lower()
    
    # Simple keyword-based intent detection
    if any(word in message_lower for word in ['help', 'support', 'problem', 'issue']):
        return {
            "intent": "support_request",
            "confidence": 0.9,
            "entities": ["help", "support"]
        }
    elif any(word in message_lower for word in ['hello', 'hi', 'hey']):
        return {
            "intent": "greeting",
            "confidence": 0.95,
            "entities": []
        }
    elif any(word in message_lower for word in ['pricing', 'cost', 'price', 'plan']):
        return {
            "intent": "pricing_inquiry",
            "confidence": 0.85,
            "entities": ["pricing"]
        }
    elif any(word in message_lower for word in ['account', 'login', 'password']):
        return {
            "intent": "account_help",
            "confidence": 0.88,
            "entities": ["account"]
        }
    else:
        return {
            "intent": "general_inquiry",
            "confidence": 0.7,
            "entities": []
        }

def analyze_files(files):
    """
    Analyze uploaded files and extract information.
    Add your file processing logic here.
    """
    file_info = []
    
    for file_data in files:
        file_path = file_data.get('path', '')
        original_name = file_data.get('originalName', '')
        mimetype = file_data.get('mimetype', '')
        
        # Basic file analysis
        file_analysis = {
            "name": original_name,
            "type": mimetype,
            "size": os.path.getsize(file_path) if os.path.exists(file_path) else 0,
            "analysis": "File received successfully"
        }
        
        # Add specific analysis based on file type
        if mimetype.startswith('image/'):
            file_analysis["analysis"] = "Image file detected - ready for visual analysis"
        elif mimetype == 'application/pdf':
            file_analysis["analysis"] = "PDF document detected - ready for text extraction"
        elif mimetype == 'text/plain':
            file_analysis["analysis"] = "Text file detected - ready for content analysis"
            
        file_info.append(file_analysis)
    
    return file_info

def generate_response(message, files, analysis):
    """
    Generate an appropriate response based on the analysis.
    Customize this function to integrate with your systems.
    """
    intent = analysis.get("intent", "general_inquiry")
    
    if intent == "greeting":
        return "Hello! Welcome to our support chat. How can I help you today?"
    elif intent == "support_request":
        return "I understand you need assistance. I've analyzed your message and I'm here to help resolve your issue."
    elif intent == "pricing_inquiry":
        return "I'd be happy to help you with pricing information. Let me get you the details you need."
    elif intent == "account_help":
        return "I can help you with your account. What specific account issue are you experiencing?"
    else:
        file_count = len(files)
        if file_count > 0:
            return f"Thank you for your message and the {file_count} file(s) you've shared. I'm processing your request and will provide assistance based on the information you've provided."
        else:
            return "Thank you for your message. I'm here to help you with any questions or concerns you may have."

def main():
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Extract data
        message = input_data.get('message', '')
        files = input_data.get('files', [])
        session_id = input_data.get('sessionId', '')
        timestamp = input_data.get('timestamp', '')
        
        # Analyze the message
        message_analysis = analyze_message(message) if message else {
            "intent": "file_only",
            "confidence": 1.0,
            "entities": []
        }
        
        # Analyze files
        file_analysis = analyze_files(files) if files else []
        
        # Generate response
        response_text = generate_response(message, files, message_analysis)
        
        # Prepare output
        output = {
            "response": response_text,
            "confidence": message_analysis.get("confidence", 0.8),
            "intent": message_analysis.get("intent", "unknown"),
            "entities": message_analysis.get("entities", []),
            "actions": ["message_processed"],
            "metadata": {
                "session_id": session_id,
                "timestamp": timestamp,
                "processing_time": datetime.now().isoformat(),
                "file_count": len(files),
                "files_processed": file_analysis,
                "message_length": len(message) if message else 0
            }
        }
        
        # Output JSON response
        print(json.dumps(output, indent=2))
        
    except json.JSONDecodeError:
        error_response = {
            "response": "I apologize, but I encountered an error processing your request. Please try again.",
            "confidence": 0.0,
            "intent": "error",
            "entities": [],
            "actions": ["error_handled"],
            "metadata": {
                "error": "Invalid JSON input",
                "timestamp": datetime.now().isoformat()
            }
        }
        print(json.dumps(error_response))
        sys.exit(1)
        
    except Exception as e:
        error_response = {
            "response": "I apologize, but I encountered an unexpected error. Our team has been notified.",
            "confidence": 0.0,
            "intent": "error",
            "entities": [],
            "actions": ["error_logged"],
            "metadata": {
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
        }
        print(json.dumps(error_response))
        sys.exit(1)

if __name__ == "__main__":
    main()
