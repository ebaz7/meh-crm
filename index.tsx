
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Expose libraries globally for components relying on window.html2canvas/window.jspdf
(window as any).html2canvas = html2canvas;
(window as any).jspdf = { jsPDF };

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
