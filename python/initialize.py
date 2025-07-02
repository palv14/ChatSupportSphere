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
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from azure.ai.agents.models import (
    ListSortOrder, FilePurpose, FileSearchTool, 
    MessageInputTextBlock, MessageInputImageFileBlock, MessageImageFileParam,
    MessageAttachment
)
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get configuration from environment variables
AZURE_AI_ENDPOINT = os.getenv('AZURE_AI_ENDPOINT')
AZURE_AGENT_ID = os.getenv('AZURE_AGENT_ID')

# Validate required environment variables
if not AZURE_AI_ENDPOINT:
    raise ValueError("AZURE_AI_ENDPOINT environment variable is required")
if not AZURE_AGENT_ID:
    raise ValueError("AZURE_AGENT_ID environment variable is required")

project = AIProjectClient(
    endpoint=AZURE_AI_ENDPOINT,
    credential=DefaultAzureCredential()
)

def analyze_message(message_text):
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
    file_info = []
    for file_data in files:
        file_path = file_data.get('path', '')
        original_name = file_data.get('originalName', '')
        mimetype = file_data.get('mimetype', '')
        
        # Basic file analysis
        file_analysis = {
            "name": original_name,
            "type": mimetype,
            "size": 0,
            "exists": False,
            "analysis": "File not found",
            "upload_status": "pending"
        }
        
        # Check if file exists and get size
        if os.path.exists(file_path):
            try:
                file_size = os.path.getsize(file_path)
                file_analysis.update({
                    "size": file_size,
                    "exists": True,
                    "analysis": "File ready for processing",
                    "upload_status": "ready"
                })
                
                # Add specific analysis based on file type
                if mimetype.startswith('image/'):
                    file_analysis["analysis"] = f"Image file detected ({file_size} bytes) - ready for visual analysis"
                    file_analysis["category"] = "image"
                elif mimetype == 'application/pdf':
                    file_analysis["analysis"] = f"PDF document detected ({file_size} bytes) - ready for text extraction"
                    file_analysis["category"] = "document"
                elif mimetype == 'text/plain':
                    file_analysis["analysis"] = f"Text file detected ({file_size} bytes) - ready for content analysis"
                    file_analysis["category"] = "text"
                elif mimetype in ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']:
                    file_analysis["analysis"] = f"Word document detected ({file_size} bytes) - ready for text extraction"
                    file_analysis["category"] = "document"
                elif mimetype == 'application/rtf':
                    file_analysis["analysis"] = f"Rich text document detected ({file_size} bytes) - ready for text extraction"
                    file_analysis["category"] = "document"
                elif mimetype == 'application/vnd.oasis.opendocument.text':
                    file_analysis["analysis"] = f"OpenDocument text detected ({file_size} bytes) - ready for text extraction"
                    file_analysis["category"] = "document"
                else:
                    file_analysis["analysis"] = f"Unsupported file type ({file_size} bytes) - cannot process"
                    file_analysis["category"] = "unsupported"
                    
            except Exception as e:
                file_analysis.update({
                    "analysis": f"Error accessing file: {str(e)}",
                    "upload_status": "error"
                })
        else:
            file_analysis["analysis"] = f"File not found at path: {file_path}"
            file_analysis["upload_status"] = "not_found"
        
        file_info.append(file_analysis)
    
    return file_info

