"use strict";if(typeof $response>"u"){$done();return}try{const e=JSON.parse($response.body);e&&e.data&&(e.data={}),$done({body:JSON.stringify(e)})}catch{$done()}
