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

export declare type NewsResponse = {
  scraperResponses: NewsScraperResponse[];
  topHeadlines: NewsHeadline[] | undefined;
};

export declare class News {
  constructor();
  getHeadlines(params: {
    type: NewsScraperType;
    sources: NewsScraperSource[];
    topHeadlines: {
      count: number;
    };
  }): Promise<NewsResponse>;
}
