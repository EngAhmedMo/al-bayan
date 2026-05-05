import{cE as j,cF as B,cG as g}from"./index-CVXyyp1E.js";import{g as W,a as I,_ as L,L as N,d as K,E as Y,b as C,C as F,r as D,i as q,c as H,v as V,e as M,F as J,f as Q}from"./index.esm2017-CJIGfHtu.js";/**
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
 */const v="analytics",X="firebase_id",Z="origin",ee=60*1e3,te="https://firebase.googleapis.com/v1alpha/projects/-/apps/{app-id}/webConfig",E="https://www.googletagmanager.com/gtag/js";/**
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
 */const l=new N("@firebase/analytics");/**
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
 */const ne={"already-exists":"A Firebase Analytics instance with the appId {$id}  already exists. Only one Firebase Analytics instance can be created for each appId.","already-initialized":"initializeAnalytics() cannot be called again with different options than those it was initially called with. It can be called again with the same options to return the existing instance, or getAnalytics() can be used to get a reference to the already-initialized instance.","already-initialized-settings":"Firebase Analytics has already been initialized.settings() must be called before initializing any Analytics instanceor it will have no effect.","interop-component-reg-failed":"Firebase Analytics Interop Component failed to instantiate: {$reason}","invalid-analytics-context":"Firebase Analytics is not supported in this environment. Wrap initialization of analytics in analytics.isSupported() to prevent initialization in unsupported environments. Details: {$errorInfo}","indexeddb-unavailable":"IndexedDB unavailable or restricted in this environment. Wrap initialization of analytics in analytics.isSupported() to prevent initialization in unsupported environments. Details: {$errorInfo}","fetch-throttle":"The config fetch request timed out while in an exponential backoff state. Unix timestamp in milliseconds when fetch request throttling ends: {$throttleEndTimeMillis}.","config-fetch-failed":"Dynamic config fetch failed: [{$httpStatus}] {$responseMessage}","no-api-key":'The "apiKey" field is empty in the local Firebase config. Firebase Analytics requires this field tocontain a valid API key.',"no-app-id":'The "appId" field is empty in the local Firebase config. Firebase Analytics requires this field tocontain a valid app ID.',"no-client-id":'The "client_id" field is empty.',"invalid-gtag-resource":"Trusted Types detected an invalid gtag resource: {$gtagURL}."},u=new Y("analytics","Analytics",ne);/**
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
 */function ie(e){if(!e.startsWith(E)){const t=u.create("invalid-gtag-resource",{gtagURL:e});return l.warn(t.message),""}return e}function O(e){return Promise.all(e.map(t=>t.catch(n=>n)))}function ae(e,t){let n;return window.trustedTypes&&(n=window.trustedTypes.createPolicy(e,t)),n}function se(e,t){const n=ae("firebase-js-sdk-policy",{createScriptURL:ie}),i=document.createElement("script"),a=`${E}?l=${e}&id=${t}`;i.src=n?n==null?void 0:n.createScriptURL(a):a,i.async=!0,document.head.appendChild(i)}function re(e){let t=[];return Array.isArray(window[e])?t=window[e]:window[e]=t,t}async function oe(e,t,n,i,a,s){const r=i[a];try{if(r)await t[r];else{const c=(await O(n)).find(d=>d.measurementId===a);c&&await t[c.appId]}}catch(o){l.error(o)}e("config",a,s)}async function ce(e,t,n,i,a){try{let s=[];if(a&&a.send_to){let r=a.send_to;Array.isArray(r)||(r=[r]);const o=await O(n);for(const c of r){const d=o.find(h=>h.measurementId===c),f=d&&t[d.appId];if(f)s.push(f);else{s=[];break}}}s.length===0&&(s=Object.values(t)),await Promise.all(s),e("event",i,a||{})}catch(s){l.error(s)}}function le(e,t,n,i){async function a(s,...r){try{if(s==="event"){const[o,c]=r;await ce(e,t,n,o,c)}else if(s==="config"){const[o,c]=r;await oe(e,t,n,i,o,c)}else if(s==="consent"){const[o,c]=r;e("consent",o,c)}else if(s==="get"){const[o,c,d]=r;e("get",o,c,d)}else if(s==="set"){const[o]=r;e("set",o)}else e(s,...r)}catch(o){l.error(o)}}return a}function de(e,t,n,i,a){let s=function(...r){window[i].push(arguments)};return window[a]&&typeof window[a]=="function"&&(s=window[a]),window[a]=le(s,e,t,n),{gtagCore:s,wrappedGtag:window[a]}}function ue(e){const t=window.document.getElementsByTagName("script");for(const n of Object.values(t))if(n.src&&n.src.includes(E)&&n.src.includes(e))return n;return null}/**
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
 */const fe=30,pe=1e3;class me{constructor(t={},n=pe){this.throttleMetadata=t,this.intervalMillis=n}getThrottleMetadata(t){return this.throttleMetadata[t]}setThrottleMetadata(t,n){this.throttleMetadata[t]=n}deleteThrottleMetadata(t){delete this.throttleMetadata[t]}}const z=new me;function he(e){return new Headers({Accept:"application/json","x-goog-api-key":e})}async function ge(e){var t;const{appId:n,apiKey:i}=e,a={method:"GET",headers:he(i)},s=te.replace("{app-id}",n),r=await fetch(s,a);if(r.status!==200&&r.status!==304){let o="";try{const c=await r.json();!((t=c.error)===null||t===void 0)&&t.message&&(o=c.error.message)}catch{}throw u.create("config-fetch-failed",{httpStatus:r.status,responseMessage:o})}return r.json()}async function ye(e,t=z,n){const{appId:i,apiKey:a,measurementId:s}=e.options;if(!i)throw u.create("no-app-id");if(!a){if(s)return{measurementId:s,appId:i};throw u.create("no-api-key")}const r=t.getThrottleMetadata(i)||{backoffCount:0,throttleEndTimeMillis:Date.now()},o=new be;return setTimeout(async()=>{o.abort()},ee),U({appId:i,apiKey:a,measurementId:s},r,o,t)}async function U(e,{throttleEndTimeMillis:t,backoffCount:n},i,a=z){var s;const{appId:r,measurementId:o}=e;try{await we(i,t)}catch(c){if(o)return l.warn(`Timed out fetching this Firebase app's measurement ID from the server. Falling back to the measurement ID ${o} provided in the "measurementId" field in the local Firebase config. [${c==null?void 0:c.message}]`),{appId:r,measurementId:o};throw c}try{const c=await ge(e);return a.deleteThrottleMetadata(r),c}catch(c){const d=c;if(!Ie(d)){if(a.deleteThrottleMetadata(r),o)return l.warn(`Failed to fetch this Firebase app's measurement ID from the server. Falling back to the measurement ID ${o} provided in the "measurementId" field in the local Firebase config. [${d==null?void 0:d.message}]`),{appId:r,measurementId:o};throw c}const f=Number((s=d==null?void 0:d.customData)===null||s===void 0?void 0:s.httpStatus)===503?M(n,a.intervalMillis,fe):M(n,a.intervalMillis),h={throttleEndTimeMillis:Date.now()+f,backoffCount:n+1};return a.setThrottleMetadata(r,h),l.debug(`Calling attemptFetch again in ${f} millis`),U(e,h,i,a)}}function we(e,t){return new Promise((n,i)=>{const a=Math.max(t-Date.now(),0),s=setTimeout(n,a);e.addEventListener(()=>{clearTimeout(s),i(u.create("fetch-throttle",{throttleEndTimeMillis:t}))})})}function Ie(e){if(!(e instanceof J)||!e.customData)return!1;const t=Number(e.customData.httpStatus);return t===429||t===500||t===503||t===504}class be{constructor(){this.listeners=[]}addEventListener(t){this.listeners.push(t)}abort(){this.listeners.forEach(t=>t())}}async function ve(e,t,n,i,a){if(a&&a.global){e("event",n,i);return}else{const s=await t,r=Object.assign(Object.assign({},i),{send_to:s});e("event",n,r)}}async function Te(e,t,n,i){{const a=await t;e("config",a,{update:!0,user_id:n})}}async function Ae(e,t,n,i){{const a=await t;e("config",a,{update:!0,user_properties:n})}}async function _e(e,t){const n=await e;window[`ga-disable-${n}`]=!t}let A;function G(e){A=e}/**
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
 */async function Ee(){if(H())try{await V()}catch(e){return l.warn(u.create("indexeddb-unavailable",{errorInfo:e==null?void 0:e.toString()}).message),!1}else return l.warn(u.create("indexeddb-unavailable",{errorInfo:"IndexedDB is not available in this environment."}).message),!1;return!0}async function Ce(e,t,n,i,a,s,r){var o;const c=ye(e);c.then(p=>{n[p.measurementId]=p.appId,e.options.measurementId&&p.measurementId!==e.options.measurementId&&l.warn(`The measurement ID in the local Firebase config (${e.options.measurementId}) does not match the measurement ID fetched from the server (${p.measurementId}). To ensure analytics events are always sent to the correct Analytics property, update the measurement ID field in the local config or remove it from the local config.`)}).catch(p=>l.error(p)),t.push(c);const d=Ee().then(p=>{if(p)return i.getId()}),[f,h]=await Promise.all([c,d]);ue(s)||se(s,f.measurementId),A&&(a("consent","default",A),G(void 0)),a("js",new Date);const b=(o=r==null?void 0:r.config)!==null&&o!==void 0?o:{};return b[Z]="firebase",b.update=!0,h!=null&&(b[X]=h),a("config",f.measurementId,b),f.measurementId}/**
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
 */class Fe{constructor(t){this.app=t}_delete(){return delete m[this.app.options.appId],Promise.resolve()}}let m={},S=[];const R={};let T="dataLayer",De="gtag",P,y,$=!1;function Me(){const e=[];if(q()&&e.push("This is a browser extension environment."),Q()||e.push("Cookies are not available."),e.length>0){const t=e.map((i,a)=>`(${a+1}) ${i}`).join(" "),n=u.create("invalid-analytics-context",{errorInfo:t});l.warn(n.message)}}function Se(e,t,n){Me();const i=e.options.appId;if(!i)throw u.create("no-app-id");if(!e.options.apiKey)if(e.options.measurementId)l.warn(`The "apiKey" field is empty in the local Firebase config. This is needed to fetch the latest measurement ID for this Firebase app. Falling back to the measurement ID ${e.options.measurementId} provided in the "measurementId" field in the local Firebase config.`);else throw u.create("no-api-key");if(m[i]!=null)throw u.create("already-exists",{id:i});if(!$){re(T);const{wrappedGtag:s,gtagCore:r}=de(m,S,R,T,De);y=s,P=r,$=!0}return m[i]=Ce(e,S,R,t,P,T,n),new Fe(e)}function w(e=W()){e=I(e);const t=L(e,v);return t.isInitialized()?t.getImmediate():Re(e)}function Re(e,t={}){const n=L(e,v);if(n.isInitialized()){const a=n.getImmediate();if(K(t,n.getOptions()))return a;throw u.create("already-initialized")}return n.initialize({options:t})}function Pe(e,t,n){e=I(e),Te(y,m[e.app.options.appId],t).catch(i=>l.error(i))}function $e(e,t,n){e=I(e),Ae(y,m[e.app.options.appId],t).catch(i=>l.error(i))}function ke(e,t){e=I(e),_e(m[e.app.options.appId],t).catch(n=>l.error(n))}function _(e,t,n,i){e=I(e),ve(y,m[e.app.options.appId],t,n,i).catch(a=>l.error(a))}function xe(e){y?y("consent","update",e):G(e)}const k="@firebase/analytics",x="0.10.8";function Le(){C(new F(v,(t,{options:n})=>{const i=t.getProvider("app").getImmediate(),a=t.getProvider("installations-internal").getImmediate();return Se(i,a,n)},"PUBLIC")),C(new F("analytics-internal",e,"PRIVATE")),D(k,x),D(k,x,"esm2017");function e(t){try{const n=t.getProvider(v).getImmediate();return{logEvent:(i,a,s)=>_(n,i,a,s)}}catch(n){throw u.create("interop-component-reg-failed",{reason:n})}}}Le();class Ue extends j{async getAppInstanceId(){throw this.unimplemented("Not implemented on web.")}async setConsent(t){const n=t.status===B.Granted?"granted":"denied",i={};switch(t.type){case g.AdPersonalization:i.ad_personalization=n;break;case g.AdStorage:i.ad_storage=n;break;case g.AdUserData:i.ad_user_data=n;break;case g.AnalyticsStorage:i.analytics_storage=n;break;case g.FunctionalityStorage:i.functionality_storage=n;break;case g.PersonalizationStorage:i.personalization_storage=n;break}xe(i)}async setUserId(t){const n=w();Pe(n,t.userId)}async setUserProperty(t){const n=w();$e(n,{[t.key]:t.value})}async setCurrentScreen(t){const n=w();_(n,"screen_view",{firebase_screen:t.screenName||void 0,firebase_screen_class:t.screenClassOverride||void 0})}async logEvent(t){const n=w();_(n,t.name,t.params)}async setSessionTimeoutDuration(t){throw this.unimplemented("Not implemented on web.")}async setEnabled(t){const n=w();ke(n,t.enabled)}async isEnabled(){return{enabled:window["ga-disable-analyticsId"]===!0}}async resetAnalyticsData(){throw this.unimplemented("Not implemented on web.")}}export{Ue as FirebaseAnalyticsWeb};
