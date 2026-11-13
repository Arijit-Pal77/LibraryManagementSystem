# LibraryManagementSystem — Java 17

A clean, layered **Java 17** Library Management System built with zero external runtime dependencies (JDK 17 standard library only) and **JUnit 5** for automated testing.

## Architecture

```
src/
├── main/java/com/library/
│   ├── model/          # Domain entities & enums (Book, Member, Loan, BookCategory, MemberTier, LoanStatus)
│   ├── exception/      # Checked/unchecked domain exceptions
│   ├── repository/     # In-memory indexed store + CSV persistence (books.csv, members.csv, loans.csv)
│   ├── service/        # Business logic: checkout rules, tier quotas, ₹10.00/day fine calculation, holds
│   └── cli/            # Interactive Scanner-based console interface
└── test/java/com/library/
    └── service/        # JUnit 5 unit tests covering circulation, fines, limits, and search
```

## Key Features

- **Catalog Management**: Add books, update copy counts, search by ISBN, title, author, or category via Java Streams.
- **Member Tiers & Quotas**:
  - `STANDARD`: Max 3 active loans, 14-day loan period
  - `STUDENT`: Max 5 active loans, 21-day loan period
  - `FACULTY`: Max 10 active loans, 30-day loan period
- **Circulation & Fine Engine**:
  - Prevents duplicate checkouts of the same book by the same member.
  - Enforces copy availability and tier borrow quotas.
  - Automatically computes overdue fines at **₹10.00/day** upon return or inspection.
  - Supports **Hold Queue** (FIFO reservation list) when all copies are checked out.
- **CSV Persistence**: Saves and reloads catalog, members, and loan ledger cleanly to `./data/` on disk.

## Prerequisites

- **Java Development Kit (JDK) 17+**
- **Apache Maven 3.8+** (or run directly via `javac` / IntelliJ IDEA / Eclipse / VS Code)

## Running with Maven

```bash
# 1. Run all JUnit 5 unit tests
mvn test

# 2. Launch the interactive CLI application
mvn compile exec:java
```

## Running Without Maven (`javac` / `java`)

```bash
mkdir -p out
javac -d out $(find src/main/java -name "*.java")
java -cp out com.library.cli.LibraryConsoleApp
```

## Sample Seed Data

When launched for the first time without existing `./data/` CSV files, the repository seeds:
- **18 books across fiction, classics, history, science, biography, and technical subjects** (e.g., *Pride and Prejudice*, *1984*, *Dune*, *Sapiens*, *Introduction to Algorithms*, *Designing Data-Intensive Applications*, *Clean Code*, *The Pragmatic Programmer*)
- **4 library members** across `STANDARD`, `STUDENT`, and `FACULTY` tiers
- **Active & overdue sample loans** so you can immediately test returns, fine calculations, and search.
