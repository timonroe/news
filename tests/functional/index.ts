import 'dotenv/config';
import { Logger } from '@soralinks/logger';
import { News } from '../../index.js';

(async () => {
  const news: News = new News();
  const headlines: string[] = await news.getHeadlines();
  const logger: Logger = new Logger({ logInfo: true });
  logger.info(`headlines: ${JSON.stringify(headlines, null, 2)}`);
})();
