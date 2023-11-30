import { NewsScraperSource, NewsScraperType } from '@soralinks/news-scrapers';

export declare class News {
  constructor();
  getHeadlines(params: {
    type: NewsScraperType;
    sources: NewsScraperSource[];
    topHeadlines: {
      count: number;
    };
  }): Promise<any>;
}
