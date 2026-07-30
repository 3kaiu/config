"use strict";if(typeof $response>"u"){$done();return}try{const t=JSON.parse($response.body);t&&t.data&&(t.data={}),$done({body:JSON.stringify(t)})}catch{$done()}
