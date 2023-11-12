# news
News utility

## Install

`npm install @soralinks/news`

## Use in your app

```javascript
import { News } from '@soralinks/new';

const news: News = new News();
const headlines: string[] = await news.getHeadlines();
console.log('headlines: ', JSON.stringify(headlines, null, 2));
```
