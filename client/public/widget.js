(function() {
  'use strict';
  
  // Widget configuration
  const getConfig = () => {
    const scriptTag = document.currentScript || document.querySelector('script[src*="widget.js"]');
    return {
      endpoint: scriptTag?.getAttribute('data-endpoint') || 'http://localhost:5000',
      position: scriptTag?.getAttribute('data-position') || 'bottom-right',
      primaryColor: scriptTag?.getAttribute('data-primary-color') || '#6366F1',
      website: scriptTag?.getAttribute('data-website') || window.location.origin
    };
  };

  // Widget state
  const state = {
    isOpen: false,
    isExpanded: false,
    sessionId: null,
    messages: [],
    attachedFiles: [],
    feedbackGiven: false, // Track if feedback has been given
    currentFeedback: null // Track the current feedback (true for helpful, false for not helpful)
  };

  // API helper
  const apiRequest = async (method, url, data) => {
    const config = getConfig();
    const fullUrl = url.startsWith('http') ? url : `${config.endpoint}${url}`;
    
    const options = {
      method,
      credentials: 'include',
    };

    if (data && !(data instanceof FormData)) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(data);
    } else if (data instanceof FormData) {
      options.body = data;
    }

    const response = await fetch(fullUrl, options);
    
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    
    return response;
  };

  // Utility functions
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (mimetype) => {
    if (mimetype.startsWith('image/')) return '🖼️';
    if (mimetype === 'application/pdf') return '📄';
    return '📎';
  };

  const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

  // Simple markdown parser for basic formatting
  const parseMarkdown = (text) => {
    if (!text) return '';
    
    let result = text
      // Headers: ### text
      .replace(/^###\s+(.*)$/gm, '<h3 style="margin: 8px 0 4px 0; font-size: 16px; font-weight: 600; color: #111827;">$1</h3>')
      .replace(/^##\s+(.*)$/gm, '<h2 style="margin: 8px 0 4px 0; font-size: 18px; font-weight: 600; color: #111827;">$1</h2>')
      .replace(/^#\s+(.*)$/gm, '<h1 style="margin: 8px 0 4px 0; font-size: 20px; font-weight: 600; color: #111827;">$1</h1>')
      
      // Bold text: **text** or __text__
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      
      // Italic text: *text* or _text_
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      
      // Code: `code`
      .replace(/`(.*?)`/g, '<code style="background-color: #f3f4f6; padding: 2px 4px; border-radius: 3px; font-family: monospace; font-size: 12px;">$1</code>');
    
    // Handle lists more carefully
    const lines = result.split('\n');
    const processedLines = [];
    let inNumberedList = false;
    let inBulletList = false;
    let stepCounter = 1; // Counter for sequential step numbering
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for numbered list - treat ALL numbered items as step headings
      if (/^\d+\.\s+/.test(line)) {
        if (inNumberedList) {
          processedLines.push('</ol>');
          inNumberedList = false;
        }
        // Extract the text after the number and treat as numbered heading
        const headingText = line.replace(/^\d+\.\s+/, '');
        processedLines.push(`<h3 style="margin: 8px 0 4px 0; font-size: 16px; font-weight: 600; color: #111827;">${stepCounter}. ${headingText}</h3>`);
        stepCounter++; // Increment counter for next step
      }
      // Check for bullet list
      else if (/^[-*]\s+/.test(line)) {
        if (!inBulletList) {
          processedLines.push('<ul style="margin: 8px 0; padding-left: 20px;">');
          inBulletList = true;
        }
        processedLines.push(`<li style="margin: 4px 0;">${line.replace(/^[-*]\s+/, '')}</li>`);
      }
      // End lists if we encounter a non-list line
      else {
        if (inNumberedList) {
          processedLines.push('</ol>');
          inNumberedList = false;
        }
        if (inBulletList) {
          processedLines.push('</ul>');
          inBulletList = false;
        }
        processedLines.push(line);
      }
    }
    
    // Close any open lists
    if (inNumberedList) processedLines.push('</ol>');
    if (inBulletList) processedLines.push('</ul>');
    
    // Join lines and add line breaks
    return processedLines.join('<br>');
  };

  // Clean up bot responses by removing source citations
  const cleanBotResponse = (text) => {
    if (!text) return '';
    
    return text
      // Remove source citations like 【4:13†source】
      .replace(/【\d+:\d+†source】/g, '')
      // Remove any remaining citation patterns
      .replace(/【.*?】/g, '')
      // Clean up multiple spaces but preserve line breaks
      .replace(/[ \t]+/g, ' ')
      // Clean up multiple line breaks
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  };

  // Create session
  const createSession = async () => {
    try {
      const config = getConfig();
      const response = await apiRequest('POST', '/api/chat/session', {
        sessionId: state.sessionId,
        website: config.website
      });
      const session = await response.json();
      state.sessionId = session.sessionId;
      return session;
    } catch (error) {
      console.error('Failed to create session:', error);
      return null;
    }
  };

  // Load messages
  const loadMessages = async () => {
    if (!state.sessionId) return;
    
    try {
      const config = getConfig();
      const response = await fetch(`${config.endpoint}/api/chat/messages/${state.sessionId}`);
      const messages = await response.json();
      
      // Check for bot message after latest user message
      const latestUserMsg = messages.filter(m => m.sender === 'user').slice(-1)[0];
      const latestBotMsg = messages.filter(m => m.sender === 'bot').slice(-1)[0];
      
      // Check if bot message came after latest user message
      if (latestUserMsg && latestBotMsg && 
          new Date(latestBotMsg.timestamp) > new Date(latestUserMsg.timestamp)) {
        stopFastPolling();
        // Enable chat input when bot response is received
        enableChatInput();
      }
      
      // Also check if there are no more pending messages
      const hasPendingMessages = messages.some(msg => 
        msg.processingStatus === 'processing' || msg.processingStatus === 'pending'
      );
      
      if (!hasPendingMessages && fastPollingInterval) {
        stopFastPolling();
        // Enable chat input when no pending messages
        enableChatInput();
      }
      
      state.messages = messages;
      renderMessages();
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  // Send message
  const sendMessage = async (message, files = []) => {
    if (!state.sessionId) return;

    try {
      // Disable chat input while processing
      disableChatInput();
      
      // Reset feedback state for new conversation
      state.feedbackGiven = false;
      state.currentFeedback = null;

      const formData = new FormData();
      formData.append('sessionId', state.sessionId);
      formData.append('message', message);
      formData.append('sender', 'user');
      
      files.forEach((file) => {
        formData.append('files', file);
      });

      const config = getConfig();
      const response = await fetch(`${config.endpoint}/api/chat/message`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (response.ok) {
        // Add message to local state immediately
        const newMessage = {
          id: Date.now(),
          message,
          sender: 'user',
          timestamp: new Date().toISOString(),
          hasFiles: files.length > 0,
          processingStatus: 'processing',
          files: files.map(file => ({
            originalName: file.name,
            mimetype: file.type,
            size: file.size
          }))
        };
        state.messages.push(newMessage);
        renderMessages();
        
        // Start fast polling
        startFastPolling();
      } else {
        // Re-enable input if sending failed
        enableChatInput();
        console.error('Failed to send message:', response.statusText);
      }
    } catch (error) {
      // Re-enable input if sending failed
      enableChatInput();
      console.error('Failed to send message:', error);
    }
  };

  // Create widget HTML
  const createWidget = () => {
    const config = getConfig();
    const positionClass = getPositionClass(config.position);
    
    const widgetHTML = `
      <div id="chat-widget" class="chat-widget chat-widget-test ${positionClass}" style="
        position: fixed !important;
        z-index: 999999 !important;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        pointer-events: auto !important;
        ${getPositionClass(config.position)}
      ">
        <!-- Trigger Button -->
        <div id="chat-trigger" class="chat-trigger" style="
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${config.primaryColor} 0%, #8B5CF6 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 8px 25px rgba(0,0,0,0.4);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          border: 4px solid white;
          animation: pulse 2s infinite;
          z-index: 999999;
        " onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"">
          <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span id="chat-badge" style="
            position: absolute;
            top: -4px;
            right: -4px;
            background-color: #ef4444;
            color: white;
            font-size: 12px;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">1</span>
        </div>

        <!-- Chat Container -->
        <div id="chat-container" class="chat-container" style="
          position: absolute;
          ${config.position.includes('bottom') ? 'bottom: 70px;' : 'top: 70px;'}
          ${config.position.includes('right') ? 'right: 0;' : 'left: 0;'}
          width: 320px;
          height: 400px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.15);
          display: none;
          flex-direction: column;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        ">
          <!-- Header -->
          <div id="chat-header" style="
            background-color: ${config.primaryColor};
            color: white;
            padding: 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          ">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="
                width: 32px;
                height: 32px;
                background-color: rgba(255,255,255,0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 8V4H8"/>
                  <rect width="16" height="12" x="4" y="8" rx="2"/>
                  <path d="m14 8-2 2-2-2"/>
                  <path d="M4 14h16"/>
                </svg>
              </div>
              <div>
                <h3 style="margin: 0; font-size: 14px; font-weight: 500;">Support Chat</h3>
                <p style="margin: 0; font-size: 12px; opacity: 0.9;">We're here to help</p>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button id="chat-expand" style="
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                padding: 8px;
                border-radius: 4px;
                transition: background-color 0.2s;
              " title="Expand chat">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
                  <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
                  <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
                  <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
                </svg>
              </button>
              <button id="chat-close" style="
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                padding: 8px;
                border-radius: 4px;
                transition: background-color 0.2s;
              ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m18 6-12 12"/>
                  <path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Messages -->
          <div id="chat-messages" style="
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          ">
            <!-- Welcome message -->
            <div style="display: flex; align-items: flex-start; gap: 8px;">
              <div style="
                width: 24px;
                height: 24px;
                background-color: ${config.primaryColor};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
              ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <path d="M12 8V4H8"/>
                  <rect width="16" height="12" x="4" y="8" rx="2"/>
                  <path d="m14 8-2 2-2-2"/>
                  <path d="M4 14h16"/>
                </svg>
              </div>
              <div style="
                background-color: #f3f4f6;
                padding: 12px;
                border-radius: 12px;
                border-top-left-radius: 4px;
                max-width: 240px;
              ">
                <p style="margin: 0; font-size: 14px; color: #374151;">Hello! How can I help you today?</p>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">Just now</p>
              </div>
            </div>
          </div>

          <!-- File Preview -->
          <div id="file-preview" style="
            padding: 0 16px;
            display: none;
            flex-direction: column;
            gap: 8px;
            border-top: 1px solid #e5e7eb;
            padding-top: 12px;
          "></div>

          <!-- Input -->
          <div style="
            padding: 16px;
            border-top: 1px solid #e5e7eb;
            background: white;
          ">
            <div style="display: flex; align-items: flex-end; gap: 8px;">
              <textarea id="chat-input" placeholder="Type your message..." style="
                flex: 1;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                padding: 12px;
                resize: none;
                min-height: 40px;
                max-height: 80px;
                font-family: inherit;
                font-size: 14px;
                outline: none;
                transition: border-color 0.2s;
              "></textarea>
              <button id="attach-file" style="
                background: none;
                border: none;
                color: #6b7280;
                cursor: pointer;
                padding: 8px;
                border-radius: 4px;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                min-width: 32px;
                min-height: 32px;
              " onmouseover="this.style.backgroundColor='rgba(107, 114, 128, 0.1)'" onmouseout="this.style.backgroundColor='transparent'" title="Attach file">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>
              <button id="send-message" style="
                background-color: ${config.primaryColor};
                color: white;
                border: none;
                border-radius: 8px;
                padding: 12px;
                cursor: pointer;
                transition: opacity 0.2s;
              ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m22 2-7 20-4-9-9-4Z"/>
                  <path d="M22 2 11 13"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Hidden file input -->
      <input type="file" id="file-input" multiple accept=".jpg,.jpeg,.png,.gif,.pdf,.txt,.docx,.doc,.rtf,.odt" style="display: none;">
    `;

    return widgetHTML;
  };

  const getPositionClass = (position) => {
    switch (position) {
      case 'bottom-left':
        return 'bottom: 24px; left: 24px;';
      case 'top-right':
        return 'top: 24px; right: 24px;';
      case 'top-left':
        return 'top: 24px; left: 24px;';
      default:
        return 'bottom: 24px; right: 24px;';
    }
  };

  // Render messages
  const renderMessages = () => {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const config = getConfig();
    
    // Calculate max-width based on chat state
    const baseMaxWidth = 240; // Original max-width for normal mode
    const expandedMaxWidth = 360; // Max-width for expanded mode (480px - 120px padding)
    const messageMaxWidth = state.isExpanded ? expandedMaxWidth : baseMaxWidth;
    
    // Keep welcome message and add new messages
    const welcomeMessage = messagesContainer.children[0];
    messagesContainer.innerHTML = '';
    messagesContainer.appendChild(welcomeMessage);
    
    // Update welcome message width to match current state
    const welcomeMessageBox = welcomeMessage.querySelector('div[style*="background-color: #f3f4f6"]');
    if (welcomeMessageBox) {
      welcomeMessageBox.style.maxWidth = `${messageMaxWidth}px`;
    }

    state.messages.forEach((msg, index) => {
      const messageDiv = document.createElement('div');
      messageDiv.style.cssText = `
        display: flex;
        align-items: flex-start;
        gap: 8px;
        ${msg.sender === 'user' ? 'justify-content: flex-end;' : ''}
      `;

      const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

      if (msg.sender === 'user') {
        messageDiv.innerHTML = `
          <div style="
            background-color: ${config.primaryColor};
            color: white;
            padding: 12px;
            border-radius: 12px;
            border-top-right-radius: 4px;
            max-width: ${messageMaxWidth}px;
          ">
            ${msg.message ? `<p style="margin: 0; font-size: 14px;">${msg.message}</p>` : ''}
            ${msg.files && msg.files.length > 0 ? renderFileAttachments(msg.files, true) : ''}
            ${msg.processingStatus === 'processing' ? `
              <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px; font-size: 12px; opacity: 0.8;">
                <span>Processing...</span>
              </div>
            ` : ''}
            <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.8;">${time}</p>
          </div>
          <div style="
            width: 24px;
            height: 24px;
            background-color: #d1d5db;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          ">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
        `;
      } else {
        messageDiv.innerHTML = `
          <div style="
            width: 24px;
            height: 24px;
            background-color: ${config.primaryColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          ">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M12 8V4H8"/>
              <rect width="16" height="12" x="4" y="8" rx="2"/>
              <path d="m14 8-2 2-2-2"/>
              <path d="M4 14h16"/>
            </svg>
          </div>
          <div style="
            background-color: #f3f4f6;
            padding: 12px;
            border-radius: 12px;
            border-top-left-radius: 4px;
            max-width: ${messageMaxWidth}px;
          " data-message-id="${msg.id}">
            <div style="font-size: 14px; color: #374151; line-height: 1.4;">${parseMarkdown(cleanBotResponse(msg.message))}</div>
            ${msg.pythonResponse ? `
              <div style="
                margin-top: 8px;
                background-color: #e5e7eb;
                padding: 8px;
                border-radius: 6px;
                font-size: 12px;
              ">
                <div style="color: #6b7280; margin-bottom: 4px;">Response Data:</div>
                <code style="color: #374151;">${JSON.stringify(JSON.parse(msg.pythonResponse), null, 2)}</code>
              </div>
            ` : ''}
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">${time}</p>
            ${!state.feedbackGiven && index === state.messages.length - 1 ? `
              <div class="feedback-container" style="margin-top: 8px; display: flex; align-items: center; gap: 8px; justify-content: center;">
                <button onclick="submitFeedback('${msg.id}', false)" style="
                  background: none;
                  border: none;
                  cursor: pointer;
                  padding: 4px;
                  border-radius: 4px;
                  transition: all 0.2s;
                  font-size: 16px;
                  ${state.currentFeedback === false ? 'background-color: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444;' : ''}
                " onmouseover="this.style.backgroundColor='rgba(239, 68, 68, 0.1)'" onmouseout="this.style.backgroundColor='${state.currentFeedback === false ? 'rgba(239, 68, 68, 0.2)' : 'transparent'}'" title="Not helpful">
                  👎
                </button>
                <span style="font-size: 12px; color: #6b7280;">Was this helpful?</span>
                <button onclick="submitFeedback('${msg.id}', true)" style="
                  background: none;
                  border: none;
                  cursor: pointer;
                  padding: 4px;
                  border-radius: 4px;
                  transition: all 0.2s;
                  font-size: 16px;
                  ${state.currentFeedback === true ? 'background-color: rgba(34, 197, 94, 0.2); border: 1px solid #22c55e;' : ''}
                " onmouseover="this.style.backgroundColor='rgba(34, 197, 94, 0.1)'" onmouseout="this.style.backgroundColor='${state.currentFeedback === true ? 'rgba(34, 197, 94, 0.2)' : 'transparent'}'" title="Helpful">
                  👍
                </button>
              </div>
            ` : ''}
          </div>
        `;
      }

      messagesContainer.appendChild(messageDiv);
    });

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  const renderFileAttachments = (files, isUser = false) => {
    return files.map(file => `
      <div style="
        margin-top: 4px;
        padding: 8px;
        background-color: ${isUser ? 'rgba(255,255,255,0.2)' : '#e5e7eb'};
        border-radius: 6px;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <span>${getFileIcon(file.mimetype)}</span>
        <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${file.originalName}
        </span>
        <span style="opacity: 0.8;">${formatFileSize(file.size)}</span>
      </div>
    `).join('');
  };

  // Update file preview
  const updateFilePreview = () => {
    const filePreview = document.getElementById('file-preview');
    if (!filePreview) return;

    if (state.attachedFiles.length === 0) {
      filePreview.style.display = 'none';
      return;
    }

    filePreview.style.display = 'flex';
    filePreview.innerHTML = state.attachedFiles.map((file, index) => `
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        background-color: #f3f4f6;
        padding: 8px 12px;
        border-radius: 8px;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>${getFileIcon(file.type)}</span>
          <span style="font-size: 14px; color: #374151;">${file.name}</span>
          <span style="font-size: 12px; color: #6b7280;">(${formatFileSize(file.size)})</span>
        </div>
        <button onclick="removeFile(${index})" style="
          background: none;
          border: none;
          color: #6b7280;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m18 6-12 12"/>
            <path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>
    `).join('');
  };

  // Fast polling functions
  let fastPollingInterval = null;
  
  const startFastPolling = () => {
    // Only start fast polling if there are pending messages
    const hasPendingMessages = state.messages.some(msg => 
      msg.processingStatus === 'processing' || msg.processingStatus === 'pending'
    );
    
    if (!hasPendingMessages) {
      return;
    }
    
    // Clear any existing interval
    if (fastPollingInterval) {
      clearInterval(fastPollingInterval);
    }
    
    // Start fast polling every 500ms
    fastPollingInterval = setInterval(() => {
      loadMessages();
    }, 500);
  };
  
  const stopFastPolling = () => {
    if (fastPollingInterval) {
      clearInterval(fastPollingInterval);
      fastPollingInterval = null;
    }
  };

  // Disable/enable chat input
  const disableChatInput = () => {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-message');
    const attachBtn = document.getElementById('attach-file');
    
    if (chatInput) {
      chatInput.disabled = true;
      chatInput.placeholder = 'Processing... Please wait';
      chatInput.style.opacity = '0.6';
      chatInput.style.cursor = 'not-allowed';
    }
    
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.style.opacity = '0.6';
      sendBtn.style.cursor = 'not-allowed';
    }
    
    if (attachBtn) {
      attachBtn.disabled = true;
      attachBtn.style.opacity = '0.6';
      attachBtn.style.cursor = 'not-allowed';
      attachBtn.title = 'Processing... Please wait';
    }
  };

  const enableChatInput = () => {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-message');
    const attachBtn = document.getElementById('attach-file');
    
    if (chatInput) {
      chatInput.disabled = false;
      chatInput.placeholder = 'Type your message...';
      chatInput.style.opacity = '1';
      chatInput.style.cursor = 'text';
    }
    
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.style.opacity = '1';
      sendBtn.style.cursor = 'pointer';
    }
    
    if (attachBtn) {
      attachBtn.disabled = false;
      attachBtn.style.opacity = '1';
      attachBtn.style.cursor = 'pointer';
      attachBtn.title = 'Attach file';
    }
  };

  // Toggle expanded state
  const toggleExpanded = () => {
    state.isExpanded = !state.isExpanded;
    const container = document.getElementById('chat-container');
    const expandBtn = document.getElementById('chat-expand');
    
    if (state.isExpanded) {
      // Expanded mode: 50% wider, full height, positioned on the right
      container.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 480px !important;
        height: 100vh !important;
        border-radius: 0 !important;
        box-shadow: -5px 0 25px rgba(0,0,0,0.15) !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        z-index: 999999 !important;
      `;
      
      // Update expand button icon to show collapse
      expandBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3v3a2 2 0 0 1-2 2H3"/>
          <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
          <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
          <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
        </svg>
      `;
      expandBtn.title = 'Collapse chat';
    } else {
      // Normal mode: restore original positioning
      const config = getConfig();
      container.style.cssText = `
        position: absolute !important;
        ${config.position.includes('bottom') ? 'bottom: 70px;' : 'top: 70px;'}
        ${config.position.includes('right') ? 'right: 0;' : 'left: 0;'}
        width: 320px !important;
        height: 400px !important;
        background: white !important;
        border-radius: 12px !important;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15) !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      `;
      
      // Update expand button icon to show expand
      expandBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
          <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
          <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
          <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
        </svg>
      `;
      expandBtn.title = 'Expand chat';
    }
    
    // Re-render messages to update their widths
    renderMessages();
  };

  // Event handlers
  const setupEventHandlers = () => {
    const trigger = document.getElementById('chat-trigger');
    const container = document.getElementById('chat-container');
    const closeBtn = document.getElementById('chat-close');
    const expandBtn = document.getElementById('chat-expand');
    const sendBtn = document.getElementById('send-message');
    const attachBtn = document.getElementById('attach-file');
    const fileInput = document.getElementById('file-input');
    const chatInput = document.getElementById('chat-input');

    // Toggle chat
    if (trigger) {
      trigger.addEventListener('click', async () => {
        state.isOpen = !state.isOpen;
        container.style.display = state.isOpen ? 'flex' : 'none';
        
        if (state.isOpen) {
          if (!state.sessionId) {
            await createSession();
          }
          loadMessages();
          if (chatInput) chatInput.focus();
          const badge = document.getElementById('chat-badge');
          if (badge) badge.style.display = 'none';
        }
      });
    } else {
      console.error('Chat trigger element not found!');
    }

    // Close chat
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        state.isOpen = false;
        container.style.display = 'none';
        stopFastPolling();
      });
    }

    // Expand/collapse chat
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        toggleExpanded();
      });
    }

    // Send message
    const handleSend = () => {
      const message = chatInput ? chatInput.value.trim() : '';
      if (!message && state.attachedFiles.length === 0) return;

      // Check if input is disabled (processing in progress)
      if (chatInput && chatInput.disabled) {
        return;
      }

      sendMessage(message, state.attachedFiles);
      if (chatInput) chatInput.value = '';
      state.attachedFiles = [];
      updateFilePreview();
    };

    if (sendBtn) {
      sendBtn.addEventListener('click', handleSend);
    }

    if (chatInput) {
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          // Check if input is disabled (processing in progress)
          if (chatInput.disabled) {
            return;
          }
          handleSend();
        }
      });
    }

    // File attachment
    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Check if input is disabled (processing in progress)
        if (attachBtn.disabled) {
          console.log('Attachment button is disabled, ignoring click');
          return;
        }
        
        console.log('Attachment button clicked, opening file dialog');
        fileInput.click();
      });

      fileInput.addEventListener('change', (e) => {
        console.log('File input change event triggered');
        
        // Check if input is disabled (processing in progress)
        if (attachBtn && attachBtn.disabled) {
          console.log('Attachment button is disabled, ignoring file selection');
          return;
        }
        
        const files = Array.from(e.target.files || []);
        console.log('Selected files:', files.length);
        
        const validFiles = files.filter(file => {
          // Check file size
          if (file.size > 10 * 1024 * 1024) {
            alert(`File ${file.name} is larger than 10MB`);
            return false;
          }
          
          // Check file type - only allow specific types
          const allowedTypes = [
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
          ];
          
          if (!allowedTypes.includes(file.type)) {
            alert(`File type not supported: ${file.name} (${file.type}). Please upload images (JPG, PNG, GIF), documents (PDF, DOC, DOCX, RTF), or text files only.`);
            return false;
          }
          
          return true;
        });
        
        state.attachedFiles = [...state.attachedFiles, ...validFiles];
        updateFilePreview();
        
        // Clear the input so the same file can be selected again
        e.target.value = '';
      });
    } else {
      console.error('Attachment button or file input not found:', { attachBtn: !!attachBtn, fileInput: !!fileInput });
    }

    // Auto-resize textarea
    if (chatInput) {
      chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 80) + 'px';
      });
    }

    // Hover effects
    if (trigger) {
      trigger.addEventListener('mouseenter', () => {
        trigger.style.transform = 'scale(1.05)';
      });

      trigger.addEventListener('mouseleave', () => {
        trigger.style.transform = 'scale(1)';
      });
    }
  };

  // Global remove file function
  window.removeFile = (index) => {
    state.attachedFiles.splice(index, 1);
    updateFilePreview();
  };

  // Initialize widget
  const initWidget = () => {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        createAndSetupWidget();
      });
    } else {
      createAndSetupWidget();
    }
  };

  const createAndSetupWidget = () => {
    const widgetHTML = createWidget();
    document.body.insertAdjacentHTML('beforeend', widgetHTML);
    setupEventHandlers();
  };

  // Submit feedback
  const submitFeedback = async (messageId, isHelpful) => {
    try {
      const response = await apiRequest('POST', '/api/feedback', {
        sessionId: state.sessionId,
        messageId: messageId,
        isHelpful: isHelpful
      });
      
      const result = await response.json();
      
      if (result.success) {
        state.feedbackGiven = true;
        state.currentFeedback = isHelpful;
        // Update the UI to show feedback was submitted with change option
        const feedbackContainer = document.querySelector(`[data-message-id="${messageId}"] .feedback-container`);
        if (feedbackContainer) {
          feedbackContainer.innerHTML = `
            <div style="
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 12px;
              color: #6b7280;
              margin-top: 8px;
            ">
              <span>${isHelpful ? '👍' : '👎'} Thank you for your feedback!</span>
              <button onclick="changeFeedback('${messageId}')" style="
                background: none;
                border: none;
                color: #6366F1;
                cursor: pointer;
                font-size: 11px;
                text-decoration: underline;
                padding: 2px 4px;
                border-radius: 3px;
                transition: background-color 0.2s;
              " onmouseover="this.style.backgroundColor='rgba(99, 102, 241, 0.1)'" onmouseout="this.style.backgroundColor='transparent'" title="Change your feedback">
                Change feedback
              </button>
            </div>
          `;
        }
      } else {
        console.error('Failed to submit feedback:', result.error);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  // Change feedback function
  const changeFeedback = (messageId) => {
    state.feedbackGiven = false;
    state.currentFeedback = null;
    // Re-render messages to show feedback buttons again
    renderMessages();
  };

  // Make submitFeedback and changeFeedback globally accessible
  window.submitFeedback = submitFeedback;
  window.changeFeedback = changeFeedback;

  // Initialize the widget
  initWidget();
})();