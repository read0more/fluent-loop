import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { TopicCreationPage } from './pages/TopicCreationPage';
import { ListeningPage } from './pages/ListeningPage';
import { RetellingPage } from './pages/RetellingPage';
import { CorrectionPage } from './pages/CorrectionPage';
import { RolePlayPage } from './pages/RolePlayPage';
import { ConversationCorrectionPage } from './pages/ConversationCorrectionPage';
import { SettingsPage } from './pages/SettingsPage';
import './styles.css';

const App: React.FC = () => {
  return (
    <HashRouter>
      {/* Navigation */}
      <nav className="app-nav">
        <Link to="/" className="nav-link">
          단계 1: 토픽 선택
        </Link>
        <Link to="/listening" className="nav-link">
          단계 2: 듣기 연습
        </Link>
        <Link to="/retelling" className="nav-link">
          단계 3: 리텔링
        </Link>
        <Link to="/correction" className="nav-link">
          단계 4: 첨삭
        </Link>
        <Link to="/roleplay" className="nav-link">
          단계 5: AI 롤플레잉
        </Link>
        <Link to="/conversation-correction" className="nav-link">
          단계 6: 대화 첨삭
        </Link>
        <Link to="/settings" className="nav-link">
          설정
        </Link>
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
