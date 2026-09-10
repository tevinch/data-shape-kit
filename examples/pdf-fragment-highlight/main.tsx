import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './style.css';

import App from './App.js';

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
