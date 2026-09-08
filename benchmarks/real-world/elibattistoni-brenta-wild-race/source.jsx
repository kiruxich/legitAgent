import ErrorPage from "./pages/ErrorPage";
import { paths } from "./utils/paths";
import Loading from "./components/shared/Loading";
import PrivacyBanner from "./components/layout/PrivacyBanner";

const HomePage = lazy(() => import("./pages/HomePage"));
const TrailPathVariantsPage = lazy(() =>
