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

  // Simple state management
  let state = {
    isOpen: false,
    messages: [],
    sessionId: null,
    isLoading: false,
    attachedFiles: [],
    isDragOver: false
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
        
        // Poll for updates
        setTimeout(loadMessages, 1000);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Create widget HTML
  const createWidget = () => {
    const config = getConfig();
    const positionClass = getPositionClass(config.position);
    
    const widgetHTML = `
      <div id="chat-widget" class="chat-widget ${positionClass}" style="
        position: fixed;
        z-index: 999999;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <!-- Trigger Button -->
        <div id="chat-trigger" class="chat-trigger" style="
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background-color: ${config.primaryColor};
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 6px 20px rgba(0,0,0,0.25);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          border: 3px solid white;
          animation: pulse 2s infinite;
        " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
                transition: color 0.2s;
              ">
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
      <input type="file" id="file-input" multiple accept=".jpg,.jpeg,.png,.gif,.pdf,.txt,.docx" style="display: none;">
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
    
    // Keep welcome message and add new messages
    const welcomeMessage = messagesContainer.children[0];
    messagesContainer.innerHTML = '';
    messagesContainer.appendChild(welcomeMessage);

    state.messages.forEach(msg => {
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
            max-width: 240px;
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
            max-width: 240px;
          ">
            <p style="margin: 0; font-size: 14px; color: #374151;">${msg.message}</p>
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

  // Event handlers
  const setupEventHandlers = () => {
    const trigger = document.getElementById('chat-trigger');
    const container = document.getElementById('chat-container');
    const closeBtn = document.getElementById('chat-close');
    const sendBtn = document.getElementById('send-message');
    const attachBtn = document.getElementById('attach-file');
    const fileInput = document.getElementById('file-input');
    const chatInput = document.getElementById('chat-input');

    // Toggle chat
    if (trigger) {
      trigger.addEventListener('click', async () => {
        console.log('Chat trigger clicked!');
        state.isOpen = !state.isOpen;
        container.style.display = state.isOpen ? 'flex' : 'none';
        console.log('Chat state changed:', state.isOpen ? 'opened' : 'closed');
        
        if (state.isOpen) {
          if (!state.sessionId) {
            await createSession();
          }
          loadMessages();
          chatInput.focus();
          const badge = document.getElementById('chat-badge');
          if (badge) badge.style.display = 'none';
        }
      });
    } else {
      console.error('Chat trigger element not found!');
    }

    // Close chat
    closeBtn.addEventListener('click', () => {
      state.isOpen = false;
      container.style.display = 'none';
    });

    // Send message
    const handleSend = () => {
      const message = chatInput.value.trim();
      if (!message && state.attachedFiles.length === 0) return;

      sendMessage(message, state.attachedFiles);
      chatInput.value = '';
      state.attachedFiles = [];
      updateFilePreview();
    };

    sendBtn.addEventListener('click', handleSend);

    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // File attachment
    attachBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      const validFiles = files.filter(file => {
        if (file.size > 10 * 1024 * 1024) {
          alert(`File ${file.name} is larger than 10MB`);
          return false;
        }
        return true;
      });
      
      state.attachedFiles = [...state.attachedFiles, ...validFiles];
      updateFilePreview();
    });

    // Auto-resize textarea
    chatInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 80) + 'px';
    });

    // Hover effects
    trigger.addEventListener('mouseenter', () => {
      trigger.style.transform = 'scale(1.05)';
    });

    trigger.addEventListener('mouseleave', () => {
      trigger.style.transform = 'scale(1)';
    });
  };

  // Global remove file function
  window.removeFile = (index) => {
    state.attachedFiles.splice(index, 1);
    updateFilePreview();
  };

  // Initialize widget
  const initWidget = () => {
    console.log('Initializing chat widget...');
    
    // Create and inject widget HTML
    const widgetContainer = document.createElement('div');
    const widgetHTML = createWidget();
    console.log('Widget HTML created:', widgetHTML.substring(0, 100) + '...');
    
    widgetContainer.innerHTML = widgetHTML;
    const widgetElement = widgetContainer.firstElementChild;
    
    if (widgetElement) {
      document.body.appendChild(widgetElement);
      console.log('Widget element added to DOM');
    } else {
      console.error('Failed to create widget element');
      return;
    }

    // Setup event handlers
    setupEventHandlers();
    console.log('Widget initialization complete');

    // Start polling for messages when chat is open
    setInterval(() => {
      if (state.isOpen && state.sessionId) {
        loadMessages();
      }
    }, 3000);
  };

  // Wait for DOM to be ready
  console.log('Chat widget script loaded, DOM state:', document.readyState);
  
  if (document.readyState === 'loading') {
    console.log('Waiting for DOM content loaded...');
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    console.log('DOM ready, initializing widget...');
    initWidget();
  }

})();
