package com.library.service;

import com.library.exception.BookNotAvailableException;
import com.library.exception.BorrowLimitExceededException;
import com.library.exception.LibraryException;
import com.library.model.Book;
import com.library.model.BookCategory;
import com.library.model.Loan;
import com.library.model.MemberTier;
import com.library.repository.LibraryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class LibraryServiceTest {
    private LibraryRepository repository;
    private LibraryService service;

    @BeforeEach
    void setUp() {
        repository = new LibraryRepository();
        service = new LibraryService(repository);
    }

    @Test
    void checkoutAndReturnOnTimeAssessesZeroFine() {
        LocalDate checkoutDate = LocalDate.of(2026, 5, 1);
        Loan loan = service.checkoutBook("978-0441172719", "MEM-1001", checkoutDate);

        assertEquals(checkoutDate.plusDays(MemberTier.STUDENT.getLoanDurationDays()), loan.getDueDate());
        double fine = service.returnBook(loan.getLoanId(), checkoutDate.plusDays(10));

        assertEquals(0.0, fine);
        Book returnedBook = repository.findBookByIsbn("978-0441172719").orElseThrow();
        assertEquals(3, returnedBook.getAvailableCopies());
    }

    @Test
    void overdueReturnCalculatesDailyFineCorrectly() {
        LocalDate checkoutDate = LocalDate.of(2026, 5, 1);
        Loan loan = service.checkoutBook("978-0441172719", "MEM-1003", checkoutDate);
        // STANDARD tier has 14-day loan duration -> due 2026-05-15; returning 6 days late -> ₹60.00 fine
        double fine = service.returnBook(loan.getLoanId(), checkoutDate.plusDays(20));

        assertEquals(60.00, fine, 0.001);
        assertEquals(90.00, repository.findMemberById("MEM-1003").orElseThrow().getUnpaidFines(), 0.001);
    }

    @Test
    void checkoutFailsWhenNoCopiesAvailable() {
        service.addOrRestockBook("978-0000000001", "Rare Manuscript", "A. Author", BookCategory.HISTORY, 1990, 1);
        service.checkoutBook("978-0000000001", "MEM-1001", LocalDate.now());

        assertThrows(BookNotAvailableException.class, () ->
                service.checkoutBook("978-0000000001", "MEM-1004", LocalDate.now()));
    }

    @Test
    void checkoutFailsWhenMemberExceedsTierQuota() {
        service.registerMember("MEM-TEST", "Test Patron", "test@example.com", MemberTier.STANDARD);
        service.checkoutBook("978-0141439518", "MEM-TEST", LocalDate.now());
        service.checkoutBook("978-0061120084", "MEM-TEST", LocalDate.now());
        service.checkoutBook("978-0441172719", "MEM-TEST", LocalDate.now());

        assertThrows(BorrowLimitExceededException.class, () ->
                service.checkoutBook("978-0062316110", "MEM-TEST", LocalDate.now()));
    }

    @Test
    void searchBooksFiltersByQueryAndAvailability() {
        List<Book> classics = service.searchBooks("Pride", BookCategory.CLASSICS, true);
        assertEquals(1, classics.size());
        assertEquals("Pride and Prejudice", classics.get(0).getTitle());
    }

    @Test
    void deleteBookRemovesUnborrowedBook() {
        service.addOrRestockBook("978-0000000099", "Temporary Monograph", "J. Doe", BookCategory.SCIENCE, 2024, 1);
        Book deleted = service.deleteBook("978-0000000099");

        assertEquals("Temporary Monograph", deleted.getTitle());
        assertTrue(repository.findBookByIsbn("978-0000000099").isEmpty());
    }

    @Test
    void deleteBookFailsWhenActiveLoansExist() {
        service.addOrRestockBook("978-0000000100", "Active Loan Book", "A. Reader", BookCategory.FICTION, 2024, 1);
        service.checkoutBook("978-0000000100", "MEM-1001", LocalDate.now());

        assertThrows(LibraryException.class, () -> service.deleteBook("978-0000000100"));
        assertTrue(repository.findBookByIsbn("978-0000000100").isPresent());
    }
}
