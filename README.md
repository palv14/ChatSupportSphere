# SupportSphere

An embeddable chat support widget with Python script integration for processing messages and file attachments.

## Features

- **Real-time Chat**: Instant messaging with smooth animations
- **File Uploads**: Support for images, PDFs, and documents (up to 10MB per file)
- **Python Integration**: Custom script processing for messages and attachments
- **Cross-domain Support**: Embed on any website with a single script tag
- **Customizable**: Configurable colors, positioning, and branding
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Environment Setup

### Required Environment Variables

Before running the application, you need to set up your environment variables. Copy the example file and fill in your values:

```bash
# Copy the example environment file
cp python/env.example python/.env

# Edit the .env file with your actual values
```

#### Required Variables:

- `AZURE_AI_ENDPOINT`: Your Azure AI Services endpoint URL
- `AZURE_AGENT_ID`: Your Azure AI agent ID

#### Example .env file:
```env
AZURE_AI_ENDPOINT=https://your-endpoint.services.ai.azure.com/api/projects/YourProject
AZURE_AGENT_ID=your_agent_id_here
```

### Security Notes

⚠️ **Important**: Never commit your `.env` file to version control. The `.gitignore` file is configured to exclude it automatically.

## Security Features

This application includes several security measures to protect against common vulnerabilities:

### 🔒 **Implemented Security Measures**

1. **CORS Protection**: Restrictive CORS configuration that only allows specified origins
2. **File Upload Security**: 
   - File type validation (images, PDFs, documents only)
   - File size limits (10MB per file, 5 files per request)
   - Path traversal protection
   - Secure file storage with UUID-based naming
3. **Rate Limiting**: API endpoints are rate-limited to prevent abuse
4. **Input Validation**: All inputs are validated using Zod schemas
5. **Error Handling**: Secure error messages that don't leak sensitive information in production
6. **File Access Control**: Uploaded files require session authentication for access

### 🔧 **Security Configuration**

Set these environment variables for production:

```env
# Security
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
NODE_ENV=production

# Azure AI Services
AZURE_AI_ENDPOINT=https://your-endpoint.services.ai.azure.com/api/projects/YourProject
AZURE_AGENT_ID=your_agent_id_here
```

### 🛡️ **Additional Security Recommendations**

1. **Use HTTPS**: Always use HTTPS in production
2. **Database Security**: Use strong database passwords and connection strings
3. **Regular Updates**: Keep dependencies updated
4. **Monitoring**: Implement logging and monitoring for suspicious activity
5. **Backup Strategy**: Regular backups of chat data and uploaded files

## Azure Blob Storage Integration

This project uses Azure Blob Storage to store incoming attachments.

### Prerequisites
- An Azure Storage Account
- A Blob Container created in your storage account

### Local Development Setup
1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Create a `.env` file in the project root:**
   Copy from `env.example` and fill in your values:
   ```env
   AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=youraccount;AccountKey=yourkey;EndpointSuffix=core.windows.net
   AZURE_STORAGE_CONTAINER_NAME=your-container-name
   ```
3. **Start the backend server:**
   ```sh
   npm run dev
   # or your usual backend start command
   ```

### Azure Deployment Setup
1. **Set environment variables in Azure Portal:**
   - Go to your Web App > Configuration > Application settings
   - Add:
     - `AZURE_STORAGE_CONNECTION_STRING` (paste from Storage Account > Access keys)
     - `AZURE_STORAGE_CONTAINER_NAME` (your blob container name)
   - Save and restart your app

### Troubleshooting
- **Environment variable not found:** Ensure `.env` exists and `dotenv` is installed. The backend loads `.env` via `import 'dotenv/config';` in `server/index.ts`.
- **Invalid connection string:** Copy the exact connection string from Azure Portal. It must include `DefaultEndpointsProtocol=https`.
- **File upload errors:** Check that your container exists and the connection string is correct.

### Backend Requirements
- Node.js
- `dotenv` package (installed automatically)
- `@azure/storage-blob` package (installed automatically)

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