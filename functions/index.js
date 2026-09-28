const {
  onDocumentCreated,
  onDocumentUpdated
} = require("firebase-functions/v2/firestore");

const { setGlobalOptions } = require("firebase-functions/v2");

const { initializeApp } = require("firebase-admin/app");

const {
  getFirestore,
  FieldValue
} = require("firebase-admin/firestore");

const { getMessaging } = require("firebase-admin/messaging");

const { logger } = require("firebase-functions");


// =====================================================
// Firebase
// =====================================================

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

setGlobalOptions({
  region: "europe-west1",
  maxInstances: 10
});


// =====================================================
// إرسال إشعار إلى مستخدم
// =====================================================

async function sendNotificationToUser(
  userId,
  title,
  body,
  data = {}
) {

  if (!userId) return;

  try {

    const userRef =
      db.collection("users").doc(userId);

    const userSnap =
      await userRef.get();

    if (!userSnap.exists) {

      logger.warn(
        `User ${userId} does not exist`
      );

      return;
    }

    const userData =
      userSnap.data() || {};


    // الحصول على رموز FCM
    let tokens =
      Array.isArray(userData.fcmTokens)
        ? userData.fcmTokens.filter(Boolean)
        : [];


    // دعم الرمز القديم إن وجد
    if (
      tokens.length === 0 &&
      userData.fcmToken
    ) {

      tokens = [
        userData.fcmToken
      ];

    }


    // إزالة التكرار
    tokens = [
      ...new Set(tokens)
    ];


    if (tokens.length === 0) {

      logger.info(
        `No FCM tokens for user ${userId}`
      );

      return;
    }


    // تحويل بيانات الإشعار إلى نصوص
    const cleanData = {};

    for (
      const [key, value]
      of Object.entries(data || {})
    ) {

      cleanData[String(key)] =
        String(value ?? "");

    }


    // رسالة FCM
    const message = {

      tokens,

      notification: {

        title:
          String(title || "خدماتي"),

        body:
          String(body || "")

      },

      data: {

        title:
          String(title || "خدماتي"),

        body:
          String(body || ""),

        ...cleanData

      },

      webpush: {

        notification: {

          title:
            String(title || "خدماتي"),

          body:
            String(body || ""),

          icon:
            "/icon-192.png",

          badge:
            "/icon-192.png",

          dir: "rtl",

          lang: "ar"

        },

        fcmOptions: {

          link:
            data.url ||
            "/index.html"

        }

      }

    };


    // إرسال الإشعار
    const response =
      await messaging.sendEachForMulticast(
        message
      );


    logger.info(
      `FCM result for ${userId}: ` +
      `${response.successCount} success, ` +
      `${response.failureCount} failed`
    );


    // الرموز التي لم تعد صالحة
    const invalidTokens = [];


    response.responses.forEach(
      (result, index) => {

        if (!result.success) {

          const code =
            result.error?.code || "";


          if (

            code.includes(
              "registration-token-not-registered"
            )

            ||

            code.includes(
              "invalid-registration-token"
            )

          ) {

            invalidTokens.push(
              tokens[index]
            );

          }

        }

      }
    );


    // حذف الرموز القديمة
    if (
      invalidTokens.length > 0
    ) {

      await userRef.update({

        fcmTokens:
          FieldValue.arrayRemove(
            ...invalidTokens
          )

      });

    }


  } catch (error) {

    logger.error(
      "FCM notification error:",
      error
    );

  }

}



// =====================================================
// 🔔 إشعار رسالة جديدة
// =====================================================

