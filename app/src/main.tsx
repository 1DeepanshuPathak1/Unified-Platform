import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/400-italic.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
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
