package com.library.model;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public class Loan {
    public static final double DAILY_FINE_RATE = 10.0;

    private final String loanId;
    private final String isbn;
    private final String memberId;
    private final LocalDate checkoutDate;
    private final LocalDate dueDate;
    private LocalDate returnDate;
    private double fineAssessed;

    public Loan(String loanId, String isbn, String memberId, LocalDate checkoutDate, LocalDate dueDate) {
        this(loanId, isbn, memberId, checkoutDate, dueDate, null, 0.0);
    }

    public Loan(String loanId, String isbn, String memberId, LocalDate checkoutDate,
                LocalDate dueDate, LocalDate returnDate, double fineAssessed) {
        this.loanId = loanId;
        this.isbn = isbn;
        this.memberId = memberId;
        this.checkoutDate = checkoutDate;
        this.dueDate = dueDate;
        this.returnDate = returnDate;
        this.fineAssessed = fineAssessed;
    }

    public String getLoanId() {
        return loanId;
    }

    public String getIsbn() {
        return isbn;
    }

    public String getMemberId() {
        return memberId;
    }

    public LocalDate getCheckoutDate() {
        return checkoutDate;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public LocalDate getReturnDate() {
        return returnDate;
    }

    public double getFineAssessed() {
        return fineAssessed;
    }

    public boolean isReturned() {
        return returnDate != null;
    }

    public long getDaysOverdue(LocalDate asOfDate) {
        LocalDate effectiveEnd = returnDate != null ? returnDate : asOfDate;
        if (!effectiveEnd.isAfter(dueDate)) {
            return 0;
        }
        return ChronoUnit.DAYS.between(dueDate, effectiveEnd);
    }

    public double calculateAccruedFine(LocalDate asOfDate) {
        if (isReturned()) {
            return fineAssessed;
        }
        long overdueDays = getDaysOverdue(asOfDate);
        return Math.round(overdueDays * DAILY_FINE_RATE * 100.0) / 100.0;
    }

    public LoanStatus getStatus(LocalDate asOfDate) {
        if (isReturned()) {
            return LoanStatus.RETURNED;
        }
        return asOfDate.isAfter(dueDate) ? LoanStatus.OVERDUE : LoanStatus.ACTIVE;
    }

    public double markReturned(LocalDate returnedOn) {
        if (isReturned()) {
            throw new IllegalStateException("Loan " + loanId + " has already been returned.");
        }
        this.returnDate = returnedOn;
        long overdueDays = getDaysOverdue(returnedOn);
        this.fineAssessed = Math.round(overdueDays * DAILY_FINE_RATE * 100.0) / 100.0;
        return this.fineAssessed;
    }
}
