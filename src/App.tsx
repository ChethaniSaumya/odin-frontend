import React from 'react';
import Mint from './pages/Mint'; // Import the Mint component
import './index.css'; // CRITICAL: Import CSS here
import HamburgerMenu from './components/HamburgerMenu';
import { HelmetProvider } from 'react-helmet-async';

const App: React.FC = () => {
  return (
    
    <HelmetProvider> {/* Wrap the ENTIRE app here */}
      <div className="App">
        <HamburgerMenu />
        <Mint />
      </div>
    </HelmetProvider> 
  );
};

export default App;
