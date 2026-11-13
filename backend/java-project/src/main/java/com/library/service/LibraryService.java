package com.library.service;

import com.library.exception.BookNotAvailableException;
import com.library.exception.BorrowLimitExceededException;
import com.library.exception.EntityNotFoundException;
import com.library.exception.LibraryException;
import com.library.model.Book;
import com.library.model.BookCategory;
import com.library.model.Loan;
import com.library.model.LoanStatus;
import com.library.model.Member;
import com.library.model.MemberTier;
import com.library.repository.LibraryRepository;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public class LibraryService {
    private final LibraryRepository repository;

    public LibraryService(LibraryRepository repository) {
        this.repository = repository;
    }

    public Book addOrRestockBook(String isbn, String title, String author, BookCategory category, int year, int copies) {
        return repository.findBookByIsbn(isbn)
                .map(existing -> {
                    existing.addCopies(copies);
                    repository.saveBook(existing);
                    return existing;
                })
                .orElseGet(() -> {
                    Book created = new Book(isbn, title, author, category, year, copies);
                    repository.saveBook(created);
                    return created;
                });
    }

    public Book deleteBook(String isbn) {
        String normalizedIsbn = isbn == null ? "" : isbn.trim();
        Book book = repository.findBookByIsbn(normalizedIsbn)
                .orElseThrow(() -> new EntityNotFoundException("Book", normalizedIsbn));

        long activeLoans = repository.findAllLoans().stream()
                .filter(loan -> loan.getIsbn().equals(book.getIsbn()) && !loan.isReturned())
                .count();
        if (activeLoans > 0) {
            throw new LibraryException(
                    "Cannot delete \"" + book.getTitle() + "\" while " + activeLoans
                            + " active loan(s) remain unreturned.");
        }

        repository.deleteBookByIsbn(book.getIsbn());
        return book;
    }

    public Member registerMember(String memberId, String fullName, String email, MemberTier tier) {
        if (repository.findMemberById(memberId).isPresent()) {
            throw new LibraryException("Member ID already exists: " + memberId);
        }
        Member member = new Member(memberId, fullName, email, tier);
        repository.saveMember(member);
        return member;
    }

    public Loan checkoutBook(String isbn, String memberId, LocalDate checkoutDate) {
        Book book = repository.findBookByIsbn(isbn)
                .orElseThrow(() -> new EntityNotFoundException("Book", isbn));
        Member member = repository.findMemberById(memberId)
                .orElseThrow(() -> new EntityNotFoundException("Member", memberId));

        if (!book.isAvailable()) {
            throw new BookNotAvailableException(isbn);
        }

        List<Loan> activeLoans = getActiveLoansByMember(memberId);
        if (activeLoans.size() >= member.getTier().getMaxActiveLoans()) {
            throw new BorrowLimitExceededException(memberId, member.getTier().getMaxActiveLoans());
        }

        boolean alreadyBorrowed = activeLoans.stream()
                .anyMatch(loan -> loan.getIsbn().equals(isbn));
        if (alreadyBorrowed) {
            throw new LibraryException("Member " + memberId + " already holds an active loan for ISBN " + isbn);
        }

        book.decrementAvailableCopy();
        repository.saveBook(book);

        LocalDate dueDate = checkoutDate.plusDays(member.getTier().getLoanDurationDays());
        String loanId = "LN-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        Loan loan = new Loan(loanId, isbn, memberId, checkoutDate, dueDate);
        repository.saveLoan(loan);

        return loan;
    }

    public double returnBook(String loanId, LocalDate returnDate) {
        Loan loan = repository.findLoanById(loanId)
                .orElseThrow(() -> new EntityNotFoundException("Loan", loanId));

        double fine = loan.markReturned(returnDate);
        repository.saveLoan(loan);

        Book book = repository.findBookByIsbn(loan.getIsbn())
                .orElseThrow(() -> new EntityNotFoundException("Book", loan.getIsbn()));
        book.incrementAvailableCopy();
        repository.saveBook(book);

        if (fine > 0) {
            Member member = repository.findMemberById(loan.getMemberId())
                    .orElseThrow(() -> new EntityNotFoundException("Member", loan.getMemberId()));
            member.addFine(fine);
            repository.saveMember(member);
        }

        return fine;
    }

    public boolean placeHold(String isbn, String memberId) {
        Book book = repository.findBookByIsbn(isbn)
                .orElseThrow(() -> new EntityNotFoundException("Book", isbn));
        repository.findMemberById(memberId)
                .orElseThrow(() -> new EntityNotFoundException("Member", memberId));

        if (book.isAvailable()) {
            throw new LibraryException("Book is currently available for immediate checkout; no hold needed.");
        }
        boolean added = book.enqueueHold(memberId);
        repository.saveBook(book);
        return added;
    }

    public void payMemberFine(String memberId, double amount) {
        Member member = repository.findMemberById(memberId)
                .orElseThrow(() -> new EntityNotFoundException("Member", memberId));
        member.payFine(amount);
        repository.saveMember(member);
    }

    public List<Book> searchBooks(String query, BookCategory categoryFilter, boolean availableOnly) {
        String normalized = query == null ? "" : query.trim().toLowerCase();
        return repository.findAllBooks().stream()
                .filter(book -> categoryFilter == null || book.getCategory() == categoryFilter)
                .filter(book -> !availableOnly || book.isAvailable())
                .filter(book -> normalized.isEmpty()
                        || book.getTitle().toLowerCase().contains(normalized)
                        || book.getAuthor().toLowerCase().contains(normalized)
                        || book.getIsbn().toLowerCase().contains(normalized))
                .sorted(Comparator.comparing(Book::getTitle))
                .toList();
    }

    public List<Loan> getActiveLoansByMember(String memberId) {
        return repository.findAllLoans().stream()
                .filter(loan -> loan.getMemberId().equals(memberId) && !loan.isReturned())
                .toList();
    }

    public List<Loan> getOverdueLoans(LocalDate asOfDate) {
        return repository.findAllLoans().stream()
                .filter(loan -> loan.getStatus(asOfDate) == LoanStatus.OVERDUE)
                .sorted(Comparator.comparing(Loan::getDueDate))
                .toList();
    }

    public List<Loan> getAllLoans() {
        return repository.findAllLoans().stream()
                .sorted(Comparator.comparing(Loan::getCheckoutDate).reversed())
                .toList();
    }

    public List<Member> getAllMembers() {
        return repository.findAllMembers().stream()
                .sorted(Comparator.comparing(Member::getMemberId))
                .toList();
    }
}
