import { Route, Routes } from 'react-router-dom';
import Game from '../game/Game';
import Parent from '../parent/Parent';
import { ParentAccess } from '../parent/ParentAccess';
import { CameraTest, MarkerTest } from '../parent/Diagnostics';
import { Install, Offline } from '../pwa/Pages';
import CharacterGallery from '../parent/CharacterGallery';
import TVPage from '../tv/TVPage';
import TVPairing from '../tv/TVPairing';
import AudioStudio from '../parent/AudioStudio';
import Worlds from '../play/Worlds';
import { lazy, Suspense } from 'react';
const SingPage = lazy(() => import('../singing/SingPage'));
const CatReview = import.meta.env.DEV ? lazy(() => import('../parent/CatReview')) : null;
const CatImportReview = import.meta.env.DEV
  ? lazy(() => import('../parent/CatImportReview'))
  : null;
export default function App() {
  return (
    <Routes>
      <Route
        path="/sing"
        element={
          <Suspense fallback={<p>Готовим сцену Milo…</p>}>
            <SingPage />
          </Suspense>
        }
      />
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
      <Route path="/" element={<Game key="home" />} />
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
  );
}
