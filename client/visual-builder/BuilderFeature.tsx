import React, { Suspense, type ReactNode } from "react";
import { recordBuilderError } from "./diagnostics";
import type { BuilderTheme } from "./shell";

type Props = {
  name: string;
  children: ReactNode;
  onBack: () => void;
  theme?: BuilderTheme;
  compact?: boolean;
};

function LoadingView({
  name,
  onBack,
  theme,
  compact,
  failed = false,
}: Omit<Props, "children"> & { failed?: boolean }) {
  return (
    <div
      className={
        compact ? "builder-page-body" : "builder-app builder-feature-loading"
      }
      data-theme={theme}
    >
      <div className="builder-card">
        <div role={failed ? "alert" : "status"}>
          <h2>
            {failed ? `Could not open the ${name}` : `Opening the ${name}…`}
          </h2>
          {failed && <p>Check your connection, then reload to try again.</p>}
        </div>
        <div className="builder-row">
          <button onClick={onBack}>Back to pages</button>
          {failed && (
            <button
              className="builder-primary"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** An unavailable feature download leaves a way back to the saved workspace. */
export default class BuilderFeature extends React.Component<
  Props,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    recordBuilderError(error);
  }

  render() {
    const { children, ...props } = this.props;
    return this.state.failed ? (
      <LoadingView {...props} failed />
    ) : (
      <Suspense fallback={<LoadingView {...props} />}>{children}</Suspense>
    );
  }
}
