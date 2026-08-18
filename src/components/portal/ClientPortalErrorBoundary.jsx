import React from "react";

/**
 * ClientPortalErrorBoundary — lightweight route-level error containment.
 * Prevents a client rendering exception from producing a completely blank page.
 */
export default class ClientPortalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("ClientPortal render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center py-20 px-4">
          <div className="max-w-md text-center">
            <h2 className="text-lg font-semibold text-foreground">
              We couldn't load the Client Portal.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Please refresh the page or contact Clinical SOS if the problem persists.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}