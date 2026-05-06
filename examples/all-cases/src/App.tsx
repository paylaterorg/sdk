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
            <span className="brand-mark" aria-hidden>
              P
            </span>
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
