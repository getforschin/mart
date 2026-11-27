import { FormEvent, useEffect, useRef, useState } from 'react';

interface CustomerEntryModalProps {
  initialName: string;
  initialMobile: string;
  onSave: (input: { name: string; mobile: string }) => Promise<void>;
  onCancel: () => void;
}

export function CustomerEntryModal({
  initialName,
  initialMobile,
  onSave,
  onCancel,
}: CustomerEntryModalProps): JSX.Element {
  const [name, setName] = useState(initialName);
  const [mobile, setMobile] = useState(initialMobile);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const target = initialName.trim() ? mobileRef.current : nameRef.current;
    target?.focus();
    target?.select();
  }, [initialName]);

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedMobile = mobile.trim().replace(/\s+/g, '');
    if (!trimmedName) {
      setError('Name is required');
      return;
    }
    if (!/^\d{10}$/.test(trimmedMobile)) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setSaving(true);
    setError(null);
    void onSave({ name: trimmedName, mobile: trimmedMobile })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not save customer');
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cust-modal-title">
      <div className="modal modal--customer">
        <h2 id="cust-modal-title">New customer</h2>
        <p className="modal__subtitle">No match found — add them and continue billing.</p>
        <form className="customer-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
              autoComplete="off"
            />
          </label>
          <label>
            Mobile
            <input
              ref={mobileRef}
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
              placeholder="10-digit mobile"
              inputMode="numeric"
              autoComplete="off"
            />
          </label>
          {error !== null && <p className="error-banner">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save & use'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
