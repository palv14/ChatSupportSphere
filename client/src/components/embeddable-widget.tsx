import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { 
  MessageCircle, 
  X, 
  Send, 
  Paperclip, 
  User, 
  Bot, 
  Upload,
  FileText,
  Image as ImageIcon,
  Loader2,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Standalone query client for the embeddable widget
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

interface WidgetConfig {
  endpoint: string;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  primaryColor: string;
  website?: string;
}

interface ChatMessage {
  id: number;
  message: string | null;
  sender: 'user' | 'bot';
  timestamp: string;
  hasFiles: boolean;
  processingStatus: string;
  pythonResponse: string | null;
  files?: ChatFile[];
}

interface ChatFile {
  id: number;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
}

// Utility functions
const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ');
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const getFileIcon = (mimetype: string) => {
  if (mimetype.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
};

// API helper
const apiRequest = async (method: string, url: string, data?: any) => {
  const fullUrl = url.startsWith('http') ? url : `${window.CHAT_WIDGET_CONFIG.endpoint}${url}`;
  
  const options: RequestInit = {
    method,
    credentials: 'include',
    headers: data ? { 'Content-Type': 'application/json' } : {},
  };

  if (data && !(data instanceof FormData)) {
    options.body = JSON.stringify(data);
  } else if (data instanceof FormData) {
    delete options.headers;
    options.body = data;
  }

  const response = await fetch(fullUrl, options);
  
  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }
  
  return response;
};

function EmbeddableWidget({ config }: { config: WidgetConfig }) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Create or get session
  const { data: session } = useQuery({
    queryKey: ['/api/chat/session'],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/chat/session', {
        sessionId,
        website: config.website || window.location.origin
      });
      return response.json();
    },
    enabled: isOpen
  });

  // Get messages for the session
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/chat/messages', session?.sessionId],
    queryFn: async () => {
      if (!session?.sessionId) return [];
      const response = await fetch(`${config.endpoint}/api/chat/messages/${session.sessionId}`);
      return response.json();
    },
    enabled: !!session?.sessionId,
    refetchInterval: 2000
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, files }: { message: string; files: File[] }) => {
      const formData = new FormData();
      formData.append('sessionId', session?.sessionId || '');
      formData.append('message', message);
      formData.append('sender', 'user');
      
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch(`${config.endpoint}/api/chat/message`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/messages'] });
      setMessage("");
      setAttachedFiles([]);
    },
    onError: (error) => {
      console.error('Failed to send message:', error);
    }
  });

  useEffect(() => {
    if (session?.sessionId && !sessionId) {
      setSessionId(session.sessionId);
    }
  }, [session]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = () => {
    if (!message.trim() && attachedFiles.length === 0) return;
    if (!session?.sessionId) return;

    sendMessageMutation.mutate({ message, files: attachedFiles });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} is larger than 10MB`);
        return false;
      }
      return true;
    });
    
    setAttachedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} is larger than 10MB`);
        return false;
      }
      return true;
    });
    
    setAttachedFiles(prev => [...prev, ...validFiles]);
  };

  const getPositionStyles = () => {
    const base = 'fixed z-[999999]';
    switch (config.position) {
      case 'bottom-left':
        return `${base} bottom-6 left-6`;
      case 'top-right':
        return `${base} top-6 right-6`;
      case 'top-left':
        return `${base} top-6 left-6`;
      default:
        return `${base} bottom-6 right-6`;
    }
  };

  if (!isOpen) {
    return (
      <div className={getPositionStyles()}>
        <motion.button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-transform text-white flex items-center justify-center relative"
          style={{ backgroundColor: config.primaryColor }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
        >
          <MessageCircle className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            1
          </span>
        </motion.button>
      </div>
    );
  }

  return (
    <div className={getPositionStyles()}>
      <motion.div
        className="w-80 h-96 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        {/* Header */}
        <div 
          className="px-4 py-3 rounded-t-lg text-white flex items-center justify-between"
          style={{ backgroundColor: config.primaryColor }}
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-medium text-sm">Support Chat</h3>
              <p className="text-xs opacity-90">We're here to help</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white hover:text-gray-200 hover:bg-white/10 h-8 w-8 rounded flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div 
          className="flex-1 overflow-y-auto p-4 space-y-3 relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragOver && (
            <div className="absolute inset-4 border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg flex items-center justify-center z-10">
              <div className="text-center">
                <Upload className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-blue-600">Drop files here</p>
              </div>
            </div>
          )}

          {messagesLoading ? (
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              {/* Welcome message */}
              <div className="flex items-start space-x-2">
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  <Bot className="h-3 w-3 text-white" />
                </div>
                <div className="bg-gray-100 rounded-lg rounded-tl-none px-3 py-2 max-w-xs">
                  <p className="text-sm text-gray-800">Hello! How can I help you today?</p>
                  <p className="text-xs text-gray-500 mt-1">Just now</p>
                </div>
              </div>

              {/* Chat messages */}
              {messages.map((msg: ChatMessage) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex items-start space-x-2",
                    msg.sender === 'user' && "justify-end"
                  )}
                >
                  {msg.sender === 'bot' && (
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: config.primaryColor }}
                    >
                      <Bot className="h-3 w-3 text-white" />
                    </div>
                  )}
                  
                  <div className={cn(
                    "rounded-lg px-3 py-2 max-w-xs",
                    msg.sender === 'user' 
                      ? "text-white rounded-tr-none" 
                      : "bg-gray-100 rounded-tl-none"
                  )} style={msg.sender === 'user' ? { backgroundColor: config.primaryColor } : {}}>
                    {msg.message && (
                      <p className={cn(
                        "text-sm",
                        msg.sender === 'user' ? "text-white" : "text-gray-800"
                      )}>
                        {msg.message}
                      </p>
                    )}
                    
                    {/* File attachments */}
                    {msg.files && msg.files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {msg.files.map((file) => (
                          <div 
                            key={file.id} 
                            className={cn(
                              "flex items-center space-x-2 p-2 rounded text-xs",
                              msg.sender === 'user' 
                                ? "bg-white bg-opacity-20" 
                                : "bg-gray-50"
                            )}
                          >
                            {getFileIcon(file.mimetype)}
                            <span className="flex-1 truncate">{file.originalName}</span>
                            <span className="text-xs opacity-75">
                              {formatFileSize(file.size)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Processing status */}
                    {msg.sender === 'user' && msg.processingStatus && (
                      <div className="mt-2">
                        {msg.processingStatus === 'processing' && (
                          <div className="flex items-center space-x-2 text-xs opacity-75">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Processing...</span>
                          </div>
                        )}
                        {msg.processingStatus === 'failed' && (
                          <div className="flex items-center space-x-2 text-xs text-red-200">
                            <AlertCircle className="h-3 w-3" />
                            <span>Failed to process</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Python response display */}
                    {msg.pythonResponse && (
                      <div className="mt-2 bg-gray-50 rounded p-2 text-xs">
                        <div className="text-gray-500 mb-1">Response Data:</div>
                        <code className="text-gray-700 text-xs">
                          {JSON.stringify(JSON.parse(msg.pythonResponse), null, 2)}
                        </code>
                      </div>
                    )}
                    
                    <p className={cn(
                      "text-xs mt-1",
                      msg.sender === 'user' ? "opacity-75" : "text-gray-500"
                    )}>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  
                  {msg.sender === 'user' && (
                    <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="h-3 w-3 text-white" />
                    </div>
                  )}
                </motion.div>
              ))}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* File preview */}
        {attachedFiles.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-200 space-y-2">
            {attachedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 rounded p-2">
                <div className="flex items-center space-x-2">
                  {getFileIcon(file.type)}
                  <span className="text-sm text-gray-700 truncate">{file.name}</span>
                  <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="h-6 w-6 text-gray-400 hover:text-red-500 flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-end space-x-2">
            <div className="flex-1">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none min-h-[40px] max-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-gray-400 hover:text-gray-600 p-2 rounded"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              onClick={handleSendMessage}
              disabled={(!message.trim() && attachedFiles.length === 0) || sendMessageMutation.isPending}
              className="px-3 py-2 rounded text-white disabled:opacity-50"
              style={{ backgroundColor: config.primaryColor }}
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </motion.div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.gif,.pdf,.txt,.docx"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

// Global initialization function
export function initializeChatWidget(config: WidgetConfig) {
  // Set global config
  (window as any).CHAT_WIDGET_CONFIG = config;

  // Create container
  const container = document.createElement('div');
  container.id = 'chat-widget-root';
  document.body.appendChild(container);

  // Render widget
  const root = createRoot(container);
  root.render(
    <QueryClientProvider client={queryClient}>
      <EmbeddableWidget config={config} />
    </QueryClientProvider>
  );
}

// Auto-initialize from script tag attributes
export function autoInitialize() {
  const scriptTag = document.currentScript as HTMLScriptElement;
  if (!scriptTag) return;

  const config: WidgetConfig = {
    endpoint: scriptTag.getAttribute('data-endpoint') || 'http://localhost:5000',
    position: (scriptTag.getAttribute('data-position') as any) || 'bottom-right',
    primaryColor: scriptTag.getAttribute('data-primary-color') || '#6366F1',
    website: scriptTag.getAttribute('data-website') || window.location.origin
  };

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeChatWidget(config);
    });
  } else {
    initializeChatWidget(config);
  }
}
