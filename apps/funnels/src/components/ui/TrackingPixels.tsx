'use client';

import { useEffect } from 'react';

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

const interactionEvents = ['pointerdown', 'keydown', 'scroll', 'touchstart'];

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

  const vendorCode = [
    facebookPixelId
      ? `
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
        (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', ${JSON.stringify(facebookPixelId)});
        ${facebookEvents
          .map((event) =>
            event.type === 'custom'
              ? `fbq('trackCustom', ${JSON.stringify(event.name)});`
              : `fbq('track', ${JSON.stringify(event.name)});`,
          )
          .join('\n')}
      `
      : '',
    googleAnalyticsId
      ? `
        const gtagScript = document.createElement('script');
        gtagScript.async = true;
        gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + ${JSON.stringify(googleAnalyticsId)};
        document.head.appendChild(gtagScript);
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments)}
        gtag('js', new Date());
        gtag('config', ${JSON.stringify(googleAnalyticsId)});
        ${googleEvents.map((event) => `gtag('event', ${JSON.stringify(event)});`).join('\n')}
      `
      : '',
    tiktokPixelId
      ? `
        !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
        ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];
        ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
        for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
        ttq.load=function(e){var n='https://analytics.tiktok.com/i18n/pixel/events.js';
        ttq._i=ttq._i||{};ttq._i[e]=[];var s=d.createElement('script');s.async=!0;s.src=n+'?sdkid='+e+'&lib='+t;
        var a=d.getElementsByTagName('script')[0];a.parentNode.insertBefore(s,a)};
        ttq.load(${JSON.stringify(tiktokPixelId)});ttq.page();
        ${tiktokEvents.map((event) => `ttq.track(${JSON.stringify(event)});`).join('\n')}
        }(window,document,'ttq');
      `
      : '',
    linkedinPartnerId
      ? `
        window._linkedin_partner_id = ${JSON.stringify(linkedinPartnerId)};
        window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
        window._linkedin_data_partner_ids.push(window._linkedin_partner_id);
        window.lintrk = window.lintrk || function(a,b){window.lintrk.q.push([a,b])};
        window.lintrk.q = window.lintrk.q || [];
        const linkedInScript = document.createElement('script');
        linkedInScript.async = true;
        linkedInScript.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
        document.head.appendChild(linkedInScript);
      `
      : '',
  ].join('\n');

  useEffect(() => {
    if (!vendorCode.trim()) return;

    let loaded = false;
    const load = () => {
      if (loaded) return;
      loaded = true;

      const script = document.createElement('script');
      script.text = vendorCode;
      document.head.appendChild(script);

      for (const eventName of interactionEvents) {
        window.removeEventListener(eventName, load);
      }
    };

    for (const eventName of interactionEvents) {
      window.addEventListener(eventName, load, { once: true, passive: true });
    }

    return () => {
      for (const eventName of interactionEvents) {
        window.removeEventListener(eventName, load);
      }
    };
  }, [vendorCode]);

  return (
    facebookPixelId ? (
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${facebookPixelId}&ev=${facebookEvents[0]?.name ?? 'PageView'}&noscript=1`}
          alt=""
        />
      </noscript>
    ) : null
  );
};

export { TrackingPixels };
export type { FacebookEvent, PixelConfig, TrackingPixelsProps };
