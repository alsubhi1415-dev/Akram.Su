/* المنصة الرقمية لجاهزية الآليات — عامل خدمة تمريري: لا تخزين ولا اعتراض؛ وجوده يجعل التطبيق قابلاً للتثبيت على المتصفحات القديمة */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function () { });