def generate_response(message, files, analysis):
    try:
        # Define allowed file types
        allowed_types = [
            'image/jpeg',
            'image/jpg',
            'image/png', 
            'image/gif',
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/rtf',
            'application/vnd.oasis.opendocument.text'
        ]
        
        # Filter files to only include supported types
        supported_files = []
        unsupported_files = []
        
        for file_data in files:
            mimetype = file_data.get('mimetype', '')
            if mimetype in allowed_types:
                supported_files.append(file_data)
            else:
                unsupported_files.append(file_data.get('originalName', 'Unknown file'))
        
        # Separate image files from document files
        image_files = [f for f in supported_files if f.get('mimetype', '').startswith('image/')]
        document_files = [f for f in supported_files if not f.get('mimetype', '').startswith('image/')]
        
        # Handle different scenarios
        if image_files and document_files:
            # Mixed content: images + documents
            return handle_mixed_content(message, image_files, document_files, unsupported_files)
        elif image_files:
            # Images only
            return handle_images_only(message, image_files, unsupported_files)
        elif document_files:
            # Documents only
            return handle_documents_only(message, document_files, unsupported_files)
        else:
            # Text only
            return handle_text_only(message, unsupported_files)

    except Exception as e:
        return f"I apologize, but I encountered an error: {str(e)}"

def handle_images_only(message, image_files, unsupported_files):
    """Handle messages with only image files using content blocks"""
    try:
        # Prepare content blocks
        content_blocks = []
        uploaded_image_files = []
        
        # Add text message if provided
        if message:
            content_blocks.append(MessageInputTextBlock(text=message))
        
        # Upload and add image files to content blocks
        for file_data in image_files:
            file_path = file_data.get('path', '')
            if os.path.exists(file_path):
                try:
                    # Upload the local image file
                    image_file = project.agents.files.upload_and_poll(
                        file_path=file_path, 
                        purpose="assistants"
                    )
                    
                    # Track uploaded file for cleanup
                    uploaded_image_files.append(image_file)
                    
                    # Construct content using uploaded image
                    file_param = MessageImageFileParam(file_id=image_file.id, detail="high")
                    content_blocks.append(MessageInputImageFileBlock(image_file=file_param))
                    
                except Exception as e:
                    print(f"Failed to upload image {file_data.get('originalName', '')}: {str(e)}", file=sys.stderr)
        
        # Add warning about unsupported files
        if unsupported_files:
            unsupported_warning = f"\n\nNote: The following files were not processed (unsupported type): {', '.join(unsupported_files)}"
            if content_blocks and isinstance(content_blocks[0], MessageInputTextBlock):
                current_text = content_blocks[0].text
                content_blocks[0] = MessageInputTextBlock(text=current_text + unsupported_warning)
            else:
                content_blocks.insert(0, MessageInputTextBlock(text=unsupported_warning))
        
        try:
            # Create thread and message
            thread = project.agents.threads.create()
            
            # Create the message with content blocks
            user_message = project.agents.messages.create(
                thread_id=thread.id,
                role="user",
                content=content_blocks
            )
            
            return process_agent_response(thread, AZURE_AGENT_ID)
            
        finally:
            # Clean up uploaded image files
            for image_file in uploaded_image_files:
                try:
                    project.agents.files.delete(image_file.id)
                    print(f"Deleted uploaded image file {image_file.id}", file=sys.stderr)
                except Exception as e:
                    print(f"Failed to delete uploaded image file {image_file.id}: {str(e)}", file=sys.stderr)
        
    except Exception as e:
        return f"I apologize, but I encountered an error processing images: {str(e)}"

