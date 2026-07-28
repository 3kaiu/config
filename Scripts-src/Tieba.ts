if (typeof $response === "undefined") { $done(); return; }

const AD_KEYS: string[] = [
  "ad", "adlist", "ad_info", "ad_cont", "activity",
  "banner", "banner_list", "recommend", "promotion",
  "ad_callback", "ad_extra", "ad_ext", "ad_meta"
];

try {
  const obj: Record<string, unknown> = JSON.parse($response.body);

  function clean(data: unknown): void {
    if (!data || typeof data !== "object") return;
    if (Array.isArray(data)) {
      for (const item of data) clean(item);
      return;
    }
    for (const key of Object.keys(data as Record<string, unknown>)) {
      if (AD_KEYS.includes(key)) {
        delete (data as Record<string, unknown>)[key];
      } else if (key.startsWith("ad_") || key.startsWith("ads_")) {
        delete (data as Record<string, unknown>)[key];
      } else {
        clean((data as Record<string, unknown>)[key]);
      }
    }
  }

  clean(obj);
  $done({ body: JSON.stringify(obj) });
} catch (e) {
  $done();
}
