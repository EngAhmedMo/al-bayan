import{cE as D}from"./index-Hp5Fg5Ti.js";import{g as N,a as f,_ as U,F as L,b as k,C as B,r as y,E as $,c as K,L as j,h as x,S as z,e as V}from"./index.esm2017-CJIGfHtu.js";const F="@firebase/remote-config",I="0.4.9";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class H{constructor(){this.listeners=[]}addEventListener(t){this.listeners.push(t)}abort(){this.listeners.forEach(t=>t())}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const P="remote-config";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const G={"registration-window":"Undefined window object. This SDK only supports usage in a browser environment.","registration-project-id":"Undefined project identifier. Check Firebase app initialization.","registration-api-key":"Undefined API key. Check Firebase app initialization.","registration-app-id":"Undefined app identifier. Check Firebase app initialization.","storage-open":"Error thrown when opening storage. Original error: {$originalErrorMessage}.","storage-get":"Error thrown when reading from storage. Original error: {$originalErrorMessage}.","storage-set":"Error thrown when writing to storage. Original error: {$originalErrorMessage}.","storage-delete":"Error thrown when deleting from storage. Original error: {$originalErrorMessage}.","fetch-client-network":"Fetch client failed to connect to a network. Check Internet connection. Original error: {$originalErrorMessage}.","fetch-timeout":'The config fetch request timed out.  Configure timeout using "fetchTimeoutMillis" SDK setting.',"fetch-throttle":'The config fetch request timed out while in an exponential backoff state. Configure timeout using "fetchTimeoutMillis" SDK setting. Unix timestamp in milliseconds when fetch request throttling ends: {$throttleEndTimeMillis}.',"fetch-client-parse":"Fetch client could not parse response. Original error: {$originalErrorMessage}.","fetch-status":"Fetch server returned an HTTP error status. HTTP status: {$httpStatus}.","indexed-db-unavailable":"Indexed DB is not supported by current browser"},l=new $("remoteconfig","Remote Config",G);function q(i,t){return i instanceof L&&i.code.indexOf(t)!==-1}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Y=!1,W="",A=0,J=["1","true","t","yes","y","on"];class T{constructor(t,e=W){this._source=t,this._value=e}asString(){return this._value}asBoolean(){return this._source==="static"?Y:J.indexOf(this._value.toLowerCase())>=0}asNumber(){if(this._source==="static")return A;let t=Number(this._value);return isNaN(t)&&(t=A),t}getSource(){return this._source}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function p(i=N()){return i=f(i),U(i,P).getImmediate()}async function R(i){const t=f(i),[e,s]=await Promise.all([t._storage.getLastSuccessfulFetchResponse(),t._storage.getActiveConfigEtag()]);return!e||!e.config||!e.eTag||e.eTag===s?!1:(await Promise.all([t._storageCache.setActiveConfig(e.config),t._storage.setActiveConfigEtag(e.eTag)]),!0)}function X(i){const t=f(i);return t._initializePromise||(t._initializePromise=t._storageCache.loadFromStorage().then(()=>{t._isInitializationComplete=!0})),t._initializePromise}async function O(i){const t=f(i),e=new H;setTimeout(async()=>{e.abort()},t.settings.fetchTimeoutMillis);try{await t._client.fetch({cacheMaxAgeMillis:t.settings.minimumFetchIntervalMillis,signal:e}),await t._storageCache.setLastFetchStatus("success")}catch(s){const a=q(s,"fetch-throttle")?"throttle":"failure";throw await t._storageCache.setLastFetchStatus(a),s}}function Q(i,t){return M(f(i),t).asBoolean()}function Z(i,t){return M(f(i),t).asNumber()}function tt(i,t){return M(f(i),t).asString()}function M(i,t){const e=f(i);e._isInitializationComplete||e._logger.debug(`A value was requested for key "${t}" before SDK initialization completed. Await on ensureInitialized if the intent was to get a previously activated value.`);const s=e._storageCache.getActiveConfig();return s&&s[t]!==void 0?new T("remote",s[t]):e.defaultConfig&&e.defaultConfig[t]!==void 0?new T("default",String(e.defaultConfig[t])):(e._logger.debug(`Returning static value for key "${t}". Define a default or remote value if this is unintentional.`),new T("static"))}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class et{constructor(t,e,s,a){this.client=t,this.storage=e,this.storageCache=s,this.logger=a}isCachedDataFresh(t,e){if(!e)return this.logger.debug("Config fetch cache check. Cache unpopulated."),!1;const s=Date.now()-e,a=s<=t;return this.logger.debug(`Config fetch cache check. Cache age millis: ${s}. Cache max age millis (minimumFetchIntervalMillis setting): ${t}. Is cache hit: ${a}.`),a}async fetch(t){const[e,s]=await Promise.all([this.storage.getLastSuccessfulFetchTimestampMillis(),this.storage.getLastSuccessfulFetchResponse()]);if(s&&this.isCachedDataFresh(t.cacheMaxAgeMillis,e))return s;t.eTag=s&&s.eTag;const a=await this.client.fetch(t),n=[this.storageCache.setLastSuccessfulFetchTimestampMillis(Date.now())];return a.status===200&&n.push(this.storage.setLastSuccessfulFetchResponse(a)),await Promise.all(n),a}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function st(i=navigator){return i.languages&&i.languages[0]||i.language}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class it{constructor(t,e,s,a,n,c){this.firebaseInstallations=t,this.sdkVersion=e,this.namespace=s,this.projectId=a,this.apiKey=n,this.appId=c}async fetch(t){const[e,s]=await Promise.all([this.firebaseInstallations.getId(),this.firebaseInstallations.getToken()]),n=`${window.FIREBASE_REMOTE_CONFIG_URL_BASE||"https://firebaseremoteconfig.googleapis.com"}/v1/projects/${this.projectId}/namespaces/${this.namespace}:fetch?key=${this.apiKey}`,c={"Content-Type":"application/json","Content-Encoding":"gzip","If-None-Match":t.eTag||"*"},g={sdk_version:this.sdkVersion,app_instance_id:e,app_instance_id_token:s,app_id:this.appId,language_code:st()},r={method:"POST",headers:c,body:JSON.stringify(g)},o=fetch(n,r),u=new Promise((h,d)=>{t.signal.addEventListener(()=>{const b=new Error("The operation was aborted.");b.name="AbortError",d(b)})});let _;try{await Promise.race([o,u]),_=await o}catch(h){let d="fetch-client-network";throw(h==null?void 0:h.name)==="AbortError"&&(d="fetch-timeout"),l.create(d,{originalErrorMessage:h==null?void 0:h.message})}let m=_.status;const v=_.headers.get("ETag")||void 0;let w,E;if(_.status===200){let h;try{h=await _.json()}catch(d){throw l.create("fetch-client-parse",{originalErrorMessage:d==null?void 0:d.message})}w=h.entries,E=h.state}if(E==="INSTANCE_STATE_UNSPECIFIED"?m=500:E==="NO_CHANGE"?m=304:(E==="NO_TEMPLATE"||E==="EMPTY_CONFIG")&&(w={}),m!==304&&m!==200)throw l.create("fetch-status",{httpStatus:m});return{status:m,eTag:v,config:w}}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function at(i,t){return new Promise((e,s)=>{const a=Math.max(t-Date.now(),0),n=setTimeout(e,a);i.addEventListener(()=>{clearTimeout(n),s(l.create("fetch-throttle",{throttleEndTimeMillis:t}))})})}function nt(i){if(!(i instanceof L)||!i.customData)return!1;const t=Number(i.customData.httpStatus);return t===429||t===500||t===503||t===504}class rt{constructor(t,e){this.client=t,this.storage=e}async fetch(t){const e=await this.storage.getThrottleMetadata()||{backoffCount:0,throttleEndTimeMillis:Date.now()};return this.attemptFetch(t,e)}async attemptFetch(t,{throttleEndTimeMillis:e,backoffCount:s}){await at(t.signal,e);try{const a=await this.client.fetch(t);return await this.storage.deleteThrottleMetadata(),a}catch(a){if(!nt(a))throw a;const n={throttleEndTimeMillis:Date.now()+V(s),backoffCount:s+1};return await this.storage.setThrottleMetadata(n),this.attemptFetch(t,n)}}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ot=60*1e3,ct=12*60*60*1e3;class lt{constructor(t,e,s,a,n){this.app=t,this._client=e,this._storageCache=s,this._storage=a,this._logger=n,this._isInitializationComplete=!1,this.settings={fetchTimeoutMillis:ot,minimumFetchIntervalMillis:ct},this.defaultConfig={}}get fetchTimeMillis(){return this._storageCache.getLastSuccessfulFetchTimestampMillis()||-1}get lastFetchStatus(){return this._storageCache.getLastFetchStatus()||"no-fetch-yet"}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function S(i,t){const e=i.target.error||void 0;return l.create(t,{originalErrorMessage:e&&(e==null?void 0:e.message)})}const C="app_namespace_store",gt="firebase_remote_config",ht=1;function ut(){return new Promise((i,t)=>{try{const e=indexedDB.open(gt,ht);e.onerror=s=>{t(S(s,"storage-open"))},e.onsuccess=s=>{i(s.target.result)},e.onupgradeneeded=s=>{const a=s.target.result;switch(s.oldVersion){case 0:a.createObjectStore(C,{keyPath:"compositeKey"})}}}catch(e){t(l.create("storage-open",{originalErrorMessage:e==null?void 0:e.message}))}})}class ft{constructor(t,e,s,a=ut()){this.appId=t,this.appName=e,this.namespace=s,this.openDbPromise=a}getLastFetchStatus(){return this.get("last_fetch_status")}setLastFetchStatus(t){return this.set("last_fetch_status",t)}getLastSuccessfulFetchTimestampMillis(){return this.get("last_successful_fetch_timestamp_millis")}setLastSuccessfulFetchTimestampMillis(t){return this.set("last_successful_fetch_timestamp_millis",t)}getLastSuccessfulFetchResponse(){return this.get("last_successful_fetch_response")}setLastSuccessfulFetchResponse(t){return this.set("last_successful_fetch_response",t)}getActiveConfig(){return this.get("active_config")}setActiveConfig(t){return this.set("active_config",t)}getActiveConfigEtag(){return this.get("active_config_etag")}setActiveConfigEtag(t){return this.set("active_config_etag",t)}getThrottleMetadata(){return this.get("throttle_metadata")}setThrottleMetadata(t){return this.set("throttle_metadata",t)}deleteThrottleMetadata(){return this.delete("throttle_metadata")}async get(t){const e=await this.openDbPromise;return new Promise((s,a)=>{const c=e.transaction([C],"readonly").objectStore(C),g=this.createCompositeKey(t);try{const r=c.get(g);r.onerror=o=>{a(S(o,"storage-get"))},r.onsuccess=o=>{const u=o.target.result;s(u?u.value:void 0)}}catch(r){a(l.create("storage-get",{originalErrorMessage:r==null?void 0:r.message}))}})}async set(t,e){const s=await this.openDbPromise;return new Promise((a,n)=>{const g=s.transaction([C],"readwrite").objectStore(C),r=this.createCompositeKey(t);try{const o=g.put({compositeKey:r,value:e});o.onerror=u=>{n(S(u,"storage-set"))},o.onsuccess=()=>{a()}}catch(o){n(l.create("storage-set",{originalErrorMessage:o==null?void 0:o.message}))}})}async delete(t){const e=await this.openDbPromise;return new Promise((s,a)=>{const c=e.transaction([C],"readwrite").objectStore(C),g=this.createCompositeKey(t);try{const r=c.delete(g);r.onerror=o=>{a(S(o,"storage-delete"))},r.onsuccess=()=>{s()}}catch(r){a(l.create("storage-delete",{originalErrorMessage:r==null?void 0:r.message}))}})}createCompositeKey(t){return[this.appId,this.appName,this.namespace,t].join()}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class mt{constructor(t){this.storage=t}getLastFetchStatus(){return this.lastFetchStatus}getLastSuccessfulFetchTimestampMillis(){return this.lastSuccessfulFetchTimestampMillis}getActiveConfig(){return this.activeConfig}async loadFromStorage(){const t=this.storage.getLastFetchStatus(),e=this.storage.getLastSuccessfulFetchTimestampMillis(),s=this.storage.getActiveConfig(),a=await t;a&&(this.lastFetchStatus=a);const n=await e;n&&(this.lastSuccessfulFetchTimestampMillis=n);const c=await s;c&&(this.activeConfig=c)}setLastFetchStatus(t){return this.lastFetchStatus=t,this.storage.setLastFetchStatus(t)}setLastSuccessfulFetchTimestampMillis(t){return this.lastSuccessfulFetchTimestampMillis=t,this.storage.setLastSuccessfulFetchTimestampMillis(t)}setActiveConfig(t){return this.activeConfig=t,this.storage.setActiveConfig(t)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function dt(){k(new B(P,i,"PUBLIC").setMultipleInstances(!0)),y(F,I),y(F,I,"esm2017");function i(t,{instanceIdentifier:e}){const s=t.getProvider("app").getImmediate(),a=t.getProvider("installations-internal").getImmediate();if(typeof window>"u")throw l.create("registration-window");if(!K())throw l.create("indexed-db-unavailable");const{projectId:n,apiKey:c,appId:g}=s.options;if(!n)throw l.create("registration-project-id");if(!c)throw l.create("registration-api-key");if(!g)throw l.create("registration-app-id");e=e||"firebase";const r=new ft(g,s.name,e),o=new mt(r),u=new j(F);u.logLevel=x.ERROR;const _=new it(a,z,e,n,c,g),m=new rt(_,r),v=new et(m,r,o,u),w=new lt(s,v,o,r,u);return X(w),w}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function pt(i){return i=f(i),await O(i),R(i)}dt();class wt extends D{async activate(){const t=p();await R(t)}async fetchAndActivate(){const t=p();await pt(t)}async fetchConfig(){const t=p();await O(t)}async getBoolean(t){const e=p();return{value:Q(e,t.key)}}async getNumber(t){const e=p();return{value:Z(e,t.key)}}async getString(t){const e=p();return{value:tt(e,t.key)}}async setMinimumFetchInterval(t){const e=p();e.settings.minimumFetchIntervalMillis=t.minimumFetchIntervalInSeconds*1e3}async setSettings(t){const e=p();t.fetchTimeoutInSeconds!==void 0&&(e.settings.fetchTimeoutMillis=t.fetchTimeoutInSeconds*1e3),t.minimumFetchIntervalInSeconds!==void 0&&(e.settings.minimumFetchIntervalMillis=t.minimumFetchIntervalInSeconds*1e3)}async addConfigUpdateListener(t){this.throwUnimplementedError()}async removeConfigUpdateListener(t){this.throwUnimplementedError()}throwUnimplementedError(){throw this.unimplemented("Not implemented on web.")}}export{wt as FirebaseRemoteConfigWeb};
