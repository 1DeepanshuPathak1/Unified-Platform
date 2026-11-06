import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/400-italic.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/ibm-plex-sans/300.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/400-italic.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import './styles/tokens.css';
import './styles/global.css';
import './styles/graphite.css';
import './styles/fonts';
import './styles/horizon.css';
import './styles/command.css';
import './styles/ledger.css';
import './styles/lumen.css';
import './styles/atlas.css';
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
