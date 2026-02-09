
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App_new';

// Wrap fetch to log any API responses that are advertised as JSON but fail to parse.
// This is temporary debug instrumentation to capture stray PHP output or warnings.
if (typeof window !== 'undefined' && window.fetch) {
  const _origFetch = window.fetch.bind(window);
  window.fetch = async (input: any, init?: any) => {
    // Keep PHP session cookies when calling the API from Vite (different port)
    const newInit = Object.assign({}, init || {}, {
      credentials: (init && init.credentials) || 'include',
    });
    const res = await _origFetch(input, newInit);
    try {
      const ct = res.headers.get && res.headers.get('content-type');
      if (ct && ct.indexOf('application/json') !== -1) {
        const txt = await res.clone().text();
        try {
          JSON.parse(txt);
        } catch (e) {
          // Log URL and raw response for debugging
          // eslint-disable-next-line no-console
          console.error('[API JSON PARSE ERROR] URL:', input, 'RAW RESPONSE:', txt);
        }
      }
    } catch (err) {
      // swallow logging errors
    }
    return res;
  };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
