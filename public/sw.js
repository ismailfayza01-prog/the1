self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'New Delivery Offer',
    body: 'You have a new delivery offer. Tap to open your dashboard.',
    url: '/rider/dashboard',
    delivery_id: null,
  };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload = { ...payload, body: event.data.text() };
    }
  }

  const title = payload.title || 'New Delivery Offer';
  const options = {
    body: payload.body || 'You have a new delivery offer. Tap to open your dashboard.',
    icon: '/brand-logo.svg',
    badge: '/brand-logo.svg',
    tag: 'delivery-offer',
    renotify: true,
    data: {
      url: payload.url || '/rider/dashboard',
      delivery_id: payload.delivery_id || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/rider/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/rider/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
