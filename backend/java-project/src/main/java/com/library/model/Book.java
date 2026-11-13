package com.library.model;

import java.util.LinkedList;
import java.util.Objects;
import java.util.Queue;

public class Book {
    private final String isbn;
    private String title;
    private String author;
    private BookCategory category;
    private int publicationYear;
    private int totalCopies;
    private int availableCopies;
    private final Queue<String> holdQueue;

    public Book(String isbn, String title, String author, BookCategory category, int publicationYear, int totalCopies) {
        this(isbn, title, author, category, publicationYear, totalCopies, totalCopies);
    }

    public Book(String isbn, String title, String author, BookCategory category,
                int publicationYear, int totalCopies, int availableCopies) {
        if (isbn == null || isbn.isBlank()) {
            throw new IllegalArgumentException("ISBN must not be blank.");
        }
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Title must not be blank.");
        }
        if (totalCopies < 1) {
            throw new IllegalArgumentException("Total copies must be at least 1.");
        }
        if (availableCopies < 0 || availableCopies > totalCopies) {
            throw new IllegalArgumentException("Available copies must be between 0 and total copies.");
        }

        this.isbn = isbn.trim();
        this.title = title.trim();
        this.author = author != null ? author.trim() : "Unknown";
        this.category = Objects.requireNonNull(category, "Category is required.");
        this.publicationYear = publicationYear;
        this.totalCopies = totalCopies;
        this.availableCopies = availableCopies;
        this.holdQueue = new LinkedList<>();
    }

    public String getIsbn() {
        return isbn;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = author;
    }

    public BookCategory getCategory() {
        return category;
    }

    public void setCategory(BookCategory category) {
        this.category = category;
    }

    public int getPublicationYear() {
        return publicationYear;
    }

    public void setPublicationYear(int publicationYear) {
        this.publicationYear = publicationYear;
    }

    public int getTotalCopies() {
        return totalCopies;
    }

    public int getAvailableCopies() {
        return availableCopies;
    }

    public boolean isAvailable() {
        return availableCopies > 0;
    }

    public void decrementAvailableCopy() {
        if (availableCopies <= 0) {
            throw new IllegalStateException("No available copies to check out for ISBN: " + isbn);
        }
        availableCopies--;
    }

    public void incrementAvailableCopy() {
        if (availableCopies >= totalCopies) {
            throw new IllegalStateException("All copies already returned for ISBN: " + isbn);
        }
        availableCopies++;
    }

    public void addCopies(int additionalCopies) {
        if (additionalCopies <= 0) {
            throw new IllegalArgumentException("Additional copies must be positive.");
        }
        this.totalCopies += additionalCopies;
        this.availableCopies += additionalCopies;
    }

    public Queue<String> getHoldQueue() {
        return holdQueue;
    }

    public boolean enqueueHold(String memberId) {
        if (holdQueue.contains(memberId)) {
            return false;
        }
        return holdQueue.offer(memberId);
    }

    public String pollNextHold() {
        return holdQueue.poll();
    }

    @Override
    public String toString() {
        return String.format("%s | %s by %s (%d) [%d/%d available]",
                isbn, title, author, publicationYear, availableCopies, totalCopies);
    }
}
