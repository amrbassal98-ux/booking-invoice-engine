/**
 * @fileoverview Application entry point.
 * Renders the root <App /> component inside React StrictMode
 * to enable additional development-time checks.
 *
 * @module main
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
