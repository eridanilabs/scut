import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppLayout } from './components/layout/AppLayout';
import { ProjectsPage } from './pages/ProjectsPage';
import { MootPage } from './pages/MootPage';
import { ThreadDetailPage } from './pages/ThreadDetailPage';
import { BobsPage } from './pages/BobsPage';

export function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<MootPage />} />
            <Route path="/threads/:threadId" element={<ThreadDetailPage />} />
            <Route path="/bobs" element={<BobsPage />} />
          </Route>
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </ErrorBoundary>
      <Toaster richColors />
    </BrowserRouter>
  );
}
