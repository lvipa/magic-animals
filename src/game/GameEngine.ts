import { animalById, animals, storyAnimals, type AnimalId, type FoxyMood } from '../config/animals';
import { requestedAnimal, type GameEvent, type GameState } from './machine';
import type { ARProvider } from '../ar/ARProvider';
import { NoopTVBridge, type TVBridge } from '../tv/TVBridge';
import type { TransferPlan } from '../tv/protocol';
import { characterActionCue } from '../audio/characterVoices';
export interface SceneState {
  caption: string;
  animal: AnimalId | null;
  reveal: number;
  action: string;
  foxy: FoxyMood;
  effects: boolean;
  finale: boolean;
}
export const initialScene: SceneState = {
  caption: '',
  animal: null,
  reveal: 0,
  action: 'idle',
  foxy: 'idle',
  effects: false,
  finale: false,
};
interface EngineDependencies {
  getState: () => GameState;
  send: (event: GameEvent) => void;
  audio: { say: (cue: string) => void; stop: () => void; duration?: (cue: string) => number };
  show: (scene: SceneState) => void;
  tv?: TVBridge;
}
export class GameEngine {
  private provider: ARProvider | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private scene: SceneState = { ...initialScene };
  private readonly tv: TVBridge;
  private generation = 0;
  private transfer: TransferPlan | null = null;
  private hiddenTransfer: string | null = null;
  private unsubscribeTV: () => void;
  constructor(private deps: EngineDependencies) {
    this.tv = deps.tv ?? new NoopTVBridge();
    this.unsubscribeTV = this.tv.onEvent((event, payload) => {
      const lost =
        event === 'CONNECTION_CHANGED' && (payload as { ready?: boolean })?.ready === false;
      const cancelled =
        event === 'TRANSFER_CANCELLED' &&
        (payload as { transferId?: string })?.transferId === this.transfer?.transferId;
      if ((lost || cancelled) && this.transfer) {
        const hidden = this.hiddenTransfer === this.transfer.transferId;
        this.transfer = null;
        this.hiddenTransfer = null;
        if (hidden && this.deps.getState().endsWith('_PLAY'))
          this.update({ reveal: 1, effects: false, action: 'idle' });
      }
    });
  }
  private say(cue: string) {
    this.deps.audio.say(cue);
    this.tv.sendEvent('AUDIO_CUE', { cue });
  }
  private transferToTV(id: AnimalId) {
    const generation = this.generation;
    if (!this.tv.isReady?.()) return;
    void this.tv.requestTransfer?.(id).then((plan) => {
      if (!plan) return;
      if (generation !== this.generation) {
        this.tv.cancelTransfer?.(plan.transferId);
        return;
      }
      this.transfer = plan;
      this.update({ effects: true, action: 'jump' });
      this.after(Math.max(0, plan.revealAt - (this.tv.serverTime?.() ?? Date.now())), () => {
        if (!this.tv.isReady?.() || this.transfer?.transferId !== plan.transferId) return;
        this.hiddenTransfer = plan.transferId;
        this.update({ reveal: 0, effects: false });
      });
    });
  }
  attachAR(provider: ARProvider | null) {
    this.provider = provider;
    if (provider && this.scene.animal) provider.setAppearance(this.scene.animal, this.scene.reveal);
  }
  private after(ms: number, fn: () => void) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, ms);
    this.timers.add(timer);
  }
  private update(patch: Partial<SceneState>) {
    this.scene = { ...this.scene, ...patch };
    this.deps.show(this.scene);
    this.tv.sendEvent('SCENE_SYNC', {
      state: this.deps.getState(),
      scene: this.scene,
      paused: typeof document !== 'undefined' && document.hidden,
    });
    if (this.scene.animal && !this.scene.finale) {
      this.provider?.setAppearance(this.scene.animal, this.scene.reveal);
      this.provider?.setAction?.(this.scene.animal, this.scene.action);
    }
  }
  cancel() {
    this.generation++;
    const transfer = this.transfer;
    this.transfer = null;
    this.hiddenTransfer = null;
    if (transfer && transfer.revealAt > (this.tv.serverTime?.() ?? Date.now()))
      this.tv.cancelTransfer?.(transfer.transferId);
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.deps.audio.stop();
  }
  pause() {
    this.cancel();
    this.tv.sendEvent('SCENE_SYNC', {
      state: this.deps.getState(),
      scene: this.scene,
      paused: true,
    });
  }
  enter(state: GameState) {
    this.cancel();
    this.tv.sendEvent('SCENE_CHANGE', { state });
    if (state === 'WELCOME') {
      animals.forEach((a) => this.provider?.setAppearance(a.id, 0));
      this.update({ ...initialScene });
    }
    if (state === 'INTRO') {
      this.tv.sendEvent('GAME_STARTED');
      this.update({ ...initialScene, caption: 'Hello!', foxy: 'happy' });
      this.say('hello');
      const greetingGap = Math.max(1500, (this.deps.audio.duration?.('hello') ?? 1) * 1000 + 150);
      this.after(greetingGap, () => {
        this.update({ caption: "Let's find our friends!", foxy: 'lookAround' });
        this.say('intro');
      });
      this.after(
        greetingGap + Math.max(2200, (this.deps.audio.duration?.('intro') ?? 1.7) * 1000 + 200),
        () => this.deps.send({ type: 'INTRO_DONE' }),
      );
    }
    const requested = requestedAnimal(state);
    if (requested) {
      this.provider?.setFocus?.(requested);
      animals.forEach((a) => this.provider?.setAppearance(a.id, 0));
      this.update({
        ...initialScene,
        caption: `Find the ${animalById[requested].word}!`,
        foxy: 'point',
      });
      this.say(`find-${requested}`);
      this.after(25000, () => {
        this.update({ foxy: 'lookAround' });
        this.say(`find-${requested}`);
      });
      // A real target may already be visible during the spoken intro.
      const tracking = this.provider?.getTracking();
      if (tracking?.visible && tracking.target === requested) this.targetFound(requested);
    }
    if (state.endsWith('_FOUND')) {
      const id = state.split('_')[0].toLowerCase() as AnimalId,
        content = animalById[id];
      this.tv.sendEvent('ANIMAL_FOUND', { id });
      this.update({
        animal: id,
        reveal: 0,
        caption: '✨',
        action: 'idle',
        effects: false,
        foxy: 'surprised',
      });
      content.appearanceSequence.forEach((beat) =>
        this.after(beat.at, () => {
          this.update({
            ...(beat.reveal !== undefined ? { reveal: beat.reveal } : {}),
            ...(beat.foxy ? { foxy: beat.foxy } : {}),
            ...(beat.effects ? { effects: true } : {}),
          });
          if (beat.cue) {
            this.say(beat.cue);
            if (beat.cue === content.sounds.word) this.update({ caption: content.word + '!' });
          }
        }),
      );
      this.after(content.appearanceDuration, () => this.deps.send({ type: 'APPEAR_DONE' }));
    }
    if (state.endsWith('_PLAY') && state !== 'FREE_PLAY') {
      const id = state.split('_')[0].toLowerCase() as AnimalId,
        content = animalById[id];
      this.update({
        animal: id,
        reveal: 1,
        effects: false,
        action: content.playAction ?? 'happy',
        foxy: 'happy',
      });
      content.playSequence?.forEach((beat) =>
        this.after(beat.at, () =>
          this.update({
            ...(beat.foxy ? { foxy: beat.foxy } : {}),
            ...(beat.action ? { action: beat.action } : {}),
          }),
        ),
      );
      this.after(4000, () => this.transferToTV(id));
      this.after(5500, () => this.deps.send({ type: 'PLAY_DONE' }));
    }
    if (state === 'FINALE') {
      animals.forEach((a) => this.provider?.setAppearance(a.id, 0));
      this.tv.sendEvent('FINALE');
      this.tv.sendEvent('CELEBRATION');
      this.update({
        finale: true,
        effects: true,
        caption: 'Our friends are here!',
        foxy: 'idle',
        action: 'idle',
      });
      this.say('friends');
      this.after(2500, () => this.update({ foxy: 'dance', action: 'dance' }));
      storyAnimals.forEach((content, index) => {
        this.after(4000 + index * 3100, () => {
          this.update({ caption: content.word + '!' });
          this.say(content.sounds.word);
        });
        this.after(5200 + index * 3100, () => this.say(content.sounds.call));
      });
      this.after(14600, () => {
        this.update({ caption: 'Great!', foxy: 'happy' });
        this.say('great');
      });
      this.after(17500, () => this.deps.send({ type: 'FINALE_DONE' }));
    }
    if (state === 'COMPLETE')
      this.update({ caption: 'Friends forever!', effects: false, finale: true, foxy: 'happy' });
    if (state === 'FREE_PLAY') {
      this.provider?.setFocus?.(null);
      animals.forEach((a) => this.provider?.setAppearance(a.id, 0));
      this.update({ ...initialScene, caption: 'Show any friend!', foxy: 'lookAround' });
      const tracked = this.provider?.getTracking();
      if (tracked?.visible && tracked.target) this.targetFound(tracked.target);
    }
  }
  targetFound(id: AnimalId) {
    const state = this.deps.getState();
    if (requestedAnimal(state) === id) this.deps.send({ type: 'TARGET_FOUND', id });
    else if (state === 'FREE_PLAY') {
      this.cancel();
      animals.forEach((a) => {
        if (a.id !== id) this.provider?.setAppearance(a.id, 0);
      });
      this.deps.send({ type: 'TARGET_FOUND', id });
      this.update({
        animal: id,
        reveal: 1,
        caption: animalById[id].word + '!',
        effects: true,
        finale: false,
        foxy: 'happy',
      });
      this.update({ action: 'wave' });
      this.say(animalById[id].sounds.word);
      this.after(1300, () => this.say(animalById[id].sounds.call));
      this.after(2500, () => this.update({ effects: false }));
      this.after(3000, () => this.update({ action: 'idle' }));
    }
  }
  interact(id: AnimalId) {
    if (this.scene.reveal < 1 || this.scene.animal !== id) return;
    const choices = animalById[id].interactions,
      action = choices[Math.floor(Math.random() * choices.length)];
    this.update({ action, foxy: 'laugh' });
    this.say(characterActionCue(id, action));
    this.after(2300, () => this.update({ action: 'idle', foxy: 'happy' }));
  }
  dispose() {
    this.pause();
    this.provider = null;
    this.unsubscribeTV();
    if (!this.deps.tv) this.tv.disconnect();
  }
}
