// FILE LOCATION: frontend/src/App.jsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Cameras from './pages/Cameras';
import ChatRAG from './pages/ChatRAG';
import Events from './pages/Events'; //Changed on 30-10-2025
import EventDetail from './pages/Events/EventDetail';
import EventSearch from './pages/Events/EventSearch';
import Anomalies from './pages/Anomalies/index'; //Changed on 05-11-2025
import AnomalyNotification from './components/AnomalyNotification';
import PersonTracking from './pages/PersonTracking'; //Changed on 13-11-2025
import PersonCard from './pages/PersonTracking/components/PersonCard'; //Changed on 13-11-2025
import RegisterPersonModal from './pages/PersonTracking/components/RegisterPersonModal'; //Changed on 13-11-2025

function App() {
  return (
    <Router>
      <DashboardLayout>
        <AnomalyNotification />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cameras" element={<Cameras />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/search" element={<EventSearch />} />
          <Route path="/events/:eventId" element={<EventDetail />} />
          <Route path="/anomalies" element={<Anomalies />} />
          <Route path="/chat" element={<ChatRAG />} />
          <Route path="/person-tracking" element={<PersonTracking />} />
          <Route path="/person-tracking/:personId" element={<PersonCard />} />
          <Route path="/person-tracking/register" element={<RegisterPersonModal />} />
        </Routes>
      </DashboardLayout>
    </Router>
  );
}

export default App;