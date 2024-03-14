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
  scoreTitles(scraperResponses: NewsScraperResponse[], rankedTokens: any[]): any[];
  rankTokens(tokenizedTitles: string[][][]): any[];
  tokenizeTitles(params: {
    scraperResponses: NewsScraperResponse[],
    ignoreTokens?: string[],
    multiWordTokens?: string[],
    synonymTokens?: object[],
  }): string[][][];
  scrapeHeadlines(
    type: NewsScraperType,
    sources: NewsScraperSource[]
  ): Promise<NewsScraperResponse[]>;
}
