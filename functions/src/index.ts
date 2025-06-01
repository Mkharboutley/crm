import { onCall } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import { Change, FirestoreEvent } from 'firebase-functions/v2/firestore';
import { QueryDocumentSnapshot } from 'firebase-functions/v2/firestore';

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage().bucket();

const PUSHER_BEAMS_INSTANCE_ID = '3edf71c5-d3e0-471a-aaa5-ebe35be280ba';
const PUSHER_BEAMS_SECRET_KEY = '2F4FB361366FD9BFF56C6A64505291736F26B98B79CBF460699E5E7616B44154';

export const notifyClientWhenReady = onDocumentUpdated(
  'tickets/{ticketId}',
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!before || !after) return;

    if (before.status !== 'assigned' && after.status === 'assigned') {
      const ticketId = event.params.ticketId;
      const ticketNumber = after.ticket_number?.toString().padStart(4, '0');
      if (!ticketNumber) return;

      const response = await fetch(
        `https://${PUSHER_BEAMS_INSTANCE_ID}.pushnotifications.pusher.com/publish_api/v1/instances/${PUSHER_BEAMS_INSTANCE_ID}/publishes/interest`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${PUSHER_BEAMS_SECRET_KEY}`,
          },
          body: JSON.stringify({
            interests: [`ticket-${ticketNumber}`],
            web: {
              notification: {
                title: 'Your Car is Ready',
                body: `Your vehicle is being prepared. ETA: ${after.etaMinutes ?? '--'} mins.`,
                deep_link: `https://qr-ivalet.vercel.app/clients/${ticketNumber}`,
              },
            },
          }),
        }
      );

      const result = await response.json();
      logger.info('✅ Beams notification sent:', result);
    }
  }
);

export const assignTicketToWorker = onCall(async (request: any) => {
  const { ticketId, workerId } = request.data;
  await db.collection('tickets').doc(ticketId).update({
    assignedWorker: workerId,
    status: 'assigned',
    assignedAt: admin.firestore.Timestamp.now(),
  });
  return { success: true };
});

export const completeTicket = onCall(async (request: any) => {
  const { ticketId } = request.data;
  await db.collection('tickets').doc(ticketId).update({
    status: 'completed',
    completedAt: admin.firestore.Timestamp.now(),
  });
  return { success: true };
});

export const cancelTicket = onCall(async (request: any) => {
  const { ticketId } = request.data;
  await db.collection('tickets').doc(ticketId).update({
    status: 'cancelled',
    cancelledAt: admin.firestore.Timestamp.now(),
  });
  return { success: true };
});

export const expireUnscannedTickets = onSchedule('every 5 minutes', async () => {
  const now = admin.firestore.Timestamp.now();
  const snapshot = await db.collection('tickets').where('status', '==', 'assigned').get();
  const batch = db.batch();

  snapshot.forEach((doc) => {
    const data = doc.data();
    const assignedAt = data.assignedAt;
    if (assignedAt && now.seconds - assignedAt.seconds > 300) {
      batch.update(doc.ref, { status: 'expired', expiredAt: now });
    }
  });

  await batch.commit();
  logger.info('⏳ Expired unscanned tickets processed.');
});

export const notifyBeforeArrival = onSchedule('every 1 minutes', async () => {
  const now = Date.now();
  const snapshot = await db.collection('tickets').where('status', '==', 'requested').get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const ticketId = doc.id;
    const ticketNumber = data.ticket_number?.toString().padStart(4, '0');
    const requestedAt = data.requestedAt?.toDate?.();
    const etaMinutes = data.etaMinutes;

    if (!ticketNumber || !requestedAt || !etaMinutes || data.preAlertSent) continue;

    const etaTime = requestedAt.getTime() + etaMinutes * 60000;
    const remaining = etaTime - now;

    if (remaining > 170000 && remaining < 190000) {
      await fetch(`https://${PUSHER_BEAMS_INSTANCE_ID}.pushnotifications.pusher.com/publish_api/v1/instances/${PUSHER_BEAMS_INSTANCE_ID}/publishes/interest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PUSHER_BEAMS_SECRET_KEY}`,
        },
        body: JSON.stringify({
          interests: [`ticket-${ticketNumber}`],
          web: {
            notification: {
              title: '⏳ Your Car Is Almost Ready!',
              body: 'Your vehicle will arrive in 3 minutes. Please be ready.',
              deep_link: `https://qr-ivalet.vercel.app/clients/${ticketNumber}`
            }
          }
        })
      });

      await doc.ref.update({ preAlertSent: true });
      logger.info(`📣 Notified client 3 mins before arrival: Ticket ${ticketNumber}`);
    }
  }
});

