import express from 'express';
import dotenv from 'dotenv';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_DIR = path.resolve(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'library-db.json');

interface PersistedBook {
  isbn: string;
  title: string;
  author: string;
  category: string;
  publicationYear: number;
  totalCopies: number;
  availableCopies: number;
  holdQueue: string[];
  coverImage?: string;
}

interface PersistedLoan {
  loanId: string;
  isbn: string;
  memberId: string;
  checkoutDate: string;
  dueDate: string;
  returnDate: string | null;
  fineAssessed: number;
}

interface PersistedLibraryState {
  books: PersistedBook[];
  members: unknown[];
  loans: PersistedLoan[];
  simulationDate: string;
}

let dbOperationChain: Promise<void> = Promise.resolve();

function enqueueDbOperation<T>(op: () => Promise<T>): Promise<T> {
  const next = dbOperationChain.then(op, op);
  dbOperationChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function readLibraryDb(): Promise<PersistedLibraryState | null> {
  try {
    const raw = await readFile(DB_PATH, 'utf8');
    return JSON.parse(raw) as PersistedLibraryState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

async function writeLibraryDb(state: PersistedLibraryState): Promise<void> {
  await mkdir(DB_DIR, { recursive: true });
  const tempPath = `${DB_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, JSON.stringify(state, null, 2), 'utf8');
  await rename(tempPath, DB_PATH);
}

const ALLOWED_CATEGORIES = [
  'FICTION',
  'CLASSICS',
  'MYSTERY',
  'FANTASY',
  'HISTORY',
  'BIOGRAPHY',
  'SCIENCE',
  'PHILOSOPHY',
  'COMPUTER_SCIENCE',
  'ENGINEERING',
] as const;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  app.get('/api/library', async (_req, res) => {
    try {
      const data = await enqueueDbOperation(() => readLibraryDb());
      if (!data) {
        res.json({ initialized: false });
        return;
      }
      res.json({ initialized: true, data });
    } catch (err) {
      console.error('Error reading library database:', err);
      res.status(500).json({ error: 'Failed to load library database.' });
    }
  });

  app.put('/api/library', async (req, res) => {
    try {
      const body = req.body as Partial<PersistedLibraryState>;
      if (
        !body ||
        !Array.isArray(body.books) ||
        !Array.isArray(body.members) ||
        !Array.isArray(body.loans) ||
        typeof body.simulationDate !== 'string'
      ) {
        res.status(400).json({ error: 'Invalid library database payload.' });
        return;
      }

      const nextState: PersistedLibraryState = {
        books: body.books,
        members: body.members,
        loans: body.loans,
        simulationDate: body.simulationDate,
      };

      await enqueueDbOperation(() => writeLibraryDb(nextState));
      res.json({ ok: true });
    } catch (err) {
      console.error('Error saving library database:', err);
      res.status(500).json({ error: 'Failed to save library database.' });
    }
  });

  app.delete('/api/books/:isbn', async (req, res) => {
    try {
      const rawIsbn = req.params.isbn;
      const isbn = decodeURIComponent(rawIsbn).trim();
      if (!isbn) {
        res.status(400).json({ error: 'Book ISBN is required.' });
        return;
      }

      const result = await enqueueDbOperation(async () => {
        const db = await readLibraryDb();
        if (!db) {
          return { status: 404 as const, error: 'Library database is not initialized.' };
        }

        const targetBook = db.books.find((b) => b.isbn === isbn);
        if (!targetBook) {
          return { status: 404 as const, error: `EntityNotFoundException: Book not found with ISBN ${isbn}.` };
        }

        const activeLoans = db.loans.filter((l) => l.isbn === isbn && l.returnDate === null);
        if (activeLoans.length > 0) {
          return {
            status: 409 as const,
            error: `Cannot delete "${targetBook.title}" while ${activeLoans.length} ${
              activeLoans.length === 1 ? 'copy is' : 'copies are'
            } currently borrowed. Return all active loans first.`,
          };
        }

        const updatedState: PersistedLibraryState = {
          ...db,
          books: db.books.filter((b) => b.isbn !== isbn),
        };
        await writeLibraryDb(updatedState);
        return { status: 200 as const, state: updatedState, deletedBook: targetBook };
      });

      if (result.status !== 200) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      res.json({ state: result.state, deletedBook: result.deletedBook });
    } catch (err) {
      console.error('Error deleting book from database:', err);
      res.status(500).json({ error: 'Failed to delete book from database.' });
    }
  });

  app.post('/api/extract-book', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body as {
        imageBase64?: string;
        mimeType?: string;
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Book cover image is required.' });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          error: 'GEMINI_API_KEY is not configured. Please add it in Settings > Secrets.',
        });
        return;
      }

      const cleanedBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
      const resolvedMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: resolvedMime,
                data: cleanedBase64,
              },
            },
            {
              text:
                'Inspect this book cover photo and extract the exact book title and author name(s). ' +
                'Also extract the ISBN if printed on the cover/back, pick the closest matching library category, ' +
                'and provide the publication year if known or visible (or 0 if unknown). ' +
                'If multiple authors appear, join them with ", ". If no author is visible, return an empty string.',
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'The main book title shown on the cover.',
              },
              author: {
                type: Type.STRING,
                description: 'The author name(s) shown on the cover.',
              },
              isbn: {
                type: Type.STRING,
                description: 'The ISBN if visible, otherwise empty string.',
              },
              category: {
                type: Type.STRING,
                description:
                  'One of: FICTION, CLASSICS, MYSTERY, FANTASY, HISTORY, BIOGRAPHY, SCIENCE, PHILOSOPHY, COMPUTER_SCIENCE, ENGINEERING.',
              },
              publicationYear: {
                type: Type.INTEGER,
                description: '4-digit publication year if visible or known, or 0.',
              },
            },
            required: ['title', 'author', 'isbn', 'category', 'publicationYear'],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as {
        title?: string;
        author?: string;
        isbn?: string;
        category?: string;
        publicationYear?: number;
      };

      const normalizedCat = (parsed.category ?? 'FICTION').toUpperCase().trim();
      const validCategory = (ALLOWED_CATEGORIES as readonly string[]).includes(normalizedCat)
        ? normalizedCat
        : 'FICTION';

      res.json({
        title: (parsed.title ?? '').trim(),
        author: (parsed.author ?? '').trim(),
        isbn: (parsed.isbn ?? '').trim(),
        category: validCategory,
        publicationYear:
          parsed.publicationYear && parsed.publicationYear >= 1450 && parsed.publicationYear <= 2100
            ? parsed.publicationYear
            : new Date().getFullYear(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to extract book details.';
      console.error('Error in /api/extract-book:', err);
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, '..', 'vite.config.ts'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, '..', 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LibraryManagementSystem server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
