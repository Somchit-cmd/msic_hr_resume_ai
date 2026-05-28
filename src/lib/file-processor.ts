import fs from 'fs';
import path from 'path';

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface ExtractionResult {
  text: string;
  fileName: string;
  filePath: string;
}

/**
 * Validates the uploaded file
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds 10MB limit' };
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Unsupported file type: ${ext}. Supported types: ${ALLOWED_EXTENSIONS.join(', ')}` };
  }

  return { valid: true };
}

/**
 * Sanitizes input text to prevent injection attacks
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Saves uploaded file to the local filesystem
 */
export async function saveFile(file: File): Promise<string> {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  
  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Generate unique filename to avoid collisions
  const ext = path.extname(file.name);
  const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = Date.now();
  const uniqueName = `${baseName}_${timestamp}${ext}`;
  const filePath = path.join(uploadsDir, uniqueName);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

/**
 * Extracts text from a PDF file using pdf2json
 */
async function extractFromPDF(filePath: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFParser = require('pdf2json');
  
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on('pdfParser_dataReady', (pdfData: { Pages: Array<{ Texts: Array<{ R: Array<{ T: string }> }> }> }) => {
      try {
        const text = pdfData.Pages.map((page) =>
          page.Texts.map((text) =>
            text.R.map((r) => {
              try {
                return decodeURIComponent(r.T);
              } catch {
                return r.T;
              }
            }).join('')
          ).join(' ')
        ).join('\n');
        resolve(text);
      } catch (error) {
        reject(new Error(`Failed to parse PDF data: ${(error as Error).message}`));
      }
    });
    
    pdfParser.on('pdfParser_dataError', (error: { parserError: Error }) => {
      reject(new Error(`PDF parsing error: ${error.parserError?.message || 'Unknown error'}`));
    });
    
    pdfParser.loadPDF(filePath);
  });
}

/**
 * Extracts text from a DOCX file
 */
async function extractFromDOCX(filePath: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

/**
 * Main extraction function - routes to the correct extractor based on file extension
 */
export async function extractTextFromFile(filePath: string, fileName: string): Promise<string> {
  const ext = path.extname(fileName).toLowerCase();

  let text: string;

  switch (ext) {
    case '.pdf':
      text = await extractFromPDF(filePath);
      break;
    case '.docx':
    case '.doc':
      text = await extractFromDOCX(filePath);
      break;
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Could not extract any text from the file. The file may be empty or corrupted.');
  }

  return sanitizeText(text);
}
