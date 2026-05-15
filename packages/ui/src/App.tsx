import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppShell } from './components/layout/AppShell';
import { ProjectsPage } from './pages/ProjectsPage';
import { MootPage } from './pages/MootPage';
import { ThreadDetailPage } from './pages/ThreadDetailPage';
import { ReplicantsPage } from './pages/ReplicantsPage';
import { MessagesPage } from './pages/messages/MessagesPage';
import { LoginPage } from './pages/LoginPage';
import { RequireAuth } from './components/layout/RequireAuth';

export function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<ProjectsPage />} />
              <Route path="/projects/:projectId" element={<MootPage />} />
              <Route path="/threads/:threadId" element={<ThreadDetailPage />} />
              <Route path="/replicants" element={<ReplicantsPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/messages/:agentId" element={<MessagesPage />} />
              <Route path="/messages/:agentId/:sessionId" element={<MessagesPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </ErrorBoundary>
      <Toaster richColors />
    </BrowserRouter>
  );
}
