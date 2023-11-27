import { NewsScraperResponseHeadline } from '@soralinks/news-scrapers';
import { NewsScraperType } from '@soralinks/news-scrapers';

export declare class News {
  constructor();
  getHeadlines(type: NewsScraperType): Promise<NewsScraperResponseHeadline[]>;
}