def handle_documents_only(message, document_files, unsupported_files):
    """Handle messages with only document files using vector stores"""
    try:
        # Upload files for search
        uploaded_files = []
        for file_data in document_files:
            file_path = file_data.get('path', '')
            if os.path.exists(file_path):
                try:
                    file = project.agents.files.upload_and_poll(
                        file_path=file_path, 
                        purpose=FilePurpose.AGENTS
                    )
                    uploaded_files.append(file)
                    print(f"Uploaded file {file_data.get('originalName', '')}, file ID: {file.id}", file=sys.stderr)
                except Exception as e:
                    print(f"Failed to upload document {file_data.get('originalName', '')}: {str(e)}", file=sys.stderr)
        
        if not uploaded_files:
            return "I couldn't upload any of the provided documents. Please check if the files are accessible."
        
        # Create vector store with uploaded files
        file_ids = [file.id for file in uploaded_files]
        vector_store = project.agents.vector_stores.create_and_poll(
            file_ids=file_ids, 
            name="temp_vectorstore"
        )
        print(f"Created vector store, vector store ID: {vector_store.id}", file=sys.stderr)
        
        try:
            # Create file search tool with resources
            file_search = FileSearchTool(vector_store_ids=[vector_store.id])
            
            # Create thread with file resources
            thread = project.agents.threads.create(tool_resources=file_search.resources)
            
            # Prepare message content
            message_content = message if message else "Please analyze the attached documents."
            
            # Add warning about unsupported files
            if unsupported_files:
                message_content += f"\n\nNote: The following files were not processed (unsupported type): {', '.join(unsupported_files)}"
            
            # Create attachments for all uploaded files
            attachments = []
            for file in uploaded_files:
                attachment = MessageAttachment(file_id=file.id, tools=FileSearchTool().definitions)
                attachments.append(attachment)
            
            # Create the message with attachments
            user_message = project.agents.messages.create(
                thread_id=thread.id, 
                role="user", 
                content=message_content,
                attachments=attachments
            )
            
            return process_agent_response(thread, AZURE_AGENT_ID)
            
        finally:
            # Clean up vector store
            try:
                project.agents.vector_stores.delete(vector_store.id)
                print(f"Deleted vector store {vector_store.id}", file=sys.stderr)
            except Exception as e:
                print(f"Failed to delete vector store {vector_store.id}: {str(e)}", file=sys.stderr)
            
            # Clean up uploaded files
            for file in uploaded_files:
                try:
                    project.agents.files.delete(file.id)
                    print(f"Deleted uploaded file {file.id}", file=sys.stderr)
                except Exception as e:
                    print(f"Failed to delete uploaded file {file.id}: {str(e)}", file=sys.stderr)
        
    except Exception as e:
        return f"I apologize, but I encountered an error processing documents: {str(e)}"

def handle_mixed_content(message, image_files, document_files, unsupported_files):
    """Handle messages with both images and documents - use document approach for simplicity"""
    try:
        # For mixed content, we'll use the document approach and mention images in text
        # Upload document files for search
        uploaded_files = []
        for file_data in document_files:
            file_path = file_data.get('path', '')
            if os.path.exists(file_path):
                try:
                    file = project.agents.files.upload_and_poll(
                        file_path=file_path, 
                        purpose=FilePurpose.AGENTS
                    )
                    uploaded_files.append(file)
                    print(f"Uploaded document {file_data.get('originalName', '')}, file ID: {file.id}", file=sys.stderr)
                except Exception as e:
                    print(f"Failed to upload document {file_data.get('originalName', '')}: {str(e)}", file=sys.stderr)
        
        if not uploaded_files:
            return "I couldn't upload any of the provided documents. Please check if the files are accessible."
        
        # Create vector store with uploaded files
        file_ids = [file.id for file in uploaded_files]
        vector_store = project.agents.vector_stores.create_and_poll(
            file_ids=file_ids, 
            name="temp_vectorstore"
        )
        print(f"Created vector store, vector store ID: {vector_store.id}", file=sys.stderr)
        
        try:
            # Create file search tool with resources
            file_search = FileSearchTool(vector_store_ids=[vector_store.id])
            
            # Create thread with file resources
            thread = project.agents.threads.create(tool_resources=file_search.resources)
            
            # Prepare message content with image information
            message_content = message if message else "Please analyze the attached documents and images."
            
            # Add image information to message
            if image_files:
                image_names = [f.get('originalName', 'Unknown') for f in image_files]
                message_content += f"\n\nNote: The following images were also provided but cannot be processed in this context: {', '.join(image_names)}"
            
            # Add warning about unsupported files
            if unsupported_files:
                message_content += f"\n\nNote: The following files were not processed (unsupported type): {', '.join(unsupported_files)}"
            
            # Create attachments for all uploaded files
            attachments = []
            for file in uploaded_files:
                attachment = MessageAttachment(file_id=file.id, tools=FileSearchTool().definitions)
                attachments.append(attachment)
            
            # Create the message with attachments
            user_message = project.agents.messages.create(
                thread_id=thread.id, 
                role="user", 
                content=message_content,
                attachments=attachments
            )
            
            return process_agent_response(thread, AZURE_AGENT_ID)
            
        finally:
            # Clean up vector store
            try:
                project.agents.vector_stores.delete(vector_store.id)
                print(f"Deleted vector store {vector_store.id}", file=sys.stderr)
            except Exception as e:
                print(f"Failed to delete vector store {vector_store.id}: {str(e)}", file=sys.stderr)
            
            # Clean up uploaded files
            for file in uploaded_files:
                try:
                    project.agents.files.delete(file.id)
                    print(f"Deleted uploaded file {file.id}", file=sys.stderr)
                except Exception as e:
                    print(f"Failed to delete uploaded file {file.id}: {str(e)}", file=sys.stderr)
        
    except Exception as e:
        return f"I apologize, but I encountered an error processing mixed content: {str(e)}"

