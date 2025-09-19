import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { restoreSupabaseSessionFromLocalStorage } from '@/lib/session';

// Ensure Supabase session is hydrated before rendering the app on hard refresh
await restoreSupabaseSessionFromLocalStorage();
createRoot(document.getElementById("root")!).render(<App />);
