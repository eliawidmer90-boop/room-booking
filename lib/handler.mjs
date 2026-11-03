import { BookingError, localDay, validateBooking, validateRange } from './booking.mjs';

export function createHandler(getStore, { demo = false, now = () => new Date() } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control','no-store, max-age=0');
    try {
      const url = new URL(req.url,'http://localhost');
      const method = req.method;
      if (!['GET','POST','DELETE'].includes(method)) {
        res.setHeader('Allow','GET, POST, DELETE');
        throw new BookingError('Method not allowed.',405,'METHOD_NOT_ALLOWED');
      }
      // No login is needed. The name and meeting details are intentionally public.
      // Only a booking's private cancellation token can remove it.
      if (method !== 'GET' && req.headers.origin) {
        const expected = req.headers['x-forwarded-host'] || req.headers.host;
        if (new URL(req.headers.origin).host !== expected) throw new BookingError('Please book from this website.',403,'BAD_ORIGIN');
      }
      if (method !== 'GET' && !req.headers['content-type']?.includes('application/json')) throw new BookingError('Send booking details as JSON.',415);
      const store = await getStore();
      if (method === 'GET') {
        const id = url.searchParams.get('id');
        if (id) {
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new BookingError('Invalid booking reference.');
          const booking = await store.get(id);
          if (!booking) throw new BookingError('This booking has already been cancelled or does not exist.',404,'NOT_FOUND');
          return res.status(200).json({ booking, demo });
        }
        const day = localDay(now());
        const { from, to } = validateRange(url.searchParams.get('from') || day, url.searchParams.get('to') || day);
        return res.status(200).json({ bookings: await store.list(from,to), demo, serverTime: now().toISOString() });
      }
      const body = req.body;
      if (method === 'POST') {
        const booking = await store.create(validateBooking(body, now()));
        return res.status(201).json({ booking, demo });
      }
      if (!body || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id || '') || !/^[a-f0-9]{64}$/.test(body.cancelToken || '')) throw new BookingError('The cancellation link is incomplete.');
      await store.cancel(body.id,body.cancelToken);
      return res.status(200).json({ cancelled: true });
    } catch (error) {
      if (error instanceof BookingError) return res.status(error.status).json({ error: error.message, code: error.code });
      if (error.code === '42P01') return res.status(503).json({ error: 'The booking service is being set up. Please try again later.', code: 'SCHEMA_REQUIRED' });
      console.error('Booking request failed:', error.code || error.name);
      return res.status(503).json({ error: 'The booking service is unavailable. Please try again shortly.', code: 'SERVICE_UNAVAILABLE' });
    }
  };
}
