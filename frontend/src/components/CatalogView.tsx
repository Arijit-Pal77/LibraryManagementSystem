import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Camera,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  BOOK_CATEGORY_LABELS,
  Book,
  BookCategory,
  LibraryState,
  MEMBER_TIER_RULES,
  addDaysIso,
  formatInr,
  getLoanAccruedFine,
  getLoanDaysOverdue,
  performAddOrRestockBook,
  performCheckoutBook,
  performPlaceHold,
  performReturnBook,
} from '../lib/libraryEngine';

interface CatalogViewProps {
  state: LibraryState;
  onUpdateState: (next: LibraryState) => void;
  onDeleteBook: (isbn: string) => Promise<Book>;
  onNotify: (message: string, tone?: 'success' | 'error') => void;
}

const CATEGORIES: Array<'ALL' | BookCategory> = [
  'ALL',
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
];

async function readAndCompressImage(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Invalid image data.'));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format.'));
      img.onload = () => {
        const maxDim = 1000;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: result, mimeType: file.type || 'image/jpeg' });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);
        resolve({ dataUrl: compressed, mimeType: 'image/jpeg' });
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

function generateCatalogIsbn(): string {
  const suffix = String(Date.now()).slice(-6);
  return `LIB-${suffix}`;
}

export function CatalogView({
  state,
  onUpdateState,
  onDeleteBook,
  onNotify,
}: CatalogViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | BookCategory>('ALL');
  const [availableOnly, setAvailableOnly] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [isbn, setIsbn] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState<BookCategory>('FICTION');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [copies, setCopies] = useState('2');
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);
  const [extracting, setExtracting] = useState(false);
  const [extractionNote, setExtractionNote] = useState<string | null>(null);
  const [autoRegisterOnScan, setAutoRegisterOnScan] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [checkoutTarget, setCheckoutTarget] = useState<Book | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState(state.members[0]?.memberId ?? '');

  const [returnTarget, setReturnTarget] = useState<Book | null>(null);

  const [holdTarget, setHoldTarget] = useState<Book | null>(null);
  const [holdMemberId, setHoldMemberId] = useState(state.members[0]?.memberId ?? '');

  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.books
      .filter((b) => categoryFilter === 'ALL' || b.category === categoryFilter)
      .filter((b) => !availableOnly || b.availableCopies > 0)
      .filter(
        (b) =>
          !q ||
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.isbn.toLowerCase().includes(q)
      )
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [state.books, searchQuery, categoryFilter, availableOnly]);

  const totalCopies = useMemo(
    () => state.books.reduce((sum, b) => sum + b.totalCopies, 0),
    [state.books]
  );
  const availableCopies = useMemo(
    () => state.books.reduce((sum, b) => sum + b.availableCopies, 0),
    [state.books]
  );

  const resetAddForm = () => {
    setIsbn('');
    setTitle('');
    setAuthor('');
    setCategory('FICTION');
    setYear(String(new Date().getFullYear()));
    setCopies('2');
    setCoverImage(undefined);
    setExtractionNote(null);
    setExtracting(false);
  };

  const openAddModal = (autoRegister: boolean) => {
    resetAddForm();
    setAutoRegisterOnScan(autoRegister);
    setShowAddModal(true);
  };

  const extractFromPhoto = async (dataUrl: string, mimeType: string, autoRegister: boolean) => {
    setExtracting(true);
    setExtractionNote('Reading book title and author from cover photo...');
    try {
      const response = await fetch('/api/extract-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: dataUrl, mimeType }),
      });
      const payload = (await response.json()) as {
        title?: string;
        author?: string;
        isbn?: string;
        category?: BookCategory;
        publicationYear?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Could not extract book details from image.');
      }

      const extractedTitle = (payload.title ?? '').trim();
      const extractedAuthor = (payload.author ?? '').trim();
      const resolvedIsbn = (payload.isbn ?? '').trim() || isbn.trim() || generateCatalogIsbn();
      const resolvedCategory = payload.category ?? category;
      const resolvedYear =
        payload.publicationYear && payload.publicationYear >= 1450
          ? payload.publicationYear
          : Number(year) || new Date().getFullYear();

      setTitle(extractedTitle);
      setAuthor(extractedAuthor);
      setIsbn(resolvedIsbn);
      setCategory(resolvedCategory);
      setYear(String(resolvedYear));

      if (!extractedTitle) {
        setExtractionNote('Cover uploaded, but no title was detected. Please enter title manually.');
        return;
      }

      if (autoRegister) {
        const result = performAddOrRestockBook(state, {
          isbn: resolvedIsbn,
          title: extractedTitle,
          author: extractedAuthor || 'Unknown',
          category: resolvedCategory,
          publicationYear: resolvedYear,
          copies: Number(copies) || 1,
          coverImage: dataUrl,
        });
        onUpdateState(result.state);
        onNotify(
          result.restocked
            ? `Restocked "${result.book.title}" (+${copies} copies)`
            : `Registered "${result.book.title}" by ${result.book.author} from cover photo`
        );
        resetAddForm();
        setShowAddModal(false);
      } else {
        setExtractionNote(
          `Extracted "${extractedTitle}"${extractedAuthor ? ` by ${extractedAuthor}` : ''}. Review details and save.`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Extraction failed.';
      setExtractionNote(msg);
      onNotify(msg, 'error');
    } finally {
      setExtracting(false);
    }
  };

  const handlePhotoSelect = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { dataUrl, mimeType } = await readAndCompressImage(file);
      setCoverImage(dataUrl);
      await extractFromPhoto(dataUrl, mimeType, autoRegisterOnScan);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load image.';
      setExtractionNote(msg);
      onNotify(msg, 'error');
    }
  };

  const handleAddBook = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resolvedIsbn = isbn.trim() || generateCatalogIsbn();
      const result = performAddOrRestockBook(state, {
        isbn: resolvedIsbn,
        title,
        author,
        category,
        publicationYear: Number(year),
        copies: Number(copies),
        coverImage,
      });
      onUpdateState(result.state);
      onNotify(
        result.restocked
          ? `Restocked ${result.book.title} (+${copies} copies)`
          : `Added "${result.book.title}" to catalog`
      );
      resetAddForm();
      setShowAddModal(false);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to add book', 'error');
    }
  };

  const handleQuickCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutTarget) return;
    try {
      const result = performCheckoutBook(state, checkoutTarget.isbn, selectedMemberId);
      onUpdateState(result.state);
      onNotify(`Issued loan ${result.loan.loanId} · Due ${result.loan.dueDate}`);
      setCheckoutTarget(null);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Checkout failed', 'error');
    }
  };

  const handleReturnLoan = (loanId: string) => {
    try {
      const result = performReturnBook(state, loanId);
      onUpdateState(result.state);
      onNotify(
        result.fine > 0
          ? `Returned ${loanId} · Assessed overdue fine of ${formatInr(result.fine)}`
          : `Returned ${loanId} on time · No fine`
      );
      const remaining = result.state.loans.filter(
        (l) => returnTarget && l.isbn === returnTarget.isbn && l.returnDate === null
      );
      if (remaining.length === 0) {
        setReturnTarget(null);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Return failed', 'error');
    }
  };

  const memberMap = useMemo(
    () => new Map(state.members.map((m) => [m.memberId, m])),
    [state.members]
  );

  const selectedMember = memberMap.get(selectedMemberId);
  const selectedMemberActiveLoans = useMemo(
    () => state.loans.filter((l) => l.memberId === selectedMemberId && l.returnDate === null).length,
    [state.loans, selectedMemberId]
  );
  const returnTargetLoans = useMemo(() => {
    if (!returnTarget) return [];
    return state.loans.filter((l) => l.isbn === returnTarget.isbn && l.returnDate === null);
  }, [state.loans, returnTarget]);

  const deleteTargetActiveLoans = useMemo(() => {
    if (!deleteTarget) return [];
    return state.loans.filter((l) => l.isbn === deleteTarget.isbn && l.returnDate === null);
  }, [state.loans, deleteTarget]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const deleted = await onDeleteBook(deleteTarget.isbn);
      onNotify(`Deleted "${deleted.title}" (${deleted.isbn}) from the database`);
      setDeleteTarget(null);
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Unable to delete book from database',
        'error'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handlePlaceHold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holdTarget) return;
    try {
      const next = performPlaceHold(state, holdTarget.isbn, holdMemberId);
      onUpdateState(next);
      onNotify(`Added ${holdMemberId} to hold queue for "${holdTarget.title}"`);
      setHoldTarget(null);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Hold failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Summary Strip */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Book Catalog & Inventory
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Browse the collection, add or restock copies, borrow available titles, or return checked-out books.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openAddModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Camera className="h-4 w-4" />
            Scan Book Photo
          </button>
          <button
            type="button"
            onClick={() => openAddModal(false)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add or Restock Book
          </button>
        </div>
      </div>

      {/* Flat Single-Elevation Metrics Bar */}
      <div className="grid grid-cols-2 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white sm:grid-cols-4">
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Catalog Titles</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {state.books.length}
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Total Physical Copies</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {totalCopies}
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Available on Shelf</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {availableCopies}
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Checked Out</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {totalCopies - availableCopies}
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, author, or ISBN..."
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none whitespace-nowrap shrink-0">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(e) => setAvailableOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            Available copies only
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-md bg-slate-100 p-1">
          {CATEGORIES.map((cat) => {
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat === 'ALL' ? 'All Categories' : BOOK_CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Data Grid */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {filteredBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <BookOpen className="h-8 w-8 text-slate-300" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900">No matching books found</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Try clearing your search query or add a new book to the Java repository.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('ALL');
                setAvailableOnly(false);
              }}
              className="mt-4 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="px-4 py-3">ISBN</th>
                  <th className="px-4 py-3">Title & Author</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Year</th>
                  <th className="px-4 py-3 text-right">Copies</th>
                  <th className="px-4 py-3">Availability</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredBooks.map((book) => {
                  const isAvailable = book.availableCopies > 0;
                  return (
                    <tr key={book.isbn} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {book.isbn}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {book.coverImage && !failedImages[book.isbn] ? (
                            <img
                              src={book.coverImage}
                              alt={`Cover of ${book.title}`}
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setFailedImages((prev) => ({ ...prev, [book.isbn]: true }))
                              }
                              className="h-12 w-9 shrink-0 rounded border border-slate-200 object-cover bg-slate-100"
                            />
                          ) : (
                            <div
                              className="flex h-12 w-9 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-100 text-slate-400"
                              aria-hidden="true"
                            >
                              <BookOpen className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900">{book.title}</div>
                            <div className="text-xs text-slate-500">{book.author}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {BOOK_CATEGORY_LABELS[book.category]}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 tabular-nums">
                        {book.publicationYear}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-800 tabular-nums whitespace-nowrap">
                        {book.availableCopies} / {book.totalCopies}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {isAvailable ? (
                          <span className="font-medium text-emerald-700">Available</span>
                        ) : (
                          <span className="font-medium text-red-700">
                            Out of Stock
                            {book.holdQueue.length > 0 && ` · ${book.holdQueue.length} on hold`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          {isAvailable ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMemberId(state.members[0]?.memberId ?? '');
                                setCheckoutTarget(book);
                              }}
                              className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-800 cursor-pointer"
                            >
                              Borrow
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setHoldMemberId(state.members[0]?.memberId ?? '');
                                setHoldTarget(book);
                              }}
                              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-amber-600 hover:text-amber-700 cursor-pointer"
                            >
                              Place Hold
                            </button>
                          )}
                          {book.availableCopies < book.totalCopies && (
                            <button
                              type="button"
                              onClick={() => setReturnTarget(book)}
                              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors hover:border-emerald-600 hover:text-emerald-700 cursor-pointer"
                            >
                              Return
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(book)}
                            aria-label={`Delete ${book.title}`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Restock / Scan Book Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-semibold text-slate-900">
                Add Book or Scan Cover Photo
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddBook} className="mt-4 space-y-4">
              {/* Cover Photo Upload & Auto-Extraction */}
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    handlePhotoSelect(selected);
                    e.target.value = '';
                  }}
                  className="hidden"
                />

                <div className="flex items-start gap-4">
                  {coverImage ? (
                    <img
                      src={coverImage}
                      alt="Uploaded book cover preview"
                      referrerPolicy="no-referrer"
                      className="h-24 w-18 shrink-0 rounded border border-slate-200 object-cover bg-white"
                    />
                  ) : (
                    <div className="flex h-24 w-18 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-400">
                      <Camera className="h-6 w-6" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="text-xs font-medium text-slate-800">
                      Book Cover Photo (auto-extracts title & author)
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={extracting}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:opacity-60 cursor-pointer"
                      >
                        {extracting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        {coverImage ? 'Replace Photo' : 'Upload Photo'}
                      </button>

                      {coverImage && !extracting && (
                        <button
                          type="button"
                          onClick={() => {
                            setCoverImage(undefined);
                            setExtractionNote(null);
                          }}
                          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoRegisterOnScan}
                        onChange={(e) => setAutoRegisterOnScan(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                      />
                      Auto-register book immediately after extraction
                    </label>
                  </div>
                </div>

                {extractionNote && (
                  <div className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-700">
                    {extractionNote}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    ISBN / Catalog ID
                  </label>
                  <input
                    type="text"
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder="Auto-generated if blank"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as BookCategory)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    {Object.entries(BOOK_CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Title</label>
                <input
                  type="text"
                  required
                  disabled={extracting}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="The Catcher in the Rye"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Author</label>
                <input
                  type="text"
                  required
                  disabled={extracting}
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="J.D. Salinger"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none disabled:bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Publication Year</label>
                  <input
                    type="number"
                    required
                    min={1450}
                    max={2100}
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Copies</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={500}
                    value={copies}
                    onChange={(e) => setCopies(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={extracting}
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
                >
                  Register Book
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Borrow Book Modal */}
      {checkoutTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-semibold text-slate-900">Borrow Book</h2>
              <button
                type="button"
                onClick={() => setCheckoutTarget(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleQuickCheckout} className="mt-4 space-y-4">
              <div className="rounded-md bg-slate-50 p-3 text-sm">
                <div className="font-medium text-slate-900">{checkoutTarget.title}</div>
                <div className="mt-0.5 font-mono text-xs text-slate-500">
                  {checkoutTarget.isbn} · {checkoutTarget.availableCopies} available
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Borrower</label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                >
                  {state.members.map((m) => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.memberId} — {m.fullName} ({m.tier})
                    </option>
                  ))}
                </select>
                {selectedMember && (
                  <div className="mt-2 font-mono text-xs text-slate-600 tabular-nums">
                    Quota: {selectedMemberActiveLoans} / {MEMBER_TIER_RULES[selectedMember.tier].maxActiveLoans} active · Due{' '}
                    {addDaysIso(
                      state.simulationDate,
                      MEMBER_TIER_RULES[selectedMember.tier].loanDurationDays
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setCheckoutTarget(null)}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 cursor-pointer"
                >
                  Confirm Borrow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Book Modal */}
      {returnTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-semibold text-slate-900">Return Borrowed Copy</h2>
              <button
                type="button"
                onClick={() => setReturnTarget(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div className="rounded-md bg-slate-50 p-3 text-sm">
                <div className="font-medium text-slate-900">{returnTarget.title}</div>
                <div className="mt-0.5 font-mono text-xs text-slate-500">
                  {returnTarget.isbn} · {returnTargetLoans.length} active loan(s)
                </div>
              </div>

              {returnTargetLoans.length === 0 ? (
                <p className="text-sm text-slate-500">
                  All copies of this book have been returned.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
                  {returnTargetLoans.map((loan) => {
                    const borrower = memberMap.get(loan.memberId);
                    const daysOverdue = getLoanDaysOverdue(loan, state.simulationDate);
                    const fine = getLoanAccruedFine(loan, state.simulationDate);
                    return (
                      <div
                        key={loan.loanId}
                        className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">
                            {borrower?.fullName ?? loan.memberId}
                          </div>
                          <div className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
                            {loan.loanId} · Due {loan.dueDate}
                            {daysOverdue > 0 && (
                              <span className="font-medium text-red-700">
                                {' '}
                                · {daysOverdue}d overdue ({formatInr(fine)})
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleReturnLoan(loan.loanId)}
                          className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Return Now
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setReturnTarget(null)}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Place Hold Modal */}
      {holdTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-semibold text-slate-900">Place Hold Request</h2>
              <button
                type="button"
                onClick={() => setHoldTarget(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handlePlaceHold} className="mt-4 space-y-4">
              <div className="rounded-md bg-slate-50 p-3 text-sm">
                <div className="font-medium text-slate-900">{holdTarget.title}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  Current hold queue: {holdTarget.holdQueue.length} waiting
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Member</label>
                <select
                  value={holdMemberId}
                  onChange={(e) => setHoldMemberId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                >
                  {state.members.map((m) => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.memberId} — {m.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setHoldTarget(null)}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 cursor-pointer"
                >
                  Join Hold Queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Book Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-semibold text-slate-900">Delete Book from Database</h2>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                {deleteTarget.coverImage && !failedImages[deleteTarget.isbn] ? (
                  <img
                    src={deleteTarget.coverImage}
                    alt={`Cover of ${deleteTarget.title}`}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [deleteTarget.isbn]: true }))
                    }
                    className="h-14 w-10 shrink-0 rounded border border-slate-200 object-cover bg-slate-100"
                  />
                ) : (
                  <div
                    className="flex h-14 w-10 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-400"
                    aria-hidden="true"
                  >
                    <BookOpen className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{deleteTarget.title}</div>
                  <div className="text-xs text-slate-600">{deleteTarget.author}</div>
                  <div className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
                    {deleteTarget.isbn} · {deleteTarget.totalCopies}{' '}
                    {deleteTarget.totalCopies === 1 ? 'copy' : 'copies'}
                  </div>
                </div>
              </div>

              {deleteTargetActiveLoans.length > 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <div>
                      <div className="font-semibold">
                        Cannot delete while copies are borrowed
                      </div>
                      <p className="mt-1 leading-relaxed text-amber-800">
                        {deleteTargetActiveLoans.length}{' '}
                        {deleteTargetActiveLoans.length === 1 ? 'copy is' : 'copies are'} currently
                        checked out. Return all active loans for this title before removing it from
                        the catalog database.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const target = deleteTarget;
                          setDeleteTarget(null);
                          setReturnTarget(target);
                        }}
                        className="mt-2.5 inline-flex items-center rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 cursor-pointer"
                      >
                        Return Active Loans
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  This permanently removes <span className="font-medium text-slate-900">{deleteTarget.title}</span>{' '}
                  and all {deleteTarget.totalCopies}{' '}
                  {deleteTarget.totalCopies === 1 ? 'copy' : 'copies'} from the library database.
                  This action cannot be undone.
                </p>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting || deleteTargetActiveLoans.length > 0}
                  className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Delete from Database
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
