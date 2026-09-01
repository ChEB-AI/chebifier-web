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
  <div className="navbar-right">
    <span className="citation">
      If you like Chebifier, please cite: Glauer, Martin, et al. "Chebifier: Automating Semantic
      Classification in ChEBI to Accelerate Data-driven Discovery."{" "}
      <a href="https://pubs.rsc.org/en/content/articlehtml/2024/dd/d3dd00238a">Digital Discovery, 2024, 3, 896</a>.
    </span>
  </div>
</nav>
      <Outlet />
</>
);
};

export default Navbar;