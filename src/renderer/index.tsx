import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import { TopicCreationPage } from './pages/TopicCreationPage';
import { ListeningPage } from './pages/ListeningPage';
import { RetellingPage } from './pages/RetellingPage';
import { CorrectionPage } from './pages/CorrectionPage';
import { RolePlayPage } from './pages/RolePlayPage';
import { ConversationCorrectionPage } from './pages/ConversationCorrectionPage';
import { SettingsPage } from './pages/SettingsPage';
import { AppStartupLoader } from './components/AppStartupLoader';
import './styles/global.scss';

const steps = [
  { path: '/', label: '단계 1: 토픽 선택', step: 1 },
  { path: '/listening', label: '단계 2: 듣기 연습', step: 2 },
  { path: '/retelling', label: '단계 3: 리텔링', step: 3 },
  { path: '/correction', label: '단계 4: 리텔링 첨삭', step: 4 },
  { path: '/roleplay', label: '단계 5: AI 롤플레잉', step: 5 },
  { path: '/conversation-correction', label: '단계 6: 대화 첨삭', step: 6 },
];

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);

  if (!isReady) {
    return <AppStartupLoader onReady={() => setIsReady(true)} />;
  }

  return (
    <HashRouter>
      {/* Navigation */}
      <nav className="app-nav">
        {steps.map(({ path, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            {label}
          </NavLink>
        ))}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `nav-link nav-settings ${isActive ? 'active' : ''}`
          }
          title="설정"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </NavLink>
      </nav>

      {/* Routes */}
      <Routes>
        <Route path="/" element={<TopicCreationPage />} />
        <Route path="/listening" element={<ListeningPage />} />
        <Route path="/retelling" element={<RetellingPage />} />
        <Route path="/correction" element={<CorrectionPage />} />
        <Route path="/roleplay" element={<RolePlayPage />} />
        <Route path="/conversation-correction" element={<ConversationCorrectionPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </HashRouter>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
