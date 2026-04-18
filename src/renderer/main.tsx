import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { StrictMode } from 'react';
import * as ReactJsxRuntime from 'react/jsx-runtime';
import { createRoot } from 'react-dom/client';

// Expose React for plugins that use the renderer-plugin-template build setup.
// Plugins mark 'react' as external and alias it to a shim that reads this global,
// ensuring all components share the host's single React instance.
(window as unknown as Record<string, unknown>).__zephyrReact = React;
(window as unknown as Record<string, unknown>).__zephyrJsxRuntime = ReactJsxRuntime;

import App from './App';
import { PluginProvider } from './contexts/PluginContext';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PluginProvider>
        <App />
      </PluginProvider>
    </QueryClientProvider>
  </StrictMode>,
);
