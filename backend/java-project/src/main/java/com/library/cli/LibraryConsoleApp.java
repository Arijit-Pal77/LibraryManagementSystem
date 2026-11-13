package com.library.cli;

import com.library.exception.LibraryException;
import com.library.model.Book;
import com.library.model.BookCategory;
import com.library.model.Loan;
import com.library.model.Member;
import com.library.model.MemberTier;
import com.library.repository.LibraryRepository;
import com.library.service.LibraryService;

import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Scanner;

public class LibraryConsoleApp {
    private final LibraryService service;
    private final Scanner scanner;

    public LibraryConsoleApp(LibraryService service) {
        this.service = service;
        this.scanner = new Scanner(System.in);
    }

    public static void main(String[] args) {
        LibraryRepository repository = new LibraryRepository(Path.of("data"));
        LibraryService service = new LibraryService(repository);
        new LibraryConsoleApp(service).run();
    }

    public void run() {
        printBanner();
        boolean running = true;
        while (running) {
            printMenu();
            String choice = scanner.nextLine().trim();
            try {
                switch (choice) {
                    case "1" -> listCatalog();
                    case "2" -> searchCatalog();
                    case "3" -> addBook();
                    case "4" -> registerMember();
                    case "5" -> checkoutBook();
                    case "6" -> returnBook();
                    case "7" -> viewOverdueLoans();
                    case "8" -> payFine();
                    case "9" -> deleteBook();
                    case "0" -> {
                        System.out.println("Saving library ledger and exiting. Goodbye.");
                        running = false;
                    }
                    default -> System.out.println("Invalid option. Please select 0-9.");
                }
            } catch (LibraryException | IllegalArgumentException ex) {
                System.out.println("Error: " + ex.getMessage());
            }
        }
    }

    private void printBanner() {
        System.out.println("============================================================");
        System.out.println("      LibraryManagementSystem (Java 17)");
        System.out.println("============================================================");
    }

    private void printMenu() {
        System.out.println("\n[1] List Catalog          [5] Checkout Book");
        System.out.println("[2] Search Books          [6] Return Book");
        System.out.println("[3] Add / Restock Book    [7] Overdue Report");
        System.out.println("[4] Register Member       [8] Settle Member Fine");
        System.out.println("[9] Delete Book           [0] Exit");
        System.out.print("Select option > ");
    }

    private void listCatalog() {
        List<Book> books = service.searchBooks("", null, false);
        System.out.printf("%-16s | %-36s | %-24s | %-16s | %s%n",
                "ISBN", "TITLE", "AUTHOR", "CATEGORY", "COPIES");
        System.out.println("-".repeat(110));
        for (Book b : books) {
            System.out.printf("%-16s | %-36s | %-24s | %-16s | %d/%d%n",
                    b.getIsbn(),
                    truncate(b.getTitle(), 36),
                    truncate(b.getAuthor(), 24),
                    b.getCategory().getDisplayName(),
                    b.getAvailableCopies(),
                    b.getTotalCopies());
        }
    }

    private void searchCatalog() {
        System.out.print("Search query (title, author, or ISBN): ");
        String query = scanner.nextLine();
        List<Book> results = service.searchBooks(query, null, false);
        if (results.isEmpty()) {
            System.out.println("No matching books found.");
            return;
        }
        results.forEach(System.out::println);
    }

    private void addBook() {
        System.out.print("ISBN: ");
        String isbn = scanner.nextLine();
        System.out.print("Title: ");
        String title = scanner.nextLine();
        System.out.print("Author: ");
        String author = scanner.nextLine();
        System.out.print("Category (FICTION, CLASSICS, MYSTERY, FANTASY, HISTORY, BIOGRAPHY, SCIENCE, PHILOSOPHY, COMPUTER_SCIENCE, ENGINEERING): ");
        BookCategory category = BookCategory.fromString(scanner.nextLine());
        System.out.print("Publication Year: ");
        int year = Integer.parseInt(scanner.nextLine().trim());
        System.out.print("Copies: ");
        int copies = Integer.parseInt(scanner.nextLine().trim());

        Book book = service.addOrRestockBook(isbn, title, author, category, year, copies);
        System.out.println("Catalog updated: " + book);
    }

    private void registerMember() {
        System.out.print("Member ID (e.g. MEM-1005): ");
        String id = scanner.nextLine();
        System.out.print("Full Name: ");
        String name = scanner.nextLine();
        System.out.print("Email: ");
        String email = scanner.nextLine();
        System.out.print("Tier (STANDARD, STUDENT, FACULTY): ");
        MemberTier tier = MemberTier.valueOf(scanner.nextLine().trim().toUpperCase());

        Member member = service.registerMember(id, name, email, tier);
        System.out.println("Registered member: " + member);
    }

    private void checkoutBook() {
        System.out.print("ISBN: ");
        String isbn = scanner.nextLine().trim();
        System.out.print("Member ID: ");
        String memberId = scanner.nextLine().trim();

        Loan loan = service.checkoutBook(isbn, memberId, LocalDate.now());
        System.out.printf("Loan issued [%s]. Due date: %s%n", loan.getLoanId(), loan.getDueDate());
    }

    private void returnBook() {
        System.out.print("Loan ID: ");
        String loanId = scanner.nextLine().trim();
        double fine = service.returnBook(loanId, LocalDate.now());
        System.out.printf("Book returned. Overdue fine assessed: ₹%.2f%n", fine);
    }

    private void viewOverdueLoans() {
        LocalDate today = LocalDate.now();
        List<Loan> overdue = service.getOverdueLoans(today);
        if (overdue.isEmpty()) {
            System.out.println("No overdue loans as of " + today);
            return;
        }
        System.out.printf("%-10s | %-16s | %-10s | %-12s | %-8s | %s%n",
                "LOAN ID", "ISBN", "MEMBER", "DUE DATE", "DAYS", "ACCRUED FINE");
        System.out.println("-".repeat(78));
        for (Loan l : overdue) {
            System.out.printf("%-10s | %-16s | %-10s | %-12s | %-8d | ₹%.2f%n",
                    l.getLoanId(),
                    l.getIsbn(),
                    l.getMemberId(),
                    l.getDueDate(),
                    l.getDaysOverdue(today),
                    l.calculateAccruedFine(today));
        }
    }

    private void payFine() {
        System.out.print("Member ID: ");
        String memberId = scanner.nextLine().trim();
        System.out.print("Payment Amount (₹): ");
        double amount = Double.parseDouble(scanner.nextLine().trim());
        service.payMemberFine(memberId, amount);
        System.out.println("Payment recorded successfully.");
    }

    private void deleteBook() {
        System.out.print("ISBN to delete: ");
        String isbn = scanner.nextLine().trim();
        Book removed = service.deleteBook(isbn);
        System.out.println("Deleted book from database: " + removed.getTitle() + " (" + removed.getIsbn() + ")");
    }

    private String truncate(String text, int max) {
        if (text.length() <= max) {
            return text;
        }
        return text.substring(0, max - 3) + "...";
    }
}
