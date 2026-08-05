import { onCLS, onINP, onLCP, onTTFB, Metric } from 'web-vitals';

export function reportWebVitals() {
  const sendToAnalytics = (metric: Metric) => {
    // In production, send this to a real endpoint or GA4
    if (process.env.NODE_ENV === 'production') {
      const body = JSON.stringify(metric);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/vitals', body);
      } else {
        fetch('/api/analytics/vitals', { body, method: 'POST', keepalive: true });
      }
    } else {
      console.log(metric);
    }
  };

  onCLS(sendToAnalytics);
  onINP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}
