import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Root element #root not found');
}

if (!window.posApi) {
  ReactDOM.createRoot(rootElement).render(
    <div className="browser-warning">
      <h1>Mart POS must run inside the Electron desktop app</h1>
      <p>
        Do not open <code>http://localhost:5175</code> in a browser — it will show a blank page.
      </p>
      <pre>{`cd "/home/sachin/Documents/SELF MADE/mart"
nvm use 20
npm run pos:dev`}</pre>
      <p>An Electron window will open automatically with login and billing screens.</p>
    </div>,
  );
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
