import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
import express from "express";
import { storage } from "./storage";
import { upload, processUploadedFiles } from "./services/file-handler";
import { pythonExecutor } from "./services/python-executor";
import { insertChatSessionSchema, insertChatMessageSchema, widgetConfigSchema } from "@shared/schema";
import { nanoid } from "nanoid";

export async function registerRoutes(app: Express): Promise<Server> {
  // Enable CORS for all routes
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // Serve uploaded files
  app.use('/api/files', express.static('uploads'));

  // Create or get chat session
  app.post('/api/chat/session', async (req, res) => {
    try {
      const { sessionId, website } = req.body;
      
      if (sessionId) {
        const existingSession = await storage.getChatSession(sessionId);
        if (existingSession) {
          return res.json(existingSession);
        }
      }

      const newSessionId = sessionId || nanoid();
      const sessionData = insertChatSessionSchema.parse({
        sessionId: newSessionId,
        website: website || req.get('origin') || req.get('referer')
      });

      const session = await storage.createChatSession(sessionData);
      res.json(session);
    } catch (error) {
      console.error('Error creating/getting chat session:', error);
      res.status(500).json({ error: 'Failed to create or get chat session' });
    }
  });

  // Get chat messages for a session
  app.get('/api/chat/messages/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const messages = await storage.getChatMessages(sessionId);
      
      // Get files for each message
      const messagesWithFiles = await Promise.all(
        messages.map(async (message) => {
          const files = await storage.getChatFiles(message.id);
          return { ...message, files };
        })
      );

      res.json(messagesWithFiles);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
  });

  // Send a new chat message
  app.post('/api/chat/message', upload.array('files', 5), async (req, res) => {
    try {
      const { sessionId, message, sender } = req.body;
      const files = (req as any).files as Express.Multer.File[] || [];

      // Validate input
      const messageData = insertChatMessageSchema.parse({
        sessionId,
        message: message || null,
        sender,
        hasFiles: files.length > 0
      });

      // Create message record
      const chatMessage = await storage.createChatMessage(messageData);

      // Process and save files
      const processedFiles = processUploadedFiles(files);
      const savedFiles = await Promise.all(
        processedFiles.map(file => 
          storage.createChatFile({
            messageId: chatMessage.id,
            filename: file.filename,
            originalName: file.originalName,
            mimetype: file.mimetype,
            size: file.size,
            path: file.path
          })
        )
      );

      // If this is a user message, process it with Python script
      if (sender === 'user') {
        // Update status to processing
        await storage.updateMessageStatus(chatMessage.id, 'processing');

        // Execute Python script in background
        setImmediate(async () => {
          try {
            const result = await pythonExecutor.executePythonScript(
              message || '',
              processedFiles.map(f => ({
                path: f.path,
                originalName: f.originalName,
                mimetype: f.mimetype
              })),
              sessionId
            );

            if (result.success) {
              // Update message with Python response
              await storage.updateMessageStatus(
                chatMessage.id, 
                'completed', 
                JSON.stringify(result.output)
              );

              // Create bot response message
              const botResponse = result.output?.response || 'I have processed your message.';
              await storage.createChatMessage({
                sessionId,
                message: botResponse,
                sender: 'bot',
                hasFiles: false
              });
            } else {
              await storage.updateMessageStatus(chatMessage.id, 'failed', JSON.stringify({ error: result.error }));
            }
          } catch (error) {
            console.error('Error processing message with Python script:', error);
            await storage.updateMessageStatus(chatMessage.id, 'failed', JSON.stringify({ error: 'Processing failed' }));
          }
        });
      }

      res.json({ ...chatMessage, files: savedFiles });
    } catch (error) {
      console.error('Error sending chat message:', error);
      res.status(500).json({ error: 'Failed to send chat message' });
    }
  });

  // Get message status and Python response
  app.get('/api/chat/message/:messageId/status', async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId);
      const messageWithFiles = await storage.getMessageWithFiles(messageId);
      
      if (!messageWithFiles) {
        return res.status(404).json({ error: 'Message not found' });
      }

      res.json({
        status: messageWithFiles.message.processingStatus,
        pythonResponse: messageWithFiles.message.pythonResponse ? 
          JSON.parse(messageWithFiles.message.pythonResponse) : null
      });
    } catch (error) {
      console.error('Error fetching message status:', error);
      res.status(500).json({ error: 'Failed to fetch message status' });
    }
  });

  // Widget configuration endpoint
  app.post('/api/widget/config', async (req, res) => {
    try {
      const config = widgetConfigSchema.parse(req.body);
      res.json({ success: true, config });
    } catch (error) {
      res.status(400).json({ error: 'Invalid widget configuration' });
    }
  });

  // Serve test HTML file
  app.get('/test', (req, res) => {
    res.sendFile('test-widget.html', { root: process.cwd() });
  });

  // Serve the embeddable widget script
  app.get('/widget.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    
    // Serve the pre-built widget.js file
    res.sendFile('widget.js', { root: './client/public' });
  });

  // Serve widget demo page
  app.get('/widget', (req, res) => {
    const { endpoint = 'http://localhost:5000', position = 'bottom-right', primaryColor = '#6366F1' } = req.query;
    
    const demoHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat Widget Demo</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
        }
        .demo-content {
            max-width: 800px;
            margin: 0 auto;
            text-align: center;
        }
        .demo-card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            margin: 20px 0;
        }
        .integration-code {
            background: rgba(0, 0, 0, 0.3);
            padding: 20px;
            border-radius: 10px;
            font-family: 'Courier New', monospace;
            text-align: left;
            overflow-x: auto;
            margin: 20px 0;
        }
        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .feature {
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 10px;
        }
    </style>
