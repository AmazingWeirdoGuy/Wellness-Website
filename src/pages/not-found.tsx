import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="not-found-page">
      <section className="not-found-card">
        <div className="not-found-heading">
          <AlertCircle size={28} strokeWidth={1.5} />
          <h1>Page not found</h1>
        </div>
        <p>This page does not belong to the journal.</p>
      </section>
    </main>
  );
}
