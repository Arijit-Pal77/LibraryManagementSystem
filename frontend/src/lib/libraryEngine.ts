export type BookCategory =
  | 'FICTION'
  | 'CLASSICS'
  | 'MYSTERY'
  | 'FANTASY'
  | 'HISTORY'
  | 'BIOGRAPHY'
  | 'SCIENCE'
  | 'PHILOSOPHY'
  | 'COMPUTER_SCIENCE'
  | 'ENGINEERING';

export const BOOK_CATEGORY_LABELS: Record<BookCategory, string> = {
  FICTION: 'Fiction',
  CLASSICS: 'Classics',
  MYSTERY: 'Mystery',
  FANTASY: 'Fantasy',
  HISTORY: 'History',
  BIOGRAPHY: 'Biography',
  SCIENCE: 'Science',
  PHILOSOPHY: 'Philosophy',
  COMPUTER_SCIENCE: 'Computer Science',
  ENGINEERING: 'Engineering',
};

export type MemberTier = 'STANDARD' | 'STUDENT' | 'FACULTY';

export const MEMBER_TIER_RULES: Record<
  MemberTier,
  { label: string; maxActiveLoans: number; loanDurationDays: number }
> = {
  STANDARD: { label: 'Standard', maxActiveLoans: 3, loanDurationDays: 14 },
  STUDENT: { label: 'Student', maxActiveLoans: 5, loanDurationDays: 21 },
  FACULTY: { label: 'Faculty', maxActiveLoans: 10, loanDurationDays: 30 },
};

export type LoanStatus = 'ACTIVE' | 'RETURNED' | 'OVERDUE';

export const DAILY_FINE_RATE = 10;

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export interface Book {
  isbn: string;
  title: string;
  author: string;
  category: BookCategory;
  publicationYear: number;
  totalCopies: number;
  availableCopies: number;
  holdQueue: string[];
  coverImage?: string;
}

export interface Member {
  memberId: string;
  fullName: string;
  email: string;
  tier: MemberTier;
  joinedDate: string; // YYYY-MM-DD
  unpaidFines: number;
}

export interface Loan {
  loanId: string;
  isbn: string;
  memberId: string;
  checkoutDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  returnDate: string | null;
  fineAssessed: number;
}

export interface LibraryState {
  books: Book[];
  members: Member[];
  loans: Loan[];
  simulationDate: string;
}

export function todayIsoDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function diffDaysIso(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  const ms1 = Date.UTC(y1, m1 - 1, d1);
  const ms2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((ms2 - ms1) / (1000 * 60 * 60 * 24));
}

export function getLoanDaysOverdue(loan: Loan, asOfDate: string): number {
  const effectiveEnd = loan.returnDate ?? asOfDate;
  const days = diffDaysIso(loan.dueDate, effectiveEnd);
  return days > 0 ? days : 0;
}

export function getLoanAccruedFine(loan: Loan, asOfDate: string): number {
  if (loan.returnDate !== null) {
    return loan.fineAssessed;
  }
  const overdueDays = getLoanDaysOverdue(loan, asOfDate);
  return Math.round(overdueDays * DAILY_FINE_RATE * 100) / 100;
}

export function getLoanStatus(loan: Loan, asOfDate: string): LoanStatus {
  if (loan.returnDate !== null) {
    return 'RETURNED';
  }
  return diffDaysIso(loan.dueDate, asOfDate) > 0 ? 'OVERDUE' : 'ACTIVE';
}

