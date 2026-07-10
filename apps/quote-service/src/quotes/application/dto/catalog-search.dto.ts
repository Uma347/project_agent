export type CatalogProductSearchRequestDto = {
  query?: unknown;
  limit?: unknown;
};

export type CatalogSearchProductDto = {
  productId: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  keywords: string[];
  tags: string[];
  priceCents: number;
};

export type CatalogProductSearchResponseDto =
  | {
      products: CatalogSearchProductDto[];
    }
  | {
      error: {
        code: 'INVALID_CATALOG_SEARCH_REQUEST';
        message: string;
      };
    };
