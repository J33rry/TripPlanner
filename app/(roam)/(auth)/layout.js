import { Suspense } from "react";
import AuthScreen from "@/components/AuthScreen";

/**
 * Shared by every auth route so the card persists between them and can slide
 * from one side to the other as the globe swaps places. Pages only set metadata.
 */
export default function AuthLayout({ children }) {
  return (
    <>
      <Suspense fallback={null}>
        <AuthScreen />
      </Suspense>
      {children}
    </>
  );
}
