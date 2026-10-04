import { Route, Routes } from 'react-router-dom';
import { ParentAccess } from '../parent/ParentAccess';
import { lazy, Suspense } from 'react';
import { KidNav } from '../play/KidNav';
import { musicSite } from './site';
const Game = lazy(() => import('../game/Game'));
const Parent = lazy(() => import('../parent/Parent'));
const CharacterGallery = lazy(() => import('../parent/CharacterGallery'));
const TVPage = lazy(() => import('../tv/TVPage'));
const TVPairing = lazy(() => import('../tv/TVPairing'));
const AudioStudio = lazy(() => import('../parent/AudioStudio'));
const Worlds = lazy(() => import('../play/Worlds'));
const CameraTest = lazy(() =>
  import('../parent/Diagnostics').then((m) => ({ default: m.CameraTest })),
);
const MarkerTest = lazy(() =>
  import('../parent/Diagnostics').then((m) => ({ default: m.MarkerTest })),
);
const Install = lazy(() => import('../pwa/Pages').then((m) => ({ default: m.Install })));
const Offline = lazy(() => import('../pwa/Pages').then((m) => ({ default: m.Offline })));
const SingPage = lazy(() => import('../singing/SingPage'));
const CatReview = import.meta.env.DEV ? lazy(() => import('../parent/CatReview')) : null;
const CatImportReview = import.meta.env.DEV
  ? lazy(() => import('../parent/CatImportReview'))
  : null;
export default function App() {
  return (
    <Suspense
      fallback={
        <main className="page-opening" role="status">
          <span>✨</span>
          <p>Открываем игру…</p>
          <KidNav opening />
        </main>
      }
    >
      <Routes>
        <Route path="/sing" element={<SingPage />} />
        {CatReview && (
          <Route
            path="/__cat-review"
            element={
              <Suspense fallback={<p>Loading review…</p>}>
                <CatReview />
              </Suspense>
            }
          />
        )}
        {CatImportReview && (
          <Route
            path="/__cat-import-review"
            element={
              <Suspense fallback={<p>Loading review…</p>}>
                <CatImportReview />
              </Suspense>
            }
          />
        )}
        <Route path="/tv" element={<TVPage />} />
        <Route path="/connect-tv" element={<TVPairing />} />
        <Route path="/friends" element={<CharacterGallery playground />} />
        <Route path="/hunt" element={<Game key="hunt" hunt />} />
        <Route path="/worlds" element={<Worlds />} />
        <Route
          path="/parent/audio"
          element={
            <ParentAccess>
              <AudioStudio />
            </ParentAccess>
          }
        />
        <Route
          path="/parent/tv"
          element={
            <ParentAccess>
              <TVPairing />
            </ParentAccess>
          }
        />
        <Route path="/" element={musicSite ? <SingPage /> : <Game key="home" />} />
        <Route
          path="/parent"
          element={
            <ParentAccess>
              <Parent />
            </ParentAccess>
          }
        />
        <Route
          path="/characters"
          element={
            <ParentAccess>
              <CharacterGallery />
            </ParentAccess>
          }
        />
        <Route
          path="/marker-test"
          element={
            <ParentAccess>
              <MarkerTest />
            </ParentAccess>
          }
        />
        <Route
          path="/camera-test"
          element={
            <ParentAccess>
              <CameraTest />
            </ParentAccess>
          }
        />
        <Route path="/install" element={<Install />} />
        <Route path="/offline-status" element={<Offline />} />
        <Route path="*" element={<Game />} />
      </Routes>
    </Suspense>
  );
}
