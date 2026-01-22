import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads', 'task-attachments');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Dedicated directory for event agendas
const agendaUploadsDir = path.join(process.cwd(), 'uploads', 'event-agendas');
if (!fs.existsSync(agendaUploadsDir)) {
  fs.mkdirSync(agendaUploadsDir, { recursive: true });
}

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Agenda MIME types (PDF only)
const AGENDA_MIME_TYPES = ['application/pdf'];

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Allowed types: images (jpg, png, gif, webp), PDF, ZIP`));
  }
};

// Create multer upload instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

// Storage for agenda PDFs
const agendaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, agendaUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const agendaFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (AGENDA_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed for agendas'));
  }
};

export const agendaUpload = multer({
  storage: agendaStorage,
  fileFilter: agendaFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

// Photo upload (in memory for MinIO)
const photoStorage = multer.memoryStorage();

const photoFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (imageTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed'));
  }
};

export const photoUpload = multer({
  storage: photoStorage,
  fileFilter: photoFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per photo
    files: 20,
  },
});

// Helper to get file path
export function getFilePath(storedFileName: string): string {
  return path.join(uploadsDir, storedFileName);
}

export function getAgendaFilePath(storedFileName: string): string {
  return path.join(agendaUploadsDir, storedFileName);
}

// Helper to delete file
export function deleteFile(storedFileName: string): void {
  const filePath = getFilePath(storedFileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function deleteAgendaFile(storedFileName: string): void {
  const filePath = getAgendaFilePath(storedFileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