def handle_text_only(message, unsupported_files):
    """Handle messages with only text"""
    try:
        # Prepare message content
        message_content = message if message else "Hello! How can I help you?"
        
        # Add warning about unsupported files
        if unsupported_files:
            message_content += f"\n\nNote: The following files were not processed (unsupported type): {', '.join(unsupported_files)}"
        
        # Create thread and message
        thread = project.agents.threads.create()
        
        user_message = project.agents.messages.create(
            thread_id=thread.id,
            role="user",
            content=message_content
        )
        
        return process_agent_response(thread, AZURE_AGENT_ID)
        
    except Exception as e:
        return f"I apologize, but I encountered an error: {str(e)}"

def process_agent_response(thread, agent_id):
    """Process the agent response and return the result"""
    try:
        # Process the message with the agent
        run = project.agents.runs.create_and_process(thread_id=thread.id, agent_id=agent_id)
        
        if run.status == "failed":
            return f"I apologize, but I encountered an error processing your request. Please try again."
        
        # Get messages from the thread
        messages = project.agents.messages.list(thread_id=thread.id, order=ListSortOrder.ASCENDING)
        
        # Get the last message from the agent
        for message in messages:
            if message.run_id == run.id and message.text_messages:
                return message.text_messages[-1].text.value
        
        return "I've processed your message and files. How can I help you further?"
        
    except Exception as e:
        return f"I apologize, but I encountered an error: {str(e)}"

def main():
    try:
        input_data = json.loads(sys.stdin.read())
        
        # Extract data
        message = input_data.get('message', '')
        files = input_data.get('files', [])
        session_id = input_data.get('sessionId', '')
        timestamp = input_data.get('timestamp', '')
        
        # Log processing start
        print(f"Processing session {session_id} with {len(files)} files", file=sys.stderr)
        
        # Analyze the message
        message_analysis = analyze_message(message) if message else {
            "intent": "file_only",
            "confidence": 1.0,
            "entities": []
        }
        
        # Analyze files
        file_analysis = analyze_files(files) if files else []
        
        # Log file analysis results
        for file_info in file_analysis:
            print(f"File: {file_info['name']} - {file_info['analysis']}", file=sys.stderr)
        
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
                "message_length": len(message) if message else 0,
                "has_files": len(files) > 0,
                "file_types": [f.get('mimetype', 'unknown') for f in files]
            }
        }
        
        print(json.dumps(output, indent=2))
        
    except json.JSONDecodeError as e:
        error_response = {
            "response": "I apologize, but I encountered an error processing your request. Please try again.",
            "confidence": 0.0,
            "intent": "error",
            "entities": [],
            "actions": ["error_handled"],
            "metadata": {
                "error": "Invalid JSON input",
                "error_details": str(e),
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
                "error_type": type(e).__name__,
                "timestamp": datetime.now().isoformat()
            }
        }
        print(json.dumps(error_response))
        sys.exit(1)

if __name__ == "__main__":
    main()
