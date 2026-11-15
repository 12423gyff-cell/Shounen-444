import { useEffect, useRef, useState } from 'react';
import { HudOverlay } from './components/HudOverlay';
import { Modals } from './components/Modals';
import { TitleScreen } from './components/TitleScreen';
import { GameEngine } from './game/engine';
import { HudSnapshot } from './game/types';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [snap, setSnap] = useState<HudSnapshot | null>(null);
  const [secondaryModal, setSecondaryModal] = useState<
    'sectors' | 'scores' | 'settings' | 'help' | 'profile' | 'credits' | null
  >(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new GameEngine(canvas, (nextSnap) => {
      setSnap(nextSnap);
    });
    engineRef.current = engine;

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startNewRun('story');
    }

    (window as unknown as { __SHIFT_ENGINE__?: GameEngine }).__SHIFT_ENGINE__ = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#020506] text-[#e3eae5]">
      {/* Isolated 60fps Canvas Layer */}
      <div className="fixed inset-0 z-0">
        <canvas id="gameCanvas" ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Title Screen Shell */}
      {snap && snap.screen === 'title' && (
        <TitleScreen
          snap={snap}
          onStartStory={() => {
            setSecondaryModal(null);
            engineRef.current?.startNewRun('story');
          }}
          onStartEndless={() => {
            setSecondaryModal(null);
            engineRef.current?.startNewRun('endless');
          }}
          onContinue={() => {
            setSecondaryModal(null);
            engineRef.current?.continueSavedRun();
          }}
          onOpenModal={(m) => setSecondaryModal(m)}
          onToggleLang={() =>
            engineRef.current?.updateConfig({ lang: snap.lang === 'en' ? 'ar' : 'en' })
          }
        />
      )}

      {/* Active HUD Layer */}
      {snap && snap.screen !== 'title' && <HudOverlay snap={snap} engineRef={engineRef} />}

      {/* Modals & Overlays */}
      {snap && (
        <Modals
          snap={snap}
          engineRef={engineRef}
          secondaryModal={secondaryModal}
          onCloseSecondary={() => setSecondaryModal(null)}
        />
      )}
    </div>
  );
}
