import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return (
    <div>
      <h1>SCUT - Subspace Communications Universal Transceiver</h1>
      <p>The Moot is loading...</p>
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
