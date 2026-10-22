import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/jost/600.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/400-italic.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/source-sans-3/700.css';
import './styles/tokens.css';
import './styles/global.css';
import { installTooltips } from './lib/tooltip';
import App from './App';

installTooltips();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div style={{ height: '100%' }}>
      <App />
    </div>
  </StrictMode>
);
