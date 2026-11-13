package com.library.exception;

public class BookNotAvailableException extends LibraryException {
    public BookNotAvailableException(String isbn) {
        super("No available copies remaining for ISBN: " + isbn);
    }
}
