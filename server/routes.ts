import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
import express from "express";
import { storage } from "./storage";
import { upload, processUploadedFiles, handleFileUpload } from "./services/file-handler";
import { pythonExecutor } from "./services/python-executor";
import { insertChatSessionSchema, insertChatMessageSchema, widgetConfigSchema } from "@shared/schema";
import { nanoid } from "nanoid";
import path from "path";

// Simple in-memory rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const rateLimit = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Skip rate limiting for OPTIONS requests (preflight)
    if (req.method === 'OPTIONS') {
      return next();
    }
    
    const key = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    const userRequests = rateLimitStore.get(key);
    
    if (!userRequests || userRequests.resetTime < now) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (userRequests.count >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }

    userRequests.count++;
    next();
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static assets directly (before CORS middleware)
  app.use('/assets', express.static(path.join(process.cwd(), 'dist', 'public', 'assets')));

  // Enable CORS with proper restrictions
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000', 
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    // Add your Azure Web App domain here
    'https://gyrussupportagent-g6aaf9gndgh2g3hu.eastus-01.azurewebsites.net'
  ];
  
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // In development, be more permissive
      if (process.env.NODE_ENV === 'development') {
        // Allow localhost and 127.0.0.1 variations
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          return callback(null, true);
        }
      }
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400 // Cache preflight for 24 hours
  }));

  // Handle CORS errors gracefully
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.message === 'Not allowed by CORS') {
      console.error('CORS Error:', {
        origin: req.get('origin'),
        allowedOrigins,
        nodeEnv: process.env.NODE_ENV
      });
      return res.status(403).json({ 
        error: 'CORS policy violation',
        message: 'Origin not allowed by CORS policy'
      });
    }
    next(err);
  });

  // Serve uploaded files with authentication check
  app.use('/api/files', (req, res, next) => {
    // Add basic authentication check for file access
    const sessionId = req.query.sessionId;
    if (!sessionId) {
      return res.status(401).json({ error: 'Session ID required for file access' });
    }
    next();
  }, express.static('uploads'));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Create or get chat session
  app.post('/api/chat/session', rateLimit(50, 15 * 60 * 1000), async (req, res) => {
    try {
      console.log('[DEBUG] Session creation request:', {
        body: req.body,
        origin: req.get('origin'),
        referer: req.get('referer'),
        userAgent: req.get('user-agent')
      });
      
      const { sessionId, website } = req.body;
      
      if (sessionId) {
        const existingSession = await storage.getChatSession(sessionId);
        if (existingSession) {
          console.log('[DEBUG] Returning existing session:', existingSession.sessionId);
          return res.json(existingSession);
        }
      }

      const newSessionId = sessionId || nanoid();
      const sessionData = insertChatSessionSchema.parse({
        sessionId: newSessionId,
        website: website || req.get('origin') || req.get('referer')
      });

      console.log('[DEBUG] Creating new session:', sessionData);
      const session = await storage.createChatSession(sessionData);
      console.log('[DEBUG] Session created successfully:', session.sessionId);
      res.json(session);
    } catch (error) {
      console.error('Error creating/getting chat session:', error);
      const isDevelopment = process.env.NODE_ENV === 'development';
      res.status(500).json({ 
        error: 'Failed to create or get chat session',
        details: isDevelopment ? error instanceof Error ? error.message : 'Unknown error' : undefined
      });
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
      const isDevelopment = process.env.NODE_ENV === 'development';
      res.status(500).json({ 
        error: 'Failed to fetch chat messages',
        details: isDevelopment ? error instanceof Error ? error.message : 'Unknown error' : undefined
      });
    }
  });

  // Send a new chat message
  app.post('/api/chat/message', rateLimit(30, 15 * 60 * 1000), upload.array('files', 5), async (req, res) => {
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
                hasFiles: false,
                processingStatus: 'completed',
                pythonResponse: JSON.stringify(result.output)
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

      // Immediately return the user message and files
      res.json({ ...chatMessage, files: savedFiles });
    } catch (error) {
      console.error('Error sending chat message:', error);
      const isDevelopment = process.env.NODE_ENV === 'development';
      res.status(500).json({ 
        error: 'Failed to send chat message',
        details: isDevelopment ? error instanceof Error ? error.message : 'Unknown error' : undefined
      });
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
      const isDevelopment = process.env.NODE_ENV === 'development';
      res.status(500).json({ 
        error: 'Failed to fetch message status',
        details: isDevelopment ? error instanceof Error ? error.message : 'Unknown error' : undefined
      });
    }
  });

  // Submit feedback for a message
  app.post('/api/feedback', rateLimit(20, 15 * 60 * 1000), async (req, res) => {
    try {
      const { sessionId, messageId, isHelpful } = req.body;
      
      // Validate input
      if (!sessionId || !messageId || typeof isHelpful !== 'boolean') {
        return res.status(400).json({ error: 'Missing required fields: sessionId, messageId, isHelpful' });
      }

      // Verify session exists
      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Check if feedback already exists for this message
      const existingFeedback = await storage.getFeedbackForMessage(parseInt(messageId));
      
      let feedback;
      if (existingFeedback) {
        // Update existing feedback
        feedback = await storage.updateFeedback(existingFeedback.id, isHelpful);
        console.log('[DEBUG] Feedback updated:', {
          sessionId,
          messageId,
          isHelpful,
          feedbackId: feedback.id,
          action: 'updated'
        });
      } else {
        // Create new feedback
        feedback = await storage.createFeedback({
          sessionId,
          messageId: parseInt(messageId),
          isHelpful
        });
        console.log('[DEBUG] Feedback submitted:', {
          sessionId,
          messageId,
          isHelpful,
          feedbackId: feedback.id,
          action: 'created'
        });
      }

      res.json({ success: true, feedback });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      const isDevelopment = process.env.NODE_ENV === 'development';
      res.status(500).json({ 
        error: 'Failed to submit feedback',
        details: isDevelopment ? error instanceof Error ? error.message : 'Unknown error' : undefined
      });
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
