import React from "react";

const OriginalGiantStyles = React.lazy(() => import("./OriginalGiantStyles"));
const EUIStyles = React.lazy(() => import("./EUIStyles"));

// This is a trick to conditionally load CSS at runtime without ejecting from Create React App
// https://stackoverflow.com/questions/46835825/conditional-css-in-create-react-app
export function StylesheetLoader({
  eui,
  children,
}: {
  eui: boolean;
  children: React.ReactElement[];
}) {
  return (
    <React.Fragment>
      <React.Suspense fallback={<div>Loading...</div>}>
        {eui && <EUIStyles />}
        {!eui && <OriginalGiantStyles />}
        {children}
      </React.Suspense>
    </React.Fragment>
  );
}
