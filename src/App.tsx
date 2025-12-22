import React from 'react';
import Mint from './pages/Mint'; // Import the Mint component
import './index.css'; // CRITICAL: Import CSS here
import HamburgerMenu from './components/HamburgerMenu';

const App: React.FC = () => {
  return (
    <div className="App">
      <HamburgerMenu />
      <Mint />
    </div>
  );
};

export default App;