</head>
<body>
    <div class="demo-content">
        <h1>🚀 Chat Support Widget Demo</h1>
        <p>Experience the power of embeddable chat support with Python script integration</p>
        
        <div class="demo-card">
            <h2>📋 Integration Instructions</h2>
            <p>Add this single line to your website to embed the chat widget:</p>
            <div class="integration-code">
&lt;script src="${endpoint}/widget.js" 
        data-endpoint="${endpoint}"
        data-position="${position}"
        data-primary-color="${primaryColor}"&gt;&lt;/script&gt;
            </div>
        </div>

        <div class="demo-card">
            <h2>✨ Features</h2>
            <div class="feature-grid">
                <div class="feature">
                    <h3>💬 Real-time Chat</h3>
                    <p>Instant messaging with smooth animations</p>
                </div>
                <div class="feature">
                    <h3>📎 File Uploads</h3>
                    <p>Support for images and documents</p>
                </div>
                <div class="feature">
                    <h3>🐍 Python Integration</h3>
                    <p>Process messages with custom scripts</p>
                </div>
                <div class="feature">
                    <h3>🌐 Cross-domain</h3>
                    <p>Embed on any website</p>
                </div>
                <div class="feature">
                    <h3>📱 Responsive</h3>
                    <p>Works on all devices</p>
                </div>
                <div class="feature">
                    <h3>🎨 Customizable</h3>
                    <p>Match your brand colors</p>
                </div>
            </div>
        </div>

        <div class="demo-card">
            <h2>🔧 Try It Now</h2>
            <p>The chat widget is already loaded on this page. Click the chat button in the corner to start a conversation!</p>
            <p><strong>Current Configuration:</strong></p>
            <ul style="text-align: left; display: inline-block;">
                <li>Endpoint: ${endpoint}</li>
                <li>Position: ${position}</li>
                <li>Color: ${primaryColor}</li>
            </ul>
        </div>
    </div>

    <!-- Load the widget -->
    <script src="${endpoint}/widget.js" 
            data-endpoint="${endpoint}"
            data-position="${position}"
            data-primary-color="${primaryColor}"></script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(demoHTML);
  });

  const httpServer = createServer(app);
  return httpServer;
}
