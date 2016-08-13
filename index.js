// Copyright 2016 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var request = require('request-promise');
var _ = require('lodash');
var buffer = require('buffer');
var https = require('https');

class Cloud {
  constructor(opt_project) {
    this.cachedToken_ = undefined;
    this.project = opt_project || process.env.GCP_PROJECT;
  }

  service(path) {
    return new Service(this, path);
  }

  get storage() {
    return this.service('www.googleapis.com/storage/v1');
  }

  get translate() {
    return this.service('www.googleapis.com/language/translate/v2')
  }

  getToken() {
    var expired = this.cachedToken_ && this.cachedToken_.expirationTime < Date.now();
    if (this.cachedToken_ && !expired) {
      return Promise.resolve(this.cachedToken_.accessToken);
    }

    return request({
      url: 'http://metadata.google.internal/computeMetadata/v1beta1/instance/service-accounts/default/token',
      json: true
    }).then((result) => {
      if (result === null) {
        return null;
      }
      if (typeof result !== 'object' ||
        typeof result.expires_in !== 'number' ||
        typeof result.access_token !== 'string') {
        throw new Error('Metadata Service credential created invalid access tokens: ' + JSON.stringify(result));
      }
      var token = {
        accessToken: result.access_token,
        expirationTime: Date.now() + (result.expires_in * 1000)
      };
      this.cachedToken_ = token;
      return token.accessToken;
    });
  };
}

class Service {
  constructor(cloud, uri) {
    this.cloud_ = cloud;
    this.uri_ = uri;
  }

  getUri_(path) {
    path = path.replace('projects/*', `projects/${this.cloud_.project}`);
    return `https://${this.uri_}/${path}`;
  }

  getHeaders_(options) {
    if (_.has(options, 'headers.Authorization')) {
      return Promise.resolve(options.headers);
    }
    return this.cloud_.getToken().then((token) => {
      return _.assign({}, _.get(options, 'headers', {}), {
        Authorization: `Bearer ${token}`
      });
    });
  }

  // Options can include qs (query string), headers
  get(path, options) {
    return this.getHeaders_(options).then((headers) => {
      console.log('Fetching ', this.getUri_(path));
      console.log('Headers: ', JSON.stringify(headers));
      return request(_.assign({}, options, {
        uri: this.getUri_(path),
        headers: headers,
        json: true
      }));
    });
  }

  // Options can include qs (query string), headers, and body
  post(path, options) {
    return this.getHeaders_(options).then((headers) => {
      return request(_.assign({}, options, {
        uri: this.getUri_(path),
        method: 'POST',
        headers: headers,
        json: true
      }));
    });
  }

  getBuffer(path, options) {
    options = _.assign({}, options, {
      uri: this.getUri_(path),
      headers: headers,
      json: true
    });
    let resolve, reject;
    const p = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const req = https.request(options, (res) => {
      let buffers = [];
      res.on('data', (buffer) => { return buffers.push(buffer); });
      res.on('end', function () {
        try {
          resolve(Buffer.concat(buffers));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.end();

    return p;
  }
}

module.exports = Cloud;
