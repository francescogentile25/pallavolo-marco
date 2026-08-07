export interface CourtItem {
  id: string;
  name: string;
  indoor: boolean;
  surface: string;
  owned: boolean;
  venue: {
    id: string;
    name: string;
    address: string;
    city: string;
  };
}

export interface CourtInput {
  venueName: string;
  address: string;
  city: string;
  placeId: number | null;
  latitude: number | null;
  longitude: number | null;
  courtName: string;
  indoor: boolean;
}
