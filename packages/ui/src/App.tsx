import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppLayout } from './components/layout/AppLayout';
import { MessagesLayout } from './components/layout/MessagesLayout';
import { ProjectsPage } from './pages/ProjectsPage';
import { MootPage } from './pages/MootPage';
import { ThreadDetailPage } from './pages/ThreadDetailPage';
import { BobsPage } from './pages/BobsPage';
import { AgentsListPanel } from './pages/messages/AgentsListPanel';
import { SessionsListPanel } from './pages/messages/SessionsListPanel';

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
          <Route element={<MessagesLayout />}>
            <Route path="/messages" element={<AgentsListPanel />} />
            <Route path="/messages/:agentId" element={<SessionsListPanel />} />
            <Route path="/messages/:agentId/:sessionId" element={<SessionsListPanel />} />
          </Route>
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </ErrorBoundary>
      <Toaster richColors />
    </BrowserRouter>
  );
}
