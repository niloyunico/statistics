const express = require('express');
const ImageKit = require('@imagekit/nodejs');
const activity = require('./activity-log');

function mount(app) {
  const path = '/api/webhooks/imagekit';
  app.get(path, (req, res) => res.json({ ok: true, provider: 'imagekit',
    configured: !!process.env.IMAGEKIT_WEBHOOK_SECRET }));
  app.post(path, express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
    const secret = process.env.IMAGEKIT_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ ok: false, error: 'ImageKit webhook signing secret is not configured.' });
    let event;
    try {
      const client = new ImageKit({ privateKey: process.env.IMAGEKIT_PRIVATE_KEY || 'unused', webhookSecret: secret });
      event = client.webhooks.unwrap(req.body.toString('utf8'), { headers: req.headers });
      if (!event.id || typeof event.type !== 'string') throw new Error('Invalid event');
    } catch (e) { return res.status(401).json({ ok: false, error: 'Invalid webhook signature or payload.' }); }
    // Notifications are audit-only. An external delete must not erase staff data
    // or attempt to guess who owns a newly uploaded portrait.
    await activity.record({ action: 'imagekit_webhook', name: 'ImageKit',
      target: String(event.id).slice(0, 150), detail: event.type.slice(0, 150) });
    res.json({ ok: true, received: true });
  });
}
module.exports = { mount };
