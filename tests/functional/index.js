import 'dotenv/config';
import { News } from '../../index.js';
(async () => {
    const news = new News();
    const headlines = await news.getHeadlines();
    console.log(`headlines: ${JSON.stringify(headlines, null, 2)}`);
})();
