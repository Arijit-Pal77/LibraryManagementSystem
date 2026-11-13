import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  BookMarked,
  Calendar,
  ChevronRight,
  Users,
  X,
} from 'lucide-react';
import { CatalogView } from './components/CatalogView';
import { CirculationView } from './components/CirculationView';
import { MembersView } from './components/MembersView';
import {
  Book,
  LibraryState,
  createSeedLibraryState,
  getLoanStatus,
  performDeleteBook,
} from './lib/libraryEngine';

type TabId = 'catalog' | 'circulation' | 'members';

interface NavItem {
  id: TabId;
  label: string;
  breadcrumb: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'catalog',
    label: 'Catalog & Books',
    breadcrumb: 'Catalog & Books',
    icon: BookMarked,
  },
  {
    id: 'circulation',
    label: 'Borrow & Return',
    breadcrumb: 'Borrow & Return',
    icon: ArrowLeftRight,
  },
  {
    id: 'members',
    label: 'Members & Quotas',
    breadcrumb: 'Members & Quotas',
    icon: Users,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('catalog');
  const [libraryState, setLibraryState] = useState<LibraryState>(() =>
    createSeedLibraryState()
  );
  const hasLocalMutationRef = useRef(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  } | null>(null);

  const notify = (message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone });
    window.clearTimeout((notify as unknown as { timer?: number }).timer);
    (notify as unknown as { timer?: number }).timer = window.setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const persistLibraryState = async (next: LibraryState) => {
    try {
      const res = await fetch('/api/library', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Failed to save changes to database.');
      }
    } catch (err) {
      notify(
        err instanceof Error ? err.message : 'Unable to persist changes to database.',
        'error'
      );
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/library');
        if (!res.ok) return;
        const payload = (await res.json()) as {
          initialized?: boolean;
          data?: LibraryState;
        };
        if (!active || hasLocalMutationRef.current) return;
        if (payload.initialized && payload.data) {
          setLibraryState(payload.data);
        } else {
          await fetch('/api/library', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(libraryState),
          });
        }
      } catch {
        // Keep in-memory seed state if backend database is unreachable during boot
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateLibraryState = (next: LibraryState) => {
    hasLocalMutationRef.current = true;
    setLibraryState(next);
    void persistLibraryState(next);
  };

  const handleDeleteBook = async (isbn: string): Promise<Book> => {
    const res = await fetch(`/api/books/${encodeURIComponent(isbn)}`, {
      method: 'DELETE',
    });
    const payload = (await res.json().catch(() => ({}))) as {
      state?: LibraryState;
      deletedBook?: Book;
      error?: string;
    };

    if (res.status === 404 && payload.error?.includes('not initialized')) {
      const localResult = performDeleteBook(libraryState, isbn);
      updateLibraryState(localResult.state);
      return localResult.deletedBook;
    }

    if (!res.ok || !payload.state || !payload.deletedBook) {
      throw new Error(payload.error || 'Failed to delete book from database.');
    }

    hasLocalMutationRef.current = true;
    setLibraryState(payload.state);
    return payload.deletedBook;
  };

  const currentNav = NAV_ITEMS.find((item) => item.id === activeTab) ?? NAV_ITEMS[0];
  const CurrentIcon = currentNav.icon;
  const overdueLoansCount = libraryState.loans.filter(
    (l) => getLoanStatus(l, libraryState.simulationDate) === 'OVERDUE'
  ).length;
  const activeLoansCount = libraryState.loans.filter((l) => l.returnDate === null).length;
  const availableCopiesCount = libraryState.books.reduce((sum, b) => sum + b.availableCopies, 0);
  const totalCopiesCount = libraryState.books.reduce((sum, b) => sum + b.totalCopies, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar (260px) */}
      <aside className="hidden lg:flex lg:w-[260px] lg:shrink-0 lg:flex-col border-r border-slate-200 bg-white">
        <div className="flex h-14 items-center border-b border-slate-200 px-5">
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            LibraryManagementSystem
          </span>
        </div>

        <nav className="flex-1 px-3 py-5">
          <div className="px-3 pb-2 text-xs font-medium text-slate-400">
            Library Workspace
          </div>
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-blue-50 text-blue-800'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        active ? 'text-blue-700' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.id === 'circulation' && overdueLoansCount > 0 && (
                    <span className="font-mono text-xs font-semibold text-red-700 tabular-nums">
                      {overdueLoansCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-slate-200 p-4 text-xs text-slate-500">
          <div className="font-medium text-slate-700">Java 17 · Maven 3.8+</div>
          <div className="mt-0.5">JUnit 5 · CSV Repository</div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-6 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-blue-700"
              aria-hidden="true"
            >
              <CurrentIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="font-display font-semibold text-slate-700 truncate">
                  LibraryManagementSystem
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden="true" />
                <span className="truncate font-medium text-blue-700">
                  {currentNav.breadcrumb}
                </span>
              </div>
              <div className="hidden sm:block text-xs text-slate-400">
                Catalog Inventory · Circulation &amp; ₹10/day Fine Desk
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center divide-x divide-slate-200 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className="pr-4 text-right transition-colors hover:text-blue-700 cursor-pointer whitespace-nowrap"
            >
              <div className="text-slate-400">Shelf Copies</div>
              <div className="font-mono font-semibold text-slate-800 tabular-nums">
                {availableCopiesCount} / {totalCopiesCount}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('circulation')}
              className="px-4 text-right transition-colors hover:text-blue-700 cursor-pointer whitespace-nowrap"
            >
              <div className="text-slate-400">Checked Out</div>
              <div className="font-mono font-semibold tabular-nums text-slate-800">
                {activeLoansCount}
                {overdueLoansCount > 0 && (
                  <span className="text-red-700"> · {overdueLoansCount} overdue</span>
                )}
              </div>
            </button>
            <div className="pl-4 text-right whitespace-nowrap">
              <div className="flex items-center justify-end gap-1 text-slate-400">
                <Calendar className="h-3 w-3" />
                <span>Library Date</span>
              </div>
              <div className="font-mono font-semibold text-slate-800 tabular-nums">
                {libraryState.simulationDate}
              </div>
            </div>
          </div>
        </header>

        {/* Mobile / Tablet Nav Strip */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-blue-50 text-blue-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Viewport */}
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {activeTab === 'catalog' && (
            <CatalogView
              state={libraryState}
              onUpdateState={updateLibraryState}
              onDeleteBook={handleDeleteBook}
              onNotify={notify}
            />
          )}
          {activeTab === 'circulation' && (
            <CirculationView
              state={libraryState}
              onUpdateState={updateLibraryState}
              onNotify={notify}
            />
          )}
          {activeTab === 'members' && (
            <MembersView
              state={libraryState}
              onUpdateState={updateLibraryState}
              onNotify={notify}
            />
          )}
        </main>
      </div>

      {/* Action / Exception Feedback Banner */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 flex max-w-md items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-md ${
            toast.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-slate-200 bg-white text-slate-900'
          }`}
        >
          <span className="flex-1 leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
