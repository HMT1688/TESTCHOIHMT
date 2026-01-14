
export interface ProductData {
  name: string;
  specs: string;
  images: string[]; 
}

export interface DetailPageSection {
  title: string;
  prompt: string;
  type: 'hero' | 'usp' | 'specs';
}

export interface DesignPlan {
  sections: DetailPageSection[];
  brandTheme: string;
}

// Added VERIFYING and PLANNING to match usage in UI components
export enum GenerationStage {
  IDLE = 'IDLE',
  THINKING = 'THINKING', 
  VERIFYING = 'VERIFYING',
  PLANNING = 'PLANNING',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface GeneratedSlice {
  url: string;
  title: string;
  copy: string;
  description: string;
  type: 'hero' | 'usp' | 'specs';
}

export interface BrainKnowledge {
  successfulStrategies: string[];
  failedPoints: string[];
  totalProjects: number;
  references: string[]; 
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}