export function createSeedLibraryState(): LibraryState {
  const today = todayIsoDate();

  return {
    simulationDate: today,
    books: [
      {
        isbn: '978-0141439518',
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        category: 'CLASSICS',
        publicationYear: 1813,
        totalCopies: 4,
        availableCopies: 3,
        holdQueue: [],
      },
      {
        isbn: '978-0061120084',
        title: 'To Kill a Mockingbird',
        author: 'Harper Lee',
        category: 'FICTION',
        publicationYear: 1960,
        totalCopies: 3,
        availableCopies: 2,
        holdQueue: [],
      },
      {
        isbn: '978-0451524935',
        title: '1984',
        author: 'George Orwell',
        category: 'FICTION',
        publicationYear: 1949,
        totalCopies: 3,
        availableCopies: 2,
        holdQueue: [],
      },
      {
        isbn: '978-0441172719',
        title: 'Dune',
        author: 'Frank Herbert',
        category: 'FANTASY',
        publicationYear: 1965,
        totalCopies: 3,
        availableCopies: 3,
        holdQueue: [],
      },
      {
        isbn: '978-0062316110',
        title: 'Sapiens: A Brief History of Humankind',
        author: 'Yuval Noah Harari',
        category: 'HISTORY',
        publicationYear: 2015,
        totalCopies: 2,
        availableCopies: 2,
        holdQueue: [],
      },
      {
        isbn: '978-0307474278',
        title: 'The Da Vinci Code',
        author: 'Dan Brown',
        category: 'MYSTERY',
        publicationYear: 2003,
        totalCopies: 2,
        availableCopies: 2,
        holdQueue: [],
      },
      {
        isbn: '978-0743273565',
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        category: 'CLASSICS',
        publicationYear: 1925,
        totalCopies: 3,
        availableCopies: 3,
        holdQueue: [],
      },
      {
        isbn: '978-0547928227',
        title: 'The Hobbit',
        author: 'J.R.R. Tolkien',
        category: 'FANTASY',
        publicationYear: 1937,
        totalCopies: 2,
        availableCopies: 2,
        holdQueue: [],
      },
      {
        isbn: '978-0385490818',
        title: "The Handmaid's Tale",
        author: 'Margaret Atwood',
        category: 'FICTION',
        publicationYear: 1985,
        totalCopies: 2,
        availableCopies: 2,
        holdQueue: [],
      },
      {
        isbn: '978-0307277671',
        title: 'The Girl with the Dragon Tattoo',
        author: 'Stieg Larsson',
        category: 'MYSTERY',
        publicationYear: 2008,
        totalCopies: 2,
        availableCopies: 2,
        holdQueue: [],
      },
      {
        isbn: '978-0553380163',
        title: 'A Brief History of Time',
        author: 'Stephen Hawking',
        category: 'SCIENCE',
        publicationYear: 1998,
        totalCopies: 3,
        availableCopies: 3,
        holdQueue: [],
      },
      {
        isbn: '978-1501127625',
        title: 'Steve Jobs',
        author: 'Walter Isaacson',
        category: 'BIOGRAPHY',
        publicationYear: 2011,
        totalCopies: 2,
        availableCopies: 2,
        holdQueue: [],
      },
      {
        isbn: '978-0140449136',
        title: 'Meditations',
        author: 'Marcus Aurelius',
        category: 'PHILOSOPHY',
        publicationYear: 2006,
        totalCopies: 3,
        availableCopies: 3,
        holdQueue: [],
      },
      {
        isbn: '978-0262046305',
        title: 'Introduction to Algorithms',
        author: 'Thomas H. Cormen et al.',
        category: 'COMPUTER_SCIENCE',
        publicationYear: 2022,
        totalCopies: 3,
        availableCopies: 3,
        holdQueue: [],
      },
      {
        isbn: '978-1449373320',
        title: 'Designing Data-Intensive Applications',
        author: 'Martin Kleppmann',
        category: 'ENGINEERING',
        publicationYear: 2017,
        totalCopies: 3,
        availableCopies: 3,
        holdQueue: [],
      },
      {
        isbn: '978-0132350884',
        title: 'Clean Code',
        author: 'Robert C. Martin',
        category: 'COMPUTER_SCIENCE',
        publicationYear: 2008,
        totalCopies: 3,
        availableCopies: 3,
        holdQueue: [],
      },
      {
        isbn: '978-0135957059',
        title: 'The Pragmatic Programmer',
        author: 'David Thomas & Andrew Hunt',
        category: 'COMPUTER_SCIENCE',
        publicationYear: 2019,
        totalCopies: 2,
        availableCopies: 2,
        holdQueue: [],
      },
      {
        isbn: '978-0596007126',
        title: 'Head First Design Patterns',
        author: 'Eric Freeman & Elisabeth Robson',
        category: 'ENGINEERING',
        publicationYear: 2020,
        totalCopies: 2,
        availableCopies: 2,
        holdQueue: [],
      },
    ],
    members: [
      {
        memberId: 'MEM-1001',
        fullName: 'Aarav Mehta',
        email: 'aarav.mehta@university.edu',
        tier: 'STUDENT',
        joinedDate: addDaysIso(today, -180),
        unpaidFines: 0,
      },
      {
        memberId: 'MEM-1002',
        fullName: 'Dr. Elena Rostova',
        email: 'e.rostova@university.edu',
        tier: 'FACULTY',
        joinedDate: addDaysIso(today, -730),
        unpaidFines: 0,
      },
      {
        memberId: 'MEM-1003',
        fullName: 'Marcus Vance',
        email: 'marcus.vance@civicmail.org',
        tier: 'STANDARD',
        joinedDate: addDaysIso(today, -90),
        unpaidFines: 30,
      },
      {
        memberId: 'MEM-1004',
        fullName: 'Priya Nair',
        email: 'priya.nair@university.edu',
        tier: 'STUDENT',
        joinedDate: addDaysIso(today, -30),
        unpaidFines: 0,
      },
    ],
    loans: [
      {
        loanId: 'LN-5001',
        isbn: '978-0141439518',
        memberId: 'MEM-1001',
        checkoutDate: addDaysIso(today, -8),
        dueDate: addDaysIso(today, 13),
        returnDate: null,
        fineAssessed: 0,
      },
      {
        loanId: 'LN-5002',
        isbn: '978-0061120084',
        memberId: 'MEM-1003',
        checkoutDate: addDaysIso(today, -19),
        dueDate: addDaysIso(today, -5),
        returnDate: null,
        fineAssessed: 0,
      },
      {
        loanId: 'LN-5003',
        isbn: '978-0451524935',
        memberId: 'MEM-1002',
        checkoutDate: addDaysIso(today, -4),
        dueDate: addDaysIso(today, 26),
        returnDate: null,
        fineAssessed: 0,
      },
    ],
  };
}

