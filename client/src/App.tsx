import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Landing from "./pages/Landing";
import Register from "./pages/Register";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}

export default App;
