declare module 'mind-ar/dist/mindar-image-three.prod.js' {
  export class MindARThree {
    constructor(options: Record<string, unknown>);
  }
}
declare module 'mind-ar/dist/mindar-image.prod.js' {
  export class Controller {
    constructor(options: {
      inputWidth: number;
      inputHeight: number;
      maxTrack?: number;
      warmupTolerance?: number;
      missTolerance?: number;
      onUpdate: (data: {
        type: string;
        targetIndex?: number;
        worldMatrix?: number[] | null;
      }) => void;
    });
    worker: Worker;
    addImageTargetsFromBuffer(buffer: ArrayBuffer): { dimensions: [number, number][] };
    interestedTargetIndex: number;
    trackingStates: {
      isTracking: boolean;
      showing: boolean;
      trackCount: number;
      trackMiss: number;
      trackingMatrix: number[] | null;
    }[];
    processingVideo: boolean;
    getProjectionMatrix(): number[];
    dummyRun(input: HTMLVideoElement | HTMLCanvasElement): void;
    processVideo(input: HTMLVideoElement | HTMLCanvasElement): void;
    stopProcessVideo(): void;
    dispose(): void;
  }
}
