export declare class News {
  constructor();
  summarizeHeadlines(headlines: string[]): Promise<string[]>;
  scrapeHeadlines(): Promise<string[]>;
  getHeadlines(): Promise<string[]>;
}
