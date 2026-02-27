
export enum TourType {
  DOMESTIC = 'DOMESTIC',
  INTERNATIONAL = 'INTERNATIONAL'
}

export enum InputMethod {
  AUTO = 'AUTO',
  TEXT = 'TEXT',
  FILE = 'FILE'
}

export type ImagePosition = 'left' | 'right' | 'bottom';

export interface TimelineItem {
  activity: string;
}

export interface Meals {
  breakfast: string;
  lunch: string;
  dinner: string;
}

export interface DayPlan {
  day: number;
  title: string;
  description: string;
  timeline: TimelineItem[];
  meals: Meals;
  accommodation: string;
  imageUrl: string; // Used as seed/keyword
  imagePosition: ImagePosition;
  imageCount: number;
  customImages?: string[]; // Array of Base64 strings for uploaded images
}

export interface TourPlan {
  mainTitle: string;
  marketingSubtitle: string;
  departureInfo: string;
  highlights: string[];
  days: DayPlan[];
  costIncludes: string[];
  costExcludes: string[];
  precautions: string[];
  suggestedItems: string[];
  flightInfo?: {
    departure: string;
    return: string;
  };
  countryCity?: string;
}

export interface QuotationItem {
  category: string;
  item: string;
  unitPrice: number;
  quantity: number;
  note: string;
}

export interface Quotation {
  items: QuotationItem[];
  totalCost: number;
  suggestedSellingPrice: number;
  profitMargin: number;
}

export interface HistoryRecord {
  id: string;
  timestamp: number;
  plan: TourPlan;
  type: TourType;
  quotation?: Quotation | null;
}
