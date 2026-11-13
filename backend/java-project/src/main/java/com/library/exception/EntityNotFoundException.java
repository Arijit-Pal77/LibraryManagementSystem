package com.library.exception;

public class EntityNotFoundException extends LibraryException {
    public EntityNotFoundException(String entityType, String identifier) {
        super(entityType + " not found with identifier: " + identifier);
    }
}
