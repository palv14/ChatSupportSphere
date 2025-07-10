import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { uploadToAzureBlob } from "./azure-blob";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter for allowed types
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per request
  }
});

export interface ProcessedFile {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
}

export function processUploadedFiles(files: Express.Multer.File[]): ProcessedFile[] {
  return files.map(file => ({
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path
  }));
}

export function cleanupFiles(filePaths: string[]): void {
  filePaths.forEach(filePath => {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(`Failed to delete file ${filePath}:`, err);
      }
    });
  });
}

// Example function to handle file upload
export async function handleFileUpload(file: { buffer: Buffer, originalname: string, mimetype: string }) {
  // Generate a unique blob name if needed
  const blobName = `${Date.now()}-${file.originalname}`;
  const blobUrl = await uploadToAzureBlob(file.buffer, blobName, file.mimetype);
  return blobUrl;
}
