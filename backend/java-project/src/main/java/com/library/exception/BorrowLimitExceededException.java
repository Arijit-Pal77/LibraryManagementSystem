package com.library.exception;

public class BorrowLimitExceededException extends LibraryException {
    public BorrowLimitExceededException(String memberId, int maxAllowed) {
        super(String.format("Member %s has reached the maximum active loan limit (%d).", memberId, maxAllowed));
    }
}
