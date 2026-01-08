import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import Icon from "@mui/material/Icon";

import MDBox from "components/MDBox";
import PageLayout from "examples/LayoutContainers/PageLayout";

import pafLogo from "../../../examples/login_page/assets/img/PAF-Logo.gif";
import bgOne from "../../../examples/login_page/assets/img/one.webp";
import bgTwo from "../../../examples/login_page/assets/img/two.jpg";
import bgThree from "../../../examples/login_page/assets/img/three.webp";

import "./styles.css";

function A1Login() {
  const navigate = useNavigate();

  const slides = useMemo(
    () => [
      {
        img: bgOne,
        title: "PAF Land <br> Management",
        text: "Centralized management of land assets, contracts, tenants, and revenue.",
      },
      {
        img: bgTwo,
        title: "Digital Control<br> of Land Assets",
        text: "Structured management of contracts, tenants, rentals, and government share",
      },
      {
        img: bgThree,
        title: "Sustainable<br>Land Planning",
        text: "Support growth while protecting natural resources",
      },
    ],
    []
  );

  const [username, setUsername] = useState("superuser");
  const [password, setPassword] = useState("pakistan@123");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");

  const [bottomImg, setBottomImg] = useState(slides[0].img);
  const [topImg, setTopImg] = useState(slides[0].img);
  const [topVisible, setTopVisible] = useState(false);
  const [titleHtml, setTitleHtml] = useState(slides[0].title);
  const [text, setText] = useState(slides[0].text);

  const slideIndexRef = useRef(0);
  const fadeTimeoutRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => {
      const nextIndex = slideIndexRef.current % slides.length;
      const slide = slides[nextIndex];

      setTopImg(slide.img);
      setTopVisible(true);
      setTitleHtml(slide.title);
      setText(slide.text);

      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = setTimeout(() => {
        setBottomImg(slide.img);
        setTopVisible(false);
      }, 1200);

      slideIndexRef.current = (nextIndex + 1) % slides.length;
    }, 4000);

    return () => {
      clearInterval(id);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, [slides]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const u = String(username || "").trim();
    const p = String(password || "");

    if (u === "superuser" && p === "pakistan@123") {
      setAuthError("");
      navigate("/dashboard");
      return;
    }

    setAuthError("Invalid username or password");
  };

  return (
    <PageLayout background="transparent">
      <MDBox className="a1-login">
        {/* Background layers */}
        <div className="bg bottom" style={{ backgroundImage: `url(${bottomImg})` }} />
        <div
          className="bg top"
          style={{ backgroundImage: `url(${topImg})`, opacity: topVisible ? 0.5 : 0 }}
        />

        <div className="login-wrapper">
          {/* LEFT */}
          <div className="login-left">
            <div className="left-content">
              <div className="brand">
                <img src={pafLogo} alt="Pakistan Air Force" />
                <span>
                  <span>Pakistan Air Force</span>
                  <h3>A1 Land Management System</h3>
                </span>
              </div>

              <div className="sep-l" />

              <div className="carousel-contnet">
                <h1 id="bgTitle" dangerouslySetInnerHTML={{ __html: titleHtml }} />
                <p id="bgText">{text}</p>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="login-right">
            <h2>A1 Land Management System</h2>
            <p>Access your Land Management Dashboard</p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>User Name</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter User Name"
                  autoComplete="username"
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="password-field">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    <Icon sx={{ fontSize: 18 }}>
                      {showPassword ? "visibility_off" : "visibility"}
                    </Icon>
                  </button>
                </div>
              </div>

              {authError ? <div className="auth-error">{authError}</div> : null}

              <button type="submit" className="btn-login">
                Sign In
                <Icon sx={{ fontSize: 18 }}>north_east</Icon>
              </button>
            </form>
          </div>
        </div>
      </MDBox>
    </PageLayout>
  );
}

export default A1Login;
