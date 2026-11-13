package com.library.model;

public enum BookCategory {
    FICTION("Fiction"),
    CLASSICS("Classics"),
    MYSTERY("Mystery"),
    FANTASY("Fantasy"),
    HISTORY("History"),
    BIOGRAPHY("Biography"),
    SCIENCE("Science"),
    PHILOSOPHY("Philosophy"),
    COMPUTER_SCIENCE("Computer Science"),
    ENGINEERING("Engineering");

    private final String displayName;

    BookCategory(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }

    public static BookCategory fromString(String value) {
        for (BookCategory category : values()) {
            if (category.name().equalsIgnoreCase(value.trim())
                    || category.displayName.equalsIgnoreCase(value.trim())) {
                return category;
            }
        }
        throw new IllegalArgumentException("Unknown book category: " + value);
    }
}
