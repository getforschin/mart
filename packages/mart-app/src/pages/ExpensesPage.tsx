import { useEffect, useState } from 'react';
import { useDataPort } from '../context';
import type { MartExpense, MartExpenseSchedule } from '../types';

const CATEGORIES = ['RENT', 'SALARY', 'UTILITIES', 'TRANSPORT', 'MAINTENANCE', 'PACKAGING', 'MISC'];

export function ExpensesPage(): JSX.Element {
  const port = useDataPort();
  const [expenses, setExpenses] = useState<MartExpense[]>([]);
  const [schedules, setSchedules] = useState<MartExpenseSchedule[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [purpose, setPurpose] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('MISC');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [payee, setPayee] = useState('');
  const [notes, setNotes] = useState('');

  const [schedPurpose, setSchedPurpose] = useState('');
  const [schedAmount, setSchedAmount] = useState('');
  const [schedDay, setSchedDay] = useState('1');
  const [schedCategory, setSchedCategory] = useState('RENT');

  const load = async (): Promise<void> => {
    if (!port.listExpenses) {
      setError('Expenses not available on this port');
      return;
    }
    const monthStart = new Date().toISOString().slice(0, 8) + '01';
    const today = new Date().toISOString().slice(0, 10);
    const [exp, sched] = await Promise.all([
      port.listExpenses(monthStart, today),
      port.listExpenseSchedules?.() ?? Promise.resolve([]),
    ]);
    setExpenses(exp);
    setSchedules(sched);
  };

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Load failed'));
  }, [port]);

  return (
    <div className="mart-page">
      <h2>Expenses</h2>
      <p className="lead">One-time costs and monthly recurring schedules for profit/loss.</p>
      {error ? <p className="mart-error">{error}</p> : null}

      <h3>One-time expense</h3>
      <div className="mart-form">
        <input className="mart-input" placeholder="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        <input className="mart-input" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input className="mart-input" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
        <select className="mart-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select className="mart-select" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
          <option value="CASH">CASH</option>
          <option value="UPI">UPI</option>
          <option value="BANK">BANK</option>
          <option value="CHEQUE">CHEQUE</option>
        </select>
        <input className="mart-input" placeholder="Payee" value={payee} onChange={(e) => setPayee(e.target.value)} />
        <input className="mart-input" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button
          type="button"
          className="mart-btn"
          onClick={() =>
            void port
              .createExpense?.({
                purpose,
                amount: Number(amount) || 0,
                expenseDate,
                category,
                paymentMode,
                payee: payee || undefined,
                notes: notes || undefined,
              })
              .then(() => {
                setPurpose('');
                setAmount('');
                setPayee('');
                setNotes('');
                return load();
              })
              .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Save failed'))
          }
        >
          Save expense
        </button>
      </div>

      <h3>Monthly recurring</h3>
      <div className="mart-form">
        <input
          className="mart-input"
          placeholder="Purpose (e.g. Shop rent)"
          value={schedPurpose}
          onChange={(e) => setSchedPurpose(e.target.value)}
        />
        <input
          className="mart-input"
          placeholder="Amount"
          value={schedAmount}
          onChange={(e) => setSchedAmount(e.target.value)}
        />
        <input
          className="mart-input"
          placeholder="Day of month (1–28)"
          value={schedDay}
          onChange={(e) => setSchedDay(e.target.value)}
        />
        <select className="mart-select" value={schedCategory} onChange={(e) => setSchedCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="mart-btn"
          onClick={() =>
            void port
              .upsertExpenseSchedule?.({
                purpose: schedPurpose,
                amount: Number(schedAmount) || 0,
                dayOfMonth: Number(schedDay) || 1,
                category: schedCategory,
                paymentMode: 'BANK',
              })
              .then(() => {
                setSchedPurpose('');
                setSchedAmount('');
                return load();
              })
              .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Schedule failed'))
          }
        >
          Save schedule
        </button>
        <button
          type="button"
          className="mart-btn mart-btn--ghost"
          onClick={() =>
            void port
              .runExpenseSchedules?.()
              .then(() => load())
              .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Run failed'))
          }
        >
          Post due schedules
        </button>
      </div>

      <div className="mart-table-wrap">
        <h3>Schedules</h3>
        <table className="mart-table">
          <thead>
            <tr>
              <th>Purpose</th>
              <th>Day</th>
              <th>Amount</th>
              <th>Category</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id}>
                <td>{s.purpose}</td>
                <td>{s.dayOfMonth}</td>
                <td>₹{Number(s.amount).toFixed(2)}</td>
                <td>{s.category}</td>
                <td>{s.isActive ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mart-table-wrap">
        <h3>This month&apos;s expenses</h3>
        <table className="mart-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Purpose</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>{e.expenseDate}</td>
                <td>
                  {e.purpose}
                  {e.isRecurringGenerated ? ' · auto' : ''}
                </td>
                <td>{e.category}</td>
                <td>₹{Number(e.amount).toFixed(2)}</td>
                <td>{e.paymentMode ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
