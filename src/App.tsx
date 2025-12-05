import React from 'react';
import Mint from './pages/Mint'; // Import the Mint component
import './index.css'; // CRITICAL: Import CSS here

const App: React.FC = () => {
  return (
    <div className="App">
      <Mint />
    </div>
  );
};

export default App;