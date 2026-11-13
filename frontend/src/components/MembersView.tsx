import React, { useMemo, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import {
  LibraryState,
  MEMBER_TIER_RULES,
  Member,
  MemberTier,
  formatInr,
  getLoanAccruedFine,
  getLoanDaysOverdue,
  performCheckoutBook,
  performPayFine,
  performRegisterMember,
  performReturnBook,
} from '../lib/libraryEngine';

interface MembersViewProps {
  state: LibraryState;
  onUpdateState: (next: LibraryState) => void;
  onNotify: (message: string, tone?: 'success' | 'error') => void;
}

export function MembersView({ state, onUpdateState, onNotify }: MembersViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [memberId, setMemberId] = useState(`MEM-${1005 + state.members.length}`);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState<MemberTier>('STUDENT');
  const [loansModalMember, setLoansModalMember] = useState<Member | null>(null);
  const [borrowIsbn, setBorrowIsbn] = useState(state.books[0]?.isbn ?? '');

  const bookMap = useMemo(
    () => new Map(state.books.map((b) => [b.isbn, b])),
    [state.books]
  );

  const activeLoanCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const loan of state.loans) {
      if (loan.returnDate === null) {
        counts.set(loan.memberId, (counts.get(loan.memberId) ?? 0) + 1);
      }
    }
    return counts;
  }, [state.loans]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = performRegisterMember(state, {
        memberId,
        fullName,
        email,
        tier,
      });
      onUpdateState(result.state);
      onNotify(`Registered member ${result.member.memberId} (${result.member.fullName})`);
      setMemberId(`MEM-${1006 + state.members.length}`);
      setFullName('');
      setEmail('');
      setShowModal(false);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Registration failed', 'error');
    }
  };

  const handleSettleFine = (id: string, amount: number) => {
    try {
      const next = performPayFine(state, id, amount);
      onUpdateState(next);
      onNotify(`Settled ${formatInr(amount)} fine for ${id}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Payment failed', 'error');
    }
  };

  const handleMemberBorrow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loansModalMember) return;
    try {
      const res = performCheckoutBook(state, borrowIsbn, loansModalMember.memberId);
      onUpdateState(res.state);
      onNotify(`Issued loan ${res.loan.loanId} to ${loansModalMember.fullName} · Due ${res.loan.dueDate}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Borrow failed', 'error');
    }
  };

  const handleMemberReturn = (loanId: string) => {
    try {
      const res = performReturnBook(state, loanId);
      onUpdateState(res.state);
      onNotify(
        res.fine > 0
          ? `Returned ${loanId} · Assessed overdue fine of ${formatInr(res.fine)}`
          : `Returned ${loanId} on time · No fine`
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Return failed', 'error');
    }
  };

  const modalMemberLoans = useMemo(() => {
    if (!loansModalMember) return [];
    return state.loans.filter(
      (l) => l.memberId === loansModalMember.memberId && l.returnDate === null
    );
  }, [state.loans, loansModalMember]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Member Registry & Tier Quotas
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Borrow limits and loan durations are enforced by{' '}
            <span className="font-mono text-slate-800">MemberTier</span> (Standard 3/14d, Student 5/21d, Faculty 10/30d).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          Register Member
        </button>
      </div>

      {/* Tier Policy Reference Row */}
      <div className="grid grid-cols-1 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {(['STANDARD', 'STUDENT', 'FACULTY'] as MemberTier[]).map((t) => {
          const rule = MEMBER_TIER_RULES[t];
          return (
            <div key={t} className="px-5 py-4">
              <div className="text-xs font-medium text-slate-500">{rule.label} Tier Policy</div>
              <div className="mt-1 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                Up to {rule.maxActiveLoans} active loans · {rule.loanDurationDays} days
              </div>
            </div>
          );
        })}
      </div>

      {/* Members Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="px-4 py-3">Member ID</th>
                <th className="px-4 py-3">Full Name & Email</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Active Loans</th>
                <th className="px-4 py-3 text-right">Unpaid Fines</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {state.members.map((member) => {
                const active = activeLoanCounts.get(member.memberId) ?? 0;
                const quota = MEMBER_TIER_RULES[member.tier].maxActiveLoans;
                return (
                  <tr key={member.memberId} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 whitespace-nowrap">
                      {member.memberId}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{member.fullName}</div>
                      <div className="text-xs text-slate-500">{member.email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                      {MEMBER_TIER_RULES[member.tier].label}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {member.joinedDate}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-800 tabular-nums whitespace-nowrap">
                      {active} / {quota}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-medium tabular-nums whitespace-nowrap">
                      <span className={member.unpaidFines > 0 ? 'text-red-700' : 'text-slate-600'}>
                        {formatInr(member.unpaidFines)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const firstAvail = state.books.find((b) => b.availableCopies > 0);
                            if (firstAvail) setBorrowIsbn(firstAvail.isbn);
                            setLoansModalMember(member);
                          }}
                          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 cursor-pointer"
                        >
                          Borrow / Return
                        </button>
                        {member.unpaidFines > 0 && (
                          <button
                            type="button"
                            onClick={() => handleSettleFine(member.memberId, member.unpaidFines)}
                            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors hover:border-emerald-600 hover:text-emerald-700 cursor-pointer"
                          >
                            Settle Balance
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Member Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-semibold text-slate-900">Register Library Member</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleRegister} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Member ID</label>
                  <input
                    type="text"
                    required
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Membership Tier</label>
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value as MemberTier)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    <option value="STANDARD">Standard (3 loans)</option>
                    <option value="STUDENT">Student (5 loans)</option>
                    <option value="FACULTY">Faculty (10 loans)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jordan Patel"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jordan.patel@university.edu"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 cursor-pointer"
                >
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Borrow / Return Modal */}
      {loansModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {loansModalMember.fullName}
                </h2>
                <p className="font-mono text-xs text-slate-500">
                  {loansModalMember.memberId} · {MEMBER_TIER_RULES[loansModalMember.tier].label} ·{' '}
                  {modalMemberLoans.length} / {MEMBER_TIER_RULES[loansModalMember.tier].maxActiveLoans} loans
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLoansModalMember(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-5">
              {/* Borrow a Book for this Member */}
              <form onSubmit={handleMemberBorrow} className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  Borrow Book
                </label>
                <div className="flex gap-2">
                  <select
                    value={borrowIsbn}
                    onChange={(e) => setBorrowIsbn(e.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    {state.books.map((b) => (
                      <option key={b.isbn} value={b.isbn}>
                        {b.title} ({b.availableCopies}/{b.totalCopies} avail)
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Borrow
                  </button>
                </div>
              </form>

              {/* Active Loans List for Return */}
              <div>
                <div className="mb-2 text-xs font-medium text-slate-700">
                  Active Borrowed Books ({modalMemberLoans.length})
                </div>
                {modalMemberLoans.length === 0 ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-5 text-center text-xs text-slate-500">
                    No books currently borrowed by this member.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
                    {modalMemberLoans.map((loan) => {
                      const book = bookMap.get(loan.isbn);
                      const daysOverdue = getLoanDaysOverdue(loan, state.simulationDate);
                      const fine = getLoanAccruedFine(loan, state.simulationDate);
                      return (
                        <div
                          key={loan.loanId}
                          className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-900">
                              {book?.title ?? loan.isbn}
                            </div>
                            <div className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
                              {loan.loanId} · Due {loan.dueDate}
                              {daysOverdue > 0 && (
                                <span className="font-medium text-red-700">
                                  {' '}
                                  · {daysOverdue}d overdue ({formatInr(fine)})
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleMemberReturn(loan.loanId)}
                            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:border-emerald-600 hover:text-emerald-700 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Return
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setLoansModalMember(null)}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
