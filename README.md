# LibraryManagementSystem

A full-stack Library Management System organized into separate **`backend/`** and **`frontend/`** folders, pairing a **React + Express** web application with a layered **Java 17 Maven** project (`backend/java-project/`).

---

## Features

- **Catalog & Inventory**: Search and filter across fiction, classics, mystery, fantasy, history, biography, science, philosophy, computer science, and engineering books.
- **Cover Photo Auto-Registration**: Upload a book cover photo to extract the title, author, ISBN, category, and publication year via `/api/extract-book`, and register it into the catalog.
- **Borrow, Return & Hold Queue**: Issue loans, return active checkouts, and join FIFO hold queues when all copies are checked out.
- **Member Tiers & Quotas**:
  - `STANDARD`: Max 3 active loans · 14-day loan period
  - `STUDENT`: Max 5 active loans · 21-day loan period
  - `FACULTY`: Max 10 active loans · 30-day loan period
- **Overdue Fine Engine (₹ INR)**: Computes overdue fines at **₹10.00/day** with a simulated date clock (`+1 Day`, `+7 Days`, `+15 Days`, `Today`) and member fine settlement.
- **Persistent Database & Book Deletion**: Automatically saves catalog, members, and loans to `backend/data/library-db.json` and lets you permanently delete unborrowed books (books with active loans must be returned before deletion).

---

## Project Structure

```text
.
├── package.json                         # Root scripts (dev, build, start, lint) & dependencies
├── vite.config.ts                       # Vite config pointing root to frontend/ and build outDir to dist/
├── tsconfig.json                        # TypeScript configuration
├── .env.example                         # Environment variable template
├── backend/
│   ├── server.ts                        # Express backend (port 3000): DB persistence, book delete, cover extraction, Vite serving
│   ├── data/                            # Created automatically at runtime (library-db.json)
│   └── java-project/                    # Standalone Java 17 Maven project
│       ├── pom.xml
│       ├── README.md
│       └── src/
│           ├── main/java/com/library/
│           │   ├── model/               # Book, Member, Loan, BookCategory, MemberTier, LoanStatus
│           │   ├── exception/           # LibraryException, BookNotAvailableException, BorrowLimitExceededException, EntityNotFoundException
│           │   ├── repository/          # CSV-backed persistence (books.csv, members.csv, loans.csv)
│           │   ├── service/             # LibraryService business rules & deletion guard
│           │   └── cli/                 # LibraryConsoleApp interactive CLI
│           └── test/java/com/library/service/
│               └── LibraryServiceTest.java
└── frontend/
    ├── index.html                       # HTML entry point
    └── src/
        ├── App.tsx                      # Application shell, sidebar navigation, DB sync
        ├── main.tsx                     # React mount
        ├── index.css                    # Tailwind CSS & Times New Roman typography
        ├── lib/libraryEngine.ts         # Core circulation, fine (₹10/day), and deletion logic
        ├── data/javaProjectFiles.ts     # ZIP export helper for the Java 17 Maven project
        └── components/
            ├── CatalogView.tsx          # Catalog grid, cover scan/upload, borrow, return, hold, delete
            ├── CirculationView.tsx      # Borrow & Return desk + simulated clock
            └── MembersView.tsx          # Member registry, quotas, borrow/return, fine settlement
```

---

## 1. How to Run the Web Application (`backend/` + `frontend/`)

### Prerequisites
- **Node.js 20+** (Node 22 recommended) and **npm**
- **Gemini API Key** *(optional — required only for the **Scan Book Photo** auto-extraction feature)*

### Development Mode

1. **Install dependencies** (from the repository root):
   ```bash
   npm install
   ```

2. **Configure environment variables** (optional, for cover photo extraction):
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set `GEMINI_API_KEY` to your Gemini API key.

3. **Start the full-stack dev server**:
   ```bash
   npm run dev
   ```
   This runs `tsx backend/server.ts` on **http://localhost:3000**, serving both the Express REST API (`/api/*`) and the `frontend/` React app via Vite middleware.

### Production Build & Start

```bash
# Type-check TypeScript across backend/ and frontend/
npm run lint

# Build the frontend into dist/
npm run build

# Start the backend server serving dist/ and /api/* routes
NODE_ENV=production npm start
```

### Backend API Endpoints (`backend/server.ts`)

- `GET /api/library` — Loads persisted state from `backend/data/library-db.json` (or `{ initialized: false }` on first run).
- `PUT /api/library` — Saves updated catalog, members, loans, and simulation date to `backend/data/library-db.json`.
- `DELETE /api/books/:isbn` — Deletes a book from `backend/data/library-db.json` (returns HTTP `409` if copies are currently borrowed).
- `POST /api/extract-book` — Accepts a base64 cover image and returns `{ title, author, isbn, category, publicationYear }`.

---

## 2. How to Run the Java 17 Project (`backend/java-project/`)

### Prerequisites
- **JDK 17+** (`java -version`)
- **Apache Maven 3.8+** (`mvn -version`) *(optional — you can also compile with `javac`)*

### Option A: Using Maven (Recommended)

```bash
cd backend/java-project

# 1. Run all JUnit 5 unit tests
mvn test

# 2. Launch the interactive Java CLI application
mvn compile exec:java
```

To build an executable JAR:
```bash
cd backend/java-project
mvn package
java -jar target/library-management-system-1.0.0.jar
```

### Option B: Without Maven (`javac` / `java`)

**Linux / macOS:**
```bash
cd backend/java-project
mkdir -p out
javac -d out $(find src/main/java -name "*.java")
java -cp out com.library.cli.LibraryConsoleApp
```

**Windows (PowerShell):**
```powershell
cd backend/java-project
mkdir out -Force
$files = Get-ChildItem -Path src/main/java -Recurse -Filter *.java | ForEach-Object { $_.FullName }
javac -d out $files
java -cp out com.library.cli.LibraryConsoleApp
```

### Java CLI Menu Options

Once `LibraryConsoleApp` launches, use the console menu (`0`–`9`):
- `[1]` List Catalog
- `[2]` Search Books
- `[3]` Add / Restock Book
- `[4]` Register Member
- `[5]` Checkout Book
- `[6]` Return Book (calculates overdue fines at **₹10.00/day**)
- `[7]` Overdue Report
- `[8]` Settle Member Fine
- `[9]` Delete Book (blocked if active loans exist)
- `[0]` Exit (saves CSV files to `backend/java-project/data/`)
