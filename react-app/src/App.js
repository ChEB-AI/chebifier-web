import './App.css';
import Navbar from './navbar.js';
import '../node_modules/vis-network/styles/vis-network.css';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Pages from './Pages';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="*" element={<Pages />}>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
