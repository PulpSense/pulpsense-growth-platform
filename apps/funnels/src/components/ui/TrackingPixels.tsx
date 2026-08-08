import Script from 'next/script';

type FacebookEvent = {
  name: string;
  type?: 'standard' | 'custom';
};

type PixelConfig = {
  facebookPixelId?: string;
  facebookEvents?: FacebookEvent[];
  googleAnalyticsId?: string;
  googleEvents?: string[];
  tiktokPixelId?: string;
  tiktokEvents?: string[];
  linkedinPartnerId?: string;
};

type TrackingPixelsProps = {
  pixels: PixelConfig;
};

const TrackingPixels = ({ pixels }: TrackingPixelsProps) => {
  const {
    facebookPixelId,
    facebookEvents = [{ name: 'PageView', type: 'standard' }],
    googleAnalyticsId,
    googleEvents = [],
    tiktokPixelId,
    tiktokEvents = [],
    linkedinPartnerId,
  } = pixels;

  // Build Facebook event tracking code
  const fbEventCode = facebookEvents
    .map((event) =>
      event.type === 'custom'
        ? `fbq('trackCustom', '${event.name}');`
        : `fbq('track', '${event.name}');`
    )
    .join('\n                ');

  return (
    <>
      {/* Facebook Pixel */}
      {facebookPixelId && (
        <>
          <Script
            id="fb-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${facebookPixelId}');
                ${fbEventCode}
              `,
            }}
          />
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${facebookPixelId}&ev=${facebookEvents[0]?.name || 'PageView'}&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}

      {/* Google Analytics (GA4) */}
      {googleAnalyticsId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${googleAnalyticsId}');
                ${googleEvents.map((event) => `gtag('event', '${event}');`).join('\n                ')}
              `,
            }}
          />
        </>
      )}

      {/* TikTok Pixel */}
      {tiktokPixelId && (
        <Script
          id="tiktok-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function (w, d, t) {
                w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
                ttq.load('${tiktokPixelId}');
                ttq.page();
                ${tiktokEvents.map((event) => `ttq.track('${event}');`).join('\n                ')}
              }(window, document, 'ttq');
            `,
          }}
        />
      )}

      {/* LinkedIn Insight Tag */}
      {linkedinPartnerId && (
        <Script
          id="linkedin-insight"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              _linkedin_partner_id = "${linkedinPartnerId}";
              window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
              window._linkedin_data_partner_ids.push(_linkedin_partner_id);
              (function(l) {
                if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
                window.lintrk.q=[]}
                var s = document.getElementsByTagName("script")[0];
                var b = document.createElement("script");
                b.type = "text/javascript";b.async = true;
                b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
                s.parentNode.insertBefore(b, s);})(window.lintrk);
            `,
          }}
        />
      )}
    </>
  );
};

export { TrackingPixels };
export type { FacebookEvent, PixelConfig, TrackingPixelsProps };
