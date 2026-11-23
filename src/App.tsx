// app: routes (which page for which address) and provider around everything
// router tools
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
// frame around all pages (header, navigation, full screen messages)
import { Layout } from "./pages/Layout";
// colony page
import { ColonyPage } from "./pages/ColonyPage";
// forge page
import { ForgePage } from "./pages/ForgePage";
// holds colony state
import { ColonyProvider } from "./state/ColonyProvider";
// styles
import "./styles.css";

// route table
const router = createBrowserRouter([
  // main route
  {
    // address /
    path: "/",
    // layout is always shown
    element: <Layout />,
    // pages inside layout
    children: [
      // / = colony page (index = default)
      { index: true, element: <ColonyPage /> },
      // /forge = forge page
      { path: "forge", element: <ForgePage /> },
      // anything else = back to /
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

// app component
export default function App() {
  return (
    // provider outside router, so state stays when player switches between colony and forge
    <ColonyProvider>
      {/* router shows the right page */}
      <RouterProvider router={router} />
    </ColonyProvider>
  );
}
