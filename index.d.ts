import {
  NewsScraperSource,
  NewsScraperType,
  NewsScraperResponse
} from '@soralinks/news-scrapers';

export declare type NewsHeadline = {
  source: string;
  title: string;
  url: string;
};

export declare type RankedToken = {
  token: string;
  count: number;
};

export declare type NewsResponse = {
  scraperResponses: NewsScraperResponse[];
  topHeadlines: NewsHeadline[] | undefined;
  topTokens: RankedToken[] | undefined;
};

export declare class News {
  constructor();
  getHeadlines(params: {
    type: NewsScraperType;
    sources: NewsScraperSource[];
    options?: {
      topHeadlinesCount?: number;
      topTokensCount?: number;
    };
  }): Promise<NewsResponse>;
}
