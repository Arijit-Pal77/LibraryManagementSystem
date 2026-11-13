package com.library.model;

import java.time.LocalDate;
import java.util.Objects;

public class Member {
    private final String memberId;
    private String fullName;
    private String email;
    private MemberTier tier;
    private final LocalDate joinedDate;
    private double unpaidFines;

    public Member(String memberId, String fullName, String email, MemberTier tier) {
        this(memberId, fullName, email, tier, LocalDate.now(), 0.0);
    }

    public Member(String memberId, String fullName, String email, MemberTier tier,
                  LocalDate joinedDate, double unpaidFines) {
        if (memberId == null || memberId.isBlank()) {
            throw new IllegalArgumentException("Member ID must not be blank.");
        }
        if (fullName == null || fullName.isBlank()) {
            throw new IllegalArgumentException("Full name must not be blank.");
        }
        this.memberId = memberId.trim();
        this.fullName = fullName.trim();
        this.email = email != null ? email.trim() : "";
        this.tier = Objects.requireNonNull(tier, "Member tier is required.");
        this.joinedDate = joinedDate != null ? joinedDate : LocalDate.now();
        this.unpaidFines = Math.max(0.0, unpaidFines);
    }

    public String getMemberId() {
        return memberId;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public MemberTier getTier() {
        return tier;
    }

    public void setTier(MemberTier tier) {
        this.tier = tier;
    }

    public LocalDate getJoinedDate() {
        return joinedDate;
    }

    public double getUnpaidFines() {
        return unpaidFines;
    }

    public void addFine(double amount) {
        if (amount > 0) {
            this.unpaidFines = Math.round((this.unpaidFines + amount) * 100.0) / 100.0;
        }
    }

    public void payFine(double amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("Payment amount must be positive.");
        }
        this.unpaidFines = Math.max(0.0, Math.round((this.unpaidFines - amount) * 100.0) / 100.0);
    }

    @Override
    public String toString() {
        return String.format("%s | %s (%s) | Fines: ₹%.2f",
                memberId, fullName, tier.name(), unpaidFines);
    }
}
