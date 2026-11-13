import React, { useMemo, useState } from 'react';
import { Calendar, CheckCircle2, RotateCcw } from 'lucide-react';
import {
  LibraryState,
  LoanStatus,
  MEMBER_TIER_RULES,
  addDaysIso,
  DAILY_FINE_RATE,
  formatInr,
  getLoanAccruedFine,
  getLoanDaysOverdue,
  getLoanStatus,
  performCheckoutBook,
  performReturnBook,
  todayIsoDate,
} from '../lib/libraryEngine';

interface CirculationViewProps {
  state: LibraryState;
  onUpdateState: (next: LibraryState) => void;
  onNotify: (message: string, tone?: 'success' | 'error') => void;
}

type StatusFilter = 'ALL' | LoanStatus;

export function CirculationView({ state, onUpdateState, onNotify }: CirculationViewProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [checkoutIsbn, setCheckoutIsbn] = useState(state.books[0]?.isbn ?? '');
  const [checkoutMemberId, setCheckoutMemberId] = useState(state.members[0]?.memberId ?? '');

  const bookMap = useMemo(
    () => new Map(state.books.map((b) => [b.isbn, b])),
    [state.books]
  );
  const memberMap = useMemo(
    () => new Map(state.members.map((m) => [m.memberId, m])),
    [state.members]
  );

  const enrichedLoans = useMemo(() => {
    return state.loans
      .map((loan) => {
        const status = getLoanStatus(loan, state.simulationDate);
        const daysOverdue = getLoanDaysOverdue(loan, state.simulationDate);
        const accruedFine = getLoanAccruedFine(loan, state.simulationDate);
        return {
          loan,
          status,
          daysOverdue,
          accruedFine,
          book: bookMap.get(loan.isbn),
          member: memberMap.get(loan.memberId),
        };
      })
      .filter((item) => statusFilter === 'ALL' || item.status === statusFilter);
  }, [state.loans, state.simulationDate, bookMap, memberMap, statusFilter]);

  const overdueCount = useMemo(
    () => state.loans.filter((l) => getLoanStatus(l, state.simulationDate) === 'OVERDUE').length,
    [state.loans, state.simulationDate]
  );
  const activeCount = useMemo(
    () => state.loans.filter((l) => l.returnDate === null).length,
    [state.loans]
  );

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = performCheckoutBook(state, checkoutIsbn, checkoutMemberId);
      onUpdateState(result.state);
      onNotify(`Loan ${result.loan.loanId} issued · Due ${result.loan.dueDate}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Checkout failed', 'error');
    }
  };

  const handleReturn = (loanId: string) => {
    try {
      const result = performReturnBook(state, loanId);
      onUpdateState(result.state);
      onNotify(
        result.fine > 0
          ? `Returned ${loanId} · Assessed overdue fine of ${formatInr(result.fine)}`
          : `Returned ${loanId} on time · No fine`
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Return failed', 'error');
    }
  };

  const advanceDate = (days: number) => {
    const nextDate = addDaysIso(state.simulationDate, days);
    onUpdateState({ ...state, simulationDate: nextDate });
    onNotify(`Simulated library clock advanced to ${nextDate}`);
  };

  const resetDate = () => {
    const today = todayIsoDate();
    onUpdateState({ ...state, simulationDate: today });
    onNotify(`Simulated library clock reset to ${today}`);
  };

  const selectedMember = memberMap.get(checkoutMemberId);
  const selectedMemberActiveCount = useMemo(
    () => state.loans.filter((l) => l.memberId === checkoutMemberId && l.returnDate === null).length,
    [state.loans, checkoutMemberId]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Borrow & Return Desk
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Borrow books, return active loans, and advance the simulated date to calculate overdue fines ({formatInr(DAILY_FINE_RATE)}/day).
          </p>
        </div>

        {/* Simulated Date Controls */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div className="flex items-center gap-2 pr-2 text-xs text-slate-600">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span>Sim Date:</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {state.simulationDate}
            </span>
          </div>
          <button
            type="button"
            onClick={() => advanceDate(1)}
            className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            +1 Day
          </button>
          <button
            type="button"
            onClick={() => advanceDate(7)}
            className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            +7 Days
          </button>
          <button
            type="button"
            onClick={() => advanceDate(15)}
            className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            +15 Days
          </button>
          <button
            type="button"
            onClick={resetDate}
            className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            Today
          </button>
        </div>
      </div>

      {/* Borrow Book Form */}
      <form
        onSubmit={handleCheckout}
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-slate-700">Book Title (ISBN)</label>
            <select
              value={checkoutIsbn}
              onChange={(e) => setCheckoutIsbn(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              {state.books.map((b) => (
                <option key={b.isbn} value={b.isbn}>
                  {b.title} ({b.availableCopies}/{b.totalCopies} avail)
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-slate-700">Member Account</label>
            <select
              value={checkoutMemberId}
              onChange={(e) => setCheckoutMemberId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              {state.members.map((m) => (
                <option key={m.memberId} value={m.memberId}>
                  {m.memberId} — {m.fullName} ({m.tier})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Borrow Book
            </button>
          </div>
        </div>

        {selectedMember && (
          <div className="font-mono text-xs text-slate-500 tabular-nums">
            Loan Period: {MEMBER_TIER_RULES[selectedMember.tier].loanDurationDays} days · Due Date:{' '}
            {addDaysIso(
              state.simulationDate,
              MEMBER_TIER_RULES[selectedMember.tier].loanDurationDays
            )}{' '}
            · Member Quota: {selectedMemberActiveCount} /{' '}
            {MEMBER_TIER_RULES[selectedMember.tier].maxActiveLoans} active
          </div>
        )}
      </form>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
          {(
            [
              { id: 'ALL', label: `All Loans (${state.loans.length})` },
              { id: 'ACTIVE', label: `Active (${activeCount - overdueCount})` },
              { id: 'OVERDUE', label: `Overdue (${overdueCount})` },
              { id: 'RETURNED', label: 'Returned' },
            ] as const
          ).map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loans Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {enrichedLoans.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <CheckCircle2 className="h-8 w-8 text-slate-300" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900">No loans in this view</h3>
            <p className="mt-1 text-sm text-slate-500">
              Switch filters or issue a new loan from the desk above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="px-4 py-3">Loan ID</th>
                  <th className="px-4 py-3">Book</th>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Checkout</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Fine</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {enrichedLoans.map(({ loan, status, daysOverdue, accruedFine, book, member }) => (
                  <tr key={loan.loanId} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 tabular-nums whitespace-nowrap">
                      {loan.loanId}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {book?.title ?? loan.isbn}
                      </div>
                      <div className="font-mono text-xs text-slate-500 tabular-nums">
                        {loan.isbn}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-900">{member?.fullName ?? loan.memberId}</div>
                      <div className="font-mono text-xs text-slate-500">
                        {loan.memberId} · {member?.tier ?? 'STANDARD'}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {loan.checkoutDate}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-800 tabular-nums whitespace-nowrap">
                      {loan.dueDate}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {status === 'ACTIVE' && (
                        <span className="font-medium text-emerald-700">Active</span>
                      )}
                      {status === 'OVERDUE' && (
                        <span className="font-medium text-red-700">
                          Overdue · {daysOverdue}d late
                        </span>
                      )}
                      {status === 'RETURNED' && (
                        <span className="text-slate-500">
                          Returned · {loan.returnDate}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-medium tabular-nums whitespace-nowrap">
                      <span className={accruedFine > 0 ? 'text-red-700' : 'text-slate-600'}>
                        {formatInr(accruedFine)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {loan.returnDate === null ? (
                        <button
                          type="button"
                          onClick={() => handleReturn(loan.loanId)}
                          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 cursor-pointer"
                        >
                          Return Book
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Closed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