exports.notifyNewMessage =
  onDocumentCreated(

    "conversations/{conversationId}/messages/{messageId}",

    async (event) => {

      const snapshot =
        event.data;

      if (!snapshot) return;


      const message =
        snapshot.data() || {};


      const conversationId =
        event.params.conversationId;


      const messageId =
        event.params.messageId;


      const senderId =
        message.senderId;


      if (!senderId) return;


      // الحصول على المحادثة
      const conversationRef =
        db
          .collection("conversations")
          .doc(conversationId);


      const conversationSnap =
        await conversationRef.get();


      if (!conversationSnap.exists) {

        logger.warn(
          `Conversation ${conversationId} not found`
        );

        return;
      }


      const conversation =
        conversationSnap.data() || {};


      const participants =
        Array.isArray(
          conversation.participants
        )
          ? conversation.participants
          : [];


      // إرسال الإشعار لكل المشاركين
      // باستثناء المرسل
      const recipients =
        participants.filter(
          uid =>
            uid &&
            uid !== senderId
        );


      if (
        recipients.length === 0
      ) return;


      const senderName =
        message.senderName ||

        conversation
          .participantNames?.[senderId] ||

        "مستخدم";


      let body =
        String(
          message.text || ""
        ).trim();


      // إذا لم تكن رسالة نصية
      if (!body) {

        if (
          message.type === "image"
        ) {

          body = "📷 صورة";

        }

        else if (
          message.type === "voice"
        ) {

          body = "🎤 رسالة صوتية";

        }

        else {

          body = "💬 رسالة جديدة";

        }

      }


      // إرسال الإشعار
      await Promise.all(

        recipients.map(
          recipientId =>

            sendNotificationToUser(

              recipientId,

              `رسالة من ${senderName}`,

              body,

              {

                type:
                  "message",

                conversationId:
                  conversationId,

                messageId:
                  messageId,

                senderId:
                  senderId,

                url:
                  `/index.html?conversation=${encodeURIComponent(
                    conversationId
                  )}`

              }

            )

        )

      );

    }

  );



// =====================================================
// 📋 إشعار حجز جديد للحرفي
// =====================================================

exports.notifyNewBooking =
  onDocumentCreated(

    "bookings/{bookingId}",

    async (event) => {

      const snapshot =
        event.data;

      if (!snapshot) return;


      const booking =
        snapshot.data() || {};


      const bookingId =
        event.params.bookingId;


      const craftsmanId =
        booking.craftsmanId;


      if (!craftsmanId) {

        logger.warn(
          "Booking has no craftsmanId"
        );

        return;
      }


      const customerName =
        booking.customerName ||

        booking.customerEmail ||

        "عميل";


      const service =
        booking.serviceName ||

        booking.service ||

        booking.category ||

        "خدمة جديدة";


      await sendNotificationToUser(

        craftsmanId,

        "📋 حجز جديد",

        `${customerName} طلب ${service}`,

        {

          type:
            "new_booking",

          bookingId:
            bookingId,

          url:
            "/index.html#orders"

        }

      );

    }

  );



// =====================================================
// 🔄 إشعار تغيير حالة الحجز
// =====================================================

exports.notifyBookingStatus =
  onDocumentUpdated(

    "bookings/{bookingId}",

    async (event) => {

      const before =
        event.data?.before?.data() || {};


      const after =
        event.data?.after?.data() || {};


      // لا ترسل إشعارًا إذا لم تتغير الحالة
      if (
        before.status ===
        after.status
      ) {

        return;

      }


      const customerId =
        after.customerId;


      if (!customerId) {

        logger.warn(
          "Booking has no customerId"
        );

        return;
      }


      const bookingId =
        event.params.bookingId;


      const status =
        after.status ||
        "pending";


      const statusLabels = {

        pending:
          "قيد الانتظار",

        confirmed:
          "تم تأكيد الحجز",

        done:
          "تم إنجاز الحجز",

        cancelled:
          "تم إلغاء الحجز"

      };


      const statusText =
        statusLabels[status] ||
        String(status);


      await sendNotificationToUser(

        customerId,

        "🔔 تحديث الحجز",

        statusText,

        {

          type:
            "booking_status",

          bookingId:
            bookingId,

          status:
            status,

          url:
            "/index.html#orders"

        }

      );

    }

  );
