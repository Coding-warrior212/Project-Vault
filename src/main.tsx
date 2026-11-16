import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthGate } from './components/auth/AuthGate';
import { ThemeProvider } from './context/ThemeContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <AuthGate>
      <App />
    </AuthGate>
  </ThemeProvider>
);
