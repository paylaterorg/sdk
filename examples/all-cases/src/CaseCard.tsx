import { type Case } from "./cases";

/**
 * @title CaseCard
 * @description Renders one SDK configuration scenario: a numbered title,
 * a short description, the literal source the partner would write, and the
 * live widget that source produces. The two halves stack on small viewports
 * and sit side-by-side on larger ones.
 */
export function CaseCard({ index, caseDef }: { index: number; caseDef: Case }) {
  const { id, title, description, code, Demo } = caseDef;

  return (
    <section className="case" id={id}>
      <header className="case-header">
        <h2>
          <span className="case-index">#{index}</span>
          {title}
        </h2>
        <p className="case-description">{description}</p>
      </header>
      <div className="case-grid">
        <div className="case-code">
          <div className="case-code-bar">
            <span>code</span>
          </div>
          <pre>
            <code>{code.trim()}</code>
          </pre>
        </div>
        <div className="case-demo">
          <div className="case-demo-bar">
            <span>live</span>
          </div>
          <div className="case-demo-canvas">
            <Demo />
          </div>
        </div>
      </div>
    </section>
  );
}
