package com.library.model;

public enum MemberTier {
    STANDARD(3, 14),
    STUDENT(5, 21),
    FACULTY(10, 30);

    private final int maxActiveLoans;
    private final int loanDurationDays;

    MemberTier(int maxActiveLoans, int loanDurationDays) {
        this.maxActiveLoans = maxActiveLoans;
        this.loanDurationDays = loanDurationDays;
    }

    public int getMaxActiveLoans() {
        return maxActiveLoans;
    }

    public int getLoanDurationDays() {
        return loanDurationDays;
    }
}