export function performAddOrRestockBook(
  state: LibraryState,
  input: {
    isbn: string;
    title: string;
    author: string;
    category: BookCategory;
    publicationYear: number;
    copies: number;
    coverImage?: string;
  }
): { state: LibraryState; book: Book; restocked: boolean } {
  const isbn = input.isbn.trim();
  if (!isbn) throw new Error('IllegalArgumentException: ISBN must not be blank.');
  if (input.copies < 1) throw new Error('IllegalArgumentException: Copies must be at least 1.');

  const existing = state.books.find((b) => b.isbn === isbn);
  if (existing) {
    const updatedBook: Book = {
      ...existing,
      totalCopies: existing.totalCopies + input.copies,
      availableCopies: existing.availableCopies + input.copies,
      coverImage: input.coverImage || existing.coverImage,
    };
    return {
      restocked: true,
      book: updatedBook,
      state: {
        ...state,
        books: state.books.map((b) => (b.isbn === isbn ? updatedBook : b)),
      },
    };
  }

  if (!input.title.trim()) throw new Error('IllegalArgumentException: Title must not be blank.');
  const created: Book = {
    isbn,
    title: input.title.trim(),
    author: input.author.trim() || 'Unknown',
    category: input.category,
    publicationYear: input.publicationYear || new Date().getFullYear(),
    totalCopies: input.copies,
    availableCopies: input.copies,
    holdQueue: [],
    coverImage: input.coverImage,
  };

  return {
    restocked: false,
    book: created,
    state: {
      ...state,
      books: [...state.books, created],
    },
  };
}

export function performRegisterMember(
  state: LibraryState,
  input: {
    memberId: string;
    fullName: string;
    email: string;
    tier: MemberTier;
  }
): { state: LibraryState; member: Member } {
  const memberId = input.memberId.trim();
  if (!memberId) throw new Error('IllegalArgumentException: Member ID must not be blank.');
  if (!input.fullName.trim()) throw new Error('IllegalArgumentException: Full name must not be blank.');
  if (state.members.some((m) => m.memberId === memberId)) {
    throw new Error(`LibraryException: Member ID already exists: ${memberId}`);
  }

  const member: Member = {
    memberId,
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    tier: input.tier,
    joinedDate: state.simulationDate,
    unpaidFines: 0,
  };

  return {
    member,
    state: {
      ...state,
      members: [...state.members, member],
    },
  };
}

export function performCheckoutBook(
  state: LibraryState,
  isbn: string,
  memberId: string
): { state: LibraryState; loan: Loan } {
  const book = state.books.find((b) => b.isbn === isbn.trim());
  if (!book) throw new Error(`EntityNotFoundException: Book not found with identifier: ${isbn}`);

  const member = state.members.find((m) => m.memberId === memberId.trim());
  if (!member) throw new Error(`EntityNotFoundException: Member not found with identifier: ${memberId}`);

  if (book.availableCopies <= 0) {
    throw new Error(`BookNotAvailableException: No available copies remaining for ISBN: ${isbn}`);
  }

  const activeLoans = state.loans.filter((l) => l.memberId === member.memberId && l.returnDate === null);
  const maxAllowed = MEMBER_TIER_RULES[member.tier].maxActiveLoans;
  if (activeLoans.length >= maxAllowed) {
    throw new Error(
      `BorrowLimitExceededException: Member ${member.memberId} has reached the maximum active loan limit (${maxAllowed}).`
    );
  }

  if (activeLoans.some((l) => l.isbn === book.isbn)) {
    throw new Error(`LibraryException: Member ${member.memberId} already holds an active loan for ISBN ${book.isbn}`);
  }

  const duration = MEMBER_TIER_RULES[member.tier].loanDurationDays;
  const loanId = `LN-${Math.floor(5004 + Math.random() * 4990)}`;
  const loan: Loan = {
    loanId,
    isbn: book.isbn,
    memberId: member.memberId,
    checkoutDate: state.simulationDate,
    dueDate: addDaysIso(state.simulationDate, duration),
    returnDate: null,
    fineAssessed: 0,
  };

  return {
    loan,
    state: {
      ...state,
      books: state.books.map((b) =>
        b.isbn === book.isbn
          ? {
              ...b,
              availableCopies: b.availableCopies - 1,
              holdQueue: b.holdQueue.filter((id) => id !== member.memberId),
            }
          : b
      ),
      loans: [loan, ...state.loans],
    },
  };
}

