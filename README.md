# resty-cloud
REST &amp; Promise Node APIs for Google Cloud

This is a simple library that makes it easy to use Google Cloud REST APIs. The point of this API is:
* Automatically authenticate REST API calls (currently only works inside a Google Cloud runtime)
* Expose REST resources for each Google service
* Provide an easy Promise-compatible interface.

## Initialization

```js
var Cloud = require('resty-cloud');

// Omit the project parameter to automatically use the GCP_PROJECT environment variable
var cloud = new Cloud();
```

## Getting a service

```js
const translate = cloud.translate;
const storage = cloud.storage;
const otherService = cloud.service('www.googleapis.com/some/other/service/v1');
```

## Using a service

```js
const getKnownLanguages = cloud.translate.get('languages').then((res) => {
  res.data.languages.map((e) => e.language);
});
```
