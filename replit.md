# Chat Support Widget - System Architecture

## Overview

This is a full-stack chat support widget application built with React (frontend), Express.js (backend), and PostgreSQL (database). The system provides an embeddable chat widget that can be integrated into any website, allowing visitors to communicate with support representatives through real-time messaging with file upload capabilities.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query for server state, React hooks for local state
- **Animations**: Framer Motion for smooth transitions
- **Routing**: Wouter for lightweight client-side routing

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL
- **File Handling**: Multer for multipart file uploads
- **Session Management**: Session-based chat tracking
- **Python Integration**: Child process execution for custom processing logic
- **CORS**: Configured for cross-origin requests to support widget embedding

### Database Schema
- **chat_sessions**: Stores chat session metadata (session ID, website, creation time)
- **chat_messages**: Stores individual messages with sender, content, processing status
- **chat_files**: Stores file attachments linked to messages

## Key Components

### Widget System
- **Embeddable Widget**: Standalone JavaScript file that can be embedded on any website
- **Chat Interface**: Real-time messaging interface with typing indicators and status updates
- **File Upload**: Support for images, PDFs, documents with drag-and-drop functionality
- **Responsive Design**: Adapts to different screen sizes and positions

### Message Processing
- **Python Executor**: Processes messages and attachments through Python scripts
- **Status Tracking**: Real-time updates on message processing status
- **File Analysis**: Automated analysis of uploaded files with AI/ML integration capabilities

### Configuration Management
- **Dynamic Configuration**: Widget appearance and behavior configurable via script attributes
- **Multi-tenant Support**: Different configurations per website/domain
- **Theme Customization**: Primary color and positioning options

## Data Flow

1. **Widget Initialization**: Script loads, creates session, establishes connection
2. **Message Creation**: User sends message → stored in database → queued for processing
3. **File Processing**: Uploaded files → stored locally → analyzed by Python scripts
4. **Response Generation**: Python processing → AI/ML analysis → response generation
5. **Real-time Updates**: Status updates propagated to frontend via polling/webhooks

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection
- **drizzle-orm**: Type-safe database operations
- **@tanstack/react-query**: Server state management
- **multer**: File upload handling
- **nanoid**: Unique ID generation

### UI Dependencies
- **@radix-ui/***: Accessible component primitives
- **tailwindcss**: Utility-first CSS framework
- **framer-motion**: Animation library
- **lucide-react**: Icon library

### Development Dependencies
- **vite**: Build tool and development server
- **typescript**: Type checking and compilation
- **esbuild**: Fast JavaScript bundler for production

## Deployment Strategy

### Development Environment
- **Hot Reloading**: Vite development server with HMR
- **Database**: Local PostgreSQL or cloud database connection
- **File Storage**: Local filesystem for uploaded files

### Production Build
- **Frontend**: Static files built with Vite, served from `/dist/public`
- **Backend**: Node.js server compiled with esbuild
- **Database**: PostgreSQL with connection pooling
- **File Storage**: Local filesystem with potential for cloud storage integration

### Replit Configuration
- **Modules**: Node.js 20, PostgreSQL 16, web server
- **Build Process**: `npm run build` creates production assets
- **Runtime**: `npm run start` serves the production application
- **Port Configuration**: External port 80 mapped to internal port 5000

## Changelog

```
Changelog:
- June 25, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```