export function performReturnBook(
  state: LibraryState,
  loanId: string
): { state: LibraryState; fine: number; loan: Loan } {
  const loan = state.loans.find((l) => l.loanId === loanId.trim());
  if (!loan) throw new Error(`EntityNotFoundException: Loan not found with identifier: ${loanId}`);
  if (loan.returnDate !== null) {
    throw new Error(`IllegalStateException: Loan ${loanId} has already been returned.`);
  }

  const overdueDays = getLoanDaysOverdue(loan, state.simulationDate);
  const fine = Math.round(overdueDays * DAILY_FINE_RATE * 100) / 100;

  const updatedLoan: Loan = {
    ...loan,
    returnDate: state.simulationDate,
    fineAssessed: fine,
  };

  return {
    fine,
    loan: updatedLoan,
    state: {
      ...state,
      loans: state.loans.map((l) => (l.loanId === loan.loanId ? updatedLoan : l)),
      books: state.books.map((b) =>
        b.isbn === loan.isbn
          ? { ...b, availableCopies: Math.min(b.totalCopies, b.availableCopies + 1) }
          : b
      ),
      members:
        fine > 0
          ? state.members.map((m) =>
              m.memberId === loan.memberId
                ? { ...m, unpaidFines: Math.round((m.unpaidFines + fine) * 100) / 100 }
                : m
            )
          : state.members,
    },
  };
}

export function performPlaceHold(state: LibraryState, isbn: string, memberId: string): LibraryState {
  const book = state.books.find((b) => b.isbn === isbn);
  if (!book) throw new Error(`EntityNotFoundException: Book not found with identifier: ${isbn}`);
  const member = state.members.find((m) => m.memberId === memberId);
  if (!member) throw new Error(`EntityNotFoundException: Member not found with identifier: ${memberId}`);
  if (book.availableCopies > 0) {
    throw new Error('LibraryException: Book is currently available for immediate checkout; no hold needed.');
  }
  if (book.holdQueue.includes(memberId)) {
    throw new Error(`LibraryException: Member ${memberId} is already in the hold queue for ${isbn}.`);
  }
  return {
    ...state,
    books: state.books.map((b) =>
      b.isbn === isbn ? { ...b, holdQueue: [...b.holdQueue, memberId] } : b
    ),
  };
}

export function performPayFine(state: LibraryState, memberId: string, amount: number): LibraryState {
  const member = state.members.find((m) => m.memberId === memberId.trim());
  if (!member) throw new Error(`EntityNotFoundException: Member not found with identifier: ${memberId}`);
  if (Number.isNaN(amount) || amount <= 0) {
    throw new Error('IllegalArgumentException: Payment amount must be positive.');
  }

  return {
    ...state,
    members: state.members.map((m) =>
      m.memberId === member.memberId
        ? { ...m, unpaidFines: Math.max(0, Math.round((m.unpaidFines - amount) * 100) / 100) }
        : m
    ),
  };
}

export function performDeleteBook(
  state: LibraryState,
  isbn: string
): { state: LibraryState; deletedBook: Book } {
  const normalizedIsbn = isbn.trim();
  const book = state.books.find((b) => b.isbn === normalizedIsbn);
  if (!book) {
    throw new Error(`EntityNotFoundException: Book not found with identifier: ${isbn}`);
  }

  const activeLoansCount = state.loans.filter(
    (l) => l.isbn === book.isbn && l.returnDate === null
  ).length;
  if (activeLoansCount > 0) {
    throw new Error(
      `LibraryException: Cannot delete "${book.title}" while ${activeLoansCount} ${
        activeLoansCount === 1 ? 'copy is' : 'copies are'
      } currently borrowed. Return all active loans first.`
    );
  }

  return {
    deletedBook: book,
    state: {
      ...state,
      books: state.books.filter((b) => b.isbn !== book.isbn),
    },
  };
}

