'use client';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print-btn"
      style={{ marginTop: 16, width: '100%', padding: 10, fontSize: 14 }}
    >
      Print
    </button>
  );
}
