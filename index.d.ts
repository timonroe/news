import {
  NewsScraperType,
  NewsScraperResponse,
} from '@soralinks/news-scrapers';

export declare class News {
  constructor();
  getHeadlines(type: NewsScraperType): Promise<NewsScraperResponse[]>;
}
