# Chat Support Widget

An embeddable chat support widget with Python script integration for processing messages and file attachments.

## Features

- **Real-time Chat**: Instant messaging with smooth animations
- **File Uploads**: Support for images, PDFs, and documents (up to 10MB per file)
- **Python Integration**: Custom script processing for messages and attachments
- **Cross-domain Support**: Embed on any website with a single script tag
- **Customizable**: Configurable colors, positioning, and branding
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Quick Start

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone <your-repo-url>
cd chat-support-widget
npm install
```

### 2. Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5000`

### 3. Embedding the Widget

Add this single line to any website to embed the chat widget:

```html
<script src="http://your-domain.com/widget.js" 
        data-endpoint="http://your-domain.com"
        data-position="bottom-right"
        data-primary-color="#6366F1"></script>
```

## Configuration Options

| Attribute | Description | Default | Options |
|-----------|-------------|---------|---------|
| `data-endpoint` | Your API endpoint URL | Required | Any valid URL |
| `data-position` | Widget position | `bottom-right` | `bottom-right`, `bottom-left`, `top-right`, `top-left` |
| `data-primary-color` | Primary color (hex) | `#6366F1` | Any hex color |

## Python Script Integration

### Default Script Location

The widget processes messages using `python/initialize.py`. This script receives JSON input and should return JSON output.

### Input Format

```json
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
```

### Output Format

```json
{
  "response": "Response message to display to user",
  "confidence": 0.95,
  "intent": "detected_intent",
  "entities": ["extracted", "entities"],
  "actions": ["action1", "action2"],
  "metadata": {}
}
```

### Customizing the Python Script

1. Edit `python/initialize.py`
2. Implement your custom logic in the processing functions
3. Integrate with AI/ML models, databases, or external APIs
4. Return appropriate JSON responses

## API Endpoints

- `POST /api/chat/session` - Create or get chat session
- `GET /api/chat/messages/:sessionId` - Get messages for session
- `POST /api/chat/message` - Send new message with optional file attachments
- `GET /widget.js` - Embeddable widget script
- `GET /widget` - Demo page

## File Upload Support

Supported file types:
- **Images**: JPG, PNG, GIF
- **Documents**: PDF, TXT, DOCX
- **Limits**: 10MB per file, 5 files per message

## Deployment

### Production Build

```bash
npm run build
npm run start
```

### Environment Variables

No environment variables are required for basic functionality. The system uses in-memory storage by default.

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Database**: In-memory storage (easily replaceable)
- **File Handling**: Multer for uploads
- **Python Integration**: Child process execution
- **UI Components**: Shadcn/ui + Tailwind CSS

## Development

### Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/        # Application pages
│   │   └── lib/          # Utilities and query client
│   └── public/           # Static assets including widget.js
├── server/                # Backend Express application
│   ├── services/         # Business logic services
│   └── routes.ts         # API route definitions
├── python/               # Python processing scripts
├── shared/               # Shared types and schemas
└── uploads/              # File upload directory
```

### Adding New Features

1. Update shared schemas in `shared/schema.ts`
2. Implement storage methods in `server/storage.ts`
3. Add API routes in `server/routes.ts`
4. Create frontend components in `client/src/components/`
5. Update the embeddable widget in `client/public/widget.js`

## License

MIT License - see LICENSE file for details.

## Support

For support and questions, please open an issue in the GitHub repository.