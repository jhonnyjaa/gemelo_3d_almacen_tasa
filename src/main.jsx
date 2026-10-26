import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';
createRoot(document.getElementById('root')).render(<App />);
import { useApp } from './state.js';
import { walkerPos } from './People.jsx';
if (import.meta.env.DEV) { window.__app = useApp; window.__walker = walkerPos; }
