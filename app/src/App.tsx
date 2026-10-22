/* Ported from project/Aegis Mockup.dc.html */
import { DC } from './lib/dc';
import AegisConsole from './pages/AegisConsole';
import AegisDesignSystem from './pages/AegisDesignSystem';
import AegisHandoff from './pages/AegisHandoff';
import Coverage from './pages/Coverage';
import AdminPortal from './pages/AdminPortal';
import Signup from './pages/Signup';

const preview = new URLSearchParams(location.search);
const UI_STATES: Record<string, string> = { live: 'Live', reading: 'Reading…', unreachable: 'Unreachable', empty: 'Empty' };

export default class App extends DC {
  state: any = { view: 'console' };
  componentDidMount() {
    this.read();
    this.h = () => this.read();
    window.addEventListener('hashchange', this.h);
  }
  componentWillUnmount() {
    window.removeEventListener('hashchange', this.h);
  }
  read() {
    const h = location.hash || '';
    if (!h.startsWith('#/')) return;
    const v = h.startsWith('#/design-system') ? 'ds' : h.startsWith('#/handoff') ? 'handoff' : h.startsWith('#/coverage') ? 'coverage' : h.startsWith('#/admin') ? 'admin' : h.startsWith('#/signup') ? 'signup' : 'console';
    if (v !== this.state.view) {
      this.setState({ view: v });
      window.scrollTo(0, 0);
      document.getElementById('root')?.scrollTo(0, 0);
    }
  }
  renderVals() {
    const v = this.state.view;
    return { consoleDisplay: v === 'console' ? 'block' : 'none', isDs: v === 'ds', isHandoff: v === 'handoff', isCoverage: v === 'coverage', isAdmin: v === 'admin', isSignup: v === 'signup' };
  }

  render() {
    const v = this.vals();
    return (
      <>
        <div style={{ display: v.consoleDisplay }}>
          <div>
            <AegisConsole hub={true} role={preview.get('role') || undefined} uiState={UI_STATES[(preview.get('state') || '').toLowerCase()]} />
          </div>
        </div>
        {v.isDs ? (
          <div>
            <AegisDesignSystem hub={true} />
          </div>
        ) : null}
        {v.isHandoff ? (
          <div>
            <AegisHandoff hub={true} />
          </div>
        ) : null}
        {v.isCoverage ? (
          <div>
            <Coverage hub={true} />
          </div>
        ) : null}
        {v.isAdmin ? <AdminPortal /> : null}
        {v.isSignup ? <Signup /> : null}
      </>
    );
  }
}
