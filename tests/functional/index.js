import 'dotenv/config';
import { Logger } from '@soralinks/logger';
import { News } from '../../index.js';
(async () => {
    const news = new News();
    const headlines = await news.getHeadlines();
    const logger = new Logger({ logInfo: true });
    logger.info(`headlines: ${JSON.stringify(headlines, null, 2)}`);
})();
