export type TourStepSide = 'top' | 'right' | 'bottom' | 'left' | 'over';
export type TourStepAlign = 'start' | 'center' | 'end';

export interface TourStep {
  id: string;
  element?: string;
  title: string;
  description: string;
  side?: TourStepSide;
  align?: TourStepAlign;
  beforeHighlight?: () => Promise<void> | void;
  disableActiveInteraction?: boolean;
}

export interface TourStartOptions {
  onComplete?: () => void;
  onSkip?: () => void;
  showProgress?: boolean;
}

export interface ActiveTourStep {
  tourId: string;
  step: TourStep;
  index: number;
  total: number;
  targetRect: DOMRect | null;
  showProgress: boolean;
}

export interface TourDefinition {
  id: string;
  label: string;
  route: string;
  roles?: string[];
}
