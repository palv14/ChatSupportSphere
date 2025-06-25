import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  website: text("website"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  message: text("message"),
  sender: text("sender").notNull(), // 'user' or 'bot'
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  hasFiles: boolean("has_files").default(false),
  processingStatus: text("processing_status").default("pending"), // 'pending', 'processing', 'completed', 'failed'
  pythonResponse: text("python_response"), // JSON string
});

export const chatFiles = pgTable("chat_files", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimetype: text("mimetype").notNull(),
  size: integer("size").notNull(),
  path: text("path").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
  processingStatus: true,
  pythonResponse: true,
});

export const insertChatFileSchema = createInsertSchema(chatFiles).omit({
  id: true,
  uploadedAt: true,
});

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatFile = typeof chatFiles.$inferSelect;
export type InsertChatFile = z.infer<typeof insertChatFileSchema>;

export const widgetConfigSchema = z.object({
  endpoint: z.string().url(),
  position: z.enum(["bottom-right", "bottom-left", "top-right", "top-left"]).default("bottom-right"),
  primaryColor: z.string().default("#6366F1"),
  website: z.string().optional(),
});

export type WidgetConfig = z.infer<typeof widgetConfigSchema>;
