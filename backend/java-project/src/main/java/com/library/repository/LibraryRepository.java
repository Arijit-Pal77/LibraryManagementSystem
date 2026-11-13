package com.library.repository;

import com.library.model.Book;
import com.library.model.BookCategory;
import com.library.model.Loan;
import com.library.model.Member;
import com.library.model.MemberTier;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class LibraryRepository {
    private final Map<String, Book> books = new LinkedHashMap<>();
    private final Map<String, Member> members = new LinkedHashMap<>();
    private final Map<String, Loan> loans = new LinkedHashMap<>();
    private final Path dataDirectory;

    public LibraryRepository() {
        this(null);
    }

    public LibraryRepository(Path dataDirectory) {
        this.dataDirectory = dataDirectory;
        if (dataDirectory != null && Files.exists(dataDirectory.resolve("books.csv"))) {
            loadFromDisk();
        } else {
            seedInitialData();
        }
    }

    public void saveBook(Book book) {
        books.put(book.getIsbn(), book);
        persistIfEnabled();
    }

    public Optional<Book> findBookByIsbn(String isbn) {
        return Optional.ofNullable(books.get(isbn));
    }

    public Collection<Book> findAllBooks() {
        return new ArrayList<>(books.values());
    }

    public boolean deleteBookByIsbn(String isbn) {
        Book removed = books.remove(isbn);
        if (removed != null) {
            persistIfEnabled();
            return true;
        }
        return false;
    }

    public void saveMember(Member member) {
        members.put(member.getMemberId(), member);
        persistIfEnabled();
    }

    public Optional<Member> findMemberById(String memberId) {
        return Optional.ofNullable(members.get(memberId));
    }

    public Collection<Member> findAllMembers() {
        return new ArrayList<>(members.values());
    }

    public void saveLoan(Loan loan) {
        loans.put(loan.getLoanId(), loan);
        persistIfEnabled();
    }

    public Optional<Loan> findLoanById(String loanId) {
        return Optional.ofNullable(loans.get(loanId));
    }

    public Collection<Loan> findAllLoans() {
        return new ArrayList<>(loans.values());
    }

    public void persistIfEnabled() {
        if (dataDirectory == null) {
            return;
        }
        try {
            Files.createDirectories(dataDirectory);
            writeBooksCsv();
            writeMembersCsv();
            writeLoansCsv();
        } catch (IOException e) {
            throw new RuntimeException("Failed to persist library data to " + dataDirectory, e);
        }
    }

    private void writeBooksCsv() throws IOException {
        List<String> lines = new ArrayList<>();
        lines.add("isbn,title,author,category,year,totalCopies,availableCopies");
        for (Book b : books.values()) {
            lines.add(String.join(",",
                    escape(b.getIsbn()),
                    escape(b.getTitle()),
                    escape(b.getAuthor()),
                    b.getCategory().name(),
                    String.valueOf(b.getPublicationYear()),
                    String.valueOf(b.getTotalCopies()),
                    String.valueOf(b.getAvailableCopies())));
        }
        Files.write(dataDirectory.resolve("books.csv"), lines);
    }

    private void writeMembersCsv() throws IOException {
        List<String> lines = new ArrayList<>();
        lines.add("memberId,fullName,email,tier,joinedDate,unpaidFines");
        for (Member m : members.values()) {
            lines.add(String.join(",",
                    escape(m.getMemberId()),
                    escape(m.getFullName()),
                    escape(m.getEmail()),
                    m.getTier().name(),
                    m.getJoinedDate().toString(),
                    String.valueOf(m.getUnpaidFines())));
        }
        Files.write(dataDirectory.resolve("members.csv"), lines);
    }

    private void writeLoansCsv() throws IOException {
        List<String> lines = new ArrayList<>();
        lines.add("loanId,isbn,memberId,checkoutDate,dueDate,returnDate,fineAssessed");
        for (Loan l : loans.values()) {
            lines.add(String.join(",",
                    escape(l.getLoanId()),
                    escape(l.getIsbn()),
                    escape(l.getMemberId()),
                    l.getCheckoutDate().toString(),
                    l.getDueDate().toString(),
                    l.getReturnDate() != null ? l.getReturnDate().toString() : "",
                    String.valueOf(l.getFineAssessed())));
        }
        Files.write(dataDirectory.resolve("loans.csv"), lines);
    }

    private void loadFromDisk() {
        try {
            List<String> bookLines = Files.readAllLines(dataDirectory.resolve("books.csv"));
            for (int i = 1; i < bookLines.size(); i++) {
                String[] parts = bookLines.get(i).split(",", -1);
                if (parts.length >= 7) {
                    Book b = new Book(
                            unescape(parts[0]),
                            unescape(parts[1]),
                            unescape(parts[2]),
                            BookCategory.valueOf(parts[3]),
                            Integer.parseInt(parts[4]),
                            Integer.parseInt(parts[5]),
                            Integer.parseInt(parts[6]));
                    books.put(b.getIsbn(), b);
                }
            }

            Path membersPath = dataDirectory.resolve("members.csv");
            if (Files.exists(membersPath)) {
                List<String> memberLines = Files.readAllLines(membersPath);
                for (int i = 1; i < memberLines.size(); i++) {
                    String[] parts = memberLines.get(i).split(",", -1);
                    if (parts.length >= 6) {
                        Member m = new Member(
                                unescape(parts[0]),
                                unescape(parts[1]),
                                unescape(parts[2]),
                                MemberTier.valueOf(parts[3]),
                                LocalDate.parse(parts[4]),
                                Double.parseDouble(parts[5]));
                        members.put(m.getMemberId(), m);
                    }
                }
            }

            Path loansPath = dataDirectory.resolve("loans.csv");
            if (Files.exists(loansPath)) {
                List<String> loanLines = Files.readAllLines(loansPath);
                for (int i = 1; i < loanLines.size(); i++) {
                    String[] parts = loanLines.get(i).split(",", -1);
                    if (parts.length >= 7) {
                        LocalDate returnDate = parts[5].isBlank() ? null : LocalDate.parse(parts[5]);
                        Loan l = new Loan(
                                unescape(parts[0]),
                                unescape(parts[1]),
                                unescape(parts[2]),
                                LocalDate.parse(parts[3]),
                                LocalDate.parse(parts[4]),
                                returnDate,
                                Double.parseDouble(parts[6]));
                        loans.put(l.getLoanId(), l);
                    }
                }
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to read library CSV data from " + dataDirectory, e);
        }
    }

    private void seedInitialData() {
        saveBook(new Book("978-0141439518", "Pride and Prejudice", "Jane Austen", BookCategory.CLASSICS, 1813, 4, 3));
        saveBook(new Book("978-0061120084", "To Kill a Mockingbird", "Harper Lee", BookCategory.FICTION, 1960, 3, 2));
        saveBook(new Book("978-0451524935", "1984", "George Orwell", BookCategory.FICTION, 1949, 3, 2));
        saveBook(new Book("978-0441172719", "Dune", "Frank Herbert", BookCategory.FANTASY, 1965, 3, 3));
        saveBook(new Book("978-0062316110", "Sapiens: A Brief History of Humankind", "Yuval Noah Harari", BookCategory.HISTORY, 2015, 2, 2));
        saveBook(new Book("978-0307474278", "The Da Vinci Code", "Dan Brown", BookCategory.MYSTERY, 2003, 2, 2));
        saveBook(new Book("978-0743273565", "The Great Gatsby", "F. Scott Fitzgerald", BookCategory.CLASSICS, 1925, 3, 3));
        saveBook(new Book("978-0547928227", "The Hobbit", "J.R.R. Tolkien", BookCategory.FANTASY, 1937, 2, 2));
        saveBook(new Book("978-0385490818", "The Handmaid's Tale", "Margaret Atwood", BookCategory.FICTION, 1985, 2, 2));
        saveBook(new Book("978-0307277671", "The Girl with the Dragon Tattoo", "Stieg Larsson", BookCategory.MYSTERY, 2008, 2, 2));
        saveBook(new Book("978-0553380163", "A Brief History of Time", "Stephen Hawking", BookCategory.SCIENCE, 1998, 3, 3));
        saveBook(new Book("978-1501127625", "Steve Jobs", "Walter Isaacson", BookCategory.BIOGRAPHY, 2011, 2, 2));
        saveBook(new Book("978-0140449136", "Meditations", "Marcus Aurelius", BookCategory.PHILOSOPHY, 2006, 3, 3));
        saveBook(new Book("978-0262046305", "Introduction to Algorithms", "Thomas H. Cormen et al.", BookCategory.COMPUTER_SCIENCE, 2022, 3, 3));
        saveBook(new Book("978-1449373320", "Designing Data-Intensive Applications", "Martin Kleppmann", BookCategory.ENGINEERING, 2017, 3, 3));
        saveBook(new Book("978-0132350884", "Clean Code", "Robert C. Martin", BookCategory.COMPUTER_SCIENCE, 2008, 3, 3));
        saveBook(new Book("978-0135957059", "The Pragmatic Programmer", "David Thomas & Andrew Hunt", BookCategory.COMPUTER_SCIENCE, 2019, 2, 2));
        saveBook(new Book("978-0596007126", "Head First Design Patterns", "Eric Freeman & Elisabeth Robson", BookCategory.ENGINEERING, 2020, 2, 2));

        saveMember(new Member("MEM-1001", "Aarav Mehta", "aarav.mehta@university.edu", MemberTier.STUDENT, LocalDate.now().minusMonths(6), 0.0));
        saveMember(new Member("MEM-1002", "Dr. Elena Rostova", "e.rostova@university.edu", MemberTier.FACULTY, LocalDate.now().minusYears(2), 0.0));
        saveMember(new Member("MEM-1003", "Marcus Vance", "marcus.vance@civicmail.org", MemberTier.STANDARD, LocalDate.now().minusMonths(3), 30.0));
        saveMember(new Member("MEM-1004", "Priya Nair", "priya.nair@university.edu", MemberTier.STUDENT, LocalDate.now().minusMonths(1), 0.0));

        LocalDate today = LocalDate.now();
        saveLoan(new Loan("LN-5001", "978-0141439518", "MEM-1001", today.minusDays(8), today.plusDays(13)));
        saveLoan(new Loan("LN-5002", "978-0061120084", "MEM-1003", today.minusDays(19), today.minusDays(5)));
        saveLoan(new Loan("LN-5003", "978-0451524935", "MEM-1002", today.minusDays(4), today.plusDays(26)));
    }

    private String escape(String value) {
        return value.replace(",", ";");
    }

    private String unescape(String value) {
        return value.replace(";", ",");
    }
}
