import { useState } from "react";
import { useNavigate } from "react-router-dom";

import MDBox from "components/MDBox";
import PageLayout from "examples/LayoutContainers/PageLayout";
import api from "services/api.service";

const pafLogo = `${process.env.PUBLIC_URL || ""}/login_page/assets/img/PAF-Logo.gif`;

import "./styles.css";

function A1Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("alpha");
  const [password, setPassword] = useState("alpha");
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const u = String(username || "").trim();
    const p = String(password || "");

    if (!u || !p) {
      setAuthError("Username and password are required");
      return;
    }

    setIsSubmitting(true);
    setAuthError("");
    try {
      // Send both camelCase and PascalCase to be resilient to backend DTO naming
      const res = await api.login({ username: u, password: p, Username: u, Password: p });

      // Store token if backend returns it
      const token =
        res?.token || res?.Token || res?.accessToken || res?.AccessToken || res?.jwt || res?.Jwt;
      if (token) {
        try {
          localStorage.setItem("token", token);
        } catch (storageErr) {
          // ignore
        }
      }

      // Optional: store full auth response for later use
      try {
        localStorage.setItem("auth", JSON.stringify(res || {}));
      } catch (storageErr) {
        // ignore
      }

      navigate("/dashboard");
    } catch (err) {
      setAuthError(err?.message ? String(err.message) : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout background="transparent">
      <MDBox className="a1-login">
        {/* Background slider */}
        <div className="slider">
          <div className="slide"></div>
          <div className="slide"></div>
          <div className="slide"></div>
          <div className="slide"></div>
          <div className="bg-overlay"></div>
        </div>

        <div className="page">
          {/* LEFT SIDE - Login Card */}
          <div className="left-side">
            <div className="login-card">
              <div className="brand">
                <img className="logo-symb" src={pafLogo} alt="PAF Logo" />
                <div className="brand-text">
                  <h2>A1 LMS</h2>
                  <small>Land Mgmt System</small>
                </div>
              </div>

              <div className="welcome-section">
                <h3></h3>
                <p>Audit & Accounts Sub Branch</p>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="field-group">
                  <label>User Name</label>
                  <input
                    type="text"
                    className="input-underline"
                    placeholder="Enter User Name"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                </div>

                <div className="field-group">
                  <label>Password</label>
                  <input
                    type="password"
                    className="input-underline"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>

                {authError ? <div className="auth-error">{authError}</div> : null}

                <button type="submit" className="btn-signin" disabled={isSubmitting}>
                  {isSubmitting ? "Signing In..." : "Sign In"}
                  <i
                    className="fa-solid fa-arrow-right-long"
                    style={{ transform: "rotate(-45deg)" }}
                  ></i>
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT SIDE - Hex Grid */}
          <div className="right-side">
            <div className="hex-grid">
              <div className="hex-col c1">
                <div className="hex-box">
                  <i className="fa-solid fa-map"></i>
                  <span>Plots</span>
                </div>
              </div>

              <div className="hex-col c2">
                <div className="hex-box">
                  <i className="fa-solid fa-gas-pump"></i>
                  <span>Petrol Station</span>
                </div>
                <div className="hex-box">
                  <i className="fa-solid fa-building"></i>
                  <span>Towers</span>
                </div>
              </div>

              <div className="hex-col c3">
                <div className="hex-box">
                  <i className="fa-solid fa-rectangle-ad"></i>
                  <span>Billboards</span>
                </div>
                <div className="hex-box">
                  <i className="fa-solid fa-store"></i>
                  <span>Shopping Malls</span>
                </div>
                <div className="hex-box">
                  <i className="fa-solid fa-tractor"></i>
                  <span>Agri Lands</span>
                </div>
              </div>

              <div className="hex-col c4">
                <div className="hex-box blank"></div>
                <div className="hex-box blank"></div>
                <div className="hex-box blank"></div>
                <div className="hex-box blank"></div>
              </div>
            </div>
          </div>
        </div>
      </MDBox>
    </PageLayout>
  );
}

export default A1Login;
