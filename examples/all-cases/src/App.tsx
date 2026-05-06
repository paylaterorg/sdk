import { useEffect, useState } from "react";
import { CaseCard } from "./CaseCard";
import { CASES } from "./cases";

type Theme = "light" | "dark";

function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  if (document.documentElement.classList.contains("dark")) return "dark";
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function applyTheme(theme: Theme) {
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

/**
 * @title App
 * @description Top-level layout for the all-cases showcase. A sticky brand
 * header with a host-page theme toggle sits above a sticky case-index strip,
 * which lets visitors jump directly to any scenario. Each scenario then
 * renders as a `CaseCard` in a single column below.
 */
export function App() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = readInitialTheme();
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  const setAndApply = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header-inner">
          <div className="brand">
            <svg className="brand-mark" viewBox="0 0 1024 1024" width="32" height="32" aria-hidden>
              <rect width="1024" height="1024" fill="oklch(0.876 0.166 131)" />
              <path
                d="M369 274H655V416.8L559.667 512L655 607.2V750H369V607.2L464.333 512L369 416.8V274ZM607.333 619.1L512 523.9L416.667 619.1V702.4H607.333V619.1ZM512 500.1L607.333 404.9V321.6H416.667V404.9L512 500.1ZM464.333 369.2H559.667V387.05L512 434.65L464.333 387.05V369.2Z"
                fill="oklch(0.18 0.04 131)"
              />
            </svg>
            <div>
              <h1>@paylater/sdk · all cases</h1>
              <p className="page-subtitle">
                Every SDK configuration, side-by-side with the code that produced it.
              </p>
            </div>
          </div>
          <div className="theme-toggle" role="radiogroup" aria-label="Theme">
            <button
              type="button"
              role="radio"
              aria-checked={mounted && theme === "light"}
              className={`theme-toggle-btn${mounted && theme === "light" ? " active" : ""}`}
              onClick={() => setAndApply("light")}
            >
              ☀︎ Light
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mounted && theme === "dark"}
              className={`theme-toggle-btn${mounted && theme === "dark" ? " active" : ""}`}
              onClick={() => setAndApply("dark")}
            >
              ☾ Dark
            </button>
          </div>
        </div>
        <nav className="case-toc" aria-label="Cases">
          <div className="case-toc-inner">
            {CASES.map((c, i) => (
              <a key={c.id} href={`#${c.id}`} className="case-toc-pill">
                <span className="case-toc-num">{i + 1}</span>
                {c.title.replace(/\s*\(`[^`]+`\)/, "")}
              </a>
            ))}
          </div>
        </nav>
      </header>

      <main className="cases">
        {CASES.map((c, i) => (
          <CaseCard key={c.id} index={i + 1} caseDef={c} />
        ))}
      </main>

      <footer className="page-footer">
        <p>
          Built with <code>@paylater/sdk</code>. See the{" "}
          <a href="https://github.com/paylaterorg/sdk" target="_blank" rel="noreferrer noopener">
            repo
          </a>{" "}
          for the full type surface and CSS tokens.
        </p>
      </footer>
    </div>
  );
}
