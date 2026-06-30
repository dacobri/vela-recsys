import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

import {
  Header,
  Footer,
  SideBar,
  VideoModal,
  ScrollToTop,
  Loader,
} from "@/common";

import "react-loading-skeleton/dist/skeleton.css";
import "swiper/css";

// Template pages
const Catalog = lazy(() => import("./pages/Catalog"));
const Home = lazy(() => import("./pages/Home"));
const Detail = lazy(() => import("./pages/Detail"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Vela consumer pages
const Welcome = lazy(() => import("./pages/Welcome"));
const Browse = lazy(() => import("./pages/Browse"));
const MovieDetail = lazy(() => import("./pages/MovieDetail"));

// Vela Lab pages
const Recommend = lazy(() => import("./pages/Recommend"));
const Arena = lazy(() => import("./pages/Arena"));
const Evaluation = lazy(() => import("./pages/Evaluation"));
const TasteDNA = lazy(() => import("./pages/TasteDNA"));
const Galaxy = lazy(() => import("./pages/Galaxy"));
const Chat = lazy(() => import("./pages/Chat"));

const App = () => {
  return (
    <>
      <VideoModal />
      <SideBar />
      <Header />
      <main className="lg:pb-14 md:pb-4 sm:pb-2 xs:pb-1 pb-0">
        <ScrollToTop>
          <Suspense fallback={<Loader />}>
            <Routes>
              <Route path="/" element={<Home />} />

              {/* Consumer layer — onboarding, browse + Vela-backed movie detail.
                  MUST come before the greedy /:category/:id below. */}
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/browse" element={<Browse />} />
              <Route path="/movie/:id" element={<MovieDetail />} />

              {/* Lab static routes — also before the greedy /:category */}
              <Route path="/recommend" element={<Recommend />} />
              <Route path="/arena" element={<Arena />} />
              <Route path="/evaluation" element={<Evaluation />} />
              <Route path="/taste-dna" element={<TasteDNA />} />
              <Route path="/galaxy" element={<Galaxy />} />
              <Route path="/chat" element={<Chat />} />

              {/* TMDB browse (movie catalog grid + tv detail) */}
              <Route path="/:category/:id" element={<Detail />} />
              <Route path="/:category" element={<Catalog />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ScrollToTop>
      </main>

      <Footer />
    </>
  );
};

export default App;
