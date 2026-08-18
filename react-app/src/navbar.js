import React from "react";
import "./Navbar.css";
import { Outlet, Link } from "react-router-dom";


const Navbar = () => {
  return (
<>
<nav className="navbar">
  <div className="navbar-left">
    <a href="/" className="logo">
      Chebifier
    </a>
  </div>
  <div className="navbar-center">
    <ul className="nav-links">
      <li>
        <Link to="/">Classify</Link>
      </li>
      <li>
        <Link to="/about">About</Link>
      </li>
      <li>
        <a href="https://github.com/ChEB-AI/chebifier-web/issues">Report an Issue</a>
      </li>
    </ul>
  </div>
</nav>
      <Outlet />
</>
);
};

export default Navbar;