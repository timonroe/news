# news
News utility

## Install

`npm install @soralinks/news`

## Setup
```javascript
// This package uses the openai package and needs an OpenAI apiKey. To set
// the key, set the environment variable: OPENAI_API_KEY = 'your-openai-api-key'

```

## Use in your app

```javascript
import { News } from '@soralinks/new';

const news: News = new News();
const headlines: string[] = await news.getHeadlines();
console.log('headlines: ', JSON.stringify(headlines, null, 2));
```

## Logging
```javascript
// To turn on logging, set the environment variable: LOGGING_NEWS = 'on'
// Note that error logging is always on

```
