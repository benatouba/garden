import { i18n } from "../../i18n"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

const NotFound: QuartzComponent = ({ cfg, ctx }: QuartzComponentProps) => {
  const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
  const baseDir = ctx.argv.serve ? "/" : url.pathname

  return (
    <article class="popover-hint not-found-page">
      <div class="not-found-overlay">
        <div
          class="not-found-modal"
          role="alertdialog"
          aria-live="assertive"
          data-not-found-modal
          data-home-target={baseDir}
          data-auto-seconds={5}
        >
          <h1>404</h1>
          <p>{i18n(cfg.locale).pages.error.notFound}</p>
          <p>
            Returning to your last note in <strong data-redirect-countdown={5}>5</strong> seconds.
          </p>
          <div class="not-found-actions">
            <button type="button" data-action="go-last-note">
              Go to last note
            </button>
            <a href={baseDir} data-action="go-home">
              {i18n(cfg.locale).pages.error.home}
            </a>
          </div>
        </div>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `
          if (typeof fetchData !== "undefined") {
            fetchData.then(function(index) {
              var basePath = document.body.dataset.basepath || "";
              if (basePath.length > 1 && basePath.endsWith("/")) {
                basePath = basePath.slice(0, -1);
              }
              var pathname = window.location.pathname;
              var hasBasePrefix = basePath.length > 1 && pathname.startsWith(basePath);
              if (hasBasePrefix) {
                pathname = pathname.slice(basePath.length);
              }
              if (pathname.startsWith("/")) {
                pathname = pathname.slice(1);
              }
              if (pathname.endsWith("/")) {
                pathname = pathname.slice(0, -1);
              }
              if (pathname.endsWith(".html")) {
                pathname = pathname.slice(0, -5);
              }
              if (pathname.endsWith("/index")) {
                pathname = pathname.slice(0, -6);
              }
              var lowered = pathname.toLowerCase();
              if (lowered !== pathname && index[lowered] != null) {
                var prefix = hasBasePrefix ? basePath : "";
                var target = prefix + (prefix.endsWith("/") ? "" : "/") + lowered;
                window.location.replace(target);
              }
            });
          }
          `,
        }}
      />
      <style>{`
        .not-found-page {
          min-height: 55vh;
        }

        .not-found-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(17, 17, 27, 0.62);
          backdrop-filter: blur(6px);
          z-index: 9998;
          padding: 1rem;
        }

        .not-found-modal {
          width: min(38rem, 94vw);
          border: 1px solid rgba(166, 173, 200, 0.3);
          border-radius: 14px;
          padding: 1.2rem 1.1rem;
          background: rgba(30, 30, 46, 0.95);
          box-shadow: 0 16px 48px rgba(17, 17, 27, 0.45);
        }

        .not-found-modal h1 {
          margin: 0;
          font-size: 1.9rem;
        }

        .not-found-modal p {
          margin: 0.75rem 0 0;
        }

        .not-found-actions {
          margin-top: 1rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
        }

        .not-found-actions button,
        .not-found-actions a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 2.25rem;
          padding: 0.4rem 0.8rem;
          border-radius: 9px;
          border: 1px solid rgba(166, 173, 200, 0.38);
          text-decoration: none;
          background: rgba(49, 50, 68, 0.8);
          color: var(--darkgray);
        }

        .not-found-actions button:hover,
        .not-found-actions a:hover {
          border-color: rgba(250, 179, 135, 0.62);
          color: var(--secondary);
        }

        .not-found-actions button[disabled] {
          opacity: 0.55;
          cursor: not-allowed;
        }
      `}</style>
    </article>
  )
}

export default (() => NotFound) satisfies QuartzComponentConstructor
