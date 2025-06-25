import { 
  chatSessions, 
  chatMessages, 
  chatFiles,
  type ChatSession, 
  type InsertChatSession,
  type ChatMessage,
  type InsertChatMessage,
  type ChatFile,
  type InsertChatFile
} from "@shared/schema";

export interface IStorage {
  // Chat Sessions
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatSession(sessionId: string): Promise<ChatSession | undefined>;
  
  // Chat Messages
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  updateMessageStatus(messageId: number, status: string, pythonResponse?: string): Promise<ChatMessage | undefined>;
  
  // Chat Files
  createChatFile(file: InsertChatFile): Promise<ChatFile>;
  getChatFiles(messageId: number): Promise<ChatFile[]>;
  getMessageWithFiles(messageId: number): Promise<{ message: ChatMessage; files: ChatFile[] } | undefined>;
}

export class MemStorage implements IStorage {
  private sessions: Map<string, ChatSession> = new Map();
  private messages: Map<number, ChatMessage> = new Map();
  private files: Map<number, ChatFile> = new Map();
  private sessionIdCounter = 1;
  private messageIdCounter = 1;
  private fileIdCounter = 1;

  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const id = this.sessionIdCounter++;
    const session: ChatSession = {
      ...insertSession,
      id,
      createdAt: new Date(),
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  async getChatSession(sessionId: string): Promise<ChatSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = this.messageIdCounter++;
    const message: ChatMessage = {
      ...insertMessage,
      id,
      timestamp: new Date(),
      processingStatus: "pending",
      pythonResponse: null,
    };
    this.messages.set(id, message);
    return message;
  }

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return Array.from(this.messages.values())
      .filter(message => message.sessionId === sessionId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async updateMessageStatus(messageId: number, status: string, pythonResponse?: string): Promise<ChatMessage | undefined> {
    const message = this.messages.get(messageId);
    if (message) {
      message.processingStatus = status;
      if (pythonResponse) {
        message.pythonResponse = pythonResponse;
      }
      this.messages.set(messageId, message);
      return message;
    }
    return undefined;
  }

  async createChatFile(insertFile: InsertChatFile): Promise<ChatFile> {
    const id = this.fileIdCounter++;
    const file: ChatFile = {
      ...insertFile,
      id,
      uploadedAt: new Date(),
    };
    this.files.set(id, file);
    return file;
  }

  async getChatFiles(messageId: number): Promise<ChatFile[]> {
    return Array.from(this.files.values()).filter(file => file.messageId === messageId);
  }

  async getMessageWithFiles(messageId: number): Promise<{ message: ChatMessage; files: ChatFile[] } | undefined> {
    const message = this.messages.get(messageId);
    if (message) {
      const files = await this.getChatFiles(messageId);
      return { message, files };
    }
    return undefined;
  }
}

export const storage = new MemStorage();
