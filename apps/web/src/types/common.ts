// note : Types génériques et communs à l'ensemble du front-end KAZA

export type Nullable<T> = T | null;

export type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  status: number;
};

export type PaginationParams = {
  limit?: number;
  offset?: number;
};

export type SortOrder = 'asc' | 'desc';

export type GeoCoordinates = {
  lat: number;
  lng: number;
};
